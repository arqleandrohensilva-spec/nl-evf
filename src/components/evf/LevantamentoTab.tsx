import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { efeitoMedicao, tipoMedicao, TIPOS_POR_AREA, totalMedicao, type Medicao } from "@/lib/calc";
import { fmtM2, fmtN } from "@/lib/format";
import { geometria } from "@/lib/sugestoes";
import { NumCell, SelectCell, TextCell } from "./cells";
import type { EvfData } from "./useEvfData";
import { ehObraNova, ObraNova } from "./ObraNova";

const TIPOS = [
  { value: "soma", label: "+ trecho (soma)" },
  { value: "vao", label: "− vão (porta, janela)" },
  { value: "vao_area", label: "− vão por área (curvo, arco)" },
  { value: "soma_area", label: "+ trecho por área (m²)" },
  { value: "shaft_canto", label: "Shaft / pilar no canto" },
  { value: "shaft_parede", label: "Shaft / pilar no meio da parede" },
];

const ehShaft = (m: Medicao) => tipoMedicao(m).startsWith("shaft");

/** Texto curto do que a linha muda no ambiente. */
function efeitoTexto(m: Medicao) {
  const e = efeitoMedicao(m);
  const partes: string[] = [];
  if (e.medicoes)
    partes.push(`${e.medicoes > 0 ? "+" : "−"}${fmtM2(Math.abs(e.medicoes))} medições`);
  if (e.piso) partes.push(`piso e teto −${fmtM2(Math.abs(e.piso))}`);
  if (e.paredes) partes.push(`paredes ${e.paredes > 0 ? "+" : "−"}${fmtM2(Math.abs(e.paredes))}`);
  if (!partes.length && ehShaft(m)) partes.push("informe largura e profundidade");
  if (!partes.length) partes.push("—");
  return partes.join(" · ");
}

export function LevantamentoTab({ d }: { d: EvfData }) {
  const { evf, ambientes, medicoes, mAmb, mMed } = d;
  const [novo, setNovo] = useState("");
  if (!evf) return null;

  const totalGeral = medicoes.reduce((s, m) => s + totalMedicao(m), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-medium">
          Novo ambiente
          <input
            className="field mt-1 h-10 w-64"
            placeholder="Ex.: Cozinha"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
          />
        </label>
        <Button
          className="h-10"
          onClick={() => {
            if (!novo.trim()) return;
            mAmb.insert.mutate({ evf_id: evf.id, nome: novo.trim(), ordem: ambientes.length + 1 });
            setNovo("");
          }}
        >
          <Plus className="size-4" /> Adicionar
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          Soma de todas as medições:{" "}
          <span className="num font-semibold text-foreground">{fmtM2(totalGeral)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Informe comprimento, largura e pé-direito de cada ambiente: o sistema calcula piso, teto,
        paredes e perímetro, e os itens vinculados no Escopo atualizam sozinhos. Nas medições
        detalhadas, portas e janelas (“− vão”) saem das paredes, e shafts ou pilares saem do piso e
        do teto. Para formatos irregulares, lance trechos como “+ trecho”.
      </p>
      {ambientes.map((a) => {
        const ms = medicoes.filter((m) => m.ambiente_id === a.id);
        const g = geometria(a, medicoes);
        const vaosMed = ms
          .filter((m) => tipoMedicao(m) === "vao" || tipoMedicao(m) === "vao_area")
          .reduce((s, m) => s - efeitoMedicao(m).paredes, 0);
        const shafts = ms.filter(ehShaft).reduce((s, m) => s - efeitoMedicao(m).piso, 0);
        const updA = (v: Record<string, unknown>) => mAmb.update.mutate({ id: a.id, ...v });
        return (
          <section key={a.id} className="card p-4" aria-label={`Levantamento de ${a.nome}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TextCell
                value={a.nome}
                label="Nome do ambiente"
                className="w-72 text-base font-semibold"
                onSave={(v) => mAmb.update.mutate({ id: a.id, nome: v })}
              />
              <div className="flex items-center gap-3">
                <button
                  className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                  aria-label="Excluir ambiente"
                  onClick={() => {
                    if (confirm(`Excluir o ambiente ${a.nome} e suas medições?`))
                      mAmb.remove.mutate(a.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ["comprimento", "Comprimento (m)"],
                  ["largura", "Largura (m)"],
                  ["pe_direito", "Pé-direito (m)"],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="text-xs font-medium text-muted-foreground">
                  {l}
                  <NumCell
                    value={Number(a[k])}
                    label={l}
                    className="mt-1 h-10 border-border bg-card text-base text-foreground"
                    onSave={(v) => updA({ [k]: v })}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {(
                [
                  ["Piso / teto", g.piso, "m²"],
                  ["Paredes", g.paredes, "m²"],
                  ["Perímetro", g.perimetro, "m"],
                  ["Medições", g.medicoes, "m²"],
                  ["Vãos descontados", vaosMed + Number(a.area_vaos), "m²"],
                  ["Shafts / pilares no piso", shafts, "m²"],
                ] as const
              )
                .filter(([l, v]) => !(l.startsWith("Shafts") && !v))
                .map(([l, v, u]) => (
                  <span key={l} className="rounded-lg bg-primary-soft px-3 py-1.5">
                    <span className="text-muted-foreground">{l}: </span>
                    <span className="num font-semibold">
                      {fmtN(v)} {u}
                    </span>
                  </span>
                ))}
            </div>
            <details className="mt-3" open={ms.length > 0 || undefined}>
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Portas, janelas, shafts e medições detalhadas ({ms.length})
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Lance cada porta e janela com “+ Vão” (largura × altura): elas saem das paredes. Vão
                curvo ou em arco, que não dá para medir em largura × altura: escolha o tipo “vão por
                área” e digite os m². Shaft ou pilar com “+ Shaft / pilar” (largura × profundidade):
                sai do piso e do teto.
              </p>
              <div className="overflow-x-auto">
                <table className="tbl mt-2 min-w-[960px]">
                  <thead>
                    <tr>
                      <th>Trecho</th>
                      <th className="w-56">Tipo</th>
                      <th className="w-24 text-right">Largura (m)</th>
                      <th className="w-24 text-right">Altura (m)</th>
                      <th
                        className="w-28 text-right"
                        title="Só para shaft ou pilar: quanto avança para dentro do ambiente"
                      >
                        Profundidade (m)
                      </th>
                      <th className="w-16 text-right">Qtd</th>
                      <th className="w-64">Efeito no ambiente</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {ms.map((m) => {
                      return (
                        <tr key={m.id}>
                          <td>
                            <TextCell
                              value={m.descricao ?? ""}
                              placeholder="Ex.: parede da porta"
                              label="Trecho"
                              className="min-w-[11rem]"
                              onSave={(v) => mMed.update.mutate({ id: m.id, descricao: v })}
                            />
                          </td>
                          <td>
                            <SelectCell
                              value={tipoMedicao(m)}
                              options={TIPOS}
                              label="Tipo de medição"
                              onSave={(v) =>
                                mMed.update.mutate({
                                  id: m.id,
                                  tipo: v,
                                  sinal: v === "soma" ? 1 : -1,
                                })
                              }
                            />
                          </td>
                          {TIPOS_POR_AREA.includes(tipoMedicao(m)) ? (
                            <td colSpan={2}>
                              <div className="flex items-center gap-1">
                                <NumCell
                                  value={Number(m.largura)}
                                  label="Área (m²)"
                                  onSave={(v) =>
                                    mMed.update.mutate({ id: m.id, largura: v, altura: 1 })
                                  }
                                />
                                <span className="shrink-0 pr-1 text-xs text-muted-foreground">
                                  m² (área direta)
                                </span>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td>
                                <NumCell
                                  value={Number(m.largura)}
                                  label="Largura"
                                  onSave={(v) => mMed.update.mutate({ id: m.id, largura: v })}
                                />
                              </td>
                              <td>
                                <NumCell
                                  value={Number(m.altura)}
                                  label="Altura"
                                  onSave={(v) => mMed.update.mutate({ id: m.id, altura: v })}
                                />
                              </td>
                            </>
                          )}
                          <td>
                            {ehShaft(m) ? (
                              <NumCell
                                value={Number(m.profundidade)}
                                label="Profundidade"
                                onSave={(v) => mMed.update.mutate({ id: m.id, profundidade: v })}
                              />
                            ) : (
                              <span className="block px-1.5 text-right text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            <NumCell
                              value={Number(m.quantidade)}
                              decimals={0}
                              label="Quantidade"
                              onSave={(v) => mMed.update.mutate({ id: m.id, quantidade: v })}
                            />
                          </td>
                          <td
                            className={`num text-xs ${efeitoMedicao(m).paredes < 0 || efeitoMedicao(m).piso < 0 ? "text-warning" : ""}`}
                          >
                            {efeitoTexto(m)}
                          </td>
                          <td>
                            <button
                              className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                              aria-label="Excluir medição"
                              onClick={() => mMed.remove.mutate(m.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary-soft"
                  onClick={() =>
                    mMed.insert.mutate({
                      ambiente_id: a.id,
                      descricao: "",
                      largura: 0,
                      altura: 0,
                      quantidade: 1,
                      sinal: 1,
                      ordem: ms.length + 1,
                    })
                  }
                >
                  <Plus className="size-4" /> Trecho
                </button>
                <button
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-warning hover:bg-warning-soft"
                  onClick={() =>
                    mMed.insert.mutate({
                      ambiente_id: a.id,
                      descricao: "vão",
                      largura: 0,
                      altura: 0,
                      quantidade: 1,
                      sinal: -1,
                      tipo: "vao",
                      ordem: ms.length + 1,
                    })
                  }
                >
                  <Plus className="size-4" /> Vão (porta, janela)
                </button>
                <button
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-warning hover:bg-warning-soft"
                  onClick={() =>
                    mMed.insert.mutate({
                      ambiente_id: a.id,
                      descricao: "shaft",
                      largura: 0,
                      altura: Number(a.pe_direito) || 0,
                      profundidade: 0,
                      quantidade: 1,
                      sinal: -1,
                      tipo: "shaft_canto",
                      ordem: ms.length + 1,
                    })
                  }
                >
                  <Plus className="size-4" /> Shaft / pilar
                </button>
              </div>
            </details>
          </section>
        );
      })}
      {!ambientes.length ? (
        ehObraNova(evf.tipo_obra) ? (
          <ObraNova d={d} destaque />
        ) : (
          <div className="card p-8 text-center text-muted-foreground">
            Nenhum ambiente. Adicione o primeiro acima.
          </div>
        )
      ) : null}
    </div>
  );
}
