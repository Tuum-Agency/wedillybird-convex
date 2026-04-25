import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { InvoicePDF, invoiceNumber } from '@/components/billing/invoice-pdf';

// react-pdf relies on Node APIs (Buffer, fs streams). Force Node runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ paymentId: string }>;
}

export async function GET(_req: Request, context: RouteContext): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const { paymentId } = await context.params;

  let result;
  try {
    const convex = getConvexServerClient();
    result = await convex.query(convexApi.findPaymentById, {
      paymentId,
      requesterId: session.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return NextResponse.json({ error: 'CONVEX_QUERY_FAILED' }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    <InvoicePDF payment={result.payment} organization={result.organization} owner={result.owner} />,
  );

  const filename = `${invoiceNumber(result.payment)}.pdf`;
  // renderToBuffer returns a Node Buffer. Copy into a fresh ArrayBuffer to satisfy
  // lib.dom BodyInit typing (Node Buffer typing diverges from the DOM Uint8Array generic).
  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);
  return new Response(ab, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
