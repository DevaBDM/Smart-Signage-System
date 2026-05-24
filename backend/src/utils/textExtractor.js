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
      const pdfParse = require("pdf-parse-fork");
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || "";
    }

    // Word (.docx only — .doc is a binary format we can't easily parse)
    if (ext === ".docx" || type.includes("wordprocessingml")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || "";
    }

    // Excel (.xls / .xlsx)
    if (ext === ".xls" || ext === ".xlsx" || type.includes("spreadsheet")) {
      const xlsx = require("xlsx");
      const workbook = xlsx.readFile(filePath);
      const parts = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const lines = json.map((row) => row.filter(Boolean).join("\t")).filter(Boolean);
        if (lines.length) {
          parts.push(`--- Sheet: ${sheetName} ---\n${lines.join("\n")}`);
        }
      }
      return parts.join("\n\n");
    }

    // PowerPoint (.pptx only — .ppt is a binary format)
    if (ext === ".pptx" || type.includes("presentationml")) {
      const JSZip = require("jszip");
      const buffer = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(buffer);
      const texts = [];

      const slideFiles = [];
      zip.forEach((relativePath, file) => {
        if (relativePath.startsWith("ppt/slides/slide") && relativePath.endsWith(".xml")) {
          slideFiles.push({ path: relativePath, file });
        }
      });

      // Sort by slide number
      slideFiles.sort((a, b) => a.path.localeCompare(b.path));

      for (const { file } of slideFiles) {
        const xml = await file.async("text");
        // Extract all <a:t> text nodes
        const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
        if (matches) {
          const slideText = matches.map((m) => m.replace(/<\/?a:t>/g, "")).join(" ");
          if (slideText.trim()) texts.push(slideText);
        }
      }

      return texts.join("\n\n");
    }

    // Unsupported type
    return null;
  } catch (err) {
    console.error(`[textExtractor] Failed to extract text from ${filePath}:`, err.message);
    return null;
  }
}

module.exports = { extractText };
