"use client";

import { useMemo, useState, useEffect } from "react";

type ChatMessage = {
	role: "user" | "assistant";
	content: string;
	sources?: { content: string; source: string; score?: number }[];
};

type DocumentSource = {
	source: string;
	count: number;
	lastUpdated: string;
};

export default function Home() {
	const [uploadContent, setUploadContent] = useState("");
	const [uploadSource, setUploadSource] = useState("meu-documento.txt");
	const [isUploading, setIsUploading] = useState(false);

	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [fileSource, setFileSource] = useState("");
	const [isUploadingFile, setIsUploadingFile] = useState(false);

	const [question, setQuestion] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isAsking, setIsAsking] = useState(false);

	const [documents, setDocuments] = useState<DocumentSource[]>([]);
	const [selectedSource, setSelectedSource] = useState<string>("");
	const [isLoadingDocs, setIsLoadingDocs] = useState(false);
	const [showDocumentList, setShowDocumentList] = useState(false);

	const uploadChars = useMemo(() => uploadContent.trim().length, [uploadContent]);

	// Carrega documentos existentes
	async function loadDocuments() {
		setIsLoadingDocs(true);
		try {
			const resp = await fetch("/api/documents");
			const data = await resp.json();
			if (resp.ok) {
				setDocuments(data.sources || []);
			}
		} catch (e) {
			console.error("Erro ao carregar documentos:", e);
		} finally {
			setIsLoadingDocs(false);
		}
	}

	// Carrega documentos ao montar o componente
	useEffect(() => {
		loadDocuments();
	}, []);

	// Fecha o dropdown quando clicar fora
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Element;
			if (!target.closest('.document-dropdown')) {
				setShowDocumentList(false);
			}
		};

		if (showDocumentList) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showDocumentList]);

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
			// Recarrega a lista de documentos após upload
			await loadDocuments();
		} catch (e: any) {
			alert(e?.message || "Erro ao fazer upload");
		} finally {
			setIsUploading(false);
		}
	}

	async function handleFileUpload() {
		if (!selectedFile) return;
		setIsUploadingFile(true);
		try {
			const formData = new FormData();
			formData.append('file', selectedFile);
			formData.append('source', fileSource || selectedFile.name);

			const resp = await fetch("/api/upload-file", {
				method: "POST",
				body: formData,
			});
			const data = await resp.json();
			if (!resp.ok) throw new Error(data?.error || "Falha no upload do arquivo");
			alert(`Arquivo processado: ${data.insertedCount} chunks inseridos (${data.extractedTextLength} caracteres extraídos).`);
			// Recarrega a lista de documentos após upload
			await loadDocuments();
			// Limpa o formulário
			setSelectedFile(null);
			setFileSource("");
		} catch (e: any) {
			alert(e?.message || "Erro ao processar arquivo");
		} finally {
			setIsUploadingFile(false);
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
				body: JSON.stringify({ 
					question,
					source: selectedSource || undefined // Filtra por documento se selecionado
				}),
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
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
			<div className="max-w-6xl mx-auto p-6 sm:p-8 lg:p-12">
				{/* Header */}
				<header className="mb-12">
					<div className="flex items-center justify-between mb-8">
						<div>
							<h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-blue-600 bg-clip-text text-transparent">
								Chat com Documentos
							</h1>
							<p className="text-slate-600 mt-2">Faça perguntas sobre seus documentos usando IA</p>
						</div>
						<div className="flex items-center gap-4">
							<div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
								<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
								Sistema Online
							</div>
							<a 
								className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors" 
								href="https://vercel.com" 
								target="_blank" 
								rel="noreferrer"
							>
								Deploy
							</a>
						</div>
					</div>
				</header>

				{/* Seção de Documentos Existentes */}
				{documents.length > 0 && (
					<section className="mb-8">
						<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
							<h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
								<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Selecionar Documento
							</h2>
							
							<div className="relative document-dropdown">
								{/* Campo de seleção */}
								<button
									onClick={() => setShowDocumentList(!showDocumentList)}
									className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								>
									<span className="text-sm font-medium text-slate-700">
										{selectedSource || "Todos os documentos"}
									</span>
									<svg 
										className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showDocumentList ? 'rotate-180' : ''}`}
										fill="none" 
										stroke="currentColor" 
										viewBox="0 0 24 24"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
									</svg>
								</button>

								{/* Lista dropdown */}
								{showDocumentList && (
									<div className="absolute top-full left-0 right-0 mt-2 border border-slate-200 rounded-xl bg-white shadow-xl z-10 max-h-60 overflow-y-auto">
										{/* Opção "Todos os documentos" */}
										<button
											onClick={() => {
												setSelectedSource("");
												setShowDocumentList(false);
											}}
											className={`w-full text-left px-4 py-3 hover:bg-slate-50 text-sm transition-colors ${
												selectedSource === "" ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"
											}`}
										>
											Todos os documentos
										</button>
										
										{/* Separador */}
										<div className="border-t border-slate-100"></div>
										
										{/* Lista de documentos */}
										{documents.map((doc) => (
											<button
												key={doc.source}
												onClick={() => {
													setSelectedSource(doc.source);
													setShowDocumentList(false);
												}}
												className={`w-full text-left px-4 py-3 hover:bg-slate-50 text-sm transition-colors ${
													selectedSource === doc.source ? "bg-blue-50 text-blue-600 font-medium" : "text-slate-700"
												}`}
											>
												<div className="flex justify-between items-center">
													<span className="truncate">{doc.source}</span>
													<span className="text-xs text-slate-500 ml-2 bg-slate-100 px-2 py-1 rounded-full">
														{doc.count} chunks
													</span>
												</div>
											</button>
										))}
									</div>
								)}
							</div>

							{/* Indicador do documento selecionado */}
							{selectedSource && (
								<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
									<span className="text-blue-700 font-medium">Filtrando por:</span> {selectedSource}
								</div>
							)}
						</div>
					</section>
				)}

				{/* Seção principal */}
				<section className="grid lg:grid-cols-2 gap-8">
					{/* Upload de Texto */}
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
						<h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
							<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
							Upload de Texto
						</h2>
						<div className="space-y-4">
							<input
								className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
								placeholder="Nome/Fonte do documento"
								value={uploadSource}
								onChange={(e) => setUploadSource(e.target.value)}
							/>
							<textarea
								className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm h-48 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
								placeholder="Cole aqui o conteúdo do seu documento..."
								value={uploadContent}
								onChange={(e) => setUploadContent(e.target.value)}
							/>
							<div className="flex items-center justify-between text-xs text-slate-500">
								<span>{uploadChars} caracteres</span>
							</div>
							<button
								onClick={handleUpload}
								disabled={isUploading || uploadChars === 0}
								className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl px-6 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm"
							>
								{isUploading ? (
									<div className="flex items-center justify-center gap-2">
										<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
										Processando...
									</div>
								) : (
									"Gerar embeddings e salvar"
								)}
							</button>
						</div>
					</div>

					{/* Upload de Arquivo */}
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
						<h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
							<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
							</svg>
							Upload de Arquivo
						</h2>
						<div className="space-y-4">
							<input
								className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
								placeholder="Nome/Fonte do documento (opcional)"
								value={fileSource}
								onChange={(e) => setFileSource(e.target.value)}
							/>
							<div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
								<input
									type="file"
									accept=".doc,.docx"
									onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
									className="hidden"
									id="file-upload"
								/>
								<label htmlFor="file-upload" className="cursor-pointer">
									<div className="text-sm text-slate-600">
										{selectedFile ? (
											<div>
												<p className="font-medium text-slate-800">{selectedFile.name}</p>
												<p className="text-xs text-slate-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
											</div>
										) : (
											<div>
												<svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
												</svg>
												<p className="font-medium">Clique para selecionar um arquivo</p>
												<p className="text-xs text-slate-500 mt-1">DOC, DOCX (máx. 10MB)</p>
											</div>
										)}
									</div>
								</label>
							</div>
							<button
								onClick={handleFileUpload}
								disabled={isUploadingFile || !selectedFile}
								className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl px-6 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm"
							>
								{isUploadingFile ? (
									<div className="flex items-center justify-center gap-2">
										<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
										Processando...
									</div>
								) : (
									"Processar arquivo"
								)}
							</button>
						</div>
					</div>
				</section>

				{/* Chat Section */}
				<section className="mt-8">
					<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
						<h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
							<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
							</svg>
							Chat com IA
						</h2>
						
						{/* Chat Messages */}
						<div className="flex flex-col gap-4 max-h-96 overflow-auto border border-slate-200 rounded-xl p-4 bg-slate-50 mb-4">
							{messages.length === 0 && (
								<div className="text-center py-8">
									<svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
									<p className="text-slate-500 text-sm">Envie uma pergunta após fazer upload de um documento</p>
								</div>
							)}
							{messages.map((m, idx) => (
								<div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
									<div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
										m.role === "user" 
											? "bg-gradient-to-r from-blue-600 to-blue-700 text-white" 
											: "bg-white border border-slate-200 text-slate-800"
									}`}>
										<p className="whitespace-pre-wrap">{m.content}</p>
									</div>
								</div>
							))}
						</div>

						{/* Chat Input */}
						<div className="flex gap-3">
							<input
								className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-400"
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
								className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl px-6 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm"
							>
								{isAsking ? (
									<div className="flex items-center gap-2">
										<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
										Enviando...
									</div>
								) : (
									"Perguntar"
								)}
							</button>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
