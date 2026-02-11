const express = require("express");
const { queryGroq } = require("../helpers/groq");
const { extractBudget } = require("../helpers/extractBudget");
const { extractVibe } = require("../utils/extractVibe");
const db = require("../DB/mysql");
const { detectCategory } = require("../utils/detectCategory");
const { extractKeywords } = require("../utils/extractKeywords");

const router = express.Router();

router.post("/", async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Question required" });
  }

  try {
    // 1️⃣ Extract budget
    const budget = extractBudget(question);

    // 2️⃣ Detect category intent
    const categoryIntent = detectCategory(question);

    // 3️⃣ Extract keywords
    const keywords = extractKeywords(question);

    // vibe word recognition
    const vibes = extractVibe(question);

    // 4️⃣ Build SQL dynamically
    let sql =
      "SELECT id, image, title, rating_count, rating_rate, price, category FROM products";
    const params = [];

    // Category filter
    if (categoryIntent) {
      sql += " WHERE category = ?";
      params.push(categoryIntent);
    }

    // Budget filter
    if (budget && budget > 0) {
      sql += categoryIntent ? " AND price <= ?" : " WHERE price <= ?";
      params.push(budget);
    }

    // Keyword filter
    if (keywords.length > 0) {
      const keywordConditions = keywords.map(() => "title LIKE ?").join(" OR ");
      const keywordParams = keywords.map(k => `%${k}%`);
      sql += params.length > 0 ? ` AND (${keywordConditions})` : ` WHERE (${keywordConditions})`;
      params.push(...keywordParams);
    }

    // Limit results
    sql += " LIMIT 10";

    // 5️⃣ Fetch products from DB
let [rawProducts] = await db.query(sql, params);

// 🔥 SMART FALLBACK (if keyword filtering blocks everything)
if (rawProducts.length === 0 && keywords.length > 0) {
  let fallbackSQL =
    "SELECT id, image, title, rating_count, rating_rate, price, category FROM products";
  const fallbackParams = [];

  if (categoryIntent) {
    fallbackSQL += " WHERE category = ?";
    fallbackParams.push(categoryIntent);
  }

  if (budget && budget > 0) {
    fallbackSQL += categoryIntent ? " AND price <= ?" : " WHERE price <= ?";
    fallbackParams.push(budget);
  }

  fallbackSQL += " LIMIT 10";

  const [fallbackProducts] = await db.query(fallbackSQL, fallbackParams);
  rawProducts = fallbackProducts;
}


    // 6️⃣ Hard safety filter to prevent unrelated products
    const products = categoryIntent
      ? rawProducts.filter(p => p.category === categoryIntent)
      : rawProducts;

    // 7️⃣ If no products found
    if (products.length === 0) {
      return res.json({
        success: true,
        answer:
          "Sorry 😕 I couldn’t find products that match your request. Try adjusting the category, wording, or budget.",
        products: []
      });
    }

    // 8️⃣ Build AI prompt
    const prompt = `
You are Abaymart Shopping Assistant.

USER QUESTION:
"${question}"

SHOPPING CONTEXT (VERY IMPORTANT):
- Detected category: ${categoryIntent || "Not specified"}
- User budget: ${budget && budget > 0 ? `$${budget} USD` : "Not specified"}
- Detected vibe words: ${vibes.length ? vibes.join(", ") : "None"}
- You may ONLY recommend products listed below
- Prices are FINAL and in USD
- NEVER invent products, prices, ratings, or details

If vibe words exist:
- Choose products that best match the emotional intent.
- Rank products based on vibe relevance.
- Explain briefly why each product fits the vibe.

If no vibe words:
- Just recommend the most relevant and high-rated products.

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

    // 9️⃣ Call Groq
    const answerText = await queryGroq(prompt);

    // 🔟 Return response
    res.json({
      success: true,
      answer: answerText,
      products
    });
  } catch (err) {
    console.error("AI search error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

module.exports = router;
