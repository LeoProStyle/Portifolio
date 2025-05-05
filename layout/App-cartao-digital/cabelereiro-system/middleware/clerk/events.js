// clerk/events.js
import { Clerk } from '@clerk/clerk-sdk-node';

const clerk = new Clerk({ apiKey: process.env.CLERK_API_KEY });

export async function onUserCreated(event) {
  const { id, email_addresses } = event.data;

  // Exemplo: tornar o primeiro usuário um admin
  const email = email_addresses[0]?.email_address;
  const isAdmin = email === "leoprostyle@gmail.com";

  await clerk.users.updateUser(id, {
    publicMetadata: {
      role: isAdmin ? "admin" : "cliente",
    },
  });
}
