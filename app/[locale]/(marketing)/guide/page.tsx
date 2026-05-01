import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';
import { LandingFooterRich } from '@/components/landing/footer-rich';
import { Card, CardContent } from '@/components/ui/card';

const GUIDE_STEPS = [
  {
    id: 1,
    timeline: 'M-12 à M-10',
    title: 'Les fondations du mariage',
    items: [
      'Définir la date et le budget global',
      'Établir la liste préliminaire des invités',
      'Choisir le lieu de réception et le traiteur principal',
      'Créer son espace Wedillybird pour centraliser les contacts',
    ],
  },
  {
    id: 2,
    timeline: 'M-9 à M-6',
    title: "La constitution de l'équipe",
    items: [
      'Réserver le photographe et le vidéaste',
      'Choisir la décoration et le fleuriste',
      'Commencer les essayages pour la robe/le costume',
      "Contacter le DJ ou l'orchestre",
    ],
  },
  {
    id: 3,
    timeline: 'M-5 à M-3',
    title: 'Invitations & Logistique',
    items: [
      'Finaliser la liste des invités',
      "Créer l'invitation digitale sur Wedillybird",
      'Envoyer les faire-parts via WhatsApp',
      "Gérer les réservations d'hébergement pour les invités lointains",
    ],
  },
  {
    id: 4,
    timeline: 'M-2 à M-1',
    title: 'Derniers ajustements',
    items: [
      "Relancer les invités n'ayant pas répondu via l'app",
      'Finaliser le plan de table avec les RSVP définitifs',
      'Faire les derniers essayages des tenues',
      'Revoir le déroulé de la journée avec tous les prestataires',
    ],
  },
  {
    id: 5,
    timeline: 'Jour J',
    title: 'Célébration & Sérénité',
    items: [
      "Utiliser l'app pour le check-in des invités à l'entrée",
      'Déléguer la coordination à un proche ou un planner',
      'Profiter de chaque instant',
      "Laisser les invités partager leurs photos sur l'espace commun",
    ],
  },
];

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
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
            <span className="mb-4 font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
              Step by Step
            </span>
            <h1 className="font-display text-4xl leading-tight text-[color:var(--color-ink-900)] italic lg:text-5xl">
              Le Guide du Mariage Parfait
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--color-ink-500)]">
              Une check-list claire et structurée pour organiser votre mariage sereinement, étape
              par étape, en tirant parti de toute la puissance de Wedillybird.
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            {GUIDE_STEPS.map((step) => (
              <Card key={step.id} className="border-none shadow-[var(--shadow-soft)]">
                <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:gap-12 sm:p-8">
                  <div className="shrink-0 sm:w-32">
                    <span className="inline-block rounded-full bg-[color:var(--color-ivory-100)] px-3 py-1 font-mono text-xs font-semibold tracking-wider text-[color:var(--color-gold-700)]">
                      {step.timeline}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-5">
                    <h2 className="font-display text-2xl text-[color:var(--color-ink-900)]">
                      {step.title}
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {step.items.map((item, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-blush-500)]" />
                          <span className="leading-relaxed text-[color:var(--color-ink-700)]">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <LandingFooterRich />
    </>
  );
}
