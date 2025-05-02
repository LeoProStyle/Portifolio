// app/page.js
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = auth();
  
  if (!userId) {
    redirect("/sign-in");
    return null;
  }

  // Redirecionamento padrão para a área do cliente
  redirect("/client");
  return null;
}
