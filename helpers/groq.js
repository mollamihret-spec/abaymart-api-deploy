const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function queryGroq(prompt) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: "You are a helpful e-commerce assistant." },
      { role: "user", content: prompt }
    ],
    temperature: 0.4
  });

  return completion.choices[0].message.content;
}

module.exports = { queryGroq };
