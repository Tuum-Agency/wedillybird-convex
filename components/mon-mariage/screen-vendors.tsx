'use client';
/* Wedillybird — Espace couple · Écran — Prestataires (carnet perso)
   Vue Carnet OU Kanban (par étape, glisser-déposer). Création/édition via modale
   complète (infos + observations + pièces jointes : devis, contrat, photo…).
   Lien visuel vers le Budget. PAS de répertoire pro réutilisable, PAS de marge. */

import { useState, useRef, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from './icons';
import { McBtn, McPill } from './parts';
import { McModal, McField, McInput, McSelect, McTextarea, Attachments, AttachChip } from './modal';
import {
  MC_VENDORS,
  MC_CATS,
  mcVendorStatusMeta,
  mcEUR,
  type McVendor,
  type McVendorCat,
  type McVendorStatus,
  type McAttachment,
} from './data';

// libellés via clés `MonMariage.vendors.filters.<k>`
const MC_VFILTERS: ReadonlyArray<[string, string]> = [
  ['all', 'all'],
  ['reserve', 'reserve'],
  ['devis', 'devis'],
  ['contacte', 'contacte'],
  ['a_contacter', 'a_contacter'],
];
// [valeur, clé i18n du libellé de catégorie] — dérivé de MC_CATS
const MC_CAT_OPTS: ReadonlyArray<[string, string]> = (
  Object.entries(MC_CATS) as Array<[McVendorCat, (typeof MC_CATS)[McVendorCat]]>
).map(([k, c]) => [k, c.label]);
// [valeur, clé i18n du statut] — aligné sur mcVendorStatusMeta
const MC_STATUS_OPTS: ReadonlyArray<[string, string]> = [
  ['a_contacter', 'MonMariage.data.vendorStatus.a_contacter'],
  ['contacte', 'MonMariage.data.vendorStatus.contacte'],
  ['devis', 'MonMariage.data.vendorStatus.devis'],
  ['reserve', 'MonMariage.data.vendorStatus.reserve'],
  ['paye', 'MonMariage.data.vendorStatus.paye'],
];
const MC_KANBAN_COLS: ReadonlyArray<[string, string]> = MC_STATUS_OPTS;

/* normalise les données mock : doc (string) → attachments[] */
function normalizeVendor(v: McVendor): McVendor & { attachments: McAttachment[] } {
  if (v.attachments) return { ...v, attachments: v.attachments };
  let atts: McAttachment[] = [];
  if (v.doc) {
    const k = /contrat/i.test(v.doc)
      ? 'contrat'
      : /devis/i.test(v.doc)
        ? 'devis'
        : /facture/i.test(v.doc)
          ? 'facture'
          : 'autre';
    atts = [{ id: v.id + '-doc', name: v.doc + '.pdf', kind: k }];
  }
  return { ...v, attachments: atts };
}

/* ---------- modale création / édition ---------- */
function VendorModal({
  vendor,
  onClose,
  onSave,
}: {
  vendor: McVendor | null;
  onClose: () => void;
  onSave: (v: McVendor) => void;
}) {
  const t = useTranslations('MonMariage.vendors');
  const tRoot = useTranslations('MonMariage');
  const tr = (key: string) => tRoot(key.replace(/^MonMariage\./, ''));
  const catOpts: ReadonlyArray<[string, string]> = MC_CAT_OPTS.map(([k, key]) => [k, tr(key)]);
  const statusOpts: ReadonlyArray<[string, string]> = MC_STATUS_OPTS.map(([k, key]) => [
    k,
    tr(key),
  ]);
  const v = vendor || ({} as Partial<McVendor>);
  const [name, setName] = useState(v.name || '');
  const [cat, setCat] = useState<string>(v.cat || 'lieu');
  const [status, setStatus] = useState<string>(v.status || 'a_contacter');
  const [contact, setContact] = useState(v.contact || '');
  const [email, setEmail] = useState(v.email || '');
  const [amount, setAmount] = useState(v.amount != null ? String(v.amount) : '');
  const [paid, setPaid] = useState(v.paid != null ? String(v.paid) : '');
  const [note, setNote] = useState(v.note || '');
  const [attachments, setAttachments] = useState<McAttachment[]>(v.attachments || []);
  const editing = !!vendor;
  const save = () => {
    if (!name.trim()) return;
    onSave({
      ...v,
      id: v.id || 'nv' + Date.now(),
      name: name.trim(),
      cat: cat as McVendorCat,
      status: status as McVendorStatus,
      contact: contact.trim() || null,
      email: email.trim() || null,
      amount: Number(amount) || 0,
      paid: Number(paid) || 0,
      note: note.trim(),
      attachments,
    });
    onClose();
  };
  return (
    <McModal
      eyebrow={t('modalEyebrow')}
      title={editing ? t('editVendor') : t('newVendor')}
      onClose={onClose}
      wide
      footer={
        <>
          <McBtn variant="ghost" size="md" onClick={onClose}>
            {t('cancel')}
          </McBtn>
          <McBtn variant="halo" size="md" onClick={save}>
            <Icon name="Check" size={16} stroke={2.2} />
            {editing ? t('save') : t('createVendor')}
          </McBtn>
        </>
      }
    >
      <div className="mc-formgrid">
        <McField label={t('vendorNameLabel')} full>
          <McInput
            icon="Store"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('vendorNamePlaceholder')}
            autoFocus
          />
        </McField>
        <McField label={t('categoryLabel')}>
          <McSelect value={cat} onChange={setCat} options={catOpts} />
        </McField>
        <McField label={t('statusLabel')}>
          <McSelect value={status} onChange={setStatus} options={statusOpts} />
        </McField>
        <McField label={t('phoneLabel')}>
          <McInput
            icon="Phone"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="+33 6 12 34 56 78"
            inputMode="tel"
          />
        </McField>
        <McField label={t('emailLabel')} hint={t('optional')}>
          <McInput
            icon="Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@…"
          />
        </McField>
        <McField label={t('amountLabel')}>
          <McInput
            prefix="€"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0"
            inputMode="decimal"
          />
        </McField>
        <McField label={t('paidLabel')} hint={t('depositHint')}>
          <McInput
            prefix="€"
            value={paid}
            onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0"
            inputMode="decimal"
          />
        </McField>
        <McField label={t('notesLabel')} full>
          <McTextarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('notesPlaceholder')}
          />
        </McField>
        <div className="full">
          <Attachments
            value={attachments}
            onChange={setAttachments}
            label={t('attachmentsLabel')}
          />
        </div>
      </div>
    </McModal>
  );
}

/* ---------- carte prestataire ---------- */
function VendorCard({
  v,
  onEdit,
  draggable,
  onDragStart,
  compact,
}: {
  v: McVendor;
  onEdit?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
}) {
  const t = useTranslations('MonMariage.vendors');
  const tRoot = useTranslations('MonMariage');
  const tr = (key: string) => tRoot(key.replace(/^MonMariage\./, ''));
  const locale = useLocale();
  const cat = MC_CATS[v.cat];
  const [kind, labelKey] = mcVendorStatusMeta(v.status);
  const rem = v.amount - v.paid;
  return (
    <article
      className={'mc-vendor' + (compact ? ' compact' : '')}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={compact ? onEdit : undefined}
    >
      <span className="vic" style={{ '--tint': cat.tint } as CSSProperties}>
        <Icon name={cat.icon} size={compact ? 17 : 20} stroke={1.85} />
      </span>
      <div className="vbody">
        <div className="vtop">
          <div className="vnm">
            <b>{v.name}</b>
            <span className="vcat">{tr(cat.label)}</span>
          </div>
          {compact ? (
            <span className="mc-grip">
              <Icon name="GripVertical" size={15} stroke={1.9} />
            </span>
          ) : (
            <McPill kind={kind}>{tr(labelKey)}</McPill>
          )}
        </div>
        {!compact && v.note && <p className="vnote">{v.note}</p>}
        {!compact && (
          <div className="vmeta">
            {v.contact && (
              <span className="vm">
                <Icon name="Phone" size={12} stroke={1.9} />
                {v.contact}
              </span>
            )}
            {v.attachments && v.attachments.map((a) => <AttachChip key={a.id} a={a} />)}
          </div>
        )}
        {compact && (v.contact || (v.attachments && v.attachments.length > 0)) && (
          <div className="vmeta">
            {v.contact && (
              <span className="vm">
                <Icon name="Phone" size={11} stroke={1.9} />
                {v.contact}
              </span>
            )}
            {v.attachments && v.attachments.length > 0 && (
              <span className="vm">
                <Icon name="Paperclip" size={11} stroke={1.9} />
                {t('attachmentsCount', { count: v.attachments.length })}
              </span>
            )}
          </div>
        )}
        <div className="vfoot">
          <div className="vamt">
            <span className="a">{mcEUR(v.amount, locale)}</span>
            {v.paid > 0 ? (
              <span className="p">
                {rem > 0
                  ? t('paidWithRemainder', { paid: mcEUR(v.paid, locale), rem: mcEUR(rem, locale) })
                  : t('paidAmount', { paid: mcEUR(v.paid, locale) })}
              </span>
            ) : v.amount > 0 ? (
              <span className="p muted">{t('noDeposit')}</span>
            ) : null}
          </div>
          {!compact && (
            <button className="mc-iconlink" onClick={onEdit} aria-label={t('edit')}>
              <Icon name="Pencil" size={15} stroke={1.9} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------- Kanban ---------- */
function Kanban({
  list,
  onMove,
  onEdit,
}: {
  list: McVendor[];
  onMove: (id: string, status: McVendorStatus) => void;
  onEdit: (v: McVendor) => void;
}) {
  const t = useTranslations('MonMariage.vendors');
  const tRoot = useTranslations('MonMariage');
  const dragId = useRef<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  return (
    <div className="mc-kanban">
      {MC_KANBAN_COLS.map(([sk, slKey]) => {
        const items = list.filter((v) => v.status === sk);
        const [pk] = mcVendorStatusMeta(sk);
        return (
          <div
            key={sk}
            className={'mc-kcol' + (overCol === sk ? ' over' : '')}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(sk);
            }}
            onDragLeave={() => setOverCol((c) => (c === sk ? null : c))}
            onDrop={() => {
              if (dragId.current) onMove(dragId.current, sk as McVendorStatus);
              dragId.current = null;
              setOverCol(null);
            }}
          >
            <div className="mc-kcol-head">
              <span className={'mc-pill ' + pk}>
                <span className="d" />
                {tRoot(slKey.replace(/^MonMariage\./, ''))}
              </span>
              <span className="kc">{items.length}</span>
            </div>
            <div className="mc-kcol-body">
              {items.map((v) => (
                <VendorCard
                  key={v.id}
                  v={v}
                  compact
                  draggable
                  onEdit={() => onEdit(v)}
                  onDragStart={(e) => {
                    dragId.current = v.id;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                />
              ))}
              {items.length === 0 && <div className="mc-kempty">{t('dropHere')}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VendorsScreen({ onNav }: { onNav: (k: string) => void }) {
  const t = useTranslations('MonMariage.vendors');
  const tRoot = useTranslations('MonMariage');
  const locale = useLocale();
  const [view, setView] = useState('carnet');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [list, setList] = useState<McVendor[]>(() => MC_VENDORS.map(normalizeVendor));
  const [modal, setModal] = useState<Partial<McVendor> | null>(null); // null | {} (new) | vendor (edit)

  const engaged = list.reduce((a, v) => a + v.amount, 0);
  const paid = list.reduce((a, v) => a + v.paid, 0);

  const catLabel = (cat: McVendorCat) => tRoot(MC_CATS[cat].label.replace(/^MonMariage\./, ''));
  const shown = list.filter(
    (v) =>
      (filter === 'all' || v.status === filter) &&
      (!q.trim() ||
        v.name.toLowerCase().includes(q.toLowerCase()) ||
        catLabel(v.cat).toLowerCase().includes(q.toLowerCase())),
  );

  const save = (vd: McVendor) =>
    setList((l) =>
      l.some((x) => x.id === vd.id) ? l.map((x) => (x.id === vd.id ? vd : x)) : [vd, ...l],
    );
  const move = (id: string, status: McVendorStatus) =>
    setList((l) => l.map((v) => (v.id === id ? { ...v, status } : v)));

  return (
    <>
      <header className="mc-pagehead">
        <div className="ph-l">
          <span className="mc-eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
        </div>
        <p className="ph-sub">{t('subtitle')}</p>
      </header>

      <section
        className="mc-card"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}
      >
        <div className="mc-vstat">
          <span className="l">{t('statVendors')}</span>
          <span className="v">{list.length}</span>
        </div>
        <div className="mc-vstat">
          <span className="l">{t('statEngaged')}</span>
          <span className="v">{mcEUR(engaged, locale)}</span>
        </div>
        <div className="mc-vstat">
          <span className="l">{t('statPaid')}</span>
          <span className="v ok">{mcEUR(paid, locale)}</span>
        </div>
        <button className="mc-budgetlink" onClick={() => onNav('budget')}>
          <Icon name="Wallet" size={16} stroke={1.9} />
          {t('seeBudget')}
          <Icon name="ArrowRight" size={15} stroke={2} />
        </button>
      </section>

      {/* barre : vue + recherche + ajout */}
      <div className="mc-guests-bar">
        <div className="mc-viewseg" role="tablist" aria-label={t('displayAria')}>
          <button
            role="tab"
            aria-selected={view === 'carnet'}
            className={view === 'carnet' ? 'on' : ''}
            onClick={() => setView('carnet')}
          >
            <Icon name="List" size={15} stroke={2} />
            {t('viewList')}
          </button>
          <button
            role="tab"
            aria-selected={view === 'kanban'}
            className={view === 'kanban' ? 'on' : ''}
            onClick={() => setView('kanban')}
          >
            <Icon name="LayoutGrid" size={15} stroke={2} />
            {t('viewKanban')}
          </button>
        </div>
        {view === 'carnet' && (
          <div className="mc-search">
            <Icon name="Search" size={16} stroke={1.9} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchAria')}
            />
          </div>
        )}
        <McBtn
          variant="primary"
          size="md"
          onClick={() => setModal({})}
          style={{ marginInlineStart: 'auto' }}
        >
          <Icon name="Plus" size={16} stroke={2.2} />
          {t('add')}
        </McBtn>
      </div>

      {view === 'carnet' ? (
        <>
          <div
            className="mc-filters mc-filters-wrap"
            role="group"
            aria-label={t('filterStatusAria')}
          >
            {MC_VFILTERS.map(([k, l]) => (
              <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
                {t(`filters.${l}`)}
              </button>
            ))}
          </div>
          <div className="mc-vendors">
            {shown.length ? (
              shown.map((v) => <VendorCard key={v.id} v={v} onEdit={() => setModal(v)} />)
            ) : (
              <div className="mc-guest-empty">{t('noVendorMatch')}</div>
            )}
          </div>
        </>
      ) : (
        <Kanban list={list} onMove={move} onEdit={(v) => setModal(v)} />
      )}

      {modal !== null && (
        <VendorModal
          vendor={modal.id ? (modal as McVendor) : null}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </>
  );
}
