const { OpenAI } = require("openai");

const client = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
});

const MODEL = process.env.AI_MODEL;

/**
 * Build combined context from post description and attachment texts.
 */
function buildContext(descriptionMarkdown, attachments = []) {
  const parts = [];

  if (descriptionMarkdown) {
    parts.push(`Post description:\n---\n${descriptionMarkdown}\n---`);
  }

  for (const att of attachments) {
    if (att.extracted_text) {
      parts.push(`From attachment "${att.file_name}":\n---\n${att.extracted_text}\n---`);
    }
  }

  if (parts.length === 0) {
    return "(No content provided)";
  }

  return parts.join("\n\n");
}

/**
 * Ask the AI a question about a post.
 *
 * @param {string} question - The user's question.
 * @param {string} descriptionMarkdown - The post's description_markdown.
 * @param {Array} attachments - PostAttachment records with extracted_text.
 * @returns {Promise<string>} - The AI's answer.
 */
async function askAboutPost(question, descriptionMarkdown, attachments = []) {
  const systemPrompt =
    "You are a helpful assistant. Answer the user's question based ONLY on the following post content and attached documents. " +
    "If the answer is not in the content, say so. Keep answers concise and helpful.";

  const context = buildContext(descriptionMarkdown, attachments);

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Context:\n${context}\n\nQuestion: ${question}`,
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content?.trim() || "No response from AI.";
  } catch (err) {
    console.error("[aiService] OpenAI error:", err.message);
    throw new Error("AI service unavailable. Please try again later.");
  }
}

module.exports = { askAboutPost };
