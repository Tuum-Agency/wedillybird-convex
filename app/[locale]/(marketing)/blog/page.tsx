import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft, ArrowRight, Calendar } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';
import { LandingFooterRich } from '@/components/landing/footer-rich';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ARTICLES = [
  {
    id: 1,
    key: 'article1',
    image:
      'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 2,
    key: 'article2',
    image:
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 3,
    key: 'article3',
    image:
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 4,
    key: 'article4',
    image:
      'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=800&auto=format&fit=crop',
  },
] as const;

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Marketing');

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
            {t('blog.back')}
          </Link>
        </div>
      </header>

      <main className="flex-1 py-16 lg:py-24" tabIndex={-1}>
        <div className="container-page flex flex-col gap-16">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl leading-tight text-[color:var(--color-ink-900)] italic lg:text-5xl">
              {t('blog.title')}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--color-ink-500)]">
              {t('blog.subtitle')}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
            {ARTICLES.map((article) => {
              const title = t(`blog.${article.key}.title`);
              return (
                <Card
                  key={article.id}
                  className="group cursor-pointer overflow-hidden border-none shadow-[var(--shadow-soft)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-medium)]"
                >
                  <div className="bg-muted relative aspect-[16/9] overflow-hidden">
                    <img
                      src={article.image}
                      alt={title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <Badge
                      variant="neutral"
                      className="absolute top-4 left-4 bg-white/90 text-xs font-semibold backdrop-blur"
                    >
                      {t(`blog.${article.key}.category`)}
                    </Badge>
                  </div>
                  <CardContent className="flex flex-col gap-4 p-6 lg:p-8">
                    <div className="flex items-center gap-2 font-mono text-xs text-[color:var(--color-ink-400)]">
                      <Calendar className="h-3.5 w-3.5" />
                      {t(`blog.${article.key}.date`)}
                    </div>
                    <h2 className="font-display line-clamp-2 text-2xl text-[color:var(--color-ink-900)]">
                      {title}
                    </h2>
                    <p className="line-clamp-2 leading-relaxed text-[color:var(--color-ink-500)]">
                      {t(`blog.${article.key}.excerpt`)}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[color:var(--color-gold-600)] transition-colors group-hover:text-[color:var(--color-gold-700)]">
                      {t('blog.readArticle')}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>

      <LandingFooterRich />
    </>
  );
}
