'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Thème actif du sous-arbre — `light` (mariage éditorial) ou `dark` (back-office
 * agence). Le DOM porte déjà `data-theme` sur le wrapper des shells, mais les
 * overlays (Dialog, Drawer) sont **portalisés** vers `<body>` et sortent donc de
 * ce wrapper : ils retomberaient en light. Le contexte React, lui, traverse les
 * portails — les shells dark l'exposent, les overlays le relisent pour se rendre
 * dans le bon univers. Défaut `light` → aucun impact sur les surfaces couple.
 */
export type UiTheme = 'light' | 'dark';

const ThemeContext = createContext<UiTheme>('light');

export function ThemeProvider({ theme, children }: { theme: UiTheme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Thème du sous-arbre courant (défaut `light`). */
export function useUiTheme(): UiTheme {
  return useContext(ThemeContext);
}
