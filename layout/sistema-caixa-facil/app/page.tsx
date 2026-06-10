import { redirect } from "next/navigation";

export default function Home() {
  // Abrir aplicação na tela de login por padrão
  redirect("/login");
}

