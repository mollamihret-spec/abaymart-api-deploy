function extractKeywords(question) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter(
      word =>
        word.length > 2 &&
        !["best", "cheap", "good", "hot", "weather", "for"].includes(word)
    );
}

module.exports = { extractKeywords };
