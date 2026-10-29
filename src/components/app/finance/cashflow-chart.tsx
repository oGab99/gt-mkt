"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/money";

export const INCOME_COLOR = "#3D6FB0";
export const EXPENSE_COLOR = "#D06A36";

type Point = { key: string; label: string; income: number; expense: number };

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-[0_8px_24px_-12px_rgba(23,23,23,0.3)]">
      <p className="mb-1 font-medium capitalize">{p.label}</p>
      <p className="flex items-center gap-2"><span className="size-2 rounded-sm" style={{ background: INCOME_COLOR }} /> Entradas: {formatBRL(p.income)}</p>
      <p className="flex items-center gap-2"><span className="size-2 rounded-sm" style={{ background: EXPENSE_COLOR }} /> Saídas: {formatBRL(p.expense)}</p>
      <p className="mt-1 border-t border-line pt-1 font-medium">Resultado: {formatBRL(p.income - p.expense)}</p>
    </div>
  );
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function CashflowChart({ data }: { data: Point[] }) {
  return (
    <div className="h-[260px] w-full" role="img" aria-label="Fluxo de caixa mensal: entradas e saídas efetivadas">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#EAE7E1" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "#85817B" }} dy={6} />
          <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11.5, fill: "#85817B" }} tickFormatter={(v: number) => compact.format(v / 100)} />
          <Tooltip content={<Tip />} cursor={{ fill: "#F5F1E9" }} />
          <Bar dataKey="income" name="Entradas" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          <Bar dataKey="expense" name="Saídas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
