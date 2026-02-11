function extractVibe(question) {
  const vibeWords = [
    "cozy",
    "romantic",
    "classy",
    "luxury",
    "cute",
    "sporty",
    "minimalist",
    "aesthetic",
    "elegant",
    "casual",
    "formal",
    "gift",
    "birthday",
    "anniversary",
    "office",
    "summer",
    "winter"
  ];

  const lower = question.toLowerCase();

  return vibeWords.filter(vibe => lower.includes(vibe));
}

module.exports = { extractVibe };
