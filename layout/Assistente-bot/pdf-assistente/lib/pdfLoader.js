import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";

export async function loadPDF(path) {
  const buffer = fs.readFileSync(path);
  const data = await pdf(buffer);
  return data.text;
}