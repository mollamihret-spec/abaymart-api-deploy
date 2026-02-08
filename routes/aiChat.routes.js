const express = require("express");
const { queryGroq } = require("../helpers/groq.js");
const db = require("../DB/mysql.js");

const router = express.Router();

router.post("/", async (req, res) => {
  const { question } = req.body;
  // call queryGroq here
});

module.exports = router;
