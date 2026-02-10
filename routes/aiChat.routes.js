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
    // 2️⃣ Fetch products
    let products;
    if (budget && budget > 0) {
      [products] = await db.query(
        "SELECT id, image, title,  rating_count, rating_rate, price, category FROM products WHERE price <= ? LIMIT 50",
        [budget]
      );
    } else {
      [products] = await db.query(
        "SELECT id, image, title,  rating_count, rating_rate, price, category FROM products LIMIT 50"
      );
    }

    // 3️⃣ Build AI prompt
const prompt = `
You are Abaymart Shopping Assistant.

USER QUESTION:
"${question}"

SHOPPING CONTEXT (VERY IMPORTANT):
- User budget: ${budget && budget > 0 ? `$${budget} USD` : "Not specified"}
- You may ONLY recommend products listed below
- Prices are FINAL and in USD
- NEVER invent products, prices, ratings, or details

AVAILABLE PRODUCTS (JSON):
${JSON.stringify(products, null, 2)}

RESPONSE FORMAT (MANDATORY):
- Start with a friendly 1–2 sentence introduction
- Use the bullet symbol "•" (not dashes, not markdown lists)
- Each product must follow this structure:

• Product Name – $PRICE  
Short 1-sentence description explaining why it’s a good choice

- After listing products, add a short closing sentence offering help
- Keep tone friendly and professional
- DO NOT use markdown lists
- DO NOT joke
- Recommend only relevant products
- If no products match, say so clearly and politely
`;



    // 4️⃣ Call Groq
    const answerText = await queryGroq(prompt);

    // 5️⃣ Return results
    res.json({
      success: true,
      answer: answerText,
      products
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
