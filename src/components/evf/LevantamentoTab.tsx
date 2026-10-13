import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { totalMedicao } from "@/lib/calc";
import { fmtM2 } from "@/lib/format";
import { NumCell, SelectCell, TextCell } from "./cells";
import type { EvfData } from "./useEvfData";

const SINAL = [
  { value: "1", label: "+ soma" },
  { value: "-1", label: "− vão" },
];

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
        Lance cada trecho (parede, piso, forro) com largura × altura. Vãos de portas e janelas
        entram como “− vão”. Use os totais para preencher as quantidades no Escopo.
      </p>

      {ambientes.map((a) => {
        const ms = medicoes.filter((m) => m.ambiente_id === a.id);
        const tot = ms.reduce((s, m) => s + totalMedicao(m), 0);
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
                <span className="num font-semibold">{fmtM2(tot)}</span>
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
            <div className="overflow-x-auto">
              <table className="tbl mt-2 min-w-[640px]">
                <thead>
                  <tr>
                    <th>Trecho</th>
                    <th className="w-28 text-right">Largura (m)</th>
                    <th className="w-28 text-right">Altura (m)</th>
                    <th className="w-20 text-right">Qtd</th>
                    <th className="w-28">Tipo</th>
                    <th className="w-28 text-right">Área</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {ms.map((m) => {
                    const t = totalMedicao(m);
                    return (
                      <tr key={m.id}>
                        <td>
                          <TextCell
                            value={m.descricao ?? ""}
                            placeholder="Ex.: parede da porta"
                            label="Trecho"
                            onSave={(v) => mMed.update.mutate({ id: m.id, descricao: v })}
                          />
                        </td>
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
                        <td>
                          <NumCell
                            value={Number(m.quantidade)}
                            decimals={0}
                            label="Quantidade"
                            onSave={(v) => mMed.update.mutate({ id: m.id, quantidade: v })}
                          />
                        </td>
                        <td>
                          <SelectCell
                            value={String(m.sinal < 0 ? -1 : 1)}
                            options={SINAL}
                            label="Soma ou vão"
                            onSave={(v) => mMed.update.mutate({ id: m.id, sinal: Number(v) })}
                          />
                        </td>
                        <td className={`num text-right ${t < 0 ? "text-warning" : ""}`}>
                          {fmtM2(t)}
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
                    ordem: ms.length + 1,
                  })
                }
              >
                <Plus className="size-4" /> Vão (desconto)
              </button>
            </div>
          </section>
        );
      })}
      {!ambientes.length ? (
        <div className="card p-8 text-center text-muted-foreground">
          Nenhum ambiente. Adicione o primeiro acima.
        </div>
      ) : null}
    </div>
  );
}
