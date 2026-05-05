import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '@/components/ui/skeleton';

describe('Skeleton', () => {
  it("expose role=status + aria-busy pour les lecteurs d'écran", () => {
    const { getByRole } = render(<Skeleton className="h-8 w-32" />);
    const el = getByRole('status');
    expect(el).toHaveAttribute('aria-busy', 'true');
  });

  it('accepte un aria-label custom passé par le caller', () => {
    const { getByRole } = render(<Skeleton aria-label="Loading photos" />);
    expect(getByRole('status')).toHaveAttribute('aria-label', 'Loading photos');
  });

  it('applique la classe shimmer brand par défaut', () => {
    const { getByRole } = render(<Skeleton />);
    expect(getByRole('status').className).toContain('shimmer');
  });

  it('gère prefers-reduced-motion via classes motion-reduce', () => {
    const { getByRole } = render(<Skeleton />);
    const cls = getByRole('status').className;
    expect(cls).toContain('motion-reduce:animate-none');
  });

  it('merge les classes externes via cn()', () => {
    const { getByRole } = render(<Skeleton className="h-12 w-full" />);
    expect(getByRole('status').className).toMatch(/h-12/);
    expect(getByRole('status').className).toMatch(/w-full/);
  });
});
