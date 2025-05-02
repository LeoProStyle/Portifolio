import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const rawBody = await req.text(); // Lê o corpo da requisição como texto
    const reqHeaders = headers();
    const signature = reqHeaders.get("clerk-signature"); // Obtém a assinatura do header

    // Verifique a assinatura (é importante garantir a segurança do webhook)
    // A função `verifyClerkWebhookSignature` seria uma implementação personalizada que você criaria
    // usando a chave secreta do Clerk para verificar a assinatura.
    const isValidSignature = verifyClerkWebhookSignature(rawBody, signature);
    if (!isValidSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Aqui, você pode processar os dados conforme necessário. O Clerk envia um JSON
    const event = JSON.parse(rawBody);

    // Exemplo: Log do evento
    console.log("Evento recebido do Clerk:", event);

    // Verifique o tipo de evento (pode ser "user.created", "user.updated", etc.)
    switch (event.type) {
      case "user.created":
        // Lógica para quando um novo usuário é criado
        console.log("Novo usuário criado:", event.data);
        break;

      case "user.updated":
        // Lógica para quando um usuário é atualizado
        console.log("Usuário atualizado:", event.data);
        break;

      default:
        console.log("Outro evento:", event.type);
        break;
    }

    return NextResponse.json({ message: "Webhook recebido com sucesso" }, { status: 200 });
  } catch (error) {
    console.error("Erro ao processar o webhook:", error);
    return NextResponse.json({ error: "Erro ao processar o webhook" }, { status: 500 });
  }
}

// Função para verificar a assinatura do webhook (é necessário usar a chave secreta do Clerk)
function verifyClerkWebhookSignature(rawBody, signature) {
  // Implementação de verificação de assinatura com a chave secreta do Clerk
  const secret = process.env.CLERK_WEBHOOK_SECRET_KEY; // A chave secreta do Clerk
  // Aqui você usaria a lógica adequada para verificar se a assinatura é válida.
  // O Clerk deve fornecer documentação sobre como verificar a assinatura.
  return true; // Para fins de exemplo, estamos assumindo que a assinatura é válida
}
