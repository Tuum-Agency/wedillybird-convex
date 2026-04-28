import { ImageResponse } from 'next/og';

/**
 * Twitter card image — réutilise la composition Open Graph (`summary_large_image`
 * ratio 1.91:1 = 1200×630, identique à l'OG). Différencié dans un fichier
 * dédié pour permettre une variation future si besoin (ex. logo plus large
 * sur Twitter qui crop différemment).
 */
export const runtime = 'nodejs';

export const alt = 'Wedillybird — Invitations mariage par WhatsApp, RSVP, check-in';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fbf6ee',
        padding: '96px 112px',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 112,
          width: 64,
          height: 2,
          background: '#c9a961',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 12,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: '#c9a961',
          }}
        />
        <span
          style={{
            fontSize: 18,
            letterSpacing: '0.32em',
            color: '#6b5a4a',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          Wedillybird · Édition mariage
        </span>
      </div>
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <div
          style={{
            fontSize: 152,
            fontStyle: 'italic',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: '#2c1a11',
            lineHeight: 0.95,
            fontFamily: 'serif',
          }}
        >
          Wedillybird
        </div>
        <div
          style={{
            fontSize: 36,
            color: '#4a3526',
            lineHeight: 1.25,
            maxWidth: 880,
          }}
        >
          Le grand jour mérite mieux qu&rsquo;un PDF.
        </div>
        <div
          style={{
            fontSize: 22,
            color: '#8a7765',
            letterSpacing: '0.08em',
            marginTop: 12,
          }}
        >
          Invitations WhatsApp · RSVP · Check-in · Galerie partagée
        </div>
      </div>
    </div>,
    { ...size },
  );
}
