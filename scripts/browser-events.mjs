// Verify: repeating events on create, copy-to-another-day, calendar quick-add, volunteer lockout.
import { chromium } from "playwright-core";

const BASE = "https://worship-flow.admirmaha2.workers.dev";
const stamp = Date.now().toString(36);
const log = (ok, msg) => console.log(`${ok ? "PASS" : "FAIL"} — ${msg}`);
const browser = await chromium.launch({
  executablePath: "/home/user/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new"],
});
const text = (p) => p.locator("body").innerText().catch(() => "");

function plusDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
async function waitfor(page, fn, tries = 25, ms = 2000) {
  for (let i = 0; i < tries; i++) {
    await page.waitForTimeout(ms);
    if (await fn()) return true;
  }
  return false;
}
const countTitle = async (p) => ((await text(p)).match(/Repeat Test Event/g) || []).length;

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 120)));

  // signup
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#orgName", { timeout: 30000 });
  await page.fill("#orgName", `Ev ${stamp}`);
  await page.fill("#name", "E Admin");
  await page.fill("#email", `ev${stamp}@modaltest.dev`);
  await page.fill("#password", "AdminPass1");
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}), page.click('button[type="submit"]')]);

  // 1. create with repeat: every week, until base+14 → 3 events
  const base = plusDays(new Date().toISOString().slice(0, 10), 10);
  await page.goto(BASE + "/services/new", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#n-date", { timeout: 30000 });
  await page.fill("#n-title", "Repeat Test Event");
  await page.fill("#n-date", base);
  await page.selectOption("#n-repeat", "7");
  await page.fill("#n-until", plusDays(base, 14));
  await page.click('button:has-text("Create event")');
  const calOk = await waitfor(page, () => page.locator("a[href^='/services/']").first().isVisible().catch(() => false));
  log(/\/calendar/.test(page.url()), `1. weekly repeat landed on calendar (${page.url().replace(BASE, "").slice(0, 15)})`);
  await page.goto(BASE + "/services", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, async () => (await countTitle(page)) >= 3);
  const n1 = await countTitle(page);
  log(n1 === 3, `2. created 3 weekly events (found ${n1})`);

  // 2. copy to another day (just once)
  await page.locator("a", { hasText: "Repeat Test Event" }).first().click();
  await waitfor(page, () => page.locator('button:has-text("Copy to another day")').first().isVisible().catch(() => false));
  await page.locator('button:has-text("Copy to another day")').first().click();
  await page.waitForSelector('[role="dialog"]');
  await page.fill("#cp-date", plusDays(base, 28));
  await page.selectOption("#cp-weeks", "0");
  await page.locator('button:has-text("Create copy")').last().click();
  await waitfor(page, async () => (await page.getByRole("dialog").count()) === 0 && /\/services\/./.test(page.url()));
  await page.goto(BASE + "/services", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, async () => (await countTitle(page)) >= 4);
  const n2 = await countTitle(page);
  log(n2 === 4, `3. copy-to-day added 1 event (found ${n2})`);
  const firstEventUrl = BASE + "/services";

  // 3. copy weekly ×4
  await page.goto(BASE + "/services", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("a", { hasText: "Repeat Test Event" }).first().click();
  await waitfor(page, () => page.locator('button:has-text("Copy to another day")').first().isVisible().catch(() => false));
  await page.locator('button:has-text("Copy to another day")').first().click();
  await page.waitForSelector('[role="dialog"]');
  await page.fill("#cp-date", plusDays(base, 60));
  await page.selectOption("#cp-weeks", "4");
  await page.locator('button:has-text("Create copy")').last().click();
  await waitfor(page, async () => (await page.getByRole("dialog").count()) === 0 && /\/services\/./.test(page.url()));
  await page.goto(BASE + "/services", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, async () => (await countTitle(page)) >= 8);
  const n3 = await countTitle(page);
  log(n3 === 8, `4. weekly ×4 copy added 4 events (found ${n3})`);

  // 4. calendar quick-add prefills date
  await page.goto(BASE + "/calendar", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, () => page.locator("a[href^='/services/new?date=']").first().isVisible().catch(() => false));
  const quick = page.locator("a[href^='/services/new?date=']").first();
  const href = await quick.getAttribute("href");
  await quick.click();
  await page.waitForSelector("#n-date", { timeout: 30000 });
  const prefilled = await page.inputValue("#n-date");
  log(prefilled && href.includes(prefilled), `5. calendar "+New" prefills date (${prefilled}, link ${href.slice(-14)})`);

  // 5. volunteer: no copy button, no create page
  await page.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, () => page.locator('button:has-text("Add person")').first().isVisible().catch(() => false));
  await page.locator('button:has-text("Add person")').first().click();
  await page.waitForSelector('[role="dialog"]');
  const d = page.getByRole("dialog");
  await d.locator('input[name="name"]').fill("Ev Volunteer");
  await d.locator('input[name="email"]').fill(`evv${stamp}@modaltest.dev`);
  await d.getByRole("checkbox").first().check();
  await d.locator('button:has-text("Create"), button:has-text("Add")').last().click();
  let volPw = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    const m = (await text(page)).match(/[A-F0-9]{8}!\d{2}/);
    if (m) { volPw = m[0]; break; }
  }
  const vctx = await browser.newContext();
  const vp = await vctx.newPage();
  await vp.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await vp.fill("#email", `evv${stamp}@modaltest.dev`);
  await vp.fill("#password", volPw);
  await Promise.all([vp.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}), vp.click('button[type="submit"]')]);
  console.log("  volunteer after login:", vp.url().replace(BASE, "").slice(0, 25), "pw:", volPw);
  const volEventUrl = firstEventUrl;
  await vp.goto(volEventUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await vp.waitForTimeout(3000);
  log(!(await text(vp)).includes("Copy to another day"), `6. volunteer sees NO copy button`);
  await vp.goto(BASE + "/services/new", { waitUntil: "domcontentloaded", timeout: 90000 });
  await vp.waitForTimeout(2000);
  log((await text(vp)).includes("rights"), `7. volunteer cannot create events`);
  await vctx.close();

  console.log("org: Ev " + stamp);
} finally {
  await browser.close();
}
