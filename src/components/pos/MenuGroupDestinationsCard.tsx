import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { persistLocationCatalog, persistVenueRouting } from "@/lib/pos/persist-location-setup";
import { isActiveOrderPrinter } from "@/lib/pos/fire-routing";
import {
  destinationForGroup,
  mergeOrderDestinations,
} from "@/lib/pos/order-destinations";
import { usePosStore } from "@/lib/pos/store";

export function MenuGroupDestinationsCard({ write }: { write: boolean }) {
  const categories = usePosStore((s) => s.categories);
  const devices = usePosStore((s) => s.locationDevices ?? []);
  const settings = usePosStore((s) => s.settings);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const updateCategory = usePosStore((s) => s.updateCategory);

  const orderPrinters = devices.filter(isActiveOrderPrinter);
  const destinations = mergeOrderDestinations(
    orderPrinters.map((d) => d.print?.destinationName ?? ""),
    categories.map((c) => c.destinationName ?? ""),
  );

  const saveGroup = (
    id: string,
    patch: { destinationName?: string; printerId?: string },
  ) => {
    updateCategory(id, patch);
    persistLocationCatalog("menu");
  };

  return (
    <div className="mt-4 space-y-3" data-demo="menu-group-destinations">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Order destinations</p>
        <GuideLearnLink topicId="kitchen-bar-routing" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-xs text-muted-foreground">
        Each menu group fires to a production line and, optionally, a named order
        printer. Groups that share destination and printer print as one slip.
        Receipt printers never get kitchen fire.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          checked={Boolean(settings.separateCourseTickets)}
          disabled={!write}
          onChange={(e) => {
            updateSettings({ separateCourseTickets: e.target.checked });
            persistVenueRouting();
          }}
        />
        <span>
          Separate course tickets
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Off (default, single-line): plate + sandwich + side + dessert on one
            Kitchen printer is one ticket. On: cut per course even when they share
            the printer.
          </span>
        </span>
      </label>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Group</th>
              <th className="px-3 py-2 font-medium">Destination</th>
              <th className="px-3 py-2 font-medium">Order printer</th>
            </tr>
          </thead>
          <tbody>
            {categories
              .slice()
              .sort((a, b) => a.sort - b.sort)
              .map((cat) => {
                const dest = destinationForGroup(cat);
                return (
                  <tr key={cat.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: cat.color }}
                        />
                        {cat.name}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
                        value={dest}
                        disabled={!write}
                        onChange={(e) => saveGroup(cat.id, { destinationName: e.target.value })}
                      >
                        {destinations.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
                        value={cat.printerId ?? ""}
                        disabled={!write}
                        onChange={(e) => saveGroup(cat.id, { printerId: e.target.value })}
                      >
                        <option value="">Default for {dest}</option>
                        {orderPrinters.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                            {p.print?.destinationName ? ` · ${p.print.destinationName}` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {categories.length === 0 && (
        <p className="text-xs text-muted-foreground">Add menu groups first — then map each to a line.</p>
      )}
    </div>
  );
}
