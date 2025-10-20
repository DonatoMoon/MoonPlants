
import { create } from 'zustand';

type Mode = 'signin' | 'signup' | null;

type AuthUIState = {
    mode: Mode;
    open: (m: Exclude<Mode, null>) => void;
    close: () => void;
};

export const useAuthUI = create<AuthUIState>((set) => ({
    mode: null,
    open: (m) => set({ mode: m }),
    close: () => set({ mode: null }),
}));
