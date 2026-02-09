const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function queryGroq(prompt) {
  const completion = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    messages: [
      { role: "system", content: "You are a helpful e-commerce assistant." },
      { role: "user", content: prompt }
    ],
    temperature: 0.4
  });

  return completion.choices[0].message.content;
}

module.exports = { queryGroq };
