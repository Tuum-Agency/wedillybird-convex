'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AdminRevenueChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({
      month: month.slice(2),
      revenue: amount / 100,
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
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          tickLine={false}
        />
        <YAxis
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          tickLine={false}
          tickFormatter={(v: number) => `${v} €`}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-foreground)',
            fontSize: 12,
          }}
          formatter={(value) => [`${value} €`, 'Revenu']}
        />
        <Bar dataKey="revenue" fill="oklch(65% 0.15 22)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
