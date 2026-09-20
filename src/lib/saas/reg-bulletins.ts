import type { TaxRateDef } from "@/lib/pos/tax-rates";
import type { BulletinScopeKind, BulletinSeverity } from "@/lib/pos/jurisdiction";
import type { SuggestedLabor } from "./reg-calendar";

export type BulletinStatus = "draft" | "published";
export type BulletinKind = "tax" | "labor" | "both";

export type RegBulletin = {
  id: string;
  title: string;
  body: string;
  effectiveOn: string;
  severity: BulletinSeverity;
  scopeKind: BulletinScopeKind;
  scopeCountry: string;
  scopeState: string;
  scopeCity: string;
  scopeDistrict: string;
  suggestedTax: TaxRateDef | null;
  suggestedLabor: SuggestedLabor | null;
  kind: BulletinKind;
  status: BulletinStatus;
  sourceUrl: string;
  createdAt: string;
  archivedAt: string | null;
};

export type VenueBulletin = RegBulletin & {
  ack: "pending" | "saved" | "dismissed" | "scheduled";
  applyOn: string | null;
};

export type CreateBulletinInput = {
  title: string;
  body: string;
  effectiveOn: string;
  severity: BulletinSeverity;
  scopeKind: BulletinScopeKind;
  scopeCountry?: string;
  scopeState?: string;
  scopeCity?: string;
  scopeDistrict?: string;
  suggestedTax?: { name: string; percent: number } | null;
  suggestedLabor?: SuggestedLabor | null;
  kind?: BulletinKind;
  status?: BulletinStatus;
  sourceUrl?: string;
};

export type RegReviewTask = {
  id: string;
  state: string;
  city: string;
  windowMmdd: string;
  windowDate: string;
  kinds: string;
  status: "open" | "drafted" | "dismissed";
  sourceUrl: string;
  createdAt: string;
};
