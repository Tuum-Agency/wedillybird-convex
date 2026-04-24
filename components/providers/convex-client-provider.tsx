'use client';

import { ReactNode, useMemo } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

let cached: ConvexReactClient | null = null;

function getClient(url: string): ConvexReactClient {
  if (cached) return cached;
  cached = new ConvexReactClient(url);
  return cached;
}

export function ConvexClientProvider({
  children,
  convexUrl,
}: {
  children: ReactNode;
  convexUrl: string | undefined;
}) {
  const client = useMemo(() => (convexUrl ? getClient(convexUrl) : null), [convexUrl]);

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
