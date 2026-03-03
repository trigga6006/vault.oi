import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TokenUsageChartProps {
  data: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
  }>;
  title?: string;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function TokenUsageChart({ data, title = 'Token Usage' }: TokenUsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="glass rounded-xl p-5 h-72 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No token data available</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
            axisLine={{ stroke: 'oklch(0.3 0 0)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
            axisLine={{ stroke: 'oklch(0.3 0 0)' }}
            tickLine={false}
            tickFormatter={formatTokens}
          />
          <Tooltip
            contentStyle={{
              background: 'oklch(0.17 0 0 / 0.9)',
              border: '1px solid oklch(0.3 0 0)',
              borderRadius: '8px',
              backdropFilter: 'blur(12px)',
              color: 'oklch(0.985 0 0)',
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              formatTokens(value),
              name === 'inputTokens' ? 'Input Tokens' : 'Output Tokens',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'oklch(0.65 0 0)' }}
            formatter={(value) => (value === 'inputTokens' ? 'Input' : 'Output')}
          />
          <Bar dataKey="inputTokens" fill="oklch(0.7 0.15 250)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="outputTokens" fill="oklch(0.7 0.15 200)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
