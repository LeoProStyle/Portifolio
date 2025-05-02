import { useEffect, useState } from "react";

export default function ClientDetails({ params }) {
  const [client, setClient] = useState(null);

  useEffect(() => {
    const fetchClientData = async () => {
      const response = await fetch(`/api/clients/${params.id}/details`);
      const data = await response.json();
      if (data.error) {
        // Lidar com erros, se necessário
        console.log(data.error);
      } else {
        setClient(data);
      }
    };
    fetchClientData();
  }, [params.id]);

  if (!client) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="client-details">
      <h2>Detalhes do Cliente</h2>
      <p><strong>Nome:</strong> {client.name}</p>
      <p><strong>Check-ins:</strong> {client.checkIns}</p>
      <p><strong>Cortes Grátis:</strong> {client.freeCuts}</p>
    </div>
  );
}
