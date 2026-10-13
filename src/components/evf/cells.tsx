import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Link as LinkIcon, Pencil } from "lucide-react";
import { fmtN, normalizaLink, parseNum, siteDoLink } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Célula numérica editável: mostra formatado, edita como texto, grava ao sair ou com Enter. */
export function NumCell({
  value,
  onSave,
  decimals = 2,
  className,
  label,
}: {
  value: number;
  onSave: (v: number) => void;
  decimals?: number;
  className?: string;
  label?: string;
}) {
  const [txt, setTxt] = useState(fmtN(Number(value) || 0, decimals));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setTxt(fmtN(Number(value) || 0, decimals));
  }, [value, decimals, editing]);
  const commit = () => {
    setEditing(false);
    const v = parseNum(txt);
    if (Math.abs(v - (Number(value) || 0)) > 1e-9) onSave(v);
    else setTxt(fmtN(Number(value) || 0, decimals));
  };
  return (
    <input
      aria-label={label}
      className={cn("cell-input num min-w-[5.5rem] text-right", className)}
      value={txt}
      inputMode="decimal"
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setTxt(fmtN(Number(value) || 0, decimals));
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** Célula de texto editável. */
export function TextCell({
  value,
  onSave,
  className,
  label,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
}) {
  const [txt, setTxt] = useState(value ?? "");
  useEffect(() => setTxt(value ?? ""), [value]);
  return (
    <input
      aria-label={label}
      placeholder={placeholder}
      className={cn("cell-input", className)}
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        if (txt !== (value ?? "")) onSave(txt);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function SelectCell({
  value,
  options,
  onSave,
  label,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      className={cn("cell-input min-w-[8rem] cursor-pointer", className)}
      value={value}
      onChange={(e) => onSave(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Kpi({
  titulo,
  valor,
  nota,
  tom = "normal",
}: {
  titulo: string;
  valor: ReactNode;
  nota?: ReactNode;
  tom?: "normal" | "alerta" | "ok";
}) {
  return (
    <div
      className={cn(
        "card flex flex-col gap-1 px-4 py-3",
        tom === "alerta" && "border-warning/40 bg-warning-soft",
        tom === "ok" && "border-primary/30 bg-primary-soft",
      )}
    >
      <div
        className={cn(
          "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          tom === "alerta" && "text-warning",
        )}
      >
        {titulo}
      </div>
      <div className={cn("num text-2xl font-semibold", tom === "alerta" && "text-warning")}>
        {valor}
      </div>
      {nota ? (
        <div className={cn("text-xs text-muted-foreground", tom === "alerta" && "text-warning")}>
          {nota}
        </div>
      ) : null}
    </div>
  );
}

export function TipoTag({ tipo }: { tipo: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    composicao: { label: "Composição", cls: "bg-primary-soft text-primary" },
    cotacao: { label: "Cotação", cls: "bg-[#E4ECF5] text-[#1D3F66]" },
    verba: { label: "Verba", cls: "bg-muted text-foreground" },
  };
  const t = map[tipo] ?? { label: tipo, cls: "bg-muted text-foreground" };
  return (
    <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", t.cls)}>
      {t.label}
    </span>
  );
}

export const TIPO_OPTIONS = [
  { value: "composicao", label: "Composição" },
  { value: "cotacao", label: "Cotação" },
  { value: "verba", label: "Verba" },
];

export const ETAPA_OPTIONS = [
  { value: "Agora", label: "Agora" },
  { value: "Etapa futura", label: "Etapa futura" },
];

export const STATUS_OPTIONS = ["Rascunho", "Escopo", "Cotações", "Apresentado", "Aprovado"].map(
  (s) => ({ value: s, label: s }),
);

/** Link de produto/fornecedor: mostra o site e abre em nova aba; clique no lápis para colar ou trocar. */
export function LinkCell({
  value,
  onSave,
  label = "Link do produto",
  compact = false,
}: {
  value: string | null | undefined;
  onSave: (v: string | null) => void;
  label?: string;
  compact?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [txt, setTxt] = useState(value ?? "");
  useEffect(() => setTxt(value ?? ""), [value]);
  const salvar = () => {
    setEditando(false);
    const novo = normalizaLink(txt);
    if (novo !== (value ?? null)) onSave(novo);
  };
  if (editando)
    return (
      <input
        autoFocus
        aria-label={label}
        placeholder="Cole o link (https://…)"
        className="cell-input min-w-[14rem] border-primary"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setTxt(value ?? "");
            setEditando(false);
          }
        }}
      />
    );
  if (!value)
    return (
      <button
        type="button"
        aria-label={`Adicionar ${label.toLowerCase()}`}
        title={`Adicionar ${label.toLowerCase()}`}
        className="inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-primary"
        onClick={() => setEditando(true)}
      >
        <LinkIcon className="size-3.5" />
        {compact ? null : "link"}
      </button>
    );
  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-0.5">
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        title={value}
        className="inline-flex min-w-0 items-center gap-1 rounded px-1.5 text-xs font-medium text-primary hover:bg-primary-soft"
      >
        <ExternalLink className="size-3.5 shrink-0" />
        {compact ? null : <span className="truncate">{siteDoLink(value)}</span>}
      </a>
      <button
        type="button"
        aria-label={`Editar ${label.toLowerCase()}`}
        title="Trocar ou apagar o link"
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        onClick={() => setEditando(true)}
      >
        <Pencil className="size-3" />
      </button>
    </span>
  );
}
