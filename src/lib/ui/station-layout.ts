import { useLayoutEffect, useState } from "react";
import { tableServicePaint } from "../pos/service-colors";

/**
 * Station chrome by physical viewport — not by PIN role.
 *
 * Typical 8" Android handheld portrait is ~600–800 CSS px wide and tall.
 * Floor stays one column there. The order screen puts the open check on
 * the left third whenever the width is at least a tablet.
 * A 10–11" tablet in landscape is two columns for the floor, not a
 * skinny third nav column. Counter 15"+ keeps the side nav.
 */

export type StationForm = "handheld" | "tablet" | "counter";

export type StationLayout = {
  width: number;
  height: number;
  portrait: boolean;
  short: boolean;
  narrow: boolean;
  /** Portrait handheld / phone: floor stays one column. */
  handheld: boolean;
  /** Floor side by side. The order screen uses its own left-third check. */
  twoCol: boolean;
  /** 15"+ counter: side nav + check + menu. */
  counter: boolean;
  form: StationForm;
  /**
   * Phone, or a known 8" handheld in portrait.
   * Floor, check, and menu use the one-hand layout. Larger tablets do not.
   */
  smallForm: boolean;
};

const TWO_COL_MIN_WIDTH = 840;
const HANDHELD_PORTRAIT_MAX_WIDTH = 960;
const PHONE_MAX_WIDTH = 640;
const COUNTER_MIN_WIDTH = 1400;
const COUNTER_MIN_HEIGHT = 800;
const SHORT_HEIGHT = 700;
/** Phone-sized width. A turned phone still counts when its short side is under this. */
export const SMALL_FORM_MAX_WIDTH = 600;
/**
 * 8" Android handheld portrait is about 600–820 CSS px wide.
 * A 10" tablet portrait starts near 834 and keeps the tablet layout.
 */
export const HANDHELD_FORM_MAX_WIDTH = 820;

export function viewportSize(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  const vv = window.visualViewport;
  const width = vv && vv.width > 0 ? vv.width : window.innerWidth;
  const height = vv && vv.height > 0 ? vv.height : window.innerHeight;
  return { width: Math.round(width), height: Math.round(height) };
}

/** CSS variables the station shell and PIN pad read. Landscape when width >= height. */
export function stationViewportVars(width: number, height: number): {
  vw: string;
  vh: string;
  orientation: "landscape" | "portrait";
} {
  const w = Math.max(0, Math.round(width));
  const h = Math.max(0, Math.round(height));
  return {
    vw: `${w}px`,
    vh: `${h}px`,
    orientation: h > w ? "portrait" : "landscape",
  };
}

export function applyStationViewport(width: number, height: number): void {
  if (typeof document === "undefined") return;
  const next = stationViewportVars(width, height);
  const root = document.documentElement;
  root.style.setProperty("--station-vw", next.vw);
  root.style.setProperty("--station-vh", next.vh);
  root.dataset.orientation = next.orientation;
}

/** Width under 600px, a turned phone, or an 8" handheld in portrait. */
export function isSmallForm(width: number, height: number): boolean {
  const w = Math.max(0, Math.round(width));
  const h = Math.max(0, Math.round(height));
  if (w < SMALL_FORM_MAX_WIDTH) return true;
  if (Math.min(w, h) < SMALL_FORM_MAX_WIDTH) return true;
  return h > w && w <= HANDHELD_FORM_MAX_WIDTH;
}

/**
 * Small-floor fill uses the same service colors as the tablet map.
 * Empty is a light chip. Sent work is yellow. Fulfilled food is green.
 */
export function handheldStatusFill(status: string): string {
  return tableServicePaint({
    pipeline: status,
    selected: false,
    otherServer: false,
    lines: [],
    tickets: [],
    scheme: "light",
  }).fill;
}

export function stationLayoutFromSize(width: number, height: number): StationLayout {
  const w = Math.max(0, Math.round(width));
  const h = Math.max(0, Math.round(height));
  const portrait = h > w;
  const short = h < SHORT_HEIGHT;
  const narrow = w < TWO_COL_MIN_WIDTH;
  const handheld =
    w < PHONE_MAX_WIDTH || (portrait && w < HANDHELD_PORTRAIT_MAX_WIDTH);
  const counter = !handheld && w >= COUNTER_MIN_WIDTH && h >= COUNTER_MIN_HEIGHT;
  const twoCol = !handheld && w >= TWO_COL_MIN_WIDTH;
  const form: StationForm = handheld ? "handheld" : counter ? "counter" : "tablet";
  return {
    width: w,
    height: h,
    portrait,
    short,
    narrow,
    handheld,
    twoCol,
    counter,
    form,
    smallForm: isSmallForm(w, h),
  };
}

export function useStationLayout(): StationLayout {
  const [size, setSize] = useState(viewportSize);
  useLayoutEffect(() => {
    const apply = () => {
      const next = viewportSize();
      applyStationViewport(next.width, next.height);
      document.documentElement.dataset.smallForm = isSmallForm(next.width, next.height) ? "1" : "0";
      setSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };
    const applySoon = () => {
      apply();
      window.requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", applySoon);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", applySoon);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
    };
  }, []);
  return stationLayoutFromSize(size.width, size.height);
}
