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
    //  Extract info
    const budget = extractBudget(question);
    const categoryIntent = detectCategory(question);
    const keywords = extractKeywords(question);
    const vibes = extractVibe(question);

    //  Build SQL
    let sql = `
      SELECT id, image, title, rating_count, rating_rate, price, category, description 
      FROM products
    `;

    const conditions = [];
    const params = [];

    //  Category filter
    if (categoryIntent && categoryIntent.length > 0) {
      const placeholders = categoryIntent.map(() => "?").join(",");
      conditions.push(`category IN (${placeholders})`);
      params.push(...categoryIntent);
    }

    //  Budget filter
    if (budget && budget > 0) {
      conditions.push("price <= ?");
      params.push(budget);
    }

    //  STRICT Keyword filter (ALL keywords must match)
    if (keywords.length > 0) {
      const keywordConditions = keywords
        .map(() => "(title LIKE ? OR description LIKE ?)")
        .join(" AND ");

      conditions.push(keywordConditions);

      keywords.forEach(k => {
        params.push(`%${k}%`);
        params.push(`%${k}%`);
      });
    }

    //  STRICT Vibe filter (ALL vibes must match)
    if (vibes.length > 0) {
      const vibeConditions = vibes
        .map(() => "(title LIKE ? OR description LIKE ?)")
        .join(" AND ");

      conditions.push(vibeConditions);

      vibes.forEach(v => {
        params.push(`%${v}%`);
        params.push(`%${v}%`);
      });
    }

    // Combine WHERE
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " LIMIT 30";

    //  Execute query
    let [rawProducts] = await db.query(sql, params);

    //  Smart fallback (category + budget only)
    if (rawProducts.length === 0 && (keywords.length > 0 || vibes.length > 0)) {

      let fallbackSQL = `
        SELECT id, image, title, rating_count, rating_rate, price, category, description 
        FROM products
      `;

      const fallbackConditions = [];
      const fallbackParams = [];

      if (categoryIntent && categoryIntent.length > 0) {
        const placeholders = categoryIntent.map(() => "?").join(",");
        fallbackConditions.push(`category IN (${placeholders})`);
        fallbackParams.push(...categoryIntent);
      }

      if (budget && budget > 0) {
        fallbackConditions.push("price <= ?");
        fallbackParams.push(budget);
      }

      if (fallbackConditions.length > 0) {
        fallbackSQL += " WHERE " + fallbackConditions.join(" AND ");
      }

      fallbackSQL += " LIMIT 30";

      const [fallbackProducts] = await db.query(fallbackSQL, fallbackParams);
      rawProducts = fallbackProducts;
    }

    //  Relevance scoring
    let products = rawProducts.map(product => {
      let score = 0;
      const title = product.title.toLowerCase();
      const description = product.description?.toLowerCase() || "";

      // Strong keyword weight
      keywords.forEach(keyword => {
        if (title.includes(keyword.toLowerCase())) score += 5;
        if (description.includes(keyword.toLowerCase())) score += 3;
      });

      // Medium vibe weight
      vibes.forEach(vibe => {
        if (title.includes(vibe.toLowerCase())) score += 3;
        if (description.includes(vibe.toLowerCase())) score += 2;
      });

      return { ...product, relevanceScore: score };
    });

    // ❗ Remove irrelevant products
    if (keywords.length > 0 || vibes.length > 0) {
      products = products.filter(p => p.relevanceScore > 0);
    }

    // Sort by relevance
    products.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Final limit
    products = products.slice(0, 10);

    //  If still empty
    if (products.length === 0) {
      return res.json({
        success: true,
        answer:
          "Sorry 😕 I couldn’t find products that match your request. Try adjusting the wording or budget.",
        products: []
      });
    }

    //  Build AI prompt
    const prompt = `
You are Abaymart Shopping Assistant.

USER QUESTION:
"${question}"

SHOPPING CONTEXT:
- Detected category: ${categoryIntent?.length ? categoryIntent.join(", ") : "Not specified"}
- User budget: ${budget ? `$${budget} USD` : "Not specified"}
- Detected vibe words: ${vibes.length ? vibes.join(", ") : "None"}

You may ONLY recommend products listed below.
NEVER invent products.

AVAILABLE PRODUCTS:
${JSON.stringify(products, null, 2)}

RESPONSE FORMAT:
• Product Name – $PRICE
Short 1-sentence explanation

No markdown lists.
Be professional.
`;

    //  Call AI
    const answerText = await queryGroq(prompt);

    //  Send response
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
