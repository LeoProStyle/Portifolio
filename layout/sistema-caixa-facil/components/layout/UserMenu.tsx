"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import Swal from "sweetalert2";

export default function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleLogout = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "Sair?",
      text: "Tem certeza que deseja sair?",
      showCancelButton: true,
      confirmButtonText: "Sair",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      await signOut({ redirect: false });
      router.push("/login");
      router.refresh();
    }
  };

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{session.user.name}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
          {(session.user as any)?.role || "usuário"}
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title="Sair"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
