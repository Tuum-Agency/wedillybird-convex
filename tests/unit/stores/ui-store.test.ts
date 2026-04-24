import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/stores/ui-store';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarOpen: false,
      themePreference: 'system',
      toasts: [],
    });
    localStorage.clear();
  });

  it('toggle ouvre puis ferme la sidebar', () => {
    expect(useUIStore.getState().sidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it('setSidebarOpen force une valeur précise', () => {
    useUIStore.getState().setSidebarOpen(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it('changement de thème', () => {
    useUIStore.getState().setThemePreference('dark');
    expect(useUIStore.getState().themePreference).toBe('dark');
  });

  it('pushToast ajoute un toast avec id et permet de le retirer', () => {
    const id = useUIStore.getState().pushToast({ title: 'Sauvegardé' });
    expect(id).toBeTruthy();
    expect(useUIStore.getState().toasts).toHaveLength(1);
    expect(useUIStore.getState().toasts[0]?.title).toBe('Sauvegardé');

    useUIStore.getState().dismissToast(id);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it('clearToasts vide la liste', () => {
    useUIStore.getState().pushToast({ title: 'a' });
    useUIStore.getState().pushToast({ title: 'b' });
    expect(useUIStore.getState().toasts).toHaveLength(2);
    useUIStore.getState().clearToasts();
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });
});
