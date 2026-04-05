const path = require("path");
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 3003);
const APF_HOME_URL = process.env.APF_HOME_URL || "http://localhost:5173/";
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.static(PUBLIC_DIR));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: "open-workspace",
    apfHomeUrl: APF_HOME_URL,
    storage: "browser-local"
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Certificate workspace started at http://localhost:${PORT}`);
});
