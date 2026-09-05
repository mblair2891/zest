package app.summex.pos;

import android.graphics.Bitmap;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Keep staff POS on Summex hosts inside the WebView. Inject a Capacitor.triggerEvent
 * shim so a remote server.url does not black-screen when the bridge injects late.
 */
public class KioskWebViewClient extends BridgeWebViewClient {
    public KioskWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
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
            "https://summex.app/",
            errorHtml(msg),
            "text/html",
            "utf-8",
            null
        );
    }

    private static boolean isStaffHost(String host) {
        if (host == null) return false;
        String h = host.toLowerCase();
        return h.equals("summex.app") || h.endsWith(".summex.app") || h.equals("localhost") || h.endsWith(".local");
    }

    private static String errorHtml(String detail) {
        return "<!doctype html><html><head><meta charset=utf-8>"
            + "<meta name=viewport content=\"width=device-width,initial-scale=1\">"
            + "<style>html,body{height:100%;margin:0;background:#0a0c0b;color:#f7f6f3;"
            + "font-family:system-ui,sans-serif;display:grid;place-items:center;text-align:center;padding:1.5rem}"
            + "p{opacity:.8;max-width:22rem;line-height:1.45}</style></head><body>"
            + "<div><p style=\"letter-spacing:.28em;font-weight:600\">SUMMEX</p>"
            + "<p>This station could not reach Summex. Check the staff Wi‑Fi, then power the tablet again.</p>"
            + "<p style=\"font-size:.8rem;opacity:.55\">"
            + detail.replace("<", "&lt;").replace(">", "&gt;")
            + "</p></div></body></html>";
    }
}
