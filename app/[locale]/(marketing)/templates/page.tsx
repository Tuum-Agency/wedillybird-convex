import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';
import { LandingFooterRich } from '@/components/landing/footer-rich';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

const TEMPLATES = [
  {
    id: 1,
    name: "L'Élégance Minimaliste",
    description: 'Des lignes épurées, une typographie chic, parfait pour un mariage moderne.',
    tags: ['Populaire', 'Moderne'],
    color: 'bg-slate-50 border-slate-200',
  },
  {
    id: 2,
    name: 'Romance Champêtre',
    description: 'Motifs floraux délicats et tons pastels pour une ambiance douce et naturelle.',
    tags: ['Floral', 'Classique'],
    color: 'bg-rose-50 border-rose-200',
  },
  {
    id: 3,
    name: 'Nuit Orientale',
    description: 'Motifs géométriques subtils et dorures pour une célébration majestueuse.',
    tags: ['Premium', 'Luxe'],
    color: 'bg-amber-50 border-amber-200',
  },
  {
    id: 4,
    name: 'Pureté Traditionnelle',
    description: "Un design intemporel qui met en valeur l'essence même de votre union.",
    tags: ['Tradition'],
    color: 'bg-stone-50 border-stone-200',
  },
  {
    id: 5,
    name: 'Coucher de Soleil',
    description: 'Des tons chauds et vibrants pour un mariage festif sous les tropiques.',
    tags: ['Festif', 'Nouveau'],
    color: 'bg-orange-50 border-orange-200',
  },
  {
    id: 6,
    name: 'Noir & Or Signature',
    description: 'Contraste fort et élégance absolue pour une réception prestigieuse.',
    tags: ['Premium', 'Chic'],
    color: 'bg-zinc-900 border-zinc-800 text-white',
  },
];

export default async function TemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-ivory-50)]/65">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <Link href="/" className="focus-ring inline-flex items-center">
            <WedillybirdLogo />
          </Link>
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Retour
          </Link>
        </div>
      </header>

      <main className="flex-1 py-16 lg:py-24" tabIndex={-1}>
        <div className="container-page flex flex-col gap-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-[color:var(--color-blush-50)] p-3 text-[color:var(--color-blush-600)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="font-display text-4xl leading-tight text-[color:var(--color-ink-900)] italic lg:text-5xl">
              Galerie de Templates
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--color-ink-500)]">
              Découvrez notre collection de modèles d&apos;invitations WhatsApp. Choisissez celui
              qui correspond parfaitement à l&apos;ambiance de votre mariage.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((template) => (
              <Card
                key={template.id}
                className="overflow-hidden border-none shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-medium)]"
              >
                <div
                  className={cn(
                    'flex h-48 w-full items-center justify-center border-b p-6',
                    template.color,
                  )}
                >
                  <div
                    className={cn(
                      'font-display text-center text-2xl italic opacity-80',
                      template.id === 6 ? 'text-white' : 'text-black',
                    )}
                  >
                    {template.name}
                  </div>
                </div>
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap gap-2">
                    {template.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="neutral"
                        className="bg-[color:var(--color-ivory-100)] font-mono text-[10px] tracking-wider text-[color:var(--color-ink-700)] uppercase"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <h3 className="text-lg font-semibold text-[color:var(--color-ink-900)]">
                    {template.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)]">
                    {template.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[color:var(--color-ink-900)] px-8 text-sm font-semibold text-white transition-transform hover:scale-105"
            >
              Créer mon invitation gratuitement
            </Link>
          </div>
        </div>
      </main>

      <LandingFooterRich />
    </>
  );
}
