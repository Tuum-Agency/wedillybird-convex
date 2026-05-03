'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS: Record<string, string> = {
  EUR: 'oklch(65% 0.15 22)',
  XOF: 'oklch(65% 0.12 145)',
  MAD: 'oklch(65% 0.08 250)',
  TND: 'oklch(65% 0.1 78)',
  stripe: 'oklch(60% 0.15 270)',
  cinetpay: 'oklch(65% 0.12 145)',
  mock: 'oklch(55% 0.05 78)',
};

export function AdminCurrencyChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value: value / 100,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[color:var(--color-muted-foreground)]">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] ?? 'oklch(50% 0.05 78)'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-foreground)',
            fontSize: 12,
          }}
          formatter={(value) => [`${value} €`, '']}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
