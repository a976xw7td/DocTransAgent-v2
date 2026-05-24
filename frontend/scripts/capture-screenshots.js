const { chromium } = require("playwright");
const path = require("path");

const OUT = path.join(__dirname, "..", "demo-video");
const BASE = "http://localhost:3000";

const pages = [
  { name: "01-dashboard", url: "/", wait: 2000 },
  { name: "02-dashboard-en", url: "/", wait: 1500, click: "text=English" },
  { name: "03-upload", url: "/upload", wait: 2000 },
  { name: "04-graph", url: "/graph", wait: 3000 },
  { name: "05-qa", url: "/qa", wait: 2000 },
  { name: "06-glossary", url: "/glossary", wait: 1500 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  for (const page of pages) {
    console.log(`📸 ${page.name} -> ${page.url}`);
    const tab = await context.newPage();
    await tab.goto(`${BASE}${page.url}`, { waitUntil: "networkidle" });
    await tab.waitForTimeout(page.wait || 1500);

    if (page.click) {
      const btn = await tab.locator(page.click).first();
      if (await btn.isVisible()) {
        await btn.click();
        await tab.waitForTimeout(1500);
      }
    }

    // Hide scrollbars for clean screenshots
    await tab.addStyleTag({ content: "::-webkit-scrollbar { display: none; } body { overflow: hidden; }" });

    await tab.screenshot({
      path: path.join(OUT, `${page.name}.png`),
      fullPage: false,
    });
    await tab.close();
  }

  await browser.close();
  console.log("✅ All screenshots captured.");
})();