const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const ATTACHMENT_DIR = path.join(__dirname, "../../uploads/attachments");
fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, _file, cb) => cb(null, ATTACHMENT_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx", ".txt", ".zip", ".csv",
]);

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "text/csv",
]);

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype || "";
    if (ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIMES.has(mime)) {
      return cb(null, true);
    }
    return cb(new Error(`Unsupported file type: ${ext || mime}. Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP`));
  },
});

const uploadAttachments = (req, res, next) => {
  upload.array("attachments", 5)(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each file must be 20 MB or smaller"
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Unexpected field name. Use 'attachments'."
          : err.message || "Attachment upload failed";
    return res.status(400).json({ error: message });
  });
};

module.exports = { uploadAttachments, ATTACHMENT_DIR };
