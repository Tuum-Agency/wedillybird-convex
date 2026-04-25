import { useTranslations } from 'next-intl';

export function SkipLink() {
  const t = useTranslations('Common');
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-[color:var(--color-accent)] focus:px-4 focus:py-2 focus:text-white"
    >
      {t('skipToContent')}
    </a>
  );
}
