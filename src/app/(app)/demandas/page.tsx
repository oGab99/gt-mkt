import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/context";
import { TasksWorkspace } from "./workspace";

export const metadata: Metadata = { title: "Demandas" };

export default async function TasksPage({ searchParams }: PageProps<"/demandas">) {
  const ctx = await requirePagePermission("tasks");
  return <TasksWorkspace ctx={ctx} sp={await searchParams} />;
}
