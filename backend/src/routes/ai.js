const router = require("express").Router();
const prisma = require("../db/prisma");
const asyncHandler = require("../middleware/asyncHandler");
const { askAboutPost } = require("../services/aiService");

/**
 * POST /api/ai/ask
 * Body: { post_id: number, question: string }
 * Public endpoint — anyone can ask about a published feed post.
 */
router.post(
  "/ask",
  asyncHandler(async (req, res) => {
    const { post_id, question } = req.body;

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

    const answer = await askAboutPost(question, post.description_markdown);
    res.json({ answer });
  }),
);

module.exports = router;
