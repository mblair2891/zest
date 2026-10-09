import { create } from "zustand";
import type { UpdateScreen } from "./update-screen";

type UpdateJumpState = {
  serial: number;
  screen: UpdateScreen | null;
  go: (screen: UpdateScreen) => void;
};

/** The login update list asks the open shell to show this screen. */
export const useUpdateJump = create<UpdateJumpState>((set, get) => ({
  serial: 0,
  screen: null,
  go: (screen) => set({ screen, serial: get().serial + 1 }),
}));
