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

    // 2️⃣ Detect category intent (array)
    const categoryIntent = detectCategory(question); // should return array of possible categories

    // 3️⃣ Extract keywords
    const keywords = extractKeywords(question);

    // 4️⃣ Extract vibe words
    const vibes = extractVibe(question);

    // 5️⃣ Build SQL dynamically
    let sql = "SELECT id, image, title, rating_count, rating_rate, price, category FROM products";
    const params = [];

    // Category filter
    if (categoryIntent && categoryIntent.length > 0) {
      const placeholders = categoryIntent.map(() => "?").join(",");
      sql += ` WHERE category IN (${placeholders})`;
      params.push(...categoryIntent);
    }

    // Budget filter
    if (budget && budget > 0) {
      sql += params.length > 0 ? " AND price <= ?" : " WHERE price <= ?";
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
    sql += " LIMIT 20";

    // 6️⃣ Fetch products from DB
    let [rawProducts] = await db.query(sql, params);

    // 🔥 Smart fallback if no products found
    if (rawProducts.length === 0 && keywords.length > 0) {
      let fallbackSQL = "SELECT id, image, title, rating_count, rating_rate, price, category FROM products";
      const fallbackParams = [];

      if (categoryIntent && categoryIntent.length > 0) {
        const placeholders = categoryIntent.map(() => "?").join(",");
        fallbackSQL += ` WHERE category IN (${placeholders})`;
        fallbackParams.push(...categoryIntent);
      }

      if (budget && budget > 0) {
        fallbackSQL += fallbackParams.length > 0 ? " AND price <= ?" : " WHERE price <= ?";
        fallbackParams.push(budget);
      }

      fallbackSQL += " LIMIT 20";

      const [fallbackProducts] = await db.query(fallbackSQL, fallbackParams);
      rawProducts = fallbackProducts;
    }

    // 7️⃣ Apply relevance scoring (keywords + vibes)
    let products = rawProducts.map(product => {
      let score = 0;
      const title = product.title.toLowerCase();

      // keyword match stronger
      keywords.forEach(keyword => {
        if (title.includes(keyword.toLowerCase())) score += 3;
      });

      // vibe match lighter
      vibes.forEach(vibe => {
        if (title.includes(vibe.toLowerCase())) score += 2;
      });

      return { ...product, relevanceScore: score };
    });

    // Sort by relevance
    products.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit final products
    products = products.slice(0, 10);

    // 8️⃣ If still no products
    if (products.length === 0) {
      return res.json({
        success: true,
        answer:
          "Sorry 😕 I couldn’t find products that match your request. Try adjusting the category, wording, or budget.",
        products: []
      });
    }

    // 9️⃣ Build AI prompt
    const prompt = `
You are Abaymart Shopping Assistant.

USER QUESTION:
"${question}"

SHOPPING CONTEXT (VERY IMPORTANT):
- Detected category: ${categoryIntent && categoryIntent.length > 0 ? categoryIntent.join(", ") : "Not specified"}
- User budget: ${budget && budget > 0 ? `$${budget} USD` : "Not specified"}
- Detected vibe words: ${vibes.length ? vibes.join(", ") : "None"}
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

    // 🔟 Call Groq AI
    const answerText = await queryGroq(prompt);

    // 1️⃣1️⃣ Return response
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
