import { useLayoutEffect, useState } from "react";

/**
 * Station chrome by physical viewport — not by PIN role.
 *
 * Typical 8" Android handheld portrait is ~600–800 CSS px wide and tall.
 * A 10–11" tablet in landscape is two columns (check + menu), not a
 * skinny third nav column. Counter 15"+ keeps the side nav.
 */

export type StationForm = "handheld" | "tablet" | "counter";

export type StationLayout = {
  width: number;
  height: number;
  portrait: boolean;
  short: boolean;
  narrow: boolean;
  /** Portrait handheld / phone: single column, check in a slide-over. */
  handheld: boolean;
  /** Check + menu side by side. Never a third skinny column. */
  twoCol: boolean;
  /** 15"+ counter: side nav + check + menu. */
  counter: boolean;
  form: StationForm;
};

const TWO_COL_MIN_WIDTH = 840;
const HANDHELD_PORTRAIT_MAX_WIDTH = 960;
const PHONE_MAX_WIDTH = 640;
const COUNTER_MIN_WIDTH = 1400;
const COUNTER_MIN_HEIGHT = 800;
const SHORT_HEIGHT = 700;

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
  };
}

export function useStationLayout(): StationLayout {
  const [size, setSize] = useState(viewportSize);
  useLayoutEffect(() => {
    const apply = () => {
      const next = viewportSize();
      applyStationViewport(next.width, next.height);
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
