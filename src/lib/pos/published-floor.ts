/**
 * Published floor snapshot vs the seeded house plan.
 * A full-service demo writes the snapshot at seed time.
 * A missing snapshot falls back to that plan and can publish once.
 */
import type { StationPublishRecord } from "./station-publish";

function floorTableIds(plan: { tables?: unknown[] } | null | undefined): string[] {
  if (!plan || !Array.isArray(plan.tables)) return [];
  return plan.tables
    .map((t) => (t && typeof t === "object" ? String((t as { id?: string }).id ?? "") : ""))
    .filter(Boolean);
}

export function withSeededPublishedFloor(
  existing: StationPublishRecord | null | undefined,
  floorPlan: { tables: unknown[]; sections?: unknown[] } | null | undefined,
): StationPublishRecord | undefined {
  if (!floorPlan?.tables?.length) return existing ?? undefined;
  const prevIds = floorTableIds(existing?.setup?.floorPlan as { tables?: unknown[] } | undefined);
  const seedIds = floorTableIds(floorPlan);
  const same =
    prevIds.length > 0 &&
    prevIds.length === seedIds.length &&
    seedIds.every((id) => prevIds.includes(id));
  if (existing && same) return existing;
  return {
    version: (existing?.version ?? 0) + 1,
    publishedAt: Date.now(),
    publishedByName: existing?.publishedByName || "House",
    setup: {
      ...(existing?.setup ?? {}),
      floorPlan,
    },
  };
}

export function resolveServiceFloor<T extends { id: string }>(opts: {
  /** null = no published floor on the snapshot. [] = snapshot published an empty floor. */
  publishedTables: T[] | null;
  seededTables: T[];
  draftTables: T[];
  currentTables: T[];
  /** Full-service demo: missing snapshot publishes the seeded plan once. */
  autoPublishSeed?: boolean;
}): { tables: T[]; fromDraft: boolean; autoPublish: boolean } {
  if (opts.publishedTables && opts.publishedTables.length > 0) {
    return { tables: opts.publishedTables, fromDraft: false, autoPublish: false };
  }
  // [] is a published empty floor. Do not put the seeded plan back.
  if (opts.publishedTables && opts.publishedTables.length === 0) {
    if (opts.draftTables.length > 0) {
      return { tables: opts.draftTables, fromDraft: true, autoPublish: false };
    }
    if (opts.currentTables.length > 0) {
      return { tables: opts.currentTables, fromDraft: false, autoPublish: false };
    }
    return { tables: [], fromDraft: false, autoPublish: false };
  }
  if (opts.seededTables.length > 0 && opts.draftTables.length === 0) {
    return {
      tables: opts.seededTables,
      fromDraft: !opts.autoPublishSeed,
      autoPublish: Boolean(opts.autoPublishSeed),
    };
  }
  if (opts.draftTables.length > 0) {
    return { tables: opts.draftTables, fromDraft: true, autoPublish: false };
  }
  if (opts.currentTables.length > 0) {
    return { tables: opts.currentTables, fromDraft: false, autoPublish: false };
  }
  if (opts.seededTables.length > 0) {
    return {
      tables: opts.seededTables,
      fromDraft: !opts.autoPublishSeed,
      autoPublish: Boolean(opts.autoPublishSeed),
    };
  }
  return { tables: [], fromDraft: false, autoPublish: false };
}

/** Empty the published floor and the station snapshot. Sections and other snapshot keys stay. */
export function clearedFloorSetup(
  setup: Record<string, unknown>,
  plan: { sections?: Array<{ name?: string }>; room?: unknown },
): Record<string, unknown> {
  const emptyPlan = {
    tables: [] as unknown[],
    sections: plan.sections ?? [],
    ...(plan.room ? { room: plan.room } : {}),
  };
  const sectionNames = emptyPlan.sections
    .map((section) => String(section?.name ?? "").trim())
    .filter(Boolean);
  const prevRaw = setup.stationPublish;
  const prev =
    prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw)
      ? (prevRaw as Record<string, unknown>)
      : {};
  const prevSetupRaw = prev.setup;
  const prevSetup =
    prevSetupRaw && typeof prevSetupRaw === "object" && !Array.isArray(prevSetupRaw)
      ? (prevSetupRaw as Record<string, unknown>)
      : {};
  const version = Math.max(0, Math.round(Number(prev.version) || 0)) + 1;
  return {
    ...setup,
    floorPlan: emptyPlan,
    tableCount: 0,
    sectionNames,
    floorLater: false,
    configVersion: Math.max(0, Math.round(Number(setup.configVersion) || 0)) + 1,
    stationPublish: {
      ...prev,
      version,
      publishedAt: Date.now(),
      publishedByName:
        typeof prev.publishedByName === "string" && prev.publishedByName ? prev.publishedByName : "Owner",
      setup: {
        ...prevSetup,
        floorPlan: emptyPlan,
        sectionNames,
      },
    },
  };
}
