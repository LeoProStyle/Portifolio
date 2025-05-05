// components/UserNav.js
"use client";
import { useUser, SignedIn, SignedOut, SignInButton, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserRole } from "@/lib/auth";

export default function UserNav() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const isAdmin = user ? getUserRole(user) === 'admin' : false;

  const handleSignOut = async () => {
    await signOut();
    router.push('/sign-in');
  };

  return (
    <div className="flex items-center gap-4">
      <SignedIn>
        {isAdmin ? (
          <>
            <Link href="/admin" className="text-white hover:text-gray-200">
              Área Administrativa
            </Link>
            <span className="text-gray-300 text-sm">({user?.firstName})</span>
          </>
        ) : (
          <>
            <Link href="/client" className="text-white hover:text-gray-200">
              Minha Área
            </Link>
            <span className="text-gray-300 text-sm">
              ({user?.firstName})
            </span>
          </>
        )}
        <button
          onClick={handleSignOut}
          className="text-white hover:text-gray-200 ml-4"
        >
          Sair
        </button>
      </SignedIn>
      <SignedOut>
        <SignInButton>
          <button className="text-white hover:text-gray-200">
            Entrar
          </button>
        </SignInButton>
      </SignedOut>
    </div>
  );
}
