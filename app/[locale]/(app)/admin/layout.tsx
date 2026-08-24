import type { ReactNode } from 'react';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';

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

  const sessionToken = await sessionTokenArg();
  const convex = getConvexServerClient();
  const user = await convex.query(convexApi.currentUser, { sessionToken });

  if (!user || user.role !== 'admin') {
    redirect({ href: '/dashboard', locale });
  }

  return <>{children}</>;
}
