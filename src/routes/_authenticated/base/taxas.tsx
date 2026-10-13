import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCapitulos, useMut } from "@/lib/data";
import { NumCell, TextCell } from "@/components/evf/cells";

export const Route = createFileRoute("/_authenticated/base/taxas")({
  head: () => ({ meta: [{ title: "Taxas de administração — NL · EVF" }] }),
  component: Page,
});

function Page() {
  const caps = useCapitulos().data ?? [];
  const m = useMut("capitulos", ["capitulos"]);
  const proximo = caps.reduce((mx, c) => Math.max(mx, c.codigo), 0) + 1;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Taxas de administração</h1>
          <p className="text-sm text-muted-foreground">
            Percentual de gestão por capítulo, aplicado sobre o custo direto. Maior onde há muitos
            insumos e mão de obra; menor em fornecimentos de alto valor (marcenaria, marmoraria).
          </p>
        </div>
        <Button
          className="h-10"
          onClick={() =>
            m.insert.mutate({
              codigo: proximo,
              nome: "Novo capítulo",
              ordem: proximo,
              taxa_adm_pct: 10,
            })
          }
        >
          + Capítulo
        </Button>
      </header>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-16">Código</th>
              <th>Capítulo</th>
              <th className="w-32 text-right">Taxa (%)</th>
            </tr>
          </thead>
          <tbody>
            {caps.map((c) => (
              <tr key={c.id}>
                <td className="num py-2 text-muted-foreground">{c.codigo}</td>
                <td>
                  <TextCell
                    value={c.nome}
                    label="Nome do capítulo"
                    onSave={(v) => m.update.mutate({ id: c.id, nome: v })}
                  />
                </td>
                <td>
                  <NumCell
                    value={Number(c.taxa_adm_pct ?? 0)}
                    decimals={1}
                    label="Taxa"
                    onSave={(v) => m.update.mutate({ id: c.id, taxa_adm_pct: v })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        A mudança vale para todos os EVFs, inclusive os já feitos. Para preservar um EVF
        apresentado, exporte o .xlsx antes.
      </p>
    </div>
  );
}
