import { useState } from "react";
import { Input } from "@/components/ui/input";
import { saveVenueProfileFn } from "@/lib/access/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useOnboardingStore } from "@/lib/saas/onboarding-state";
import { canEditVenueProfile, sameContactEmail } from "@/lib/saas/venue-profile";
import { parseJurisdiction, US_STATES } from "@/lib/pos/jurisdiction";
import { usePosStore } from "@/lib/pos/store";
import { parseVenueTimezone, VENUE_TIMEZONES } from "@/lib/pos/venue-time";

/**
 * Venue name, address, state, and timezone for an entity admin.
 * The location contact on a peer venue can edit. Everyone else on this screen can view.
 */
export function VenueProfileSettings(props: {
  orgId: string;
  locationId: string;
  peerVenue: boolean;
  entities: { id: string; name: string }[];
}) {
  const settings = usePosStore((s) => s.settings);
  const { user } = useCurrentUserState();
  const checklist = useOnboardingStore((s) =>
    s.locationId === props.locationId ? s.layer : null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const locationContact = sameContactEmail(
    user?.primaryEmail,
    checklist?.location.contactEmail,
  );
  const canEdit = canEditVenueProfile({
    peerVenue: props.peerVenue,
    entityAdmin: true,
    houseAdmin: false,
    locationContact,
  });
  const state = parseJurisdiction(settings.jurisdiction).state;
  const timezone = parseVenueTimezone(settings.timezone);
  const note = canEdit
    ? "State Oregon lists liquor stores on Suppliers."
    : props.peerVenue
      ? "You can view the venue. The location contact can change it."
      : "A hosted venue keeps these settings on the host. You can view them.";

  const writeLocal = (patch: {
    name?: string;
    address?: string;
    timezone?: string;
    state?: string;
  }) => {
    if (!canEdit) return;
    const current = usePosStore.getState().settings;
    const jurisdiction =
      patch.state == null
        ? current.jurisdiction
        : parseJurisdiction({ ...current.jurisdiction, state: patch.state });
    usePosStore.setState({
      settings: {
        ...current,
        ...(patch.name != null ? { name: patch.name } : {}),
        ...(patch.address != null ? { address: patch.address } : {}),
        ...(patch.timezone != null ? { timezone: patch.timezone } : {}),
        jurisdiction,
      },
    });
  };

  const persist = async (over?: {
    name?: string;
    address?: string;
    timezone?: string;
    state?: string;
  }) => {
    if (!canEdit || !props.orgId || !props.locationId) return;
    const current = usePosStore.getState().settings;
    const name = (over?.name ?? current.name).trim();
    if (!name) return;
    const address = over?.address ?? current.address;
    const zone = parseVenueTimezone(over?.timezone ?? current.timezone);
    const nextState = over?.state ?? parseJurisdiction(current.jurisdiction).state;
    setMsg(null);
    try {
      await saveVenueProfileFn({
        data: {
          orgId: props.orgId,
          locationId: props.locationId,
          name,
          address,
          timezone: zone,
          state: nextState,
        },
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save the venue.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-venue-settings>
      <div>
        <h2 className="text-sm font-semibold">Venue settings</h2>
        <p className="mt-1 text-xs text-muted-foreground" data-venue-settings-note>
          {note}
        </p>
      </div>
      <section
        className="space-y-3 rounded-2xl border border-border bg-surface p-4"
        data-venue-settings-mode={canEdit ? "edit" : "view"}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Venue name</span>
          <Input
            value={settings.name}
            disabled={!canEdit}
            data-venue-name
            onChange={(e) => writeLocal({ name: e.target.value })}
            onBlur={() => void persist()}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Address</span>
          <Input
            value={settings.address}
            disabled={!canEdit}
            data-venue-address
            onChange={(e) => writeLocal({ address: e.target.value })}
            onBlur={() => void persist()}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">State</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            value={state}
            disabled={!canEdit}
            data-venue-state
            onChange={(e) => {
              const next = e.target.value;
              writeLocal({ state: next });
              void persist({ state: next });
            }}
          >
            <option value="">State</option>
            {US_STATES.map((row) => (
              <option key={row.code} value={row.code}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Timezone</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
            value={timezone}
            disabled={!canEdit}
            data-venue-timezone
            onChange={(e) => {
              writeLocal({ timezone: e.target.value });
              void persist({ timezone: e.target.value });
            }}
          >
            {(VENUE_TIMEZONES as readonly string[])
              .concat(
                settings.timezone &&
                  !VENUE_TIMEZONES.includes(settings.timezone as (typeof VENUE_TIMEZONES)[number])
                  ? [timezone]
                  : [],
              )
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
          </select>
        </label>
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Entities in this venue</p>
          <ul className="space-y-1 text-sm" data-venue-entities>
            {props.entities.length ? (
              props.entities.map((entity) => <li key={entity.id}>{entity.name}</li>)
            ) : (
              <li>No selling entities are on this venue yet.</li>
            )}
          </ul>
        </div>
        {msg ? <p className="text-xs text-danger">{msg}</p> : null}
      </section>
    </div>
  );
}
