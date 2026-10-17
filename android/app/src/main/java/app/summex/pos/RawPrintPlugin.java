package app.summex.pos;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Raw ESC/POS / Star Line to RFC1918:9100. WebView is HTTPS and cannot TCP 9100.
 * Success only if the socket write completes.
 */
@CapacitorPlugin(name = "RawPrint")
public class RawPrintPlugin extends Plugin {
    static final int DEFAULT_PORT = 9100;
    static final int TIMEOUT_MS = 4000;

    @PluginMethod
    public void sendBytes(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);
        String payload = call.getString("payload", "");
        if (host == null || host.trim().isEmpty()) {
            call.reject("Printer host is required");
            return;
        }
        if (payload == null || payload.isEmpty()) {
            call.reject("Print payload is empty");
            return;
        }
        if (port <= 0 || port >= 65536) port = DEFAULT_PORT;
        final String h = host.trim();
        final int p = port;
        final String b64 = payload;
        new Thread(() -> {
            try {
                if (!isPrintLanHost(h)) {
                    call.reject("Print plugin only reaches house LAN (10/8 or 192.168/16)");
                    return;
                }
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                if (bytes.length == 0) {
                    call.reject("Print payload is empty");
                    return;
                }
                try (Socket sock = new Socket()) {
                    sock.connect(new InetSocketAddress(h, p), TIMEOUT_MS);
                    sock.setSoTimeout(TIMEOUT_MS);
                    OutputStream out = sock.getOutputStream();
                    out.write(bytes);
                    out.flush();
                }
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("bytes", bytes.length);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Print failed");
            }
        }, "summex-raw-print")
            .start();
    }

    /** Same ESC/POS bytes, written to the USB printer plugged into this station. */
    @PluginMethod
    public void usbStatus(PluginCall call) {
        UsbManager mgr = usbManager();
        JSObject ret = new JSObject();
        if (mgr == null) {
            ret.put("connected", false);
            ret.put("present", false);
            call.resolve(ret);
            return;
        }
        UsbDevice dev = findPrinter(mgr);
        boolean present = dev != null;
        ret.put("present", present);
        ret.put("connected", present && mgr.hasPermission(dev));
        call.resolve(ret);
    }

    @PluginMethod
    public void sendUsb(PluginCall call) {
        String payload = call.getString("payload", "");
        if (payload == null || payload.isEmpty()) {
            call.reject("Print payload is empty");
            return;
        }
        final String b64 = payload;
        new Thread(() -> {
            UsbManager mgr = usbManager();
            if (mgr == null) {
                call.reject("USB printer not connected");
                return;
            }
            UsbDevice dev = findPrinter(mgr);
            if (dev == null) {
                call.reject("USB printer not connected");
                return;
            }
            if (!mgr.hasPermission(dev) && !requestUsbPermission(mgr, dev)) {
                call.reject("USB printer not connected");
                return;
            }
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                if (bytes.length == 0) {
                    call.reject("Print payload is empty");
                    return;
                }
                int written = writeUsb(mgr, dev, bytes);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("connected", true);
                ret.put("bytes", written);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "USB printer not connected");
            }
        }, "summex-usb-print").start();
    }

    /** TCP connect and close. Writes nothing. Same LAN host check as sendBytes. */
    @PluginMethod
    public void probe(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", DEFAULT_PORT);
        if (host == null || host.trim().isEmpty()) {
            call.reject("Printer host is required");
            return;
        }
        if (port <= 0 || port >= 65536) port = DEFAULT_PORT;
        final String h = host.trim();
        final int p = port;
        new Thread(() -> {
            try {
                if (!isPrintLanHost(h)) {
                    call.reject("Print plugin only reaches house LAN (10/8 or 192.168/16)");
                    return;
                }
                try (Socket sock = new Socket()) {
                    sock.connect(new InetSocketAddress(h, p), 2000);
                }
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Printer not responding");
            }
        }, "summex-raw-probe")
            .start();
    }

    private UsbManager usbManager() {
        Context ctx = getContext();
        if (ctx == null) return null;
        Object service = ctx.getSystemService(Context.USB_SERVICE);
        return service instanceof UsbManager ? (UsbManager) service : null;
    }

    static boolean looksLikePrinter(UsbDevice dev) {
        if (dev == null) return false;
        int vid = dev.getVendorId();
        if (vid == 0x04b8 || vid == 0x0519 || vid == 0x1504 || vid == 0x1d90 || vid == 0x0fe6) {
            return printerInterface(dev) != null;
        }
        for (int i = 0; i < dev.getInterfaceCount(); i++) {
            if (dev.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) return true;
        }
        return false;
    }

    static UsbDevice findPrinter(UsbManager mgr) {
        UsbDevice only = null;
        int bulkDevices = 0;
        for (UsbDevice dev : mgr.getDeviceList().values()) {
            if (dev == null || dev.getDeviceClass() == UsbConstants.USB_CLASS_HUB) continue;
            if (looksLikePrinter(dev)) return dev;
            if (printerInterface(dev) != null) {
                only = dev;
                bulkDevices += 1;
            }
        }
        return bulkDevices == 1 ? only : null;
    }

    static UsbInterface printerInterface(UsbDevice dev) {
        UsbInterface fallback = null;
        for (int i = 0; i < dev.getInterfaceCount(); i++) {
            UsbInterface iface = dev.getInterface(i);
            UsbEndpoint out = bulkOut(iface);
            if (out == null) continue;
            if (iface.getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) return iface;
            if (fallback == null) fallback = iface;
        }
        return fallback;
    }

    static UsbEndpoint bulkOut(UsbInterface iface) {
        for (int i = 0; i < iface.getEndpointCount(); i++) {
            UsbEndpoint ep = iface.getEndpoint(i);
            if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK
                && ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                return ep;
            }
        }
        return null;
    }

    private boolean requestUsbPermission(UsbManager mgr, UsbDevice dev) {
        Context ctx = getContext();
        if (ctx == null) return false;
        if (mgr.hasPermission(dev)) return true;
        CountDownLatch latch = new CountDownLatch(1);
        boolean[] granted = new boolean[] { false };
        String action = ctx.getPackageName() + ".USB_PRINTER_PERMISSION";
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                granted[0] = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
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
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 0, intent, flags);
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
        return granted[0] && mgr.hasPermission(dev);
    }

    private int writeUsb(UsbManager mgr, UsbDevice dev, byte[] bytes) throws Exception {
        UsbInterface iface = printerInterface(dev);
        if (iface == null) throw new Exception("USB printer not connected");
        UsbEndpoint out = bulkOut(iface);
        if (out == null) throw new Exception("USB printer not connected");
        UsbDeviceConnection conn = mgr.openDevice(dev);
        if (conn == null) throw new Exception("USB printer not connected");
        try {
            if (!conn.claimInterface(iface, true)) throw new Exception("USB printer not connected");
            int offset = 0;
            while (offset < bytes.length) {
                int len = Math.min(16 * 1024, bytes.length - offset);
                byte[] chunk = new byte[len];
                System.arraycopy(bytes, offset, chunk, 0, len);
                int sent = conn.bulkTransfer(out, chunk, len, TIMEOUT_MS);
                if (sent <= 0) throw new Exception("USB printer not connected");
                offset += sent;
            }
            return bytes.length;
        } finally {
            try {
                conn.releaseInterface(iface);
            } catch (Exception ignored) {
                /* close anyway */
            }
            conn.close();
        }
    }

    static boolean isPrintLanHost(String host) {
        try {
            InetAddress addr = InetAddress.getByName(host);
            byte[] b = addr.getAddress();
            if (b == null || b.length != 4) return false;
            int a = b[0] & 0xff;
            int c = b[1] & 0xff;
            if (a == 10) return true;
            if (a == 192 && c == 168) return true;
            return false;
        } catch (Exception e) {
            return false;
        }
    }
}
