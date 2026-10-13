import { createFileRoute, redirect } from "@tanstack/react-router";

// O app não usa mais login (o acesso será pelo NL HUB). Quem abrir /auth vai direto para os EVFs.
export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/evfs" });
  },
});
