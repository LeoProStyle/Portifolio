"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [studyStatus, setStudyStatus] = useState("idle");
  const [studyMessage, setStudyMessage] = useState("Aguardando estudo inicial...");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  async function refreshStudyStatus() {
    const res = await fetch("/api/study");
    const data = await res.json();
    setStudyStatus(data.status || "idle");
    setStudyMessage(data.message || "Sem status de estudo.");
  }

  async function startStudy(force = false) {
    setStudyStatus("processing");
    setStudyMessage("Atualizando...");

    await fetch("/api/study", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ force }),
    });
    await refreshStudyStatus();
  }

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    (async () => {
      await startStudy(false);
      intervalId = setInterval(async () => {
        await refreshStudyStatus();
      }, 2000);
    })();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  async function ask(overrideQuestion?: string) {
    const currentQuestion = (overrideQuestion ?? question).trim();

    if (studyStatus !== "ready") {
      setError("Ainda estou estudando o documento. Aguarde finalizar.");
      return;
    }

    if (!currentQuestion) {
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
        body: JSON.stringify({ question: currentQuestion }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao consultar o documento.");
      }

      setQuestion(currentQuestion);
      setAnswer(data.answer || "Sem resposta no momento.");
      speak(data.answer || "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado na consulta.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }

  function startListening() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Seu navegador nao suporta reconhecimento de voz.");
      return;
    }

    setError("");
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    setIsListening(true);

    recognition.onresult = async (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (!text) return;
      setQuestion(text);
      await ask(text);
    };

    recognition.onerror = () => {
      setError("Nao consegui captar sua voz. Tente novamente.");
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
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

  return (
    <main className="page-shell">
      <section className="assistant-card">
        <div className="card-header">
          <p className="eyebrow">Assistente inteligente</p>
          <h1>Assistente por Voz e Texto</h1>
          <p className="subtitle">
            Fale ou escreva sua pergunta. Eu consulto e respondo em texto e audio.
          </p>
        </div>

        <div className="input-group">
          <label htmlFor="question-input">Pergunta</label>
          <input
            id="question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex.: Qual o objetivo principal do documento?"
            className="question-input"
          />
        </div>

        <div className="actions-row">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isLoading}
            className={`btn ${isListening ? "btn-danger" : "btn-secondary"}`}
          >
            {isListening ? "Parar escuta" : "Falar"}
          </button>

          <button onClick={() => ask()} disabled={isLoading} className="btn btn-primary">
            {isLoading ? "Consultando..." : "Perguntar"}
          </button>

          <button onClick={() => speak(answer)} disabled={!answer} className="btn btn-ghost">
            Ouvir resposta
          </button>
        </div>

        <div className={`status-badge ${studyStatus}`}>
          <span className="dot" />
          <span>
            {studyStatus === "ready" ? "Pronto: " : ""}
            {studyMessage}
          </span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="answer-box">
          <p className="answer-title">Resposta</p>
          <p className="answer-content">
            {answer || "A resposta aparecera aqui assim que voce fizer uma pergunta."}
          </p>
        </div>
      </section>
    </main>
  );
}