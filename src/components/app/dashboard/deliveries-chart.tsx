"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint } from "@/lib/domain/dashboard";

type TooltipProps = { active?: boolean; payload?: { payload: ChartPoint }[] };

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-[0_8px_24px_-12px_rgba(23,23,23,0.3)]">
      <p className="mb-1 font-medium text-fg capitalize">{p.currentLabel}</p>
      <p className="flex items-center gap-2 text-fg">
        <span className="h-0.5 w-3 rounded bg-fg" aria-hidden /> {p.current} {p.current === 1 ? "entrega" : "entregas"}
      </p>
      {p.previousLabel ? (
        <p className="flex items-center gap-2 text-muted-strong">
          <span className="h-0.5 w-3 rounded border-t-2 border-dashed border-[#B3ADA3]" aria-hidden />
          <span className="capitalize">{p.previousLabel}</span>: {p.previous}
        </p>
      ) : null}
    </div>
  );
}

export function DeliveriesChart({ points, lastIndexWithData }: { points: ChartPoint[]; lastIndexWithData: number }) {
  // Dias futuros ficam sem valor (linha não "cai" para zero).
  const data = points.map((p, i) => ({ ...p, currentPlot: i <= lastIndexWithData ? p.current : null }));
  const max = Math.max(1, ...points.map((p) => Math.max(p.current, p.previous)));
  const interval = points.length > 20 ? Math.ceil(points.length / 10) - 1 : 0;

  return (
    <div className="h-[240px] w-full" role="img" aria-label="Gráfico de entregas do período comparado ao período anterior">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="gt-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#171717" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#171717" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#EAE7E1" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={interval} tick={{ fontSize: 11.5, fill: "#85817B" }} dy={6} />
          <YAxis allowDecimals={false} domain={[0, Math.ceil(max * 1.15)]} tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "#85817B" }} width={48} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#DCD8D0", strokeWidth: 1 }} />
          <Line type="monotone" dataKey="previous" stroke="#B3ADA3" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4, fill: "#B3ADA3", stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
          <Area type="monotone" dataKey="currentPlot" stroke="#171717" strokeWidth={2} fill="url(#gt-area)" dot={false} activeDot={{ r: 4, fill: "#171717", stroke: "#fff", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
