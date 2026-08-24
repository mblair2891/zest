// @ts-nocheck — store implementation recovered from production SSR bundle
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { homeViewForEmployee, homeViewForRole } from "./rbac";
import {
  SETTINGS,
  EMPLOYEES,
  CATEGORIES,
  MENU_ITEMS,
  MODIFIER_GROUPS,
  TABLES,
  WAITLIST,
  RESERVATIONS,
  CUSTOMERS,
  GIFT_CARDS,
  INVENTORY,
  VENDORS,
  SETTLEMENT_CONFIG,
  EXTRA_TABLE_GRANTS,
} from "./seed";
import { computeTotals, isHappyHour, lineUnitTotal } from "./calculations";
import { allocateChargebackFee, buildPeriodSettlement, CHARGEBACK_FEE_CENTS } from "./settlement";
import {
	entriesForChargeback,
	entriesForOrderAllocations,
	entriesForPayment,
	entriesForPeriodClose,
	mergeLedger,
} from "./ledger";
import { useOpsStore } from "./ops-store";
import { isDevDemoClient } from "@/lib/saas/flags";
import { laundryPosSlice } from "./laundry-seed";
import { demoPersistStorage } from "@/lib/demo/session";
import { demoPosSlice, demoSaasOrg } from "@/lib/demo/pos-payloads";
import {
  cardRequiresConnection,
  noteCashPayment,
  noteOrderSent,
  noteTicketBump,
  noteTableSeat,
  noteWaitlistAdd,
} from "@/lib/offline/enqueue-pos";
import {
  DEFAULT_FLOOR_SECTIONS,
  DEFAULT_SECTION_POLICY,
  canAccessTable,
  defaultHomeSectionsForRole,
  policyOf,
} from "./section-control";
import { employeesForVenue, venueById } from "./entities";
import { useSaasStore } from "./saas-store";
import { starterPosSlice } from "./starter-seed";
import type { VenueEntityId } from "./types";
import type { PosStore, PosStorePersist } from "./pos-store";
import {
  HOST_SCOPE,
  canEditMenu,
  upsertGrant,
} from "@/lib/access/entity-grants";
import {
  findStaffByPin,
  hashPin,
  isBackOfficeRole,
  isFourDigitPin,
  withHashedPin,
} from "./pin";
import {
  makeClaimCode,
  type LocationDevice,
} from "./location-devices";
import { laundryLocationDevices } from "./laundry-seed";

function nextOrderNumber(orders) {
	return orders.reduce((m, o) => Math.max(m, o.number), 100) + 1;
}
function tableStatusFromOrder(order) {
	if (!order || order.status !== "open") return "available";
	const settings = usePosStore.getState().settings ?? SETTINGS;
	const cardBal = computeTotals(order, settings, { tender: "card" }).balanceCents;
	const cashBal = computeTotals(order, settings, { tender: "cash" }).balanceCents;
	if (order.payments.length > 0 && (cardBal <= 0 || cashBal <= 0)) return "paid";
	if (order.checkPrintedAt) return "check";
	const sent = order.lines.some((l) => l.sent && !l.voided);
	const unsent = order.lines.some((l) => !l.sent && !l.voided);
	if (sent && unsent) return "ordering";
	if (sent) return "ordered";
	if (order.lines.length > 0) return "ordering";
	return "seated";
}
function emptyShift() {
	return {
		id: uid("shift"),
		openedAt: Date.now(),
		openingFloatCents: 3e4,
		cashSalesCents: 0,
		cardSalesCents: 0,
		giftSalesCents: 0,
		compsCents: 0,
		voidsCents: 0,
		tipsCashCents: 0,
		tipsCardCents: 0,
		orderCount: 0,
		guestCount: 0
	};
}
function initialState() {
	return {
		settings: { ...SETTINGS },
		employees: employeesForVenue("restaurant"),
		currentEmployeeId: null,
		categories: CATEGORIES.map((c) => ({ ...c })),
		menuItems: MENU_ITEMS.map((m) => ({ ...m })),
		modifierGroups: MODIFIER_GROUPS.map((g) => ({
			...g,
			options: g.options.map((o) => ({ ...o }))
		})),
		tables: TABLES.map((t) => ({ ...t })),
		orders: [],
		tickets: [],
		waitlist: WAITLIST.map((w) => ({ ...w })),
		reservations: RESERVATIONS.map((r) => ({ ...r })),
		customers: CUSTOMERS.map((c) => ({ ...c })),
		giftCards: GIFT_CARDS.map((g) => ({ ...g })),
		inventory: INVENTORY.map((i) => ({ ...i })),
		vendors: VENDORS.map((v) => ({ ...v })),
		settlementConfig: { ...SETTLEMENT_CONFIG },
		settlementPeriods: [],
		chargebacks: [],
		ledgerEntries: [],
		auditLog: [],
		shift: emptyShift(),
		view: "floor",
		activeOrderId: null,
		activeTableId: null,
		selectedCategoryId: CATEGORIES[0]?.id ?? null,
		selectedLineId: null,
		activeSeat: null,
		clock: Date.now(),
		floorSections: DEFAULT_FLOOR_SECTIONS.map((s) => ({ ...s })),
		extraTableGrants: EXTRA_TABLE_GRANTS.map((g) => ({ ...g })),
		sectionOverrides: {},
		activeEntityId: "restaurant",
		tenantLocationId: null,
		entityPermissions: [],
		locationDevices: [],
		activeDeviceId: null,
		sessionKind: "pin",
		backOfficeUnlocked: false,
	};
}

function accessCtx(get) {
	const emp = get().getCurrentEmployee();
	return {
		emp,
		sections: get().floorSections,
		grants: get().extraTableGrants,
		policy: policyOf(get().settings.sectionPolicy),
		overrideTableIds: emp ? (get().sectionOverrides[emp.id] ?? []) : []
	};
}

function checkTableAccess(get, table, action) {
	const ctx = accessCtx(get);
	return canAccessTable({ ...ctx, table, action });
}

const usePosStoreRaw = create()(persist((set, get) => ({
	...initialState(),
	login: (pin) => {
		const loc = get().tenantLocationId || get().activeEntityId || "loc";
		const device = (get().locationDevices ?? []).find((d) => d.id === get().activeDeviceId);
		const deviceOp = device?.assignment?.operatorId ?? null;
		const emp = findStaffByPin(get().employees, pin, loc, deviceOp);
		if (!emp) {
			return {
				ok: false,
				error: deviceOp && deviceOp !== HOST_SCOPE
					? "PIN not valid on this assigned device"
					: "Invalid PIN",
			};
		}
		const hashed = hashPin(pin, loc);
		const employees = get().employees.map((e) =>
			e.id === emp.id && !e.pinHash ? { ...e, pinHash: hashed, pin: "" } : e,
		);
		set({
			employees,
			currentEmployeeId: emp.id,
			view: homeViewForEmployee(emp),
			activeOrderId: null,
			activeTableId: null,
			sessionKind: "pin",
			backOfficeUnlocked: false,
		});
		get().audit("login", `${emp.name} (${emp.role}) · floor PIN`);
		return { ok: true };
	},
	loginAs: (employeeId, opts) => {
		const emp = get().employees.find((e) => e.id === employeeId && e.active);
		if (!emp) return { ok: false, error: "Unknown employee" };
		const kind = opts?.kind ?? (isBackOfficeRole(emp.role) ? "backoffice" : "pin");
		set({
			currentEmployeeId: emp.id,
			view: homeViewForEmployee(emp),
			activeOrderId: null,
			activeTableId: null,
			sessionKind: kind,
			backOfficeUnlocked: kind === "backoffice",
		});
		get().audit("login", `${emp.name} (${emp.role}) · ${kind}`);
		return { ok: true };
	},
	logout: () => {
		const emp = get().getCurrentEmployee();
		if (emp) get().audit("logout", emp.name);
		set({
			currentEmployeeId: null,
			view: "floor",
			activeOrderId: null,
			sessionKind: "pin",
			backOfficeUnlocked: false,
		});
	},
	setStaffPin: (employeeId, pin) => {
		const actor = get().getCurrentEmployee();
		if (!actor) return { ok: false, error: "Sign in first" };
		if (actor.role !== "owner" && actor.role !== "manager" && actor.role !== "vendor_operator") {
			return { ok: false, error: "Only back office can set PINs" };
		}
		if (!isFourDigitPin(pin)) return { ok: false, error: "PIN must be 4 digits" };
		const target = get().employees.find((e) => e.id === employeeId);
		if (!target) return { ok: false, error: "Unknown employee" };
		if (actor.role === "vendor_operator" && target.operatorId !== actor.operatorId) {
			return { ok: false, error: "You can only set PINs for your entity" };
		}
		const loc = get().tenantLocationId || get().activeEntityId || "loc";
		const used = get().employees.some(
			(e) => e.id !== employeeId && (e.pin === pin || e.pinHash === hashPin(pin, loc)),
		);
		if (used) return { ok: false, error: "PIN already in use at this location" };
		set({
			employees: get().employees.map((e) =>
				e.id === employeeId ? withHashedPin(e, pin, loc) : e,
			),
		});
		get().audit("staff", `PIN set for ${target.name}`);
		return { ok: true };
	},
	unlockBackOffice: (secret) => {
		const loc = get().tenantLocationId || get().activeEntityId || "loc";
		if (get().verifyManagerPin(secret)) {
			set({ backOfficeUnlocked: true, sessionKind: "backoffice" });
			return { ok: true };
		}
		const emp = findStaffByPin(get().employees, secret, loc, null);
		if (emp && (emp.role === "owner" || emp.role === "manager")) {
			set({ backOfficeUnlocked: true, sessionKind: "backoffice" });
			return { ok: true };
		}
		return { ok: false, error: "Password or manager PIN required" };
	},
	lockBackOffice: () => set({ backOfficeUnlocked: false, sessionKind: "pin" }),
	verifyManagerPin: (pin) => {
		if (pin === get().settings.managerPin) return true;
		return get().employees.some((e) => e.pin === pin && e.active && (e.role === "manager" || e.role === "owner"));
	},
	clockToggle: (employeeId) => {
		const emp = get().employees.find((e) => e.id === employeeId);
		const clockingOut = !!emp?.clockedIn;
		set({ employees: get().employees.map((e) => {
			if (e.id !== employeeId) return e;
			if (e.clockedIn) return {
				...e,
				clockedIn: false,
				clockInAt: void 0
			};
			return {
				...e,
				clockedIn: true,
				clockInAt: Date.now()
			};
		}) });
		if (clockingOut) {
			set({
				extraTableGrants: get().extraTableGrants.filter((g) => !(g.employeeId === employeeId && g.scope === "shift")),
				sectionOverrides: { ...get().sectionOverrides, [employeeId]: [] }
			});
		}
	},
	tick: () => {
		const now = Date.now();
		set({
			clock: now,
			tickets: get().tickets.map((t) => t.status === "bumped" ? t : {
				...t,
				elapsedSec: Math.floor((now - t.createdAt) / 1e3)
			})
		});
	},
	setView: (v) => set({ view: v }),
	setCategory: (id) => set({ selectedCategoryId: id ?? null }),
	setSelectedLine: (id) => set({ selectedLineId: id }),
	setActiveSeat: (n) => set({ activeSeat: n }),
	setActiveOrder: (id) => {
		const order = get().orders.find((o) => o.id === id);
		if (order?.tableId) {
			const table = get().tables.find((t) => t.id === order.tableId);
			if (table) {
				const access = checkTableAccess(get, table, "order");
				if (!access.ok && !access.viewOnly) {
					const viewAccess = checkTableAccess(get, table, "view");
					if (!(viewAccess.ok && viewAccess.viewOnly)) {
						return { ok: false, error: access.reason, access };
					}
				}
			}
		}
		set({ activeOrderId: id, view: "order" });
		return { ok: true };
	},
	getCurrentEmployee: () => {
		const id = get().currentEmployeeId;
		return get().employees.find((e) => e.id === id) ?? null;
	},
	getActiveOrder: () => {
		const id = get().activeOrderId;
		return get().orders.find((o) => o.id === id);
	},
	postLedger: (entries) => {
		if (!entries.length) return;
		set({ ledgerEntries: mergeLedger(get().ledgerEntries ?? [], entries) });
	},
	audit: (action, detail) => {
		const emp = get().getCurrentEmployee();
		set({ auditLog: [{
			id: uid("aud"),
			at: Date.now(),
			employeeId: emp?.id ?? "system",
			employeeName: emp?.name ?? "System",
			action,
			detail
		}, ...get().auditLog].slice(0, 200) });
	},
	updateSettings: (patch) => {
		const emp = get().getCurrentEmployee();
		if (emp?.role === "vendor_operator") return;
		set({ settings: {
			...get().settings,
			...patch
		} });
	},
	setEntityGrant: (subjectOperatorId, targetOperatorId, patch) => {
		const emp = get().getCurrentEmployee();
		if (emp?.role === "vendor_operator") return;
		set({
			entityPermissions: upsertGrant(
				get().entityPermissions ?? [],
				subjectOperatorId,
				targetOperatorId,
				patch,
			),
		});
		get().audit("permissions", `${subjectOperatorId} → ${targetOperatorId}`);
	},
	setLocationDeviceAssignment: (id, assignment) => {
		const emp = get().getCurrentEmployee();
		if (emp?.role === "vendor_operator") return;
		set({
			locationDevices: (get().locationDevices ?? []).map((d) =>
				d.id === id ? { ...d, assignment, lastSeenAt: Date.now() } : d,
			),
		});
		get().audit("device", `Reassign ${id} → ${assignment.operatorId} ${assignment.function}`);
	},
	enrollLocationDevice: (input) => {
		const emp = get().getCurrentEmployee();
		if (emp?.role === "vendor_operator") return { id: "", claimCode: "" };
		const id = uid("dev");
		const claimCode = makeClaimCode();
		const device: LocationDevice = {
			id,
			locationId: get().tenantLocationId || "",
			label: input.label.trim() || "Device",
			type: input.type,
			status: "pending",
			lastSeenAt: Date.now(),
			serial: input.serial,
			claimCode,
			assignment: input.assignment,
		};
		set({ locationDevices: [device, ...(get().locationDevices ?? [])] });
		get().audit("device", `Enroll ${device.label}`);
		return { id, claimCode };
	},
	setActiveDeviceId: (id) => set({ activeDeviceId: id }),
	tableAccess: (tableId, action = "order") => {
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return { ok: false, reason: "Table not found", code: "blocked_order" };
		return checkTableAccess(get, table, action);
	},
	selectTable: (tableId) => {
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return { ok: false, error: "Not found" };
		const access = checkTableAccess(get, table, "order");
		if (!access.ok && !access.viewOnly) {
			const viewAccess = checkTableAccess(get, table, "view");
			if (viewAccess.ok && viewAccess.viewOnly && table.orderId) {
				set({
					activeTableId: tableId,
					activeOrderId: table.orderId,
					view: "order"
				});
				return { ok: true, access: viewAccess };
			}
			return { ok: false, error: access.reason, access };
		}
		if (table.orderId) set({
			activeTableId: tableId,
			activeOrderId: table.orderId,
			view: "order"
		});
		return { ok: true, access };
	},
	seatTable: (tableId, guestCount) => {
		const emp = get().getCurrentEmployee();
		if (!emp) return { ok: false, error: "Not signed in" };
		const table = get().tables.find((t) => t.id === tableId);
		if (!table || table.status !== "available") return { ok: false, error: "Table not available" };
		const access = checkTableAccess(get, table, "seat");
		if (!access.ok) return { ok: false, error: access.reason, access };
		const order = {
			id: uid("ord"),
			number: nextOrderNumber(get().orders),
			type: "dine_in",
			tableId,
			guestCount,
			serverId: emp.id,
			serverName: emp.name,
			lines: [],
			payments: [],
			status: "open",
			discountPercent: 0,
			discountCents: 0,
			autoGratApplied: guestCount >= get().settings.autoGratPartySize,
			serviceChargeCents: 0,
			createdAt: Date.now()
		};
		set({
			orders: [...get().orders, order],
			tables: get().tables.map((t) => t.id === tableId ? {
				...t,
				status: "seated",
				orderId: order.id,
				serverId: emp.id,
				guestCount,
				seatedAt: Date.now()
			} : t),
			activeOrderId: order.id,
			activeTableId: tableId,
			view: "order",
			shift: {
				...get().shift,
				guestCount: get().shift.guestCount + guestCount
			}
		});
		get().audit("seat", `Table ${table.label} · ${guestCount} guests`);
		noteTableSeat({ tableId, guestCount });
		return { ok: true };
	},
	markClean: (tableId) => {
		set({ tables: get().tables.map((t) => t.id === tableId ? {
			...t,
			status: "available",
			orderId: void 0,
			serverId: void 0,
			guestCount: void 0,
			seatedAt: void 0
		} : t) });
	},
	clearTable: (tableId) => {
		const childIds = get().tables.find((t) => t.id === tableId) ? get().tables.filter((t) => t.mergedIntoId === tableId).map((t) => t.id) : [];
		set({
			extraTableGrants: get().extraTableGrants.filter((g) => !(g.scope === "seating" && (g.tableId === tableId || childIds.includes(g.tableId)))),
			tables: get().tables.map((t) => {
				if (t.id === tableId || childIds.includes(t.id)) return {
					...t,
					status: "dirty",
					orderId: void 0,
					serverId: void 0,
					guestCount: void 0,
					seatedAt: void 0,
					...t.id === tableId ? { mergedChildIds: void 0 } : { mergedIntoId: void 0 }
				};
				return t;
			}),
			activeOrderId: get().activeOrderId && get().orders.find((o) => o.id === get().activeOrderId)?.tableId === tableId ? null : get().activeOrderId
		});
	},
	transferTable: (fromId, toId) => {
		const from = get().tables.find((t) => t.id === fromId);
		const to = get().tables.find((t) => t.id === toId);
		if (!from?.orderId) return {
			ok: false,
			error: "Source has no check"
		};
		if (!to || to.status !== "available") return {
			ok: false,
			error: "Target not available"
		};
		const destAccess = checkTableAccess(get, to, "seat");
		if (!destAccess.ok) return { ok: false, error: destAccess.reason, access: destAccess };
		const orderId = from.orderId;
		set({
			tables: get().tables.map((t) => {
				if (t.id === fromId) return {
					...t,
					status: "dirty",
					orderId: void 0,
					serverId: void 0,
					guestCount: void 0,
					seatedAt: void 0
				};
				if (t.id === toId) return {
					...t,
					status: tableStatusFromOrder(get().orders.find((o) => o.id === orderId)),
					orderId,
					serverId: from.serverId,
					guestCount: from.guestCount,
					seatedAt: from.seatedAt
				};
				return t;
			}),
			orders: get().orders.map((o) => o.id === orderId ? {
				...o,
				tableId: toId
			} : o)
		});
		get().audit("transfer", `Table ${from.label} → ${to.label}`);
		return { ok: true };
	},
	mergeTables: (primaryId, childId) => {
		const primary = get().tables.find((t) => t.id === primaryId);
		const child = get().tables.find((t) => t.id === childId);
		if (!primary || !child) return {
			ok: false,
			error: "Tables not found"
		};
		if (primary.mergedIntoId || child.mergedIntoId) return {
			ok: false,
			error: "Already merged"
		};
		if (!primary.orderId && !child.orderId) return {
			ok: false,
			error: "Seat a table first"
		};
		let orderId = primary.orderId ?? child.orderId;
		let guestCount = (primary.guestCount ?? 0) + (child.guestCount ?? 0);
		if (child.orderId && child.orderId !== orderId) {
			const childOrder = get().orders.find((o) => o.id === child.orderId);
			const primaryOrder = get().orders.find((o) => o.id === orderId);
			if (childOrder && primaryOrder) {
				set({ orders: get().orders.map((o) => o.id === orderId ? {
					...o,
					lines: [...o.lines, ...childOrder.lines],
					guestCount: o.guestCount + childOrder.guestCount,
					mergedTableIds: [...o.mergedTableIds ?? [], childId]
				} : o).map((o) => o.id === childOrder.id ? {
					...o,
					status: "cancelled",
					tableId: void 0
				} : o) });
				guestCount = primaryOrder.guestCount + childOrder.guestCount;
			}
		} else set({ orders: get().orders.map((o) => o.id === orderId ? {
			...o,
			guestCount: Math.max(o.guestCount, guestCount),
			mergedTableIds: [.../* @__PURE__ */ new Set([...o.mergedTableIds ?? [], childId])]
		} : o) });
		set({ tables: get().tables.map((t) => {
			if (t.id === primaryId) return {
				...t,
				orderId,
				guestCount,
				mergedChildIds: [.../* @__PURE__ */ new Set([...t.mergedChildIds ?? [], childId])],
				status: "seated"
			};
			if (t.id === childId) return {
				...t,
				mergedIntoId: primaryId,
				orderId: void 0,
				status: "seated"
			};
			return t;
		}) });
		get().audit("merge", `Tables ${primary.label}+${child.label}`);
		return { ok: true };
	},
	unmergeTable: (tableId) => {
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return {
			ok: false,
			error: "Not found"
		};
		const primaryId = table.mergedIntoId ?? tableId;
		const primary = get().tables.find((t) => t.id === primaryId);
		if (!primary?.mergedChildIds?.length) return {
			ok: false,
			error: "Not a merge"
		};
		const children = primary.mergedChildIds;
		set({
			tables: get().tables.map((t) => {
				if (t.id === primaryId) return {
					...t,
					mergedChildIds: void 0
				};
				if (children.includes(t.id)) return {
					...t,
					mergedIntoId: void 0,
					status: "available",
					orderId: void 0
				};
				return t;
			}),
			orders: get().orders.map((o) => o.id === primary.orderId ? {
				...o,
				mergedTableIds: void 0
			} : o)
		});
		return { ok: true };
	},
	openBarTab: (name, guestCount = 1) => {
		const emp = get().getCurrentEmployee();
		if (!emp) return "";
		const order = {
			id: uid("ord"),
			number: nextOrderNumber(get().orders),
			type: "bar_tab",
			tabName: name,
			guestCount,
			serverId: emp.id,
			serverName: emp.name,
			lines: [],
			payments: [],
			status: "open",
			discountPercent: 0,
			discountCents: 0,
			autoGratApplied: false,
			serviceChargeCents: 0,
			createdAt: Date.now()
		};
		set({
			orders: [...get().orders, order],
			activeOrderId: order.id,
			view: "order"
		});
		return order.id;
	},
	openTakeout: (name) => {
		const emp = get().getCurrentEmployee();
		if (!emp) return "";
		const order = {
			id: uid("ord"),
			number: nextOrderNumber(get().orders),
			type: "takeout",
			tabName: name,
			guestCount: 1,
			serverId: emp.id,
			serverName: emp.name,
			lines: [],
			payments: [],
			status: "open",
			discountPercent: 0,
			discountCents: 0,
			autoGratApplied: false,
			serviceChargeCents: 0,
			createdAt: Date.now()
		};
		set({
			orders: [...get().orders, order],
			activeOrderId: order.id,
			view: "order"
		});
		return order.id;
	},
	addItem: (menuItemId, opts = {}) => {
		const order = get().getActiveOrder();
		const item = get().menuItems.find((m) => m.id === menuItemId);
		if (!order || order.status !== "open") return {
			ok: false,
			error: "No open order"
		};
		if (!item || !item.available) return {
			ok: false,
			error: "Item unavailable"
		};
		if (order.tableId) {
			const table = get().tables.find((t) => t.id === order.tableId);
			if (table) {
				const access = checkTableAccess(get, table, "order");
				if (!access.ok) return { ok: false, error: access.reason, access };
			}
		}
		const settings = get().settings;
		const unit = isHappyHour(settings, /* @__PURE__ */ new Date()) && item.happyHourPriceCents != null ? item.happyHourPriceCents : item.priceCents;
		const vendor = item.vendorId ? get().vendors.find((v) => v.id === item.vendorId) : void 0;
		const line = {
			id: uid("ln"),
			menuItemId: item.id,
			name: item.name,
			vendorId: item.vendorId,
			vendorName: vendor?.shortName ?? vendor?.name,
			quantity: opts.quantity ?? 1,
			unitPriceCents: unit,
			modifiers: opts.modifiers ?? [],
			note: opts.note,
			seat: opts.seat ?? get().activeSeat ?? void 0,
			course: item.course,
			station: item.station,
			sent: false,
			held: false,
			voided: false,
			comped: false,
			discountCents: 0,
			taxExempt: !!item.taxExempt,
			createdAt: Date.now()
		};
		const updated = {
			...order,
			lines: [...order.lines, line]
		};
		set({
			orders: get().orders.map((o) => o.id === order.id ? updated : o),
			selectedLineId: line.id,
			tables: order.tableId ? get().tables.map((t) => t.id === order.tableId ? {
				...t,
				status: tableStatusFromOrder(updated)
			} : t) : get().tables,
			menuItems: item.trackStock && item.stock != null ? get().menuItems.map((m) => m.id === item.id ? {
				...m,
				stock: Math.max(0, (m.stock ?? 0) - line.quantity)
			} : m) : get().menuItems
		});
		return { ok: true };
	},
	updateLineQty: (lineId, delta) => {
		const order = get().getActiveOrder();
		if (!order) return;
		set({ orders: get().orders.map((o) => {
			if (o.id !== order.id) return o;
			return {
				...o,
				lines: o.lines.map((l) => {
					if (l.id !== lineId || l.sent || l.voided) return l;
					return {
						...l,
						quantity: Math.max(1, l.quantity + delta)
					};
				}).filter((l) => l.quantity > 0)
			};
		}) });
	},
	setLineNote: (lineId, note) => {
		const order = get().getActiveOrder();
		if (!order) return;
		set({ orders: get().orders.map((o) => o.id !== order.id ? o : {
			...o,
			lines: o.lines.map((l) => l.id === lineId ? {
				...l,
				note
			} : l)
		}) });
	},
	setLineSeat: (lineId, seat) => {
		const order = get().getActiveOrder();
		if (!order) return;
		set({ orders: get().orders.map((o) => o.id !== order.id ? o : {
			...o,
			lines: o.lines.map((l) => l.id === lineId ? {
				...l,
				seat
			} : l)
		}) });
	},
	voidLine: (lineId, reason) => {
		const order = get().getActiveOrder();
		if (!order) return;
		const line = order.lines.find((l) => l.id === lineId);
		set({
			orders: get().orders.map((o) => o.id !== order.id ? o : {
				...o,
				lines: o.lines.map((l) => l.id === lineId ? {
					...l,
					voided: true,
					note: reason
				} : l)
			}),
			shift: {
				...get().shift,
				voidsCents: get().shift.voidsCents + (line ? lineUnitTotal(line) * line.quantity : 0)
			}
		});
		get().audit("void", reason);
	},
	compLine: (lineId, reason) => {
		const order = get().getActiveOrder();
		if (!order) return;
		const line = order.lines.find((l) => l.id === lineId);
		set({
			orders: get().orders.map((o) => o.id !== order.id ? o : {
				...o,
				lines: o.lines.map((l) => l.id === lineId ? {
					...l,
					comped: true,
					note: reason
				} : l)
			}),
			shift: {
				...get().shift,
				compsCents: get().shift.compsCents + (line ? lineUnitTotal(line) * line.quantity : 0)
			}
		});
		get().audit("comp", reason);
	},
	holdLine: (lineId, held) => {
		const order = get().getActiveOrder();
		if (!order) return;
		set({ orders: get().orders.map((o) => o.id !== order.id ? o : {
			...o,
			lines: o.lines.map((l) => l.id === lineId ? {
				...l,
				held
			} : l)
		}) });
	},
	sendOrder: (opts = {}) => {
		const order = get().getActiveOrder();
		if (!order) return;
		const onlyUnsent = opts.onlyUnsent !== false;
		const fireHeld = opts.fireHeld === true;
		const now = Date.now();
		const toSend = order.lines.filter((l) => !l.voided && (!onlyUnsent || !l.sent) && (fireHeld || !l.held));
		if (toSend.length === 0) return;
		const byKey = /* @__PURE__ */ new Map();
		for (const l of toSend) {
			const key = `${l.station}|${l.vendorId ?? ""}|${l.course}`;
			const arr = byKey.get(key) ?? [];
			arr.push(l);
			byKey.set(key, arr);
		}
		const table = order.tableId ? get().tables.find((t) => t.id === order.tableId) : void 0;
		const newTickets = [];
		for (const [, lines] of byKey) {
			const first = lines[0];
			const vendor = first.vendorId ? get().vendors.find((v) => v.id === first.vendorId) : void 0;
			newTickets.push({
				id: uid("kt"),
				orderId: order.id,
				orderNumber: order.number,
				tableLabel: table?.label ?? order.tabName ?? order.type.replace("_", " "),
				serverName: order.serverName,
				station: first.station,
				vendorId: first.vendorId,
				vendorName: vendor?.shortName ?? vendor?.name,
				status: "new",
				course: first.course,
				createdAt: now,
				elapsedSec: 0,
				items: lines.map((l) => ({
					lineId: l.id,
					name: l.name,
					quantity: l.quantity,
					modifiers: l.modifiers.map((m) => m.optionName),
					note: l.note,
					course: l.course,
					seat: l.seat
				}))
			});
		}
		const sentIds = new Set(toSend.map((l) => l.id));
		const updated = {
			...order,
			lines: order.lines.map((l) => sentIds.has(l.id) ? {
				...l,
				sent: true,
				held: false,
				firedAt: now
			} : l)
		};
		set({
			orders: get().orders.map((o) => o.id === order.id ? updated : o),
			tickets: [...newTickets, ...get().tickets],
			tables: order.tableId ? get().tables.map((t) => t.id === order.tableId ? {
				...t,
				status: tableStatusFromOrder(updated)
			} : t) : get().tables
		});
		get().audit("send", `Order #${order.number} · ${toSend.length} items`);
		noteOrderSent({
			orderId: order.id,
			orderNumber: order.number,
			ticketIds: newTickets.map((t) => t.id),
		});
	},
	fireCourse: (course) => {
		const order = get().getActiveOrder();
		if (!order) return;
		set({ orders: get().orders.map((o) => o.id !== order.id ? o : {
			...o,
			lines: o.lines.map((l) => l.course === course && l.held ? {
				...l,
				held: false
			} : l)
		}) });
		get().sendOrder({
			onlyUnsent: true,
			fireHeld: true
		});
	},
	applyDiscount: ({ percent, cents, reason, promoCode }) => {
		const order = get().getActiveOrder();
		if (!order) return;
		set({ orders: get().orders.map((o) => o.id !== order.id ? o : {
			...o,
			discountPercent: percent ?? o.discountPercent,
			discountCents: cents ?? o.discountCents,
			discountReason: reason,
			promoCode
		}) });
		get().audit("discount", reason);
	},
	setOrderNote: (note) => {
		const order = get().getActiveOrder();
		if (!order) return;
		set({ orders: get().orders.map((o) => o.id === order.id ? {
			...o,
			note
		} : o) });
	},
	printCheck: () => {
		const order = get().getActiveOrder();
		if (!order) return;
		const updated = {
			...order,
			checkPrintedAt: Date.now()
		};
		set({
			orders: get().orders.map((o) => o.id === order.id ? updated : o),
			tables: order.tableId ? get().tables.map((t) => t.id === order.tableId ? {
				...t,
				status: "check"
			} : t) : get().tables
		});
	},
	takePayment: ({ method, amountCents, tipCents = 0, tenderedCents, last4, giftCardCode, houseAccountId }) => {
		const order = get().getActiveOrder();
		const emp = get().getCurrentEmployee();
		if (!order || !emp) return {
			ok: false,
			error: "No order"
		};
		if (order.status !== "open") return {
			ok: false,
			error: "Order closed"
		};
		if ((method === "card" || method === "room_charge") && cardRequiresConnection()) {
			return { ok: false, error: "Card requires connection" };
		}
		let changeCents = 0;
		if (method === "cash") {
			const tendered = tenderedCents ?? amountCents + tipCents;
			if (tendered < amountCents + tipCents) return {
				ok: false,
				error: "Insufficient tender"
			};
			changeCents = tendered - amountCents - tipCents;
		}
		if (method === "gift_card") {
			if (!giftCardCode) return {
				ok: false,
				error: "Enter gift card code"
			};
			const needle = giftCardCode.replace(/[\s-]/g, "").toUpperCase();
			const gc = get().giftCards.find((g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle && g.active);
			if (!gc) return {
				ok: false,
				error: "Invalid gift card"
			};
			if (gc.status === "frozen") return { ok: false, error: "Card is frozen" };
			if (gc.status === "void") return { ok: false, error: "Card is void" };
			const need = amountCents + tipCents;
			if (gc.balanceCents < need) return {
				ok: false,
				error: `Balance only $${(gc.balanceCents / 100).toFixed(2)}`
			};
			const nextBal = gc.balanceCents - need;
			set({ giftCards: get().giftCards.map((g) => g.id === gc.id ? {
				...g,
				balanceCents: nextBal,
				status: nextBal === 0 ? "zeroed" : g.status || "active"
			} : g) });
		}
		const payment = {
			id: uid("pay"),
			method,
			amountCents,
			tipCents,
			tenderedCents,
			changeCents: method === "cash" ? changeCents : void 0,
			last4,
			giftCardCode,
			houseAccountId,
			at: Date.now(),
			createdAt: Date.now(),
			employeeId: emp.id,
			processor: method === "card" || method === "room_charge" ? "quantum_payments" : void 0,
			chargeBrand: get().settlementConfig.hostName || get().settings.name
		};
		const payments = [...order.payments, payment];
		let updated = {
			...order,
			payments
		};
		const totals = computeTotals(updated, get().settings, {
			tender: method === "cash" ? "cash" : "card",
		});
		const shift = { ...get().shift };
		if (method === "cash") shift.cashSalesCents += amountCents;
		if (method === "card" || method === "room_charge") shift.cardSalesCents += amountCents;
		if (method === "gift_card") shift.giftSalesCents += amountCents;
		if (method === "comp") shift.compsCents += amountCents;
		if (method === "cash") shift.tipsCashCents += tipCents;
		if (method === "card") shift.tipsCardCents += tipCents;
		const employees = get().employees.map((e) => e.id === order.serverId ? {
			...e,
			tipsEarned: e.tipsEarned + tipCents,
			salesTotal: e.salesTotal + amountCents
		} : e);
		let tables = get().tables;
		if (totals.balanceCents <= 0) {
			updated = {
				...updated,
				status: "closed",
				closedAt: Date.now()
			};
			shift.orderCount += 1;
			if (order.tableId) {
				const childIds = order.mergedTableIds ?? [];
				tables = tables.map((t) => t.id === order.tableId || childIds.includes(t.id) ? {
					...t,
					status: "paid"
				} : t);
			}
		} else if (order.tableId) tables = tables.map((t) => t.orderId === order.id ? {
			...t,
			status: tableStatusFromOrder(updated)
		} : t);
		const ids = {
			orgId: get().tenantLocationId ? `org:${get().tenantLocationId}` : "org_local",
			locationId: get().tenantLocationId || get().settlementConfig.locationId || "loc_local",
		};
		let led = entriesForPayment({
			ids,
			order: updated,
			payment,
			settings: get().settings,
		});
		if (updated.status === "closed") {
			led = led.concat(entriesForOrderAllocations({
				ids,
				order: updated,
				vendors: get().vendors,
				settings: get().settings,
			}));
		}
		set({
			orders: get().orders.map((o) => o.id === order.id ? updated : o),
			shift,
			employees,
			tables,
			ledgerEntries: mergeLedger(get().ledgerEntries ?? [], led),
		});
		if (updated.status === "closed") try {
			useOpsStore.getState().recordTicketClosed(order.serverId, Date.now());
		} catch {}
		get().audit("payment", `#${order.number} ${method} $${(amountCents / 100).toFixed(2)}`);
		if (method === "cash") {
			noteCashPayment({
				orderId: order.id,
				orderNumber: order.number,
				amountCents: amountCents + tipCents,
				paymentId: payment.id,
			});
		}
		return {
			ok: true,
			changeCents
		};
	},
	closeOrderIfPaid: () => {
		const order = get().getActiveOrder();
		if (!order) return;
		if (computeTotals(order, get().settings, {
			tender: order.payments.some((p) => p.method === "cash") &&
				!order.payments.some((p) => p.method === "card" || p.method === "room_charge")
				? "cash"
				: "card",
		}).balanceCents <= 0 && order.status === "open") set({ orders: get().orders.map((o) => o.id === order.id ? {
			...o,
			status: "closed",
			closedAt: Date.now()
		} : o) });
	},
	bumpTicket: (ticketId) => {
		const ticket = get().tickets.find((t) => t.id === ticketId);
		set({ tickets: get().tickets.map((t) => t.id === ticketId ? {
			...t,
			status: "bumped",
			bumpedAt: Date.now()
		} : t) });
		noteTicketBump({ ticketId, orderNumber: ticket?.orderNumber });
	},
	recallTicket: (ticketId) => {
		set({ tickets: get().tickets.map((t) => t.id === ticketId ? {
			...t,
			status: "new",
			bumpedAt: void 0
		} : t) });
	},
	startTicket: (ticketId) => {
		set({ tickets: get().tickets.map((t) => t.id === ticketId ? {
			...t,
			status: "in_progress"
		} : t) });
	},
	addWaitlist: (entry) => {
		const id = entry.id || uid("wl");
		const smsPending = Boolean(entry.phone) && cardRequiresConnection();
		set({ waitlist: [{
			...entry,
			id,
			createdAt: entry.createdAt || Date.now(),
			status: entry.status || "waiting",
			smsStatus: entry.smsStatus || (smsPending ? "pending" : entry.phone ? "sent" : "none"),
		}, ...get().waitlist] });
		noteWaitlistAdd({
			id,
			name: entry.name,
			phone: entry.phone,
			partySize: entry.partySize,
			smsPending,
		});
	},
	updateWaitlistStatus: (id, status) => {
		set({ waitlist: get().waitlist.map((w) => w.id === id ? {
			...w,
			status,
			notifiedAt: status === "notified" ? Date.now() : w.notifiedAt
		} : w) });
	},
	seatFromWaitlist: (waitId, tableId) => {
		const w = get().waitlist.find((x) => x.id === waitId);
		if (!w) return { ok: false, error: "Guest not found" };
		const res = get().seatTable(tableId, w.partySize);
		if (!res.ok) return res;
		get().updateWaitlistStatus(waitId, "seated");
		return res;
	},
	addReservation: (entry) => {
		set({ reservations: [{
			...entry,
			id: entry.id || uid("res"),
			status: entry.status || "booked",
			createdAt: entry.createdAt || Date.now()
		}, ...get().reservations] });
	},
	updateReservationStatus: (id, status) => {
		set({ reservations: get().reservations.map((r) => r.id === id ? {
			...r,
			status
		} : r) });
	},
	addCustomer: (c) => {
		set({ customers: [{
			...c,
			id: uid("cus"),
			loyaltyPoints: 50,
			visitCount: 0,
			totalSpentCents: 0,
			tier: "standard",
			marketingOptIn: true
		}, ...get().customers] });
	},
	issueGiftCard: ({ amountCents, code, issuedToName }) => {
		if (amountCents <= 0) return {
			ok: false,
			error: "Amount required"
		};
		const c = (code || "").trim().toUpperCase() || `ZEST-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(Math.random() * 9e3 + 1e3)}`;
		if (get().giftCards.some((g) => g.code === c)) return {
			ok: false,
			error: "Code already exists"
		};
		set({ giftCards: [{
			id: uid("gc"),
			code: c,
			balanceCents: amountCents,
			originalBalanceCents: amountCents,
			active: true,
			status: "active",
			source: "summex",
			issuedAt: Date.now(),
			issuedToName
		}, ...get().giftCards] });
		return {
			ok: true,
			code: c
		};
	},
	reloadGiftCard: (code, amountCents) => {
		const gc = get().giftCards.find((g) => g.code.toUpperCase() === code.toUpperCase() && g.active);
		if (!gc) return {
			ok: false,
			error: "Card not found"
		};
		if (gc.status === "frozen" || gc.status === "void") return { ok: false, error: "Card is not reloadable" };
		if (amountCents <= 0) return {
			ok: false,
			error: "Amount required"
		};
		set({ giftCards: get().giftCards.map((g) => g.id === gc.id ? {
			...g,
			balanceCents: g.balanceCents + amountCents,
			status: "active"
		} : g) });
		return { ok: true };
	},
	setGiftCardStatus: (code, status) => {
		const gc = get().giftCards.find((g) => g.code.toUpperCase() === code.toUpperCase());
		if (!gc) return { ok: false, error: "Card not found" };
		set({
			giftCards: get().giftCards.map((g) =>
				g.id === gc.id
					? { ...g, status, active: status !== "void" }
					: g,
			),
		});
		return { ok: true };
	},
	importGiftCards: (preview, opts) => {
		const skipExisting = !opts.overwrite;
		const existing = new Set(
			get().giftCards.map((g) => g.code.replace(/[\s-]/g, "").toUpperCase()),
		);
		let imported = 0;
		let skipped = 0;
		const next = [...get().giftCards];
		const seen = new Set<string>();
		for (const row of preview.rows) {
			const code = row.code.replace(/[\s-]/g, "").toUpperCase();
			if (!code || row.balanceCents < 0) continue;
			if (seen.has(code)) {
				skipped += 1;
				continue;
			}
			seen.add(code);
			if (existing.has(code)) {
				if (skipExisting) {
					skipped += 1;
					continue;
				}
				const idx = next.findIndex(
					(g) => g.code.replace(/[\s-]/g, "").toUpperCase() === code,
				);
				if (idx >= 0) {
					next[idx] = {
						...next[idx],
						balanceCents: row.balanceCents,
						source: preview.provider,
						status: row.status || (row.balanceCents > 0 ? "active" : "zeroed"),
						issuedToName: row.issuedToName || next[idx].issuedToName,
						issuedToEmail: row.issuedToEmail || next[idx].issuedToEmail,
						notes: row.notes || next[idx].notes,
					};
					imported += 1;
				}
				continue;
			}
			next.unshift({
				id: uid("gc"),
				code: row.code,
				balanceCents: row.balanceCents,
				originalBalanceCents: row.originalBalanceCents ?? row.balanceCents,
				active: (row.status || "active") !== "void",
				status: row.status || (row.balanceCents > 0 ? "active" : "zeroed"),
				source: preview.provider,
				issuedToName: row.issuedToName,
				issuedToEmail: row.issuedToEmail,
				issuedAt: Date.now(),
				notes: row.notes || `Imported from ${preview.provider}`,
			});
			existing.add(code);
			imported += 1;
		}
		set({ giftCards: next });
		return { ok: true, imported, skipped };
	},
	adjustLoyalty: (customerId, deltaPoints) => {
		set({ customers: get().customers.map((c) => {
			if (c.id !== customerId) return c;
			const loyaltyPoints = Math.max(0, c.loyaltyPoints + deltaPoints);
			let tier = "standard";
			if (loyaltyPoints >= 2e3) tier = "platinum";
			else if (loyaltyPoints >= 750) tier = "gold";
			else if (loyaltyPoints >= 250) tier = "silver";
			return {
				...c,
				loyaltyPoints,
				tier
			};
		}) });
	},
	setCustomerTier: (customerId, tier) => {
		set({ customers: get().customers.map((c) => c.id === customerId ? {
			...c,
			tier
		} : c) });
	},
	setCustomerMarketingOptIn: (customerId, optIn) => {
		set({ customers: get().customers.map((c) => c.id === customerId ? {
			...c,
			marketingOptIn: optIn
		} : c) });
	},
	toggleItemAvailable: (id) => {
		const emp = get().getCurrentEmployee();
		const item = get().menuItems.find((m) => m.id === id);
		if (!item) return;
		if (!canEditMenu(emp, get().entityPermissions, item.vendorId)) return;
		set({ menuItems: get().menuItems.map((m) => m.id === id ? {
			...m,
			available: !m.available
		} : m) });
	},
	createCategory: ({ name, station }) => {
		const emp = get().getCurrentEmployee();
		if (emp?.role === "vendor_operator") return { id: "" };
		const id = uid("cat");
		const colors = ["#2C4A6E", "#1F7A4C", "#9A6700", "#A61B1B", "#5C5C5C"];
		set({
			categories: [
				...get().categories,
				{
					id,
					name: name.trim() || "Category",
					sort: get().categories.length,
					color: colors[get().categories.length % colors.length]!,
					station: station ?? "kitchen",
				},
			],
		});
		get().audit("menu", `Category ${name}`);
		return { id };
	},
	createMenuItem: (input) => {
		const emp = get().getCurrentEmployee();
		let vendorId = input.vendorId;
		if (emp?.role === "vendor_operator") vendorId = emp.operatorId;
		if (!canEditMenu(emp, get().entityPermissions, vendorId)) return { id: "" };
		const id = uid("itm");
		const vendor = vendorId
			? get().vendors.find((v) => v.id === vendorId)
			: undefined;
		set({
			menuItems: [
				...get().menuItems,
				{
					id,
					name: input.name.trim() || "Item",
					categoryId: input.categoryId,
					priceCents: Math.max(0, Math.round(input.priceCents)),
					course: input.course ?? "entree",
					station: input.station ?? "kitchen",
					description: input.description,
					modifierGroupIds: input.modifierGroupIds ?? [],
					available: true,
					vendorId,
					online: true,
				},
			],
		});
		get().audit("menu", `${input.name}${vendor ? ` · ${vendor.shortName}` : ""}`);
		return { id };
	},
	updateMenuItem: (id, patch) => {
		const emp = get().getCurrentEmployee();
		const item = get().menuItems.find((m) => m.id === id);
		if (!item) return;
		const target = patch.vendorId ?? item.vendorId;
		if (!canEditMenu(emp, get().entityPermissions, item.vendorId)) return;
		if (patch.vendorId && !canEditMenu(emp, get().entityPermissions, target)) return;
		if (emp?.role === "vendor_operator") {
			patch = { ...patch, vendorId: emp.operatorId };
		}
		set({
			menuItems: get().menuItems.map((m) => (m.id === id ? { ...m, ...patch } : m)),
		});
	},
	deleteMenuItem: (id) => {
		const emp = get().getCurrentEmployee();
		const item = get().menuItems.find((m) => m.id === id);
		if (!item) return;
		if (!canEditMenu(emp, get().entityPermissions, item.vendorId)) return;
		set({ menuItems: get().menuItems.filter((m) => m.id !== id) });
		get().audit("menu", `Removed ${item.name}`);
	},
	createModifierGroup: (input) => {
		const id = uid("modg");
		set({
			modifierGroups: [
				...get().modifierGroups,
				{
					id,
					name: input.name.trim() || "Modifiers",
					required: Boolean(input.required),
					min: input.min ?? (input.required ? 1 : 0),
					max: input.max ?? Math.max(1, input.options.length),
					options: input.options.map((o, i) => ({
						id: uid("opt") + i,
						name: o.name,
						priceCents: o.priceCents,
					})),
				},
			],
		});
		get().audit("menu", `Modifiers ${input.name}`);
		return { id };
	},
	createVendor: (input) => {
		const emp = get().getCurrentEmployee();
		if (emp?.role === "vendor_operator") return { id: "" };
		const id = uid("vnd");
		const colors = ["#2C4A6E", "#1F7A4C", "#9A6700", "#A61B1B"];
		const short = (input.shortName || input.name).slice(0, 12);
		const stationType = input.stationType ?? "kitchen";
		set({
			vendors: [
				...get().vendors,
				{
					id,
					name: input.name.trim() || "Operator",
					shortName: short,
					locationId: get().tenantLocationId || "loc",
					color: colors[get().vendors.length % colors.length]!,
					cuisine: input.cuisine ?? "",
					active: true,
					bankLast4: (input.bankLast4 || "0000").replace(/\D/g, "").slice(-4).padStart(4, "0"),
					bankLabel: input.bankLabel || "Host-managed payout",
					stationLabel: stationType === "bar" ? "Bar" : stationType === "both" ? "Bar + kitchen" : "Kitchen",
					stationType,
				},
			],
		});
		get().audit("vendor", input.name);
		return { id };
	},
	updateVendor: (id, patch) => {
		const emp = get().getCurrentEmployee();
		if (emp?.role === "vendor_operator") return;
		set({
			vendors: get().vendors.map((v) => {
				if (v.id !== id) return v;
				const next = { ...v, ...patch };
				if (patch.stationType && !patch.stationLabel) {
					next.stationLabel =
						patch.stationType === "bar" ? "Bar" : patch.stationType === "both" ? "Bar + kitchen" : "Kitchen";
				}
				if (patch.bankLast4) {
					next.bankLast4 = String(patch.bankLast4).replace(/\D/g, "").slice(-4).padStart(4, "0");
				}
				return next;
			}),
		});
	},
	createEmployee: (input) => {
		const actor = get().getCurrentEmployee();
		if (actor?.role === "vendor_operator") {
			input = {
				...input,
				operatorId: actor.operatorId,
				role: input.role === "bartender" || input.role === "kitchen" ? input.role : "kitchen",
			};
		}
		const used = new Set(get().employees.map((e) => e.pin));
		let pin = (input.pin || "").replace(/\D/g, "").slice(0, 4);
		if (pin.length < 4 || used.has(pin)) {
			do {
				pin = String(1000 + Math.floor(Math.random() * 9000));
			} while (used.has(pin));
		}
		const id = uid("emp");
		const colors = ["#2C4A6E", "#1F7A4C", "#9A6700", "#5C5C5C"];
		const loc = get().tenantLocationId || get().activeEntityId || "loc";
		set({
			employees: [
				...get().employees,
				{
					id,
					name: input.name.trim() || "Staff",
					pin: "",
					pinHash: hashPin(pin, loc),
					role: input.role,
					color: colors[get().employees.length % colors.length]!,
					clockedIn: false,
					tipsEarned: 0,
					salesTotal: 0,
					active: true,
					homeSectionIds: [],
					operatorId: input.operatorId,
					title: input.title,
				},
			],
		});
		get().audit("staff", `${input.name} · ${input.role}`);
		return { id, pin };
	},
	receiveInventory: (id, qty) => {
		set({ inventory: get().inventory.map((i) => i.id === id ? {
			...i,
			onHand: i.onHand + qty
		} : i) });
	},
	updateInventory: (id, patch) => {
		set({ inventory: get().inventory.map((i) => i.id === id ? {
			...i,
			...patch
		} : i) });
	},
	updateTableLayout: (id, patch) => {
		set({ tables: get().tables.map((t) => t.id === id ? {
			...t,
			...patch
		} : t) });
	},
	addFloorTable: (partial = {}) => {
		const n = get().tables.length + 1;
		const id = uid("t");
		set({ tables: [...get().tables, {
			id,
			label: partial.label ?? String(n),
			section: partial.section ?? "Dining",
			seats: partial.seats ?? 4,
			x: partial.x ?? 40,
			y: partial.y ?? 40,
			w: partial.w ?? 12,
			h: partial.h ?? 12,
			shape: partial.shape ?? "round",
			status: "available"
		}] });
		return id;
	},
	removeFloorTable: (id) => {
		const t = get().tables.find((x) => x.id === id);
		if (!t) return {
			ok: false,
			error: "Not found"
		};
		if (t.orderId) return {
			ok: false,
			error: "Table has open check"
		};
		set({ tables: get().tables.filter((x) => x.id !== id) });
		return { ok: true };
	},
	openShift: (floatCents) => {
		set({ shift: {
			...emptyShift(),
			openingFloatCents: floatCents
		} });
		get().audit("shift_open", `Float $${(floatCents / 100).toFixed(2)}`);
	},
	closeShift: (closingCashCents) => {
		const s = get().shift;
		const expected = s.openingFloatCents + s.cashSalesCents - s.tipsCashCents;
		set({ shift: {
			...s,
			closedAt: Date.now(),
			closingCashCents,
			expectedCashCents: expected
		} });
		get().audit("shift_close", `Counted $${(closingCashCents / 100).toFixed(2)}`);
	},
	updateSettlementConfig: (patch) => {
		const emp = get().getCurrentEmployee();
		if (emp?.role === "vendor_operator") return;
		set({ settlementConfig: {
			...get().settlementConfig,
			...patch
		} });
	},
	getOpenPeriodPreview: () => {
		const cfg = get().settlementConfig;
		return buildPeriodSettlement(
			cfg,
			get().vendors,
			get().orders,
			cfg.currentPeriodStart,
			Date.now(),
			get().getCurrentEmployee()?.name ?? "System",
			get().chargebacks ?? [],
			get().settings,
		);
	},
	fileChargeback: (orderId) => {
		const order = get().orders.find((o) => o.id === orderId);
		if (!order) return { ok: false, error: "Order not found" };
		if (order.status !== "closed") return { ok: false, error: "File a dispute only on a closed check" };
		const hasCard = order.payments.some((p) => p.method === "card" || p.method === "room_charge");
		if (!hasCard) return { ok: false, error: "No Quantum Payments card capture on this check" };
		if ((get().chargebacks ?? []).some((c) => c.orderId === orderId)) {
			return { ok: false, error: "A dispute is already filed on this check" };
		}
		const allocations = allocateChargebackFee(order, get().vendors);
		if (!allocations.length) return { ok: false, error: "No operator merchandise on this check" };
		const cb = {
			id: uid("cb"),
			orderId: order.id,
			orderNumber: order.number,
			amountCents: order.payments.filter((p) => p.method === "card" || p.method === "room_charge").reduce((s, p) => s + p.amountCents, 0),
			feeCents: CHARGEBACK_FEE_CENTS,
			status: "filed",
			filedAt: Date.now(),
			allocations
		};
		const ids = {
			orgId: get().tenantLocationId ? `org:${get().tenantLocationId}` : "org_local",
			locationId: get().tenantLocationId || get().settlementConfig.locationId || "loc_local",
		};
		set({
			chargebacks: [cb, ...(get().chargebacks ?? [])],
			ledgerEntries: mergeLedger(
				get().ledgerEntries ?? [],
				entriesForChargeback({ ids, chargeback: cb }),
			),
		});
		get().audit("chargeback", `Filed $${(CHARGEBACK_FEE_CENTS / 100).toFixed(0)} dispute fee on #${order.number}`);
		return { ok: true, chargeback: cb };
	},
	resolveChargeback: (id, outcome) => {
		const hit = (get().chargebacks ?? []).find((c) => c.id === id);
		if (!hit) return { ok: false, error: "Dispute not found" };
		set({
			chargebacks: get().chargebacks.map((c) =>
				c.id === id ? { ...c, status: outcome, resolvedAt: Date.now() } : c,
			),
		});
		get().audit("chargeback", `Dispute ${id} ${outcome} — $35 fee still allocated`);
		return { ok: true };
	},
	closeSettlementPeriod: () => {
		const preview = get().getOpenPeriodPreview();
		if (!preview) return {
			ok: false,
			error: "Nothing to close"
		};
		const ids = {
			orgId: get().tenantLocationId ? `org:${get().tenantLocationId}` : "org_local",
			locationId: get().tenantLocationId || get().settlementConfig.locationId || "loc_local",
		};
		set({
			settlementPeriods: [preview, ...get().settlementPeriods],
			settlementConfig: {
				...get().settlementConfig,
				currentPeriodStart: Date.now()
			},
			ledgerEntries: mergeLedger(
				get().ledgerEntries ?? [],
				entriesForPeriodClose({ ids, period: preview }),
			),
		});
		get().audit("settlement", `Closed period ${preview.id}`);
		return {
			ok: true,
			period: preview
		};
	},
	markSettlementPaid: (periodId) => {
		set({ settlementPeriods: get().settlementPeriods.map((p) => p.id === periodId ? {
			...p,
			status: "paid"
		} : p) });
	},
	reassignServer: (tableId, serverId) => {
		const emp = get().employees.find((e) => e.id === serverId);
		if (!emp) return;
		const table = get().tables.find((t) => t.id === tableId);
		set({
			tables: get().tables.map((t) => t.id === tableId ? {
				...t,
				serverId
			} : t),
			orders: table?.orderId ? get().orders.map((o) => o.id === table.orderId ? {
				...o,
				serverId,
				serverName: emp.name
			} : o) : get().orders
		});
	},
	assignEmployeeSections: (employeeId, sectionIds) => {
		set({
			employees: get().employees.map((e) => e.id === employeeId ? { ...e, homeSectionIds: [...sectionIds] } : e)
		});
		get().audit("section_assign", `${employeeId} → ${sectionIds.join(",") || "none"}`);
	},
	upsertFloorSection: (section) => {
		const list = [...get().floorSections];
		const i = list.findIndex((s) => s.id === section.id);
		if (i >= 0) list[i] = { ...list[i], ...section };
		else list.push({ id: section.id || uid("sec"), name: section.name || "Section", color: section.color || "sec-1", sort: section.sort ?? list.length });
		set({ floorSections: list.sort((a, b) => a.sort - b.sort) });
	},
	removeFloorSection: (id) => {
		if (get().floorSections.length <= 1) return { ok: false, error: "Keep at least one section" };
		set({ floorSections: get().floorSections.filter((s) => s.id !== id) });
		return { ok: true };
	},
	updateSectionPolicy: (patch) => {
		set({
			settings: {
				...get().settings,
				sectionPolicy: { ...policyOf(get().settings.sectionPolicy), ...patch }
			}
		});
	},
	grantExtraTable: ({ employeeId, tableId, scope, reason }) => {
		const policy = policyOf(get().settings.sectionPolicy);
		if (!policy.extraTableGrantsEnabled) return { ok: false, error: "Extra table grants are off" };
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return { ok: false, error: "Table not found" };
		const granter = get().getCurrentEmployee();
		const grant = {
			id: uid("xg"),
			employeeId,
			tableId,
			scope: scope === "seating" ? "seating" : "shift",
			grantedById: granter?.id ?? "system",
			grantedAt: Date.now(),
			orderId: scope === "seating" ? table.orderId : undefined,
			reason
		};
		set({
			extraTableGrants: [grant, ...get().extraTableGrants.filter((g) => !(g.employeeId === employeeId && g.tableId === tableId))]
		});
		get().audit("section_grant", `${employeeId} · ${table.label} · ${grant.scope}`);
		return { ok: true, grant };
	},
	revokeExtraTable: (id) => {
		set({ extraTableGrants: get().extraTableGrants.filter((g) => g.id !== id) });
	},
	overrideSectionTable: (employeeId, tableId) => {
		const policy = policyOf(get().settings.sectionPolicy);
		if (!policy.allowManagerOverride) return { ok: false, error: "Overrides disabled" };
		const cur = get().sectionOverrides[employeeId] ?? [];
		if (cur.includes(tableId)) return { ok: true };
		set({
			sectionOverrides: {
				...get().sectionOverrides,
				[employeeId]: [...cur, tableId]
			}
		});
		return { ok: true };
	},
	loadLaundryTestVenue: () => {
		if (!isDevDemoClient()) {
			return { ok: false, error: "The Laundry test seed is demo-only (DEV_DEMO=1)" };
		}
		const slice = laundryPosSlice();
		set({
			...slice,
			shift: emptyShift(),
			clock: Date.now(),
			auditLog: [
				{
					id: uid("aud"),
					at: Date.now(),
					employeeId: "system",
					employeeName: "System",
					action: "seed",
					detail: "Loaded The Laundry TEST venue",
				},
			],
			giftCards: [],
			customers: [],
			inventory: "inventory" in slice && Array.isArray(slice.inventory) ? slice.inventory : [],
		});
		try {
			useSaasStore.getState().applyLaundryTestOrg();
			useSaasStore.getState().setActiveLocation(slice.tenantLocationId);
		} catch {
			/* ignore */
		}
		return { ok: true };
	},
	loadProspectDemo: (entityId: VenueEntityId) => {
		const slice = demoPosSlice(entityId);
		const prev = get().currentEmployeeId;
		const owner =
			slice.employees.find((e) => e.role === "owner") ?? slice.employees[0];
		const keep =
			slice.employees.find((e) => e.id === prev) ??
			owner ??
			slice.employees[0];
		set({
			...slice,
			currentEmployeeId: keep?.id ?? null,
			shift: emptyShift(),
			clock: Date.now(),
			auditLog: [
				{
					id: uid("aud"),
					at: Date.now(),
					employeeId: "system",
					employeeName: "System",
					action: "seed",
					detail: `Prospect demo · ${entityId}`,
				},
			],
			giftCards: [],
			customers: [],
			inventory: "inventory" in slice && Array.isArray(slice.inventory) ? slice.inventory : [],
		});
		try {
			const { org, location } = demoSaasOrg(entityId);
			useSaasStore.getState().hydrateTenant({
				org,
				members: [
					{
						id: "mem_demo_host",
						orgId: org.id,
						name: owner?.name ?? "Demo host",
						email: "",
						role: "owner",
					},
				],
				locations: [location],
				adminName: owner?.name ?? "Demo host",
				adminRole: "owner",
			});
			useSaasStore.setState({ liveMode: false, platformAuthed: false });
			useSaasStore.getState().setActiveLocation(slice.tenantLocationId);
		} catch {
			/* ignore */
		}
		return { ok: true };
	},
	applyEntity: (entityId: VenueEntityId) => {
		if (isDevDemoClient() && entityId === "food_hall") {
			return get().loadLaundryTestVenue();
		}
		const ent = venueById(entityId);
		if (!ent) return { ok: false, error: "Unknown venue" };
		const staff = employeesForVenue(entityId);
		set({
			activeEntityId: entityId,
			employees: staff,
			currentEmployeeId: null,
			activeOrderId: null,
			activeTableId: null,
			orders: [],
			tickets: [],
			view: ent.defaultView,
			settings: {
				...get().settings,
				name: ent.venueName,
				address: ent.address,
				multiTenantHallMode: entityId === "food_hall"
			}
		});
		try {
			useSaasStore.getState().setActiveLocation(ent.locationId);
		} catch {
			/* saas store may not be ready */
		}
		return { ok: true };
	},
	loginAsOwner: (name: string) => {
		const existing = get().employees.find((e) => e.role === "owner" && e.active);
		const owner = existing ?? {
			id: "emp_owner",
			name: name.trim() || "Owner",
			pin: "0000",
			role: "owner" as const,
			color: "#2C4A6E",
			clockedIn: true,
			clockInAt: Date.now(),
			tipsEarned: 0,
			salesTotal: 0,
			active: true,
			homeSectionIds: [] as string[],
		};
		const employees = existing
			? get().employees.map((e) =>
					e.id === existing.id ? { ...e, name: owner.name, clockedIn: true } : e,
				)
			: [owner, ...get().employees];
		set({
			employees,
			currentEmployeeId: owner.id,
			view: "floor",
			activeOrderId: null,
			activeTableId: null,
			sessionKind: "backoffice",
			backOfficeUnlocked: true,
		});
		return { ok: true };
	},
	openTenantLocation: (opts) => {
		const { entityId, venueName, ownerName, locationId } = opts;
		const staff = opts.staff;
		const already = get().tenantLocationId === locationId && get().activeEntityId === entityId;
		if (already && (!staff || staff.role === "owner")) {
			return get().loginAsOwner(ownerName);
		}
		if (!already) {
			const slice = starterPosSlice({
				entityId,
				venueName,
				ownerName,
				locationId,
				menuMode: opts.menuMode,
				vendors: opts.vendors,
				tables: opts.tables,
				floorSections: opts.floorSections,
				settlement: opts.settlement,
				address: opts.address,
				hallMode: opts.hallMode,
			});
			set({
				...slice,
				entityPermissions: opts.entityPermissions ?? [],
				locationDevices: opts.locationDevices ?? [],
				activeDeviceId: null,
				auditLog: [],
				chargebacks: [],
				shift: emptyShift(),
				clock: Date.now(),
			});
		} else if (opts.entityPermissions || opts.locationDevices) {
			set({
				entityPermissions: opts.entityPermissions ?? get().entityPermissions,
				locationDevices: opts.locationDevices ?? get().locationDevices,
			});
		}
		try {
			useSaasStore.getState().setActiveLocation(locationId);
		} catch {
			/* ignore */
		}
		if (staff && staff.role !== "owner") {
			const existing = get().employees.find(
				(e) =>
					e.role === staff.role &&
					(staff.operatorId ? e.operatorId === staff.operatorId : !e.operatorId) &&
					e.active,
			);
			if (existing) {
				return get().loginAs(existing.id);
			}
			const created = get().createEmployee({
				name: staff.name || staff.role,
				role: staff.role,
				operatorId: staff.operatorId || undefined,
				title: staff.role === "vendor_operator" ? "Vendor operator" : undefined,
			});
			return get().loginAs(created.id);
		}
		return get().loginAsOwner(ownerName);
	},
	resetDemo: () => {
		const keepEmp = get().currentEmployeeId;
		const keepEntity = get().activeEntityId || "restaurant";
		if (isDevDemoClient() && keepEntity === "food_hall") {
			const res = get().loadLaundryTestVenue();
			if (keepEmp) set({ currentEmployeeId: keepEmp });
			return res;
		}
		set({
			...initialState(),
			activeEntityId: keepEntity,
			employees: employeesForVenue(keepEntity),
			currentEmployeeId: keepEmp
		});
	}
}), {
	name: "summex-pos-v7",
	storage: createJSONStorage(() => demoPersistStorage()),
	skipHydration: true,
	partialize: (s) => ({
		tenantLocationId: s.tenantLocationId,
		settings: s.settings,
		employees: s.employees,
		currentEmployeeId: s.currentEmployeeId,
		categories: s.categories,
		menuItems: s.menuItems,
		modifierGroups: s.modifierGroups,
		tables: s.tables,
		orders: s.orders,
		tickets: s.tickets,
		waitlist: s.waitlist,
		reservations: s.reservations,
		customers: s.customers,
		giftCards: s.giftCards,
		inventory: s.inventory,
		vendors: s.vendors,
		settlementConfig: s.settlementConfig,
		settlementPeriods: s.settlementPeriods,
		chargebacks: s.chargebacks,
		ledgerEntries: s.ledgerEntries ?? [],
		auditLog: s.auditLog,
		shift: s.shift,
		view: s.view,
		activeOrderId: s.activeOrderId,
		activeTableId: s.activeTableId,
		selectedCategoryId: s.selectedCategoryId,
		floorSections: s.floorSections,
		extraTableGrants: s.extraTableGrants,
		activeEntityId: s.activeEntityId,
		entityPermissions: s.entityPermissions ?? [],
		locationDevices: s.locationDevices ?? [],
		activeDeviceId: s.activeDeviceId ?? null,
		sessionKind: s.sessionKind ?? "pin",
		backOfficeUnlocked: s.backOfficeUnlocked ?? false,
	}),
	merge: (persisted, current) => {
		const p = persisted || {};
		const entityId = p.activeEntityId || current.activeEntityId || "restaurant";
		const fromPersist = p.employees || [];
		const tagged =
			fromPersist.length > 0 &&
			fromPersist.some((e) => e.entityId === entityId);
		const locKey = p.tenantLocationId || entityId || "loc";
		const employees = (tagged ? fromPersist : employeesForVenue(entityId)).map((e) => {
			const hashed =
				e.pinHash || (e.pin && /^\d{4}$/.test(e.pin) ? hashPin(e.pin, locKey) : e.pinHash);
			return {
				...e,
				pinHash: hashed,
				pin: e.pinHash ? "" : e.pin,
				homeSectionIds: e.homeSectionIds ?? defaultHomeSectionsForRole(e.role, e.id),
			};
		});
		const ent = venueById(entityId);
		const locationDevices =
			(p.locationDevices && p.locationDevices.length)
				? p.locationDevices
				: entityId === "food_hall"
					? laundryLocationDevices()
					: current.locationDevices ?? [];
		return {
			...current,
			...p,
			activeEntityId: entityId,
			entityPermissions: p.entityPermissions ?? current.entityPermissions ?? [],
			sessionKind: p.sessionKind ?? current.sessionKind ?? "pin",
			backOfficeUnlocked: p.backOfficeUnlocked ?? false,
			locationDevices,
			activeDeviceId: p.activeDeviceId ?? null,
			employees,
			settings: {
				...current.settings,
				...p.settings,
				sectionPolicy: { ...DEFAULT_SECTION_POLICY, ...(p.settings && p.settings.sectionPolicy) },
				voiceControlEnabledByRole: {
					...(p.settings && p.settings.voiceControlEnabledByRole),
				},
				...(ent
					? {
							name: ent.venueName,
							address: ent.address,
							multiTenantHallMode: entityId === "food_hall"
						}
					: { multiTenantHallMode: false })
			},
			floorSections: (p.floorSections && p.floorSections.length) ? p.floorSections : current.floorSections,
			extraTableGrants: p.extraTableGrants || current.extraTableGrants || [],
			chargebacks: p.chargebacks || current.chargebacks || [],
			sectionOverrides: {},
			giftCards: (p.giftCards || current.giftCards || []).map((g) => ({
				...g,
				source: g.source || "summex",
				status: g.status || (g.active === false ? "void" : g.balanceCents === 0 ? "zeroed" : "active"),
				originalBalanceCents: g.originalBalanceCents ?? g.balanceCents,
			})),
		};
	}
}));

export const usePosStore = usePosStoreRaw as unknown as UseBoundStore<
	StoreApi<PosStore>
> &
	PosStorePersist;

