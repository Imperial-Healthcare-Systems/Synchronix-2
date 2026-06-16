import { chromium, devices } from "playwright";
import fs from "fs";

const OUT = "mobile-shots";
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: "iphone-se-375", width: 375, height: 667, dpr: 2 },
  { name: "small-320", width: 320, height: 568, dpr: 2 },
];

const routes = [
  { id: "home", hash: "#home" },
  { id: "about", hash: "#about" },
  { id: "services", hash: "#services" },
  { id: "service-warehousing", hash: "#service-warehousing-solutions" },
  { id: "contact", hash: "#contact" },
  { id: "partner", hash: "#partner" },
];

const base = "http://localhost:3000/";
const browser = await chromium.launch();
const report = [];

for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  for (const r of routes) {
    // force a genuine fresh load (SPA only reads hash once on load)
    await page.goto("about:blank");
    await page.goto(base + r.hash, { waitUntil: "networkidle" });
    // let hash router + reveal animations settle
    await page.waitForTimeout(600);
    // scroll through to trigger reveal-on-scroll, then back to top
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y <= h; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((res) => setTimeout(res, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);

    // horizontal-overflow check + find offending elements
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const docW = de.clientWidth;
      const scrollW = de.scrollWidth;
      const offenders = [];
      if (scrollW > docW + 1) {
        document.querySelectorAll("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > docW + 1 && r.width > 0 && r.height > 0) {
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || "").toString().slice(0, 50),
              right: Math.round(r.right),
            });
          }
        });
      }
      return { docW, scrollW, overflow: scrollW > docW + 1, offenders: offenders.slice(0, 8) };
    });

    const file = `${OUT}/${vp.name}__${r.id}.png`;
    await page.screenshot({ path: file, fullPage: true });
    report.push({ vp: vp.name, route: r.id, ...overflow, file });
    console.log(
      `${vp.name} / ${r.id} -> overflow=${overflow.overflow} (doc ${overflow.docW} / scroll ${overflow.scrollW})`
    );
    if (overflow.overflow) console.log("   offenders:", JSON.stringify(overflow.offenders));
  }
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log("\nDONE. Shots + report in", OUT);
