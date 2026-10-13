import { createFileRoute } from "@tanstack/react-router";
import { useConfig, useMut } from "@/lib/data";
import { NumCell, TextCell } from "@/components/evf/cells";

export const Route = createFileRoute("/_authenticated/base/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — NL · EVF" }] }),
  component: Page,
});

function Page() {
  const c = useConfig().data;
  const m = useMut("configuracoes", ["config"]);
  if (!c) return <div className="text-muted-foreground">Carregando…</div>;
  const upd = (v: Record<string, unknown>) => m.update.mutate({ id: c.id, ...v });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Dados usados no cabeçalho do PDF e na estimativa inicial. Atualize o CUB todo mês pela
          tabela oficial do Sinduscon do estado.
        </p>
      </header>
      <div className="card divide-y">
        <Linha t="Nome do escritório">
          <TextCell
            value={c.nome_escritorio}
            label="Nome do escritório"
            className="border-border"
            onSave={(v) => upd({ nome_escritorio: v })}
          />
        </Linha>
        <Linha t="CUB de referência (R$/m²)">
          <NumCell
            value={Number(c.cub_valor)}
            label="CUB"
            className="border-border"
            onSave={(v) => upd({ cub_valor: v })}
          />
        </Linha>
        <Linha t="Referência do CUB (padrão e mês)">
          <TextCell
            value={c.cub_ref}
            label="Referência do CUB"
            placeholder="R-1 N, ago/2026"
            className="border-border"
            onSave={(v) => upd({ cub_ref: v })}
          />
        </Linha>
        <Linha t="UF do CUB">
          <TextCell
            value={c.cub_uf}
            label="UF"
            className="border-border"
            onSave={(v) => upd({ cub_uf: v })}
          />
        </Linha>
        <Linha t="Margem de erro do EVF (%)">
          <NumCell
            value={Number(c.margem_erro_pct)}
            decimals={0}
            label="Margem de erro"
            className="border-border"
            onSave={(v) => upd({ margem_erro_pct: v })}
          />
        </Linha>
      </div>
    </div>
  );
}

function Linha({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 p-4 sm:grid-cols-[1fr_260px]">
      <div className="text-sm font-medium">{t}</div>
      {children}
    </div>
  );
}
