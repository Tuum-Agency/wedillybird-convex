'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  LayoutGrid,
  Rows3,
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  MessageCircle,
  Store,
  Heart,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PhoneFieldPair } from '@/components/pro/phone-field-pair';
import { cn } from '@/lib/cn';
import { VendorEngagements, type EngagementRow } from './vendor-engagements';
import {
  VENDOR_CATEGORIES,
  ENGAGEMENT_STATUS_META,
  filterVendors,
  priceLabel,
  priceWord,
  usedCategories,
  vendorCategoryHue,
  vendorInitials,
} from '@/lib/pro/vendors';
import { formatEurMinor } from '@/lib/pro/format';
import {
  createVendorAction,
  updateVendorAction,
  removeVendorAction,
} from '@/app/[locale]/(app)/pro/vendors/actions';

export interface VendorRow {
  _id: string;
  name: string;
  category: string;
  location?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  priceRange?: number;
  rating?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

const selectClass =
  'focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]';

const ERROR_LABEL: Record<string, string> = {
  INVALID_NAME: 'Le nom est requis.',
  VENDOR_LIMIT_REACHED:
    'Annuaire plein (25 fiches en Starter). Passez à Business pour un annuaire illimité.',
  FORBIDDEN: 'Vous n’avez pas les droits requis.',
};
const errLabel = (c: string) => ERROR_LABEL[c] ?? 'Une erreur est survenue. Réessayez.';

function Stars({ rating, showValue }: { rating: number | undefined; showValue?: boolean }) {
  const r = Math.round(rating ?? 0);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Note ${r}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="h-3 w-3"
          strokeWidth={1.5}
          style={{
            color: 'var(--color-gold-500)',
            fill: i <= r ? 'var(--color-gold-500)' : 'transparent',
          }}
          aria-hidden
        />
      ))}
      {showValue && rating ? (
        <span className="ml-1 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
          {rating.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}

function VendorAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const hue = vendorCategoryHue(name);
  return (
    <span
      aria-hidden
      className="flex flex-shrink-0 items-center justify-center rounded-xl font-mono"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: `oklch(40% 0.06 ${hue})`,
        color: `oklch(93% 0.04 ${hue})`,
      }}
    >
      {vendorInitials(name)}
    </span>
  );
}

function PricePips({ range }: { range: number | undefined }) {
  const n = range ? Math.round(range) : 0;
  return (
    <span className="inline-flex items-center" aria-label={priceLabel(range)}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="text-[12px] font-medium"
          style={{ color: 'var(--color-gold-500)', opacity: i <= n ? 1 : 0.28 }}
        >
          €
        </span>
      ))}
    </span>
  );
}

function CategoryTint({ category }: { category: string }) {
  const hue = vendorCategoryHue(category);
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.14em] uppercase"
      style={{ color: `oklch(72% 0.09 ${hue})` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: `oklch(62% 0.12 ${hue})` }}
        aria-hidden
      />
      {category}
    </span>
  );
}

function QuickContacts({ v }: { v: VendorRow }) {
  const items: Array<{ href: string; Icon: typeof Phone; label: string }> = [];
  if (v.phone) items.push({ href: `tel:${v.phone}`, Icon: Phone, label: 'Téléphone' });
  if (v.whatsapp)
    items.push({
      href: `https://wa.me/${v.whatsapp.replace(/[^\d]/g, '')}`,
      Icon: MessageCircle,
      label: 'WhatsApp',
    });
  if (v.email) items.push({ href: `mailto:${v.email}`, Icon: Mail, label: 'Email' });
  if (v.website)
    items.push({
      href: v.website.startsWith('http') ? v.website : `https://${v.website}`,
      Icon: Globe,
      label: 'Site web',
    });
  if (!items.length) return null;
  return (
    <span className="flex items-center gap-1.5">
      {items.map(({ href, Icon, label }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={label}
          className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] transition-colors hover:border-[color:var(--color-blush-400)] hover:text-[color:var(--color-foreground)]"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
        </a>
      ))}
    </span>
  );
}

export function VendorsBoard({
  vendors: initialVendors,
  canWrite,
  cap,
  events = [],
  engagements: initialEngagements = [],
}: {
  vendors: VendorRow[];
  canWrite: boolean;
  cap: number | null;
  events?: ReadonlyArray<{ _id: string; label: string }>;
  engagements?: EngagementRow[];
}) {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorRow[]>(initialVendors);
  const [engagements, setEngagements] = useState<EngagementRow[]>(initialEngagements);
  const [surface, setSurface] = useState<'annuaire' | 'parMariage'>('annuaire');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [detailVendor, setDetailVendor] = useState<VendorRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(() => usedCategories(vendors), [vendors]);
  const filtered = useMemo(
    () => filterVendors(vendors, { query, category }),
    [vendors, query, category],
  );
  const atCap = cap !== null && vendors.length >= cap;

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setDrawerOpen(true);
  }
  function openEdit(v: VendorRow) {
    setEditing(v);
    setFormError(null);
    setDrawerOpen(true);
  }

  function rowFromForm(fd: FormData, base: VendorRow | null): VendorRow {
    const get = (k: string) => {
      const val = fd.get(k);
      return typeof val === 'string' && val.trim() ? val.trim() : undefined;
    };
    const nowT = Date.now();
    const pr = get('priceRange');
    const rt = get('rating');
    return {
      _id: base?._id ?? `tmp_${nowT}`,
      name: get('name') ?? '',
      category: get('category') ?? 'Autre',
      location: get('location'),
      phone: get('phone'),
      email: get('email'),
      whatsapp: get('whatsapp'),
      website: get('website'),
      priceRange: pr ? Number(pr) : undefined,
      rating: rt ? Number(rt) : undefined,
      notes: get('notes'),
      createdAt: base?.createdAt ?? nowT,
      updatedAt: nowT,
    };
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const optimistic = rowFromForm(fd, editing);
    setFormError(null);
    startTransition(async () => {
      const res = editing
        ? await updateVendorAction(editing._id, fd)
        : await createVendorAction(fd);
      if (!res.ok) {
        setFormError(errLabel(res.error));
        return;
      }
      if (editing) {
        setVendors((prev) => prev.map((v) => (v._id === editing._id ? { ...optimistic } : v)));
      } else {
        setVendors((prev) => [...prev, { ...optimistic, _id: res.id ?? optimistic._id }]);
      }
      setDrawerOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function onRemove(v: VendorRow) {
    if (!confirm(`Supprimer le prestataire « ${v.name} » ?`)) return;
    setVendors((prev) => prev.filter((x) => x._id !== v._id));
    startTransition(async () => {
      const res = await removeVendorAction(v._id);
      if (!res.ok) router.refresh();
    });
  }

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            Annuaire · {vendors.length}
            {cap !== null ? `/${cap}` : ' fiches'}
          </span>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.9rem, 4vw, 2.75rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-foreground)',
            }}
          >
            Prestataires
          </h1>
        </div>
        {surface === 'annuaire' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-0.5">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                aria-label="Vue grille"
                className={cn(
                  'rounded-md p-1.5',
                  view === 'grid'
                    ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                    : 'text-[color:var(--color-muted-foreground)]',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                aria-pressed={view === 'table'}
                aria-label="Vue table"
                className={cn(
                  'rounded-md p-1.5',
                  view === 'table'
                    ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                    : 'text-[color:var(--color-muted-foreground)]',
                )}
              >
                <Rows3 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
            {canWrite ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={openCreate}
                disabled={atCap}
                data-testid="new-vendor"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                Ajouter
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {events.length > 0 ? (
        <div
          className="flex items-center gap-1 self-start rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1"
          role="tablist"
          aria-label="Vue prestataires"
        >
          <button
            type="button"
            role="tab"
            aria-selected={surface === 'annuaire'}
            onClick={() => setSurface('annuaire')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
              surface === 'annuaire'
                ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
            )}
          >
            <Store className="h-4 w-4" strokeWidth={1.85} aria-hidden /> Annuaire{' '}
            <span className="font-mono text-[10px] tabular-nums opacity-70">{vendors.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={surface === 'parMariage'}
            onClick={() => setSurface('parMariage')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
              surface === 'parMariage'
                ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
            )}
          >
            <Heart className="h-4 w-4" strokeWidth={1.85} aria-hidden /> Par mariage
          </button>
        </div>
      ) : null}

      {surface === 'parMariage' ? (
        <VendorEngagements
          vendors={vendors}
          events={events}
          engagements={engagements}
          setEngagements={setEngagements}
          canWrite={canWrite}
        />
      ) : (
        <>
          {atCap ? (
            <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-warning)] uppercase">
              Annuaire plein ({cap} fiches). Passez à Business pour un annuaire illimité.
            </p>
          ) : null}

          {/* Toolbar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex flex-1 items-center">
              <Search
                className="pointer-events-none absolute left-3 h-4 w-4 text-[color:var(--color-muted-foreground)]"
                strokeWidth={1.9}
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un prestataire…"
                aria-label="Rechercher"
                className="focus-ring h-10 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] pr-3 pl-9 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)]"
              />
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className={selectClass} aria-label="Filtrer par catégorie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vendors.length > 0 ? (
              <span className="font-mono text-[10px] tracking-[0.16em] whitespace-nowrap text-[color:var(--color-muted-foreground)] uppercase">
                {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>

          {vendors.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-14 text-center">
              <p className="max-w-sm text-sm text-[color:var(--color-muted-foreground)]">
                Aucun prestataire. {canWrite ? 'Ajoutez votre premier contact.' : ''}
              </p>
              {canWrite ? (
                <Button type="button" variant="primary" size="md" onClick={openCreate}>
                  <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                  Ajouter un prestataire
                </Button>
              ) : null}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center">
              <p className="text-sm text-[color:var(--color-muted-foreground)]">
                Aucun prestataire ne correspond à ces filtres.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
                className="text-xs text-[color:var(--color-blush-300)] underline-offset-2 hover:underline"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((v) => (
                <article
                  key={v._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailVendor(v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailVendor(v);
                    }
                  }}
                  className="focus-ring group flex cursor-pointer flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-[color:var(--color-border-strong)] hover:shadow-[var(--shadow-lifted)]"
                >
                  <div className="flex items-start gap-3">
                    <VendorAvatar name={v.name} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <h3 className="font-display truncate text-lg text-[color:var(--color-foreground)] italic">
                        {v.name}
                      </h3>
                      <CategoryTint category={v.category} />
                    </div>
                    {canWrite ? (
                      <div
                        className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(v)}
                          aria-label={`Modifier ${v.name}`}
                          className="focus-ring rounded-md p-1.5 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.85} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(v)}
                          aria-label={`Supprimer ${v.name}`}
                          className="focus-ring rounded-md p-1.5 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Stars rating={v.rating} showValue />
                    <PricePips range={v.priceRange} />
                  </div>
                  {v.location ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-muted-foreground)]">
                      <MapPin className="h-3 w-3" strokeWidth={1.85} aria-hidden />
                      {v.location}
                    </span>
                  ) : null}
                  <QuickContacts v={v} />
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                    <th className="px-4 py-3 font-medium">Prestataire</th>
                    <th className="px-4 py-3 font-medium">Catégorie</th>
                    <th className="px-4 py-3 font-medium">Localisation</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 font-medium">Prix</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr
                      key={v._id}
                      className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailVendor(v)}
                          className="focus-ring flex items-center gap-2.5 text-left font-medium text-[color:var(--color-foreground)] transition-colors hover:text-[color:var(--color-blush-300)]"
                        >
                          <VendorAvatar name={v.name} size={32} />
                          {v.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryTint category={v.category} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[color:var(--color-muted-foreground)]">
                        {v.location ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Stars rating={v.rating} showValue />
                      </td>
                      <td className="px-4 py-3">
                        <PricePips range={v.priceRange} />
                      </td>
                      <td className="px-4 py-3">
                        {canWrite ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(v)}
                              aria-label={`Modifier ${v.name}`}
                              className="focus-ring rounded-md p-1.5 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.85} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemove(v)}
                              aria-label={`Supprimer ${v.name}`}
                              className="focus-ring rounded-md p-1.5 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-danger)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editing ? 'Modifier le prestataire' : 'Nouveau prestataire'}</DrawerTitle>
          </DrawerHeader>
          <form
            key={editing?._id ?? 'new'}
            onSubmit={onSubmit}
            className="flex flex-col gap-4 pb-2"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Nom *
                </span>
                <Input
                  name="name"
                  required
                  defaultValue={editing?.name ?? ''}
                  placeholder="Domaine de Bellevue"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Catégorie
                </span>
                <Select name="category" defaultValue={editing?.category ?? 'Lieu'}>
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Localisation
                </span>
                <Input
                  name="location"
                  defaultValue={editing?.location ?? ''}
                  placeholder="Provence"
                />
              </label>
              <div className="sm:col-span-2">
                <PhoneFieldPair phone={editing?.phone} whatsapp={editing?.whatsapp} />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Email
                </span>
                <Input name="email" type="email" defaultValue={editing?.email ?? ''} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Site web
                </span>
                <Input
                  name="website"
                  defaultValue={editing?.website ?? ''}
                  placeholder="exemple.fr"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Gamme de prix
                </span>
                <PriceRangeField
                  defaultValue={editing?.priceRange ? String(editing.priceRange) : ''}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Note (0–5)
                </span>
                <RatingField defaultValue={editing?.rating != null ? String(editing.rating) : ''} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Notes internes
                </span>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editing?.notes ?? ''}
                  className="focus-ring rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 py-2 text-sm text-[color:var(--color-foreground)]"
                />
              </label>
            </div>
            {formError ? (
              <p role="alert" className="text-sm text-[color:var(--color-danger)]">
                {formError}
              </p>
            ) : null}
            <div className="mt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                Annuler
              </button>
              <Button type="submit" variant="primary" size="md" disabled={pending}>
                {pending ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Fiche prestataire (lecture) */}
      <Drawer open={detailVendor !== null} onOpenChange={(o) => !o && setDetailVendor(null)}>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle className="sr-only">{detailVendor?.name ?? 'Prestataire'}</DrawerTitle>
          </DrawerHeader>
          {detailVendor ? (
            <div className="flex flex-col gap-5 pb-2">
              <div className="flex items-start gap-3">
                <VendorAvatar name={detailVendor.name} size={56} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="font-display text-xl text-[color:var(--color-foreground)] italic">
                    {detailVendor.name}
                  </h2>
                  <span className="flex items-center gap-2">
                    <CategoryTint category={detailVendor.category} />
                    <PricePips range={detailVendor.priceRange} />
                  </span>
                  <Stars rating={detailVendor.rating} showValue />
                </div>
              </div>
              <QuickContacts v={detailVendor} />
              <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                  Coordonnées
                </span>
                <Kv label="Localisation" value={detailVendor.location} />
                <Kv label="Téléphone" value={detailVendor.phone} mono />
                <Kv label="WhatsApp" value={detailVendor.whatsapp} mono />
                <Kv label="Email" value={detailVendor.email} />
                <Kv label="Site web" value={detailVendor.website} />
                <Kv label="Gamme" value={priceWord(detailVendor.priceRange)} />
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                  Mariages — historique
                </span>
                {(() => {
                  const vendorEngs = engagements.filter((e) => e.vendorId === detailVendor._id);
                  if (vendorEngs.length === 0) {
                    return (
                      <p className="text-sm text-[color:var(--color-muted-foreground)]">
                        Aucun mariage rattaché pour l’instant.
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-col gap-2">
                      {vendorEngs.map((e) => {
                        const meta = ENGAGEMENT_STATUS_META[e.status];
                        const label = events.find((ev) => ev._id === e.eventId)?.label ?? 'Mariage';
                        return (
                          <div
                            key={e._id}
                            className="flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-2 first:border-0 first:pt-0"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--color-foreground)]">
                              {label}
                            </span>
                            <span className="flex flex-shrink-0 items-center gap-2">
                              {e.plannedMinor ? (
                                <span className="font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                                  {formatEurMinor(e.plannedMinor)}
                                </span>
                              ) : null}
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                                style={{ background: meta.bg, color: meta.fg }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: meta.dot }}
                                  aria-hidden
                                />
                                {meta.label}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              {detailVendor.notes ? (
                <div className="flex flex-col gap-1.5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                  <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                    Notes internes
                  </span>
                  <p className="text-sm whitespace-pre-wrap text-[color:var(--color-ink-700)]">
                    {detailVendor.notes}
                  </p>
                </div>
              ) : null}
              {canWrite ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => {
                      const v = detailVendor;
                      setDetailVendor(null);
                      openEdit(v);
                    }}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    Modifier
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/** Gamme de prix — option « — » (vide) sélectionnable → sentinelle "none" remappée vers "" (Cas 5). */
function PriceRangeField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue || 'none');
  return (
    <>
      <input type="hidden" name="priceRange" value={value === 'none' ? '' : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className={selectClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          <SelectItem value="1">€</SelectItem>
          <SelectItem value="2">€€</SelectItem>
          <SelectItem value="3">€€€</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

/** Note 0–5 — option « — » (vide) sélectionnable → sentinelle "none" remappée vers "" (Cas 5). */
function RatingField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue || 'none');
  return (
    <>
      <input type="hidden" name="rating" value={value === 'none' ? '' : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className={selectClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          {[1, 2, 3, 4, 5].map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} ★
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function Kv({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
      <span
        className={cn(
          'truncate text-right text-[color:var(--color-foreground)]',
          mono && 'font-mono text-xs',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}
