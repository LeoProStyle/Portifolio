// app/cliente/page.js
import { auth, currentUser } from "@clerk/nextjs/server";

export default async function ClientePage() {
  const user = await currentUser();

  return (
    <main className="p-10 max-w-xl mx-auto text-center space-y-6">
      <h1 className="text-2xl font-bold">Área do Cliente</h1>
      <p>Bem-vindo, {user?.firstName}!</p>
    </main>
  );
}
