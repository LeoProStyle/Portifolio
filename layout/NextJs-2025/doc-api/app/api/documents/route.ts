import { NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

export async function GET() {
  try {
    const collection = await getCollection("documents");
    
    // Agrupa por source e conta chunks
    const sources = await collection.aggregate([
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          lastUpdated: { $max: "$_id" }
        }
      },
      {
        $project: {
          source: "$_id",
          count: 1,
          lastUpdated: 1
        }
      },
      { $sort: { lastUpdated: -1 } }
    ]).toArray();

    return NextResponse.json({ sources });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erro ao buscar documentos";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source");
    
    if (!source) {
      return NextResponse.json({ error: "Parâmetro 'source' é obrigatório" }, { status: 400 });
    }

    const collection = await getCollection("documents");
    const result = await collection.deleteMany({ source });

    return NextResponse.json({ 
      deleted: result.deletedCount,
      source 
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erro ao deletar documentos";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
