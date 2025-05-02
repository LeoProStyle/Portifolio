// components/UserNav.js
"use client";
import { useUser, SignedIn, SignedOut, SignInButton, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

export default function UserNav() {
  const { user } = useUser();

  return (
    <div className="flex items-center gap-4">
      <SignedIn>
        {user?.publicMetadata?.role === "admin" ? (
          <Link href="/admin" className="text-white">Área Administrativa</Link>
        ) : (
          <Link href="/client" className="text-white">Minha Área</Link>
        )}
        <SignOutButton />
      </SignedIn>
      <SignedOut>
        <SignInButton />
      </SignedOut>
    </div>
  );
}
