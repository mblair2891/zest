package app.summex.pos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lock-task exit and station reload. Staff PINs are checked in the WebView first. */
@CapacitorPlugin(name = "StationKiosk")
public class StationKioskPlugin extends Plugin {
    @PluginMethod
    public void exit(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            boolean unpinned = ((MainActivity) getActivity()).exitKioskLock();
            JSObject ret = new JSObject();
            ret.put("unpinned", unpinned);
            call.resolve(ret);
            return;
        }
        call.reject("Station shell is not running");
    }

    @PluginMethod
    public void reload(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).reloadStationWebView();
            call.resolve();
            return;
        }
        call.reject("Station shell is not running");
    }
}
