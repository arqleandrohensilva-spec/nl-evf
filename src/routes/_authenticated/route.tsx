import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

// Sem login por decisão do escritório: o acesso será controlado pelo NL HUB.
// O banco libera leitura e escrita para o papel "anon" (políticas "anon all <tabela>").
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

const linkCls =
  "flex min-h-10 items-center rounded-lg px-3 text-sm text-foreground/80 hover:bg-muted hover:text-foreground";
const ativo = {
  className: "bg-primary-soft text-primary font-semibold hover:bg-primary-soft hover:text-primary",
};

function Layout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print border-b bg-card p-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-5 flex items-center gap-2 px-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            NL
          </div>
          <div>
            <div className="text-sm font-semibold">NL · EVF</div>
            <div className="text-xs text-muted-foreground">Viabilidade financeira</div>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 md:flex-col" aria-label="Navegação principal">
          <Link to="/evfs" className={linkCls} activeProps={ativo} activeOptions={{ exact: false }}>
            Meus EVFs
          </Link>
          <div className="mt-4 hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:block">
            Base do escritório
          </div>
          <Link to="/base/catalogo" className={linkCls} activeProps={ativo}>
            Catálogo de serviços
          </Link>
          <Link to="/base/precos" className={linkCls} activeProps={ativo}>
            Preços de referência
          </Link>
          <Link to="/base/fornecedores" className={linkCls} activeProps={ativo}>
            Fornecedores
          </Link>
          <Link to="/base/taxas" className={linkCls} activeProps={ativo}>
            Taxas de administração
          </Link>
          <Link to="/base/configuracoes" className={linkCls} activeProps={ativo}>
            Configurações
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
