'use client';

import { useTranslations } from 'next-intl';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type MonthData = { couple: number; pro: number; guest: number };

export function AdminUsersChart({ data }: { data: Record<string, MonthData> }) {
  const t = useTranslations('Admin');
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({
      month: month.slice(2),
      ...counts,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[color:var(--color-muted-foreground)]">
        {t('charts.noData')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          tickLine={false}
        />
        <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-foreground)',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="couple"
          stackId="1"
          stroke="oklch(65% 0.15 22)"
          fill="oklch(65% 0.15 22 / 0.3)"
          name={t('charts.couples')}
        />
        <Area
          type="monotone"
          dataKey="pro"
          stackId="1"
          stroke="oklch(65% 0.12 145)"
          fill="oklch(65% 0.12 145 / 0.3)"
          name={t('charts.pros')}
        />
        <Area
          type="monotone"
          dataKey="guest"
          stackId="1"
          stroke="oklch(65% 0.08 250)"
          fill="oklch(65% 0.08 250 / 0.3)"
          name={t('charts.guests')}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
