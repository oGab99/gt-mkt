"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductionPoint } from "@/lib/domain/reports";

type TooltipProps = { active?: boolean; payload?: { payload: ProductionPoint }[] };

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-[0_8px_24px_-12px_rgba(23,23,23,0.3)]">
      <p className="mb-1 font-medium text-fg capitalize">{p.fullLabel}</p>
      <p className="flex items-center gap-2 text-fg">
        <span className="size-2.5 rounded-sm bg-fg" aria-hidden /> {p.delivered} {p.delivered === 1 ? "entrega" : "entregas"}
      </p>
      <p className="flex items-center gap-2 text-muted-strong">
        <span className="h-0.5 w-3 border-t-2 border-dashed border-[#85817B]" aria-hidden /> Meta: {p.target ?? "sem meta"}
      </p>
    </div>
  );
}

/** Marca da meta sobre cada mês (meses sem meta ficam sem marca). */
function TargetTick(props: { cx?: number; cy?: number; value?: number | null; index?: number }) {
  const { cx, cy, value, index } = props;
  if (value == null || cx == null || cy == null) return <g key={index} />;
  return <line key={index} x1={cx - 20} x2={cx + 20} y1={cy} y2={cy} stroke="#85817B" strokeWidth={2} strokeDasharray="4 3" />;
}

/** Entregas por mês (barras) e soma das metas vigentes (linha tracejada). */
export function ProductionChart({ points }: { points: ProductionPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.delivered, p.target ?? 0)));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-[12px] text-muted-strong" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-fg" /> Entregas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-[#85817B]" /> Meta somada
        </span>
      </div>
      <div className="h-[220px] w-full" role="img" aria-label="Entregas por mês comparadas à meta">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="#EAE7E1" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "#85817B" }} dy={6} />
            <YAxis allowDecimals={false} domain={[0, Math.ceil(max * 1.15)]} tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "#85817B" }} width={48} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#171717", fillOpacity: 0.04 }} />
            <Bar dataKey="delivered" fill="#171717" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
            <Line dataKey="target" stroke="none" dot={<TargetTick />} activeDot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
