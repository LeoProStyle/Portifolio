import { handler, json, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { toProductDTO } from "@/lib/serializers";
import { ProductInput } from "@/lib/validation";
import { Product, type ProductRecord } from "@/models/Product";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();
  await connectDB();
  const docs = await Product.find()
    .collation({ locale: "pt" })
    .sort({ category: 1, sortOrder: 1, name: 1 })
    .lean<ProductRecord[]>();
  return json({ products: docs.map(toProductDTO) });
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const data = ProductInput.parse(await req.json());
  await connectDB();
  const doc = await Product.create(data);
  return json({ product: toProductDTO(doc.toObject()) }, 201);
});
