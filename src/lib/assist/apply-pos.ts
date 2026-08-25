import { usePosStore } from "@/lib/pos/store";
import type { AssistDraft, SuggestedModifierGroup } from "./types";
import type { TicketStation } from "@/lib/pos/types";

const STATIONS: TicketStation[] = ["kitchen", "bar", "expo", "dessert"];

function asStation(v: string): TicketStation {
  return STATIONS.includes(v as TicketStation) ? (v as TicketStation) : "kitchen";
}

function ensureModifierGroup(
  group: SuggestedModifierGroup,
  itemName: string,
): string {
  const store = usePosStore.getState();
  const want = group.options.map((o) => o.name.toLowerCase());
  const existing = store.modifierGroups.find((g) => {
    if (g.name.toLowerCase() !== group.name.toLowerCase()) return false;
    const have = new Set(g.options.map((o) => o.name.toLowerCase()));
    return want.every((n) => have.has(n)) || want.length === 0;
  });
  if (existing) return existing.id;
  const clash = store.modifierGroups.some(
    (g) => g.name.toLowerCase() === group.name.toLowerCase(),
  );
  const { id } = store.createModifierGroup({
    name: clash ? `${group.name} · ${itemName}` : group.name,
    required: group.required,
    min: group.min,
    max: group.max,
    options: group.options,
  });
  return id;
}

function groupsFromMenuDraft(draft: Extract<AssistDraft, { domain: "menu_item" }>): SuggestedModifierGroup[] {
  const groups = [...(draft.modifierGroups ?? [])];
  const omits = (draft.omitPresets ?? [])
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => (/^no\b/i.test(n) ? n : `No ${n}`));
  if (omits.length) {
    groups.push({
      name: "Omit",
      required: false,
      min: 0,
      max: omits.length,
      options: omits.map((name) => ({ name, priceCents: 0 })),
    });
  }
  const adds = (draft.addPresets ?? []).filter((a) => a.name.trim());
  if (adds.length) {
    groups.push({
      name: "Add-ons",
      required: false,
      min: 0,
      max: adds.length,
      options: adds.map((a) => ({
        name: a.name.trim(),
        priceCents: Math.max(0, a.priceCents),
      })),
    });
  }
  return groups;
}

export function applyAssistDraft(draft: AssistDraft): { ok: true; detail: string } {
  const store = usePosStore.getState();

  if (draft.domain === "menu_item") {
    const emp = store.getCurrentEmployee();
    let categoryId = draft.categoryId;
    if (!categoryId || !store.categories.some((c) => c.id === categoryId)) {
      const byName = store.categories.find(
        (c) => c.name.toLowerCase() === draft.categoryName.toLowerCase(),
      );
      if (byName) categoryId = byName.id;
      else {
        const created = store.createCategory({
          name: draft.categoryName || "Mains",
          station: asStation(draft.station),
        }).id;
        categoryId = created || store.categories[0]?.id || "";
      }
    }
    let vendorId = draft.vendorId;
    if (emp?.role === "vendor_operator") vendorId = emp.operatorId;
    else if (draft.vendorName && !vendorId) {
      const v = store.vendors.find(
        (x) => x.name.toLowerCase() === draft.vendorName!.toLowerCase(),
      );
      vendorId = v?.id;
    }
    const extraIds = groupsFromMenuDraft(draft).map((g) =>
      ensureModifierGroup(g, draft.name),
    );
    const live = usePosStore.getState();
    if (draft.itemId && live.menuItems.some((m) => m.id === draft.itemId)) {
      const prev = live.menuItems.find((m) => m.id === draft.itemId)!;
      live.updateMenuItem(draft.itemId, {
        name: draft.name,
        description: draft.description,
        priceCents: draft.priceCents,
        categoryId,
        station: asStation(draft.station),
        vendorId,
        course: draft.course,
        modifierGroupIds: [...new Set([...prev.modifierGroupIds, ...extraIds])],
      });
      return { ok: true, detail: `Updated ${draft.name}` };
    }
    live.createMenuItem({
      name: draft.name,
      description: draft.description,
      priceCents: draft.priceCents,
      categoryId,
      station: asStation(draft.station),
      vendorId,
      course: draft.course,
      modifierGroupIds: extraIds,
    });
    return { ok: true, detail: `Added ${draft.name}` };
  }

  if (draft.domain === "category") {
    store.createCategory({ name: draft.name, station: asStation(draft.station) });
    return { ok: true, detail: `Category ${draft.name}` };
  }

  if (draft.domain === "modifier") {
    const { id } = store.createModifierGroup({
      name: draft.name,
      required: draft.required,
      min: draft.min,
      max: draft.max,
      options: draft.options,
    });
    return { ok: true, detail: `Modifier group ${draft.name} (${id})` };
  }

  if (draft.domain === "floor") {
    const colors = ["sec-1", "sec-2", "sec-3", "sec-4", "sec-5", "sec-6"] as const;
    draft.sections.forEach((sec, si) => {
      const existing = store.floorSections.find(
        (s) => s.name.toLowerCase() === sec.name.toLowerCase(),
      );
      const sectionName = existing?.name ?? sec.name;
      if (!existing) {
        store.upsertFloorSection({
          name: sectionName,
          color: colors[si % colors.length],
          sort: store.floorSections.length + si,
        });
      }
      const cols = Math.max(1, Math.ceil(Math.sqrt(sec.tables.length)));
      sec.tables.forEach((t, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        store.addFloorTable({
          label: t.label,
          section: sectionName,
          seats: t.seats,
          x: 8 + col * 14 + si * 4,
          y: 10 + row * 16,
          w: 12,
          h: 12,
          shape: "round",
        });
      });
    });
    return { ok: true, detail: "Floor updated" };
  }

  if (draft.domain === "operator") {
    store.createVendor({
      name: draft.name,
      shortName: draft.shortName,
      stationType: draft.stationType,
    });
    return { ok: true, detail: `Operator ${draft.name}` };
  }

  if (draft.domain === "station") {
    for (const rule of draft.rules) {
      const st = asStation(rule.station);
      const q = rule.target.toLowerCase();
      const live = usePosStore.getState();
      const cats = live.categories.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()),
      );
      if (cats.length) {
        const ids = new Set(cats.map((c) => c.id));
        usePosStore.setState({
          categories: live.categories.map((c) =>
            ids.has(c.id) ? { ...c, station: st } : c,
          ),
          menuItems: live.menuItems.map((m) =>
            ids.has(m.categoryId) ? { ...m, station: st } : m,
          ),
        });
      } else {
        live.createCategory({ name: rule.target || "Routed", station: st });
      }
    }
    return { ok: true, detail: "Routing updated" };
  }

  if (draft.domain === "staff") {
    const { pin } = store.createEmployee({ name: draft.name, role: draft.role });
    return { ok: true, detail: `${draft.name} PIN ${pin}` };
  }

  if (draft.domain === "location") {
    store.updateSettings({
      ...(draft.name ? { name: draft.name } : {}),
    });
    return { ok: true, detail: "Location profile updated" };
  }

  if (draft.domain === "cash_discount") {
    store.updateSettings({
      cashDiscountEnabled: draft.enabled,
      cashDiscountPercent: draft.percent,
      cashRoundIncrement: draft.increment,
      cashRoundMode: "up",
    });
    return { ok: true, detail: draft.enabled ? `Cash ${draft.percent}%` : "Cash discount off" };
  }

  return { ok: true, detail: "Saved" };
}
