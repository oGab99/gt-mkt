const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number) {
  return brl.format(cents / 100);
}

/** Aceita "1.234,56", "1234.56", "R$ 1.234,56". Retorna centavos ou null. */
export function parseBRL(input: string): number | null {
  const cleaned = input.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  // "1.500" ou "12.000.000" sem vírgula: pontos são separadores de milhar.
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(value) ? value : null;
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
