import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Config, Evf } from "@/lib/calc";
import { fmtR, parseNum } from "@/lib/format";
import { PACOTES_INICIAIS } from "@/lib/biblioteca";

const TIPOS = ["Reforma de interiores", "Reforma com ampliação", "Construção do zero", "Comercial"];
const PADROES = ["Baixo", "Médio", "Alto"];
const ORIGENS = ["Próprio", "Financiamento", "Misto"];

export type EvfDados = Pick<
  Evf,
  | "cliente"
  | "obra"
  | "tipo_obra"
  | "cidade_uf"
  | "area_m2"
  | "padrao"
  | "target"
  | "origem_recurso"
  | "data_base"
  | "observacoes"
>;

const hoje = () => new Date().toISOString().slice(0, 10);

export function EvfFormDialog({
  trigger,
  titulo,
  inicial,
  config,
  onSubmit,
  textoBotao,
  comPacote = false,
}: {
  trigger: React.ReactNode;
  titulo: string;
  inicial?: Partial<EvfDados>;
  config?: Config | null | undefined;
  onSubmit: (d: EvfDados, pacote: string) => Promise<void> | void;
  textoBotao: string;
  comPacote?: boolean;
}) {
  const [pacote, setPacote] = useState("vazio");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(() => ({
    cliente: inicial?.cliente ?? "",
    obra: inicial?.obra ?? "",
    tipo_obra: inicial?.tipo_obra ?? TIPOS[0] ?? "",
    cidade_uf: inicial?.cidade_uf ?? "",
    area: inicial?.area_m2 != null ? String(inicial.area_m2).replace(".", ",") : "",
    padrao: inicial?.padrao ?? "Médio",
    target: inicial?.target != null ? String(inicial.target).replace(".", ",") : "",
    origem_recurso: inicial?.origem_recurso ?? "Próprio",
    data_base: inicial?.data_base ?? hoje(),
    observacoes: inicial?.observacoes ?? "",
  }));
  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));
  const area = parseNum(f.area);
  const cub = Number(config?.cub_valor) || 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(
        {
          cliente: f.cliente,
          obra: f.obra,
          tipo_obra: f.tipo_obra,
          cidade_uf: f.cidade_uf,
          area_m2: area,
          padrao: f.padrao,
          target: parseNum(f.target),
          origem_recurso: f.origem_recurso,
          data_base: f.data_base,
          observacoes: f.observacoes,
        },
        pacote,
      );
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <label className="text-sm font-medium">
            Obra
            <input
              className="field mt-1"
              required
              placeholder="Ex.: Apartamento Moema"
              value={f.obra}
              onChange={set("obra")}
            />
          </label>
          <label className="text-sm font-medium">
            Cliente
            <input className="field mt-1" required value={f.cliente} onChange={set("cliente")} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Tipo de obra
              <select className="field mt-1" value={f.tipo_obra} onChange={set("tipo_obra")}>
                {TIPOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Cidade / UF
              <input
                className="field mt-1"
                placeholder="São Paulo / SP"
                value={f.cidade_uf ?? ""}
                onChange={set("cidade_uf")}
              />
            </label>
            <label className="text-sm font-medium">
              Área (m²)
              <input
                className="field mt-1 num"
                inputMode="decimal"
                placeholder="70,00"
                value={f.area}
                onChange={set("area")}
              />
            </label>
            <label className="text-sm font-medium">
              Padrão
              <select className="field mt-1" value={f.padrao} onChange={set("padrao")}>
                {PADROES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Target do cliente (R$)
              <input
                className="field mt-1 num"
                inputMode="decimal"
                placeholder="Valor que quer investir"
                value={f.target}
                onChange={set("target")}
              />
            </label>
            <label className="text-sm font-medium">
              Origem do recurso
              <select
                className="field mt-1"
                value={f.origem_recurso}
                onChange={set("origem_recurso")}
              >
                {ORIGENS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Data-base dos preços
              <input
                className="field mt-1"
                type="date"
                value={f.data_base}
                onChange={set("data_base")}
              />
            </label>
          </div>
          {comPacote ? (
            <label className="text-sm font-medium">
              Começar a partir de
              <select
                className="field mt-1"
                value={pacote}
                onChange={(e) => {
                  setPacote(e.target.value);
                  const tipo =
                    e.target.value === "construcao"
                      ? "Construção do zero"
                      : e.target.value === "vazio"
                        ? f.tipo_obra
                        : "Reforma de interiores";
                  setF((p) => ({ ...p, tipo_obra: tipo }));
                }}
              >
                {PACOTES_INICIAIS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {pacote === "vazio"
                  ? "EVF vazio, com um ambiente."
                  : `Cria os ambientes (${PACOTES_INICIAIS.find((p) => p.id === pacote)
                      ?.ambientes.map((a) => a.nome)
                      .join(
                        ", ",
                      )}) com os serviços típicos. Depois é só informar as medidas e revisar.`}
              </span>
            </label>
          ) : null}
          <label className="text-sm font-medium">
            Observações / premissas
            <textarea
              className="field mt-1 h-20 py-2"
              value={f.observacoes ?? ""}
              onChange={set("observacoes")}
            />
          </label>
          {config ? (
            <div className="rounded-lg border border-primary/30 bg-primary-soft p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                Estimativa inicial (norte, não orçamento)
              </div>
              <div className="mt-1 flex justify-between gap-2">
                <span>
                  CUB {config.cub_ref} · {config.cub_uf}
                </span>
                <span className="num">{fmtR(cub)}/m²</span>
              </div>
              <div className="mt-1 flex justify-between gap-2 font-semibold">
                <span>{area ? `${f.area} m² × CUB` : "Informe a área"}</span>
                <span className="num">{area ? fmtR(area * cub) : "—"}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                O CUB não inclui projetos, fundações especiais, paisagismo, piscina, impostos nem
                taxas. Em reforma, use como ordem de grandeza. O valor real sai do EVF.
              </p>
            </div>
          ) : null}
          <Button disabled={busy} className="h-11">
            {textoBotao}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
