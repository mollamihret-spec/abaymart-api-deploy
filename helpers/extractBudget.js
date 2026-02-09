function extractBudget(question) {
  if (!question) return null;

  // Match any number preceded optionally by $ or 'under' or 'less than'
  const regex = /(?:under|less than|<=?)?\s*\$?(\d+(?:\.\d{1,2})?)/i;
  const match = question.match(regex);

  if (match) return parseFloat(match[1]);
  return null;
}

module.exports = { extractBudget };
