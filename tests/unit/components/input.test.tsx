import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/input';

describe('<Input />', () => {
  it('rend un input de type text par défaut', () => {
    render(<Input placeholder="Nom" />);
    const el = screen.getByPlaceholderText('Nom') as HTMLInputElement;
    expect(el.type).toBe('text');
  });

  it('accepte un type personnalisé', () => {
    render(<Input type="tel" placeholder="Téléphone" />);
    expect((screen.getByPlaceholderText('Téléphone') as HTMLInputElement).type).toBe('tel');
  });

  it('capte la saisie', async () => {
    render(<Input placeholder="Email" />);
    const el = screen.getByPlaceholderText('Email');
    await userEvent.type(el, 'bob@wedillybird.com');
    expect((el as HTMLInputElement).value).toBe('bob@wedillybird.com');
  });

  it('disabled bloque la saisie', async () => {
    render(<Input disabled placeholder="Bloqué" />);
    const el = screen.getByPlaceholderText('Bloqué');
    await userEvent.type(el, 'x');
    expect((el as HTMLInputElement).value).toBe('');
  });
});
