import { NextResponse } from 'next/server';
import { getConvexServerClient, convexApi } from '@/lib/auth/convex-server';
import { setSessionCookie } from '@/lib/auth/session';
import { TEST_USERS } from '@/lib/dev/test-users';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'DISABLED_IN_PRODUCTION' }, { status: 403 });
  }

  const formData = await request.formData();
  const phone = String(formData.get('phone') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '/dashboard');

  const fixture = TEST_USERS.find((u) => u.phone === phone);
  if (!fixture) {
    return NextResponse.json({ error: 'UNKNOWN_TEST_USER' }, { status: 404 });
  }

  const convex = getConvexServerClient();
  const user = await convex.query(convexApi.userByPhone, { phone: fixture.phone });
  if (!user) {
    return NextResponse.json({ error: 'USER_NOT_SEEDED' }, { status: 404 });
  }

  await setSessionCookie({
    userId: user._id,
    phone: user.phone,
    issuedAt: Date.now(),
  });

  const url = new URL(redirectTo, request.url);
  return NextResponse.redirect(url, { status: 303 });
}
