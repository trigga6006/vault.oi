import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ProviderLogo } from '../providers/ProviderLogo';

interface ProviderComparisonProps {
  data: Array<{
    providerId: string;
    costUsd: number;
    requestCount: number;
  }>;
}

const COLORS = [
  'oklch(0.7 0.15 40)',   // anthropic orange
  'oklch(0.75 0.15 155)', // openai green
  'oklch(0.7 0.15 250)',  // blue
  'oklch(0.7 0.15 320)',  // purple
  'oklch(0.7 0.15 80)',   // yellow
];

export function ProviderComparison({ data }: ProviderComparisonProps) {
  if (data.length === 0) {
    return (
      <div className="glass rounded-xl p-5">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Provider Cost Split
        </h3>
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.providerId,
    value: d.costUsd,
    requests: d.requestCount,
  }));

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Provider Cost Split
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'oklch(0.17 0 0 / 0.9)',
              border: '1px solid oklch(0.3 0 0)',
              borderRadius: '8px',
              color: 'oklch(0.985 0 0)',
              fontSize: 12,
            }}
            formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2">
        {chartData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <ProviderLogo providerId={d.name} size={14} />
            <span className="text-[11px] text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
