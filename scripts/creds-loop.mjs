// Creds-only loop: repeat the volunteer-creation flow until it fails; dump state.
import { chromium } from "playwright-core";

const BASE = "https://worship-flow.admirmaha2.workers.dev";
const browser = await chromium.launch({
  executablePath: "/home/user/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new"],
});

for (let round = 1; round <= 4; round++) {
  const stamp = Date.now().toString(36);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  try {
    await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("#orgName", { timeout: 30000 });
    await page.fill("#orgName", `Creds ${stamp}`);
    await page.fill("#name", "C Admin");
    await page.fill("#email", `cr${stamp}@modaltest.dev`);
    await page.fill("#password", "AdminPass1");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /add (a )?person/i }).first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    const dlg = page.getByRole("dialog");
    await dlg.locator('input[name="name"]').fill(`Creds Person ${round}`);
    await dlg.locator('input[name="email"]').fill(`cp${stamp}@modaltest.dev`);
    await dlg.getByRole("checkbox").first().check();
    const t0 = Date.now();
    await dlg.getByRole("button", { name: /^(create|save|add)/i }).last().click();
    let pw = null;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      const m = (await page.locator("body").innerText().catch(() => "")).toLowerCase().match(/[a-f0-9]{8}!\d{2}/);
      if (m) { pw = m[0].toUpperCase(); break; }
    }
    const dt = Math.round((Date.now() - t0) / 1000);
    if (pw) {
      console.log(`round ${round}: PASS creds in ${dt}s (${pw})`);
    } else {
      console.log(`round ${round}: FAIL no creds after ${dt}s`);
      console.log("  url:", page.url().slice(45));
      console.log("  dialog open:", await page.getByRole("dialog").count());
      console.log("  dialog text:", (await page.getByRole("dialog").innerText().catch(() => "-")).slice(0, 250).replace(/\n/g, " | "));
      console.log("  body:", (await page.locator("body").innerText().catch(() => "-")).slice(0, 150).replace(/\n/g, " | "));
      console.log("  errors:", errors);
      break;
    }
  } catch (e) {
    console.log(`round ${round}: SCRIPT ERROR`, String(e).slice(0, 200));
    break;
  } finally {
    await ctx.close();
  }
}
await browser.close();
