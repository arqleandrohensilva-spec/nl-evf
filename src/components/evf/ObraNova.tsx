import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gerarObraNova } from "@/lib/actions";
import { fmtN, fmtR } from "@/lib/format";
import {
  estimarObra,
  programaPadrao,
  TIPOS_AMB,
  type Padrao,
  type Programa,
  type TipoAmb,
} from "@/lib/obraNova";
import type { EvfData } from "./useEvfData";

/** É obra nova (ou ampliação)? Aí o gerador pela casa aparece. */
export const ehObraNova = (tipo: string | undefined) => /constru|ampliac/i.test(tipo ?? "");

const PADROES: Padrao[] = ["Baixo", "Médio", "Alto"];

function lerPrograma(v: unknown, padrao: string): Programa {
  const base = programaPadrao(
    (PADROES as string[]).includes(padrao) ? (padrao as Padrao) : "Médio",
  );
  if (!v || typeof v !== "object") return base;
  const p = v as Partial<Programa>;
  return {
    ...base,
    ...p,
    terreno: { ...base.terreno, ...(p.terreno ?? {}) },
    ambientes: Array.isArray(p.ambientes) ? p.ambientes : base.ambientes,
  };
}

function Num({
  value,
  onChange,
  label,
  step = 0.1,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={0}
      aria-label={label}
      className={`field h-9 text-right ${className}`}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

function Escolha<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap overflow-hidden rounded-lg border"
    >
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`min-h-9 px-3 text-sm ${value === v ? "bg-primary font-semibold text-primary-foreground" : "bg-card hover:bg-muted"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Botão + formulário "Dados da casa" que monta a obra inteira. */
export function ObraNova({ d, destaque = false }: { d: EvfData; destaque?: boolean }) {
  const { evf, config, todosItens, ambientes } = d;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<Programa>(() => lerPrograma(evf?.programa, evf?.padrao ?? "Médio"));
  const [verPremissas, setVerPremissas] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const obra = useMemo(() => estimarObra(p), [p]);
  if (!evf) return null;
  const nItens = obra.gerais.length + obra.ambientes.reduce((s, a) => s + a.linhas.length, 0);
  const cub = Number(config?.cub_valor) || 0;
  const set = <K extends keyof Programa>(k: K, v: Programa[K]) => setP((x) => ({ ...x, [k]: v }));
  const setAmb = (i: number, v: Partial<Programa["ambientes"][number]>) =>
    setP((x) => ({ ...x, ambientes: x.ambientes.map((a, k) => (k === i ? { ...a, ...v } : a)) }));
  const addAmb = (tipo: TipoAmb) =>
    setP((x) => {
      const mesmo = x.ambientes.filter((a) => a.tipo === tipo).length;
      const rot = TIPOS_AMB[tipo].rotulo;
      return {
        ...x,
        ambientes: [
          ...x.ambientes,
          {
            nome: mesmo ? `${rot} ${mesmo + 1}` : rot,
            tipo,
            area: TIPOS_AMB[tipo].area[PADROES.indexOf(x.padrao)] ?? TIPOS_AMB[tipo].area[1],
            pavimento: 1,
          },
        ],
      };
    });

  async function gerar() {
    if (
      (todosItens.length || ambientes.length) &&
      !confirm(
        `Isso adiciona ${obra.ambientes.length} ambientes e ${nItens} serviços ao EVF. O que já existe continua (confira duplicidades depois). Continuar?`,
      )
    )
      return;
    setOcupado(true);
    try {
      const n = await gerarObraNova(evf!.id, obra, p, todosItens, ambientes.length);
      await qc.invalidateQueries();
      toast.success(`Obra montada: ${obra.ambientes.length} ambientes e ${n} serviços.`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar a obra.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      {destaque ? (
        <div className="card flex flex-wrap items-center gap-4 border-primary/40 bg-primary-soft/50 p-4">
          <Building2 className="size-8 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Obra nova: comece pelos dados da casa</div>
            <div className="text-sm text-muted-foreground">
              Terreno, ambientes, pavimentos e padrão. O sistema monta todas as etapas — projetos e
              alvará, fundação, estrutura, alvenaria, cobertura, instalações, acabamentos, área
              externa e habite-se — com quantidades estimadas.
            </div>
          </div>
          <Button className="h-10" onClick={() => setOpen(true)}>
            <Building2 className="size-4" /> Dados da casa
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="h-9" onClick={() => setOpen(true)}>
          <Building2 className="size-4" /> Dados da casa
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Construção do zero · dados da casa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Terreno</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    Frente
                    <Num
                      className="w-20"
                      label="Frente do terreno (m)"
                      value={p.terreno.frente}
                      onChange={(v) => set("terreno", { ...p.terreno, frente: v })}
                    />
                    m
                  </label>
                  <label className="flex items-center gap-2">
                    Fundo
                    <Num
                      className="w-20"
                      label="Fundo do terreno (m)"
                      value={p.terreno.fundo}
                      onChange={(v) => set("terreno", { ...p.terreno, fundo: v })}
                    />
                    m
                  </label>
                  <Escolha
                    label="Topografia"
                    value={p.terreno.topografia}
                    options={[
                      ["plano", "Plano"],
                      ["aclive", "Aclive leve"],
                      ["declive", "Declive acentuado"],
                    ]}
                    onChange={(v) => set("terreno", { ...p.terreno, topografia: v })}
                  />
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold">Pavimentos e pé-direito</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <Escolha
                      label="Pavimentos"
                      value={String(p.pavimentos) as "1" | "2"}
                      options={[
                        ["1", "Térrea"],
                        ["2", "Sobrado"],
                      ]}
                      onChange={(v) => set("pavimentos", v === "2" ? 2 : 1)}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <Num
                        className="w-20"
                        step={0.05}
                        label="Pé-direito (m)"
                        value={p.peDireito}
                        onChange={(v) => set("peDireito", v)}
                      />
                      m
                    </label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold">Padrão de acabamento</h3>
                  <Escolha
                    label="Padrão"
                    value={p.padrao}
                    options={PADROES.map((x) => [x, x])}
                    onChange={(v) => set("padrao", v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold">Fundação (confirmar com sondagem)</h3>
                  <Escolha
                    label="Fundação"
                    value={p.fundacao}
                    options={[
                      ["sapata", "Sapata corrida"],
                      ["radier", "Radier"],
                      ["estacas", "Estacas"],
                    ]}
                    onChange={(v) => set("fundacao", v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold">Cobertura</h3>
                  <Escolha
                    label="Cobertura"
                    value={p.cobertura}
                    options={[
                      ["ceramica", "Telha cerâmica"],
                      ["fibrocimento", "Fibrocimento"],
                      ["termoacustica", "Termoacústica"],
                      ["laje", "Laje impermeabilizada"],
                    ]}
                    onChange={(v) => set("cobertura", v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold">Forro</h3>
                  <Escolha
                    label="Forro"
                    value={p.forro}
                    options={[
                      ["gesso", "Gesso"],
                      ["laje", "Laje (sem forro)"],
                      ["pvc", "PVC"],
                    ]}
                    onChange={(v) => set("forro", v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold">Muro</h3>
                  <Escolha
                    label="Muro de divisa"
                    value={p.muro ? "sim" : "nao"}
                    options={[
                      ["sim", "Com muro"],
                      ["nao", "Sem muro"],
                    ]}
                    onChange={(v) => set("muro", v === "sim")}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Ambientes (área útil)</h3>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th className="w-40">Tipo</th>
                        {p.pavimentos === 2 ? <th className="w-28">Pavimento</th> : null}
                        <th className="w-28 text-right">Área (m²)</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {p.ambientes.map((a, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              className="cell-input"
                              aria-label="Nome do ambiente"
                              value={a.nome}
                              onChange={(e) => setAmb(i, { nome: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              className="cell-input"
                              aria-label="Tipo do ambiente"
                              value={a.tipo}
                              onChange={(e) => setAmb(i, { tipo: e.target.value as TipoAmb })}
                            >
                              {(Object.keys(TIPOS_AMB) as TipoAmb[]).map((t) => (
                                <option key={t} value={t}>
                                  {TIPOS_AMB[t].rotulo}
                                </option>
                              ))}
                            </select>
                          </td>
                          {p.pavimentos === 2 ? (
                            <td>
                              <select
                                className="cell-input"
                                aria-label="Pavimento"
                                value={a.pavimento}
                                onChange={(e) =>
                                  setAmb(i, { pavimento: e.target.value === "2" ? 2 : 1 })
                                }
                              >
                                <option value="1">Térreo</option>
                                <option value="2">Superior</option>
                              </select>
                            </td>
                          ) : null}
                          <td>
                            <Num
                              className="w-24 border-0"
                              step={0.5}
                              label="Área do ambiente"
                              value={a.area}
                              onChange={(v) => setAmb(i, { area: v })}
                            />
                          </td>
                          <td>
                            <button
                              className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                              aria-label={`Tirar ${a.nome}`}
                              onClick={() =>
                                setP((x) => ({
                                  ...x,
                                  ambientes: x.ambientes.filter((_, k) => k !== i),
                                }))
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TIPOS_AMB) as TipoAmb[])
                    .filter((t) => t !== "circulacao")
                    .map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs hover:bg-primary-soft"
                        onClick={() => addAmb(t)}
                      >
                        <Plus className="size-3" /> {TIPOS_AMB[t].rotulo}
                      </button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  A circulação ({p.pavimentos === 2 ? "e a escada, " : ""}8% da área) entra sozinha.
                  As medidas de cada ambiente são estimadas pela área; ajuste com a planta depois e
                  os serviços ligados se recalculam.
                </p>
              </section>
            </div>

            <aside className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm lg:sticky lg:top-0 lg:self-start">
              <h3 className="font-semibold">A casa em números</h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Área útil</dt>
                <dd className="num">{fmtN(obra.numeros.areaUtil)} m²</dd>
                <dt className="text-muted-foreground">Área construída</dt>
                <dd className="num font-semibold">{fmtN(obra.numeros.areaConstruida)} m²</dd>
                <dt className="text-muted-foreground">Alvenaria</dt>
                <dd className="num">{fmtN(obra.numeros.alvenaria)} m²</dd>
                <dt className="text-muted-foreground">Fachada</dt>
                <dd className="num">{fmtN(obra.numeros.fachada)} m²</dd>
                <dt className="text-muted-foreground">Cobertura</dt>
                <dd className="num">{fmtN(obra.numeros.cobertura)} m²</dd>
                <dt className="text-muted-foreground">Concreto (pilares e vigas)</dt>
                <dd className="num">{fmtN(obra.numeros.concreto)} m³</dd>
                <dt className="text-muted-foreground">Prazo estimado</dt>
                <dd className="num">{obra.numeros.duracaoMeses} meses</dd>
              </dl>
              {cub ? (
                <div className="rounded-md bg-card p-2.5">
                  <div className="text-xs text-muted-foreground">
                    Norte pelo CUB ({config?.cub_ref || "configurações"})
                  </div>
                  <div className="num text-base font-semibold">
                    {fmtR(cub * obra.numeros.areaConstruida)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    O CUB não inclui fundações especiais, projetos, taxas, muro, paisagismo nem
                    equipamentos. Serve de referência, não de orçamento.
                  </div>
                </div>
              ) : null}
              <div className="rounded-md bg-card p-2.5">
                <div className="num text-base font-semibold">
                  {obra.ambientes.length} ambientes · {nItens} serviços
                </div>
                <div className="text-xs text-muted-foreground">
                  em todas as etapas, com preço do catálogo quando houver; o restante fica para
                  cotar.
                </div>
              </div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-primary"
                onClick={() => setVerPremissas((v) => !v)}
                aria-expanded={verPremissas}
              >
                <ChevronDown
                  className={`size-3.5 transition-transform ${verPremissas ? "rotate-180" : ""}`}
                />
                Premissas do cálculo ({obra.premissas.length})
              </button>
              {verPremissas ? (
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {obra.premissas.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
              <Button
                className="h-11 w-full"
                disabled={ocupado || !p.ambientes.length}
                onClick={gerar}
              >
                <Building2 className="size-4" />{" "}
                {ocupado ? "Montando a obra…" : "Montar a obra completa"}
              </Button>
            </aside>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
