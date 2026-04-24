import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/cn';

describe('cn', () => {
  it('concatène les classes simples', () => {
    expect(cn('px-2', 'py-3')).toBe('px-2 py-3');
  });

  it('filtre les valeurs falsy', () => {
    expect(cn('px-2', false, null, undefined, '', 'py-3')).toBe('px-2 py-3');
  });

  it('gère les tableaux et objets', () => {
    expect(cn(['px-2', 'py-3'], { 'text-sm': true, 'font-bold': false })).toBe('px-2 py-3 text-sm');
  });

  it('résout les conflits Tailwind au profit du dernier', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm text-lg', 'text-xl')).toBe('text-xl');
  });

  it('retourne une chaîne vide quand aucun argument', () => {
    expect(cn()).toBe('');
  });
});
