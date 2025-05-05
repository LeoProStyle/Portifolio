// app/page.js
import { currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function HomePage() {
  console.log('DEBUG [Vercel] - Verificando variáveis de ambiente:', {
    hasAdminEmails: !!process.env.NEXT_PUBLIC_ADMIN_EMAILS,
    adminEmails: process.env.NEXT_PUBLIC_ADMIN_EMAILS
  });

  const user = await currentUser();
  
  if (!user) {
    console.log('DEBUG [Vercel] - Usuário não autenticado, redirecionando para login');
    redirect("/sign-in");
    return null;
  }

  console.log('DEBUG [Vercel] - Dados do usuário:', {
    userId: user.id,
    primaryEmail: user.emailAddresses[0]?.emailAddress,
    allEmails: user.emailAddresses.map(e => e.emailAddress)
  });

  // Verifica se o email do usuário está na lista de admins
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(email => email.trim());
  const isAdmin = adminEmails.includes(user.emailAddresses[0].emailAddress);

  console.log('DEBUG [Vercel] - Verificação de admin:', {
    userEmail: user.emailAddresses[0].emailAddress,
    adminEmails,
    isAdmin
  });

  // Redireciona baseado no papel do usuário
  const redirectPath = isAdmin ? "/admin" : "/client";
  console.log('DEBUG [Vercel] - Redirecionando para:', redirectPath);
  
  redirect(redirectPath);
  return null;
}
