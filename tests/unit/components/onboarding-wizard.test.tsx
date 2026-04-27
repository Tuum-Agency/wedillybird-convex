import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const pushMock = vi.fn();
const refreshMock = vi.fn();
const completeOnboardingActionMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('@/app/[locale]/(auth)/actions', () => ({
  completeOnboardingAction: (formData: FormData) => completeOnboardingActionMock(formData),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => `${namespace ?? 'T'}.${key}`,
}));

// Mock Motion : passe les enfants directement, pas d'animations en jsdom.
// useReducedMotion = true → désactive les transforms (ce qui ferait que
// AnimatePresence garde les deux steps simultanément).
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  completeOnboardingActionMock.mockReset();
});

describe('OnboardingWizard', () => {
  it('renders step 1 first (profile)', () => {
    render(<OnboardingWizard />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('stepProfile');
    expect(screen.getByLabelText('Onboarding.fullNameLabel')).toBeInTheDocument();
  });

  it('disables Next until both fullName (2+ chars) and a valid email are set', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    const next = screen.getByRole('button', { name: 'Onboarding.next' });
    expect(next).toBeDisabled();

    await user.type(screen.getByLabelText('Onboarding.fullNameLabel'), 'Al');
    expect(next).toBeDisabled();

    await user.type(screen.getByLabelText('Onboarding.emailLabel'), 'al@example.com');
    expect(next).toBeEnabled();
  });

  it('advances to step 2 (role) after clicking Next', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await user.type(screen.getByLabelText('Onboarding.fullNameLabel'), 'Alice Martin');
    await user.type(screen.getByLabelText('Onboarding.emailLabel'), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: 'Onboarding.next' }));

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('stepRole');
    const group = screen.getByRole('radiogroup');
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
  });

  it('rejects invalid email format at step 1', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await user.type(screen.getByLabelText('Onboarding.fullNameLabel'), 'Alice Martin');
    await user.type(screen.getByLabelText('Onboarding.emailLabel'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Onboarding.next' }));

    // Still on step 1 because email is invalid
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('stepProfile');
  });

  it('pre-fills email and locks the field when initialEmail is provided', () => {
    render(<OnboardingWizard initialEmail="alice@example.com" />);
    const emailInput = screen.getByLabelText('Onboarding.emailLabel') as HTMLInputElement;
    expect(emailInput.value).toBe('alice@example.com');
    expect(emailInput).toHaveAttribute('readonly');
  });

  it('submits with fullName, email and selected role', async () => {
    completeOnboardingActionMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    await user.type(screen.getByLabelText('Onboarding.fullNameLabel'), 'Alice Martin');
    await user.type(screen.getByLabelText('Onboarding.emailLabel'), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: 'Onboarding.next' }));

    const group = screen.getByRole('radiogroup');
    await user.click(within(group).getAllByRole('radio')[0]!);
    await user.click(screen.getByRole('button', { name: 'Onboarding.finish' }));

    expect(completeOnboardingActionMock).toHaveBeenCalledTimes(1);
    const formData = completeOnboardingActionMock.mock.calls[0]![0] as FormData;
    expect(formData.get('fullName')).toBe('Alice Martin');
    expect(formData.get('role')).toBe('couple');
    expect(formData.get('email')).toBe('alice@example.com');
  });
});
