import EmissaoNotaClient from "./EmissaoNotaClient";

export const metadata = {
  title: "Emissão de nota - QG Ocian",
};

export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Emissão de nota</h1>
      <EmissaoNotaClient />
    </div>
  );
}
