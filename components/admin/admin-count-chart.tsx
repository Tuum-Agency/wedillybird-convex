'use client';

import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Graphe à barres générique pour des **comptes** (events, signups, par mois ou
 * par jour de semaine). Contrairement à `AdminRevenueChart`, ne divise pas par
 * 100 — les valeurs sont des effectifs bruts. L'ordre des barres suit l'ordre
 * du tableau `data` fourni (le caller trie).
 */
export function AdminCountChart({
  data,
  color = 'oklch(65% 0.15 22)',
  unit = '',
}: {
  data: { label: string; value: number }[];
  color?: string;
  unit?: string;
}) {
  const t = useTranslations('Admin');
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[color:var(--color-muted-foreground)]">
        {t('charts.noData')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="label"
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          tickLine={false}
        />
        <YAxis
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-surface-elevated)', opacity: 0.4 }}
          contentStyle={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-foreground)',
            fontSize: 12,
          }}
          formatter={(value) => [`${value}${unit ? ` ${unit}` : ''}`, '']}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
