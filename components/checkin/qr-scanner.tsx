'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (decodedText: string) => void;
  paused: boolean;
}

const READER_ID = 'qr-scanner-reader';

export function QrScanner({ onScan, paused }: Props) {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new mod.Html5Qrcode(READER_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            onScanRef.current(decodedText);
          },
          () => {
            /* scan frame miss — silent */
          },
        );
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'CAMERA_ERROR');
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .catch(() => {
            /* already stopped */
          })
          .finally(() => {
            s.clear();
          });
      }
    };
  }, []);

  useEffect(() => {
    const s = scannerRef.current;
    if (!s || !ready) return;
    if (paused) {
      s.pause(true);
    } else {
      s.resume();
    }
  }, [paused, ready]);

  return (
    <div className="flex flex-col gap-2" data-testid="qr-scanner">
      <div
        id={READER_ID}
        className="aspect-square w-full overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-black"
      />
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
