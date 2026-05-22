import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = resolve(__dirname, '..', 'messages');

const translations = {
  fr: {
    Invitation: {
      countdownLabel: 'Compte à rebours',
      countdownDays: 'Jours',
      countdownHours: 'Heures',
      countdownMinutes: 'Minutes',
      countdownLoadingAria: 'Compte à rebours en cours de chargement',
      countdownAria: '{days} jours, {hours} heures, {minutes} minutes avant le mariage',
      dateAndTime: 'Date & heure',
      venue: 'Lieu',
      yourReply: 'Votre réponse',
      weddingDayArrived: 'Le grand jour est arrivé.',
    },
    CookieConsent: {
      title: 'Respect de votre vie privée',
      bodyBefore:
        'Nous utilisons des cookies strictement nécessaires pour le fonctionnement et la sécurité du site. Conformément à la réglementation (RGPD), et comme détaillé dans notre ',
      policyLink: 'politique',
      bodyAfter: ", aucun cookie de pistage tiers n'est utilisé à votre insu.",
      accept: 'Accepter',
      decline: 'Continuer sans accepter',
    },
  },
  en: {
    Invitation: {
      countdownLabel: 'Countdown',
      countdownDays: 'Days',
      countdownHours: 'Hours',
      countdownMinutes: 'Minutes',
      countdownLoadingAria: 'Countdown loading',
      countdownAria: '{days} days, {hours} hours, {minutes} minutes before the wedding',
      dateAndTime: 'Date & time',
      venue: 'Venue',
      yourReply: 'Your reply',
      weddingDayArrived: 'The big day is here.',
    },
    CookieConsent: {
      title: 'Your privacy matters',
      bodyBefore:
        'We use strictly necessary cookies for site functionality and security. In compliance with privacy regulations (GDPR), and as detailed in our ',
      policyLink: 'policy',
      bodyAfter: ', no third-party tracking cookies are used without your knowledge.',
      accept: 'Accept',
      decline: 'Continue without accepting',
    },
  },
  es: {
    Invitation: {
      countdownLabel: 'Cuenta atrás',
      countdownDays: 'Días',
      countdownHours: 'Horas',
      countdownMinutes: 'Minutos',
      countdownLoadingAria: 'Cuenta atrás cargando',
      countdownAria: '{days} días, {hours} horas, {minutes} minutos antes de la boda',
      dateAndTime: 'Fecha y hora',
      venue: 'Lugar',
      yourReply: 'Tu respuesta',
      weddingDayArrived: 'El gran día ha llegado.',
    },
    CookieConsent: {
      title: 'Respeto a su privacidad',
      bodyBefore:
        'Utilizamos cookies estrictamente necesarias para el funcionamiento y la seguridad del sitio. Conforme a la normativa (RGPD), y como se detalla en nuestra ',
      policyLink: 'política',
      bodyAfter: ', no se utiliza ninguna cookie de seguimiento de terceros sin su conocimiento.',
      accept: 'Aceptar',
      decline: 'Continuar sin aceptar',
    },
  },
  it: {
    Invitation: {
      countdownLabel: 'Conto alla rovescia',
      countdownDays: 'Giorni',
      countdownHours: 'Ore',
      countdownMinutes: 'Minuti',
      countdownLoadingAria: 'Conto alla rovescia in caricamento',
      countdownAria: '{days} giorni, {hours} ore, {minutes} minuti prima del matrimonio',
      dateAndTime: 'Data e ora',
      venue: 'Luogo',
      yourReply: 'La tua risposta',
      weddingDayArrived: 'Il grande giorno è arrivato.',
    },
    CookieConsent: {
      title: 'Rispetto della tua privacy',
      bodyBefore:
        'Utilizziamo cookie strettamente necessari per il funzionamento e la sicurezza del sito. In conformità con la normativa (GDPR), e come dettagliato nella nostra ',
      policyLink: 'politica',
      bodyAfter: ', nessun cookie di tracciamento di terze parti viene utilizzato a tua insaputa.',
      accept: 'Accetta',
      decline: 'Continua senza accettare',
    },
  },
  pt: {
    Invitation: {
      countdownLabel: 'Contagem regressiva',
      countdownDays: 'Dias',
      countdownHours: 'Horas',
      countdownMinutes: 'Minutos',
      countdownLoadingAria: 'Contagem regressiva carregando',
      countdownAria: '{days} dias, {hours} horas, {minutes} minutos antes do casamento',
      dateAndTime: 'Data e hora',
      venue: 'Local',
      yourReply: 'Sua resposta',
      weddingDayArrived: 'O grande dia chegou.',
    },
    CookieConsent: {
      title: 'Respeito pela sua privacidade',
      bodyBefore:
        'Utilizamos cookies estritamente necessários para o funcionamento e a segurança do site. Em conformidade com o regulamento (RGPD), e conforme detalhado em nossa ',
      policyLink: 'política',
      bodyAfter: ', nenhum cookie de rastreamento de terceiros é utilizado sem o seu conhecimento.',
      accept: 'Aceitar',
      decline: 'Continuar sem aceitar',
    },
  },
  de: {
    Invitation: {
      countdownLabel: 'Countdown',
      countdownDays: 'Tage',
      countdownHours: 'Stunden',
      countdownMinutes: 'Minuten',
      countdownLoadingAria: 'Countdown wird geladen',
      countdownAria: '{days} Tage, {hours} Stunden, {minutes} Minuten bis zur Hochzeit',
      dateAndTime: 'Datum & Uhrzeit',
      venue: 'Ort',
      yourReply: 'Ihre Antwort',
      weddingDayArrived: 'Der grosse Tag ist da.',
    },
    CookieConsent: {
      title: 'Ihre Privatsphäre',
      bodyBefore:
        'Wir verwenden ausschliesslich technisch notwendige Cookies für Funktion und Sicherheit der Website. Gemäss DSGVO und wie in unserer ',
      policyLink: 'Richtlinie',
      bodyAfter:
        ' erläutert, werden keine Drittanbieter-Tracking-Cookies ohne Ihr Wissen verwendet.',
      accept: 'Akzeptieren',
      decline: 'Ohne Akzeptieren fortfahren',
    },
  },
  ar: {
    Invitation: {
      countdownLabel: 'العد التنازلي',
      countdownDays: 'أيام',
      countdownHours: 'ساعات',
      countdownMinutes: 'دقائق',
      countdownLoadingAria: 'جاري تحميل العد التنازلي',
      countdownAria: '{days} يوم، {hours} ساعة، {minutes} دقيقة قبل حفل الزفاف',
      dateAndTime: 'التاريخ والوقت',
      venue: 'المكان',
      yourReply: 'ردك',
      weddingDayArrived: 'وصل اليوم الكبير.',
    },
    CookieConsent: {
      title: 'احترام خصوصيتك',
      bodyBefore:
        'نستخدم ملفات تعريف ارتباط ضرورية فقط لتشغيل الموقع وأمانه. وفقًا للوائح (GDPR)، وكما هو مفصل في ',
      policyLink: 'سياستنا',
      bodyAfter: '، لا يتم استخدام أي ملفات تعريف ارتباط لتتبع جهات خارجية دون علمك.',
      accept: 'قبول',
      decline: 'المتابعة دون القبول',
    },
  },
};

for (const [locale, additions] of Object.entries(translations)) {
  const filePath = resolve(messagesDir, `${locale}.json`);
  const existing = JSON.parse(readFileSync(filePath, 'utf-8'));
  existing.Invitation = { ...existing.Invitation, ...additions.Invitation };
  existing.CookieConsent = { ...existing.CookieConsent, ...additions.CookieConsent };
  writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  console.log(`✓ ${locale}.json updated`);
}
