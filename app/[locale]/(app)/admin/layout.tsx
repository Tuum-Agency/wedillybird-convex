import type { ReactNode } from 'react';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export default async function AdminLayout({
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

  const convex = getConvexServerClient();
  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });

  if (!user || user.role !== 'admin') {
    redirect({ href: '/dashboard', locale });
  }

  return <>{children}</>;
}
