const express = require("express");
const { queryGroq } = require("../helpers/groq");
const { extractBudget } = require("../helpers/extractBudget");
const db = require("../DB/mysql");

const router = express.Router();

router.post("/", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Question required" });

  try {
    // 1️⃣ Extract budget
    const budget = extractBudget(question);

    // 2️⃣ Fetch products (filtered if budget exists)
    let products;
    if (budget !== null) {
      [products] = await db.query(
        "SELECT id, title, price, category FROM products WHERE price <= ? LIMIT 50",
        [budget]
      );
    } else {
      [products] = await db.query(
        "SELECT id, title, price, category FROM products LIMIT 50"
      );
    }

    // 3️⃣ Build a strong AI prompt
    const prompt = `
You are an AI shopping assistant.

User question:
"${question}"

IMPORTANT CONTEXT (DO NOT GUESS):
- User budget: ${budget !== null ? `$${budget} USD` : "Not specified"}
- Products provided below are the ONLY products you may recommend
- Prices are FINAL and in USD

Products:
${JSON.stringify(products)}

Instructions:
- Answer naturally and helpfully
- Recommend only from provided products
- Respect budget if specified
- Mention category if relevant
- If no products match, say so clearly
- NEVER invent products or prices
`;

    // 4️⃣ Call Groq API
    const answerText = await queryGroq(prompt);

    // 5️⃣ Return both structured data and AI text
    res.json({
      success: true,
      answer: answerText,
      products // this can be empty if none match
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
