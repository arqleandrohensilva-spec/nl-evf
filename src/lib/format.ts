const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const n2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtR = (v: number) => brl.format(Number.isFinite(v) ? v : 0);
export const fmtN = (v: number, d = 2) =>
  d === 2
    ? n2.format(v || 0)
    : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(
        v || 0,
      );
export const fmtM2 = (v: number) => `${n2.format(v || 0)} m²`;
export const fmtPct = (v: number, d = 1) => `${fmtN(v, d)}%`;
export const fmtData = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
};

/** Aceita "1.234,56", "1234,56" ou "1234.56". */
export function parseNum(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const v = Number(norm.replace(/[^\d.-]/g, ""));
  return Number.isFinite(v) ? v : 0;
}

/** Aceita link colado sem "https://" e devolve null quando vazio. */
export function normalizaLink(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Nome curto do site para exibir no lugar do link inteiro. */
export function siteDoLink(v: string | null | undefined): string {
  if (!v) return "";
  try {
    return new URL(v).hostname.replace(/^www\./, "");
  } catch {
    return v;
  }
}
