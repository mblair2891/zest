/**
 * Android stations hand the reader to the Terminal SDK.
 * The WebView never sees a PAN. If the plugin is absent, the server still drives the reader.
 */
export async function handoffStripeReader(readerId: string): Promise<{ panTouched: false }> {
  const cap = (globalThis as { Capacitor?: { Plugins?: { StripeTerminal?: { processOnReader?: (o: { readerId: string }) => Promise<{ panTouched?: boolean }> } } } }).Capacitor;
  const plugin = cap?.Plugins?.StripeTerminal;
  if (plugin?.processOnReader) {
    const res = await plugin.processOnReader({ readerId });
    if (res?.panTouched) throw new Error("WebView must not collect card numbers");
  }
  return { panTouched: false };
}
