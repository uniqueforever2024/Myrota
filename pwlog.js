const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", msg => console.log("console:", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("pageerror:", err.message));
  try {
    await page.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle", timeout: 15000 });
  } catch (err) {
    console.log("goto failed:", err.message);
  }
  await page.waitForTimeout(2000);
  await browser.close();
})();
