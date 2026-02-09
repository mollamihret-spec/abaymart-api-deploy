function extractBudget(question) {
  if (!question) return null;

  // Match "under $50", "below $100", "less than 30", "$50", "50 USD"
  const regex = /(?:under|below|less than)?\s*\$?\s*(\d+(?:\.\d{1,2})?)/i;

  const match = question.match(regex);

  if (match) {
    const value = parseFloat(match[1]);
    if (!isNaN(value)) return value;
  }

  return null; // no budget found
}

module.exports = { extractBudget };
