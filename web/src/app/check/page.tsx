import { redirect } from "next/navigation";

/** Проверка без id не существует — каждая проверка живёт на /check/<jobId> */
export default function CheckIndexPage() {
  redirect("/");
}
