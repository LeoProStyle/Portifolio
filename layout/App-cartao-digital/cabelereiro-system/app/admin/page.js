// app/admin/page.js
"use client";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [clients, setClients] = useState([]);
  const [name, setName] = useState("");
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  // Lista de emails de admin
  const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());

  useEffect(() => {
    if (user) {
      const userEmail = user.emailAddresses[0].emailAddress;
      const isAdmin = ADMIN_EMAILS.includes(userEmail);
      
      if (!isAdmin) {
        router.push("/client");
      }
    }
  }, [user, router]);

  useEffect(() => {
    fetch("/api/clients").then(res => res.json()).then(setClients);
  }, []);

  const addClient = async () => {
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    const updated = await fetch("/api/clients").then(res => res.json());
    setClients(updated);
  };

  const checkIn = async (id) => {
    await fetch(`/api/clients/${id}/checkin`, { method: "POST" });
    const updated = await fetch("/api/clients").then(res => res.json());
    setClients(updated);
  };

  const useFreeCut = async (id) => {
    await fetch(`/api/clients/${id}/use-free-cut`, { method: "POST" });
    const updated = await fetch("/api/clients").then(res => res.json());
    setClients(updated);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <main className="p-10 max-w-xl mx-auto text-center space-y-6">
      <SignedIn>
        <h1 className="text-2xl font-bold">Área Administrativa</h1>
        <button onClick={handleSignOut} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">
          Sair
        </button>

        <div className="flex gap-2 justify-center mt-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente"
            className="border px-2 py-1 rounded"
          />
          <button onClick={addClient} className="bg-blue-500 text-white px-3 py-1 rounded">
            Adicionar
          </button>
        </div>

        <ul className="mt-6 space-y-2">
          {clients.map(client => (
            <li key={client._id} className="flex justify-between items-center border-b pb-2">
              <span>{client.name} — {client.checkIns} check-in(s)</span>
              <span className="text-sm text-gray-500">Cortes grátis: {client.freeCuts}</span>
              {client.freeCuts > 0 && (
                <button
                  onClick={() => useFreeCut(client._id)}
                  className="text-sm bg-red-500 text-white px-2 py-1 rounded"
                >
                  Usar Corte Grátis
                </button>
              )}
              <button
                onClick={() => checkIn(client._id)}
                className="text-sm bg-green-500 text-white px-2 py-1 rounded"
              >
                Check-in
              </button>
            </li>
          ))}
        </ul>
      </SignedIn>

      <SignedOut>
        <h1 className="text-xl mb-4">Faça login para usar o sistema</h1>
      </SignedOut>
    </main>
  );
}
