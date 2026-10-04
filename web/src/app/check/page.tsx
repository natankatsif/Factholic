import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Проверка без id не существует — каждая проверка живёт на /check/<jobId> */
export default function CheckIndexPage() {
  redirect("/");
}
