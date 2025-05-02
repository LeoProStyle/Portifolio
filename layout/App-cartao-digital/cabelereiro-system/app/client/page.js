// app/client/page.js
import { currentUser } from "@clerk/nextjs";

export default async function ClientPage() {
  const user = await currentUser();

  return (
    <main className="p-10 max-w-xl mx-auto text-center space-y-6">
      <h1 className="text-2xl font-bold">Área do Cliente</h1>
      <p>Bem-vindo, {user?.firstName || user?.emailAddresses[0].emailAddress}!</p>
    </main>
  );
}
