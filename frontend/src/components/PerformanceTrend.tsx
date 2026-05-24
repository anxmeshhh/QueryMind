/**
 * PerformanceTrend — visual line chart of score changes before vs after optimization.
 * Uses Recharts line charts with QueryMind's styling tokens.
 */

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useTheme } from "@/hooks/useTheme";

interface TrendData {
  name: string;
  before: number;
  after: number;
}

interface PerformanceTrendProps {
  data?: TrendData[];
}

export function PerformanceTrend({ data }: PerformanceTrendProps) {
  const { isDark } = useTheme();

  // Mock trend data if none is provided
  const chartData = data || [
    { name: "Query 1", before: 65, after: 90 },
    { name: "Query 2", before: 40, after: 85 },
    { name: "Query 3", before: 80, after: 95 },
    { name: "Query 4", before: 55, after: 90 },
    { name: "Query 5", before: 30, after: 80 },
  ];

  const colors = {
    grid: isDark ? "#27272a40" : "#e4e4e780",
    text: isDark ? "#71717a" : "#71717a",
    tooltipBg: isDark ? "#111113" : "#ffffff",
    tooltipBorder: isDark ? "#27272a" : "#e4e4e7",
  };

  return (
    <div className="w-full h-[220px] bg-panel border border-border rounded-xl p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBefore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorAfter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
          <XAxis
            dataKey="name"
            stroke={colors.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke={colors.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            dx={-8}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              borderColor: colors.tooltipBorder,
              borderRadius: "8px",
              fontSize: "11px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
            itemStyle={{ color: isDark ? "#fafafa" : "#09090b" }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }}
          />
          <Area
            name="Before Optimization"
            type="monotone"
            dataKey="before"
            stroke="#ef4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorBefore)"
          />
          <Area
            name="After Optimization"
            type="monotone"
            dataKey="after"
            stroke="#06b6d4"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorAfter)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
