import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compareCodigo, mesesDesde } from "@/lib/calc";
import { useCapitulos, useCatalogo, useMut } from "@/lib/data";
import { fmtData } from "@/lib/format";
import { NumCell, SelectCell, TextCell, TIPO_OPTIONS } from "@/components/evf/cells";

export const Route = createFileRoute("/_authenticated/base/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo de serviços — NL · EVF" }] }),
  component: Page,
});

function Page() {
  const catalogo = useCatalogo().data ?? [];
  const caps = useCapitulos().data ?? [];
  const m = useMut("catalogo_servicos", ["catalogo"]);
  const [cap, setCap] = useState("");
  const [q, setQ] = useState("");
  const lista = catalogo
    .filter(
      (s) =>
        (!cap || s.capitulo_codigo === Number(cap)) &&
        (!q || s.descricao.toLowerCase().includes(q.toLowerCase())),
    )
    .sort((a, b) => a.capitulo_codigo - b.capitulo_codigo || compareCodigo(a.codigo, b.codigo));
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[1300px] space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Catálogo de serviços</h1>
        <p className="text-sm text-muted-foreground">
          Base de preços do escritório. Todo preço tem data e fonte; com mais de 6 meses, aparece em
          âmbar para recotar ou reajustar.
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="field h-10 w-64"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          aria-label="Filtrar por capítulo"
        >
          <option value="">Todos os capítulos</option>
          {caps.map((c) => (
            <option key={c.id} value={c.codigo}>
              {c.codigo} · {c.nome}
            </option>
          ))}
        </select>
        <input
          className="field h-10 w-64"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar serviço"
        />
        <Button
          className="h-10"
          onClick={() =>
            m.insert.mutate({
              capitulo_codigo: Number(cap) || caps[0]?.codigo || 1,
              codigo: "",
              descricao: "Novo serviço",
              unidade: "un",
              tipo_preco: "composicao",
              data_preco: hoje,
              fonte: "",
            })
          }
        >
          + Novo serviço
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">{lista.length} serviços</span>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[1100px]">
          <thead>
            <tr>
              <th className="w-44">Capítulo</th>
              <th className="w-20">Código</th>
              <th>Descrição</th>
              <th className="w-16">Un.</th>
              <th className="w-32">Tipo</th>
              <th className="w-28 text-right">Material</th>
              <th className="w-28 text-right">M.O.</th>
              <th className="w-36">Data do preço</th>
              <th className="w-44">Fonte</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => {
              const velho = s.data_preco ? mesesDesde(s.data_preco) > 6 : true;
              return (
                <tr key={s.id}>
                  <td>
                    <SelectCell
                      value={String(s.capitulo_codigo)}
                      options={caps.map((c) => ({
                        value: String(c.codigo),
                        label: `${c.codigo} · ${c.nome}`,
                      }))}
                      label="Capítulo"
                      onSave={(v) => m.update.mutate({ id: s.id, capitulo_codigo: Number(v) })}
                    />
                  </td>
                  <td>
                    <TextCell
                      value={s.codigo}
                      className="num"
                      label="Código"
                      onSave={(v) => m.update.mutate({ id: s.id, codigo: v })}
                    />
                  </td>
                  <td>
                    <TextCell
                      value={s.descricao}
                      label="Descrição"
                      onSave={(v) => m.update.mutate({ id: s.id, descricao: v })}
                    />
                  </td>
                  <td>
                    <TextCell
                      value={s.unidade}
                      label="Unidade"
                      onSave={(v) => m.update.mutate({ id: s.id, unidade: v })}
                    />
                  </td>
                  <td>
                    <SelectCell
                      value={s.tipo_preco}
                      options={TIPO_OPTIONS}
                      label="Tipo"
                      onSave={(v) => m.update.mutate({ id: s.id, tipo_preco: v })}
                    />
                  </td>
                  <td>
                    <NumCell
                      value={Number(s.material_unit)}
                      label="Material"
                      onSave={(v) =>
                        m.update.mutate({ id: s.id, material_unit: v, data_preco: hoje })
                      }
                    />
                  </td>
                  <td>
                    <NumCell
                      value={Number(s.mo_unit)}
                      label="Mão de obra"
                      onSave={(v) => m.update.mutate({ id: s.id, mo_unit: v, data_preco: hoje })}
                    />
                  </td>
                  <td className={velho ? "text-warning" : ""}>
                    <input
                      type="date"
                      className="cell-input"
                      aria-label="Data do preço"
                      title={s.data_preco ? fmtData(s.data_preco) : "sem data"}
                      value={s.data_preco ?? ""}
                      onChange={(e) =>
                        m.update.mutate({ id: s.id, data_preco: e.target.value || null })
                      }
                    />
                  </td>
                  <td>
                    <TextCell
                      value={s.fonte ?? ""}
                      label="Fonte"
                      placeholder="loja, fornecedor, obra…"
                      onSave={(v) => m.update.mutate({ id: s.id, fonte: v })}
                    />
                  </td>
                  <td>
                    <button
                      className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                      aria-label="Excluir serviço"
                      onClick={() => {
                        if (confirm(`Excluir "${s.descricao}" do catálogo?`)) m.remove.mutate(s.id);
                      }}
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
    </div>
  );
}
