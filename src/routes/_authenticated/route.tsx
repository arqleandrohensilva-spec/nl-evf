import { createFileRoute, redirect, Outlet, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print border-b bg-card p-4 md:w-56 md:border-b-0 md:border-r">
        <div className="text-xs font-medium tracking-widest text-primary">NL ARQUITETOS</div>
        <div className="mb-4 font-semibold">NL · EVF</div>
        <nav className="flex gap-3 text-sm md:flex-col">
          <Link to="/evfs" className="text-foreground" activeProps={{ className: "text-primary font-medium" }}>
            Meus EVFs
          </Link>
        </nav>
        <button
          className="mt-6 text-xs text-muted-foreground underline"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.replace("/auth");
          }}
        >
          Sair
        </button>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
