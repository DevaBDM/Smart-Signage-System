const fs = require("fs");
const path = require("path");

async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();
  const type = (mimeType || "").toLowerCase();

  try {
    // TXT / CSV / plain text
    if (ext === ".txt" || ext === ".csv" || type.includes("text/plain") || type.includes("text/csv")) {
      return fs.readFileSync(filePath, "utf-8");
    }

    // PDF
    if (ext === ".pdf" || type.includes("pdf")) {
      const pdfParse = require("pdf-parse");
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || "";
    }

    // Unsupported type
    return null;
  } catch (err) {
    console.error(`[textExtractor] Failed to extract text from ${filePath}:`, err.message);
    return null;
  }
}

module.exports = { extractText };
