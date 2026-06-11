import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { FiscalConfigModel } from "@/models/FiscalConfig";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await connectToMongo();
    const docs = await FiscalConfigModel.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, data: docs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // parse multipart/form-data
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(process.cwd(), "uploads");
    form.keepExtensions = true;

    const data = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
      form.parse(req as any, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const file = data.files?.file;
    if (!file) return NextResponse.json({ ok: false, error: "Arquivo não enviado" }, { status: 400 });

    // move/ensure uploaded file
    const filepath = Array.isArray(file) ? file[0].path : file.path;
    const originalName = Array.isArray(file) ? file[0].name : file.name;

    await connectToMongo();
    const doc = await FiscalConfigModel.create({ originalName, filename: path.basename(filepath) });
    return NextResponse.json({ ok: true, data: doc });
  } catch (error) {
    console.error("[POST /fiscal-config]", error);
    const message = error instanceof Error ? error.message : "Erro ao enviar arquivo";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = body.id;
    if (!id) return NextResponse.json({ ok: false, error: "ID obrigatório" }, { status: 400 });

    await connectToMongo();
    const doc = await FiscalConfigModel.findByIdAndDelete(id);
    if (!doc) return NextResponse.json({ ok: false, error: "Registro não encontrado" }, { status: 404 });

    // try remove file
    try {
      const p = path.join(process.cwd(), "uploads", doc.filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
