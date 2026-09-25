package app.summex.pos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Card-present handoff. The WebView never receives a PAN.
 * The server drives the Stripe Terminal reader. This plugin only confirms the station
 * is native and rejects any attempt to pass a card number.
 */
@CapacitorPlugin(name = "StripeTerminal")
public class StripeTerminalPlugin extends Plugin {
    @PluginMethod
    public void processOnReader(PluginCall call) {
        if (call.getString("pan") != null || call.getString("cardNumber") != null) {
            call.reject("WebView must not collect card numbers");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("reader", true);
        ret.put("panTouched", false);
        call.resolve(ret);
    }
}
