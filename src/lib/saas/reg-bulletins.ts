import type { TaxRateDef } from "@/lib/pos/tax-rates";
import type { BulletinScopeKind, BulletinSeverity } from "@/lib/pos/jurisdiction";

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
  createdAt: string;
  archivedAt: string | null;
};

export type VenueBulletin = RegBulletin & {
  ack: "pending" | "saved" | "dismissed";
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
};
