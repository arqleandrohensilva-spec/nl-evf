import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFornecedores, useMut } from "@/lib/data";
import { TextCell } from "@/components/evf/cells";

export const Route = createFileRoute("/_authenticated/base/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — NL · EVF" }] }),
  component: Page,
});

function Page() {
  const lista = useFornecedores().data ?? [];
  const m = useMut("fornecedores", ["fornecedores"]);
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            Parceiros para cotação. Na fase de EVF, explique que a cotação serve para decisão e dê
            retorno do resultado.
          </p>
        </div>
        <Button
          className="h-10"
          onClick={() =>
            m.insert.mutate({
              nome: "Novo fornecedor",
              categoria: "",
              contato: "",
              observacoes: "",
            })
          }
        >
          + Novo fornecedor
        </Button>
      </header>
      <div className="card overflow-x-auto">
        <table className="tbl min-w-[760px]">
          <thead>
            <tr>
              <th>Nome</th>
              <th className="w-48">Categoria</th>
              <th className="w-56">Contato</th>
              <th>Observações</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td>
                  <TextCell
                    value={f.nome}
                    label="Nome"
                    onSave={(v) => m.update.mutate({ id: f.id, nome: v })}
                  />
                </td>
                <td>
                  <TextCell
                    value={f.categoria ?? ""}
                    placeholder="Marcenaria, marmoraria…"
                    label="Categoria"
                    onSave={(v) => m.update.mutate({ id: f.id, categoria: v })}
                  />
                </td>
                <td>
                  <TextCell
                    value={f.contato ?? ""}
                    placeholder="WhatsApp, e-mail"
                    label="Contato"
                    onSave={(v) => m.update.mutate({ id: f.id, contato: v })}
                  />
                </td>
                <td>
                  <TextCell
                    value={f.observacoes ?? ""}
                    label="Observações"
                    onSave={(v) => m.update.mutate({ id: f.id, observacoes: v })}
                  />
                </td>
                <td>
                  <button
                    className="rounded p-1.5 text-muted-foreground hover:bg-warning-soft hover:text-warning"
                    aria-label="Excluir fornecedor"
                    onClick={() => {
                      if (confirm(`Excluir ${f.nome}?`)) m.remove.mutate(f.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!lista.length ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum fornecedor cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
