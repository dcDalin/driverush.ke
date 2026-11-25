/**
 * Whether the sign-in sheet is open, and why, so any page (the account
 * button, a "save your progress" prompt) can open the one sheet in the shell.
 */
import { create } from "zustand";

export type SignInReason = "account" | "save-progress";

type SignInSheetState = {
  open: boolean;
  reason: SignInReason;
  show: (reason?: SignInReason) => void;
  setOpen: (open: boolean) => void;
};

export const useSignInSheet = create<SignInSheetState>((set) => ({
  open: false,
  reason: "account",
  show: (reason = "account") => set({ open: true, reason }),
  setOpen: (open) => set({ open }),
}));
