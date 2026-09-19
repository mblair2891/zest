/**
 * Station activity flags for auto-reload safety.
 * Never reload mid-send, mid-pay, or while a guest-check print is in flight.
 */

let payOpen = false;
let printInFlight = false;
let sending = false;
let floorSheetOpen = false;

export function setStationPayOpen(v: boolean): void {
  payOpen = Boolean(v);
}

export function setStationPrintInFlight(v: boolean): void {
  printInFlight = Boolean(v);
}

export function setStationSending(v: boolean): void {
  sending = Boolean(v);
}

export function setStationFloorSheetOpen(v: boolean): void {
  floorSheetOpen = Boolean(v);
}

export function stationPayOpen(): boolean {
  return payOpen;
}

export function stationPrintInFlight(): boolean {
  return printInFlight;
}

export function stationSending(): boolean {
  return sending;
}

export function stationFloorSheetOpen(): boolean {
  return floorSheetOpen;
}

export function stationCriticalBusy(): boolean {
  return payOpen || printInFlight || sending;
}
