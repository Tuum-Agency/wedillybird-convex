import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '@/stores/session-store';

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('démarre sans utilisateur ni événement actif', () => {
    const state = useSessionStore.getState();
    expect(state.user).toBeNull();
    expect(state.activeEventId).toBeNull();
  });

  it('setUser puis reset', () => {
    useSessionStore.getState().setUser({
      id: 'u1',
      phone: '+33612345678',
      role: 'couple',
    });
    expect(useSessionStore.getState().user?.id).toBe('u1');
    expect(useSessionStore.getState().user?.role).toBe('couple');

    useSessionStore.getState().reset();
    expect(useSessionStore.getState().user).toBeNull();
  });

  it("setActiveEventId change l'événement courant", () => {
    useSessionStore.getState().setActiveEventId('evt_123');
    expect(useSessionStore.getState().activeEventId).toBe('evt_123');
    useSessionStore.getState().setActiveEventId(null);
    expect(useSessionStore.getState().activeEventId).toBeNull();
  });
});
