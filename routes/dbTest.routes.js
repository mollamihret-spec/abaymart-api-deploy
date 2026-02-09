const express = require("express");
const db = require("../DB/mysql.js");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT DATABASE() AS DB");
    res.json({ success: true, rows });
    
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
