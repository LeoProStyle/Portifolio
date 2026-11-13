import ExcelJS from "exceljs";

/**
 * Gera uma planilha Excel (.xlsx) com título, cabeçalho, linhas e uma linha de TOTAL no final
 * (fórmula SOMA, então continua certa se alguém editar os valores no Excel).
 * Valores `money` chegam em centavos e vão para a planilha em reais.
 */
export type SheetColumn = {
  header: string;
  key: string;
  width?: number;
  type?: "text" | "money" | "date" | "int";
  /** Soma a coluna na linha de TOTAL. */
  total?: boolean;
};

export type SheetRow = Record<string, string | number | null | undefined>;

type SheetOptions = {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: SheetColumn[];
  rows: SheetRow[];
  /** Linhas de resumo abaixo do total (ex.: total por tipo). */
  summary?: { label: string; cents: number }[];
};

const MONEY_FMT = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const BRAND = "FFEA580C";
const TOTAL_FILL = "FFFFEDD5";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** 1 → A, 27 → AA */
export function colLetter(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function cellValue(col: SheetColumn, raw: SheetRow[string]): ExcelJS.CellValue {
  if (raw === null || raw === undefined || raw === "") return null;
  if (col.type === "money") return Number(raw) / 100;
  if (col.type === "date" && typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return raw;
}

export async function buildSheet({ sheetName, title, subtitle, columns, rows, summary }: SheetOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QG Ocian";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 3 }] });
  const last = colLetter(columns.length);

  ws.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 16 }));

  ws.mergeCells(`A1:${last}1`);
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.mergeCells(`A2:${last}2`);
  ws.getCell("A2").value = subtitle ?? "";
  ws.getCell("A2").font = { italic: true, color: { argb: "FF78716C" } };

  const header = ws.getRow(3);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: c.type === "money" || c.type === "int" ? "right" : "left" };
  });
  header.height = 20;

  const firstData = 4;
  rows.forEach((r, ri) => {
    const row = ws.getRow(firstData + ri);
    columns.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = cellValue(c, r[c.key]);
      if (c.type === "money") cell.numFmt = MONEY_FMT;
      if (c.type === "date") cell.numFmt = "dd/mm/yyyy";
    });
  });
  const lastData = firstData + rows.length - 1;

  const totalRow = ws.getRow(firstData + rows.length);
  totalRow.getCell(1).value = "TOTAL";
  columns.forEach((c, ci) => {
    if (!c.total) return;
    const letter = colLetter(ci + 1);
    const sum = rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
    const result = c.type === "money" ? sum / 100 : sum;
    const cell = totalRow.getCell(ci + 1);
    cell.value = rows.length ? { formula: `SUM(${letter}${firstData}:${letter}${lastData})`, result } : 0;
    if (c.type === "money") cell.numFmt = MONEY_FMT;
  });
  for (let i = 1; i <= columns.length; i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true };
    cell.border = { top: { style: "medium" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
  }

  if (summary?.length) {
    let r = totalRow.number + 2;
    ws.getCell(`A${r}`).value = "Resumo";
    ws.getCell(`A${r}`).font = { bold: true };
    for (const s of summary) {
      r++;
      ws.getCell(`A${r}`).value = s.label;
      const v = ws.getCell(`B${r}`);
      v.value = s.cents / 100;
      v.numFmt = MONEY_FMT;
    }
  }

  if (rows.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columns.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
