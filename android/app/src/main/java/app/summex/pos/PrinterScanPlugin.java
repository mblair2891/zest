package app.summex.pos;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Staff Wi-Fi printer discovery. Port 9100 plus DNS-SD printer types.
 * The WebView cannot open those sockets. Results are not saved until the venue saves.
 */
@CapacitorPlugin(name = "PrinterScan")
public class PrinterScanPlugin extends Plugin {
    static final int PORT = 9100;
    static final String[] SERVICE_TYPES = {
        "_pdl-datastream._tcp",
        "_printer._tcp",
        "_ipp._tcp",
    };

    @PluginMethod
    public void scan(PluginCall call) {
        new Thread(() -> runScan(call), "summex-printer-scan").start();
    }

    private void runScan(PluginCall call) {
        AtomicBoolean settled = new AtomicBoolean(false);
        WifiManager.MulticastLock lock = null;
        try {
            Context ctx = getContext();
            if (ctx != null) {
                WifiManager wifi = (WifiManager) ctx.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
                if (wifi != null) {
                    lock = wifi.createMulticastLock("summex-printer-scan");
                    lock.setReferenceCounted(false);
                    lock.acquire();
                }
            }
            List<String> hosts = lanHosts();
            java.util.concurrent.ExecutorService adsPool = java.util.concurrent.Executors.newSingleThreadExecutor();
            java.util.concurrent.Future<List<JSONObject>> adsJob = adsPool.submit(this::discoverAdvertised);
            List<String> open = probe9100(hosts);
            List<JSONObject> advertised = new ArrayList<>();
            try {
                advertised = adsJob.get(8, TimeUnit.SECONDS);
            } catch (Exception ignored) {
                adsJob.cancel(true);
            } finally {
                adsPool.shutdownNow();
            }
            JSONArray printers = new JSONArray();
            for (String ip : open) {
                JSONObject row = new JSONObject();
                row.put("ip", ip);
                row.put("port", PORT);
                row.put("name", "");
                row.put("via", "9100");
                printers.put(row);
            }
            for (JSONObject row : advertised) printers.put(row);
            JSObject ret = new JSObject();
            ret.put("printers", printers);
            if (hosts.isEmpty() && advertised.isEmpty()) {
                ret.put("error", "This station is not on the staff Wi-Fi.");
            }
            if (settled.compareAndSet(false, true)) call.resolve(ret);
        } catch (Exception e) {
            if (settled.compareAndSet(false, true)) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Printer scan failed");
            }
        } finally {
            if (lock != null && lock.isHeld()) lock.release();
        }
    }

    /** Same /24 rule as ipv4HostsForScan. Wider masks stay on the station's /24. */
    static List<String> lanHosts() {
        List<String> hosts = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> nics = NetworkInterface.getNetworkInterfaces();
            if (nics == null) return hosts;
            while (nics.hasMoreElements()) {
                NetworkInterface nic = nics.nextElement();
                if (!nic.isUp() || nic.isLoopback()) continue;
                for (InterfaceAddress ia : nic.getInterfaceAddresses()) {
                    InetAddress addr = ia.getAddress();
                    if (!(addr instanceof Inet4Address)) continue;
                    String local = addr.getHostAddress();
                    if (local == null || !RawPrintPlugin.isPrintLanHost(local)) continue;
                    int prefix = ia.getNetworkPrefixLength();
                    if (prefix < 24) prefix = 24;
                    if (prefix > 30) prefix = 30;
                    String[] parts = local.split("\\.");
                    if (parts.length != 4) continue;
                    int ip = (Integer.parseInt(parts[0]) << 24)
                        | (Integer.parseInt(parts[1]) << 16)
                        | (Integer.parseInt(parts[2]) << 8)
                        | Integer.parseInt(parts[3]);
                    int hostBits = 32 - prefix;
                    int size = 1 << hostBits;
                    int mask = hostBits == 0 ? 0 : (int) (0xffffffffL << hostBits);
                    int network = ip & mask;
                    for (int i = 1; i < size - 1; i++) {
                        int host = network + i;
                        if (host == ip) continue;
                        String text = ((host >>> 24) & 255) + "."
                            + ((host >>> 16) & 255) + "."
                            + ((host >>> 8) & 255) + "."
                            + (host & 255);
                        if (RawPrintPlugin.isPrintLanHost(text)) hosts.add(text);
                    }
                }
            }
        } catch (Exception ignored) {
            /* empty list — scan reports that this station is not on the staff Wi-Fi */
        }
        if (hosts.size() > 512) return hosts.subList(0, 512);
        return hosts;
    }

    private static List<String> probe9100(List<String> hosts) throws InterruptedException {
        List<String> open = new ArrayList<>();
        if (hosts.isEmpty()) return open;
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(48, hosts.size()));
        List<java.util.concurrent.Future<String>> jobs = new ArrayList<>();
        for (String host : hosts) {
            jobs.add(pool.submit(() -> {
                try (Socket sock = new Socket()) {
                    sock.connect(new InetSocketAddress(host, PORT), 450);
                    return host;
                } catch (Exception e) {
                    return null;
                }
            }));
        }
        pool.shutdown();
        for (java.util.concurrent.Future<String> job : jobs) {
            try {
                String host = job.get(4, TimeUnit.SECONDS);
                if (host != null) open.add(host);
            } catch (Exception ignored) {
                job.cancel(true);
            }
        }
        pool.awaitTermination(1, TimeUnit.SECONDS);
        return open;
    }

    private List<JSONObject> discoverAdvertised() {
        List<JSONObject> rows = new ArrayList<>();
        if (getActivity() == null || getContext() == null) return rows;
        NsdManager nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
        if (nsd == null) return rows;
        List<NsdServiceInfo> found = new ArrayList<>();
        for (String type : SERVICE_TYPES) {
            discoverType(nsd, type, found);
        }
        for (NsdServiceInfo info : found) {
            JSONObject row = resolveOne(nsd, info);
            if (row != null) rows.add(row);
        }
        return rows;
    }

    private void discoverType(NsdManager nsd, String type, List<NsdServiceInfo> found) {
        CountDownLatch started = new CountDownLatch(1);
        NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String serviceType) { started.countDown(); }
            @Override public void onDiscoveryStopped(String serviceType) {}
            @Override public void onStartDiscoveryFailed(String serviceType, int errorCode) { started.countDown(); }
            @Override public void onStopDiscoveryFailed(String serviceType, int errorCode) {}
            @Override public void onServiceFound(NsdServiceInfo serviceInfo) {
                synchronized (found) { found.add(serviceInfo); }
            }
            @Override public void onServiceLost(NsdServiceInfo serviceInfo) {}
        };
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    nsd.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, listener);
                } catch (Exception e) {
                    started.countDown();
                }
            });
            started.await(700, TimeUnit.MILLISECONDS);
            Thread.sleep(900);
        } catch (Exception ignored) {
            /* this service type is skipped */
        } finally {
            CountDownLatch stopped = new CountDownLatch(1);
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    try { nsd.stopServiceDiscovery(listener); } catch (Exception ignored) {}
                    stopped.countDown();
                });
            } else {
                stopped.countDown();
            }
            try { stopped.await(500, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) {}
        }
    }

    private JSONObject resolveOne(NsdManager nsd, NsdServiceInfo info) {
        CountDownLatch done = new CountDownLatch(1);
        JSONObject[] box = new JSONObject[1];
        NsdManager.ResolveListener listener = new NsdManager.ResolveListener() {
            @Override public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) { done.countDown(); }
            @Override public void onServiceResolved(NsdServiceInfo serviceInfo) {
                try {
                    InetAddress host = serviceInfo.getHost();
                    String ip = host != null ? host.getHostAddress() : "";
                    if (ip != null && RawPrintPlugin.isPrintLanHost(ip)) {
                        JSONObject row = new JSONObject();
                        row.put("ip", ip);
                        int port = serviceInfo.getPort();
                        row.put("port", port > 0 ? port : PORT);
                        String name = serviceInfo.getServiceName() != null ? serviceInfo.getServiceName() : "";
                        row.put("name", name);
                        row.put("via", "advertised");
                        box[0] = row;
                    }
                } catch (Exception ignored) {
                    /* unnamed row is dropped */
                }
                done.countDown();
            }
        };
        try {
            if (getActivity() == null) return null;
            getActivity().runOnUiThread(() -> {
                try { nsd.resolveService(info, listener); }
                catch (Exception e) { done.countDown(); }
            });
            done.await(800, TimeUnit.MILLISECONDS);
        } catch (Exception ignored) {
            return null;
        }
        return box[0];
    }
}
