'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  adminSendNewsletterAction,
  adminSendNewsletterTestAction,
  type NewsletterCampaign,
} from '@/app/[locale]/(app)/admin/actions';

const STATUS_LABEL: Record<string, string> = {
  sending: 'En cours',
  sent: 'Envoyée',
  failed: 'Échouée',
};
const STATUS_VARIANT: Record<string, 'neutral' | 'success' | 'warning' | 'destructive'> = {
  sending: 'warning',
  sent: 'success',
  failed: 'destructive',
};

export function AdminNewsletterComposer({
  activeCount,
  campaigns,
}: {
  activeCount: number;
  campaigns: NewsletterCampaign[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [testing, startTest] = useTransition();

  const canCompose = subject.trim().length > 0 && body.trim().length > 0;

  function sendTest() {
    setFeedback(null);
    startTest(async () => {
      const res = await adminSendNewsletterTestAction(subject, body);
      setFeedback(
        res.ok
          ? { kind: 'ok', text: `Test envoyé à ${res.recipient}.` }
          : { kind: 'err', text: errorLabel(res.error) },
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div>
          <h2 className="font-display text-lg italic">Composer une newsletter</h2>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Envoyée via AWS SES aux <strong>{activeCount}</strong> abonné
            {activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}. Un lien de
            désinscription est ajouté automatiquement.
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            Objet
          </span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex. Les nouveautés Wedillybird de juin"
            className="h-10 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            Message
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder={
              'Bonjour,\n\nVoici les dernières nouvelles…\n\nLaissez une ligne vide entre les paragraphes. Les liens https://… deviennent cliquables.'
            }
            className="w-full resize-y rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2 text-sm leading-relaxed text-[color:var(--color-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none"
          />
        </label>

        {feedback ? (
          <p className={`text-sm ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.text}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={sendTest}
            disabled={!canCompose || testing}
          >
            {testing ? 'Envoi du test…' : 'Envoyer un test (à moi-même)'}
          </Button>
          <SendAllDialog
            subject={subject}
            body={body}
            activeCount={activeCount}
            disabled={!canCompose}
            onSent={(text) => {
              setFeedback({ kind: 'ok', text });
              setSubject('');
              setBody('');
              router.refresh();
            }}
            onError={(text) => setFeedback({ kind: 'err', text })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg italic">Campagnes envoyées</h2>
        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                <Th>Objet</Th>
                <Th>Statut</Th>
                <Th>Destinataires</Th>
                <Th>Envoyés</Th>
                <Th>Échecs</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[color:var(--color-muted-foreground)]"
                  >
                    Aucune campagne envoyée pour le moment.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr
                    key={c._id}
                    className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50"
                  >
                    <td className="px-4 py-3 font-medium">{c.subject}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'neutral'}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono">{c.totalRecipients}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400">{c.sentCount}</td>
                    <td className="px-4 py-3 font-mono text-red-400">{c.failedCount || '—'}</td>
                    <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(c.sentAt ?? c.createdAt))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SendAllDialog({
  subject,
  body,
  activeCount,
  disabled,
  onSent,
  onError,
}: {
  subject: string;
  body: string;
  activeCount: number;
  disabled: boolean;
  onSent: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await adminSendNewsletterAction(subject, body);
      if (res.ok) {
        onSent(`Campagne envoyée : ${res.sentCount} envoyés, ${res.failedCount} échecs.`);
        setOpen(false);
      } else {
        onError(errorLabel(res.error));
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm" type="button" disabled={disabled || activeCount === 0}>
          Envoyer à tous ({activeCount})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer la newsletter ?</DialogTitle>
          <DialogDescription>
            La campagne « {subject} » va être envoyée à <strong>{activeCount}</strong> abonné
            {activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''} via AWS SES. Cette action
            est irréversible. Pense à t&apos;envoyer un test avant.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" type="button" disabled={pending}>
              Annuler
            </Button>
          </DialogClose>
          <Button variant="primary" size="sm" type="button" onClick={confirm} disabled={pending}>
            {pending ? 'Envoi en cours…' : `Confirmer l’envoi (${activeCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function errorLabel(code: string): string {
  const map: Record<string, string> = {
    EMPTY_CONTENT: 'Objet et message sont requis.',
    NO_SUBSCRIBERS: 'Aucun abonné actif à qui envoyer.',
    NO_ADMIN_EMAIL: 'Ton compte admin n’a pas d’email pour recevoir le test.',
    FORBIDDEN: 'Accès refusé.',
  };
  return map[code] ?? `Erreur : ${code}`;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
      {children}
    </th>
  );
}
