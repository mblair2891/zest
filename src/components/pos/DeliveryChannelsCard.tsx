import { usePosStore } from "@/lib/pos/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  defaultDeliveryChannels,
  publishDeliveryMenu,
  type DeliveryChannel,
  type HouseItem,
} from "@/lib/delivery/marketplace";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

function channelsOf(raw: DeliveryChannel[] | undefined): DeliveryChannel[] {
  return raw?.length ? raw : defaultDeliveryChannels();
}

export function DeliveryChannelsCard({ write }: { write: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const menuItems = usePosStore((s) => s.menuItems);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const channels = channelsOf(settings.deliveryChannels);

  const save = (next: DeliveryChannel[]) => updateSettings({ deliveryChannels: next });
  const patch = (id: string, partial: Partial<DeliveryChannel>) =>
    save(channels.map((channel) => (channel.id === id ? { ...channel, ...partial } : channel)));

  const publish = () => {
    const menu: HouseItem[] = menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      priceCents: item.priceCents,
      available: item.available,
      alcohol: item.station === "bar" || item.taxCategory === "bev" || item.course === "drink",
      entityId: item.vendorId || "",
      station: item.station === "bar" ? "bar" : "kitchen",
      course: item.course,
    }));
    const published = channels.flatMap((channel) =>
      publishDeliveryMenu(menu, channel).map((row) => ({ ...row, channelId: channel.id })),
    );
    updateSettings({ deliveryPublished: menu, deliveryChannels: channels });
    return published.length;
  };

  return (
    <section className="mb-6 max-w-3xl rounded-2xl border border-border bg-surface p-4" data-delivery-channels>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Delivery channels</h2>
        <GuideLearnLink topicId="delivery-channels" />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Each channel is Marketplace or Courier-dispatch. DoorDash, Uber Eats, and Grubhub take a marketplace
        order. Empty keys leave the tablet webhook live. A down channel queues and does not stop the POS.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={settings.allowDeliveryAlcohol === true}
          disabled={!write}
          onChange={(event) => updateSettings({ allowDeliveryAlcohol: event.target.checked })}
        />
        Allow delivery alcohol when the channel item is mapped
      </label>
      <div className="space-y-3">
        {channels.map((channel) => (
          <div key={channel.id} className="rounded-xl border border-border p-3 text-sm" data-delivery-channel={channel.id}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="font-medium">{channel.label}</p>
              <select
                className="rounded-md border border-border bg-bg px-2 py-1 text-xs"
                value={channel.kind}
                disabled={!write}
                onChange={(event) => patch(channel.id, { kind: event.target.value as DeliveryChannel["kind"] })}
              >
                <option value="marketplace">Marketplace</option>
                <option value="courier_dispatch">Courier-dispatch</option>
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={channel.paused}
                  disabled={!write}
                  onChange={(event) => patch(channel.id, { paused: event.target.checked })}
                />
                Pause
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={channel.autoAccept}
                  disabled={!write}
                  onChange={(event) => patch(channel.id, { autoAccept: event.target.checked })}
                />
                Auto-accept
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={channel.smsOnReady}
                  disabled={!write}
                  onChange={(event) => patch(channel.id, { smsOnReady: event.target.checked })}
                />
                SMS when ready
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Commission %
                <Input
                  className="mt-1 h-8"
                  inputMode="decimal"
                  disabled={!write}
                  value={String(channel.commissionPct)}
                  onChange={(event) => patch(channel.id, { commissionPct: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Price override ({channel.priceMode === "flat" ? "cents" : "%"})
                <Input
                  className="mt-1 h-8"
                  inputMode="decimal"
                  disabled={!write}
                  value={String(channel.priceOverride)}
                  onChange={(event) => patch(channel.id, { priceOverride: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Sandbox key
                <Input
                  className="mt-1 h-8"
                  disabled={!write}
                  value={channel.sandboxKey}
                  onChange={(event) => patch(channel.id, { sandboxKey: event.target.value })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Live key
                <Input
                  className="mt-1 h-8"
                  disabled={!write}
                  value={channel.liveKey}
                  onChange={(event) => patch(channel.id, { liveKey: event.target.value })}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Opens
                <Input
                  className="mt-1 h-8"
                  disabled={!write}
                  value={channel.hours?.open ?? ""}
                  onChange={(event) =>
                    patch(channel.id, { hours: { open: event.target.value, close: channel.hours?.close ?? "22:00" } })
                  }
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Closes
                <Input
                  className="mt-1 h-8"
                  disabled={!write}
                  value={channel.hours?.close ?? ""}
                  onChange={(event) =>
                    patch(channel.id, { hours: { open: channel.hours?.open ?? "11:00", close: event.target.value } })
                  }
                />
              </label>
            </div>
            <div className="mt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!write}
                onClick={() => patch(channel.id, { priceMode: channel.priceMode === "flat" ? "percent" : "flat" })}
              >
                {channel.priceMode === "flat" ? "Flat cents" : "Percent"}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" className="mt-3" disabled={!write} onClick={publish}>
        Publish delivery menu
      </Button>
    </section>
  );
}
