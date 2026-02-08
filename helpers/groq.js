const Groq = require("groq-sdk");

const groq = new Groq(process.env.GROQ_API_KEY);

async function queryGroq(prompt) {
  try {
    const response = await groq.query({ prompt });
    return response;
  } catch (err) {
    console.error("Groq API error:", err);
    throw err;
  }
}

module.exports = { queryGroq };
