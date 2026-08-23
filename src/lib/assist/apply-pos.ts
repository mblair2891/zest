import { usePosStore } from "@/lib/pos/store";
import type { AssistDraft } from "./types";
import type { TicketStation } from "@/lib/pos/types";

const STATIONS: TicketStation[] = ["kitchen", "bar", "expo", "dessert"];

function asStation(v: string): TicketStation {
  return STATIONS.includes(v as TicketStation) ? (v as TicketStation) : "kitchen";
}

export function applyAssistDraft(draft: AssistDraft): { ok: true; detail: string } {
  const store = usePosStore.getState();

  if (draft.domain === "menu_item") {
    let categoryId = draft.categoryId;
    if (!categoryId || !store.categories.some((c) => c.id === categoryId)) {
      const byName = store.categories.find(
        (c) => c.name.toLowerCase() === draft.categoryName.toLowerCase(),
      );
      if (byName) categoryId = byName.id;
      else {
        categoryId = store.createCategory({
          name: draft.categoryName || "Mains",
          station: asStation(draft.station),
        }).id;
      }
    }
    let vendorId = draft.vendorId;
    if (draft.vendorName && !vendorId) {
      const v = store.vendors.find(
        (x) => x.name.toLowerCase() === draft.vendorName!.toLowerCase(),
      );
      vendorId = v?.id;
    }
    store.createMenuItem({
      name: draft.name,
      description: draft.description,
      priceCents: draft.priceCents,
      categoryId,
      station: asStation(draft.station),
      vendorId,
      course: draft.course,
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
