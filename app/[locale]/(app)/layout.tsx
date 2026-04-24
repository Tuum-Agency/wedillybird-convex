import type { ReactNode } from 'react';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-background)]">{children}</div>
  );
}
