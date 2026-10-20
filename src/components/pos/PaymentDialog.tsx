import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CreditCard, Banknote, Gift, Percent, Mail, Printer, Ban, FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { usePosStore } from "@/lib/pos/store";
import { useNetworkStore } from "@/lib/pos/network-store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { CardTipRow } from "@/components/pos/CardTipRow";
import { cardAuthorizationCents, cardPayDueCents, computeDualTotals, tipSuggestions } from "@/lib/pos/calculations";
import { tipCentsForChoice, type CardTipChoice } from "@/lib/pos/card-tip";
import { cardCloseSimulatesTip, logTipAdjust, visibleTipFailure } from "@/lib/payments/tip-capture";
import { guestStaffName } from "@/lib/labor/staff-record";
import { formatCurrency } from "@/lib/utils";
import type { CardAuthHold, PaymentMethod } from "@/lib/pos/types";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { captureIsSandbox } from "@/lib/lifecycle/store";
import {
  cancelSquareCheckoutFn,
  captureCardPresentFn,
  captureCheckAuthorizationFn,
  chargeManualCardFn,
  squareCheckoutStatusFn,
  startSquareCheckoutFn,
  getPaymentsStatusFn,
  finixConnectAuthFn,
  listPaxReadersFn,
  paxReaderSessionFn,
  recordPaxSaleFn,
  voidCheckAuthorizationFn,
  sendGuestReceiptFn,
  sendGuestReceiptSmsFn,
} from "@/lib/payments/api";
import {
  CARD_READER_USB_NOT_CONNECTED,
  PAX_MSG,
  checkAlreadyCaptured,
  checkEntityLabelForReader,
  checkSellingEntityId,
  checkSellingEntityIds,
  decidePaxPick,
  finixConnectBanner,
  finixConnectDiagnostic,
  finixMerchantDataGap,
  finixMerchantDataPreview,
  finixSdkTraceFromConnect,
  logFinixConnectDiagnostic,
  paxConnectActivityTrace,
  paxSdkConnectActivityResult,
  normalizePaxLink,
  payEntityStatusText,
  payReaderStatusText,
  paymentUsesConnectedReader,
  paxScanPresentation,
  paxScanRowLabel,
  paxTabletCallback,
  readerCheckEntityBanner,
  readerEntityLabel,
  readerForSerial,
  runAndroidPaxCapture,
  runAndroidPaxSale,
  runAndroidPaxVoid,
  runPaxConnect,
  usbCardStep,
  type PaxReader,
  type PaxScanRow,
} from "@/lib/payments/pax-d135";
import { noteStationActivity, paxReaderSessionData } from "@/lib/payments/station-activity";
import {
  beginPaxConnect,
  beginPaxScan,
  failPaxConnect,
  finishPaxScan,
  getPaxStationLink,
  markPaxConnected,
  showPaxConnectBanner,
  notePaxStatus,
  setPaxReaders,
  usePaxStationLink,
} from "@/lib/pos/pax-station-link";
import {
  buildGuestCheckView,
  guestCheckHtml,
  guestCheckText,
  type GuestCheckView,
} from "@/lib/payments/check-by-vendor";
import { GuestCheckByVendor } from "./GuestCheckByVendor";
import { toast } from "sonner";
import { NO_SECTION_RECEIPT, printCardTipSlips, printGuestCheck, printGuestReceipt } from "@/lib/print/from-store";
import {
  ADD_RECEIPT_PRINTER,
  currentStationDeviceId,
  stationMayKickDrawer,
  stationMayPrintReceipt,
} from "@/lib/print/receipt-printer";
import { DRAWER_PIN_DENIED, DRAWER_STAYS_CLOSED } from "@/lib/pos/drawer-open";
import { parseStationClass } from "@/lib/pos/station-class";
import { issueGiftCardFn, lookupGiftCardFn, redeemGiftCardFn } from "@/lib/gift/api";
import { defaultGiftIssuer, fulfillingIssuer } from "@/lib/pos/gift-issuer";
import { giftNeedsManagerPin, giftSellBlockedReason, parseGiftLimits } from "@/lib/pos/gift-limits";
import { ManagerPinDialog } from "./ManagerPinDialog";
import type { PaymentsStatus } from "@/lib/payments/types";
import { uid } from "@/lib/utils";
import { readTenantPosContext } from "@/lib/saas/pos-context";
import { canEmployee } from "@/lib/access/permissions";
import { splitTenderByEntity } from "@/lib/payments/entity-split";
import {
  manualCardEntryVisible,
  parseManualCard,
  redactCardText,
  type ManualCard,
} from "@/lib/payments/manual-card";
import { cashRoleFromSession, parseCashHandling } from "@/lib/pos/cash-handling";
import { previewCashSale, useCashSessionStore } from "@/lib/pos/cash-session";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { deviceRoleFromSessionMode, parseStationQuery } from "@/lib/pos/device-roles";
import { odsBlocksTender } from "@/lib/pos/loss-prevention";
import {
  enabledPayMethods,
  firstEnabledMethod,
  methodEnabled,
  payConfigForProcessor,
  methodLabel,
  parsePaymentMethods,
} from "@/lib/pos/payment-methods";
import { isManagerCash } from "@/lib/pos/cash-handling";
import { findStaffByPin } from "@/lib/pos/pin";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialMethod?: PaymentMethod;
}

const CARD_AUTH_PREFIX = "summex-card-auth:";

function readSessionCardAuth(orderId: string | undefined): CardAuthHold | null {
  if (!orderId || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CARD_AUTH_PREFIX + orderId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CardAuthHold;
    if (!parsed || typeof parsed.amountCents !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCardAuth(orderId: string, auth: CardAuthHold) {
  try {
    sessionStorage.setItem(CARD_AUTH_PREFIX + orderId, JSON.stringify(auth));
  } catch {
    /* private mode */
  }
}

function clearSessionCardAuth(orderId: string) {
  try {
    sessionStorage.removeItem(CARD_AUTH_PREFIX + orderId);
  } catch {
    /* private mode */
  }
}

export function PaymentDialog({ open, onOpenChange, initialMethod }: Props) {
  const order = usePosStore((s) => s.orders.find((o) => o.id === s.activeOrderId));
  const settings = usePosStore((s) => s.settings);
  const takePayment = usePosStore((s) => s.takePayment);
  const printCheck = usePosStore((s) => s.printCheck);
  const flagReceiptPending = usePosStore((s) => s.flagReceiptPending);
  const clearReceiptPending = usePosStore((s) => s.clearReceiptPending);
  const wanOnline = useNetworkStore((s) => s.wanOnline());
  const clearTable = usePosStore((s) => s.clearTable);
  const setView = usePosStore((s) => s.setView);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const canPay = canEmployee(emp, "payments:take");
  const payCfg = payConfigForProcessor(
    parsePaymentMethods(settings.paymentMethods),
    settings.cardProcessor,
  );
  const giftOk = canPay && payCfg.giftCard;
  const locationDevices = usePosStore((s) => s.locationDevices);
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const tables = usePosStore((s) => s.tables);
  const floorSections = usePosStore((s) => s.floorSections);
  const stationId = activeDeviceId || currentStationDeviceId();
  const canOpenDrawer = stationMayKickDrawer(locationDevices, stationId);
  const stationRow = locationDevices.find((d) => d.id === stationId);
  const stationClass = parseStationClass(stationRow?.stationClass, stationRow);
  const payTable = order?.tableId ? tables.find((t) => t.id === order.tableId) : undefined;
  const mayPrintReceipt = stationMayPrintReceipt(locationDevices, stationId, {
    table: payTable,
    tables,
    tableId: order?.tableId,
    sections: floorSections,
    orderType: order?.type,
  });
  const mayPrintCheck = mayPrintReceipt;
  const deviceRole = (() => {
    try {
      const q = parseStationQuery(new URLSearchParams(window.location.search).get("station"));
      if (q) return q;
      return deviceRoleFromSessionMode(useStationSessionStore.getState().assignment.kind);
    } catch {
      return null;
    }
  })();
  const odsBlocked = deviceRole === "ods";
  const payMethods = enabledPayMethods(payCfg);

  const [method, setMethod] = useState<PaymentMethod>(() =>
    initialMethod && methodEnabled(payCfg, initialMethod)
      ? initialMethod
      : firstEnabledMethod(payCfg, wanOnline ? "card" : "cash"),
  );
  useEffect(() => {
    if (!open || !initialMethod) return;
    if (methodEnabled(payCfg, initialMethod)) setMethod(initialMethod);
    // Tender button sets initialMethod. payCfg is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMethod]);
  const [checkLast4, setCheckLast4] = useState("");
  const [checkWitness, setCheckWitness] = useState("");
  const [compReason, setCompReason] = useState("");
  const dual = useMemo(
    () => (order ? computeDualTotals(order, settings) : null),
    [order, settings],
  );
  const totals = dual?.card ?? null;
  const cashOn = Boolean(dual?.enabled && method === "cash");
  const cardPayDue = order ? cardPayDueCents(order, settings) : 0;
  const balance = cashOn ? (dual?.cash.balanceCents ?? 0) : cardPayDue;
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState(0);
  const [cardTip, setCardTip] = useState<CardTipChoice>({ kind: "none" });
  const [tendered, setTendered] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [giftSellAmt, setGiftSellAmt] = useState("50");
  const [giftSellTender, setGiftSellTender] = useState<"cash" | "card">("card");
  const [giftNote, setGiftNote] = useState<string | null>(null);
  const [giftMgrOpen, setGiftMgrOpen] = useState(false);
  const [drawerPinOpen, setDrawerPinOpen] = useState(false);
  const [drawerMsg, setDrawerMsg] = useState<string | null>(null);
  const issueGiftCard = usePosStore((s) => s.issueGiftCard);
  const giftCards = usePosStore((s) => s.giftCards);
  const hasManagerAuth = usePosStore((s) => s.hasManagerAuth);
  const [last4, setLast4] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [manualExp, setManualExp] = useState("");
  const [manualCvv, setManualCvv] = useState("");
  const [manualZip, setManualZip] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [usePax, setUsePax] = useState(false);
  const [usbAttached, setUsbAttached] = useState<boolean | null>(null);
  const usbConnectKey = useRef("");
  const pax = usePaxStationLink();
  const assignedReader = useMemo(() => {
    const serial = String(stationRow?.cardReaderId ?? "").replace(/\s+/g, "");
    const pool = [...(settings.paxReaders ?? []), ...pax.readers];
    const found = serial ? pool.find((row) => row.serial.replace(/\s+/g, "") === serial) : undefined;
    return found ?? pax.reader ?? null;
  }, [stationRow?.cardReaderId, settings.paxReaders, pax.readers, pax.reader]);
  const cardLink = normalizePaxLink(assignedReader?.link);
  const [payEntityBanner, setPayEntityBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cardHold, setCardHold] = useState<string | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payStatus, setPayStatus] = useState<PaymentsStatus | null>(null);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [receiptMsg, setReceiptMsg] = useState<string | null>(null);
  const [receiptChoice, setReceiptChoice] = useState<"choose" | "email" | "sms" | "print">("choose");
  const [receiptSms, setReceiptSms] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [checkPrintMsg, setCheckPrintMsg] = useState<string | null>(null);
  const [checkPrintBusy, setCheckPrintBusy] = useState(false);
  const [guestFace, setGuestFace] = useState(false);
  const [signed, setSigned] = useState(false);
  const [cardReceiptAsk, setCardReceiptAsk] = useState(false);
  const [tipCaptureFailed, setTipCaptureFailed] = useState(false);
  const payAttempt = useRef(0);
  const payLock = useRef(false);

  useEffect(() => {
    const cfg = payConfigForProcessor(parsePaymentMethods(settings.paymentMethods), settings.cardProcessor);
    if (!methodEnabled(cfg, method)) {
      setMethod(firstEnabledMethod(cfg, wanOnline ? "card" : "cash"));
    }
  }, [settings.paymentMethods, settings.cardProcessor, method, wanOnline]);

  const amountCents = amount
    ? Math.round(parseFloat(amount) * 100)
    : balance;

  const tips = tipSuggestions(balance);
  const tenderBase = Number.isFinite(amountCents)
    ? Math.min(Math.max(0, amountCents), Math.max(0, balance))
    : Math.max(0, balance);
  const cardHoldAuth = order?.cardAuth ?? (order ? readSessionCardAuth(order.id) : null);
  const usbBlocksCard =
    cardLink === "usb" &&
    settings.cardProcessor !== "square" &&
    (usbAttached !== true || (!cardHoldAuth && pax.phase !== "connected"));
  const tipBase = cardHoldAuth ? cardHoldAuth.amountCents : tenderBase;
  const payTip = method === "card" ? tipCentsForChoice(cardTip, tipBase) : tip;
  const cardDue = cardHoldAuth ? cardHoldAuth.amountCents : tenderBase;
  const cardTotal = cardDue + (method === "comp" ? 0 : method === "card" && !cardHoldAuth ? 0 : payTip);
  const vendors = usePosStore((s) => s.vendors);
  const guestSlip = useMemo(() => {
    if (!order) return null;
    return buildGuestCheckView({
      order,
      settings,
      hostName: settings.name,
      operatorName: (id) => vendors.find((v) => v.id === id)?.name ?? id,
    });
  }, [order, settings, vendors]);

  useEffect(() => {
    let cancelled = false;
    void import("@/lib/payments/pax-d135-native")
      .then((mod) => {
        if (cancelled) return;
        setUsePax(
          mod.paxReaderOnThisStation() &&
            settings.cardProcessor !== "square" &&
            settings.cardProcessor !== "none",
        );
      })
      .catch(() => {
        if (!cancelled) setUsePax(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.cardProcessor]);

  useEffect(() => {
    if (!open) return;
    const loc = usePosStore.getState().tenantLocationId || readTenantPosContext()?.locationId || "";
    if (!loc) return;
    let cancelled = false;
    void listPaxReadersFn({ data: { locationId: loc } })
      .then((res) => {
        if (cancelled) return;
        const published = usePosStore.getState().settings.paxReaders ?? [];
        const merged = new Map<string, PaxReader>();
        for (const reader of [...published, ...(res.readers ?? [])]) merged.set(reader.serial, reader);
        setPaxReaders([...merged.values()]);
      })
      .catch(() => {
        if (!cancelled) setPaxReaders(usePosStore.getState().settings.paxReaders ?? []);
      });
    if (!usePax) return () => {
      cancelled = true;
    };
    const listener = import("@/lib/payments/pax-d135-native").then((mod) => {
      if (cancelled || !mod.paxReaderOnThisStation()) return null;
      return mod.paxPlugin.addListener("status", (status) => {
        notePaxStatus(status);
        if (status.state !== "processing") return;
        const step = String(status.message ?? "").trim();
        if (!step) return;
        void noteStationActivity({
          locationId: loc,
          action: "connect",
          result: step,
        });
      });
    });
    return () => {
      cancelled = true;
      void listener.then((handle) => handle?.remove());
    };
  }, [open, usePax]);

  useEffect(() => {
    if (!open || cardLink !== "usb" || settings.cardProcessor === "square") {
      setUsbAttached(null);
      return;
    }
    let cancel = false;
    const tick = () => {
      void import("@/lib/payments/pax-d135-native").then(async (mod) => {
        const attached = await mod.usbReaderAttached();
        if (cancel) return;
        setUsbAttached(attached);
        const live = getPaxStationLink();
        if (!attached && live.phase === "connected" && normalizePaxLink(live.reader?.link) === "usb") {
          failPaxConnect(CARD_READER_USB_NOT_CONNECTED);
        }
      });
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [open, cardLink, settings.cardProcessor]);

  const openOrderId = order?.id;
  const cardAuthOn = Boolean(order?.cardAuth);
  useEffect(() => {
    if (!open) {
      setPayEntityBanner(null);
      setGuestFace(false);
      setSigned(false);
      return;
    }
    const current = openOrderId
      ? usePosStore.getState().orders.find((row) => row.id === openOrderId)
      : undefined;
    if (!current?.cardAuth) {
      const saved = readSessionCardAuth(openOrderId);
      if (saved && openOrderId) usePosStore.getState().setCardAuth(openOrderId, saved);
    }
    if ((current?.cardAuth || readSessionCardAuth(openOrderId)) && stationClass === "handheld") {
      setGuestFace(true);
    }
  }, [open, openOrderId, cardAuthOn, stationClass]);

  const scanStandIn =
    typeof window !== "undefined" &&
    typeof (window as unknown as { __summexPaxScan?: unknown }).__summexPaxScan === "function";

  const scanPax = () => {
    void (async () => {
      setError(null);
      setPayEntityBanner(null);
      beginPaxScan();
      try {
        const { scanForPaxReaders } = await import("@/lib/payments/pax-d135-native");
        const scanned = await scanForPaxReaders();
        finishPaxScan(paxScanPresentation(scanned, getPaxStationLink().readers));
      } catch {
        finishPaxScan({ phase: "idle", message: PAX_MSG.permissions, rows: [] });
      }
    })();
  };

  const pickPax = (row: PaxScanRow) => {
    void (async () => {
      if (!order) return;
      const loc = usePosStore.getState().tenantLocationId || readTenantPosContext()?.locationId || "";
      const locationLive = Boolean(payStatus && payStatus.mode === "live" && !payStatus.lifecycleForcesSandbox);
      const readers = getPaxStationLink().readers;
      const sellingEntityIds = checkSellingEntityIds(order.lines);
      const decision = decidePaxPick({
        row,
        readers,
        sellingEntityId: checkSellingEntityId(order.lines),
        sellingEntityIds,
        locationLive,
      });
      if (!decision.ok && decision.message !== PAX_MSG.wrongEntity) {
        await noteStationActivity({
          locationId: loc,
          action: "connect",
          result: decision.message,
        });
        setPayEntityBanner(null);
        failPaxConnect(decision.message);
        setError(decision.message);
        return;
      }
      const reader = decision.ok ? decision.reader : readerForSerial(readers, row.serial);
      if (!reader) {
        await noteStationActivity({
          locationId: loc,
          action: "connect",
          result: PAX_MSG.notRegistered,
        });
        setPayEntityBanner(null);
        failPaxConnect(PAX_MSG.notRegistered);
        setError(PAX_MSG.notRegistered);
        return;
      }
      const names = usePosStore.getState().vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
      }));
      const hostName = usePosStore.getState().settings.name;
      const readerEntity = readerEntityLabel(reader, names, hostName);
      const checkEntity = checkEntityLabelForReader({
        lines: order.lines,
        readerEntityId: reader.entityId,
        names,
        hostName,
      });
      const banner = readerCheckEntityBanner(readerEntity, checkEntity);
      setPayEntityBanner(banner);
      await noteStationActivity({
        locationId: loc,
        action: "entity match",
        checkEntity,
        readerEntity,
        result: decision.ok ? "match" : banner,
      });
      if (!decision.ok) {
        failPaxConnect(banner);
        setError(banner);
        return;
      }
      setError(null);
      beginPaxConnect(decision.reader);
      showPaxConnectBanner(banner);
      setBusy(true);
      let diagnostic = "";
      let sent: ReturnType<typeof paxConnectActivityTrace> | undefined;
      const logConnect = async (
        result: string,
        trace?: {
          applicationId?: string;
          environment?: string;
          usernamePresent?: "yes" | "no";
          passwordPresent?: "yes" | "no";
          merchantId?: string;
          deviceId?: string;
        },
      ) => {
        await noteStationActivity({
          locationId: loc,
          action: "connect",
          diagnostic,
          checkEntity,
          readerEntity,
          applicationId: trace?.applicationId,
          environment: trace?.environment,
          usernamePresent: trace?.usernamePresent,
          passwordPresent: trace?.passwordPresent,
          merchantId: trace?.merchantId,
          deviceId: trace?.deviceId,
          result,
        });
      };
      try {
        const session = await paxReaderSessionFn({
          data: paxReaderSessionData({
            locationId: loc,
            serial: decision.reader.serial,
            entityId: decision.reader.entityId,
          }),
        });
        if (!session.ok) {
          await noteStationActivity({
            locationId: loc,
            action: "Finix keys",
            usernamePresent: "no",
            passwordPresent: "no",
            checkEntity,
            readerEntity,
            result: session.error,
          });
          await logConnect(session.error);
          failPaxConnect(session.error);
          setError(session.error);
          setBusy(false);
          return;
        }
        const creds = {
          userId: session.userId.trim(),
          password: session.password.trim(),
          merchantId: session.merchantId.trim(),
          deviceId: session.deviceId.trim(),
          env: session.env,
          mid: session.mid.trim(),
        };
        diagnostic = finixConnectDiagnostic(creds);
        sent = paxConnectActivityTrace(creds);
        logFinixConnectDiagnostic(diagnostic);
        await noteStationActivity({
          locationId: loc,
          action: "Finix keys",
          diagnostic,
          checkEntity,
          readerEntity,
          result: diagnostic,
        });
        const preview = finixMerchantDataPreview(creds);
        logFinixConnectDiagnostic(preview);
        await noteStationActivity({
          locationId: loc,
          action: "connect",
          diagnostic,
          checkEntity,
          readerEntity,
          environment: sent?.environment,
          usernamePresent: sent?.usernamePresent,
          passwordPresent: sent?.passwordPresent,
          merchantId: sent?.merchantId,
          deviceId: sent?.deviceId,
          result: preview,
        });
        showPaxConnectBanner(preview);
        const gap = finixMerchantDataGap(creds);
        if (gap) {
          await logConnect(gap, sent);
          failPaxConnect(gap);
          setError(gap);
          setBusy(false);
          return;
        }
        const { connectForPaxReader, paxReaderOnThisStation } = await import("@/lib/payments/pax-d135-native");
        let raw = "";
        let trace:
          | {
              applicationId?: string;
              environment?: string;
              usernamePresent?: "yes" | "no";
              passwordPresent?: "yes" | "no";
              merchantId?: string;
              deviceId?: string;
            }
          | undefined;
        if (!paxReaderOnThisStation()) {
          try {
            const auth = await finixConnectAuthFn({
              data: paxReaderSessionData({
                locationId: loc,
                serial: decision.reader.serial,
                entityId: decision.reader.entityId,
              }),
            });
            trace = {
              applicationId: auth.applicationId,
              environment: auth.environment,
              usernamePresent: auth.usernamePresent,
              passwordPresent: auth.passwordPresent,
              merchantId: auth.merchantId,
              deviceId: auth.deviceId,
            };
            raw = String(auth.response ?? "").trim();
            if (!auth.ok) {
              const body = String(auth.error ?? "").trim();
              await logConnect(raw || body || "Finix login check failed", trace);
            }
          } catch (err) {
            const detail = err instanceof Error ? err.message.trim() : "";
            await logConnect(detail || "Finix login check failed", trace);
          }
        }
        const connected = await runPaxConnect(() =>
          connectForPaxReader({
            name: row.name,
            address: row.address,
            merchantId: creds.merchantId,
            deviceId: creds.deviceId,
            userId: creds.userId,
            password: creds.password,
            mid: creds.mid,
            env: creds.env,
            link: normalizePaxLink(decision.reader.link),
          }),
        );
        const sdkTrace = finixSdkTraceFromConnect(connected);
        const activity = {
          ...paxConnectActivityTrace({
            ...creds,
            applicationId: trace?.applicationId,
          }),
          ...(sdkTrace?.environment ? { environment: sdkTrace.environment } : {}),
          ...(sdkTrace?.merchantId ? { merchantId: sdkTrace.merchantId } : {}),
          ...(sdkTrace?.deviceId ? { deviceId: sdkTrace.deviceId } : {}),
        };
        const sdk = paxSdkConnectActivityResult(connected);
        logFinixConnectDiagnostic(sdk);
        if (!connected.ok) {
          const shown = paxTabletCallback(connected);
          await logConnect(sdk || shown, activity);
          failPaxConnect(shown);
          setError(shown);
          setBusy(false);
          return;
        }
        await logConnect(sdk, activity);
        markPaxConnected(
          decision.reader,
          typeof connected.batteryPercent === "number" ? connected.batteryPercent : null,
          finixConnectBanner(diagnostic, PAX_MSG.ready),
        );
      } catch (err) {
        const detail = err instanceof Error ? err.message.trim() : "";
        const outcome = detail || "Exception during connection";
        await logConnect(outcome, sent);
        failPaxConnect(outcome);
        setError(outcome);
      }
      setBusy(false);
    })();
  };
  const pickPaxRef = useRef(pickPax);
  pickPaxRef.current = pickPax;

  useEffect(() => {
    if (cardLink !== "usb" || usbAttached !== true) {
      usbConnectKey.current = "";
      return;
    }
    if (!open || !order || settings.cardProcessor === "square") return;
    if (pax.phase === "connected" || pax.phase === "connecting" || pax.phase === "setting_up") return;
    if (!assignedReader) return;
    if (usbConnectKey.current === assignedReader.serial) return;
    usbConnectKey.current = assignedReader.serial;
    pickPaxRef.current({
      name: `PAX D135_${assignedReader.serial}`,
      address: "usb",
      serial: assignedReader.serial,
      registered: true,
      entityId: assignedReader.entityId,
    });
  }, [open, cardLink, usbAttached, pax.phase, assignedReader, order, settings.cardProcessor]);

  useEffect(() => {
    if (!wanOnline && method === "card" && !cardHoldAuth) {
      const cfg = payConfigForProcessor(parsePaymentMethods(settings.paymentMethods), settings.cardProcessor);
      setMethod(firstEnabledMethod(cfg, "cash"));
    }
  }, [wanOnline, method, cardHoldAuth, settings.paymentMethods, settings.cardProcessor]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const measure = () => {
      const nav = document.querySelector("[data-busy-nav], [data-app-nav]");
      const height = nav?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--pay-nav-clear", height > 8 ? `${Math.ceil(height)}px` : "4.75rem");
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--pay-nav-clear");
    };
  }, [open]);

  useEffect(() => {
    if (!giftOk && method === "gift_card") {
      const cfg = payConfigForProcessor(parsePaymentMethods(settings.paymentMethods), settings.cardProcessor);
      setMethod(firstEnabledMethod(cfg, wanOnline ? "card" : "cash"));
    }
  }, [giftOk, method, wanOnline, settings.paymentMethods, settings.cardProcessor]);

  useEffect(() => {
    if (!open) return;
    const loc =
      usePosStore.getState().tenantLocationId ||
      readTenantPosContext()?.locationId ||
      "";
    if (!loc || !wanOnline) {
      setPayStatus(null);
      return;
    }
    void getPaymentsStatusFn({ data: { locationId: loc } })
      .then(setPayStatus)
      .catch(() => setPayStatus(null));
  }, [open, wanOnline]);

  const showManual =
    (settings.cardProcessor ?? "finix") === "finix" &&
    manualCardEntryVisible({
      lifecycleStatus: settings.lifecycleStatus,
      paymentsMode: payStatus?.mode,
      lifecycleForcesSandbox: payStatus?.lifecycleForcesSandbox,
    });
  const sandbox = captureIsSandbox({
    operatorId: order?.lines.find((l) => l.vendorId)?.vendorId,
    vendorIds: order?.lines.map((l) => l.vendorId).filter(Boolean) as string[],
  });
  const cashPresets = [balance, balance + payTip].filter(Boolean);
  const quickCash = [5, 10, 20, 50, 100].map((d) => d * 100);
  const giftLimits = parseGiftLimits(settings);

  const sellGiftOnStation = (opts?: { skipManager?: boolean }) => {
    const dollars = parseFloat(giftSellAmt);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setGiftNote("Enter a valid amount");
      return;
    }
    const cents = Math.round(dollars * 100);
    const cap = giftSellBlockedReason(cents, 0, giftLimits);
    if (cap) {
      setGiftNote(cap);
      return;
    }
    if (!opts?.skipManager && giftNeedsManagerPin(cents, giftLimits) && !hasManagerAuth()) {
      setGiftMgrOpen(true);
      setGiftNote("High-value sell needs a manager PIN.");
      return;
    }
    const issuer = defaultGiftIssuer(emp ?? null, settings, usePosStore.getState().vendors);
    void (async () => {
      const loc =
        usePosStore.getState().tenantLocationId ||
        readTenantPosContext()?.locationId ||
        "";
      try {
        if (loc && wanOnline) {
          try {
            const res = await issueGiftCardFn({
              data: {
                locationId: loc,
                amountCents: cents,
                issuerId: issuer.id,
                issuerKind: issuer.kind,
                issuerName: issuer.name,
                tender: giftSellTender,
                soldByEmployeeId: emp?.id,
                soldByOperatorId: emp?.operatorId,
              },
            });
            if (res.ok) {
              setGiftNote(
                `Sold ${res.plaintextCode} · $${dollars.toFixed(2)} · issuer ${issuer.name}. Not sold online.`,
              );
              return;
            }
            if (res.error?.includes("Max ")) {
              setGiftNote(res.error);
              return;
            }
          } catch {
            /* isolated demo — local ledger */
          }
        }
        const res = issueGiftCard({
          amountCents: cents,
          issuerId: issuer.id,
          tender: giftSellTender,
        });
        if (res.ok && res.code) {
          setGiftNote(`Sold ${res.code} · $${dollars.toFixed(2)}. Not sold online.`);
        } else setGiftNote(res.error ?? "Could not sell gift card");
      } catch (e) {
        setGiftNote(e instanceof Error ? e.message : "Could not sell gift card");
      }
    })();
  };

  const checkGiftBalance = () => {
    const code = giftCode.trim();
    if (!code) {
      setGiftNote("Enter a gift card code");
      return;
    }
    const loc =
      usePosStore.getState().tenantLocationId ||
      readTenantPosContext()?.locationId ||
      "";
    void (async () => {
      try {
        if (loc && wanOnline) {
          const res = await lookupGiftCardFn({ data: { locationId: loc, code } });
          if (!res.ok) {
            setGiftNote(res.error ?? "Card not found");
            return;
          }
          setGiftNote(`Balance ${formatCurrency(res.card.balanceCents)} · ${res.card.status}`);
          return;
        }
        const needle = code.replace(/[\s-]/g, "").toUpperCase();
        const gc = giftCards.find(
          (g) => g.code.replace(/[\s-]/g, "").toUpperCase() === needle,
        );
        if (!gc) {
          setGiftNote("Card not found");
          return;
        }
        setGiftNote(`Balance ${formatCurrency(gc.balanceCents)} · ${gc.status ?? "active"}`);
      } catch (e) {
        setGiftNote(e instanceof Error ? e.message : "Lookup failed");
      }
    })();
  };

  const voidUsbCard = () => {
    void (async () => {
      if (!order) return;
      const auth = order.cardAuth ?? readSessionCardAuth(order.id);
      const gate = usbCardStep({ link: cardLink, usbAttached, step: "void" });
      if (!gate.ok) {
        setError(gate.message);
        return;
      }
      if (!auth) return;
      setBusy(true);
      setError(null);
      try {
        const ctx = readTenantPosContext();
        const locationId = usePosStore.getState().tenantLocationId || ctx?.locationId || "";
        const orgId = ctx?.orgId || "";
        const authorizationToVoid = auth.authorizationId || auth.finixTransferId || "";
        let released = false;
        if ((!locationId || !orgId || !authorizationToVoid) && cardLink !== "usb") {
          setError("The authorization could not be voided. The check stays open.");
          setBusy(false);
          return;
        }
        if (locationId && orgId && authorizationToVoid) {
          const voided = await voidCheckAuthorizationFn({
            data: {
              locationId,
              orgId,
              authorizationId: authorizationToVoid,
              checkId: order.id,
            },
          });
          released = voided.ok;
          if (!voided.ok && cardLink !== "usb") {
            setError(voided.error || "The authorization could not be voided. The check stays open.");
            setBusy(false);
            return;
          }
        }
        if (!released && cardLink === "usb") {
          const { androidPaxBridge } = await import("@/lib/payments/pax-d135-native");
          const result = await runAndroidPaxVoid({
            link: "usb",
            usbAttached: true,
            transferId: auth.finixTransferId || authorizationToVoid,
            amountCents: auth.amountCents,
            bridge: androidPaxBridge(),
          });
          if (!result.ok) {
            setError(result.message);
            setBusy(false);
            return;
          }
        }
        usePosStore.getState().setCardAuth(order.id, null);
        clearSessionCardAuth(order.id);
        setCardHold(null);
        setCardTip({ kind: "none" });
      } catch (err) {
        setError(err instanceof Error ? err.message : CARD_READER_USB_NOT_CONNECTED);
      }
      setBusy(false);
    })();
  };

  const releaseCardHold = () => {
    const current = usePosStore.getState().getActiveOrder();
    setCardHold(null);
    setCardTip({ kind: "none" });
    setTipCaptureFailed(false);
    if (!current || current.status !== "open") return;
    const auth = current.cardAuth ?? readSessionCardAuth(current.id);
    usePosStore.getState().setCardAuth(current.id, null);
    clearSessionCardAuth(current.id);
    const authorizationId = auth?.authorizationId || auth?.finixTransferId || "";
    if (!authorizationId) return;
    const ctx = readTenantPosContext();
    const locationId = usePosStore.getState().tenantLocationId || ctx?.locationId || "";
    const orgId = ctx?.orgId || "";
    if (!locationId || !orgId) return;
    void voidCheckAuthorizationFn({
      data: {
        locationId,
        orgId,
        authorizationId,
        checkId: current.id,
      },
    }).catch(() => undefined);
  };

  const leavePay = () => {
    payAttempt.current += 1;
    releaseCardHold();
    setError(null);
    setGuestFace(false);
    setDone(false);
    setChange(null);
    onOpenChange(false);
  };

  const tryAnotherMethod = () => {
    payAttempt.current += 1;
    releaseCardHold();
    setError(null);
    setGuestFace(false);
    const next =
      payMethods.find((item) => item !== "card" && item !== method) ??
      payMethods.find((item) => item !== "card");
    if (next) setMethod(next);
  };

  const pay = (manualCard?: ManualCard, tipOverride?: CardTipChoice) => {
    if (payLock.current) return;
    payLock.current = true;
    const attempt = ++payAttempt.current;
    void (async () => {
    try {
    const stale = () => payAttempt.current !== attempt;
    const payTip = method === "card" ? tipCentsForChoice(tipOverride ?? cardTip, tipBase) : tip;
    if (tipOverride) setCardTip(tipOverride);
    setError(null);
    setTipCaptureFailed(false);
    if (!methodEnabled(payCfg, method)) {
      setError("This tender is off at this venue.");
      return;
    }
    if (odsBlocksTender(deviceRole, method)) {
      setError("ODS cannot tender cash or gift. Use an order or host station.");
      return;
    }
    if (method === "comp" && !compReason.trim()) {
      setError("Comp requires a reason.");
      return;
    }
    if (method === "check" && payCfg.checkLast4 && checkLast4.replace(/\D/g, "").length < 4) {
      setError("Enter the check last 4.");
      return;
    }
    if (method === "check" && payCfg.checkManagerWitness) {
      const w = findStaffByPin(
        usePosStore.getState().employees,
        checkWitness,
        usePosStore.getState().tenantLocationId || "",
      );
      if (!w || !isManagerCash(w.role)) {
        setError("Manager witness PIN required for check.");
        return;
      }
    }
    if (method === "cash") {
      const cfg = parseCashHandling(settings.cashHandling);
      const pos = usePosStore.getState();
      const table = order?.tableId ? pos.tables.find((t) => t.id === order.tableId) : undefined;
      const possessed = emp ? useCashSessionStore.getState().hasPossession(emp.id) : false;
      const decision = !emp
        ? { ok: false as const, error: "Sign in to take cash." }
        : previewCashSale({
            cfg,
            emp,
            deviceRole: cashRoleFromSession(useStationSessionStore.getState().assignment.kind),
            deviceId: pos.activeDeviceId,
            order,
            paymentMethods: settings.paymentMethods,
            table,
          });
      if (!decision.ok) {
        setError(
          !possessed && decision.error === "Open your bank first (declare opening cash)."
            ? "Open your bank first (declare opening cash)."
            : decision.error,
        );
        return;
      }
      const sink = decision.sink;
      const { useTillCloseoutStore } = await import("@/lib/pos/till-closeout-store");
      const blocked = useTillCloseoutStore.getState().cashBlockedFor(
        sink.type === "drawer" ? sink.drawer.id : `bank:${emp?.id ?? ""}`,
        sink.type === "bank" ? emp?.id ?? null : null,
      );
      if (blocked) {
        setError("This till is closing. New cash sales are blocked until a manager opens it again.");
        return;
      }
    }
    let cardLast4 = method === "card" ? last4 || undefined : undefined;
    let squarePaymentId: string | undefined;
    let finixTransferId: string | undefined;
    let authorizationId: string | undefined;
    let quantumPaymentId: string | undefined;
    let paxJournal: { readerId: string; merchantId: string; locationId: string; orgId: string } | null = null;
    const held =
      method === "card" ? (order?.cardAuth ?? readSessionCardAuth(order?.id) ?? null) : null;
    const trainingCard = cardCloseSimulatesTip({
      lifecycleStatus: settings.lifecycleStatus,
      paymentsMode: payStatus?.mode,
      lifecycleForcesSandbox: payStatus?.lifecycleForcesSandbox,
      captureSandbox: sandbox,
    });
    const simulateClose = method === "card" && Boolean(held) && (trainingCard || payTip <= 0);
    if ((method === "card" || method === "room_charge") && !wanOnline && !simulateClose) {
      if (method === "card" && held) {
        logTipAdjust({
          phase: "response",
          sandbox: trainingCard,
          simulated: false,
          authorizationId: held.authorizationId || held.finixTransferId || "",
          captureAmountCents: held.amountCents + payTip,
          tipCents: payTip,
          checkId: order?.id,
          ok: false,
          error: "Card requires connection",
        });
        setTipCaptureFailed(true);
        setError(visibleTipFailure("Card requires connection"));
        return;
      }
      setError("Card requires connection. Take another enabled tender or keep the check open.");
      setMethod(firstEnabledMethod(payCfg, "cash"));
      return;
    }
    if (method === "card" && cardLink === "usb" && settings.cardProcessor !== "square" && !held) {
      const gate = usbCardStep({
        link: "usb",
        usbAttached,
        step: "authorize",
      });
      if (!gate.ok) {
        setError(gate.message);
        return;
      }
    }
    if (method === "card" && held && stationClass === "handheld" && !signed) {
      setGuestFace(true);
      setError("Sign for the tip.");
      return;
    }
    if (method === "card" && held) {
      cardLast4 = held.last4 || cardLast4;
      squarePaymentId = held.squarePaymentId;
      finixTransferId = held.finixTransferId;
      authorizationId = held.authorizationId || held.finixTransferId;
      quantumPaymentId = held.paymentId;
    } else if (method === "card" && manualCard) {
      const ctx = readTenantPosContext();
      const locationId = usePosStore.getState().tenantLocationId || ctx?.locationId || "";
      const orgId = ctx?.orgId || "";
      if (!locationId || !orgId) {
        setError("Card requires connection. Take cash or keep the check open.");
        return;
      }
      if (
        !manualCardEntryVisible({
          lifecycleStatus: settings.lifecycleStatus,
          paymentsMode: payStatus?.mode,
          lifecycleForcesSandbox: payStatus?.lifecycleForcesSandbox,
        })
      ) {
        setError("Manual entry is off when the location is live.");
        return;
      }
      const tend = Math.min(amountCents, balance);
      const entities = order
        ? splitTenderByEntity({
            order,
            settings,
            amountCents: tend,
            tipCents: 0,
            hostName: settings.name,
            operatorName: (id) =>
              usePosStore.getState().vendors.find((v) => v.id === id)?.name ?? id,
          }).map((share) => ({ ...share, amountCents: share.totalCents }))
        : [];
      setBusy(true);
      try {
        const charged = await chargeManualCardFn({
          data: {
            orgId,
            locationId,
            amountCents: tend,
            checkId: order?.id,
            number: manualCard.number,
            expirationMonth: manualCard.expirationMonth,
            expirationYear: manualCard.expirationYear,
            securityCode: manualCard.securityCode,
            postalCode: manualCard.postalCode,
            entities,
          },
        });
        if (!charged.ok) {
          setError(
            redactCardText(charged.error || "Card was not approved. The check stays open.", [
              manualCard.number,
              manualCard.securityCode,
            ]),
          );
          setBusy(false);
          return;
        }
        cardLast4 = charged.last4 || manualCard.number.slice(-4);
        finixTransferId = charged.transferId;
        authorizationId = charged.transferId;
      } catch (err) {
        const detail = err instanceof Error ? err.message.trim() : "";
        setError(
          redactCardText(detail || "Card was not approved. The check stays open.", [
            manualCard.number,
            manualCard.securityCode,
          ]),
        );
        setBusy(false);
        return;
      }
      setBusy(false);
      setManualOpen(false);
      setManualNumber("");
      setManualExp("");
      setManualCvv("");
      setManualZip("");
      setManualError(null);
    } else if (method === "card") {
      const ctx = readTenantPosContext();
      const locationId =
        usePosStore.getState().tenantLocationId || ctx?.locationId || "";
      const orgId = ctx?.orgId || "";
      if (!locationId || !orgId) {
        setError("Card requires connection. Take cash or keep the check open.");
        return;
      }
      if (!usePax && settings.cardProcessor !== "square" && payStatus && payStatus.mode === "live" && !payStatus.liveReady) {
        setError(
          payStatus.message ||
            "Live cards require an enrolled Quantum reader supplied through Summex. Take cash or keep the check open.",
        );
        return;
      }
      const tend = Math.min(amountCents, balance);
      const entities = order
        ? splitTenderByEntity({
            order,
            settings,
            amountCents: tend,
            tipCents: 0,
            hostName: settings.name,
            operatorName: (id) =>
              usePosStore.getState().vendors.find((v) => v.id === id)?.name ?? id,
          }).map((s) => ({ ...s, amountCents: s.totalCents }))
        : [];
      const merchants = payStatus?.entityMerchants ?? [];
      const training = Boolean(payStatus?.lifecycleForcesSandbox || payStatus?.mode === "sandbox");
      if (settings.cardProcessor === "square") {
        setBusy(true);
        setError("Waiting for the Square Terminal.");
        try {
          const paired =
            stationRow?.squareDeviceId ||
            locationDevices.find((device) => device.squareDeviceId)?.squareDeviceId;
          const tableLabel = payTable?.label ? `table ${payTable.label}` : "no table";
          const started = await startSquareCheckoutFn({
            data: {
              locationId,
              amountCents: tend,
              checkId: order?.id,
              referenceId: order?.id,
              note: `Check ${order?.number ?? ""} | ${tableLabel}`,
              deviceId: paired || undefined,
              clientMutationId: uid("mut"),
            },
          });
          if (!started.ok || !started.checkoutId) {
            setError(started.error || "Could not start the Square Terminal. The check stays open.");
            setBusy(false);
            return;
          }
          let final = started;
          const deadline = Date.now() + 90_000;
          while (final.status !== "COMPLETED" && final.status !== "CANCELED" && final.status !== "FAILED") {
            if (Date.now() > deadline) {
              await cancelSquareCheckoutFn({
                data: { locationId, checkoutId: started.checkoutId },
              }).catch(() => undefined);
              setError("Card timed out. The check stays open.");
              setBusy(false);
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 1500));
            final = await squareCheckoutStatusFn({
              data: { locationId, checkoutId: started.checkoutId },
            });
          }
          if (final.status !== "COMPLETED" || !final.paymentId) {
            setError(
              final.status === "CANCELED"
                ? "Card canceled. The check stays open."
                : final.error || "Card failed. The check stays open.",
            );
            setBusy(false);
            return;
          }
          squarePaymentId = final.paymentId;
          cardLast4 = final.last4 || cardLast4;
        } catch {
          setError("Could not reach the Square Terminal. The check stays open.");
          setBusy(false);
          return;
        }
        setBusy(false);
        setError(null);
      } else if (cardLink !== "network" && (usePax || paymentUsesConnectedReader(getPaxStationLink()))) {
        if (!order) {
          setError("No order");
          return;
        }
        const linkNow = getPaxStationLink();
        if (!usePax) {
          setError(PAX_MSG.notConnected);
          return;
        }
        setBusy(true);
        try {
          const { androidPaxBridge } = await import("@/lib/payments/pax-d135-native");
          const locationLive = Boolean(payStatus && payStatus.mode === "live" && !payStatus.lifecycleForcesSandbox);
          const sale = await runAndroidPaxSale({
            checkId: order.id,
            amountCents: tend,
            tipCents: 0,
            locationLive,
            reader: linkNow.reader,
            sellingEntityId: checkSellingEntityId(order.lines),
            sellingEntityIds: checkSellingEntityIds(order.lines),
            alreadyCaptured: checkAlreadyCaptured({
              checkId: order.id,
              status: order.status,
              payments: order.payments,
              cardAuth: Boolean(order.cardAuth),
            }),
            settingUp: linkNow.phase === "setting_up",
            connected: linkNow.phase === "connected",
            bluetoothOff: cardLink === "usb" ? false : linkNow.phase === "bluetooth",
            link: cardLink,
            usbAttached: usbAttached === true,
            bridge: androidPaxBridge(),
          });
          if (!sale.ok) {
            setError(sale.message);
            setBusy(false);
            return;
          }
          cardLast4 = sale.last4 || undefined;
          finixTransferId = sale.transferId;
          authorizationId = sale.transferId;
          paxJournal = {
            readerId: linkNow.reader?.finixDeviceId || "",
            merchantId: linkNow.reader?.finixMerchantId || "",
            locationId,
            orgId,
          };
        } catch (err) {
          const detail = err instanceof Error ? err.message.trim() : "";
          setError(detail || PAX_MSG.unread);
          setBusy(false);
          return;
        }
        setBusy(false);
      } else if (!training && merchants.length) {
        const blocked = entities.find((e) => {
          const m = merchants.find((x) => x.entityId === e.entityId);
          return m ? !m.canCapture : true;
        });
        if (blocked) {
          setError(
            `${blocked.displayName} is not approved for live cards. Use cash or keep the check open.`,
          );
          return;
        }
      }
      if (settings.cardProcessor !== "square" && !usePax) {
      setBusy(true);
      try {
        if (settings.cardProcessor === "stripe") {
          const { handoffStripeReader } = await import("@/lib/payments/stripe-terminal-native");
          await handoffStripeReader(stationRow?.cardReaderId || settings.quantumReaderId || "tmr_simulated");
        }
        const cap = await captureCardPresentFn({
          data: {
            orgId,
            locationId,
            amountCents: tend,
            checkId: order?.id,
            hostBrand: settings.name,
            readerId: stationRow?.cardReaderId || settings.quantumReaderId || undefined,
            clientMutationId: uid("mut"),
            sandboxLast4: payStatus?.mode === "sandbox" ? last4 || "4242" : undefined,
            entities,
          },
        });
        if (!cap.ok) {
          setError(
            cap.error || "Card requires connection. Take cash or keep the check open.",
          );
          setBusy(false);
          return;
        }
        cardLast4 = cap.last4 || cardLast4;
        if (cap.paymentId) quantumPaymentId = cap.paymentId;
        if (cap.authorizationId) {
          finixTransferId = cap.authorizationId;
          authorizationId = cap.authorizationId;
        }
      } catch {
        setError("Card requires connection. Take cash or keep the check open.");
        setBusy(false);
        return;
      }
      setBusy(false);
      }
    }
    if (stale()) {
      setBusy(false);
      return;
    }
    if (method === "card" && !held) {
      const authAmount = order
        ? cardAuthorizationCents(order, settings, amount ? amountCents : null)
        : Math.min(amountCents, balance);
      const auth: CardAuthHold = {
        last4: cardLast4,
        finixTransferId,
        authorizationId: authorizationId || finixTransferId,
        squarePaymentId,
        paymentId: quantumPaymentId,
        amountCents: authAmount,
        at: Date.now(),
      };
      if (order) {
        usePosStore.getState().setCardAuth(order.id, auth);
        writeSessionCardAuth(order.id, auth);
        void printCardTipSlips(order.id, { amountCents: authAmount, last4: cardLast4 });
      }
      if (finixTransferId && paxJournal && order) {
        try {
          await recordPaxSaleFn({
            data: {
              locationId: paxJournal.locationId,
              orgId: paxJournal.orgId,
              checkId: order.id,
              transferId: finixTransferId,
              last4: cardLast4 ?? null,
              amountCents: authAmount,
              readerId: paxJournal.readerId,
              merchantId: paxJournal.merchantId,
              status: "authorized",
            },
          });
        } catch {
          /* The authorization is stored on the check. Do not send another sale. */
        }
      }
      setCardTip({ kind: "none" });
      setSigned(false);
      setBusy(false);
      setError(null);
      setCardHold("Card authorized - tip not yet applied.");
      if (stationClass === "handheld") setGuestFace(true);
      return;
    }
    let serverGift = false;
    if (method === "gift_card") {
      const loc =
        usePosStore.getState().tenantLocationId ||
        readTenantPosContext()?.locationId ||
        "";
      if (loc && wanOnline) {
        const emp = usePosStore.getState().getCurrentEmployee?.();
        const fulfiller = fulfillingIssuer(emp, settings, usePosStore.getState().vendors);
        setBusy(true);
        try {
          const red = await redeemGiftCardFn({
            data: {
              locationId: loc,
              code: giftCode,
              amountCents: Math.min(amountCents, balance) + payTip,
              fulfillerId: fulfiller.id,
              fulfillerKind: fulfiller.kind,
              checkId: order?.id,
            },
          });
          if (!red.ok) {
            setError(red.error || "Gift card failed");
            setBusy(false);
            return;
          }
          serverGift = true;
          const { hydrateGift } = await import("@/lib/gift/sync");
          await hydrateGift(loc);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Gift card failed");
          setBusy(false);
          return;
        }
        setBusy(false);
      }
    }
    const authToCapture =
      method === "card" && held && settings.cardProcessor !== "square" && !squarePaymentId
        ? authorizationId || held.authorizationId || held.finixTransferId || ""
        : "";
    if (authToCapture && held) {
      const ctx = readTenantPosContext();
      const locationId = usePosStore.getState().tenantLocationId || ctx?.locationId || "";
      const orgId = ctx?.orgId || "";
      const trace = {
        authorizationId: authToCapture,
        captureAmountCents: held.amountCents + payTip,
        tipCents: payTip,
        checkId: order?.id,
      };
      if (trainingCard || payTip <= 0) {
        // temporary: remove after tip close is confirmed
        logTipAdjust({
          phase: "request",
          sandbox: trainingCard,
          simulated: true,
          ...trace,
        });
        logTipAdjust({
          phase: "response",
          sandbox: trainingCard,
          simulated: true,
          ok: true,
          ...trace,
        });
        if (!finixTransferId) finixTransferId = authToCapture;
      } else if (!locationId || !orgId) {
        logTipAdjust({
          phase: "response",
          sandbox: false,
          simulated: false,
          ok: false,
          error: "Card requires connection",
          ...trace,
        });
        if (stale()) {
          setBusy(false);
          return;
        }
        setTipCaptureFailed(true);
        setError(visibleTipFailure("Card requires connection"));
        setBusy(false);
        return;
      } else {
        setBusy(true);
        // temporary: remove after tip close is confirmed
        logTipAdjust({ phase: "request", sandbox: trainingCard, simulated: false, ...trace });
        try {
          const captured = await captureCheckAuthorizationFn({
            data: {
              locationId,
              orgId,
              authorizationId: authToCapture,
              captureAmountCents: held.amountCents + payTip,
              tipCents: payTip,
              checkId: order?.id,
              paymentId: quantumPaymentId,
            },
          });
          const closeWithTip = simulateClose || Boolean(captured.sandbox) || payTip <= 0;
          logTipAdjust({
            phase: "response",
            sandbox: trainingCard || Boolean(captured.sandbox),
            simulated: !captured.ok && closeWithTip,
            authorizationId: authToCapture,
            captureAmountCents: held.amountCents + payTip,
            tipCents: payTip,
            checkId: order?.id,
            ok: captured.ok || closeWithTip,
            error: captured.ok ? undefined : captured.error,
            transferId: captured.ok ? captured.transferId ?? undefined : undefined,
          });
          if (!captured.ok && !closeWithTip) {
            if (stale()) {
              setBusy(false);
              return;
            }
            setTipCaptureFailed(true);
            setError(visibleTipFailure(captured.error));
            setBusy(false);
            return;
          }
          if (captured.ok && captured.transferId) finixTransferId = captured.transferId;
          else if (!finixTransferId) finixTransferId = authToCapture;
        } catch (err) {
          const message = err instanceof Error ? err.message : "The tip capture call failed.";
          logTipAdjust({
            phase: "response",
            sandbox: trainingCard,
            simulated: simulateClose,
            ok: simulateClose,
            error: message,
            ...trace,
          });
          if (stale()) {
            setBusy(false);
            return;
          }
          if (!simulateClose && payTip > 0) {
            setTipCaptureFailed(true);
            setError(visibleTipFailure(message));
            setBusy(false);
            return;
          }
          if (!finixTransferId) finixTransferId = authToCapture;
        }
        setBusy(false);
      }
    } else if (method === "card" && held && cardLink === "usb" && settings.cardProcessor !== "square") {
      const usbTrace = {
        authorizationId: held.finixTransferId || finixTransferId || "",
        captureAmountCents: held.amountCents + payTip,
        tipCents: payTip,
        checkId: order?.id,
      };
      if (trainingCard || payTip <= 0) {
        logTipAdjust({ phase: "request", sandbox: trainingCard, simulated: true, ...usbTrace });
        logTipAdjust({
          phase: "response",
          sandbox: trainingCard,
          simulated: true,
          ok: true,
          ...usbTrace,
        });
        if (!finixTransferId) finixTransferId = held.finixTransferId || usbTrace.authorizationId;
      } else {
      logTipAdjust({ phase: "request", sandbox: trainingCard, simulated: false, ...usbTrace });
      const { androidPaxBridge } = await import("@/lib/payments/pax-d135-native");
      let finished: { ok: true; skipped?: boolean } | { ok: false; message: string };
      try {
        finished = await runAndroidPaxCapture({
          link: "usb",
          usbAttached: usbAttached === true,
          transferId: held.finixTransferId || finixTransferId || "",
          amountCents: held.amountCents + payTip,
          bridge: androidPaxBridge(),
        });
      } catch (err) {
        finished = { ok: false, message: err instanceof Error ? err.message : "The tip capture call failed." };
      }
      logTipAdjust({
        phase: "response",
        sandbox: trainingCard,
        simulated: !finished.ok && simulateClose,
        ok: finished.ok || simulateClose,
        error: finished.ok ? undefined : finished.message,
        ...usbTrace,
      });
      if (!finished.ok && !simulateClose) {
        if (stale()) {
          setBusy(false);
          return;
        }
        setTipCaptureFailed(true);
        setError(visibleTipFailure(finished.message));
        setBusy(false);
        return;
      }
      if (!finished.ok && !finixTransferId) finixTransferId = held.finixTransferId || usbTrace.authorizationId;
      }
    }
    if (stale()) {
      setBusy(false);
      return;
    }
    const closeCents = method === "card" && held ? held.amountCents : Math.min(amountCents, balance);
    const res = takePayment({
      method,
      amountCents: closeCents,
      tipCents: payTip,
      tenderedCents:
        method === "cash"
          ? Math.round(parseFloat(tendered || "0") * 100) ||
            amountCents + payTip
          : undefined,
      last4: cardLast4,
      squarePaymentId,
      finixTransferId,
      authorizationId: authorizationId || held?.authorizationId,
      giftCardCode: method === "gift_card" ? giftCode : undefined,
      serverGift,
    });
    if (!res.ok) {
      setError(res.error ?? "Payment failed");
      return;
    }
    if (method === "card" && order) {
      clearSessionCardAuth(order.id);
    }
    if (finixTransferId && paxJournal && order) {
      try {
        await recordPaxSaleFn({
          data: {
            locationId: paxJournal.locationId,
            orgId: paxJournal.orgId,
            checkId: order.id,
            transferId: finixTransferId,
            last4: cardLast4 ?? null,
            amountCents: Math.min(amountCents, balance) + payTip,
            readerId: paxJournal.readerId,
            merchantId: paxJournal.merchantId,
          },
        });
      } catch {
        /* The check already stores the transfer. Do not send another sale. */
      }
    }
    if (method === "gift_card") {
      useMarketingStore.getState().logGiftTxn({
        giftCardId: giftCode,
        type: "redeem",
        amountCents: Math.min(amountCents, balance) + payTip,
        note: giftCode,
      });
    }
    if (res.changeCents != null && res.changeCents > 0) {
      setChange(res.changeCents);
    }
    const o = usePosStore.getState().getActiveOrder();
    if (!o || o.status === "closed") {
      setDone(true);
      if (method === "card") setCardReceiptAsk(true);
    } else {
      setTip(0);
      setCardTip({ kind: "none" });
      setAmount("");
      setTendered("");
    }
    } finally {
      payLock.current = false;
    }
    })();
  };

  const submitManual = () => {
    const parsed = parseManualCard({
      number: manualNumber,
      expiration: manualExp,
      securityCode: manualCvv,
      postalCode: manualZip,
    });
    if (!parsed.ok) {
      setManualError(parsed.error);
      return;
    }
    setManualError(null);
    pay(parsed.card);
  };

  const finish = () => {
    const o = usePosStore.getState().getActiveOrder();
    const closed = !o || o.status === "closed";
    const tableId = closed ? o?.tableId : undefined;
    setDone(false);
    setChange(null);
    setTip(0);
    setCardTip({ kind: "none" });
    setAmount("");
    setReceiptChoice("choose");
    setCardReceiptAsk(false);
    setReceiptMsg(null);
    setReceiptEmail("");
    setTipCaptureFailed(false);
    onOpenChange(false);
    if (closed) {
      usePosStore.getState().setActiveOrder(null);
      setView(tableId ? "floor" : "order");
    }
  };

  const answerCardReceipt = async (yes: boolean) => {
    if (!yes) {
      setCardReceiptAsk(false);
      setReceiptMsg(null);
      finish();
      return;
    }
    if (!order || receiptBusy) return;
    setReceiptBusy(true);
    setReceiptMsg(null);
    try {
      const res = await printGuestReceipt(order.id, "guest");
      if (!res.ok) {
        setReceiptMsg(res.error || "Print failed");
        setReceiptBusy(false);
        return;
      }
      setCardReceiptAsk(false);
      setReceiptBusy(false);
      finish();
    } catch {
      setReceiptMsg("Print failed. Check the mapped receipt printer.");
      setReceiptBusy(false);
    }
  };

  const runPrintReceipt = async () => {
    if (!order) return;
    setReceiptBusy(true);
    setReceiptMsg(null);
    try {
      const res = await printGuestReceipt(order.id);
      if (!res.ok) {
        setReceiptMsg(res.error || "Print failed");
        setReceiptBusy(false);
        return;
      }
      clearReceiptPending(order.id);
      finish();
    } catch {
      setReceiptMsg("Print failed. Check the mapped receipt printer.");
      setReceiptBusy(false);
    }
  };

  const runEmailReceipt = async () => {
    if (!order) return;
    const loc =
      usePosStore.getState().tenantLocationId ||
      readTenantPosContext()?.locationId ||
      "";
    const view = buildGuestCheckView({
      order,
      settings,
      hostName: settings.name,
      operatorName: (id) =>
        usePosStore.getState().vendors.find((v) => v.id === id)?.name ?? id,
    });
    setReceiptBusy(true);
    setReceiptMsg(null);
    try {
      const r = await sendGuestReceiptFn({
        data: {
          locationId: loc,
          to: receiptEmail,
          subject: `${settings.name} receipt #${order.number}`,
          text: guestCheckText(view),
          html: guestCheckHtml(view),
        },
      });
      if (!r.ok) {
        setReceiptMsg(r.error || "Email is down. Print the receipt instead.");
        setReceiptBusy(false);
        return;
      }
      finish();
    } catch {
      setReceiptMsg("Email is down. Print the receipt instead.");
      setReceiptBusy(false);
    }
  };

  const runSmsReceipt = async () => {
    if (!order) return;
    const loc =
      usePosStore.getState().tenantLocationId ||
      readTenantPosContext()?.locationId ||
      "";
    const view = buildGuestCheckView({
      order,
      settings,
      hostName: settings.name,
      operatorName: (id) =>
        usePosStore.getState().vendors.find((v) => v.id === id)?.name ?? id,
    });
    setReceiptBusy(true);
    setReceiptMsg(null);
    try {
      const r = await sendGuestReceiptSmsFn({
        data: {
          locationId: loc,
          to: receiptSms,
          text: `${settings.name} receipt #${order.number}. ${guestCheckText(view).slice(0, 1200)}`,
        },
      });
      if (!r.ok) {
        setReceiptMsg(r.error || "SMS is down. Email or print the receipt instead.");
        setReceiptBusy(false);
        return;
      }
      finish();
    } catch {
      setReceiptMsg("SMS is down. Email or print the receipt instead.");
      setReceiptBusy(false);
    }
  };

  const shownError = error ? visibleTipFailure(error) : null;

  if (!order || !totals || !dual) return null;

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          payAttempt.current += 1;
          const current = usePosStore.getState().getActiveOrder();
          const closed = current?.status === "closed";
          const tableId = current?.tableId;
          if (current?.status === "open") releaseCardHold();
          setDone(false);
          setChange(null);
          setTip(0);
          setCardTip({ kind: "none" });
          setError(null);
          setReceiptEmail("");
          setReceiptMsg(null);
          setReceiptChoice("choose");
          setCardReceiptAsk(false);
          setCheckPrintMsg(null);
          setTipCaptureFailed(false);
          setGuestFace(false);
          onOpenChange(o);
          if (closed) {
            usePosStore.getState().setActiveOrder(null);
            setView(tableId ? "floor" : "order");
          }
          return;
        }
        onOpenChange(o);
      }}
    >
      <DialogContent
        data-station-pay=""
        data-pay-sheet=""
        overlayClassName="station-pay-overlay"
        className="bottom-[var(--pay-nav-clear,4.75rem)] left-1/2 right-auto top-auto flex max-h-[min(62dvh,34rem)] w-[min(calc(100vw-1rem),40rem)] max-w-none translate-x-[-50%] translate-y-0 flex-col gap-1.5 overflow-hidden rounded-none rounded-t-2xl p-2.5"
      >
        <DialogHeader className="shrink-0 gap-0">
          <DialogTitle className="flex items-center justify-between gap-2 pr-6 text-base leading-none">
            <span>
              {done
                ? "Payment complete"
                : `Pay check #${order.number}`}
            </span>
            <GuideLearnLink
              topicId={method === "cash" ? "cash-discount" : "quantum-payments"}
              compact
            >
              {method === "cash" ? "Cash discount" : "Quantum Payments"}
            </GuideLearnLink>
          </DialogTitle>
        </DialogHeader>
        {method === "card" && (payStatus?.mode === "sandbox" || sandbox) && (
          <p
            className="shrink-0 truncate rounded-md bg-warn/15 px-2 py-1 text-[11px] font-semibold leading-none text-warn"
            data-pay-training=""
          >
            TRAINING — Quantum Payments sandbox. Not a live card capture. Cash and gift still work without a reader.
          </p>
        )}
        {method === "card" && cardHoldAuth && !done && !guestFace ? (
          <div className="shrink-0 rounded-lg border border-border bg-bg px-2 py-1.5" data-pay-tip-panel="">
            <CardTipRow
              baseCents={tipBase}
              tipCents={payTip}
              choice={cardTip}
              onChoice={setCardTip}
              onApply={(choice) => pay(undefined, choice)}
            />
          </div>
        ) : null}
        {method === "card" && payStatus?.mode === "live" && (
          <p className="shrink-0 truncate rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium leading-none">
            Live Quantum Payments. Cash and gift work without a reader.
            {payStatus.liveReady ? "" : ` ${payStatus.message ?? ""}`}
          </p>
        )}
        {done || guestFace ? (
        <div className="station-pay-scroll">
        {done ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-3xl font-semibold tabular text-success">
              Paid
            </p>
            {change != null && change > 0 && (
              <p className="text-lg">
                Change due{" "}
                <span className="font-semibold tabular">
                  {formatCurrency(change)}
                </span>
              </p>
            )}
            {(() => {
              const view = buildGuestCheckView({
                order,
                settings,
                hostName: settings.name,
                operatorName: (id) =>
                  usePosStore.getState().vendors.find((v) => v.id === id)?.name ?? id,
              });
              return (
                <div className="rounded-xl border border-border bg-bg p-3 text-left">
                  <GuestCheckByVendor
                    view={view}
                    compact
                    serverLabel={guestStaffName(
                      (() => {
                        const person = usePosStore.getState().employees.find((row) => row.id === order.serverId);
                        return person
                          ? { firstName: person.firstName, lastName: person.lastName, name: person.name || order.serverName }
                          : order.serverName;
                      })(),
                    )}
                  />
                  {view.vendors.length > 1 ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {view.allocations.map((a) => (
                        <li key={a.entityId} className="flex justify-between gap-2">
                          <span>{a.displayName}</span>
                          <span className="tabular">{formatCurrency(a.totalCents)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">{view.splitNote}</p>
                </div>
              );
            })()}
            <p className="text-sm text-muted-foreground">
              Charged as{" "}
              {order.payments[order.payments.length - 1]?.chargeBrand ||
                settings.name}{" "}
              {order.payments[order.payments.length - 1]?.method === "card"
                ? "via Quantum Payments"
                : order.payments[order.payments.length - 1]?.method === "cash"
                  ? "cash"
                  : order.payments[order.payments.length - 1]?.method === "gift_card"
                    ? "gift"
                    : ""}
              . Tip recorded: {formatCurrency(payTip)}
            </p>
            {dual.enabled && order.payments.some((p) => p.method === "cash") && (
              <p className="text-xs text-muted-foreground">
                Cash {formatCurrency(dual.cash.totalCents)} · Cash discount applied
              </p>
            )}
            {cardReceiptAsk ? (
              <div
                className="space-y-3 rounded-xl border border-border bg-bg p-4"
                data-card-receipt-ask
                role="dialog"
                aria-label="Does the customer want a receipt?"
              >
                <p className="text-lg font-semibold">Does the customer want a receipt?</p>
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  disabled={receiptBusy}
                  data-card-receipt-yes=""
                  onClick={() => void answerCardReceipt(true)}
                >
                  <Printer className="h-5 w-5" />
                  Yes
                </Button>
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  variant="outline"
                  disabled={receiptBusy}
                  data-card-receipt-no=""
                  onClick={() => answerCardReceipt(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <p className="text-sm font-medium">Receipt</p>
            )}
            {!cardReceiptAsk && receiptChoice === "choose" && (
              <div className="grid gap-2">
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  data-receipt-email=""
                  onClick={() => {
                    setReceiptChoice("email");
                    setReceiptMsg(null);
                  }}
                >
                  <Mail className="h-5 w-5" />
                  Email
                </Button>
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  variant="outline"
                  data-receipt-text=""
                  onClick={() => {
                    setReceiptChoice("sms");
                    setReceiptMsg(null);
                  }}
                >
                  Text
                </Button>
                {mayPrintReceipt && (
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  variant="outline"
                  disabled={receiptBusy}
                  data-receipt-print=""
                  onClick={() => void runPrintReceipt()}
                >
                  <Printer className="h-5 w-5" />
                  Print
                </Button>
                )}
                {stationClass === "handheld" && (
                  <Button
                    size="lg"
                    className="station-touch min-h-12 w-full"
                    variant="outline"
                    onClick={() => {
                      flagReceiptPending(order.id);
                      finish();
                    }}
                  >
                    Open on terminal
                  </Button>
                )}
                <Button
                  size="lg"
                  className="station-touch min-h-12 w-full"
                  variant="outline"
                  onClick={finish}
                >
                  <Ban className="h-5 w-5" />
                  None
                </Button>
              </div>
            )}
            {receiptChoice === "sms" && (
              <div className="space-y-2 text-left">
                <Input
                  type="tel"
                  placeholder="Mobile number"
                  value={receiptSms}
                  onChange={(e) => setReceiptSms(e.target.value)}
                  autoFocus
                />
                <Button
                  className="station-touch min-h-12 w-full"
                  size="lg"
                  disabled={!receiptSms.trim() || receiptBusy}
                  onClick={() => void runSmsReceipt()}
                >
                  Send text
                </Button>
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => {
                    setReceiptChoice("choose");
                    setReceiptMsg(null);
                  }}
                >
                  Back
                </Button>
              </div>
            )}
            {receiptChoice === "email" && (
              <div className="space-y-2 text-left">
                <Input
                  type="email"
                  placeholder="Guest email"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  autoFocus
                />
                <Button
                  className="station-touch min-h-12 w-full"
                  size="lg"
                  disabled={!receiptEmail.trim() || receiptBusy}
                  onClick={() => void runEmailReceipt()}
                >
                  Send email
                </Button>
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => {
                    setReceiptChoice("choose");
                    setReceiptMsg(null);
                  }}
                >
                  Back
                </Button>
              </div>
            )}
            {receiptMsg ? (
              <p className="text-sm text-danger" role="status">
                {receiptMsg}
              </p>
            ) : null}
            {receiptMsg && /print/i.test(receiptMsg) && (
              <Button
                className="station-touch min-h-12 w-full"
                size="lg"
                variant="outline"
                disabled={receiptBusy}
                onClick={() => void runPrintReceipt()}
              >
                <Printer className="h-5 w-5" />
                Print instead
              </Button>
            )}
            {order.tableId && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  clearTable(order.tableId!);
                  finish();
                }}
              >
                Bus table now
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4" data-guest-pay-face>
            <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
              {settings.name}
            </p>
            <p className="text-center text-3xl font-semibold tabular" data-card-charge-total="">
              {formatCurrency(cardTotal)}
            </p>
            <p className="text-center text-sm text-muted-foreground">Amount + tip</p>
            <p className="text-center text-sm" data-card-auth-note="">
              Card authorized - tip not yet applied.
            </p>
            <CardTipRow
              baseCents={tipBase}
              tipCents={payTip}
              choice={cardTip}
              onChoice={setCardTip}
              onApply={cardHoldAuth ? (choice) => pay(undefined, choice) : undefined}
            />
            <GuestSignPad
              onSigned={() => setSigned(true)}
              onCleared={() => setSigned(false)}
            />
            {cardHold && (
              <p className="text-center text-sm text-ivory" data-quantum-hold>
                {cardHold}
              </p>
            )}
            {shownError && (
              <p className="text-center text-sm text-danger" role="alert">
                {shownError}
              </p>
            )}
            <Button
              className="w-full"
              size="xl"
              disabled={busy || !signed}
              onClick={() => pay()}
            >
              {busy ? "Present card on Quantum reader…" : "Apply tip and close"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setGuestFace(false)}>
              Back to staff
            </Button>
            {tipCaptureFailed && cardHoldAuth ? (
              <div className="grid grid-cols-2 gap-1.5" data-tip-recovery="">
                <Button
                  type="button"
                  variant="outline"
                  className="station-touch min-h-12 whitespace-normal px-1 text-sm"
                  data-close-no-tip=""
                  disabled={busy}
                  onClick={() => pay(undefined, { kind: "none" })}
                >
                  Close with no tip
                </Button>
                <Button
                  type="button"
                  className="station-touch min-h-12"
                  data-tip-retry=""
                  disabled={busy}
                  onClick={() => pay()}
                >
                  Retry
                </Button>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-1.5" data-pay-exit="">
              <Button
                type="button"
                variant="outline"
                className="station-touch min-h-12 px-1 text-sm"
                data-pay-back=""
                disabled={busy}
                onClick={() => {
                  setGuestFace(false);
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                className="station-touch min-h-12 whitespace-normal px-1 text-xs leading-tight"
                data-pay-try-another=""
                disabled={busy}
                onClick={tryAnotherMethod}
              >
                Try another method
              </Button>
              <Button
                type="button"
                variant="outline"
                className="station-touch min-h-12 px-1 text-sm"
                data-pay-cancel=""
                onClick={leavePay}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto" data-pay-body="">
            {!wanOnline && (
              <p className="truncate rounded-md border border-warn/40 bg-warn/15 px-2 py-1 text-[11px] leading-none text-foreground">
                Card requires connection. Take cash or keep the check open. Gift and comps still work. Card is not queued.
              </p>
            )}
            {guestSlip && guestSlip.vendors.length > 0 && (
              <PayCheckSummary
                view={guestSlip}
                dueCents={method === "card" ? cardTotal : balance}
                serverLabel={guestStaffName(
                  (() => {
                    const person = usePosStore.getState().employees.find((row) => row.id === order.serverId);
                    return person
                      ? { firstName: person.firstName, lastName: person.lastName, name: person.name || order.serverName }
                      : order.serverName;
                  })(),
                )}
              />
            )}
            {mayPrintCheck ? (
            <Button
              size="lg"
              className="station-touch min-h-12 w-full"
              disabled={
                checkPrintBusy ||
                order.lines.filter((l) => !l.voided).length === 0
              }
              onClick={() => {
                setCheckPrintBusy(true);
                setCheckPrintMsg(null);
                printCheck();
                void printGuestCheck(order.id)
                  .then((r) => {
                    const msg = r.ok
                      ? `Sending to ${r.sentTo || "receipt printer"}`
                      : r.error || NO_SECTION_RECEIPT;
                    setCheckPrintMsg(msg);
                    if (r.ok) toast.success(msg);
                    else toast.error(msg);
                  })
                  .catch(() => setCheckPrintMsg("Print failed"))
                  .finally(() => setCheckPrintBusy(false));
              }}
            >
              <Printer className="h-4 w-4" />
              Print Guest Check
            </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground" data-add-receipt-printer>
                {ADD_RECEIPT_PRINTER}
              </p>
            )}
            {checkPrintMsg && (
              <p className="text-center text-[11px] leading-none text-muted-foreground" role="status">
                {checkPrintMsg}
              </p>
            )}
            {method === "card" ? (
              <p className="text-center text-[11px] leading-none text-muted-foreground" data-card-charge-total="">
                {cardHoldAuth
                  ? `Authorized ${formatCurrency(cardDue)} · Tip ${formatCurrency(payTip)}`
                  : `Card ${formatCurrency(cardTotal)}. Tip is entered after the card is read.`}
              </p>
            ) : (
              <p className="text-center text-[11px] leading-none text-muted-foreground">
                {cashOn ? `Cash due ${formatCurrency(balance)}` : `Due ${formatCurrency(balance)}`}
                {dual.enabled && method === "cash" ? ` · Cash total ${formatCurrency(dual.cash.totalCents)}` : ""}
              </p>
            )}

            <Tabs
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
              className="flex min-h-0 flex-col"
            >
              <div className="grid grid-cols-4 gap-1.5" data-pay-methods="">
                {payMethods.map((m) => {
                  const Icon =
                    m === "card"
                      ? CreditCard
                      : m === "cash"
                        ? Banknote
                        : m === "gift_card"
                          ? Gift
                          : m === "comp"
                            ? Percent
                            : m === "house_account"
                              ? Building2
                              : FileText;
                  const blockedCash = m === "cash" && odsBlocked;
                  const blockedGift = m === "gift_card" && odsBlocked;
                  const blockedCard = m === "card" && !wanOnline && !cardHoldAuth;
                  return (
                    <Button
                      key={m}
                      size="lg"
                      className="station-touch h-12 min-h-12 w-full px-1 text-sm font-semibold"
                      variant={method === m ? "default" : "outline"}
                      disabled={blockedCash || blockedGift || blockedCard}
                      title={
                        blockedCard
                          ? "Card requires connection"
                          : blockedGift
                            ? "ODS cannot tender gift"
                            : blockedCash
                              ? "ODS cannot tender cash"
                              : undefined
                      }
                      onClick={() => setMethod(m)}
                    >
                      <Icon className="h-4 w-4" />
                      {methodLabel(payCfg, m)}
                    </Button>
                  );
                })}
              </div>

              <div className="station-pay-extra mt-1.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="shrink-0 text-xs text-muted-foreground">
                    Amount
                  </label>
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    placeholder={(balance / 100).toFixed(2)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                {odsBlocked && (
                  <p className="rounded-lg bg-warn/15 px-3 py-2 text-xs">
                    This station is ODS. Cash and gift tenders are off. Use an order or host
                    device.
                  </p>
                )}
                {method === "card" ? (
                  cardHoldAuth ? (
                    <p className="text-xs" data-card-auth-note="">
                      Card authorized - tip not yet applied.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground" data-card-auth-wait="">
                      Run card. Tip choices print on the slip, then you enter the tip here.
                    </p>
                  )
                ) : method !== "comp" ? (
                  <div>
                    <label className="mb-1.5 block text-xs text-muted-foreground">
                      Tip
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[0, ...tips].map((t, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant={tip === t ? "default" : "outline"}
                          onClick={() => setTip(t)}
                          className="tabular"
                        >
                          {t === 0 ? "No tip" : formatCurrency(t)}
                          {t > 0 && balance > 0 && (
                            <span className="ml-1 opacity-70">
                              {Math.round((t / balance) * 100)}%
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <TabsContent value="card" className="mt-0 space-y-2">
                  {showManual && !cardHoldAuth ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="station-touch min-h-12 w-full"
                      disabled={busy}
                      data-manual-entry=""
                      onClick={() => {
                        setManualOpen(true);
                        setManualError(null);
                      }}
                    >
                      Enter card manually
                    </Button>
                  ) : null}
                  {showManual && manualOpen && !cardHoldAuth ? (
                    <div className="space-y-2 rounded-lg border border-border p-3" data-manual-form="">
                      <p className="text-xs text-muted-foreground">
                        {stationClass === "handheld"
                          ? "Training and sandbox. Enter the card number, expiration, CVV, and ZIP. A successful charge authorizes the check, then this tablet asks for the tip and a signature."
                          : "Training and sandbox. Enter the card number, expiration, CVV, and ZIP. A successful charge authorizes the check and prints the tip slip. Enter the tip to close."}
                      </p>
                      <Input
                        data-manual-number=""
                        placeholder="Card number"
                        inputMode="numeric"
                        autoComplete="off"
                        value={manualNumber}
                        onChange={(e) => setManualNumber(e.target.value)}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          data-manual-exp=""
                          placeholder="MM/YY"
                          autoComplete="off"
                          value={manualExp}
                          onChange={(e) => setManualExp(e.target.value)}
                        />
                        <Input
                          data-manual-cvv=""
                          placeholder="CVV"
                          inputMode="numeric"
                          autoComplete="off"
                          value={manualCvv}
                          onChange={(e) => setManualCvv(e.target.value)}
                        />
                        <Input
                          data-manual-zip=""
                          placeholder="ZIP"
                          inputMode="numeric"
                          autoComplete="off"
                          value={manualZip}
                          onChange={(e) => setManualZip(e.target.value)}
                        />
                      </div>
                      {manualError ? (
                        <p className="text-xs font-medium" data-manual-error="">
                          {manualError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" data-manual-submit="" disabled={busy || Boolean(cardHoldAuth)} onClick={submitManual}>
                          {busy ? "Authorizing…" : cardHoldAuth ? "Card authorized" : "Run card"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setManualOpen(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {!wanOnline && (
                    <p className="rounded-lg bg-warn/15 px-3 py-2 text-xs font-medium">
                      Card requires connection. Take cash or keep the check open. Card is
                      not queued.
                    </p>
                  )}
                  {(cardLink === "usb" || usePax || scanStandIn || payEntityBanner || pax.phase !== "idle" || pax.rows.length > 0) && (
                    <div className="space-y-2 rounded-lg border border-border p-3" data-pax-reader="">
                      <p
                        className="text-sm font-medium"
                        data-pax-status=""
                        data-pax-connected={pax.phase === "connected" ? pax.reader?.serial ?? "" : ""}
                        data-pax-usb={cardLink === "usb" ? (usbAttached === true ? "ready" : "missing") : ""}
                      >
                        {cardLink === "usb"
                          ? payReaderStatusText({
                              link: "usb",
                              usbAttached,
                              phase: pax.phase,
                              message: pax.message,
                            })
                          : payEntityStatusText(pax, payEntityBanner)}
                        {pax.phase === "connected" && pax.battery != null ? ` · Battery ${pax.battery}%` : ""}
                      </p>
                      {cardLink === "usb" ? null : (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={scanPax}>
                          Scan for reader
                        </Button>
                      </div>
                      )}
                      {pax.rows.map((row) => (
                        <button
                          key={row.serial}
                          type="button"
                          data-pax-serial={row.serial}
                          className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm"
                          onClick={() => pickPax(row)}
                        >
                          {paxScanRowLabel(row, pax.readers)}
                        </button>
                      ))}
                    </div>
                  )}
                  {(payStatus?.mode === "sandbox" || sandbox) && !usePax && pax.phase !== "connected" && (
                    <Input
                      placeholder="Last 4 (sandbox receipt only)"
                      value={last4}
                      maxLength={4}
                      onChange={(e) =>
                        setLast4(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  )}
                  {payStatus?.mode === "live" && (
                    <p className="text-xs text-muted-foreground">
                      Present the card on the Quantum reader. PAN/CVV are never
                      typed into Summex.
                    </p>
                  )}
                  <p className="truncate text-[11px] leading-none text-muted-foreground">
                    One guest tender through Quantum Payments. Each brand settles on its own account.
                  </p>
                </TabsContent>

                <TabsContent value="cash" className="mt-0 space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Cash tendered
                  </label>
                  <Input
                    inputMode="decimal"
                    placeholder={((amountCents + payTip) / 100).toFixed(2)}
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[...cashPresets, ...quickCash]
                      .filter((v, i, a) => a.indexOf(v) === i && v > 0)
                      .slice(0, 8)
                      .map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          variant="outline"
                          className="tabular"
                          onClick={() => setTendered((v / 100).toFixed(2))}
                        >
                          {formatCurrency(v)}
                        </Button>
                      ))}
                  </div>
                </TabsContent>

                <TabsContent value="gift_card" className="mt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    First-party ledger. Sell and redeem on this paired station with a staff PIN.
                    No public website purchase. No shipping. No third-party gift networks.
                  </p>
                  <div className="space-y-2 rounded-lg border border-border p-2" data-demo="gift-sell">
                    <p className="text-xs font-medium">Sell gift card</p>
                    <Input
                      placeholder="Amount USD"
                      value={giftSellAmt}
                      inputMode="decimal"
                      onChange={(e) => setGiftSellAmt(e.target.value)}
                    />
                    <select
                      className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
                      value={giftSellTender}
                      onChange={(e) => setGiftSellTender(e.target.value as "cash" | "card")}
                    >
                      <option value="card">Card (Quantum Payments)</option>
                      <option value="cash">Cash</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Max sell ${(giftLimits.maxSellPerTxnCents / 100).toFixed(2)} per transaction.
                    </p>
                    <Button size="sm" type="button" onClick={() => sellGiftOnStation()}>
                      Sell gift card
                    </Button>
                  </div>
                  <div className="space-y-2" data-demo="gift-redeem">
                    <p className="text-xs font-medium">Redeem / balance check</p>
                    <Input
                      placeholder="Gift card code"
                      value={giftCode}
                      onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
                    />
                    <Button size="sm" variant="outline" type="button" onClick={checkGiftBalance}>
                      Check balance
                    </Button>
                  </div>
                  {giftNote && (
                    <p className="text-xs text-muted-foreground" role="status">
                      {giftNote}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="comp" className="mt-0 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Comp is not a guest tender. Reason required.
                  </p>
                  <Input
                    placeholder="Reason"
                    value={compReason}
                    onChange={(e) => setCompReason(e.target.value)}
                  />
                </TabsContent>

                <TabsContent value="check" className="mt-0 space-y-2">
                  {payCfg.checkLast4 && (
                    <Input
                      placeholder="Check last 4"
                      value={checkLast4}
                      maxLength={4}
                      inputMode="numeric"
                      onChange={(e) => setCheckLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  )}
                  {payCfg.checkManagerWitness && (
                    <Input
                      placeholder="Manager witness PIN"
                      value={checkWitness}
                      maxLength={4}
                      inputMode="numeric"
                      onChange={(e) => setCheckWitness(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  )}
                  {payCfg.checkPhoto && (
                    <p className="text-xs text-muted-foreground">Photo optional — attach from the check bag later if needed.</p>
                  )}
                </TabsContent>

                <TabsContent value="house_account" className="mt-0">
                  <p className="text-xs text-muted-foreground">Charge to company / house account. Not a card capture.</p>
                </TabsContent>

                <TabsContent value="other" className="mt-0">
                  <p className="text-xs text-muted-foreground">
                    {payCfg.otherLabel || "Other"} — counted in closeout. Not Quantum Payments.
                  </p>
                </TabsContent>
              </div>
            </Tabs>

            {shownError && (
              <p className="text-center text-sm text-danger" role="alert">
                {shownError}
              </p>
            )}
          </div>
        )}
        {!done && !guestFace ? (
          <div className="station-pay-actions">
            {shownError ? (
              <p className="text-center text-sm text-danger" role="alert">
                {shownError}
              </p>
            ) : null}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-sm leading-none">
              <span className="text-muted-foreground">Charging</span>
              <span className="text-base font-semibold tabular">
                {formatCurrency(cardTotal)}
              </span>
            </div>

            <Button
              className="station-touch min-h-12 w-full"
              size="lg"
              onClick={() => {
                if (method === "card" && cardHoldAuth && stationClass === "handheld" && !guestFace) {
                  setSigned(false);
                  setError(null);
                  setGuestFace(true);
                  return;
                }
                pay();
              }}
              disabled={busy || (method === "card" && !cardHoldAuth && usbBlocksCard)}
            >
              {busy && "Present card on Quantum reader…"}
              {!busy && method === "card" && !cardHoldAuth && "Run card"}
              {!busy && method === "card" && cardHoldAuth && stationClass === "handheld" && !guestFace && "Tip and signature"}
              {!busy && method === "card" && cardHoldAuth && !(stationClass === "handheld" && !guestFace) && "Apply tip and close"}
              {!busy && method === "cash" && "Take cash"}
              {!busy && method === "gift_card" && "Redeem gift card"}
              {!busy && method === "comp" && "Apply comp"}
              {!busy && method === "check" && "Take check"}
              {!busy && method === "house_account" && "Charge house account"}
              {!busy && method === "other" && `Take ${payCfg.otherLabel || "other"}`}
            </Button>
            {canOpenDrawer ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="station-touch min-h-12 w-full"
                  data-open-drawer=""
                  onClick={() => {
                    setDrawerMsg(null);
                    const preview = usePosStore.getState().openCashDrawer({
                      preview: true,
                      source: "payment",
                      reason: "Open drawer",
                    });
                    if (!preview.ok && preview.code === "manager_pin") {
                      setDrawerPinOpen(true);
                      return;
                    }
                    if (!preview.ok) {
                      setDrawerMsg(preview.error ?? DRAWER_STAYS_CLOSED);
                      return;
                    }
                    const res = usePosStore.getState().openCashDrawer({
                      source: "payment",
                      reason: "Open drawer",
                    });
                    setDrawerMsg(res.ok ? "Drawer opened." : (res.error ?? DRAWER_STAYS_CLOSED));
                  }}
                >
                  Open drawer
                </Button>
                {drawerMsg ? (
                  <p className="text-center text-sm text-muted-foreground" data-drawer-message role="status">
                    {drawerMsg}
                  </p>
                ) : null}
              </>
            ) : null}
            {method === "card" && cardHoldAuth ? (
              <Button
                type="button"
                variant="outline"
                className="station-touch min-h-12 w-full"
                data-void-card=""
                disabled={busy || (cardLink === "usb" && usbAttached !== true)}
                onClick={voidUsbCard}
              >
                Void card
              </Button>
            ) : null}
            {tipCaptureFailed && cardHoldAuth ? (
              <div className="grid grid-cols-2 gap-1.5" data-tip-recovery="">
                <Button
                  type="button"
                  variant="outline"
                  className="station-touch min-h-12 whitespace-normal px-1 text-sm"
                  data-close-no-tip=""
                  disabled={busy}
                  onClick={() => pay(undefined, { kind: "none" })}
                >
                  Close with no tip
                </Button>
                <Button
                  type="button"
                  className="station-touch min-h-12"
                  data-tip-retry=""
                  disabled={busy}
                  onClick={() => pay()}
                >
                  Retry
                </Button>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-1.5" data-pay-exit="">
              <Button
                type="button"
                variant="outline"
                className="station-touch min-h-12 px-1 text-sm"
                data-pay-back=""
                disabled={busy}
                onClick={leavePay}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                className="station-touch min-h-12 whitespace-normal px-1 text-xs leading-tight"
                data-pay-try-another=""
                disabled={busy}
                onClick={tryAnotherMethod}
              >
                Try another method
              </Button>
              <Button
                type="button"
                variant="outline"
                className="station-touch min-h-12 px-1 text-sm"
                data-pay-cancel=""
                onClick={leavePay}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    <ManagerPinDialog
      open={giftMgrOpen}
      onOpenChange={setGiftMgrOpen}
      title="Manager PIN · gift sell"
      description="High-value gift sell needs a manager PIN."
      onVerified={() => {
        setGiftMgrOpen(false);
        sellGiftOnStation({ skipManager: true });
      }}
    />
    <ManagerPinDialog
      open={drawerPinOpen}
      onOpenChange={setDrawerPinOpen}
      title="Open drawer — manager PIN"
      description="A manager PIN opens the cash drawer."
      skipIfAuthed={false}
      denyMessage={DRAWER_PIN_DENIED}
      onDismiss={() => setDrawerMsg(DRAWER_STAYS_CLOSED)}
      onVerified={() => {
        const res = usePosStore.getState().openCashDrawer({
          source: "payment",
          reason: "Open drawer",
        });
        setDrawerMsg(res.ok ? "Drawer opened." : (res.error ?? DRAWER_STAYS_CLOSED));
      }}
    />
    </>
  );
}

function PayCheckSummary({
  view,
  serverLabel,
  dueCents,
}: {
  view: GuestCheckView;
  serverLabel?: string;
  dueCents: number;
}) {
  const lines = view.vendors.flatMap((v) => v.lines);
  const shown = lines.slice(0, 2);
  const extra = lines.length - shown.length;
  return (
    <div className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-left text-sm" data-pay-summary="">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-semibold leading-tight">{view.locationName}</p>
        <p className="shrink-0 text-xl font-semibold tabular leading-none">{formatCurrency(dueCents)}</p>
      </div>
      <p className="truncate text-xs leading-tight text-muted-foreground">
        {serverLabel ? `${serverLabel} · ` : ""}
        {lines.length} item{lines.length === 1 ? "" : "s"}
        {view.vendors.length > 1 ? ` · ${view.vendors.map((v) => v.displayName).join(", ")}` : ""}
      </p>
      {shown.length > 0 ? (
        <ul className="mt-1 space-y-0 text-xs leading-tight">
          {shown.map((line, i) => (
            <li key={`${i}-${line.name}`} className="flex justify-between gap-2">
              <span className="truncate">
                {line.qty > 1 ? `${line.qty}× ` : ""}
                {line.name}
              </span>
              <span className="tabular">{formatCurrency(line.amountCents)}</span>
            </li>
          ))}
          {extra > 0 ? <li className="text-muted-foreground">+ {extra} more</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function GuestSignPad({
  onSigned,
  onCleared,
}: {
  onSigned: () => void;
  onCleared: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="space-y-2" data-guest-sign>
      <p className="text-center text-xs text-muted-foreground">Sign</p>
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        className="mx-auto h-28 w-full max-w-sm touch-none rounded-xl border border-border bg-bg"
        onPointerDown={(e) => {
          const c = canvasRef.current;
          const ctx = c?.getContext("2d");
          if (!c || !ctx) return;
          drawing.current = true;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          c.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current?.getContext("2d");
          if (!ctx) return;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#111";
          ctx.stroke();
          if (!inked.current) {
            inked.current = true;
            onSigned();
          }
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      />
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          const c = canvasRef.current;
          const ctx = c?.getContext("2d");
          if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
          inked.current = false;
          onCleared();
        }}
      >
        Clear sign
      </Button>
    </div>
  );
}
