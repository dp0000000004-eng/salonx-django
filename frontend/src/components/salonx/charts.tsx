import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

export function TrendChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            fontSize: 12,
          }}
        />
        <Area type="linear" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="url(#trendFill)" />
        <Line type="linear" dataKey="value" stroke="var(--color-primary)" dot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} />
        <Tooltip
          cursor={{ fill: "var(--color-muted)" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  total,
  label = "Total",
}: {
  data: { name: string; value: number; color: string }[];
  total: string;
  label?: string;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={1} stroke="none">
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-card)",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground">{total}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { name: string; value: string; color: string }[] }) {
  return (
    <ul className="grid gap-2 text-xs">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          <span className="text-muted-foreground">{i.name}</span>
          <span className="ml-auto font-medium text-foreground">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}
