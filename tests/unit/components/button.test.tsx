import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('<Button />', () => {
  it('rend le texte et applique la variante primaire par défaut', () => {
    render(<Button>Envoyer</Button>);
    const btn = screen.getByRole('button', { name: /envoyer/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-[color:var(--color-primary)]');
  });

  it('applique la variante outline', () => {
    render(<Button variant="outline">Secondaire</Button>);
    expect(screen.getByRole('button').className).toContain('border');
  });

  it('applique la taille demandée', () => {
    render(<Button size="lg">Grand</Button>);
    expect(screen.getByRole('button').className).toContain('h-12');
  });

  it('déclenche onClick', async () => {
    let clicked = 0;
    render(<Button onClick={() => clicked++}>Cliquer</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(clicked).toBe(1);
  });

  it('disabled empêche le clic', async () => {
    let clicked = 0;
    render(
      <Button disabled onClick={() => clicked++}>
        Désactivé
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(clicked).toBe(0);
  });

  it('fusionne les classes personnalisées', () => {
    render(<Button className="custom-x mt-10">X</Button>);
    expect(screen.getByRole('button').className).toContain('mt-10');
    expect(screen.getByRole('button').className).toContain('custom-x');
  });
});
