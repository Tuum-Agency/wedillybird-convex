import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('<Badge />', () => {
  it('rend le contenu', () => {
    render(<Badge>Nouveau</Badge>);
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
  });

  it('applique la variante primary', () => {
    render(<Badge variant="primary">Recommandé</Badge>);
    expect(screen.getByText('Recommandé').className).toContain(
      'bg-[color:var(--color-terracotta-100)]',
    );
  });

  it('applique la variante destructive', () => {
    render(<Badge variant="destructive">Erreur</Badge>);
    expect(screen.getByText('Erreur').className).toContain('bg-red-100');
  });
});
