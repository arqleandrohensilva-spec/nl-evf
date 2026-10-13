import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — NL · EVF" },
      { name: "description", content: "Acesso dos sócios ao sistema de EVF da NL Arquitetos." },
      { property: "og:title", content: "Entrar — NL · EVF" },
      {
        property: "og:description",
        content: "Acesso dos sócios ao sistema de EVF da NL Arquitetos.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setBusy(false);
      if (error) {
        toast.error("E-mail ou senha inválidos.");
        return;
      }
      nav({ to: "/evfs" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Conta criada. Confirme pelo link enviado ao seu e-mail.");
      setModo("entrar");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="text-xs font-medium tracking-widest text-primary">NL ARQUITETOS</div>
          <h1 className="mt-1 text-xl font-semibold">NL · EVF</h1>
          <p className="text-sm text-muted-foreground">Estudo de Viabilidade Financeira</p>
        </div>
        <label className="block text-sm">
          E-mail
          <input
            className="field mt-1"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Senha
          <input
            className="field mt-1"
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <Button className="w-full" disabled={busy}>
          {modo === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-muted-foreground underline"
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
        >
          {modo === "entrar" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
        </button>
      </form>
    </div>
  );
}
