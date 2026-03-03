import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CostChartProps {
  data: Array<{ date: string; cost: number }>;
  title?: string;
}

export function CostChart({ data, title = 'Cost Over Time' }: CostChartProps) {
  if (data.length === 0) {
    return (
      <div className="glass rounded-xl p-5 h-72 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No cost data available</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickFormatter={(value) => `$${value.toFixed(2)}`}
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
            formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="oklch(0.7 0.15 250)"
            strokeWidth={2}
            fill="url(#costGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
