import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Entrar — QG Ocian" };

export default function LoginPage() {
  return (
    <div className="grid min-h-[80dvh] place-items-center">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
