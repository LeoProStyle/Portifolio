import { NextResponse } from "next/server";
import { connectToMongo } from "@/lib/mongodb";
import { CashClosureModel } from "@/models/CashClosure";
import { ExpenseModel } from "@/models/Expense";
import { ProductModel } from "@/models/Product";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Test MongoDB connection
    console.log("[Health] Testing MongoDB connection...");
    await connectToMongo();
    console.log("[Health] ✅ MongoDB connected");

    // Count documents in collections
    const closureCount = await CashClosureModel.countDocuments();
    const expenseCount = await ExpenseModel.countDocuments();
    const productCount = await ProductModel.countDocuments();

    return NextResponse.json({
      ok: true,
      status: "healthy",
      mongodb: {
        connected: true,
        collections: {
          closures: closureCount,
          expenses: expenseCount,
          products: productCount,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Health] ❌ Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
