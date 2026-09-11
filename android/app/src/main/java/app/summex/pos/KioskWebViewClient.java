package app.summex.pos;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Keep staff POS on the console host inside the WebView. Guest QR / pay
 * (table tents, ticket codes, venue sites) opens in the phone browser.
 * Inject a Capacitor.triggerEvent shim so a remote server.url does not
 * black-screen when the bridge injects late.
 */
public class KioskWebViewClient extends BridgeWebViewClient {
    public KioskWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (isGuestUrl(url)) {
            openInBrowser(view, url);
            return true;
        }
        if (isStaffHost(url.getHost())) {
            return false;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }

    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        super.onPageStarted(view, url, favicon);
        view.evaluateJavascript(MainActivity.CAP_SHIM, null);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        view.evaluateJavascript(MainActivity.CAP_SHIM, null);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        if (request == null || !request.isForMainFrame() || view == null) return;
        String msg = error != null && error.getDescription() != null
            ? error.getDescription().toString()
            : "offline";
        view.loadDataWithBaseURL(
            "https://app.summex.app/",
            errorHtml(msg),
            "text/html",
            "utf-8",
            null
        );
    }

    private static void openInBrowser(WebView view, Uri url) {
        if (view == null || url == null) return;
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, url);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            view.getContext().startActivity(i);
        } catch (Exception ignored) {
            /* lock-task may block the browser; guest QR is for guest phones */
        }
    }

    /** Guest table / pay / venue sites — never the station WebView. */
    static boolean isGuestUrl(Uri url) {
        if (url == null) return false;
        String host = url.getHost() == null ? "" : url.getHost().toLowerCase();
        String path = url.getPath() == null ? "/" : url.getPath();
        if (host.equals("sites.summex.app") || host.startsWith("sites.")) return true;
        if (host.equals("www.summex.app") || host.equals("summex.app")) {
            return !(path.equals("/station") || path.startsWith("/station/"));
        }
        if (path.startsWith("/table/")
            || path.startsWith("/t/")
            || path.startsWith("/order/")
            || path.startsWith("/online")
            || path.startsWith("/reserve")
            || path.startsWith("/v/")) {
            return true;
        }
        if (host.endsWith(".summex.app")
            && !host.equals("app.summex.app")
            && !host.equals("api.summex.app")
            && !host.equals("sites.summex.app")) {
            return true;
        }
        return false;
    }

    static boolean isStaffHost(String host) {
        if (host == null) return false;
        String h = host.toLowerCase();
        if (h.equals("app.summex.app")) return true;
        if (h.equals("localhost") || h.endsWith(".local")) return true;
        if (h.equals("10.0.2.2")) return true;
        if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
        if (h.matches("^172\\.(1[6-9]|2[0-9]|3[0-1])\\..*")) return true;
        return false;
    }

    private static String errorHtml(String detail) {
        return "<!doctype html><html><head><meta charset=utf-8>"
            + "<meta name=viewport content=\"width=device-width,initial-scale=1\">"
            + "<style>html,body{height:100%;margin:0;background:#0a0c0b;color:#f7f6f3;"
            + "font-family:system-ui,sans-serif;display:grid;place-items:center;text-align:center;padding:1.5rem}"
            + "p{opacity:.8;max-width:22rem;line-height:1.45}</style></head><body>"
            + "<div><p style=\"letter-spacing:.28em;font-weight:600\">SUMMEX STATION</p>"
            + "<p>This station could not reach Summex. Check the staff Wi‑Fi, then power the tablet again.</p>"
            + "<p style=\"font-size:.8rem;opacity:.55\">"
            + detail.replace("<", "&lt;").replace(">", "&gt;")
            + "</p></div></body></html>";
    }
}
