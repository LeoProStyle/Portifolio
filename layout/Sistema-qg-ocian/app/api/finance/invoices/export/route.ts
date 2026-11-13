import JSZip from "jszip";
import { fileResponse, handler, queryOf, requireAdmin } from "@/lib/api";
import { getInvoicesMonth, invoicesSheet } from "@/lib/finance-data";
import { buildInvoiceXml, invoiceFileName } from "@/lib/fiscal";
import { InvoiceFilter } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET ?month=YYYY-MM&kind= — .zip com o XML de cada cupom do mês + planilha-resumo. */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const { month, kind } = InvoiceFilter.parse(queryOf(req));
  const { invoices } = await getInvoicesMonth(month, kind);
  const zip = new JSZip();
  const used = new Set<string>();
  for (const inv of invoices) {
    let name = invoiceFileName(inv);
    // não fiscais podem repetir número: evita sobrescrever arquivos no zip
    for (let n = 2; used.has(name); n++) name = invoiceFileName(inv).replace(/\.xml$/, `-${n}.xml`);
    used.add(name);
    zip.file(name, buildInvoiceXml(inv));
  }
  zip.file(`resumo-cupons-${month}.xlsx`, await invoicesSheet(month, kind));
  const buf = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return fileResponse(buf, `cupons-${kind ? `${kind}-` : ""}${month}.zip`, "application/zip");
});
