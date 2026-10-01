import { usePosStore } from "@/lib/pos/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeDeliveryChannels,
  publishDeliveryMenu,
  waitingForPartnerKeys,
  WAITING_FOR_PARTNER_KEYS,
  type DeliveryChannel,
  type HouseItem,
} from "@/lib/delivery/marketplace";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

function channelsOf(raw: DeliveryChannel[] | undefined): DeliveryChannel[] {
  return normalizeDeliveryChannels(raw);
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
    const published = channels
      .filter((channel) => channel.vendor !== "webhook")
      .flatMap((channel) => publishDeliveryMenu(menu, channel).map((row) => ({ ...row, channelId: channel.id })));
    updateSettings({ deliveryPublished: menu, deliveryChannels: channels });
    return published.length;
  };

  return (
    <section className="mb-6 max-w-3xl rounded-2xl border border-border bg-surface p-4" data-delivery-channels>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Delivery</h2>
        <GuideLearnLink topicId="delivery-channels" />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        DoorDash Marketplace and Uber Eats. Commission is display only. Publish the delivery menu when the
        markup is ready. Empty partner keys leave the signed webhook live.
      </p>
      {waitingForPartnerKeys(channels) ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950" data-delivery-keys-banner>
          {WAITING_FOR_PARTNER_KEYS}
        </p>
      ) : null}
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
              {channel.vendor !== "webhook" ? (
                <select
                  className="rounded-md border border-border bg-bg px-2 py-1 text-xs"
                  value={channel.mode}
                  disabled={!write}
                  aria-label={`${channel.label} mode`}
                  onChange={(event) => patch(channel.id, { mode: event.target.value === "live" ? "live" : "sandbox" })}
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              ) : null}
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
                  checked={channel.paused}
                  disabled={!write}
                  onChange={(event) => patch(channel.id, { paused: event.target.checked })}
                />
                Pause
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
              {channel.vendor !== "webhook" ? (
                <label className="text-xs text-muted-foreground">
                  Commission % (display)
                  <Input
                    className="mt-1 h-8"
                    inputMode="decimal"
                    disabled={!write}
                    value={String(channel.commissionPct)}
                    onChange={(event) => patch(channel.id, { commissionPct: Number(event.target.value) || 0 })}
                  />
                </label>
              ) : null}
              {channel.vendor !== "webhook" ? (
                <label className="text-xs text-muted-foreground">
                  Menu markup %
                  <Input
                    className="mt-1 h-8"
                    inputMode="decimal"
                    disabled={!write}
                    value={String(channel.markupPct)}
                    onChange={(event) => patch(channel.id, { markupPct: Number(event.target.value) || 0 })}
                  />
                </label>
              ) : null}
              {channel.vendor === "doordash" ? (
                <>
                  <label className="text-xs text-muted-foreground">
                    Developer id
                    <Input className="mt-1 h-8" disabled={!write} value={channel.developerId} onChange={(event) => patch(channel.id, { developerId: event.target.value })} />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Key id
                    <Input className="mt-1 h-8" disabled={!write} value={channel.keyId} onChange={(event) => patch(channel.id, { keyId: event.target.value })} />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Signing secret
                    <Input className="mt-1 h-8" disabled={!write} value={channel.signingSecret} onChange={(event) => patch(channel.id, { signingSecret: event.target.value })} />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Store / location id
                    <Input className="mt-1 h-8" disabled={!write} value={channel.storeId} onChange={(event) => patch(channel.id, { storeId: event.target.value })} />
                  </label>
                </>
              ) : null}
              {channel.vendor === "ubereats" ? (
                <>
                  <label className="text-xs text-muted-foreground">
                    Client id
                    <Input className="mt-1 h-8" disabled={!write} value={channel.clientId} onChange={(event) => patch(channel.id, { clientId: event.target.value })} />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Client secret
                    <Input className="mt-1 h-8" disabled={!write} value={channel.clientSecret} onChange={(event) => patch(channel.id, { clientSecret: event.target.value })} />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Store id
                    <Input className="mt-1 h-8" disabled={!write} value={channel.storeId} onChange={(event) => patch(channel.id, { storeId: event.target.value })} />
                  </label>
                </>
              ) : null}
              {channel.vendor === "webhook" ? (
                <label className="text-xs text-muted-foreground sm:col-span-2">
                  Signing secret
                  <Input className="mt-1 h-8" disabled={!write} value={channel.signingSecret} onChange={(event) => patch(channel.id, { signingSecret: event.target.value })} />
                </label>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" className="mt-3" disabled={!write} data-publish-delivery-menu onClick={publish}>
        Publish delivery menu
      </Button>
    </section>
  );
}
