import { create } from 'zustand';

interface SessionUser {
  id: string;
  phone: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'couple' | 'pro' | 'guest' | 'admin';
}

interface SessionState {
  user: SessionUser | null;
  activeEventId: string | null;
  setUser: (user: SessionUser | null) => void;
  setActiveEventId: (id: string | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  activeEventId: null,
  setUser: (user) => set({ user }),
  setActiveEventId: (id) => set({ activeEventId: id }),
  reset: () => set({ user: null, activeEventId: null }),
}));
