import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NL · EVF — Estudo de Viabilidade Financeira" },
      { name: "description", content: "Orçamentos por cenários de obras residenciais do escritório NL Arquitetos." },
      { property: "og:title", content: "NL · EVF — Estudo de Viabilidade Financeira" },
      { property: "og:description", content: "Orçamentos por cenários de obras residenciais do escritório NL Arquitetos." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/evfs" });
  },
});
