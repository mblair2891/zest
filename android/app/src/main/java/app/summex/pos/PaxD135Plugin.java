package app.summex.pos;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.util.Log;
import com.finix.mpos.models.Currency;
import com.finix.mpos.models.EnvEnum;
import com.finix.mpos.models.MerchantData;
import com.finix.mpos.models.PromptForSignature;
import com.finix.mpos.models.TransactionResult;
import com.finix.mpos.models.TransactionType;
import com.finix.mpos.models.RefundResult;
import com.finix.mpos.sdk.MPOSConnectionCallback;
import com.finix.mpos.sdk.MPOSFinix;
import com.finix.mpos.sdk.MPOSFinixImpl;
import com.finix.mpos.sdk.MPOSRefundCallback;
import com.finix.mpos.sdk.MPOSTransactionCallback;
import com.paxsz.easylink.api.EasyLinkSdkManager;
import com.paxsz.easylink.device.DeviceInfo;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import androidx.core.content.ContextCompat;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import kotlin.coroutines.Continuation;
import kotlin.coroutines.CoroutineContext;
import kotlin.coroutines.EmptyCoroutineContext;
import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okio.Buffer;
import org.json.JSONObject;

/**
 * Finix PAX D135 inside the station app. Sandbox (SB) only.
 * Scan uses the Android Bluetooth adapter. This plugin does not call Stripe.
 */
@CapacitorPlugin(
    name = "PaxD135",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            },
            alias = "bluetooth"
        ),
        @Permission(
            strings = { Manifest.permission.ACCESS_FINE_LOCATION },
            alias = "location"
        )
    }
)
public class PaxD135Plugin extends Plugin {
    static final String NAME_PREFIX = "PAX D135_";
    static final String NAME_MARK = "PAX D135";
    static final String MSG_BLUETOOTH = "Bluetooth is off, or no reader is in range.";
    static final String MSG_PERMISSION = "Allow Nearby devices and Location, then scan again.";
    static final String MSG_LIVE = "Live cards are not available in this build. Take cash or keep the check open.";
    static final String MSG_CONNECTING = "Connecting";
    static final String MSG_SETUP = "Setting up reader";
    /** Station activity result when MPOSConnectionCallback.onSuccess runs. */
    static final String MSG_CONNECTED = "Connected";
    static final String MSG_READY = "Reader ready";
    static final String MSG_CONNECT_TIMEOUT = "The connection timed out.";
    static final String MSG_CONNECT_REJECTED = "The reader rejected the connection.";
    static final String MSG_NO_RESPONSE = "The reader did not respond.";
    static final String MSG_NO_D135 = "No D135 with this serial is in range.";
    static final String MSG_DISCONNECT = "The reader disconnected. The check is not paid. Try again.";
    static final String MSG_NOT_CONNECTED = "Scan for the reader, then pick the registered PAX D135.";
    /** Pay status when the USB reader is unplugged. Card bytes stay in the Finix SDK. */
    static final String MSG_USB = "Card reader not connected";
    /** PAX USB vendor. Printer vendors are not readers. */
    static final int PAX_USB_VENDOR = 0x2FB8;
    static final String MSG_STILL_SETUP = "The reader is still setting up. No charge was sent.";
    static final String MSG_ALREADY = "This check is already paid. No second charge was sent.";
    static final String MSG_TIMEOUT = "The card read timed out. The check is not paid. Try again.";
    static final String MSG_UNREAD = "The card could not be read. The check stays open.";
    /** Missing sale id. Matches the station line so the pay screen does not call it a decline. */
    static final String MSG_SALE_ID = "The sale could not start. No charge was sent.";
    static final long SALE_TIMEOUT_MS = 90_000L;
    /** First Finix or Bluetooth callback. Key download uses CONNECT_TIMEOUT_MS after that. */
    static final long FIRST_RESPONSE_MS = 15_000L;
    /** First connection downloads keys on the D135. Do not shorten this wait. */
    static final long CONNECT_TIMEOUT_MS = 4L * 60L * 1000L;
    static final int SCAN_MS = 6_000;

    private final Set<String> capturedChecks = new HashSet<>();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicInteger scanGeneration = new AtomicInteger();
    /** Held for the process. A new plugin instance must not drop a ready reader. */
    private static volatile MPOSFinix heldMpos;
    /** One hook on the card-reader client. Later sales reuse it. */
    private static final AtomicBoolean saleIdempotencyHookReady = new AtomicBoolean(false);
    private static final AtomicBoolean saleIdempotencyHookLogged = new AtomicBoolean(false);
    private static volatile boolean heldReady;
    private static volatile boolean heldSettingUp;
    private static volatile String heldName = "";
    private static volatile String heldAddress = "";
    /** bluetooth, network, or usb. Sale follows the connection that last started. */
    private static volatile String heldLink = "bluetooth";
    /** True only after a USB EasyLink connect succeeded. A Bluetooth session does not set this. */
    private static volatile boolean heldUsb;
    private boolean usbWatchRegistered;
    private static volatile Integer heldBattery;
    private volatile MPOSFinix mpos;
    private volatile boolean settingUp;
    private volatile boolean connected;
    private volatile Integer batteryPercent;
    private HandlerThread worker;
    private Handler workerHandler;
    private BroadcastReceiver aclReceiver;
    private boolean aclRegistered;

    @PluginMethod
    public void scan(PluginCall call) {
        if (!bluetoothOn()) {
            resolveMessage(call, MSG_BLUETOOTH);
            return;
        }
        if (!hasScanPermissions()) {
            requestPermissionForAliases(scanAliases(), call, "scanPerms");
            return;
        }
        doScan(call);
    }

    @PermissionCallback
    private void scanPerms(PluginCall call) {
        if (!bluetoothOn()) {
            resolveMessage(call, MSG_BLUETOOTH);
            return;
        }
        if (!hasScanPermissions()) {
            resolveMessage(call, MSG_PERMISSION);
            return;
        }
        doScan(call);
    }

    @PermissionCallback
    private void connectPerms(PluginCall call) {
        if (!hasScanPermissions()) {
            resolveMessage(call, MSG_PERMISSION);
            return;
        }
        connect(call);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String env = call.getString("env", "");
        if (!"SB".equals(env)) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("message", MSG_LIVE);
            call.resolve(ret);
            return;
        }
        final boolean usb = "usb".equals(call.getString("link", ""));
        heldLink = usb ? "usb" : "bluetooth";
        if (!usb && !bluetoothOn()) {
            resolveMessage(call, MSG_BLUETOOTH);
            return;
        }
        if (!usb && !hasScanPermissions()) {
            requestPermissionForAliases(scanAliases(), call, "connectPerms");
            return;
        }
        final String name = call.getString("name", "");
        final String address = call.getString("address", "");
        final String merchantId = call.getString("merchantId", "");
        final String deviceId = call.getString("deviceId", "");
        final String userId = call.getString("userId", "");
        final String password = call.getString("password", "");
        final String mid = call.getString("mid", "");
        final String missing = missingMerchantField(merchantId, deviceId, userId, password, mid);
        if (!missing.isEmpty()) {
            Log.i("PaxD135", merchantDataPreview(merchantId, deviceId, userId, mid));
            Log.i("PaxD135", missing);
            resolveMessage(call, missing);
            return;
        }
        if (!usb && serialOf(name) == null) {
            resolveMessage(call, "Connection failed: missing Bluetooth address.");
            return;
        }
        final String diagnostic = finixConnectDiagnostic(merchantId, deviceId, userId, password);
        Log.i("PaxD135", merchantDataPreview(merchantId, deviceId, userId, mid));
        Log.i("PaxD135", diagnostic);
        restoreHeld();
        if (usb && heldUsb && usbReaderAttached() && reuseHeld(name, heldAddress)) {
            settingUp = false;
            connected = true;
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("message", MSG_CONNECTED);
            if (batteryPercent != null) ret.put("batteryPercent", batteryPercent);
            call.resolve(ret);
            emit("connected", finixConnectBanner(diagnostic, MSG_READY), serialOf(name), batteryPercent);
            watchUsb();
            return;
        }
        if (!usb && reuseHeld(name, address)) {
            heldUsb = false;
            settingUp = false;
            connected = true;
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("message", MSG_CONNECTED);
            if (batteryPercent != null) ret.put("batteryPercent", batteryPercent);
            call.resolve(ret);
            emit("connected", finixConnectBanner(diagnostic, MSG_READY), serialOf(name), batteryPercent);
            watchAcl();
            return;
        }
        stopScanBeforeConnect();
        settingUp = false;
        heldSettingUp = false;
        emit("connecting", diagnostic, serialOf(name), null);
        if (usb) {
            onWorker(() -> connectUsbOnWorker(call, name, merchantId, deviceId, userId, password, mid, diagnostic));
            return;
        }
        onWorker(() -> connectOnWorker(call, name, address, merchantId, deviceId, userId, password, mid, diagnostic));
    }

    /** Cable present or not. Does not read a card and does not open the printer. */
    @PluginMethod
    public void usbStatus(PluginCall call) {
        boolean attached = usbReaderAttached();
        JSObject ret = new JSObject();
        ret.put("attached", attached);
        ret.put("ready", attached && heldReady && "usb".equals(heldLink));
        call.resolve(ret);
        if (!attached && "usb".equals(heldLink) && heldReady) markUsbUnplugged();
    }

    /** Finish the authorized USB sale. The tip is not a second charge. */
    @PluginMethod
    public void capture(PluginCall call) {
        if (!"usb".equals(heldLink)) {
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("skipped", true);
            call.resolve(ret);
            return;
        }
        restoreHeld();
        if (!usbReaderAttached() || mpos == null) {
            resolveMessage(call, MSG_USB);
            return;
        }
        try {
            mpos.finishTransaction();
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            String detail = e.getMessage() == null ? "" : e.getMessage().trim();
            resolveMessage(call, detail.isEmpty() ? MSG_USB : detail);
        }
    }

    /** Void the authorized USB sale through the Finix SDK. No card bytes are parsed here. */
    @PluginMethod
    public void voidSale(PluginCall call) {
        if (!"usb".equals(heldLink)) {
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("skipped", true);
            call.resolve(ret);
            return;
        }
        restoreHeld();
        final MPOSFinix current = mpos;
        if (!usbReaderAttached() || current == null) {
            resolveMessage(call, MSG_USB);
            return;
        }
        final String transferId = call.getString("transferId", "");
        final int amount = call.getInt("amountCents", 0);
        if (transferId == null || transferId.trim().isEmpty() || amount <= 0) {
            resolveMessage(call, MSG_USB);
            return;
        }
        try {
            // The last argument is the refund idempotency slot. Null leaves this void without an id.
            current.startRefund(transferId.trim(), amount, new MPOSRefundCallback() {
                @Override
                public void onSuccess(RefundResult result) {
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    call.resolve(ret);
                }

                @Override
                public void onError(String error) {
                    String shown = error == null ? "" : error.replaceAll("\\s+", " ").trim();
                    resolveMessage(call, shown.isEmpty() ? MSG_USB : shown);
                }
            }, null);
        } catch (Exception e) {
            String detail = e.getMessage() == null ? "" : e.getMessage().trim();
            resolveMessage(call, detail.isEmpty() ? MSG_USB : detail);
        }
    }

    @PluginMethod
    public void sale(PluginCall call) {
        final String checkId = call.getString("checkId", "");
        final int amount = call.getInt("amountCents", 0);
        if (checkId == null || checkId.isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("code", "error");
            ret.put("message", MSG_UNREAD);
            call.resolve(ret);
            return;
        }
        synchronized (capturedChecks) {
            if (capturedChecks.contains(checkId)) {
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("code", "already_captured");
                ret.put("message", MSG_ALREADY);
                call.resolve(ret);
                return;
            }
        }
        if (settingUp) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("code", "setting_up");
            ret.put("message", MSG_STILL_SETUP);
            call.resolve(ret);
            return;
        }
        restoreHeld();
        if ("usb".equals(heldLink) && !usbReaderAttached()) {
            markUsbUnplugged();
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("code", "disconnect");
            ret.put("message", MSG_USB);
            call.resolve(ret);
            return;
        }
        final MPOSFinix current = mpos;
        final boolean wasReady = heldReady || connected;
        boolean live = false;
        try {
            live = current != null && current.isConnected();
        } catch (Exception ignored) {
            live = false;
        }
        if (!wasReady || !live) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            if (wasReady) {
                markDropped();
                ret.put("code", "disconnect");
                ret.put("message", MSG_DISCONNECT);
            } else {
                ret.put("code", "error");
                ret.put("message", MSG_NOT_CONNECTED);
            }
            call.resolve(ret);
            return;
        }
        if (amount <= 0) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("code", "error");
            ret.put("message", MSG_UNREAD);
            call.resolve(ret);
            return;
        }
        // Key for this attempt. The check stores the UUID. A retry sends the same value.
        final String idempotencyId = call.getString("idempotencyId", "");
        if (!isSaleIdempotencyId(idempotencyId)) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("code", "error");
            ret.put("message", MSG_SALE_ID);
            call.resolve(ret);
            return;
        }
        onWorker(() -> saleOnWorker(call, current, checkId, amount, idempotencyId));
    }

    /** UUID v4. The station saves this on the check and sends the same value on a retry. */
    private static boolean isSaleIdempotencyId(String value) {
        if (value == null) return false;
        return value.matches(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        );
    }

    private void connectOnWorker(
        PluginCall call,
        String name,
        String address,
        String merchantId,
        String deviceId,
        String userId,
        String password,
        String mid,
        String diagnostic
    ) {
        final AtomicBoolean settled = new AtomicBoolean(false);
        final AtomicBoolean heard = new AtomicBoolean(false);
        final String passedMerchant = merchantId == null ? "" : merchantId.trim();
        final String passedDevice = deviceId == null ? "" : deviceId.trim();
        final String passedUser = userId == null ? "" : userId;
        final String passedPassword = password == null ? "" : password;
        final String passedMid = mid == null ? "" : mid.trim();
        final String prefix = usernamePrefix(passedUser);
        final String merchantTrace = merchantDataTrace(passedMerchant, passedDevice, prefix, passedMid);
        Log.i("PaxD135", merchantTrace);
        final Runnable timeout = () -> {
            if (!settled.compareAndSet(false, true)) return;
            settingUp = false;
            heldSettingUp = false;
            connected = false;
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("message", MSG_CONNECT_TIMEOUT);
            putSdkTrace(ret, passedMerchant, passedDevice, prefix, MSG_CONNECT_TIMEOUT, "timeout");
            logSdkResult(merchantTrace, MSG_CONNECT_TIMEOUT, "timeout");
            call.resolve(ret);
        };
        try {
            if (passedMid.isEmpty()) {
                resolveMessage(call, "missing mid");
                return;
            }
            // ROLE_MERCHANT login, merchant, device, and mid come from the station call.
            // EnvEnum.SB when that call sends SB (FINIX_ENVIRONMENT=sandbox).
            MerchantData data = new MerchantData(
                passedMerchant,
                passedMid,
                passedDevice,
                Currency.USD,
                EnvEnum.SB,
                passedUser,
                passedPassword
            );
            final MPOSFinix next = MPOSFinix.Companion.invoke(getContext(), data);
            mpos = next;
            final BluetoothDevice device = scanForDevices(serialOf(name));
            if (device == null) {
                if (!settled.compareAndSet(false, true)) return;
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("message", MSG_NO_D135);
                putSdkTrace(ret, passedMerchant, passedDevice, prefix, MSG_NO_D135, "missing");
                call.resolve(ret);
                emit("error", MSG_NO_D135, serialOf(name), null);
                return;
            }
            main.postDelayed(timeout, FIRST_RESPONSE_MS);
            final MPOSConnectionCallback connectionCallback = new MPOSConnectionCallback() {
                private void allowKeyDownload() {
                    if (!heard.compareAndSet(false, true)) return;
                    main.removeCallbacks(timeout);
                    main.postDelayed(timeout, CONNECT_TIMEOUT_MS);
                }

                @Override
                public void onProcessing(String message) {
                    allowKeyDownload();
                    settingUp = true;
                    heldSettingUp = true;
                    Integer parsed = batteryFrom(message);
                    if (parsed != null) batteryPercent = parsed;
                    String shown = redactConnectSecrets(keyDownloadProgress(message), passedPassword, passedUser);
                    emit("processing", shown, serialOf(name), batteryPercent);
                    emit("setting_up", shown, serialOf(name), batteryPercent);
                }

                @Override
                public void onSuccess() {
                    if (!settled.compareAndSet(false, true)) return;
                    main.removeCallbacks(timeout);
                    settingUp = false;
                    heldSettingUp = false;
                    connected = true;
                    heldReady = true;
                    heldUsb = false;
                    heldMpos = next;
                    heldName = name;
                    heldAddress = address == null ? "" : address;
                    mpos = next;
                    Integer level = readBattery(next);
                    if (level != null) {
                        batteryPercent = level;
                        heldBattery = level;
                    }
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    ret.put("message", MSG_CONNECTED);
                    if (batteryPercent != null) ret.put("batteryPercent", batteryPercent);
                    putSdkTrace(ret, passedMerchant, passedDevice, prefix, MSG_CONNECTED, "none");
                    logSdkResult(merchantTrace, MSG_CONNECTED, "none");
                    call.resolve(ret);
                    emit("connected", finixConnectBanner(diagnostic, MSG_READY), serialOf(name), batteryPercent);
                    watchAcl();
                }

                @Override
                public void onError(String errorMessage) {
                    if (!settled.compareAndSet(false, true)) return;
                    main.removeCallbacks(timeout);
                    settingUp = false;
                    heldSettingUp = false;
                    connected = false;
                    String shown = callbackError(errorMessage);
                    String safeError = redactConnectSecrets(shown, passedPassword, passedUser);
                    String code = messageCode(safeError);
                    if (code.isEmpty()) code = "missing";
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    putSdkTrace(ret, passedMerchant, passedDevice, prefix, safeError, code);
                    logSdkResult(merchantTrace, safeError, code);
                    ret.put("message", safeError);
                    call.resolve(ret);
                    emit("error", safeError, serialOf(name), null);
                }
            };
            connect(next, device, connectionCallback);
        } catch (Exception e) {
            if (!settled.compareAndSet(false, true)) return;
            main.removeCallbacks(timeout);
            settingUp = false;
            heldSettingUp = false;
            connected = false;
            String detail = e.getMessage() == null ? "" : e.getMessage().trim();
            String shown = callbackError(detail.isEmpty() ? "Exception during connection" : detail);
            String safeDetail = redactConnectSecrets(shown, passedPassword, passedUser);
            String code = redactConnectSecrets(exceptionCode(e), passedPassword, passedUser);
            if (code.isEmpty()) code = "missing";
            JSObject ret = new JSObject();
            ret.put("ok", false);
            putSdkTrace(ret, passedMerchant, passedDevice, prefix, safeDetail, code);
            logSdkResult(merchantTrace, safeDetail, code);
            ret.put("message", safeDetail);
            call.resolve(ret);
            emit("error", safeDetail, serialOf(name), null);
        }
    }

    /**
     * Copy the sale body's idempotency_id onto Idempotency-Key for the card-reader post.
     * The SDK writes the body field and does not set that header. A missing body id
     * never reaches Finix, so no Transfer is created.
     */
    private static void ensureSaleIdempotencyHeader(MPOSFinix current) {
        if (saleIdempotencyHookReady.get()) return;
        synchronized (saleIdempotencyHookReady) {
            if (saleIdempotencyHookReady.get()) return;
            try {
                OkHttpClient client = cardReaderClient(current);
                if (client == null) throw new IllegalStateException("missing card reader client");
                List<Interceptor> next = new ArrayList<>(client.interceptors());
                for (Interceptor interceptor : next) {
                    if (interceptor instanceof SaleIdempotencyInterceptor) {
                        saleIdempotencyHookReady.set(true);
                        return;
                    }
                }
                next.add(new SaleIdempotencyInterceptor());
                Field field = OkHttpClient.class.getDeclaredField("interceptors");
                field.setAccessible(true);
                try {
                    Field modifiers = Field.class.getDeclaredField("modifiers");
                    modifiers.setAccessible(true);
                    modifiers.setInt(field, field.getModifiers() & ~Modifier.FINAL);
                } catch (Exception ignored) {
                    /* ART may already allow the write. */
                }
                field.set(client, Collections.unmodifiableList(next));
                saleIdempotencyHookReady.set(true);
                Log.i("PaxD135", "SDK sale Idempotency-Key hook installed");
            } catch (Exception e) {
                if (saleIdempotencyHookLogged.compareAndSet(false, true)) {
                    Log.i("PaxD135", "SDK sale Idempotency-Key hook unavailable");
                }
            }
        }
    }

    /** The OkHttp client that posts card_reader/authorizations and card_reader/transfers. */
    private static OkHttpClient cardReaderClient(MPOSFinix current) throws Exception {
        MPOSFinixImpl impl = implOf(current);
        if (impl == null) return null;
        Field serverField = MPOSFinixImpl.class.getDeclaredField("serverAction");
        serverField.setAccessible(true);
        Object server = serverField.get(impl);
        if (server == null) return null;
        Field repoField = server.getClass().getDeclaredField("a");
        repoField.setAccessible(true);
        Object repo = repoField.get(server);
        if (repo == null) return null;
        Field serviceField = repo.getClass().getDeclaredField("cpoService");
        serviceField.setAccessible(true);
        Object service = serviceField.get(repo);
        if (service == null || !Proxy.isProxyClass(service.getClass())) return null;
        Object handler = Proxy.getInvocationHandler(service);
        Field retrofitField = handler.getClass().getDeclaredField("this$0");
        retrofitField.setAccessible(true);
        Object retrofit = retrofitField.get(handler);
        if (retrofit == null) return null;
        Field callFactory = retrofit.getClass().getDeclaredField("callFactory");
        callFactory.setAccessible(true);
        Object factory = callFactory.get(retrofit);
        if (factory instanceof OkHttpClient) return (OkHttpClient) factory;
        return null;
    }

    /**
     * Card-reader sale and authorization posts only. Refunds and other calls pass through.
     * The original body bytes are replayed. The card payload is not logged.
     */
    private static final class SaleIdempotencyInterceptor implements Interceptor {
        @Override
        public Response intercept(Chain chain) throws IOException {
            Request request = chain.request();
            String path = request.url().encodedPath();
            boolean cardReaderSale =
                path.contains("card_reader/authorizations") || path.contains("card_reader/transfers");
            if (!cardReaderSale || request.body() == null) return chain.proceed(request);
            Buffer buffer = new Buffer();
            request.body().writeTo(buffer);
            byte[] bytes = buffer.readByteArray();
            String raw = new String(bytes, StandardCharsets.UTF_8);
            String key = saleBodyIdempotencyKey(raw);
            if (!isSaleIdempotencyId(key)) {
                Log.i("PaxD135", "SDK sale request missing idempotency_id");
                throw new IOException("SDK sale request missing idempotency_id");
            }
            Log.i("PaxD135", "SDK sale Idempotency-Key=" + key);
            RequestBody replay = RequestBody.create(bytes, request.body().contentType());
            Request next = request.newBuilder()
                .header("Idempotency-Key", key)
                .method(request.method(), replay)
                .build();
            return chain.proceed(next);
        }
    }

    /** idempotency_id from the card-reader JSON. A blank value or the word null is refused. */
    private static String saleBodyIdempotencyKey(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        try {
            JSONObject json = new JSONObject(raw);
            String snake = json.optString("idempotency_id", "");
            if (isSaleIdempotencyId(snake)) return snake;
            String camel = json.optString("idempotencyId", "");
            if (isSaleIdempotencyId(camel)) return camel;
        } catch (Exception ignored) {
            /* A body that is not JSON has no idempotency id. */
        }
        return "";
    }

    private void saleOnWorker(
        PluginCall call,
        MPOSFinix current,
        String checkId,
        int amount,
        String idempotencyId
    ) {
        final AtomicBoolean settled = new AtomicBoolean(false);
        final Runnable timeout = () -> {
            if (!settled.compareAndSet(false, true)) return;
            try {
                current.cancelTransaction();
            } catch (Exception ignored) {
                /* the read already failed */
            }
            resolveSaleFailure(call, MSG_TIMEOUT);
        };
        main.postDelayed(timeout, SALE_TIMEOUT_MS);
        try {
            // The check id is metadata. It is not a Finix buyer identity.
            HashMap<String, String> tags = new HashMap<>();
            if (checkId != null && !checkId.isEmpty()) tags.put("check", checkId);
            // The key is the check's stored attempt id. SDK 3.8.0 takes it as the last
            // startTransaction argument (Kotlin name idempotencyId) and writes JSON
            // idempotency_id on POST card_reader/authorizations. The same key is also
            // sent as the Idempotency-Key header on that post. A card_reader sale or
            // authorization whose body has no idempotency id is not sent.
            // That response has no idempotency field and no payment instrument.
            // This sale does not create a second charge.
            String saleRequest =
                "SDK sale request amountCents=" + amount
                + " transactionType=AUTHORIZATION"
                + " splitTransfers=null"
                + " buyerIdentityId=null"
                + " surcharge=null"
                + " tipAmount=null"
                + " tags.check=" + checkId
                + " promptForSignature=Never"
                + " idempotencyId=" + idempotencyId
                + " idempotency_id=" + idempotencyId
                + " Idempotency-Key=" + idempotencyId;
            Log.i("PaxD135", saleRequest);
            ensureSaleIdempotencyHeader(current);
            current.startTransaction(
                amount,
                TransactionType.AUTHORIZATION,
                new MPOSTransactionCallback() {
                    @Override
                    public void onProcessing(String message) {
                        String shown = message == null ? "" : message.replaceAll("\\s+", " ").trim();
                        if (!shown.isEmpty()) Log.i("PaxD135", "SDK sale processing " + shown);
                    }

                    @Override
                    public void onSuccess(TransactionResult result) {
                        if (!settled.compareAndSet(false, true)) return;
                        main.removeCallbacks(timeout);
                        finishSale(call, checkId, result, idempotencyId);
                    }

                    @Override
                    public void onError(String errorMessage) {
                        if (!settled.compareAndSet(false, true)) return;
                        main.removeCallbacks(timeout);
                        resolveSaleFailure(call, errorMessage);
                    }
                },
                null,
                tags,
                null,
                null,
                null,
                PromptForSignature.Never.INSTANCE,
                idempotencyId
            );
        } catch (Exception e) {
            if (!settled.compareAndSet(false, true)) return;
            main.removeCallbacks(timeout);
            String detail = e.getMessage() == null ? "" : e.getMessage().trim();
            resolveSaleFailure(call, detail.isEmpty() ? e.toString() : detail);
        }
    }

    /** The SDK sale callback, unchanged. A blank callback stays the unread line. */
    private void resolveSaleFailure(PluginCall call, String message) {
        String shown = message == null ? "" : message.replaceAll("\\s+", " ").trim();
        if (shown.isEmpty()) shown = MSG_UNREAD;
        Log.i("PaxD135", "SDK sale " + shown);
        JSObject ret = new JSObject();
        ret.put("ok", false);
        ret.put("code", codeFor(shown));
        ret.put("message", shown);
        call.resolve(ret);
    }

    /** Failure fields from the sale result. The account number is not included. */
    private static String saleFailureText(TransactionResult result) {
        if (result == null) return "";
        String message = result.getFailureMessage() == null ? "" : result.getFailureMessage().trim();
        String code = result.getFailureCode() == null ? "" : result.getFailureCode().trim();
        String state = result.getState() == null ? "" : result.getState().trim();
        String trace = result.getTraceId() == null ? "" : result.getTraceId().trim();
        StringBuilder out = new StringBuilder();
        if (!message.isEmpty()) out.append(message);
        appendSalePart(out, message, "code", code);
        appendSalePart(out, out.toString(), "state", state);
        appendSalePart(out, out.toString(), "trace", trace);
        return out.toString();
    }

    private static void appendSalePart(StringBuilder out, String existing, String label, String value) {
        if (value.isEmpty()) return;
        if (!existing.isEmpty() && existing.toLowerCase().contains(value.toLowerCase())) return;
        if (out.length() > 0) out.append(' ');
        out.append(label).append(' ').append(value);
    }

    private void finishSale(PluginCall call, String checkId, TransactionResult result, String idempotencyId) {
        String id = result == null || result.getId() == null ? "" : result.getId().trim();
        String failure = result == null || result.getFailureCode() == null ? "" : result.getFailureCode().trim();
        String state = result == null || result.getState() == null ? "" : result.getState();
        JSObject ret = new JSObject();
        if (id.isEmpty() || !failure.isEmpty() || state.toUpperCase().contains("FAIL")) {
            resolveSaleFailure(call, saleFailureText(result));
            return;
        }
        synchronized (capturedChecks) {
            capturedChecks.add(checkId);
        }
        ret.put("ok", true);
        ret.put("transferId", id);
        if (idempotencyId != null && !idempotencyId.isEmpty()) ret.put("idempotencyId", idempotencyId);
        String last4 = last4(result.getMaskedAccountNumber());
        if (last4 != null) ret.put("last4", last4);
        call.resolve(ret);
    }

    private void doScan(PluginCall call) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            main.post(() -> doScan(call));
            return;
        }
        BluetoothAdapter adapter = bluetoothAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            resolveMessage(call, MSG_BLUETOOTH);
            return;
        }
        emit("scanning", null, null, null);
        final int generation = scanGeneration.get();
        final Set<String> seen = new HashSet<>();
        final JSArray devices = new JSArray();
        harvestBonded(adapter, devices, seen);
        final AtomicBoolean done = new AtomicBoolean(false);
        final BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                String action = intent.getAction();
                if (!BluetoothDevice.ACTION_FOUND.equals(action) && !BluetoothDevice.ACTION_NAME_CHANGED.equals(action)) {
                    return;
                }
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                String extraName = intent.getStringExtra(BluetoothDevice.EXTRA_NAME);
                addPax(devices, seen, device, extraName);
            }
        };
        Runnable finish = () -> {
            if (!done.compareAndSet(false, true)) return;
            boolean ownsRadio = scanGeneration.get() == generation;
            harvestBonded(adapter, devices, seen);
            try {
                getContext().unregisterReceiver(receiver);
            } catch (Exception ignored) {
                /* already unregistered */
            }
            if (!ownsRadio) {
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("devices", devices);
                call.resolve(ret);
                return;
            }
            try {
                if (adapter.isDiscovering()) adapter.cancelDiscovery();
            } catch (SecurityException ignored) {
                /* scan already ended */
            }
            JSObject ret = new JSObject();
            ret.put("devices", devices);
            if (devices.length() == 0) {
                ret.put("ok", false);
                ret.put("message", !hasScanPermissions() ? MSG_PERMISSION : MSG_BLUETOOTH);
            } else {
                ret.put("ok", true);
            }
            call.resolve(ret);
        };
        main.post(() -> {
            IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
            filter.addAction(BluetoothDevice.ACTION_NAME_CHANGED);
            try {
                if (Build.VERSION.SDK_INT >= 33) {
                    getContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
                } else {
                    getContext().registerReceiver(receiver, filter);
                }
                if (!adapter.isDiscovering()) adapter.startDiscovery();
            } catch (SecurityException e) {
                finish.run();
                return;
            }
            main.postDelayed(finish, SCAN_MS);
        });
    }

    private void harvestBonded(BluetoothAdapter adapter, JSArray devices, Set<String> seen) {
        try {
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            if (bonded == null) return;
            for (BluetoothDevice device : bonded) addPax(devices, seen, device, null);
        } catch (SecurityException ignored) {
            /* names stay empty until Nearby devices is allowed */
        }
    }

    private void addPax(JSArray devices, Set<String> seen, BluetoothDevice device, String extraName) {
        if (device == null) return;
        String label = labelFor(device, extraName);
        if (serialOf(label) == null) return;
        String address = "";
        try {
            address = device.getAddress() == null ? "" : device.getAddress();
        } catch (SecurityException e) {
            address = "";
        }
        String key = address.isEmpty() ? label : address;
        if (!seen.add(key)) return;
        try {
            JSONObject row = new JSONObject();
            row.put("name", label);
            row.put("address", address);
            devices.put(row);
        } catch (Exception ignored) {
            seen.remove(key);
        }
    }

    private String labelFor(BluetoothDevice device, String extraName) {
        if (serialOf(extraName) != null) return extraName.trim();
        try {
            String name = device.getName();
            if (serialOf(name) != null) return name.trim();
        } catch (SecurityException e) {
            return null;
        }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                String alias = device.getAlias();
                if (serialOf(alias) != null) return alias.trim();
            } catch (SecurityException e) {
                return null;
            }
        }
        return null;
    }

    private BluetoothAdapter bluetoothAdapter() {
        try {
            BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            if (manager != null && manager.getAdapter() != null) return manager.getAdapter();
        } catch (Exception ignored) {
            /* fall through */
        }
        return BluetoothAdapter.getDefaultAdapter();
    }

    private boolean bluetoothOn() {
        BluetoothAdapter adapter = bluetoothAdapter();
        return adapter != null && adapter.isEnabled();
    }

    /** Nearby devices (scan + connect) and Location. Both are required before a scan. */
    private boolean hasScanPermissions() {
        Context ctx = getContext();
        if (ctx == null) return false;
        boolean location = granted(ctx, Manifest.permission.ACCESS_FINE_LOCATION);
        if (Build.VERSION.SDK_INT < 31) return location;
        return location
            && granted(ctx, Manifest.permission.BLUETOOTH_SCAN)
            && granted(ctx, Manifest.permission.BLUETOOTH_CONNECT);
    }

    private static boolean granted(Context ctx, String permission) {
        return ContextCompat.checkSelfPermission(ctx, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private String[] scanAliases() {
        if (Build.VERSION.SDK_INT >= 31) return new String[] { "bluetooth", "location" };
        return new String[] { "location" };
    }

    /**
     * Required MerchantData fields. An empty mid does not call connect.
     * The password value is not written.
     */
    private static String missingMerchantField(
        String merchantId,
        String deviceId,
        String userId,
        String password,
        String mid
    ) {
        if (merchantId == null || merchantId.trim().isEmpty()) return "missing merchantId";
        if (userId == null || userId.trim().isEmpty()) return "missing userId";
        if (password == null || password.trim().isEmpty()) return "missing password";
        if (deviceId == null || deviceId.trim().isEmpty()) return "missing deviceId";
        if (mid == null || mid.trim().isEmpty()) return "missing mid";
        return "";
    }

    /** First eight characters of the username. The rest is not written. */
    private static String userIdPreview(String userId) {
        if (userId == null) return "";
        String trimmed = userId.trim();
        if (trimmed.isEmpty()) return "";
        return trimmed.length() <= 8 ? trimmed : trimmed.substring(0, 8);
    }

    /**
     * MerchantData values before connect.
     * The username is the prefix. mid is present or not. The password is not written.
     */
    private static String merchantDataPreview(String merchantId, String deviceId, String userId, String mid) {
        String merchant = merchantId == null || merchantId.trim().isEmpty() ? "missing" : merchantId.trim();
        String device = deviceId == null || deviceId.trim().isEmpty() ? "missing" : deviceId.trim();
        String preview = userIdPreview(userId);
        String user = preview.isEmpty() ? "missing" : preview;
        String midPresent = mid != null && !mid.trim().isEmpty() ? "yes" : "no";
        return "merchantId " + merchant
            + ". deviceId " + device
            + ". userId prefix " + user
            + ". mid present " + midPresent
            + ". env SB.";
    }

    /**
     * Paired readers first, then a short discovery.
     * Keeps a BluetoothDevice whose name contains D135 and whose serial matches.
     */
    private BluetoothDevice scanForDevices(String serial) {
        BluetoothAdapter adapter = bluetoothAdapter();
        if (adapter == null || !adapter.isEnabled() || serial == null || serial.isEmpty()) return null;
        BluetoothDevice paired = findD135(bondedOf(adapter), serial);
        if (paired != null) return paired;
        final List<BluetoothDevice> found = new ArrayList<>();
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicBoolean registered = new AtomicBoolean(false);
        final BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                String action = intent.getAction();
                if (!BluetoothDevice.ACTION_FOUND.equals(action) && !BluetoothDevice.ACTION_NAME_CHANGED.equals(action)) {
                    return;
                }
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                String extraName = intent.getStringExtra(BluetoothDevice.EXTRA_NAME);
                BluetoothDevice match = matchD135(device, extraName, serial);
                if (match == null) return;
                found.add(match);
                latch.countDown();
            }
        };
        main.post(() -> {
            IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
            filter.addAction(BluetoothDevice.ACTION_NAME_CHANGED);
            try {
                if (Build.VERSION.SDK_INT >= 33) {
                    getContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
                } else {
                    getContext().registerReceiver(receiver, filter);
                }
                registered.set(true);
                if (!adapter.isDiscovering()) adapter.startDiscovery();
            } catch (Exception e) {
                latch.countDown();
            }
        });
        try {
            latch.await(SCAN_MS, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        main.post(() -> {
            if (registered.get()) {
                try {
                    getContext().unregisterReceiver(receiver);
                } catch (Exception ignored) {
                    /* already unregistered */
                }
            }
            try {
                if (adapter.isDiscovering()) adapter.cancelDiscovery();
            } catch (Exception ignored) {
                /* discovery already stopped */
            }
        });
        if (!found.isEmpty()) return found.get(0);
        return findD135(bondedOf(adapter), serial);
    }

    private Set<BluetoothDevice> bondedOf(BluetoothAdapter adapter) {
        try {
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            return bonded == null ? new HashSet<>() : bonded;
        } catch (SecurityException e) {
            return new HashSet<>();
        }
    }

    private BluetoothDevice findD135(Iterable<BluetoothDevice> devices, String serial) {
        if (devices == null) return null;
        for (BluetoothDevice device : devices) {
            BluetoothDevice match = matchD135(device, null, serial);
            if (match != null) return match;
        }
        return null;
    }

    /** Name contains D135 and the serial is the one the station tapped. */
    private BluetoothDevice matchD135(BluetoothDevice device, String extraName, String serial) {
        if (device == null || serial == null || serial.isEmpty()) return null;
        String name = serialOf(extraName) != null ? extraName.trim() : deviceName(device);
        if (name == null || !name.contains("D135")) return null;
        String found = serialOf(name);
        if (found == null || !found.equals(serial)) return null;
        return device;
    }

    private String deviceName(BluetoothDevice device) {
        try {
            String name = device.getName();
            if (name != null && !name.trim().isEmpty()) return name.trim();
        } catch (SecurityException e) {
            return null;
        }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                String alias = device.getAlias();
                if (alias != null && !alias.trim().isEmpty()) return alias.trim();
            } catch (SecurityException e) {
                return null;
            }
        }
        return null;
    }

    /**
     * Connects the BluetoothDevice scanForDevices returned.
     * A connect method that takes that device is used when the SDK has one.
     * Finix 3.7 publishes connect(String, String, callback). Those strings are
     * read from this device. The station name is not passed.
     */
    private void connect(MPOSFinix finix, BluetoothDevice device, MPOSConnectionCallback connectionCallback) {
        try {
            Method takingDevice = null;
            for (Method method : finix.getClass().getMethods()) {
                if (!"connect".equals(method.getName())) continue;
                Class<?>[] params = method.getParameterTypes();
                if (params.length == 2
                    && BluetoothDevice.class.isAssignableFrom(params[0])
                    && MPOSConnectionCallback.class.isAssignableFrom(params[1])) {
                    takingDevice = method;
                    break;
                }
            }
            if (takingDevice != null) {
                Log.i("PaxD135", "connect BluetoothDevice " + bluetoothLabel(device));
                takingDevice.invoke(finix, device, connectionCallback);
                return;
            }
            Method published = finix.getClass().getMethod(
                "connect",
                String.class,
                String.class,
                MPOSConnectionCallback.class
            );
            Log.i("PaxD135", "connect BluetoothDevice " + bluetoothLabel(device) + " " + bluetoothAddress(device));
            published.invoke(finix, bluetoothLabel(device), bluetoothAddress(device), connectionCallback);
        } catch (SecurityException e) {
            connectionCallback.onError(MSG_PERMISSION);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause() == null ? e : e.getCause();
            if (cause instanceof SecurityException) {
                connectionCallback.onError(MSG_PERMISSION);
                return;
            }
            String detail = cause.getMessage() == null ? "" : cause.getMessage().trim();
            connectionCallback.onError(detail.isEmpty() ? cause.toString() : detail);
        } catch (Exception e) {
            String detail = e.getMessage() == null ? "" : e.getMessage().trim();
            connectionCallback.onError(detail.isEmpty() ? e.toString() : detail);
        }
    }

    /** Name on the scanned device. The station label is not used. */
    private String bluetoothLabel(BluetoothDevice device) {
        String labeled = deviceName(device);
        return labeled == null ? "" : labeled;
    }

    /** Address on the scanned device. */
    private static String bluetoothAddress(BluetoothDevice device) {
        try {
            String address = device.getAddress();
            return address == null ? "" : address;
        } catch (SecurityException e) {
            return "";
        }
    }

    /**
     * Init line for MPOSFinix. Environment SB, merchant, device, and whether
     * the username and password are present. The values themselves are not written.
     * The device id is the reader row. A blank id stays missing.
     */
    private static String finixConnectDiagnostic(String merchantId, String deviceId, String userId, String password) {
        String merchant = merchantId == null ? "" : merchantId.trim();
        if (merchant.isEmpty()) merchant = "missing";
        String device = deviceId == null ? "" : deviceId.trim();
        if (device.isEmpty()) device = "missing";
        boolean userPresent = userId != null && !userId.trim().isEmpty();
        boolean passPresent = password != null && !password.trim().isEmpty();
        return "Environment SB. Username present " + (userPresent ? "yes" : "no")
            + ". Password present " + (passPresent ? "yes" : "no")
            + ". Merchant " + merchant
            + ". Device " + device
            + ".";
    }

    private static String finixConnectBanner(String diagnostic, String result) {
        String head = diagnostic == null ? "" : diagnostic.trim();
        String tail = result == null ? "" : result.trim();
        if (head.isEmpty()) return tail;
        if (tail.isEmpty()) return head;
        if (tail.startsWith(head)) return tail;
        return head + " " + tail;
    }

    /** Key-download callbacks stay as Finix wrote them. A blank line is Setting up reader. */
    private static String keyDownloadProgress(String message) {
        String text = message == null ? "" : message.trim();
        if (text.isEmpty()) return MSG_SETUP;
        return text;
    }

    /** First six characters of the merchant username. The rest of the username is not written. */
    private static String usernamePrefix(String userId) {
        if (userId == null || userId.isEmpty()) return "";
        return userId.length() <= 6 ? userId : userId.substring(0, 6);
    }

    /**
     * MerchantData arguments passed to MPOSFinix. Environment stays SB.
     * The password is not part of this line. The username is the prefix only.
     */
    private static String merchantDataTrace(String merchantId, String deviceId, String prefix, String mid) {
        String merchant = merchantId == null || merchantId.isEmpty() ? "missing" : merchantId;
        String device = deviceId == null || deviceId.isEmpty() ? "missing" : deviceId;
        String user = prefix == null || prefix.isEmpty() ? "missing" : prefix;
        String midPresent = mid != null && !mid.isEmpty() ? "yes" : "no";
        return "MerchantData merchantId " + merchant
            + ". deviceId " + device
            + ". username prefix " + user
            + ". mid present " + midPresent
            + ". environment SB.";
    }

    private static void putSdkTrace(
        JSObject ret,
        String merchant,
        String device,
        String prefix,
        String sdkMessage,
        String sdkCode
    ) {
        ret.put("merchantId", merchant == null ? "" : merchant);
        ret.put("deviceId", device == null ? "" : device);
        ret.put("usernamePrefix", prefix == null ? "" : prefix);
        ret.put("environment", "SB");
        ret.put("sdkMessage", sdkMessage == null ? "" : sdkMessage);
        ret.put("sdkCode", sdkCode == null || sdkCode.isEmpty() ? "missing" : sdkCode);
    }

    private static void logSdkResult(String merchantTrace, String sdkMessage, String sdkCode) {
        String code = sdkCode == null || sdkCode.isEmpty() ? "missing" : sdkCode;
        String message = sdkMessage == null ? "" : sdkMessage;
        Log.i("PaxD135", merchantTrace + " SDK message " + message + ". code " + code + ".");
    }

    private static String redactConnectSecrets(String text, String password, String userId) {
        String out = text == null ? "" : text;
        if (password != null && !password.isEmpty()) out = out.replace(password, "present");
        if (userId != null && userId.length() > 6) out = out.replace(userId, userId.substring(0, 6));
        return out;
    }

    private static String messageCode(String message) {
        if (message == null || message.isEmpty()) return "";
        Matcher json = Pattern.compile("\"code\"\\s*:\\s*\"([^\"]+)\"").matcher(message);
        if (json.find()) return json.group(1).trim();
        Matcher labeled = Pattern.compile("(?i)\\bcode\\s*[:=]\\s*([A-Za-z0-9_.-]+)").matcher(message);
        if (labeled.find()) return labeled.group(1).trim();
        return "";
    }

    private static String exceptionCode(Throwable error) {
        if (error == null) return "";
        String[] names = { "getCode", "getErrorCode", "getStatusCode", "getFailureCode" };
        for (String name : names) {
            try {
                Method method = error.getClass().getMethod(name);
                Object value = method.invoke(error);
                if (value == null) continue;
                String text = String.valueOf(value).trim();
                if (!text.isEmpty() && !"null".equals(text)) return text;
            } catch (Exception ignored) {
                /* this exception type has no code method */
            }
        }
        String fromMessage = messageCode(error.getMessage());
        if (!fromMessage.isEmpty()) return fromMessage;
        String simple = error.getClass().getSimpleName();
        return simple == null ? "" : simple;
    }

    /**
     * MPOSConnectionCallback.onError text, unchanged.
     * A blank callback is the 15 second wait.
     */
    private static String callbackError(String errorMessage) {
        String message = errorMessage == null ? "" : errorMessage.trim();
        if (message.isEmpty()) return MSG_CONNECT_TIMEOUT;
        return message;
    }

    private void restoreHeld() {
        if (mpos == null && heldMpos != null) mpos = heldMpos;
        if (heldBattery != null) batteryPercent = heldBattery;
        if (heldReady) connected = true;
        if (heldSettingUp) settingUp = true;
    }

    private boolean reuseHeld(String name, String address) {
        MPOSFinix current = heldMpos;
        if (!heldReady || current == null || name == null || !name.equals(heldName)) return false;
        if (address != null && !address.isEmpty() && heldAddress != null && !heldAddress.isEmpty() && !address.equals(heldAddress)) {
            return false;
        }
        try {
            return current.isConnected();
        } catch (Exception e) {
            return false;
        }
    }

    /** End discovery before connect. A late scan finish must not cancel the new link. */
    private void stopScanBeforeConnect() {
        scanGeneration.incrementAndGet();
        BluetoothAdapter adapter = bluetoothAdapter();
        if (adapter == null) return;
        try {
            if (adapter.isDiscovering()) adapter.cancelDiscovery();
        } catch (SecurityException ignored) {
            /* discovery already stopped */
        }
    }

    private void markDropped() {
        heldReady = false;
        connected = false;
        settingUp = false;
        heldSettingUp = false;
        emit("disconnected", MSG_DISCONNECT, serialOf(heldName), null);
    }

    private void watchAcl() {
        if (aclRegistered || getContext() == null) return;
        aclReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(intent.getAction())) return;
                if (!heldReady) return;
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                String address = "";
                try {
                    address = device == null || device.getAddress() == null ? "" : device.getAddress();
                } catch (SecurityException ignored) {
                    address = "";
                }
                if (heldAddress == null || heldAddress.isEmpty() || address.isEmpty() || !heldAddress.equals(address)) return;
                markDropped();
            }
        };
        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_ACL_DISCONNECTED);
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                getContext().registerReceiver(aclReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(aclReceiver, filter);
            }
            aclRegistered = true;
        } catch (Exception ignored) {
            /* the next sale still checks isConnected */
        }
    }

    /**
     * USB host connect on the Finix EasyLink instance.
     * The public Finix connect(String, String) always opens Bluetooth, so this path does not call it.
     * Card data stays inside the SDK. This method does not read a PAN.
     */
    private void connectUsbOnWorker(
        PluginCall call,
        String name,
        String merchantId,
        String deviceId,
        String userId,
        String password,
        String mid,
        String diagnostic
    ) {
        final AtomicBoolean settled = new AtomicBoolean(false);
        final String passedMerchant = merchantId == null ? "" : merchantId.trim();
        final String passedDevice = deviceId == null ? "" : deviceId.trim();
        final String passedUser = userId == null ? "" : userId;
        final String passedPassword = password == null ? "" : password;
        final String passedMid = mid == null ? "" : mid.trim();
        final String prefix = usernamePrefix(passedUser);
        try {
            if (passedMid.isEmpty()) {
                resolveMessage(call, "missing mid");
                return;
            }
            if (!usbReaderAttached()) {
                resolveMessage(call, MSG_USB);
                emit("error", MSG_USB, serialOf(name), null);
                return;
            }
            UsbDevice hardware = findCardReader(usbManager());
            if (hardware != null) {
                UsbManager mgr = usbManager();
                if (mgr != null && !mgr.hasPermission(hardware) && !requestUsbPermission(mgr, hardware)) {
                    resolveMessage(call, MSG_USB);
                    emit("error", MSG_USB, serialOf(name), null);
                    return;
                }
            }
            MerchantData data = new MerchantData(
                passedMerchant,
                passedMid,
                passedDevice,
                Currency.USD,
                EnvEnum.SB,
                passedUser,
                passedPassword
            );
            final MPOSFinix next = MPOSFinix.Companion.invoke(getContext(), data);
            mpos = next;
            MPOSFinixImpl impl = implOf(next);
            EasyLinkSdkManager easy = easyLinkOf(impl);
            if (easy == null) easy = EasyLinkSdkManager.getInstance(getContext());
            if (easy == null) {
                resolveMessage(call, MSG_USB);
                emit("error", MSG_USB, serialOf(name), null);
                return;
            }
            DeviceInfo info = pickUsbReader(easy);
            if (info == null) {
                resolveMessage(call, MSG_USB);
                emit("error", MSG_USB, serialOf(name), null);
                return;
            }
            info.setCommType(DeviceInfo.CommType.USB);
            final MPOSConnectionCallback connectionCallback = new MPOSConnectionCallback() {
                @Override
                public void onProcessing(String message) {
                    settingUp = true;
                    heldSettingUp = true;
                    String shown = message == null ? "" : message.replaceAll("\\s+", " ").trim();
                    emit("setting_up", shown, serialOf(name), null);
                }

                @Override
                public void onSuccess() {
                    if (!settled.compareAndSet(false, true)) return;
                    markUsbReady(next, name);
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    ret.put("message", MSG_CONNECTED);
                    putSdkTrace(ret, passedMerchant, passedDevice, prefix, MSG_CONNECTED, "none");
                    call.resolve(ret);
                    emit("connected", finixConnectBanner(diagnostic, MSG_READY), serialOf(name), null);
                    watchUsb();
                }

                @Override
                public void onError(String errorMessage) {
                    if (!settled.compareAndSet(false, true)) return;
                    settingUp = false;
                    heldSettingUp = false;
                    connected = false;
                    heldUsb = false;
                    String shown = callbackError(errorMessage);
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    ret.put("message", shown);
                    call.resolve(ret);
                    emit("error", shown, serialOf(name), null);
                }
            };
            int code = easy.connect(info);
            if (!usbCommandOk(impl, code)) {
                resolveMessage(call, MSG_USB);
                emit("error", MSG_USB, serialOf(name), null);
                return;
            }
            if (impl != null) {
                markFinixUsbState(impl);
                Object pending = configureUsbReader(impl, connectionCallback);
                if (pending != kotlin.coroutines.intrinsics.IntrinsicsKt.getCOROUTINE_SUSPENDED()
                    && settled.compareAndSet(false, true)) {
                    markUsbReady(next, name);
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    ret.put("message", MSG_CONNECTED);
                    call.resolve(ret);
                    emit("connected", finixConnectBanner(diagnostic, MSG_READY), serialOf(name), null);
                    watchUsb();
                }
            } else if (settled.compareAndSet(false, true)) {
                markUsbReady(next, name);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("message", MSG_CONNECTED);
                call.resolve(ret);
                emit("connected", finixConnectBanner(diagnostic, MSG_READY), serialOf(name), null);
                watchUsb();
            }
        } catch (Exception e) {
            if (!settled.compareAndSet(false, true)) return;
            String detail = e.getMessage() == null ? "" : e.getMessage().trim();
            resolveMessage(call, detail.isEmpty() ? MSG_USB : detail);
        }
    }

    /**
     * The Finix connection helpers are synthetic. Java source cannot call them directly.
     * Card data stays inside the SDK.
     */
    private static EasyLinkSdkManager easyLinkOf(MPOSFinixImpl impl) {
        if (impl == null) return null;
        try {
            Method method = MPOSFinixImpl.class.getDeclaredMethod("access$getEasyLink$p", MPOSFinixImpl.class);
            method.setAccessible(true);
            Object value = method.invoke(null, impl);
            if (value instanceof EasyLinkSdkManager) return (EasyLinkSdkManager) value;
        } catch (Exception ignored) {
            /* The process EasyLink instance is the fallback. */
        }
        return null;
    }

    private static boolean usbCommandOk(MPOSFinixImpl impl, int code) {
        if (code == 0) return true;
        if (impl == null) return false;
        try {
            Method method = MPOSFinixImpl.class.getDeclaredMethod(
                "access$isCommandSuccessful",
                MPOSFinixImpl.class,
                int.class
            );
            method.setAccessible(true);
            return Boolean.TRUE.equals(method.invoke(null, impl, code));
        } catch (Exception ignored) {
            return false;
        }
    }

    private static void markFinixUsbState(MPOSFinixImpl impl) {
        if (impl == null) return;
        try {
            Class<?> state = Class.forName("com.finix.mpos.sdk.MPOSFinixImpl$ConnectionState");
            @SuppressWarnings({ "unchecked", "rawtypes" })
            Object connected = Enum.valueOf((Class) state, "CONNECTED");
            Method method = MPOSFinixImpl.class.getDeclaredMethod(
                "access$setConnectionState$p",
                MPOSFinixImpl.class,
                state
            );
            method.setAccessible(true);
            method.invoke(null, impl, connected);
        } catch (Exception ignored) {
            /* EasyLink already accepted the USB device. */
        }
    }

    private static Object configureUsbReader(MPOSFinixImpl impl, MPOSConnectionCallback callback) throws Exception {
        Method method = MPOSFinixImpl.class.getDeclaredMethod(
            "access$configureConnectedDevice",
            MPOSFinixImpl.class,
            MPOSConnectionCallback.class,
            Continuation.class
        );
        method.setAccessible(true);
        return method.invoke(null, impl, callback, usbContinuation());
    }

    private void markUsbReady(MPOSFinix next, String name) {
        settingUp = false;
        heldSettingUp = false;
        connected = true;
        heldReady = true;
        heldUsb = true;
        heldLink = "usb";
        heldMpos = next;
        heldName = name == null ? "" : name;
        heldAddress = "usb";
        mpos = next;
    }

    private void markUsbUnplugged() {
        heldReady = false;
        heldUsb = false;
        connected = false;
        settingUp = false;
        heldSettingUp = false;
        emit("disconnected", MSG_USB, serialOf(heldName), null);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Continuation usbContinuation() {
        return new Continuation() {
            @Override
            public CoroutineContext getContext() {
                return EmptyCoroutineContext.INSTANCE;
            }

            @Override
            public void resumeWith(Object result) {
                /* The connection callback resolves the plugin call. */
            }
        };
    }

    private static MPOSFinixImpl implOf(MPOSFinix finix) {
        if (finix == null) return null;
        try {
            java.lang.reflect.Field field = MPOSFinix.class.getDeclaredField("delegate");
            field.setAccessible(true);
            Object value = field.get(finix);
            if (value instanceof MPOSFinixImpl) return (MPOSFinixImpl) value;
        } catch (Exception ignored) {
            /* EasyLink on the process instance is the fallback. */
        }
        return null;
    }

    private DeviceInfo pickUsbReader(EasyLinkSdkManager easy) {
        if (easy != null) {
            try {
                java.util.List<DeviceInfo> found = easy.getUsbDevice();
                if (found != null) {
                    for (DeviceInfo info : found) {
                        if (info == null || printerVendor(info.getVendorId())) continue;
                        info.setCommType(DeviceInfo.CommType.USB);
                        return info;
                    }
                }
            } catch (Exception ignored) {
                /* Fall through to the Android USB host list. */
            }
        }
        UsbDevice dev = findCardReader(usbManager());
        if (dev == null) return null;
        String label = dev.getProductName() == null ? dev.getDeviceName() : dev.getProductName();
        DeviceInfo info = new DeviceInfo(DeviceInfo.CommType.USB, label, dev.getDeviceName());
        info.setVendorId(dev.getVendorId());
        info.setProductId(dev.getProductId());
        return info;
    }

    private boolean usbReaderAttached() {
        Context ctx = getContext();
        if (ctx == null) return false;
        try {
            EasyLinkSdkManager easy = EasyLinkSdkManager.getInstance(ctx);
            java.util.List<DeviceInfo> found = easy == null ? null : easy.getUsbDevice();
            if (found != null) {
                for (DeviceInfo info : found) {
                    if (info != null && !printerVendor(info.getVendorId())) return true;
                }
            }
        } catch (Exception ignored) {
            /* The host list below is enough to show the cable. */
        }
        return findCardReader(usbManager()) != null;
    }

    private UsbManager usbManager() {
        Context ctx = getContext();
        if (ctx == null) return null;
        Object service = ctx.getSystemService(Context.USB_SERVICE);
        return service instanceof UsbManager ? (UsbManager) service : null;
    }

    static boolean printerVendor(int vid) {
        return vid == 0x04B8 || vid == 0x0519 || vid == 0x1504 || vid == 0x1D90 || vid == 0x0FE6;
    }

    static boolean isCardReader(UsbDevice dev) {
        if (dev == null) return false;
        int vid = dev.getVendorId();
        if (printerVendor(vid)) return false;
        if (dev.getDeviceClass() == UsbConstants.USB_CLASS_PRINTER) return false;
        for (int i = 0; i < dev.getInterfaceCount(); i++) {
            if (dev.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) return false;
        }
        if (vid == PAX_USB_VENDOR) return true;
        String name = ((dev.getProductName() == null ? "" : dev.getProductName()) + " "
            + (dev.getDeviceName() == null ? "" : dev.getDeviceName())).toLowerCase();
        return name.contains("d135") || name.contains("pax") || name.contains("finix");
    }

    static UsbDevice findCardReader(UsbManager mgr) {
        if (mgr == null) return null;
        for (UsbDevice dev : mgr.getDeviceList().values()) {
            if (isCardReader(dev)) return dev;
        }
        return null;
    }

    private boolean requestUsbPermission(UsbManager mgr, UsbDevice dev) {
        Context ctx = getContext();
        if (ctx == null || dev == null) return false;
        if (mgr.hasPermission(dev)) return true;
        CountDownLatch latch = new CountDownLatch(1);
        boolean[] granted = new boolean[] { false };
        String action = ctx.getPackageName() + ".USB_READER_PERMISSION";
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                granted[0] = intent != null && intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                latch.countDown();
            }
        };
        try {
            IntentFilter filter = new IntentFilter(action);
            if (Build.VERSION.SDK_INT >= 33) {
                ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                ctx.registerReceiver(receiver, filter);
            }
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
            Intent intent = new Intent(action);
            intent.setPackage(ctx.getPackageName());
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 1, intent, flags);
            Runnable ask = () -> mgr.requestPermission(dev, pi);
            Activity activity = getActivity();
            if (activity != null) activity.runOnUiThread(ask);
            else ask.run();
            latch.await(8, TimeUnit.SECONDS);
        } catch (Exception e) {
            return false;
        } finally {
            try {
                ctx.unregisterReceiver(receiver);
            } catch (Exception ignored) {
                /* already unregistered */
            }
        }
        return granted[0];
    }

    private void watchUsb() {
        if (usbWatchRegistered || getContext() == null) return;
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !UsbManager.ACTION_USB_DEVICE_DETACHED.equals(intent.getAction())) return;
                if (!"usb".equals(heldLink) || !heldReady) return;
                UsbDevice dev = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (dev != null && !isCardReader(dev) && printerVendor(dev.getVendorId())) return;
                if (!usbReaderAttached()) markUsbUnplugged();
            }
        };
        IntentFilter filter = new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED);
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(receiver, filter);
            }
            usbWatchRegistered = true;
        } catch (Exception ignored) {
            /* the next sale still checks the cable */
        }
    }

    private void resolveMessage(PluginCall call, String message) {
        JSObject ret = new JSObject();
        ret.put("ok", false);
        ret.put("message", message);
        call.resolve(ret);
        if (MSG_BLUETOOTH.equals(message)) emit("error", message, null, null);
    }

    private void emit(String state, String message, String serial, Integer battery) {
        JSObject status = new JSObject();
        status.put("state", state);
        if (message != null) status.put("message", message);
        if (serial != null) status.put("serial", serial);
        if (battery != null) status.put("batteryPercent", battery);
        notifyListeners("status", status);
    }

    private void onWorker(Runnable work) {
        if (worker == null) {
            worker = new HandlerThread("summex-pax");
            worker.start();
            workerHandler = new Handler(worker.getLooper());
        }
        workerHandler.post(work);
    }

    static String serialOf(String name) {
        if (name == null) return null;
        String trimmed = name.trim();
        if (trimmed.startsWith(NAME_PREFIX)) {
            String serial = trimmed.substring(NAME_PREFIX.length()).replace(" ", "").trim();
            return serial.isEmpty() ? null : serial;
        }
        if (trimmed.startsWith(NAME_MARK)) {
            String rest = trimmed.substring(NAME_MARK.length());
            if (!rest.isEmpty()) {
                char lead = rest.charAt(0);
                if (Character.isWhitespace(lead) || lead == '_' || lead == '-' || lead == ':') {
                    String serial = rest.replaceFirst("^[\\s_\\-:]+", "").replace(" ", "").trim();
                    if (!serial.isEmpty()) return serial;
                }
            }
        }
        if (trimmed.regionMatches(true, 0, "D135", 0, 4)) {
            String rest = trimmed.substring(4);
            if (!rest.isEmpty()) {
                char lead = rest.charAt(0);
                if (Character.isWhitespace(lead) || lead == '_' || lead == '-' || lead == ':') {
                    String serial = rest.replaceFirst("^[\\s_\\-:]+", "").replace(" ", "").trim();
                    if (!serial.isEmpty()) return serial;
                }
            }
        }
        return null;
    }

    private static String last4(String masked) {
        if (masked == null) return null;
        String digits = masked.replaceAll("\\D", "");
        if (digits.length() < 4) return null;
        return digits.substring(digits.length() - 4);
    }

    private static String codeFor(String raw) {
        String text = raw == null ? "" : raw.toLowerCase();
        if (text.contains("declin")) return "declined";
        if (text.contains("cancel")) return "cancelled";
        if (text.contains("chip") || text.contains("emv") || text.contains("icc")) return "chip";
        if (text.contains("timeout") || text.contains("timed out")) return "timeout";
        if (text.contains("disconnect") || text.contains("bluetooth")) return "disconnect";
        return "error";
    }

    private static Integer batteryFrom(String message) {
        if (message == null || !message.toLowerCase().contains("battery")) return null;
        Matcher matcher = Pattern.compile("(\\d{1,3})\\s*%").matcher(message);
        if (!matcher.find()) return null;
        int value = Integer.parseInt(matcher.group(1));
        return value >= 0 && value <= 100 ? value : null;
    }

    private static Integer readBattery(Object target) {
        String[] names = { "getBatteryLevel", "getBattery", "batteryLevel", "getDeviceBattery" };
        for (String name : names) {
            try {
                Method method = target.getClass().getMethod(name);
                Object value = method.invoke(target);
                if (value instanceof Number) {
                    int percent = ((Number) value).intValue();
                    if (percent >= 0 && percent <= 100) return percent;
                }
            } catch (Exception ignored) {
                /* this SDK build has no battery method */
            }
        }
        return null;
    }
}
