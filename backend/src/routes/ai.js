const router = require("express").Router();
const prisma = require("../db/prisma");
const asyncHandler = require("../middleware/asyncHandler");
const { askAboutPost, checkHealth } = require("../services/aiService");

/* ── Rate Limiting ─────────────────────────────────────────────── */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const rateMap = new Map(); // ip -> { count, resetAt }

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();
  let entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateMap.set(ip, entry);
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Too many requests. Slow down." });
  }
  next();
}

/* ── Health Check ────────────────────────────────────────────── */
router.get("/status", asyncHandler(async (_req, res) => {
  const status = await checkHealth();
  res.json(status);
}));

/**
 * POST /api/ai/ask
 * Body: { post_id: number, question: string, history?: {role, content}[] }
 * Public endpoint — anyone can ask about a published feed post.
 */
router.post(
  "/ask",
  rateLimit,
  asyncHandler(async (req, res) => {
    const { post_id, question, history } = req.body;

    if (!post_id || !question || typeof question !== "string") {
      return res.status(400).json({ error: "post_id and question are required" });
    }

    const post = await prisma.post.findUnique({
      where: { id: Number(post_id) },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Only allow questions about published posts that are on the feed
    if (post.status !== "published" || !post.allowed_on_feed) {
      return res.status(403).json({ error: "This post is not available for questions" });
    }

    const attachments = await prisma.postAttachment.findMany({
      where: { post_id: Number(post_id) },
      select: { file_name: true, extracted_text: true },
    });

    const answer = await askAboutPost(
      question,
      post.title,
      post.description_markdown,
      attachments,
      Array.isArray(history) ? history : []
    );
    res.json({ answer });
  }),
);

module.exports = router;
