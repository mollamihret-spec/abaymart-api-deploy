function detectCategory(question) {
  const q = question.toLowerCase();

  // 🔌 Electronics
  if (/phone|mobile|laptop|electronics|ssd|computer|headphone|earphone|tv|camera/.test(q)) {
    return "electronics";
  }

  // 💎 Jewelry
  if (/jewel|jewelry|ring|necklace|bracelet|earring|gold|silver|diamond/.test(q)) {
    return "jewelery";
  }

  // 👔 Men's Clothing
  if (/men|male|men's|shirt|t-shirt|jacket|hoodie|pant|jeans|wear/.test(q)) {
    return "men's clothing";
  }

  // 👗 Women's Clothing
  if (/women|female|women's|dress|skirt|blouse|top|gown/.test(q)) {
    return "women's clothing";
  }

  return null;
}

module.exports = { detectCategory };
