const admin = require("../firebaseAdmin");

const ADMIN_EMAILS = ["molamihert@gmail.com"]; 

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split("Bearer ")[1];

    const decodedToken = await admin.auth().verifyIdToken(token);

    if (!ADMIN_EMAILS.includes(decodedToken.email)) {
      return res.status(403).json({ message: "Admin access only" });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = adminAuth;
