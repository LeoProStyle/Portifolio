"use client";

import { useMemo, useState } from "react";

type ChatMessage = {
	role: "user" | "assistant";
	content: string;
	sources?: { content: string; source: string; score?: number }[];
};

export default function Home() {
	const [uploadContent, setUploadContent] = useState("");
	const [uploadSource, setUploadSource] = useState("meu-documento.txt");
	const [isUploading, setIsUploading] = useState(false);

	const [question, setQuestion] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isAsking, setIsAsking] = useState(false);

	const uploadChars = useMemo(() => uploadContent.trim().length, [uploadContent]);

	async function handleUpload() {
		if (!uploadContent.trim()) return;
		setIsUploading(true);
		try {
			const resp = await fetch("/api/upload", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: uploadContent, source: uploadSource }),
			});
			const data = await resp.json();
			if (!resp.ok) throw new Error(data?.error || "Falha no upload");
			alert(`Upload ok: ${data.insertedCount} chunks inseridos.`);
		} catch (e: any) {
			alert(e?.message || "Erro ao fazer upload");
		} finally {
			setIsUploading(false);
		}
	}

	async function handleAsk() {
		if (!question.trim()) return;
		setIsAsking(true);
		const userMsg: ChatMessage = { role: "user", content: question };
		setMessages((prev) => [...prev, userMsg]);
		setQuestion("");
		try {
			const resp = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question }),
			});
			const data = await resp.json();
			if (!resp.ok) throw new Error(data?.error || "Falha no chat");
			const assistantMsg: ChatMessage = {
				role: "assistant",
				content: data.answer || "",
				sources: data.sources || [],
			};
			setMessages((prev) => [...prev, assistantMsg]);
		} catch (e: any) {
			const assistantMsg: ChatMessage = { role: "assistant", content: e?.message || "Erro" };
			setMessages((prev) => [...prev, assistantMsg]);
		} finally {
			setIsAsking(false);
		}
	}

	return (
		<div className="min-h-screen p-6 sm:p-10 max-w-5xl mx-auto flex flex-col gap-8">
			<header className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Chat com Documentos</h1>
				<a className="text-sm underline opacity-80" href="https://vercel.com" target="_blank" rel="noreferrer">
					Deploy (Vercel)
				</a>
			</header>

			<section className="grid md:grid-cols-2 gap-6">
				<div className="border rounded-lg p-4 flex flex-col gap-3">
					<h2 className="font-medium">Upload de Texto</h2>
					<input
						className="border rounded px-3 py-2 text-sm"
						placeholder="Nome/Fonte do documento"
						value={uploadSource}
						onChange={(e) => setUploadSource(e.target.value)}
					/>
					<textarea
						className="border rounded px-3 py-2 h-48 text-sm"
						placeholder="Cole aqui o conteúdo do seu documento..."
						value={uploadContent}
						onChange={(e) => setUploadContent(e.target.value)}
					/>
					<div className="flex items-center justify-between text-xs opacity-80">
						<span>{uploadChars} caracteres</span>
					</div>
					<button
						onClick={handleUpload}
						disabled={isUploading || uploadChars === 0}
						className="self-start bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
					>
						{isUploading ? "Enviando..." : "Gerar embeddings e salvar"}
					</button>
				</div>

				<div className="border rounded-lg p-4 flex flex-col gap-3">
					<h2 className="font-medium">Chat</h2>
					<div className="flex flex-col gap-3 max-h-[420px] overflow-auto border rounded p-3 bg-white/50">
						{messages.length === 0 && (
							<p className="text-sm opacity-70">Envie uma pergunta após fazer upload de um documento.</p>
						)}
						{messages.map((m, idx) => (
							<div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
								<div className={`max-w-[85%] rounded px-3 py-2 text-sm ${m.role === "user" ? "bg-black text-white" : "bg-gray-100"}`}>
									<p className="whitespace-pre-wrap">{m.content}</p>
									{m.sources && m.sources.length > 0 && (
										<div className="mt-2 border-t pt-2 text-xs opacity-80 space-y-2">
											<p className="font-medium">Fontes:</p>
											{m.sources.map((s, i) => (
												<div key={i} className="space-y-1">
													<p className="truncate">{s.source} {typeof s.score === "number" ? `(score: ${s.score.toFixed(3)})` : ""}</p>
													<p className="line-clamp-3 opacity-90">{s.content}</p>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						))}
					</div>
					<div className="flex gap-2">
						<input
							className="flex-1 border rounded px-3 py-2 text-sm"
							placeholder="Digite sua pergunta..."
							value={question}
							onChange={(e) => setQuestion(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleAsk();
								}
							}}
						/>
						<button
							onClick={handleAsk}
							disabled={isAsking || !question.trim()}
							className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
						>
							{isAsking ? "Enviando..." : "Perguntar"}
						</button>
					</div>
				</div>
			</section>
		</div>
	);
}
