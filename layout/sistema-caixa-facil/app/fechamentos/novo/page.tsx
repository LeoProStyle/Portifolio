import React, { Suspense } from "react";
import ClientEditor from "./ClientEditor";

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NovoFechamentoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ClientEditor defaultDate={todayISODate()} />
    </Suspense>
  );
}


