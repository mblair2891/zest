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
    static final String MSG_SETUP = "Setting up reader";
    static final String MSG_STILL_SETUP = "The reader is still setting up. No charge was sent.";
    static final String MSG_ALREADY = "This check is already paid. No second charge was sent.";
    static final String MSG_TIMEOUT = "The card read timed out. The check is not paid. Try again.";
    static final String MSG_UNREAD = "The card could not be read. The check stays open.";
    static final long SALE_TIMEOUT_MS = 90_000L;
    /** First connection downloads keys on the D135. Do not shorten this wait. */
    static final long CONNECT_TIMEOUT_MS = 4L * 60L * 1000L;
    static final int SCAN_MS = 6_000;

    private final Set<String> capturedChecks = new HashSet<>();
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile MPOSFinix mpos;
    private volatile boolean settingUp;
    private volatile boolean connected;
    private volatile Integer batteryPercent;
    private HandlerThread worker;
    private Handler workerHandler;

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
        if (serialOf(name) == null || address == null || address.isEmpty()) {
            resolveMessage(call, "Scan for the reader, then pick the registered PAX D135.");
            return;
        }
        settingUp = true;
        connected = false;
        emit("setting_up", MSG_SETUP, serialOf(name), null);
        onWorker(() -> connectOnWorker(call, name, address, merchantId, deviceId, userId, password));
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
        final MPOSFinix current = mpos;
        if (!connected || current == null || !current.isConnected()) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("code", "disconnect");
            ret.put("message", "The reader disconnected. The check is not paid. Try again.");
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
        String password
    ) {
        final AtomicBoolean settled = new AtomicBoolean(false);
        final Runnable timeout = () -> {
            if (!settled.compareAndSet(false, true)) return;
            settingUp = false;
            connected = false;
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("message", MSG_TIMEOUT);
            call.resolve(ret);
        };
        main.postDelayed(timeout, CONNECT_TIMEOUT_MS);
        try {
            MerchantData data = new MerchantData(
                merchantId == null ? "" : merchantId,
                "",
                deviceId == null ? "" : deviceId,
                Currency.USD,
                EnvEnum.SB,
                userId == null ? "" : userId,
                password == null ? "" : password
            );
            MPOSFinix next = MPOSFinix.Companion.invoke(getContext(), data);
            mpos = next;
            next.connect(name, address, new MPOSConnectionCallback() {
                @Override
                public void onProcessing(String message) {
                    settingUp = true;
                    Integer parsed = batteryFrom(message);
                    if (parsed != null) batteryPercent = parsed;
                    emit("setting_up", MSG_SETUP, serialOf(name), batteryPercent);
                }

                @Override
                public void onSuccess() {
                    if (!settled.compareAndSet(false, true)) return;
                    main.removeCallbacks(timeout);
                    settingUp = false;
                    connected = true;
                    Integer level = readBattery(next);
                    if (level != null) batteryPercent = level;
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    if (batteryPercent != null) ret.put("batteryPercent", batteryPercent);
                    call.resolve(ret);
                    emit("connected", "Connected", serialOf(name), batteryPercent);
                }

                @Override
                public void onError(String errorMessage) {
                    if (!settled.compareAndSet(false, true)) return;
                    main.removeCallbacks(timeout);
                    settingUp = false;
                    connected = false;
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    ret.put("message", errorMessage == null || errorMessage.isEmpty() ? connectFailureMessage() : errorMessage);
                    call.resolve(ret);
                    emit("error", ret.getString("message"), serialOf(name), null);
                }
            });
        } catch (Exception e) {
            if (!settled.compareAndSet(false, true)) return;
            main.removeCallbacks(timeout);
            settingUp = false;
            connected = false;
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("message", connectFailureMessage());
            call.resolve(ret);
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
            harvestBonded(adapter, devices, seen);
            try {
                getContext().unregisterReceiver(receiver);
            } catch (Exception ignored) {
                /* already unregistered */
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

    private String connectFailureMessage() {
        return bluetoothOn() ? "The reader disconnected. The check is not paid. Try again." : MSG_BLUETOOTH;
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
