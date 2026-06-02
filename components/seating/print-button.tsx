'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Bouton client qui déclenche l'impression navigateur de la page courante. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" size="md" onClick={() => window.print()}>
      <Printer className="h-4 w-4" strokeWidth={2} aria-hidden />
      {label}
    </Button>
  );
}
