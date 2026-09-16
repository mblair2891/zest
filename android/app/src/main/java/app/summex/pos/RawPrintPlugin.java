package app.summex.pos;

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
