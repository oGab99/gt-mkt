import { redirect } from "next/navigation";

// Rota antiga: mantida apenas para redirecionar links salvos.
export default function LegacyUnderConstructionPage() {
  redirect("/dashboard");
}
