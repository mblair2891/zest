package app.summex.pos;

import android.app.ActivityManager;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import java.net.URL;
import java.util.Collections;

/**
 * Staff station kiosk: remote Summex POS in a WebView, lock-task (or pin),
 * immersive bars, no launcher escape while primed. Guest QR stays in the browser.
 */
public class MainActivity extends BridgeActivity {
    static final String CAP_SHIM =
        "(function(){try{var c=window.Capacitor;if(c&&typeof c.triggerEvent==='function')return;" +
        "c=c||{};c.triggerEvent=c.triggerEvent||function(){};" +
        "c.isNativePlatform=c.isNativePlatform||function(){return true};" +
        "c.getPlatform=c.getPlatform||function(){return 'android'};" +
        "c.Plugins=c.Plugins||{};window.Capacitor=c;}catch(e){}})();";

    private boolean lockPrimed = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow()
            .addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        hideSystemBars();
        installBridgeGuard();
        installBackGuard();
        startKioskLock();
    }

    @Override
    public void onStart() {
        super.onStart();
        hideSystemBars();
        wrapWebView();
        startKioskLock();
    }

    @Override
    public void onResume() {
        injectCapacitorShim();
        super.onResume();
        hideSystemBars();
        startKioskLock();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
            startKioskLock();
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (!isLockActive()) return;
        android.content.Intent i = new android.content.Intent(this, MainActivity.class);
        i.addFlags(android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            goBackInWebView();
            return true;
        }
        if (
            isLockActive()
                && (keyCode == KeyEvent.KEYCODE_HOME
                    || keyCode == KeyEvent.KEYCODE_APP_SWITCH
                    || keyCode == KeyEvent.KEYCODE_MENU
                    || keyCode == KeyEvent.KEYCODE_SYSRQ)
        ) {
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private void installBackGuard() {
        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        goBackInWebView();
                    }
                }
            );
    }

    private void goBackInWebView() {
        WebView wv = webView();
        if (wv != null && wv.canGoBack()) {
            wv.goBack();
        }
    }

    private void wrapWebView() {
        WebView wv = webView();
        if (wv == null || getBridge() == null) return;
        wv.setBackgroundColor(0xFF0A0C0B);
        wv.setWebViewClient(new KioskWebViewClient(getBridge()));
    }

    private void installBridgeGuard() {
        WebView wv = webView();
        if (wv == null) return;
        wv.setBackgroundColor(0xFF0A0C0B);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                WebViewCompat.addDocumentStartJavaScript(
                    wv,
                    CAP_SHIM,
                    Collections.singleton(injectionOrigin())
                );
            } catch (IllegalArgumentException ignored) {
                /* origin must be scheme://host — fallback is onPageStarted shim */
            }
        }
    }

    private void injectCapacitorShim() {
        WebView wv = webView();
        if (wv == null) return;
        wv.evaluateJavascript(CAP_SHIM, null);
    }

    private String injectionOrigin() {
        try {
            String raw = getBridge() != null ? getBridge().getServerUrl() : null;
            if (raw == null || raw.isEmpty()) return "https://summex.app";
            URL u = new URL(raw);
            return u.getProtocol() + "://" + u.getAuthority();
        } catch (Exception e) {
            return "https://summex.app";
        }
    }

    private WebView webView() {
        return getBridge() != null ? getBridge().getWebView() : null;
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            View decor = getWindow().getDecorView();
            decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }
    }

    private void startKioskLock() {
        if (isLockActive()) {
            lockPrimed = true;
            return;
        }
        try {
            startLockTask();
        } catch (IllegalArgumentException | SecurityException e) {
            /* Training: Samsung pin-windows. Production: Device Owner / Knox whitelist. */
        }
        lockPrimed = isLockActive();
    }

    private boolean isLockActive() {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
        }
        return am.isInLockTaskMode();
    }
}
