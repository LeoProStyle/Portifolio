"use client";

import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function startListening() {
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = "pt-BR";

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setQuestion(text);
    };

    recognition.start();
  }

  function speak(text: string) {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";

    const voices = window.speechSynthesis.getVoices();
    const ptBrVoice = voices.find((voice) => voice.lang.toLowerCase() === "pt-br");
    if (ptBrVoice) {
      utterance.voice = ptBrVoice;
    }

    // Cancela qualquer fala pendente para evitar sobreposição.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function ask() {
    if (!question.trim()) {
      setError("Digite ou fale uma pergunta antes de consultar.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao consultar o documento.");
      }

      setAnswer(data.answer || "Sem resposta no momento.");
      speak(data.answer || "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado na consulta.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Assistente PDF</h1>

      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Pergunte algo..."
        style={{ width: 300 }}
      />

      <br /><br />

      <button onClick={startListening}>🎤 Falar</button>

      <button onClick={ask} style={{ marginLeft: 10 }} disabled={isLoading}>
        {isLoading ? "Consultando..." : "Perguntar"}
      </button>

      <button
        onClick={() => speak(answer)}
        style={{ marginLeft: 10 }}
        disabled={!answer}
      >
        🔊 Ouvir resposta
      </button>

      {error ? <p style={{ color: "crimson", marginTop: 12 }}>{error}</p> : null}

      <pre style={{ marginTop: 20 }}>{answer}</pre>
    </div>
  );
}