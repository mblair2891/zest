// @ts-nocheck — store implementation recovered from production SSR bundle
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { homeViewForEmployee, homeViewForRole } from "./rbac";
import {
	deviceRoleFromSessionMode,
	parseStationQuery,
	viewForDeviceRole,
} from "./device-roles";
import { useStationSessionStore } from "./station-session";
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
	entriesForGiftBreakage,
	entriesForGiftIssue,
	entriesForGiftRedeem,
	entriesForGiftRemit,
	entriesForOrderAllocations,
	entriesForPayment,
	entriesForPeriodClose,
	mergeLedger,
} from "./ledger";
import { useOpsStore } from "./ops-store";
import { captureIsSandbox } from "@/lib/lifecycle/store";
import { isDevDemoClient } from "@/lib/saas/flags";
import { partnerLaundryPosSlice } from "./laundry-seed";
import { isPartnerDemoLocationId } from "@/lib/demo/partner-demo";
import { demoPersistStorage } from "@/lib/demo/session";
import { demoPosSlice, demoSaasOrg } from "@/lib/demo/pos-payloads";
import {
	groupMembers,
	groupRootId,
	lowestGroupLabel,
	nativeSeats,
	pickLowestPrimary,
	displayLabel,
} from "./table-groups";
import {
	canMutateCheck,
	cloneMovedLine,
	openLines,
	partitionBySeat,
	roundRobin,
} from "./check-ops";
import { applyCashTender, currentCashSink, useCashSessionStore } from "./cash-session";
import { hasCompletedCloseoutToday } from "./closeout-store";
import { cashRoleFromSession, parseCashHandling } from "./cash-handling";
import {
  cardRequiresConnection,
  noteCashPayment,
  noteWaitlistAdd,
} from "@/lib/offline/enqueue-pos";

function floorSync(kind: string, id?: string) {
	try {
		void import("./floor-sync").then((m) => m.persistAfterLocalMutation(kind, id)).catch(() => {});
	} catch {
		/* optional — POS still runs locally */
	}
}

function printNow(kind: "send" | "bump" | "ready" | "receipt", id?: string) {
	try {
		void import("@/lib/print/from-store").then((m) => m.printFromPos(kind, id)).catch(() => {});
	} catch {
		/* printing is best-effort */
	}
}
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
  pinTakenByOther,
  staffMatchingPin,
  withHashedPin,
} from "./pin";
import {
  AUDIT_MAX_ENTRIES,
  canRoleApproveGate,
  discountAllowed,
  discountNeedsManager,
  isManagerRole,
  lineIsOnBumpedTicket,
  odsBlocksTender,
  parseLossPrevention,
  realTenderOnOrder,
  snapshotPayments,
  underVoidCompThreshold,
  voidNeedsManager,
  findLateCompCashEvents,
  isLateWindowComp,
  stackedCompCents,
  wouldFlagLateCompCashClose,
} from "./loss-prevention";
import {
  makeClaimCode,
  type LocationDevice,
} from "./location-devices";
import { laundryLocationDevices } from "./laundry-seed";

function mergeFloorStaff(get, set, floorStaff) {
	if (!Array.isArray(floorStaff) || floorStaff.length === 0) return;
	const loc = get().tenantLocationId || "loc";
	const byId = new Map(get().employees.map((e) => [e.id, e]));
	for (const e of floorStaff) {
		if (!e?.id) continue;
		const pin = String(e.pin ?? "").replace(/\D/g, "").slice(0, 4);
		byId.set(e.id, {
			...e,
			pin: "",
			pinHash: e.pinHash || (pin.length === 4 ? hashPin(pin, loc) : e.pinHash),
			clockedIn: Boolean(e.clockedIn),
			tipsEarned: e.tipsEarned ?? 0,
			salesTotal: e.salesTotal ?? 0,
			active: e.active !== false,
		});
	}
	set({ employees: [...byId.values()] });
}
import {
  DEFAULT_FLOOR_STATUS_CONFIG,
  deriveTableStatus,
  FLOOR_STATUS_LABEL,
  isEmptyTable,
  normalizeTableStatus,
  parseFloorStatusConfig,
  tableFlash,
} from "./floor-status";
import { makeTableQrToken, parseQrMode, qrTokenMatchesLocation } from "./qr-table";
import {
  parseQrPolicy,
  qrCanOpenCheck,
  qrCanPay,
  qrCanReorder,
  qrItemAllowed,
} from "./qr-policy";
import {
  buildNightlyIntegrityPack,
  CHECK_HOLD_LABEL,
  isCheckHoldKind,
} from "./check-integrity";
import { useNotifyStore } from "./notify-store";
import { isDemoStaffPin } from "@/lib/demo/pin";
import {
	defaultGiftIssuer,
	fulfillingIssuer,
	giftBreakageHouseShareCents,
	giftExpiresAt,
	houseIssuer,
	HOUSE_ISSUER_ID,
	isGiftExpired,
	resolveGiftIssuer,
} from "./gift-issuer";

function nextOrderNumber(orders) {
	return orders.reduce((m, o) => Math.max(m, o.number), 100) + 1;
}
function floorCfg() {
	return parseFloorStatusConfig(usePosStore.getState().settings?.floorStatusConfig ?? DEFAULT_FLOOR_STATUS_CONFIG);
}
function ensureGuestCashier(get, set) {
	if (get().employees.some((e) => e.id === "guest_qr")) return;
	set({
		employees: [
			...get().employees,
			{
				id: "guest_qr",
				name: "Guest QR",
				pin: "",
				role: "cashier",
				color: "#5C5C5C",
				clockedIn: false,
				tipsEarned: 0,
				salesTotal: 0,
				active: true,
			},
		],
	});
}
function tableStatusFromOrder(order) {
	if (!order) return "empty";
	if (order.status !== "open") return "closed_not_cleaned";
	const settings = usePosStore.getState().settings ?? SETTINGS;
	const cardBal = computeTotals(order, settings, { tender: "card" }).balanceCents;
	const cashBal = computeTotals(order, settings, { tender: "cash" }).balanceCents;
	if (order.payments.length > 0 && (cardBal <= 0 || cashBal <= 0)) return "closed_not_cleaned";
	const tickets = usePosStore.getState().tickets ?? [];
	return deriveTableStatus(order, tickets, floorCfg());
}
function stampStatus(t, status) {
	const next = normalizeTableStatus(status);
	if (normalizeTableStatus(t.status) === next) return t;
	return { ...t, status: next, statusSince: Date.now(), flashNotified: false };
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
		giftTransfers: [],
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
		stationPinFailures: 0,
		stationPinLocked: false,
		managerAuthUntil: null,
		managerAuthEmployeeId: null,
		managerAuthEmployeeName: null,
		managerAuthKind: null,
		managerAuthRole: null,
		acknowledgedExceptionIds: [],
		pendingApprovals: [],
	};
}

function currentDeviceRole(get) {
	try {
		const raw = typeof window !== "undefined"
			? new URLSearchParams(window.location.search).get("station")
			: null;
		const fromQuery = parseStationQuery(raw);
		if (fromQuery) return fromQuery;
		const kind = useStationSessionStore.getState().assignment?.kind;
		if (kind) return deviceRoleFromSessionMode(kind);
	} catch {
		/* optional */
	}
	return null;
}

function lpCfg(get) {
	return parseLossPrevention(get().settings?.lossPrevention);
}

function managerActor(get) {
	if (!get().hasManagerAuth()) return null;
	return {
		id: get().managerAuthEmployeeId || "mgr",
		name: get().managerAuthEmployeeName || "Manager",
	};
}

function notifyOnCall(get, body, approvalId) {
	const cfg = lpCfg(get);
	if (!cfg.remoteApprove) return;
	const phones = (cfg.onCallList || []).map((c) => c.phone).filter((p) => p && p.length >= 8);
	const loc = get().tenantLocationId || "";
	if (!phones.length) return;
	try {
		const host = typeof window !== "undefined" ? window.location.origin : "";
		const link = host ? ` Approve in POS Home (${host}/station).` : " Approve in POS Home.";
		void import("@/lib/pos/approval-api").then((m) =>
			m.notifyOnCallFn({
				data: {
					locationId: loc,
					phones,
					body: `${body}${link}`.slice(0, 480),
				},
			}).catch(() => undefined),
		);
	} catch { /* optional */ }
}

function gateMeta(approval, path) {
	if (!approval && !path) return {};
	return {
		requesterId: approval?.requesterId,
		requesterName: approval?.requesterName,
		overrideEmployeeId: approval?.approverId,
		overrideEmployeeName: approval?.approverName,
		after: path || (approval ? "approved" : undefined),
		approvalStatus: path === "break_glass" ? "break_glass" : approval ? "approved" : undefined,
	};
}

function optsSandbox(method, order, emp) {
	if (method !== "card" && method !== "room_charge") return false;
	try {
		return captureIsSandbox({
			operatorId: emp?.operatorId,
			vendorIds: (order?.lines ?? []).map((l) => l.vendorId).filter(Boolean),
		});
	} catch {
		return false;
	}
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
		if (get().stationPinLocked && !isDemoStaffPin(pin)) {
			return { ok: false, error: "This station is locked. Ask a manager to unlock.", locked: true };
		}
		if (!isDemoStaffPin(pin)) {
			const collisions = staffMatchingPin(get().employees, pin, loc).filter((e) => e.active);
			if (collisions.length > 1) {
				get().audit("pin_lockout", "Shared PIN blocked at login", { reason: "unique_pin" });
				return { ok: false, error: "This PIN is assigned to more than one person. A manager must set unique PINs." };
			}
		}
		let emp = isDemoStaffPin(pin)
			? (get().employees.find((e) => e.active && e.role === "owner")
				?? get().employees.find((e) => e.active && e.role === "manager")
				?? findStaffByPin(get().employees, pin, loc, deviceOp))
			: findStaffByPin(get().employees, pin, loc, deviceOp);
		if (!emp) {
			const fail = get().notePinFailure();
			return {
				ok: false,
				error: fail.error
					|| (deviceOp && deviceOp !== HOST_SCOPE
						? "PIN not valid on this assigned device"
						: "Invalid PIN"),
				locked: fail.locked,
			};
		}
		if (emp.pinLocked) {
			get().audit("pin_lockout", `${emp.name} PIN locked`, { overrideEmployeeId: emp.id, overrideEmployeeName: emp.name });
			return { ok: false, error: "PIN locked. Ask a manager to reset.", locked: true };
		}
		const hashed = hashPin(pin, loc);
		const employees = isDemoStaffPin(pin)
			? get().employees
			: get().employees.map((e) =>
				e.id === emp.id && !e.pinHash ? { ...e, pinHash: hashed, pin: "" } : e,
			);
		let view = isDemoStaffPin(pin) ? "hq" : homeViewForEmployee(emp);
		try {
			const raw = typeof window !== "undefined"
				? new URLSearchParams(window.location.search).get("station")
				: null;
			const stationRole = parseStationQuery(raw);
			if (stationRole) {
				view = viewForDeviceRole(stationRole);
			} else {
				const kind = useStationSessionStore.getState().assignment?.kind;
				if (kind) view = viewForDeviceRole(deviceRoleFromSessionMode(kind));
			}
		} catch {
			/* station role optional */
		}
		set({
			employees: employees.map((e) =>
				e.id === emp.id ? { ...e, pinFailedAttempts: 0 } : e,
			),
			currentEmployeeId: emp.id,
			view,
			activeOrderId: null,
			activeTableId: null,
			sessionKind: "pin",
			backOfficeUnlocked: false,
			stationPinFailures: 0,
			managerAuthUntil: null,
			managerAuthEmployeeId: null,
			managerAuthEmployeeName: null,
			managerAuthKind: null,
			managerAuthRole: null,
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
			managerAuthUntil: null,
			managerAuthEmployeeId: null,
			managerAuthEmployeeName: null,
			managerAuthKind: null,
			managerAuthRole: null,
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
		if (used || pinTakenByOther(get().employees, employeeId, pin, loc)) {
			return { ok: false, error: "PIN already in use at this location" };
		}
		set({
			employees: get().employees.map((e) =>
				e.id === employeeId
					? { ...withHashedPin(e, pin, loc), pinLocked: false, pinFailedAttempts: 0 }
					: e,
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
	verifyManagerPin: (pin) => get().authorizeManager(pin).ok,
	hasManagerAuth: () => {
		const until = get().managerAuthUntil;
		return typeof until === "number" && until > Date.now();
	},
	beginManagerSession: (who) => {
		const minutes = lpCfg(get).managerSessionMinutes;
		const kind = who.kind || (isManagerRole(who.role) ? "manager" : "shift_lead");
		set({
			managerAuthUntil: Date.now() + minutes * 60_000,
			managerAuthEmployeeId: who.id,
			managerAuthEmployeeName: who.name,
			managerAuthKind: kind,
			managerAuthRole: who.role || (kind === "manager" ? "manager" : null),
		});
	},
	canAuthorizeGate: (kind, amountCents) => {
		if (!get().hasManagerAuth()) return false;
		if (get().managerAuthKind === "manager" || isManagerRole(get().managerAuthRole)) return true;
		return canRoleApproveGate(get().managerAuthRole, kind, amountCents || 0, lpCfg(get));
	},
	authorizeForGate: (pin, kind, amountCents) => {
		const loc = get().tenantLocationId || get().activeEntityId || "loc";
		const cfg = lpCfg(get);
		const emp = findStaffByPin(get().employees, pin, loc, null);
		if (emp?.pinLocked) {
			return { ok: false, error: "PIN locked. Ask a manager to reset.", locked: true };
		}
		if (emp && emp.active && isManagerRole(emp.role)) {
			if (get().stationPinLocked) set({ stationPinLocked: false, stationPinFailures: 0 });
			get().beginManagerSession({ id: emp.id, name: emp.name, kind: "manager", role: emp.role });
			return { ok: true, employeeId: emp.id, employeeName: emp.name, path: "manager" };
		}
		if (emp && emp.active && canRoleApproveGate(emp.role, kind, amountCents || 0, cfg)) {
			get().beginManagerSession({ id: emp.id, name: emp.name, kind: "shift_lead", role: emp.role });
			return { ok: true, employeeId: emp.id, employeeName: emp.name, path: "shift_lead" };
		}
		if (pin && pin === get().settings.managerPin) {
			if (get().stationPinLocked) set({ stationPinLocked: false, stationPinFailures: 0 });
			get().beginManagerSession({ id: "mgr_pin", name: "Manager PIN", kind: "manager", role: "manager" });
			return { ok: true, employeeId: "mgr_pin", employeeName: "Manager PIN", path: "manager" };
		}
		if (emp && emp.active) {
			return { ok: false, error: "This PIN cannot approve that action or amount." };
		}
		const fail = get().notePinFailure();
		return { ok: false, error: fail.error || "Invalid PIN", locked: fail.locked };
	},
	authorizeManager: (pin) => {
		const loc = get().tenantLocationId || get().activeEntityId || "loc";
		if (get().stationPinLocked) {
			const locPin = get().settings.managerPin;
			const emp = findStaffByPin(get().employees, pin, loc, null);
			const ok =
				(emp && !emp.pinLocked && (emp.role === "manager" || emp.role === "owner")) ||
				(!!locPin && pin === locPin);
			if (!ok) return { ok: false, error: "This station is locked. Ask a manager to unlock.", locked: true };
		}
		const emp = findStaffByPin(get().employees, pin, loc, null);
		if (emp?.pinLocked) {
			return { ok: false, error: "PIN locked. Ask a manager to reset.", locked: true };
		}
		if (emp && emp.active && (emp.role === "manager" || emp.role === "owner")) {
			if (get().stationPinLocked) set({ stationPinLocked: false, stationPinFailures: 0 });
			get().beginManagerSession({ id: emp.id, name: emp.name, kind: "manager", role: emp.role });
			return { ok: true, employeeId: emp.id, employeeName: emp.name };
		}
		if (pin && pin === get().settings.managerPin) {
			if (get().stationPinLocked) set({ stationPinLocked: false, stationPinFailures: 0 });
			get().beginManagerSession({ id: "mgr_pin", name: "Manager PIN", kind: "manager", role: "manager" });
			return { ok: true, employeeId: "mgr_pin", employeeName: "Manager PIN" };
		}
		const fail = get().notePinFailure();
		return { ok: false, error: fail.error || "Invalid manager PIN", locked: fail.locked };
	},
	notePinFailure: () => {
		const cfg = lpCfg(get);
		const next = (get().stationPinFailures || 0) + 1;
		if (next >= cfg.pinLockoutAttempts) {
			set({ stationPinFailures: next, stationPinLocked: true });
			get().audit("pin_lockout", `Station locked after ${next} failed PIN attempts`);
			return { ok: false, error: "This station is locked. Ask a manager to unlock.", locked: true };
		}
		set({ stationPinFailures: next });
		return { ok: false, error: "Invalid PIN" };
	},
	unlockStationPin: () => {
		set({ stationPinFailures: 0, stationPinLocked: false });
		get().audit("manager_override", "Station PIN pad unlocked");
	},
	resetStaffPinLock: (employeeId) => {
		const actor = get().getCurrentEmployee();
		if (!get().hasManagerAuth() && actor?.role !== "owner" && actor?.role !== "manager") {
			return { ok: false, error: "Manager PIN required" };
		}
		const target = get().employees.find((e) => e.id === employeeId);
		if (!target) return { ok: false, error: "Unknown employee" };
		set({
			employees: get().employees.map((e) =>
				e.id === employeeId ? { ...e, pinLocked: false, pinFailedAttempts: 0 } : e,
			),
		});
		get().audit("pin_unlock", `PIN unlocked for ${target.name}`, {
			overrideEmployeeId: target.id,
			overrideEmployeeName: target.name,
		});
		return { ok: true };
	},
	acknowledgeException: (id) => {
		if (!id) return;
		const ids = get().acknowledgedExceptionIds ?? [];
		if (ids.includes(id)) return;
		set({ acknowledgedExceptionIds: [id, ...ids].slice(0, 500) });
		get().audit("manager_override", `Exception acknowledged ${id}`);
	},
	breakGlass: (pin, reason) => {
		const cfg = lpCfg(get);
		if (!cfg.breakGlass) return { ok: false, error: "Break-glass is off." };
		if (!String(reason || "").trim()) return { ok: false, error: "Pick a reason" };
		const loc = get().tenantLocationId || get().activeEntityId || "loc";
		const emp = findStaffByPin(get().employees, pin, loc, null);
		if (!emp || !emp.active) {
			const fail = get().notePinFailure();
			return { ok: false, error: fail.error || "Invalid PIN", locked: fail.locked };
		}
		if (!emp.clockedIn) return { ok: false, error: "Break-glass is only for clocked-in staff." };
		if (emp.pinLocked) return { ok: false, error: "PIN locked. Ask a manager to reset.", locked: true };
		get().audit("break_glass", reason, {
			reason,
			after: "break_glass",
			approvalStatus: "break_glass",
			requesterId: emp.id,
			requesterName: emp.name,
		});
		try {
			useNotifyStore.getState().pushNotice({
				kind: "break_glass",
				title: "Break-glass used",
				body: `${emp.name} · ${reason}`,
				serverId: emp.id,
				serverName: emp.name,
			});
		} catch { /* */ }
		notifyOnCall(get, `Break-glass: ${emp.name} · ${reason}`);
		return { ok: true, employeeId: emp.id, employeeName: emp.name, path: "break_glass" };
	},
	requestApproval: (input) => {
		const cfg = lpCfg(get);
		if (!cfg.pendingApproval) return { ok: false, error: "Pending approval is off. A manager or shift lead must authorize now." };
		const emp = get().getCurrentEmployee();
		if (!emp) return { ok: false, error: "Sign in first" };
		if (!String(input.reason || "").trim()) return { ok: false, error: "Pick a reason" };
		const id = uid("appr");
		const row = {
			id,
			at: Date.now(),
			kind: input.kind,
			status: "pending",
			requesterId: emp.id,
			requesterName: emp.name,
			orderId: input.orderId,
			orderNumber: input.orderNumber,
			lineId: input.lineId,
			ticketId: input.ticketId,
			amountCents: input.amountCents || 0,
			reason: input.reason,
			lineWasSent: input.lineWasSent,
			ticketFired: input.ticketFired,
			payload: input.payload || {},
			notify: cfg.onCallList.map((c) => c.employeeId),
		};
		set({ pendingApprovals: [row, ...(get().pendingApprovals ?? [])].slice(0, 200) });
		if (input.lineId && input.orderId && (input.kind === "void" || input.kind === "comp")) {
			set({
				orders: get().orders.map((o) => o.id !== input.orderId ? o : {
					...o,
					lines: o.lines.map((l) => l.id === input.lineId
						? { ...l, pendingAction: input.kind, note: `Pending ${input.kind}` }
						: l),
				}),
			});
		}
		get().audit("approval_pending", input.reason, {
			orderId: input.orderId,
			orderNumber: input.orderNumber,
			ticketId: input.ticketId,
			amountCents: input.amountCents,
			reason: input.reason,
			after: "pending",
			approvalStatus: "pending",
			requesterId: emp.id,
			requesterName: emp.name,
		});
		try {
			useNotifyStore.getState().pushNotice({
				kind: "approval_request",
				title: `Approval · ${input.kind.replace("_", " ")}`,
				body: `${emp.name} · #${input.orderNumber ?? "—"} · ${input.reason}`,
				serverId: emp.id,
				serverName: emp.name,
			});
		} catch { /* */ }
		notifyOnCall(
			get,
			`Summex approval: ${input.kind} $${((input.amountCents || 0) / 100).toFixed(2)} #${input.orderNumber ?? "?"} from ${emp.name}. ${input.reason}`,
			id,
		);
		return { ok: true, pendingId: id };
	},
	resolveApproval: (id, decision, opts) => {
		const row = (get().pendingApprovals ?? []).find((p) => p.id === id);
		if (!row || row.status !== "pending") return { ok: false, error: "Request not found" };
		const cfg = lpCfg(get);
		const actor = get().getCurrentEmployee();
		const remote = Boolean(opts?.remote);
		if (decision === "approved") {
			if (!get().canAuthorizeGate(row.kind, row.amountCents) && !isManagerRole(actor?.role) && !get().hasManagerAuth()) {
				return { ok: false, error: "Manager or shift lead PIN required to approve." };
			}
		} else if (!get().hasManagerAuth() && !isManagerRole(actor?.role) && !get().canAuthorizeGate(row.kind, row.amountCents)) {
			return { ok: false, error: "Manager or shift lead PIN required to deny." };
		}
		const approverId = get().managerAuthEmployeeId || actor?.id || "mgr";
		const approverName = get().managerAuthEmployeeName || actor?.name || "Manager";
		set({
			pendingApprovals: (get().pendingApprovals ?? []).map((p) =>
				p.id === id
					? {
						...p,
						status: decision,
						approverId,
						approverName,
						resolvedAt: Date.now(),
						channel: remote ? "remote" : "floor",
					}
					: p,
			),
		});
		if (decision === "denied") {
			if (row.lineId && row.orderId) {
				set({
					orders: get().orders.map((o) => o.id !== row.orderId ? o : {
						...o,
						lines: o.lines.map((l) => l.id === row.lineId ? { ...l, pendingAction: undefined } : l),
					}),
				});
			}
			if (cfg.pendingRejectPolicy === "auto_void" && row.ticketFired && row.lineId) {
				set({
					tickets: get().tickets.map((t) =>
						t.items.some((i) => i.lineId === row.lineId) && t.status !== "bumped" && t.status !== "voided"
							? { ...t, status: "voided" }
							: t,
					),
				});
			}
			get().audit(row.kind, row.reason, {
				orderId: row.orderId,
				orderNumber: row.orderNumber,
				ticketId: row.ticketId,
				amountCents: row.amountCents,
				reason: row.reason,
				after: "denied",
				approvalStatus: "denied",
				requesterId: row.requesterId,
				requesterName: row.requesterName,
				overrideEmployeeId: approverId,
				overrideEmployeeName: approverName,
			});
			return { ok: true };
		}
		const prevEmp = get().currentEmployeeId;
		const apply = () => {
			if (row.kind === "void" && row.lineId) {
				if (row.orderId) set({ activeOrderId: row.orderId });
				return get().voidLine(row.lineId, row.reason, { skipGate: true, approval: row });
			}
			if (row.kind === "comp" && row.lineId) {
				if (row.orderId) set({ activeOrderId: row.orderId });
				return get().compLine(row.lineId, row.reason, { skipGate: true, approval: row });
			}
			if (row.kind === "discount" && row.orderId) {
				set({ activeOrderId: row.orderId });
				return get().applyDiscount({
					percent: row.payload.percent,
					cents: row.payload.cents,
					reason: row.reason,
					promoCode: row.payload.promoCode,
					skipGate: true,
					approval: row,
				});
			}
			if (row.kind === "reopen" && row.orderId) {
				return get().reopenCheck(row.orderId, row.reason, { skipGate: true, approval: row });
			}
			if (row.kind === "tender_swap" && row.orderId && row.payload.paymentId) {
				return get().swapTender({
					orderId: row.orderId,
					paymentId: row.payload.paymentId,
					method: row.payload.method || "cash",
					reason: row.reason,
					skipGate: true,
					approval: row,
				});
			}
			if (row.kind === "gift_adjust" && row.payload.giftCode) {
				if (row.payload.giftStatus) {
					return get().setGiftCardStatus(row.payload.giftCode, row.payload.giftStatus, { skipGate: true, approval: row });
				}
				return get().adjustGiftBalance({
					code: row.payload.giftCode,
					deltaCents: row.payload.deltaCents || 0,
					reason: row.reason,
					skipGate: true,
					approval: row,
				});
			}
			if (row.kind === "no_sale") {
				const drawerId = row.payload.drawerId;
				try {
					const cashCfg = parseCashHandling(get().settings.cashHandling);
					const drawer = cashCfg.drawers.find((d) => d.id === drawerId);
					useCashSessionStore.getState().logNoSale({
						employeeId: row.requesterId,
						employeeName: row.requesterName,
						drawerId,
						reason: row.reason,
					});
					if (drawer) {
						void import("@/lib/print/dispatch").then((m) =>
							m.kickCashDrawer({
								locationId: get().tenantLocationId || "",
								devices: get().locationDevices,
								printerId: drawer.kickPrinterId,
							}),
						);
					}
				} catch { /* */ }
				get().audit("no_sale", row.reason, {
					reason: row.reason,
					after: "approved",
					approvalStatus: "approved",
					requesterId: row.requesterId,
					requesterName: row.requesterName,
					overrideEmployeeId: approverId,
					overrideEmployeeName: approverName,
					amountCents: 0,
				});
				return { ok: true };
			}
			return { ok: true };
		};
		const res = apply();
		if (prevEmp) set({ currentEmployeeId: prevEmp });
		return res || { ok: true };
	},
	clockToggle: (employeeId) => {
		const emp = get().employees.find((e) => e.id === employeeId);
		const clockingOut = !!emp?.clockedIn;
		try {
			const cfg = parseCashHandling(get().settings.cashHandling);
			if (clockingOut && cfg.requireCountToClockOut && emp) {
				const missing = useCashSessionStore.getState().uncountedForEmployee(emp.id, cfg);
				if (missing.length) {
					return { ok: false, error: `Count ${missing.join(" and ")} before clock-out.` };
				}
			}
			if (
				clockingOut &&
				cfg.requireCloseoutBeforeClockOut &&
				emp &&
				(emp.role === "server" || emp.role === "bartender")
			) {
				if (!hasCompletedCloseoutToday(emp.id)) {
					return { ok: false, error: "Finish end-of-shift closeout before clock-out." };
				}
			}
			if (!clockingOut && emp && cfg.issueBank === "clock_in") {
				const model = cfg.roleOverride.order ?? cfg.defaultModel;
				if (model === "server_bank" || model === "well_plus_server_bank") {
					useCashSessionStore.getState().issueBank({
						employeeId: emp.id,
						employeeName: emp.name,
						startCents: cfg.serverBankStartingCents,
					});
				}
			}
		} catch { /* */ }
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
			const openMine = get().orders.filter((o) => o.status === "open" && o.serverId === employeeId && !o.holdKind);
			if (openMine.length) {
				get().audit("clockout_open_checks", `${emp?.name ?? employeeId} clocked out with ${openMine.length} open check(s)`, {
					after: openMine.map((o) => `#${o.number}`).join(", "),
				});
			}
			set({
				extraTableGrants: get().extraTableGrants.filter((g) => !(g.employeeId === employeeId && g.scope === "shift")),
				sectionOverrides: { ...get().sectionOverrides, [employeeId]: [] }
			});
		}
		const loc = get().tenantLocationId;
		if (loc) {
			void import("@/lib/pos/network-store").then((m) => {
				m.enqueueMutation(
					"clock_punch",
					clockingOut ? "Clock out" : "Clock in",
					emp?.name ?? employeeId,
					{ employeeId, clockingOut, at: Date.now() },
				);
			});
		}
	},
	tick: () => {
		const now = Date.now();
		const cfg = floorCfg();
		const tables = get().tables.map((t) => {
			if (t.flashNotified) return t;
			if (!tableFlash(t, cfg, now)) return t;
			try {
				const st = normalizeTableStatus(t.status);
				useNotifyStore.getState().pushNotice({
					kind: "sla_alert",
					title: `SLA · Table ${t.label}`,
					body: `${st === "reserved" ? "Reserved" : FLOOR_STATUS_LABEL[st]} over the flash threshold`,
					tableLabel: t.label,
				});
			} catch {
				/* notify optional */
			}
			return { ...t, flashNotified: true };
		});
		set({
			clock: now,
			tables,
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
	audit: (action, detail, meta) => {
		const emp = get().getCurrentEmployee();
		const mgr = managerActor(get);
		const role = currentDeviceRole(get);
		const entry = {
			id: uid("aud"),
			at: Date.now(),
			employeeId: emp?.id ?? "system",
			employeeName: emp?.name ?? "System",
			action,
			detail: String(detail ?? ""),
			overrideEmployeeId: meta?.overrideEmployeeId ?? (mgr && mgr.id !== emp?.id ? mgr.id : undefined),
			overrideEmployeeName: meta?.overrideEmployeeName ?? (mgr && mgr.id !== emp?.id ? mgr.name : undefined),
			deviceId: meta?.deviceId ?? get().activeDeviceId ?? undefined,
			deviceRole: meta?.deviceRole ?? role ?? undefined,
			entityId: meta?.entityId ?? get().activeEntityId,
			ticketId: meta?.ticketId,
			orderId: meta?.orderId,
			orderNumber: meta?.orderNumber,
			amountCents: meta?.amountCents,
			reason: meta?.reason,
			before: meta?.before,
			after: meta?.after,
			requesterId: meta?.requesterId,
			requesterName: meta?.requesterName,
			approvalStatus: meta?.approvalStatus,
		};
		set({ auditLog: [entry, ...get().auditLog].slice(0, AUDIT_MAX_ENTRIES) });
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
	seatTable: (tableId, guestCount, opts) => {
		const emp = get().getCurrentEmployee();
		if (!emp) return { ok: false, error: "Not signed in" };
		const table = get().tables.find((t) => t.id === tableId);
		if (!table || !isEmptyTable(table.status)) return { ok: false, error: "Table not available" };
		const access = checkTableAccess(get, table, "seat");
		if (!access.ok) return { ok: false, error: access.reason, access };
		const canAssign = emp.role === "owner" || emp.role === "manager" || emp.role === "host";
		const assigned = opts?.serverId && canAssign
			? get().employees.find((e) => e.id === opts.serverId && e.active)
			: null;
		const owner = assigned ?? emp;
		const order = {
			id: uid("ord"),
			number: nextOrderNumber(get().orders),
			type: "dine_in",
			tableId,
			guestCount,
			serverId: owner.id,
			serverName: owner.name,
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
				status: "sat_no_order",
				statusSince: Date.now(),
				orderId: order.id,
				serverId: owner.id,
				guestCount,
				seatedAt: Date.now(),
				releasedAt: void 0,
				releasedById: void 0,
				releasedByName: void 0,
			} : t),
			activeOrderId: order.id,
			activeTableId: tableId,
			view: emp.role === "host" ? "floor" : "order",
			shift: {
				...get().shift,
				guestCount: get().shift.guestCount + guestCount
			}
		});
		get().audit(
			"seat",
			`Table ${table.label} · ${guestCount} guests · ${owner.name}${assigned ? " (host assigned)" : ""}`,
		);
		floorSync("check", order.id);
		floorSync("table", tableId);
		return { ok: true };
	},
	releaseTable: (tableId, opts) => {
		const emp = get().getCurrentEmployee();
		if (!emp) return { ok: false, error: "Not signed in" };
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return { ok: false, error: "Not found" };
		if (!table.orderId) return { ok: false, error: "No open check" };
		let order = get().orders.find((o) => o.id === table.orderId);
		if (!order || order.status !== "open") return { ok: false, error: "No open check" };
		if (!order.serverId) {
			set({
				orders: get().orders.map((o) => o.id === order.id ? { ...o, serverId: emp.id, serverName: emp.name } : o),
			});
			order = { ...order, serverId: emp.id, serverName: emp.name };
		}
		const isMgr = emp.role === "owner" || emp.role === "manager" || emp.role === "host";
		if (!isMgr && table.serverId && table.serverId !== emp.id && order.serverId !== emp.id) {
			return { ok: false, error: "Only the assigned server can transfer" };
		}
		if (!opts) return { ok: false, error: "Pick a server to accept, or a named hold. Checks cannot go unassigned." };
		if ("hold" in opts) {
			if (!isCheckHoldKind(opts.hold) || !String(opts.reason || "").trim()) {
				return { ok: false, error: "Named hold requires a reason." };
			}
			return get().holdCheck(order.id, opts.hold, opts.reason, { house: opts.house !== false, clearTable: true });
		}
		const target = get().employees.find((e) => e.id === opts.toEmployeeId && e.active);
		if (!target) return { ok: false, error: "Staff not found" };
		if (target.id === order.serverId) return { ok: false, error: "Already owned by that person" };
		set({
			tables: get().tables.map((t) => t.id === tableId ? {
				...t,
				releasedAt: Date.now(),
				releasedById: emp.id,
				releasedByName: emp.name,
				pendingAcceptId: target.id,
				pendingAcceptName: target.name,
			} : t),
			orders: get().orders.map((o) => o.id === order.id ? {
				...o,
				pendingAcceptId: target.id,
				pendingAcceptName: target.name,
			} : o),
		});
		get().audit("table_offer", `Table ${table.label} offered to ${target.name} by ${emp.name}`, {
			orderId: order.id,
			orderNumber: order.number,
			reason: `pending accept · ${target.name}`,
		});
		floorSync("table", tableId);
		floorSync("check", order.id);
		return { ok: true };
	},
	holdCheck: (orderId, hold, reason, opts) => {
		const emp = get().getCurrentEmployee();
		if (!emp) return { ok: false, error: "Not signed in" };
		if (!isCheckHoldKind(hold) || !String(reason || "").trim()) {
			return { ok: false, error: "Named hold requires a reason." };
		}
		let order = get().orders.find((o) => o.id === orderId);
		if (!order || order.status !== "open") return { ok: false, error: "No open check" };
		if (!order.serverId) {
			set({
				orders: get().orders.map((o) => o.id === order.id ? { ...o, serverId: emp.id, serverName: emp.name } : o),
			});
			order = { ...order, serverId: emp.id, serverName: emp.name };
		}
		const house = opts?.house !== false && hold !== "bar_tab";
		const tableId = order.tableId;
		set({
			orders: get().orders.map((o) => o.id !== order.id ? o : {
				...o,
				holdKind: hold,
				holdReason: reason,
				holdAt: Date.now(),
				holdById: emp.id,
				holdByName: emp.name,
				holdOwner: house ? "house" : "user",
				tableId: opts?.clearTable ? undefined : o.tableId,
				pendingAcceptId: undefined,
				pendingAcceptName: undefined,
			}),
			tables: opts?.clearTable && tableId
				? get().tables.map((t) => t.id === tableId || t.orderId === order.id ? {
					...t,
					orderId: t.orderId === order.id ? undefined : t.orderId,
					releasedAt: undefined,
					releasedById: undefined,
					releasedByName: undefined,
					pendingAcceptId: undefined,
					pendingAcceptName: undefined,
					status: t.id === tableId ? "closed_not_cleaned" : t.status,
					statusSince: Date.now(),
				} : t)
				: get().tables,
		});
		get().audit("table_hold", `${CHECK_HOLD_LABEL[hold]} · #${order.number} · ${reason}`, {
			orderId: order.id,
			orderNumber: order.number,
			reason,
			after: house ? "house" : order.serverName,
		});
		floorSync("check", order.id);
		if (tableId) floorSync("table", tableId);
		return { ok: true };
	},
	acceptTable: (tableId) => {
		const emp = get().getCurrentEmployee();
		if (!emp) return { ok: false, error: "Not signed in" };
		const canTake =
			emp.role === "server" ||
			emp.role === "bartender" ||
			emp.role === "owner" ||
			emp.role === "manager" ||
			emp.role === "host";
		if (!canTake) return { ok: false, error: "Only floor staff can accept a table" };
		const table = get().tables.find((t) => t.id === tableId);
		if (!table?.releasedAt) return { ok: false, error: "Table is not waiting for accept" };
		if (!table.orderId) return { ok: false, error: "No open check" };
		const lead = emp.role === "owner" || emp.role === "manager" || emp.role === "host";
		if (table.pendingAcceptId && table.pendingAcceptId !== emp.id && !lead) {
			return { ok: false, error: `Waiting for ${table.pendingAcceptName || "the named server"} to accept` };
		}
		const releasedBy = table.releasedByName ?? "unknown";
		set({
			tables: get().tables.map((t) => t.id === tableId ? {
				...t,
				serverId: emp.id,
				releasedAt: void 0,
				releasedById: void 0,
				releasedByName: void 0,
				pendingAcceptId: void 0,
				pendingAcceptName: void 0,
			} : t),
			orders: get().orders.map((o) => o.id === table.orderId ? {
				...o,
				serverId: emp.id,
				serverName: emp.name,
				pendingAcceptId: undefined,
				pendingAcceptName: undefined,
				holdKind: undefined,
				holdReason: undefined,
			} : o),
		});
		get().audit(
			"table_accept",
			`Table ${table.label} accepted by ${emp.name} (offered by ${releasedBy})`,
		);
		floorSync("table", tableId);
		if (table.orderId) floorSync("check", table.orderId);
		return { ok: true };
	},
	reassignTable: (tableId, serverId) => {
		const emp = get().getCurrentEmployee();
		if (!emp || (emp.role !== "owner" && emp.role !== "manager" && emp.role !== "host")) {
			return { ok: false, error: "Manager or host can reassign" };
		}
		const target = get().employees.find((e) => e.id === serverId && e.active);
		if (!target) return { ok: false, error: "Staff not found" };
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return { ok: false, error: "Not found" };
		set({
			tables: get().tables.map((t) => t.id === tableId ? {
				...t,
				serverId: target.id,
				releasedAt: void 0,
				releasedById: void 0,
				releasedByName: void 0,
			} : t),
			orders: table.orderId
				? get().orders.map((o) => o.id === table.orderId ? {
					...o,
					serverId: target.id,
					serverName: target.name,
				} : o)
				: get().orders,
		});
		get().audit("table_reassign", `Table ${table.label} → ${target.name} by ${emp.name}`);
		floorSync("table", tableId);
		if (table.orderId) floorSync("check", table.orderId);
		return { ok: true };
	},
	markClean: (tableId) => {
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return { ok: false, error: "Not found" };
		const open = get().orders.find((o) =>
			o.status === "open" && !o.holdKind && (o.id === table.orderId || o.tableId === tableId),
		);
		if (open) {
			const cfg = lpCfg(get);
			const emp = get().getCurrentEmployee();
			const lead =
				emp &&
				(isManagerRole(emp.role) ||
					canRoleApproveGate(emp.role, "void", 0, cfg) ||
					get().hasManagerAuth());
			if (cfg.integrityEmptyTable === "require_lead" && !lead) {
				return {
					ok: false,
					error: "Open check on this table. A shift lead or manager must empty it — the check will move to Left to close.",
				};
			}
			const held = get().holdCheck(open.id, "left_to_close", "Table marked empty", { house: true, clearTable: true });
			if (!held.ok) return held;
			set({
				tables: get().tables.map((t) => t.id === tableId ? {
					...t,
					status: "empty",
					statusSince: Date.now(),
					orderId: void 0,
					guestCount: void 0,
					seatedAt: void 0,
					releasedAt: void 0,
					releasedById: void 0,
					releasedByName: void 0,
					pendingAcceptId: void 0,
					pendingAcceptName: void 0,
				} : t),
			});
			get().audit("integrity_ack", `T${table.label} emptied · #${open.number} → left to close`, {
				orderId: open.id,
				orderNumber: open.number,
				reason: "Table marked empty",
			});
			floorSync("table", tableId);
			return { ok: true };
		}
		set({ tables: get().tables.map((t) => t.id === tableId ? {
			...t,
			status: "empty",
			statusSince: Date.now(),
			orderId: void 0,
			serverId: void 0,
			guestCount: void 0,
			seatedAt: void 0,
			releasedAt: void 0,
			releasedById: void 0,
			releasedByName: void 0,
			pendingAcceptId: void 0,
			pendingAcceptName: void 0,
		} : t) });
		floorSync("table", tableId);
		return { ok: true };
	},
	clearTable: (tableId) => {
		const childIds = get().tables.find((t) => t.id === tableId) ? get().tables.filter((t) => t.mergedIntoId === tableId).map((t) => t.id) : [];
		set({
			extraTableGrants: get().extraTableGrants.filter((g) => !(g.scope === "seating" && (g.tableId === tableId || childIds.includes(g.tableId)))),
			tables: get().tables.map((t) => {
				if (t.id === tableId || childIds.includes(t.id)) return {
					...t,
					status: "closed_not_cleaned",
					statusSince: Date.now(),
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
		floorSync("table", tableId);
	},
	transferTable: (fromId, toId) => {
		const from = get().tables.find((t) => t.id === fromId);
		const to = get().tables.find((t) => t.id === toId);
		if (!from?.orderId) return {
			ok: false,
			error: "Source has no check"
		};
		if (!to || !isEmptyTable(to.status)) return {
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
					status: "closed_not_cleaned",
					statusSince: Date.now(),
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
		try {
			const cfg = parseCashHandling(get().settings.cashHandling);
			if (cfg.cashFollowsOnTransfer === "accepting_server") {
				const order = get().orders.find((o) => o.id === orderId);
				const cash = (order?.payments ?? [])
					.filter((p) => p.method === "cash")
					.reduce((s, p) => s + p.amountCents + (p.tipCents || 0), 0);
				const fromEmp = from.serverId;
				const toEmp = get().currentEmployeeId;
				if (cash && fromEmp && toEmp && fromEmp !== toEmp) {
					const toStaff = get().employees.find((e) => e.id === toEmp);
					useCashSessionStore.getState().reattributeOrder({
						orderId,
						fromEmployeeId: fromEmp,
						toEmployeeId: toEmp,
						toName: toStaff?.name ?? "Server",
						amountCents: cash,
					});
				}
			}
		} catch { /* */ }
		return { ok: true };
	},
	mergeTables: (primaryId, childId) => get().combineTables([primaryId, childId]),
	combineTables: (tableIds) => {
		const emp = get().getCurrentEmployee();
		if (!emp) return { ok: false, error: "Not signed in" };
		const unique = [...new Set(tableIds.filter(Boolean))];
		if (unique.length < 2) return { ok: false, error: "Pick two or more tables" };
		const tables = get().tables;
		const roots = [...new Set(unique.map((id) => groupRootId(tables, id)))];
		const members = roots.flatMap((id) => groupMembers(tables, id));
		if (members.length < 2) return { ok: false, error: "Already one group" };
		const winner = pickLowestPrimary(members);
		const others = members.filter((t) => t.id !== winner.id);
		const seats = members.reduce((s, t) => s + nativeSeats(t), 0);
		const label = lowestGroupLabel(members);
		const status = members.find((t) => t.orderId)?.status ?? winner.status;
		const guestCount =
			(members.reduce((s, t) => s + (t.guestCount ?? 0), 0) || winner.guestCount);
		const serverId = winner.serverId ?? members.find((t) => t.serverId)?.serverId;
		const orderIds = [...new Set(members.map((t) => t.orderId).filter(Boolean))];
		let keepOrderId = winner.orderId ?? orderIds[0];
		let orders = get().orders;
		if (orderIds.length > 1 && keepOrderId) {
			const keep = orders.find((o) => o.id === keepOrderId);
			if (keep && keep.status === "open") {
				const extras = orderIds.filter((id) => id !== keepOrderId);
				for (const oid of extras) {
					const src = orders.find((o) => o.id === oid);
					if (!src || src.status !== "open") continue;
					const gate = canMutateCheck(emp, src);
					if (!gate.ok) return gate;
					orders = orders.map((o) => {
						if (o.id === keep.id) {
							return {
								...o,
								lines: [...o.lines, ...src.lines.map(cloneMovedLine)],
								guestCount: o.guestCount + src.guestCount,
								tableId: winner.id,
								mergedTableIds: [...new Set([...(o.mergedTableIds ?? []), ...(src.mergedTableIds ?? []), ...others.map((t) => t.id)])],
							};
						}
						if (o.id === src.id) {
							return { ...o, status: "cancelled", tableId: undefined, lines: [] };
						}
						return o;
					});
				}
				keepOrderId = keep.id;
			}
		} else if (keepOrderId) {
			orders = orders.map((o) => o.id === keepOrderId ? {
				...o,
				tableId: winner.id,
				guestCount: Math.max(o.guestCount, guestCount || o.guestCount),
				mergedTableIds: [...new Set([...(o.mergedTableIds ?? []), ...others.map((t) => t.id)])],
			} : o);
		}
		const now = Date.now();
		set({
			orders,
			tables: tables.map((t) => {
				if (t.id === winner.id) {
					return {
						...t,
						originalLabel: t.originalLabel ?? displayLabel(t),
						originalSeats: t.originalSeats ?? nativeSeats(t),
						label,
						seats,
						mergedIntoId: undefined,
						mergedChildIds: others.map((c) => c.id),
						orderId: keepOrderId,
						guestCount: guestCount || t.guestCount,
						serverId,
						status,
						statusSince: now,
					};
				}
				if (others.some((c) => c.id === t.id)) {
					return {
						...t,
						originalLabel: t.originalLabel ?? displayLabel(t),
						originalSeats: t.originalSeats ?? nativeSeats(t),
						mergedIntoId: winner.id,
						mergedChildIds: undefined,
						orderId: undefined,
						status,
						statusSince: now,
						serverId,
						guestCount: undefined,
					};
				}
				return t;
			}),
		});
		get().audit(
			"table_combine",
			`Group ${label} · ${members.map((m) => displayLabel(m)).join("+")} · ${seats} seats`,
		);
		if (keepOrderId) floorSync("check", keepOrderId);
		floorSync("table", winner.id);
		return { ok: true };
	},
	unmergeTable: (tableId) => {
		const tables = get().tables;
		const primaryId = groupRootId(tables, tableId);
		const primary = tables.find((t) => t.id === primaryId);
		if (!primary?.mergedChildIds?.length) return { ok: false, error: "Not a combined group" };
		const children = primary.mergedChildIds;
		const now = Date.now();
		set({
			tables: tables.map((t) => {
				if (t.id === primaryId) {
					return {
						...t,
						label: t.originalLabel ?? t.label,
						seats: t.originalSeats ?? t.seats,
						mergedChildIds: undefined,
						originalLabel: undefined,
						originalSeats: undefined,
					};
				}
				if (children.includes(t.id)) {
					return {
						...t,
						mergedIntoId: undefined,
						label: t.originalLabel ?? t.label,
						seats: t.originalSeats ?? t.seats,
						originalLabel: undefined,
						originalSeats: undefined,
						status: "empty",
						statusSince: now,
						orderId: undefined,
						serverId: undefined,
						guestCount: undefined,
						seatedAt: undefined,
					};
				}
				return t;
			}),
			orders: get().orders.map((o) => o.id === primary.orderId ? { ...o, mergedTableIds: undefined } : o),
		});
		get().audit("table_split", `Split group ${primary.label}`);
		if (primary.orderId) floorSync("check", primary.orderId);
		floorSync("table", primaryId);
		return { ok: true };
	},
	splitCheck: (orderId, spec) => {
		const emp = get().getCurrentEmployee();
		const order = get().orders.find((o) => o.id === orderId);
		if (!order || order.status !== "open") return { ok: false, error: "Open check not found" };
		const gate = canMutateCheck(emp, order);
		if (!gate.ok) return gate;
		const lines = openLines(order);
		const newOrders = [];
		let keepIds = new Set(lines.map((l) => l.id));
		const spawn = (moved, extra = {}) => {
			if (!moved.length && extra.dueOverrideCents == null) return;
			const neu = {
				id: uid("ord"),
				number: nextOrderNumber([...get().orders, ...newOrders]),
				type: order.type,
				tableId: order.tableId,
				tabName: order.tabName,
				guestCount: Math.max(1, extra.guestCount ?? moved.length ?? 1),
				serverId: order.serverId,
				serverName: order.serverName,
				lines: moved.map(cloneMovedLine),
				payments: [],
				status: "open",
				discountPercent: 0,
				discountCents: 0,
				autoGratApplied: false,
				serviceChargeCents: 0,
				createdAt: Date.now(),
				splitFromId: order.id,
				mergedTableIds: order.mergedTableIds,
				...extra,
			};
			newOrders.push(neu);
			for (const l of moved) keepIds.delete(l.id);
		};
		if (spec.mode === "seat") {
			const parts = partitionBySeat(lines);
			const keys = [...parts.keys()].filter((k) => k !== "shared");
			if (keys.length < 1 && !parts.get("shared")?.length) return { ok: false, error: "No seated items to split" };
			const first = keys[0] ?? "shared";
			keepIds = new Set((parts.get(first) ?? []).map((l) => l.id));
			for (const k of keys.slice(1)) spawn(parts.get(k) ?? [], { guestCount: 1 });
		} else if (spec.mode === "items") {
			const ids = new Set(spec.lineIds ?? []);
			const moved = lines.filter((l) => ids.has(l.id));
			if (!moved.length) return { ok: false, error: "Select items to move to a new check" };
			spawn(moved);
		} else if (spec.mode === "even") {
			const piles = roundRobin(lines, spec.parts ?? 2);
			if (piles.filter((p) => p.length).length < 2) return { ok: false, error: "Need items on the check to split evenly" };
			keepIds = new Set((piles[0] ?? []).map((l) => l.id));
			for (const pile of piles.slice(1)) spawn(pile);
		} else if (spec.mode === "piles") {
			const assigned = spec.piles ?? [];
			if (assigned.length < 2) return { ok: false, error: "Make at least two piles" };
			keepIds = new Set(assigned[0] ?? []);
			for (const pile of assigned.slice(1)) {
				spawn(lines.filter((l) => pile.includes(l.id)));
			}
		} else if (spec.mode === "custom_amount") {
			const amounts = (spec.amountsCents ?? []).filter((n) => n > 0);
			if (amounts.length < 2) return { ok: false, error: "Enter at least two dollar amounts" };
			const totals = computeTotals(order, get().settings);
			const sum = amounts.reduce((s, n) => s + n, 0);
			if (Math.abs(sum - totals.balanceCents) > 2 && sum > totals.balanceCents) {
				return { ok: false, error: "Amounts exceed remaining balance" };
			}
			keepIds = new Set(lines.map((l) => l.id));
			set({
				orders: get().orders.map((o) => o.id === order.id ? { ...o, dueOverrideCents: amounts[0] } : o),
			});
			for (const amt of amounts.slice(1)) spawn([], { dueOverrideCents: amt, guestCount: 1 });
		}
		const keptLines = order.lines.filter((l) => l.voided || keepIds.has(l.id));
		set({
			orders: [
				...get().orders.map((o) => o.id === order.id ? { ...o, lines: keptLines } : o),
				...newOrders,
			],
		});
		get().audit(
			"check_split",
			`#${order.number} → ${1 + newOrders.length} checks (${spec.mode})`,
		);
		floorSync("check", order.id);
		for (const n of newOrders) floorSync("check", n.id);
		if (order.tableId) floorSync("table", order.tableId);
		return { ok: true, newOrderIds: newOrders.map((o) => o.id) };
	},
	combineChecks: (sourceId, targetId) => {
		if (sourceId === targetId) return { ok: false, error: "Pick two different checks" };
		const emp = get().getCurrentEmployee();
		const source = get().orders.find((o) => o.id === sourceId);
		const target = get().orders.find((o) => o.id === targetId);
		if (!source || !target) return { ok: false, error: "Check not found" };
		if (source.status !== "open" || target.status !== "open") return { ok: false, error: "Both checks must be open" };
		const g1 = canMutateCheck(emp, source);
		if (!g1.ok) return g1;
		const g2 = canMutateCheck(emp, target);
		if (!g2.ok) return g2;
		const destTable = target.tableId ?? source.tableId;
		set({
			orders: get().orders.map((o) => {
				if (o.id === target.id) {
					return {
						...o,
						lines: [...o.lines, ...source.lines.map(cloneMovedLine)],
						guestCount: o.guestCount + source.guestCount,
						tableId: destTable,
						dueOverrideCents: undefined,
						mergedTableIds: [...new Set([...(o.mergedTableIds ?? []), ...(source.mergedTableIds ?? [])])],
					};
				}
				if (o.id === source.id) {
					return { ...o, status: "cancelled", tableId: undefined, lines: [] };
				}
				return o;
			}),
			tables: get().tables.map((t) => {
				if (source.tableId && t.id === source.tableId && t.orderId === source.id) {
					return { ...t, orderId: destTable === t.id ? target.id : undefined };
				}
				if (destTable && t.id === destTable) {
					return { ...t, orderId: target.id };
				}
				return t;
			}),
			activeOrderId: target.id,
		});
		get().audit("check_combine", `#${source.number} into #${target.number}`);
		floorSync("check", target.id);
		floorSync("check", source.id);
		return { ok: true };
	},
	moveLines: (sourceId, targetId, lineIds, destTableId) => {
		const emp = get().getCurrentEmployee();
		const source = get().orders.find((o) => o.id === sourceId);
		if (!source || source.status !== "open") return { ok: false, error: "Source check not found" };
		const gate = canMutateCheck(emp, source);
		if (!gate.ok) return gate;
		const ids = new Set(lineIds);
		const moved = source.lines.filter((l) => ids.has(l.id) && !l.voided);
		if (!moved.length) return { ok: false, error: "Select items to move" };
		let target = get().orders.find((o) => o.id === targetId);
		let orders = get().orders;
		if (!target || target.status !== "open") {
			if (!destTableId && !source.tableId) return { ok: false, error: "Need a destination check or table" };
			const tableId = destTableId ?? source.tableId;
			target = {
				id: uid("ord"),
				number: nextOrderNumber(orders),
				type: source.type,
				tableId,
				tabName: source.tabName,
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
				createdAt: Date.now(),
				splitFromId: source.id,
			};
			orders = [...orders, target];
		} else {
			const g2 = canMutateCheck(emp, target);
			if (!g2.ok) return g2;
		}
		const destId = target.id;
		const destTable = destTableId ?? target.tableId ?? source.tableId;
		set({
			orders: orders.map((o) => {
				if (o.id === source.id) return { ...o, lines: o.lines.filter((l) => !ids.has(l.id) || l.voided) };
				if (o.id === destId) {
					return {
						...o,
						lines: [...o.lines, ...moved.map(cloneMovedLine)],
						tableId: destTable ?? o.tableId,
					};
				}
				return o;
			}),
			tables: get().tables.map((t) => {
				if (destTable && t.id === destTable) return { ...t, orderId: destId };
				return t;
			}),
			activeOrderId: destId,
		});
		get().audit("check_move_items", `${moved.length} item(s) #${source.number} → #${target.number}`);
		floorSync("check", source.id);
		floorSync("check", destId);
		return { ok: true };
	},
	moveCheck: (orderId, destTableId) => {
		const emp = get().getCurrentEmployee();
		const order = get().orders.find((o) => o.id === orderId);
		if (!order || order.status !== "open") return { ok: false, error: "Open check not found" };
		const gate = canMutateCheck(emp, order);
		if (!gate.ok) return gate;
		const dest = get().tables.find((t) => t.id === destTableId);
		if (!dest) return { ok: false, error: "Table not found" };
		if (dest.mergedIntoId) return { ok: false, error: "Drop on the combined group, not a hidden child" };
		if (dest.orderId && dest.orderId !== orderId) {
			return get().combineChecks(orderId, dest.orderId);
		}
		const fromId = order.tableId;
		if (fromId === destTableId) return { ok: true };
		const from = fromId ? get().tables.find((t) => t.id === fromId) : null;
		set({
			orders: get().orders.map((o) => o.id === orderId ? { ...o, tableId: destTableId } : o),
			tables: get().tables.map((t) => {
				if (from && t.id === from.id) {
					return {
						...t,
						orderId: undefined,
						status: "closed_not_cleaned",
						statusSince: Date.now(),
						guestCount: undefined,
						serverId: undefined,
						seatedAt: undefined,
					};
				}
				if (t.id === destTableId) {
					return {
						...t,
						orderId,
						status: from?.status ?? t.status,
						serverId: order.serverId,
						guestCount: order.guestCount,
						seatedAt: t.seatedAt ?? Date.now(),
						statusSince: Date.now(),
					};
				}
				return t;
			}),
		});
		get().audit("check_move", `#${order.number} → table ${dest.label}`);
		floorSync("check", orderId);
		if (fromId) floorSync("table", fromId);
		floorSync("table", destTableId);
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
		floorSync("check", order.id);
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
		floorSync("check", order.id);
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
		if (order.tableId && get().currentEmployeeId !== "guest_qr") {
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
			tables: order.tableId ? get().tables.map((t) => t.id === order.tableId ? stampStatus(t, tableStatusFromOrder(updated)) : t) : get().tables,
			menuItems: item.trackStock && item.stock != null ? get().menuItems.map((m) => m.id === item.id ? {
				...m,
				stock: Math.max(0, (m.stock ?? 0) - line.quantity)
			} : m) : get().menuItems
		});
		floorSync("lines", order.id);
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
		floorSync("lines", order.id);
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
		floorSync("lines", order.id);
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
		floorSync("lines", order.id);
	},
	voidLine: (lineId, reason, opts) => {
		const order = opts?.orderId
			? get().orders.find((o) => o.id === opts.orderId)
			: get().getActiveOrder();
		if (!order) return { ok: false, error: "No order" };
		if (order.status !== "open") return { ok: false, error: "Paid check is frozen. Reopen to change it." };
		const line = order.lines.find((l) => l.id === lineId);
		if (!line || line.voided) return { ok: false, error: "Nothing to void" };
		const cfg = lpCfg(get);
		const tickets = get().tickets;
		const bumped = lineIsOnBumpedTicket(lineId, tickets);
		const amt = lineUnitTotal(line) * line.quantity;
		const skip = Boolean(opts?.skipGate);
		const path = opts?.path;
		if (!skip && voidNeedsManager(line, tickets, cfg, amt) && !get().canAuthorizeGate("void", amt)) {
			if (path === "break_glass") {
				/* execute below */
			} else {
				return { ok: false, error: bumped ? "Void after bump needs a manager or shift lead." : "Void needs a manager, shift lead, or pending approval." };
			}
		}
		if (!String(reason || "").trim()) return { ok: false, error: "Pick a reason" };
		const nextTickets = bumped
			? tickets.map((t) =>
				t.items.some((i) => i.lineId === lineId) && t.status === "bumped"
					? { ...t, status: "voided" }
					: t,
			)
			: tickets;
		set({
			orders: get().orders.map((o) => o.id !== order.id ? o : {
				...o,
				lines: o.lines.map((l) => l.id === lineId ? {
					...l,
					voided: true,
					pendingAction: undefined,
					note: reason
				} : l)
			}),
			tickets: nextTickets,
			shift: {
				...get().shift,
				voidsCents: get().shift.voidsCents + amt
			}
		});
		get().audit("void", reason, {
			orderId: order.id,
			orderNumber: order.number,
			ticketId: tickets.find((t) => t.items.some((i) => i.lineId === lineId))?.id,
			amountCents: amt,
			reason,
			before: "open",
			after: path === "break_glass" ? "break_glass" : bumped ? "VOID" : "voided",
			...gateMeta(opts?.approval, path),
		});
		floorSync("lines", order.id);
		return { ok: true };
	},
	compLine: (lineId, reason, opts) => {
		const order = opts?.orderId
			? get().orders.find((o) => o.id === opts.orderId)
			: get().getActiveOrder();
		if (!order) return { ok: false, error: "No order" };
		if (order.status !== "open") return { ok: false, error: "Paid check is frozen. Reopen to change it." };
		const line = order.lines.find((l) => l.id === lineId);
		if (!line || line.voided || line.comped) return { ok: false, error: "Nothing to comp" };
		const cfg = lpCfg(get);
		const amt = lineUnitTotal(line) * line.quantity;
		const under = underVoidCompThreshold(!!line.sent, amt, cfg);
		const needsMgr = !under && (cfg.compAlwaysManager || (line.sent && cfg.voidAfterSend === "manager"));
		if (!opts?.skipGate && needsMgr && !get().canAuthorizeGate("comp", amt) && opts?.path !== "break_glass") {
			return { ok: false, error: "Comp needs a manager, shift lead, or pending approval." };
		}
		if (
			cfg.lateCompDualControl &&
			isLateWindowComp(order, amt, cfg) &&
			!opts?.skipGate &&
			opts?.path !== "break_glass" &&
			opts?.path !== "shift_lead" &&
			get().managerAuthKind !== "shift_lead"
		) {
			return {
				ok: false,
				error: "Late-window comp on a long-open check needs a shift lead or pending/remote approval — stand manager PIN is not enough.",
			};
		}
		if (!String(reason || "").trim()) return { ok: false, error: "Pick a reason" };
		const approver = get().managerAuthEmployeeName || opts?.approval?.approverName || get().getCurrentEmployee()?.name;
		const nextLines = order.lines.map((l) => l.id === lineId ? {
			...l,
			comped: true,
			pendingAction: undefined,
			note: reason
		} : l);
		const nextOrder = { ...order, lines: nextLines };
		const stacked = stackedCompCents(nextOrder);
		const late = isLateWindowComp(order, amt, cfg);
		const sentAt = Math.max(0, ...order.lines.map((l) => l.firedAt || (l.sent ? l.createdAt : 0)));
		const stale = sentAt > 0 && Date.now() - sentAt >= cfg.lateCompStaleSendHours * 3_600_000;
		set({
			orders: get().orders.map((o) => o.id !== order.id ? o : {
				...o,
				lines: nextLines,
				...(late || stale
					? {
						lateCompAt: Date.now(),
						lateCompCents: stacked,
						lateCompApprover: approver,
					}
					: {}),
			}),
			shift: {
				...get().shift,
				compsCents: get().shift.compsCents + amt
			}
		});
		get().audit("comp", reason, {
			orderId: order.id,
			orderNumber: order.number,
			amountCents: amt,
			reason,
			...gateMeta(opts?.approval, opts?.path),
		});
		floorSync("lines", order.id);
		return { ok: true };
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
		floorSync("lines", order.id);
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
				serverId: order.serverId,
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
			tables: order.tableId ? get().tables.map((t) => t.id === order.tableId ? stampStatus(t, tableStatusFromOrder(updated)) : t) : get().tables
		});
		get().audit("send", `Order #${order.number} · ${toSend.length} items`);
		floorSync("send", order.id);
		printNow("send", order.id);
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
	applyDiscount: ({ percent, cents, reason, promoCode, skipGate, approval, path }) => {
		const order = get().getActiveOrder();
		if (!order) return { ok: false, error: "No order" };
		if (order.status !== "open") return { ok: false, error: "Paid check is frozen. Reopen to change it." };
		const emp = get().getCurrentEmployee();
		const cfg = lpCfg(get);
		const merchEst = order.lines.filter((l) => !l.voided && !l.comped).reduce((s, l) => s + lineUnitTotal(l) * l.quantity, 0);
		const amtEst = Math.round((merchEst * ((percent ?? order.discountPercent) || 0)) / 100) + ((cents ?? order.discountCents) || 0);
		const mgr = skipGate || path === "break_glass" || get().canAuthorizeGate("discount", amtEst);
		if (discountNeedsManager(order, cfg) && !mgr) {
			return { ok: false, error: "Discount after send needs a manager, shift lead, or pending approval." };
		}
		if (!String(reason || "").trim()) return { ok: false, error: "Pick a reason" };
		const allowed = discountAllowed({
			order,
			percent,
			cents,
			role: emp?.role,
			cfg,
			managerOverride: mgr || Boolean(skipGate) || path === "break_glass",
		});
		if (!allowed.ok) return allowed;
		const merch = order.lines.filter((l) => !l.voided && !l.comped).reduce((s, l) => s + lineUnitTotal(l) * l.quantity, 0);
		const nextPct = percent ?? order.discountPercent;
		const nextCents = cents ?? order.discountCents;
		const amt = Math.round((merch * (nextPct || 0)) / 100) + (nextCents || 0);
		set({ orders: get().orders.map((o) => o.id !== order.id ? o : {
			...o,
			discountPercent: percent ?? o.discountPercent,
			discountCents: cents ?? o.discountCents,
			discountReason: reason,
			promoCode
		}) });
		get().audit("discount", reason, {
			orderId: order.id,
			orderNumber: order.number,
			amountCents: amt,
			reason,
			before: `${order.discountPercent || 0}% / ${order.discountCents || 0}`,
			after: path === "break_glass" ? "break_glass" : `${nextPct || 0}% / ${nextCents || 0}`,
			...gateMeta(approval, path),
		});
		return { ok: true };
	},
	reopenCheck: (orderId, reason, opts) => {
		const order = get().orders.find((o) => o.id === orderId);
		if (!order) return { ok: false, error: "Unknown check" };
		if (order.status === "open") return { ok: false, error: "Check is already open" };
		if (
			lpCfg(get).paidCheckReopen === "manager" &&
			!opts?.skipGate &&
			opts?.path !== "break_glass" &&
			!get().canAuthorizeGate("reopen", 0)
		) {
			return { ok: false, error: "Reopening a paid check needs a manager (or a granted shift lead)." };
		}
		if (!String(reason || "").trim()) return { ok: false, error: "Pick a reason" };
		const before = snapshotPayments(order);
		set({
			orders: get().orders.map((o) => o.id !== order.id ? o : {
				...o,
				status: "open",
				closedAt: undefined,
				reopenedAt: Date.now(),
				reopenReason: reason,
				reopenBefore: before,
			}),
			activeOrderId: order.id,
		});
		get().audit("reopen", reason, {
			orderId: order.id,
			orderNumber: order.number,
			reason,
			before,
			after: opts?.path === "break_glass" ? "break_glass" : "open",
			...gateMeta(opts?.approval, opts?.path),
		});
		return { ok: true };
	},
	swapTender: ({ orderId, paymentId, method, reason, last4, giftCardCode, skipGate, approval, path }) => {
		const order = get().orders.find((o) => o.id === orderId);
		if (!order) return { ok: false, error: "Unknown check" };
		if (
			lpCfg(get).paidCheckReopen === "manager" &&
			!skipGate &&
			path !== "break_glass" &&
			!get().canAuthorizeGate("tender_swap", 0)
		) {
			return { ok: false, error: "Tender change needs a manager (or a granted shift lead)." };
		}
		if (!String(reason || "").trim()) return { ok: false, error: "Pick a reason" };
		const pay = order.payments.find((p) => p.id === paymentId);
		if (!pay) return { ok: false, error: "Tender not found" };
		const before = snapshotPayments(order);
		const nextPay = {
			...pay,
			method,
			last4: last4 ?? pay.last4,
			giftCardCode: giftCardCode ?? pay.giftCardCode,
			processor: method === "card" || method === "room_charge" ? "quantum_payments" : undefined,
		};
		const payments = order.payments.map((p) => p.id === paymentId ? nextPay : p);
		set({
			orders: get().orders.map((o) => o.id !== order.id ? o : { ...o, payments, status: "open" }),
			activeOrderId: order.id,
		});
		get().audit("tender_change", reason, {
			orderId: order.id,
			orderNumber: order.number,
			amountCents: pay.amountCents,
			reason,
			before,
			after: path === "break_glass" ? "break_glass" : snapshotPayments({ ...order, payments }),
			...gateMeta(approval, path),
		});
		return { ok: true };
	},
	adjustGiftBalance: ({ code, deltaCents, reason, skipGate, approval, path }) => {
		if (
			lpCfg(get).giftAdjustManager &&
			!skipGate &&
			path !== "break_glass" &&
			!get().canAuthorizeGate("gift_adjust", Math.abs(deltaCents || 0))
		) {
			return { ok: false, error: "Gift balance adjust needs a manager (or a granted shift lead)." };
		}
		if (!String(reason || "").trim()) return { ok: false, error: "Pick a reason" };
		const needle = (code || "").replace(/[\s-]/g, "").toUpperCase();
		const gc = get().giftCards.find((g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle);
		if (!gc) return { ok: false, error: "Only issued or imported cards can be adjusted" };
		const emp = get().getCurrentEmployee();
		const before = gc.balanceCents;
		const after = Math.max(0, before + deltaCents);
		const entry = {
			at: Date.now(),
			kind: "adjust",
			amountCents: deltaCents,
			employeeId: emp?.id,
			employeeName: emp?.name,
			reason,
			beforeCents: before,
			afterCents: after,
		};
		set({
			giftCards: get().giftCards.map((g) => g.id === gc.id ? {
				...g,
				balanceCents: after,
				ledger: [...(g.ledger ?? []), entry],
			} : g),
		});
		get().audit("gift_adjust", reason, {
			amountCents: deltaCents,
			reason,
			before: String(before),
			after: path === "break_glass" ? "break_glass" : String(after),
			...gateMeta(approval, path),
		});
		return { ok: true };
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
				status: "food_completed",
				statusSince: Date.now(),
			} : t) : get().tables
		});
		floorSync("check", order.id);
		if (order.tableId) floorSync("table", order.tableId);
		printNow("receipt", order.id);
	},
	takePayment: ({ method, amountCents, tipCents = 0, tenderedCents, last4, giftCardCode, houseAccountId, serverGift, keepOpen }) => {
		const order = get().getActiveOrder();
		const emp = get().getCurrentEmployee();
		if (!order || !emp) return {
			ok: false,
			error: "No order"
		};
		if (order.status !== "open") return {
			ok: false,
			error: "Paid check is frozen. Reopen to change tenders."
		};
		const deviceRole = currentDeviceRole(get);
		if (odsBlocksTender(deviceRole, method)) {
			return { ok: false, error: "ODS cannot tender cash or gift. Use an order or host station." };
		}
		if ((method === "card" || method === "room_charge") && cardRequiresConnection()) {
			return { ok: false, error: "Card requires connection" };
		}
		let changeCents = 0;
		if (method === "cash") {
			const lp = lpCfg(get);
			if (lp.lateCompBlockCash) {
				const hit = wouldFlagLateCompCashClose(order, get().auditLog, lp, Date.now());
				if (hit) {
					return {
						ok: false,
						error: "Cash close after a late-window comp is blocked for review. Use another tender or ask a manager.",
					};
				}
			}
			const tendered = tenderedCents ?? amountCents + tipCents;
			if (tendered < amountCents + tipCents) return {
				ok: false,
				error: "Insufficient tender"
			};
			changeCents = tendered - amountCents - tipCents;
		}
		let giftRedeemLed = [];
		let giftRedeemTransfers = [];
		if (method === "gift_card" && !serverGift) {
			if (!giftCardCode) return {
				ok: false,
				error: "Enter gift card code"
			};
			const needle = giftCardCode.replace(/[\s-]/g, "").toUpperCase();
			const gc = get().giftCards.find((g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle && g.active);
			if (!gc) return {
				ok: false,
				error: "Unknown gift card — only issued or imported cards"
			};
			if (gc.status === "frozen") return { ok: false, error: "Card is frozen" };
			if (gc.status === "void") return { ok: false, error: "Card is void" };
			const need = amountCents + tipCents;
			if (gc.balanceCents < need) return {
				ok: false,
				error: `Balance only $${(gc.balanceCents / 100).toFixed(2)}`
			};
			const nextBal = gc.balanceCents - need;
			const redeemEntry = {
				at: Date.now(),
				kind: "redeem",
				amountCents: -need,
				employeeId: emp.id,
				employeeName: emp.name,
				beforeCents: gc.balanceCents,
				afterCents: nextBal,
			};
			set({ giftCards: get().giftCards.map((g) => g.id === gc.id ? {
				...g,
				balanceCents: nextBal,
				status: nextBal === 0 ? "zeroed" : g.status || "active",
				ledger: [...(g.ledger ?? []), redeemEntry],
			} : g) });
			const issuer = resolveGiftIssuer(gc.issuerId, get().settings, get().vendors);
			const fulfiller = fulfillingIssuer(emp, get().settings, get().vendors);
			giftRedeemLed = entriesForGiftRedeem({
				ids: {
					orgId: get().tenantLocationId ? `org:${get().tenantLocationId}` : "org_local",
					locationId: get().tenantLocationId || get().settlementConfig.locationId || "loc_local",
				},
				cardId: gc.id,
				code: gc.code,
				amountCents: need,
				issuerId: issuer.id,
				issuerKind: issuer.kind,
				orderId: order.id,
			});
			if (issuer.id !== fulfiller.id) {
				const trId = uid("gtr");
				giftRedeemTransfers = [{
					id: trId,
					at: Date.now(),
					giftCardId: gc.id,
					amountCents: need,
					fromId: issuer.id,
					fromName: issuer.name,
					toId: fulfiller.id,
					toName: fulfiller.name,
					reason: "redeem",
				}];
				giftRedeemLed = giftRedeemLed.concat(entriesForGiftRemit({
					ids: {
						orgId: get().tenantLocationId ? `org:${get().tenantLocationId}` : "org_local",
						locationId: get().tenantLocationId || get().settlementConfig.locationId || "loc_local",
					},
					transferId: trId,
					amountCents: need,
					fromId: issuer.id,
					fromKind: issuer.kind,
					toId: fulfiller.id,
					toKind: fulfiller.kind,
					reason: "redeem",
				}));
			}
		}
		let cashSinkKind;
		let cashDrawerId;
		if (method === "cash") {
			try {
				const cfg = parseCashHandling(get().settings.cashHandling);
				const sink = currentCashSink({
					cfg,
					emp,
					deviceRole: cashRoleFromSession(useStationSessionStore.getState().assignment.kind),
					deviceId: get().activeDeviceId,
					order,
				});
				if (sink.type === "drawer") {
					cashSinkKind = "drawer";
					cashDrawerId = sink.drawer.id;
				} else if (sink.type === "bank") {
					cashSinkKind = "server_bank";
				}
			} catch { /* */ }
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
			chargeBrand: get().settlementConfig.hostName || get().settings.name,
			sandbox: optsSandbox(method, order, emp),
			drawerId: cashDrawerId,
			cashSink: cashSinkKind,
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
		if (totals.balanceCents <= 0 && !keepOpen) {
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
					status: "closed_not_cleaned",
					statusSince: Date.now(),
				} : t);
				try {
					const tb = get().tables.find((x) => x.id === order.tableId);
					useNotifyStore.getState().pushNotice({
						kind: "table_needs_bus",
						title: `Bus · Table ${tb?.label ?? ""}`,
						body: "Check closed — table needs clean",
						tableLabel: tb?.label,
					});
				} catch { /* optional */ }
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
		led = led.concat(giftRedeemLed);
		set({
			orders: get().orders.map((o) => o.id === order.id ? updated : o),
			shift,
			employees,
			tables,
			ledgerEntries: mergeLedger(get().ledgerEntries ?? [], led),
			giftTransfers: giftRedeemTransfers.length
				? [...(get().giftTransfers ?? []), ...giftRedeemTransfers]
				: get().giftTransfers ?? [],
		});
		if (updated.status === "closed") try {
			useOpsStore.getState().recordTicketClosed(order.serverId, Date.now());
		} catch {}
		get().audit("payment", `#${order.number} ${method} $${(amountCents / 100).toFixed(2)}`, {
			orderId: order.id,
			orderNumber: order.number,
			amountCents: amountCents + tipCents,
			after: method === "cash"
				? `${emp.id} · ${cashSinkKind || "cash"} · ${cashDrawerId || "bank"} · ${payment.at}`
				: method,
		});
		if (updated.status === "closed" && method === "cash") {
			try {
				const lp = lpCfg(get);
				const evs = findLateCompCashEvents({
					orders: [updated],
					auditLog: get().auditLog,
					cfg: lp,
					from: updated.createdAt,
					to: Date.now() + 1,
				});
				const ev = evs[0];
				if (ev) {
					get().audit("late_comp_cash", `#${ev.orderNumber} ${ev.kind.replace(/_/g, " ")}`, {
						orderId: ev.orderId,
						orderNumber: ev.orderNumber,
						amountCents: ev.compCents,
						after: `${ev.tender} · ${ev.secondsCompToClose}s · dwell ${ev.dwellMinutes}m`,
						overrideEmployeeName: ev.approverName,
					});
					useNotifyStore.getState().pushNotice({
						kind: "late_comp_cash",
						title: "Late comp + cash close",
						body: `#${ev.orderNumber} · ${ev.employeeName} · dwell ${ev.dwellMinutes}m · ${ev.secondsCompToClose}s to cash`,
						serverId: ev.employeeId,
						serverName: ev.employeeName,
					});
				}
			} catch { /* */ }
		}
		if (method === "cash") {
			noteCashPayment({
				orderId: order.id,
				orderNumber: order.number,
				amountCents: amountCents + tipCents,
				paymentId: payment.id,
			});
			try {
				const cfg = parseCashHandling(get().settings.cashHandling);
				applyCashTender({
					cfg,
					emp,
					deviceRole: cashRoleFromSession(useStationSessionStore.getState().assignment.kind),
					deviceId: get().activeDeviceId,
					order,
					amountCents: amountCents + tipCents,
					locationId: get().tenantLocationId || "",
					devices: get().locationDevices,
				});
			} catch { /* cash session optional */ }
		}
		floorSync("payment", order.id);
		printNow("receipt", order.id);
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
		const tickets = get().tickets.map((t) => t.id === ticketId ? {
			...t,
			status: "bumped",
			bumpedAt: Date.now()
		} : t);
		set({ tickets });
		if (ticket?.orderId) {
			const order = get().orders.find((o) => o.id === ticket.orderId);
			if (order?.tableId) {
				const st = deriveTableStatus(order, tickets, floorCfg());
				set({
					tables: get().tables.map((tb) => tb.id === order.tableId ? stampStatus(tb, st) : tb),
				});
			}
		}
		floorSync("bump", ticketId);
		printNow("bump", ticketId);
	},
	recallTicket: (ticketId) => {
		set({ tickets: get().tickets.map((t) => t.id === ticketId ? {
			...t,
			status: "new",
			bumpedAt: void 0
		} : t) });
		floorSync("recall", ticketId);
	},
	startTicket: (ticketId) => {
		set({ tickets: get().tickets.map((t) => t.id === ticketId ? {
			...t,
			status: "in_progress",
			startedAt: t.startedAt ?? Date.now(),
		} : t) });
		floorSync("start", ticketId);
	},
	readyTicket: (ticketId) => {
		const ticket = get().tickets.find((t) => t.id === ticketId);
		const tickets = get().tickets.map((t) => t.id === ticketId ? {
			...t,
			status: "ready",
		} : t);
		set({ tickets });
		floorSync("ready", ticketId);
		printNow("ready", ticketId);
		if (ticket?.orderId) {
			const order = get().orders.find((o) => o.id === ticket.orderId);
			if (order?.tableId) {
				const st = deriveTableStatus(order, tickets, floorCfg());
				set({
					tables: get().tables.map((tb) => tb.id === order.tableId ? stampStatus(tb, st) : tb),
				});
			}
		}
	},
	deliverReadyTicketsForTable: (tableId) => {
		const order = get().orders.find((o) => o.tableId === tableId && o.status === "open")
			?? get().orders.find((o) => o.tableId === tableId);
		if (!order) return;
		const now = Date.now();
		const ready = get().tickets.filter((t) => t.orderId === order.id && t.status === "ready");
		if (!ready.length) return;
		const tickets = get().tickets.map((t) =>
			t.orderId === order.id && t.status === "ready"
				? { ...t, status: "bumped", bumpedAt: now }
				: t,
		);
		set({ tickets });
		if (order.tableId) {
			const st = deriveTableStatus(order, tickets, floorCfg());
			set({
				tables: get().tables.map((tb) => tb.id === order.tableId ? stampStatus(tb, st) : tb),
			});
		}
		for (const t of ready) {
			floorSync("bump", t.id);
		}
		floorSync("table", tableId);
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
	issueGiftCard: ({ amountCents, code, issuedToName, issuerId, tender }) => {
		if (amountCents <= 0) return {
			ok: false,
			error: "Amount required"
		};
		if (tender !== "cash" && tender !== "card") {
			return { ok: false, error: "Gift load needs a cash or card tender on the same ticket." };
		}
		if (odsBlocksTender(currentDeviceRole(get), tender === "cash" ? "cash" : "card")) {
			return { ok: false, error: "ODS cannot tender cash or gift." };
		}
		const emp = get().getCurrentEmployee();
		const settings = get().settings;
		const vendors = get().vendors;
		const issuer = issuerId
			? resolveGiftIssuer(issuerId, settings, vendors)
			: defaultGiftIssuer(emp, settings, vendors);
		if (lpCfg(get).giftLoadRequiresTender) {
			let order = get().getActiveOrder();
			const covered =
				order &&
				order.status === "open" &&
				realTenderOnOrder(order) &&
				order.payments
					.filter((p) => p.method === "cash" || p.method === "card")
					.reduce((s, p) => s + p.amountCents, 0) >= amountCents;
			if (!covered) {
				const id = get().openTakeout("Gift");
				order = get().orders.find((o) => o.id === id) ?? get().getActiveOrder();
				if (!order) return { ok: false, error: "Open a ticket to load gift with cash or card." };
				const loadLine = {
					id: uid("ln"),
					menuItemId: "gift_load",
					name: `Gift load · ${issuer.name}`,
					vendorId: issuer.kind === "operator" ? issuer.id : undefined,
					vendorName: issuer.name,
					quantity: 1,
					unitPriceCents: amountCents,
					modifiers: [],
					course: "other" as const,
					station: "expo" as const,
					sent: true,
					held: false,
					voided: false,
					comped: false,
					discountCents: 0,
					taxExempt: true,
					createdAt: Date.now(),
				};
				set({
					orders: get().orders.map((o) =>
						o.id === order!.id ? { ...o, lines: [...o.lines, loadLine] } : o,
					),
				});
				const pay = get().takePayment({
					method: tender,
					amountCents,
					tipCents: 0,
					tenderedCents: tender === "cash" ? amountCents : undefined,
				});
				if (!pay.ok) return pay;
			}
		}
		const c = (code || "").trim().toUpperCase() || `SUMMEX-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(Math.random() * 9e3 + 1e3)}`;
		if (get().giftCards.some((g) => g.code === c)) return {
			ok: false,
			error: "Code already exists"
		};
		const now = Date.now();
		const card = {
			id: uid("gc"),
			code: c,
			balanceCents: amountCents,
			originalBalanceCents: amountCents,
			active: true,
			status: "active",
			source: "summex",
			issuedAt: now,
			issuedToName,
			issuerKind: issuer.kind,
			issuerId: issuer.id,
			issuerName: issuer.name,
			soldByEmployeeId: emp?.id,
			soldByOperatorId: emp?.operatorId,
			expiresAt: giftExpiresAt(now, settings),
			ledger: [{
				at: now,
				kind: "issue",
				amountCents,
				employeeId: emp?.id,
				employeeName: emp?.name,
				beforeCents: 0,
				afterCents: amountCents,
			}],
		};
		const ids = {
			orgId: get().tenantLocationId ? `org:${get().tenantLocationId}` : "org_local",
			locationId: get().tenantLocationId || get().settlementConfig.locationId || "loc_local",
		};
		let led = entriesForGiftIssue({
			ids,
			cardId: card.id,
			code: c,
			amountCents,
			issuerId: issuer.id,
			issuerKind: issuer.kind,
			now,
		});
		const transfers = [...(get().giftTransfers ?? [])];
		const sellerId = emp?.operatorId || HOUSE_ISSUER_ID;
		if (sellerId !== issuer.id) {
			const seller = resolveGiftIssuer(sellerId, settings, vendors);
			const trId = uid("gtr");
			transfers.push({
				id: trId,
				at: now,
				giftCardId: card.id,
				amountCents,
				fromId: seller.id,
				fromName: seller.name,
				toId: issuer.id,
				toName: issuer.name,
				reason: "issue_remit",
			});
			led = led.concat(entriesForGiftRemit({
				ids,
				transferId: trId,
				amountCents,
				fromId: seller.id,
				fromKind: seller.kind,
				toId: issuer.id,
				toKind: issuer.kind,
				reason: "issue_remit",
				now,
			}));
		}
		set({
			giftCards: [card, ...get().giftCards],
			giftTransfers: transfers,
			ledgerEntries: mergeLedger(get().ledgerEntries ?? [], led),
		});
		get().audit(
			"gift_issue",
			`${c} · issuer ${issuer.name} · ${tender ?? "card"} $${(amountCents / 100).toFixed(2)} (liability, not merch)`,
		);
		return {
			ok: true,
			card,
			code: c
		};
	},
	processGiftBreakage: () => {
		const settings = get().settings;
		const vendors = get().vendors;
		const now = Date.now();
		const house = houseIssuer(settings);
		const ids = {
			orgId: get().tenantLocationId ? `org:${get().tenantLocationId}` : "org_local",
			locationId: get().tenantLocationId || get().settlementConfig.locationId || "loc_local",
		};
		let processed = 0;
		let cards = get().giftCards;
		const transfers = [...(get().giftTransfers ?? [])];
		let led = [];
		for (const c of cards) {
			if (c.status === "void" || c.breakageProcessedAt) continue;
			if (!isGiftExpired(c, now)) continue;
			const remaining = Math.max(0, c.balanceCents);
			if (remaining <= 0) continue;
			const issuer = resolveGiftIssuer(c.issuerId, settings, vendors);
			const houseShare = giftBreakageHouseShareCents(remaining, issuer.kind, settings);
			cards = cards.map((g) => g.id === c.id ? {
				...g,
				balanceCents: 0,
				status: "zeroed",
				breakageProcessedAt: now,
			} : g);
			led = led.concat(entriesForGiftBreakage({
				ids,
				cardId: c.id,
				amountCents: remaining,
				issuerId: issuer.id,
				issuerKind: issuer.kind,
				now,
			}));
			if (houseShare > 0 && issuer.id !== house.id) {
				const trId = uid("gtr");
				transfers.push({
					id: trId,
					at: now,
					giftCardId: c.id,
					amountCents: houseShare,
					fromId: issuer.id,
					fromName: issuer.name,
					toId: house.id,
					toName: house.name,
					reason: "breakage",
				});
				led = led.concat(entriesForGiftRemit({
					ids,
					transferId: trId,
					amountCents: houseShare,
					fromId: issuer.id,
					fromKind: issuer.kind,
					toId: house.id,
					toKind: "house",
					reason: "breakage",
					now,
				}));
			}
			processed += 1;
			get().audit(
				"gift_breakage",
				`${c.code} · ${issuer.name} residual $${(remaining / 100).toFixed(2)}${issuer.kind === "house" ? " retained by house" : ` · house share $${(houseShare / 100).toFixed(2)}`}`,
			);
		}
		set({
			giftCards: cards,
			giftTransfers: transfers,
			ledgerEntries: mergeLedger(get().ledgerEntries ?? [], led),
		});
		return { ok: true, processed };
	},
	reloadGiftCard: (code, amountCents) => {
		const needle = (code || "").replace(/[\s-]/g, "").toUpperCase();
		const gc = get().giftCards.find((g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle && g.active);
		if (!gc) return {
			ok: false,
			error: "Only issued or imported cards can be reloaded"
		};
		if (gc.status === "frozen" || gc.status === "void") return { ok: false, error: "Card is not reloadable" };
		if (amountCents <= 0) return {
			ok: false,
			error: "Amount required"
		};
		if (lpCfg(get).giftLoadRequiresTender) {
			let order = get().getActiveOrder();
			if (!order || order.status !== "open") {
				const id = get().openTakeout("Gift reload");
				order = get().orders.find((o) => o.id === id) ?? get().getActiveOrder();
			}
			if (!order) return { ok: false, error: "Open a ticket to load gift with cash or card." };
			if (!realTenderOnOrder(order)) {
				const pay = get().takePayment({ method: "card", amountCents, tipCents: 0 });
				if (!pay.ok) {
					const cash = get().takePayment({ method: "cash", amountCents, tipCents: 0, tenderedCents: amountCents });
					if (!cash.ok) return { ok: false, error: "Gift load needs a cash or card tender on the same ticket." };
				}
			}
		}
		const emp = get().getCurrentEmployee();
		const before = gc.balanceCents;
		const after = before + amountCents;
		set({ giftCards: get().giftCards.map((g) => g.id === gc.id ? {
			...g,
			balanceCents: after,
			status: "active",
			ledger: [...(g.ledger ?? []), {
				at: Date.now(),
				kind: "reload",
				amountCents,
				employeeId: emp?.id,
				employeeName: emp?.name,
				beforeCents: before,
				afterCents: after,
			}],
		} : g) });
		get().audit("gift_issue", `Reload ${gc.code}`, { amountCents });
		return { ok: true };
	},
	setGiftCardStatus: (code, status, opts) => {
		if (
			lpCfg(get).giftAdjustManager &&
			!opts?.skipGate &&
			opts?.path !== "break_glass" &&
			!get().canAuthorizeGate("gift_adjust", 0)
		) {
			return { ok: false, error: "Gift deactivate / freeze needs a manager (or a granted shift lead)." };
		}
		const needle = (code || "").replace(/[\s-]/g, "").toUpperCase();
		const gc = get().giftCards.find((g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle);
		if (!gc) return { ok: false, error: "Only issued or imported cards" };
		const emp = get().getCurrentEmployee();
		const entry = {
			at: Date.now(),
			kind: "status",
			amountCents: 0,
			employeeId: emp?.id,
			employeeName: emp?.name,
			reason: status,
			beforeCents: gc.balanceCents,
			afterCents: gc.balanceCents,
		};
		set({
			giftCards: get().giftCards.map((g) =>
				g.id === gc.id
					? { ...g, status, active: status !== "void", ledger: [...(g.ledger ?? []), entry] }
					: g,
			),
		});
		get().audit(status === "void" || status === "frozen" ? "gift_deactivate" : "gift_adjust", `${gc.code} → ${status}`, {
			reason: String(status),
			before: gc.status || "active",
			after: opts?.path === "break_glass" ? "break_glass" : status,
			...gateMeta(opts?.approval, opts?.path),
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
				issuerKind: "house",
				issuerId: HOUSE_ISSUER_ID,
				issuerName: get().settings.name || "House",
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
		const locForPin = get().tenantLocationId || get().activeEntityId || "loc";
		let pin = (input.pin || "").replace(/\D/g, "").slice(0, 4);
		if (pin.length < 4 || pinTakenByOther(get().employees, "", pin, locForPin)) {
			do {
				pin = String(1000 + Math.floor(Math.random() * 9000));
			} while (pinTakenByOther(get().employees, "", pin, locForPin));
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
			kind: partial.kind ?? (partial.shape === "bar" ? "barstool" : partial.shape === "booth" ? "booth" : "table"),
			status: "empty",
			statusSince: Date.now(),
			qrToken: makeTableQrToken(id, partial.label ?? String(n), get().tenantLocationId || undefined),
		}] });
		return id;
	},
	setTableStatus: (tableId, status) => {
		const emp = get().getCurrentEmployee();
		const cfg = floorCfg();
		if (emp && !cfg.changeRoles.includes(emp.role) && emp.role !== "owner") return { ok: false, error: "Not allowed to change table status" };
		const next = normalizeTableStatus(status);
		if (next === "empty") {
			return get().markClean(tableId);
		}
		const root = groupRootId(get().tables, tableId);
		const members = groupMembers(get().tables, root).map((t) => t.id);
		set({
			tables: get().tables.map((t) => members.includes(t.id) ? { ...t, status: next, statusSince: Date.now() } : t),
		});
		get().audit("floor", `Table status ${next}`);
		floorSync("table", root);
		return { ok: true };
	},
	guestOpenTable: (tableId) => {
		const policy = parseQrPolicy(get().settings.qrPolicy, get().settings.qrMode);
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return { ok: false, error: "Unknown table" };
		if (table.orderId) {
			const existing = get().orders.find((o) => o.id === table.orderId);
			if (existing && existing.status === "open") {
				set({ activeOrderId: table.orderId, activeTableId: tableId });
				return { ok: true };
			}
		}
		if (!qrCanReorder(policy)) {
			return { ok: false, error: "This table QR is pay only — ask staff to order" };
		}
		if (!qrCanOpenCheck(policy)) {
			return { ok: false, error: "See your server" };
		}
		const order = {
			id: uid("ord"),
			number: nextOrderNumber(get().orders),
			type: "dine_in",
			tableId,
			guestCount: table.seats || 2,
			serverId: "guest_qr",
			serverName: "Guest QR",
			lines: [],
			payments: [],
			status: "open",
			discountPercent: 0,
			discountCents: 0,
			autoGratApplied: false,
			serviceChargeCents: 0,
			createdAt: Date.now(),
		};
		set({
			orders: [...get().orders, order],
			tables: get().tables.map((t) => t.id === tableId ? {
				...t,
				status: "sat_no_order",
				statusSince: Date.now(),
				orderId: order.id,
				guestCount: order.guestCount,
				seatedAt: Date.now(),
			} : t),
			activeOrderId: order.id,
			activeTableId: tableId,
		});
		try {
			useNotifyStore.getState().pushNotice({
				kind: "guest_checked_in",
				title: `QR open · Table ${table.label}`,
				body: "Guest opened a check from the table QR",
				tableLabel: table.label,
				audience: ["host", "manager"],
			});
		} catch { /* */ }
		floorSync("table", tableId);
		return { ok: true };
	},
	guestAddToTable: (tableId, menuItemId, opts) => {
		const policy = parseQrPolicy(get().settings.qrPolicy, get().settings.qrMode);
		const item = get().menuItems.find((m) => m.id === menuItemId);
		if (!item) return { ok: false, error: "Item unavailable" };
		if (!qrItemAllowed(item, policy.orderAllow)) {
			return { ok: false, error: "That item is not on the table QR menu" };
		}
		ensureGuestCashier(get, set);
		const prev = get().currentEmployeeId;
		set({ currentEmployeeId: "guest_qr" });
		if (opts?.seat != null) set({ activeSeat: opts.seat });
		const opened = get().guestOpenTable(tableId);
		if (!opened.ok) {
			set({ currentEmployeeId: prev });
			return opened;
		}
		const res = get().addItem(menuItemId, { seat: opts?.seat });
		set({ currentEmployeeId: prev });
		return res;
	},
	guestSendOrder: (tableId) => {
		const table = get().tables.find((t) => t.id === tableId);
		if (!table?.orderId) return { ok: false, error: "No open check" };
		set({ activeOrderId: table.orderId, activeTableId: tableId });
		get().sendOrder();
		return { ok: true };
	},
	rotateTableQr: (tableId) => {
		const table = get().tables.find((t) => t.id === tableId);
		if (!table) return { ok: false, error: "Not found" };
		const token = makeTableQrToken(`${tableId}${Date.now()}`, table.label, get().tenantLocationId || undefined);
		set({
			tables: get().tables.map((t) => t.id === tableId ? { ...t, qrToken: token } : t),
		});
		return { ok: true, token };
	},
	guestPayOrder: (orderId, opts) => {
		const policy = parseQrPolicy(get().settings.qrPolicy, get().settings.qrMode);
		if (!qrCanPay(policy)) return { ok: false, error: "Pay is not on for this QR" };
		const order = get().orders.find((o) => o.id === orderId);
		if (!order) return { ok: false, error: "Check not found" };
		if (order.status !== "open") return { ok: false, error: "Check already closed" };
		const method = opts?.method === "gift_card" ? "gift_card" : "card";
		if (method === "gift_card" && policy.payAllow === "card") {
			return { ok: false, error: "Gift is not on for table QR" };
		}
		if (method === "card" && policy.payAllow === "gift") {
			return { ok: false, error: "Card is not on for table QR — use gift" };
		}
		const totals = computeTotals(order, get().settings, { tender: method === "gift_card" ? "card" : "card" });
		if (totals.balanceCents <= 0) return { ok: false, error: "Already paid" };
		const amount = Math.min(
			Math.max(1, opts?.amountCents ?? totals.balanceCents),
			totals.balanceCents,
		);
		const tip = policy.tip ? Math.max(0, opts?.tipCents ?? 0) : 0;
		const prev = get().currentEmployeeId;
		ensureGuestCashier(get, set);
		set({ currentEmployeeId: "guest_qr", activeOrderId: orderId });
		const keepOpen = policy.afterPay === "keep_open_for_reorder";
		const res = get().takePayment({
			method,
			amountCents: amount,
			tipCents: tip,
			last4: method === "card" ? "4242" : undefined,
			giftCardCode: method === "gift_card" ? opts?.giftCode : undefined,
			keepOpen,
		});
		set({ currentEmployeeId: prev });
		return res;
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
	closeShift: (closingCashCents, opts) => {
		const cfg = lpCfg(get);
		const issues = buildNightlyIntegrityPack({
			tables: get().tables,
			orders: get().orders,
			employees: get().employees,
			auditLog: get().auditLog,
			cfg,
		});
		if (issues.length) {
			if (cfg.nightCloseMode === "hard_block") {
				return {
					ok: false,
					error: `House close blocked: ${issues.length} integrity item(s). Clear them before Z close.`,
					issues: issues.length,
				};
			}
			const reason = String(opts?.ackReason ?? "").trim();
			if (!reason) {
				return {
					ok: false,
					error: `House close has ${issues.length} integrity item(s). A manager must acknowledge with a reason, or clear them.`,
					issues: issues.length,
				};
			}
			const emp = get().getCurrentEmployee();
			const lead = emp && (emp.role === "owner" || emp.role === "manager" || get().hasManagerAuth());
			if (!lead) {
				return { ok: false, error: "Manager PIN required to acknowledge nightly exceptions.", issues: issues.length };
			}
			get().audit("integrity_ack", reason, {
				reason,
				after: issues.map((i) => i.kind).join(","),
			});
		}
		const s = get().shift;
		const expected = s.openingFloatCents + s.cashSalesCents - s.tipsCashCents;
		set({ shift: {
			...s,
			closedAt: Date.now(),
			closingCashCents,
			expectedCashCents: expected
		} });
		get().audit("shift_close", `Counted $${(closingCashCents / 100).toFixed(2)}`);
		return { ok: true, issues: issues.length };
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
		return { ok: false, error: "Demo tenants are retired. Onboard a location through SaaS." };
	},
	loadProspectDemo: (_entityId: VenueEntityId) => {
		return { ok: false, error: "Demo tenants are retired. Onboard a location through SaaS." };
	},
	applyEntity: (entityId: VenueEntityId) => {
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
		if (isPartnerDemoLocationId(locationId)) {
			const partnerReady =
				already &&
				get().menuItems.some((m) => m.id === "itm_steam_highball") &&
				get().employees.some((e) => e.pinHash);
			if (!partnerReady) {
				const slice = partnerLaundryPosSlice(locationId);
				set({
					...slice,
					entityPermissions: opts.entityPermissions?.length
						? opts.entityPermissions
						: slice.entityPermissions,
					locationDevices: opts.locationDevices?.length
						? opts.locationDevices
						: slice.locationDevices,
					activeDeviceId: null,
					auditLog: [],
					chargebacks: [],
					shift: emptyShift(),
					clock: Date.now(),
					currentEmployeeId: null,
					sessionKind: "pin",
					backOfficeUnlocked: false,
				});
			} else if (opts.locationDevices?.length) {
				set({ locationDevices: opts.locationDevices });
			}
			mergeFloorStaff(get, set, opts.floorStaff);
			try {
				useSaasStore.getState().setActiveLocation(locationId);
			} catch {
				/* ignore */
			}
			return { ok: true };
		}
		if (already && (!staff || staff.role === "owner") && !opts.floorStaff?.length && !opts.pinGate) {
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
				peerVenue: opts.peerVenue,
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
		mergeFloorStaff(get, set, opts.floorStaff);
		try {
			useSaasStore.getState().setActiveLocation(locationId);
		} catch {
			/* ignore */
		}
		if (opts.floorStaff?.length || opts.pinGate) {
			const hasRoster = (opts.floorStaff ?? []).some(
				(s) =>
					s.id.startsWith("emp_tr_") ||
					s.id === "emp_ft_0000" ||
					s.role === "manager" ||
					s.role === "server",
			);
			set({
				currentEmployeeId: null,
				sessionKind: "pin",
				backOfficeUnlocked: false,
				employees: hasRoster
					? get().employees.filter((e) => e.id !== "emp_owner")
					: get().employees,
			});
			return { ok: true };
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
		giftTransfers: s.giftTransfers ?? [],
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
		stationPinFailures: s.stationPinFailures ?? 0,
		stationPinLocked: s.stationPinLocked ?? false,
		acknowledgedExceptionIds: s.acknowledgedExceptionIds ?? [],
		pendingApprovals: s.pendingApprovals ?? [],
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
				floorStatusConfig: parseFloorStatusConfig(
					(p.settings && p.settings.floorStatusConfig) ?? current.settings?.floorStatusConfig,
				),
				qrMode: parseQrMode((p.settings && p.settings.qrMode) ?? current.settings?.qrMode),
				qrPolicy: parseQrPolicy(
					(p.settings && p.settings.qrPolicy) ?? current.settings?.qrPolicy,
					(p.settings && p.settings.qrMode) ?? current.settings?.qrMode,
				),
				voiceControlEnabledByRole: {
					...(p.settings && p.settings.voiceControlEnabledByRole),
				},
				giftTermAllowed: (p.settings && p.settings.giftTermAllowed) ?? current.settings?.giftTermAllowed ?? false,
				giftTermDays: (p.settings && p.settings.giftTermDays) ?? current.settings?.giftTermDays ?? 730,
				giftOperatorBreakageSplitBps:
					(p.settings && p.settings.giftOperatorBreakageSplitBps) ??
					current.settings?.giftOperatorBreakageSplitBps ??
					5000,
				giftHouseIssuerEnabled:
					(p.settings && p.settings.giftHouseIssuerEnabled) ??
					current.settings?.giftHouseIssuerEnabled ??
					true,
				giftHostessDefaultIssuerId:
					(p.settings && p.settings.giftHostessDefaultIssuerId) ??
					current.settings?.giftHostessDefaultIssuerId,
				...(ent
					? {
							name: ent.venueName,
							address: ent.address,
							multiTenantHallMode: entityId === "food_hall"
						}
					: { multiTenantHallMode: false })
			},
			tables: (p.tables || current.tables || []).map((t) => ({
				...t,
				status: normalizeTableStatus(t.status),
				statusSince: t.statusSince || t.seatedAt || Date.now(),
				qrToken:
					t.qrToken && qrTokenMatchesLocation(t.qrToken, locKey)
						? t.qrToken
						: makeTableQrToken(t.id, t.label, locKey),
				kind: t.kind || (t.shape === "bar" ? "barstool" : "table"),
			})),
			floorSections: (p.floorSections && p.floorSections.length) ? p.floorSections : current.floorSections,
			extraTableGrants: p.extraTableGrants || current.extraTableGrants || [],
			chargebacks: p.chargebacks || current.chargebacks || [],
			sectionOverrides: {},
			giftCards: (p.giftCards || current.giftCards || []).map((g) => ({
				...g,
				source: g.source || "summex",
				status: g.status || (g.active === false ? "void" : g.balanceCents === 0 ? "zeroed" : "active"),
				originalBalanceCents: g.originalBalanceCents ?? g.balanceCents,
				issuerKind: g.issuerKind || "house",
				issuerId: g.issuerId || HOUSE_ISSUER_ID,
			})),
			giftTransfers: p.giftTransfers || current.giftTransfers || [],
		};
	}
}));

export const usePosStore = usePosStoreRaw as unknown as UseBoundStore<
	StoreApi<PosStore>
> &
	PosStorePersist;

