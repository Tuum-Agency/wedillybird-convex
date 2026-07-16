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
      'bg-[color:var(--color-primary-soft)]',
    );
  });

  it('applique la variante destructive', () => {
    render(<Badge variant="destructive">Erreur</Badge>);
    // Fond « soft » thème-aware (plus de pastille pastel fixe type bg-red-100).
    expect(screen.getByText('Erreur').className).toContain('bg-[color:var(--color-danger-soft)]');
  });
});
