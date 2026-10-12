package app.summex.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
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
import com.finix.mpos.sdk.MPOSConnectionCallback;
import com.finix.mpos.sdk.MPOSFinix;
import com.finix.mpos.sdk.MPOSTransactionCallback;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import androidx.core.content.ContextCompat;
import java.lang.reflect.Method;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
    static final String MSG_DISCONNECT = "The reader disconnected. The check is not paid. Try again.";
    static final String MSG_NOT_CONNECTED = "Scan for the reader, then pick the registered PAX D135.";
    static final String MSG_STILL_SETUP = "The reader is still setting up. No charge was sent.";
    static final String MSG_ALREADY = "This check is already paid. No second charge was sent.";
    static final String MSG_TIMEOUT = "The card read timed out. The check is not paid. Try again.";
    static final String MSG_UNREAD = "The card could not be read. The check stays open.";
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
    private static volatile boolean heldReady;
    private static volatile boolean heldSettingUp;
    private static volatile String heldName = "";
    private static volatile String heldAddress = "";
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
        if (!bluetoothOn()) {
            resolveMessage(call, MSG_BLUETOOTH);
            return;
        }
        if (!hasScanPermissions()) {
            requestPermissionForAliases(scanAliases(), call, "connectPerms");
            return;
        }
        final String name = call.getString("name", "");
        final String address = call.getString("address", "");
        final String merchantId = call.getString("merchantId", "");
        final String deviceId = call.getString("deviceId", "");
        final String userId = call.getString("userId", "");
        final String password = call.getString("password", "");
        final String missing = missingMerchantField(merchantId, deviceId, userId, password);
        if (!missing.isEmpty()) {
            Log.i("PaxD135", merchantDataPreview(merchantId, deviceId, userId));
            Log.i("PaxD135", missing);
            resolveMessage(call, missing);
            return;
        }
        if (serialOf(name) == null || address == null || address.isEmpty()) {
            resolveMessage(call, "Connection failed: missing Bluetooth address.");
            return;
        }
        final String diagnostic = finixConnectDiagnostic(merchantId, deviceId, userId, password);
        Log.i("PaxD135", merchantDataPreview(merchantId, deviceId, userId));
        Log.i("PaxD135", diagnostic);
        restoreHeld();
        if (reuseHeld(name, address)) {
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
        main.post(() -> connectOnWorker(call, name, address, merchantId, deviceId, userId, password, diagnostic));
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
        onWorker(() -> saleOnWorker(call, current, checkId, amount));
    }

    private void connectOnWorker(
        PluginCall call,
        String name,
        String address,
        String merchantId,
        String deviceId,
        String userId,
        String password,
        String diagnostic
    ) {
        final AtomicBoolean settled = new AtomicBoolean(false);
        final AtomicBoolean heard = new AtomicBoolean(false);
        final String passedMerchant = merchantId == null ? "" : merchantId.trim();
        final String passedDevice = deviceId == null ? "" : deviceId.trim();
        final String passedUser = userId == null ? "" : userId;
        final String passedPassword = password == null ? "" : password;
        final String prefix = usernamePrefix(passedUser);
        final String merchantTrace = merchantDataTrace(passedMerchant, passedDevice, prefix);
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
        main.postDelayed(timeout, FIRST_RESPONSE_MS);
        try {
            // Kotlin MPOSFinix(context, MerchantData) is Companion.invoke from Java.
            // mid is empty. merchant, device, and ROLE_MERCHANT login come from the station call.
            // EnvEnum.SB when that call sends SB (FINIX_ENVIRONMENT=sandbox).
            MerchantData data = new MerchantData(
                passedMerchant,
                "",
                passedDevice,
                Currency.USD,
                EnvEnum.SB,
                passedUser,
                passedPassword
            );
            final MPOSFinix next = MPOSFinix.Companion.invoke(getContext(), data);
            mpos = next;
            final String deviceName = name;
            final String deviceAddress = address;
            next.connect(deviceName, deviceAddress, new MPOSConnectionCallback() {
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
                    emit("setting_up", keyDownloadProgress(message), serialOf(name), batteryPercent);
                }

                @Override
                public void onSuccess() {
                    if (!settled.compareAndSet(false, true)) return;
                    main.removeCallbacks(timeout);
                    settingUp = false;
                    heldSettingUp = false;
                    connected = true;
                    heldReady = true;
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
            });
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

    private void saleOnWorker(PluginCall call, MPOSFinix current, String checkId, int amount) {
        final AtomicBoolean settled = new AtomicBoolean(false);
        final Runnable timeout = () -> {
            if (!settled.compareAndSet(false, true)) return;
            try {
                current.cancelTransaction();
            } catch (Exception ignored) {
                /* the read already failed */
            }
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("code", "timeout");
            ret.put("message", MSG_TIMEOUT);
            call.resolve(ret);
        };
        main.postDelayed(timeout, SALE_TIMEOUT_MS);
        try {
            current.startTransaction(
                amount,
                TransactionType.SALE,
                new MPOSTransactionCallback() {
                    @Override
                    public void onProcessing(String message) {
                        /* card is on the reader; the check is not paid yet */
                    }

                    @Override
                    public void onSuccess(TransactionResult result) {
                        if (!settled.compareAndSet(false, true)) return;
                        main.removeCallbacks(timeout);
                        finishSale(call, checkId, result);
                    }

                    @Override
                    public void onError(String errorMessage) {
                        if (!settled.compareAndSet(false, true)) return;
                        main.removeCallbacks(timeout);
                        String code = codeFor(errorMessage);
                        JSObject ret = new JSObject();
                        ret.put("ok", false);
                        ret.put("code", code);
                        ret.put("message", errorMessage == null ? MSG_UNREAD : errorMessage);
                        call.resolve(ret);
                    }
                },
                null,
                null,
                checkId,
                null,
                null,
                PromptForSignature.Never.INSTANCE
            );
        } catch (Exception e) {
            if (!settled.compareAndSet(false, true)) return;
            main.removeCallbacks(timeout);
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("code", "error");
            ret.put("message", MSG_UNREAD);
            call.resolve(ret);
        }
    }

    private void finishSale(PluginCall call, String checkId, TransactionResult result) {
        String id = result == null || result.getId() == null ? "" : result.getId().trim();
        String failure = result == null || result.getFailureCode() == null ? "" : result.getFailureCode().trim();
        String state = result == null || result.getState() == null ? "" : result.getState();
        JSObject ret = new JSObject();
        if (id.isEmpty() || !failure.isEmpty() || state.toUpperCase().contains("FAIL")) {
            ret.put("ok", false);
            ret.put("code", codeFor(failure + " " + state + " " + (result == null ? "" : result.getFailureMessage())));
            ret.put("message", result != null && result.getFailureMessage() != null ? result.getFailureMessage() : MSG_UNREAD);
            call.resolve(ret);
            return;
        }
        synchronized (capturedChecks) {
            capturedChecks.add(checkId);
        }
        ret.put("ok", true);
        ret.put("transferId", id);
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
     * Required MerchantData fields. mid stays empty and is not required.
     * The password value is not written.
     */
    private static String missingMerchantField(String merchantId, String deviceId, String userId, String password) {
        if (merchantId == null || merchantId.trim().isEmpty()) return "missing merchantId";
        if (userId == null || userId.trim().isEmpty()) return "missing userId";
        if (password == null || password.trim().isEmpty()) return "missing password";
        if (deviceId == null || deviceId.trim().isEmpty()) return "missing deviceId";
        return "";
    }

    /** First eight characters of the username. The rest is not written. */
    private static String userIdPreview(String userId) {
        if (userId == null) return "";
        String trimmed = userId.trim();
        if (trimmed.isEmpty()) return "";
        return trimmed.length() <= 8 ? trimmed : trimmed.substring(0, 8);
    }

    /** MerchantData values before connect. The password is not part of this line. */
    private static String merchantDataPreview(String merchantId, String deviceId, String userId) {
        String merchant = merchantId == null || merchantId.trim().isEmpty() ? "missing" : merchantId.trim();
        String device = deviceId == null || deviceId.trim().isEmpty() ? "missing" : deviceId.trim();
        String preview = userIdPreview(userId);
        String user = preview.isEmpty() ? "missing" : preview;
        return "MerchantData merchantId " + merchant
            + ". deviceId " + device
            + ". userId " + user
            + ". env SB. mid \"\".";
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
    private static String merchantDataTrace(String merchantId, String deviceId, String prefix) {
        String merchant = merchantId == null || merchantId.isEmpty() ? "missing" : merchantId;
        String device = deviceId == null || deviceId.isEmpty() ? "missing" : deviceId;
        String user = prefix == null || prefix.isEmpty() ? "missing" : prefix;
        return "MerchantData merchantId " + merchant
            + ". deviceId " + device
            + ". username prefix " + user
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
