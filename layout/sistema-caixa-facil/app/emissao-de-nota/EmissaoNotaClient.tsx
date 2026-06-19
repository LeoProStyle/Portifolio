"use client";
import React, { useRef, useState, useEffect } from "react";

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function EmissaoNotaClient() {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [storeCNPJ] = useState<string>("66857779000174");
  const [storeName] = useState<string>("QG Ocian");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const draw = async () => {
    const canvas = canvasRef.current || document.createElement("canvas");
    const w = 700;
    const h = 900;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Header box
    ctx.fillStyle = "#0f172a"; // dark
    ctx.fillRect(0, 0, w, 120);

    // Draw logo if preloaded, otherwise draw placeholder
    const drawCore = () => {
      if (imgRef.current && imgLoaded) {
        try {
          // draw at fixed size
          ctx.drawImage(imgRef.current, 20, 20, 100, 80);
        } catch (e) {
          ctx.fillStyle = "#06b6d4";
          ctx.beginPath();
          ctx.arc(70, 60, 40, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 20px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("QG", 70, 68);
        }
      } else {
        ctx.fillStyle = "#06b6d4";
        ctx.beginPath();
        ctx.arc(70, 60, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("QG", 70, 68);
      }

      // Store name
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.font = "700 22px sans-serif";
      ctx.fillText(storeName, 140, 55);
      ctx.font = "400 14px sans-serif";
      ctx.fillText(`CNPJ: ${storeCNPJ}`, 140, 80);

      // Receipt title
      ctx.fillStyle = "#111827";
      ctx.font = "600 18px sans-serif";
      ctx.fillText("CUPOM NÃO FISCAL", 20, 150);

      // Buyer
      ctx.font = "500 14px sans-serif";
      ctx.fillText(`CPF/CNPJ: ${cpfCnpj || "-"}`, 20, 185);

      // Table header
      ctx.font = "600 13px sans-serif";
      ctx.fillText("Produto", 20, 220);
      ctx.fillText("Qtd", 420, 220);
      ctx.fillText("V. Unit.", 520, 220);
      ctx.fillText("Subtotal", 620, 220);
      ctx.strokeStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.moveTo(20, 226);
      ctx.lineTo(w - 20, 226);
      ctx.stroke();

      // Item row
      const qty = Number(quantity || 0);
      const unit = Number(unitPrice || 0);
      const subtotal = qty * unit;
      ctx.font = "400 14px sans-serif";
      ctx.fillStyle = "#111827";
      ctx.fillText(product || "-", 20, 260);
      ctx.fillText(String(qty), 420, 260);
      ctx.fillText(formatCurrency(unit), 520, 260);
      ctx.fillText(formatCurrency(subtotal), 620, 260);

      // Totals box
      ctx.font = "700 18px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Total:", w - 160, 330);
      ctx.fillText(formatCurrency(subtotal), w - 20, 330);

      // Footer info
      ctx.textAlign = "left";
      ctx.font = "400 12px sans-serif";
      const now = new Date();
      ctx.fillText(`Emitido em: ${now.toLocaleString()}`, 20, h - 80);
      ctx.fillText("Obrigado pela preferência!", 20, h - 50);

      // Attach canvas if not mounted
      if (!canvasRef.current) {
        canvasRef.current = canvas;
      }
    };

    // If image already cached/loaded, draw immediately, otherwise wait for load or timeout
    // simply draw core (image will be used when preloaded via useEffect)
    drawCore();
  };

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/images/logo.png";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      // if preview is visible, redraw into it
      const container = document.getElementById("receipt-preview");
      if (container && canvasRef.current) {
        // redraw and refresh preview
        (async () => {
          await draw();
          container.innerHTML = "";
          const canvas = canvasRef.current!;
          canvas.style.maxWidth = "100%";
          canvas.style.height = "auto";
          container.appendChild(canvas);
        })();
      }
    };
    img.onerror = () => {
      setImgLoaded(false);
    };
  }, []);

  const handlePreview = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await draw();
    // ensure canvas in DOM
    const container = document.getElementById("receipt-preview");
    if (!container) return;
    container.innerHTML = "";
    const canvas = canvasRef.current!;
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
    container.appendChild(canvas);
  };

  const downloadJPG = async () => {
    await draw();
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const blob = await (await fetch(dataUrl)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cupom-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <form onSubmit={handlePreview} className="space-y-4">
        <label className="block">
          <div className="text-sm font-medium">CPF ou CNPJ</div>
          <input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="CPF ou CNPJ do cliente" />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Nome do produto</div>
          <input value={product} onChange={(e) => setProduct(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Ex: Caneta Azul" />
        </label>

        <div className="flex gap-2">
          <label className="flex-1">
            <div className="text-sm font-medium">Quantidade</div>
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
          </label>
          <label className="flex-1">
            <div className="text-sm font-medium">Valor unitário</div>
            <input type="number" step="0.01" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded">Visualizar cupom</button>
          <button type="button" onClick={downloadJPG} className="px-4 py-2 border rounded">Baixar JPG</button>
        </div>
      </form>

      <div>
        <div id="receipt-preview" className="border rounded p-4 bg-white" style={{ minHeight: 500 }} />
      </div>
    </div>
  );
}
