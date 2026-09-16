import { toast } from "sonner";
import { usePosStore } from "@/lib/pos/store";
import { persistPaymentMethods } from "@/lib/pos/persist-location-setup";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { Input } from "@/components/ui/input";
import {
  parsePaymentMethods,
  togglePaymentMethod,
  type PaymentMethodsConfig,
} from "@/lib/pos/payment-methods";

export function PaymentMethodsSettings({ write }: { write: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const cfg = parsePaymentMethods(settings.paymentMethods);
  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");

  const save = (next: PaymentMethodsConfig) => {
    usePosStore.getState().updateSettings({ paymentMethods: next });
    persistPaymentMethods();
  };

  const toggle = (key: keyof PaymentMethodsConfig, on: boolean) => {
    if (!write) return;
    const res = togglePaymentMethod(cfg, key, on);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    save(res.cfg);
  };

  return (
    <div className="space-y-3" data-demo="payment-methods">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Payment methods</p>
        <GuideLearnLink topicId="venue-payment-methods" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-xs text-muted-foreground">
        Toggles, not JSON. Location owner/manager enables each tender the house accepts.
        Disabled methods are hidden on station pay, QR, kiosk, and closeout. At least one
        guest tender (cash, card, or gift) must stay on.
        {peer
          ? " Peer venue: methods are venue-level. Operators cannot turn off card for their own lines if the house takes cards — they only have their Finix merchant for their lines."
          : ""}
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.cash}
          onChange={(e) => toggle("cash", e.target.checked)}
        />
        <span>
          Cash
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Off: no drawer possession required. Banks unused.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.card}
          onChange={(e) => toggle("card", e.target.checked)}
        />
        <span>
          Card (Quantum Payments)
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Live or sandbox follows location lifecycle. Off: no reader prompts.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.giftCard}
          onChange={(e) => toggle("giftCard", e.target.checked)}
        />
        <span>
          Accept gift cards
          <span className="mt-0.5 block text-xs text-muted-foreground">
            First-party in-person ledger. Off: no sell or redeem. Not sold online.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.check}
          onChange={(e) => toggle("check", e.target.checked)}
        />
        <span>Check</span>
      </label>
      {cfg.check && (
        <div className="ml-6 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              disabled={!write}
              checked={cfg.checkPhoto}
              onChange={(e) => toggle("checkPhoto", e.target.checked)}
            />
            Optional photo
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              disabled={!write}
              checked={cfg.checkLast4}
              onChange={(e) => toggle("checkLast4", e.target.checked)}
            />
            Last 4
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              disabled={!write}
              checked={cfg.checkManagerWitness}
              onChange={(e) => toggle("checkManagerWitness", e.target.checked)}
            />
            Manager witness PIN
          </label>
        </div>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.houseAccount}
          onChange={(e) => toggle("houseAccount", e.target.checked)}
        />
        <span>House account / charge to company</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.comp}
          onChange={(e) => toggle("comp", e.target.checked)}
        />
        <span>
          Comp
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Reason required. Not a guest tender.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.other}
          onChange={(e) => toggle("other", e.target.checked)}
        />
        <span>Other / custom</span>
      </label>
      {cfg.other && (
        <label className="ml-6 block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Custom label</span>
          <Input
            disabled={!write}
            value={cfg.otherLabel}
            onChange={(e) => save({ ...cfg, otherLabel: e.target.value.slice(0, 24) })}
          />
        </label>
      )}
    </div>
  );
}
