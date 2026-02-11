function detectCategory(question) {
  const q = question.toLowerCase();
  const categories = [];

  // Electronics
  if (/phone|mobile|laptop|electronics|ssd|computer|headphone|earphone|tv|camera/.test(q)) {
    categories.push("electronics");
  }

  // Jewelry
  if (/jewel|jewelry|ring|necklace|bracelet|earring|gold|silver|diamond/.test(q)) {
    categories.push("jewelery");
  }

  // Men's Clothing
  if (/men|male|men's|shirt|t-shirt|jacket|hoodie|pant|jeans|wear/.test(q)) {
    categories.push("mens-clothing");
  }

  // Women's Clothing
  if (/women|female|women's|dress|skirt|blouse|top|gown/.test(q)) {
    categories.push("women-clothing");
  }

  return categories.length ? categories : null;
}

module.exports = { detectCategory };
