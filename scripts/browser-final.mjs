// Patient end-to-end Ask 13 verification (admin + volunteer).
import { chromium } from "playwright-core";

const BASE = "https://worship-flow.admirmaha2.workers.dev";
const stamp = Date.now().toString(36);
const log = (ok, msg) => console.log(`${ok ? "PASS" : "FAIL"} — ${msg}`);
const browser = await chromium.launch({
  executablePath: "/home/user/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new"],
});

async function newText(page) {
  return (await page.locator("body").innerText().catch(() => "")).toLowerCase();
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 150)));

  // signup
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#orgName", { timeout: 30000 });
  await page.fill("#orgName", `Final ${stamp}`);
  await page.fill("#name", "F Admin");
  await page.fill("#email", `f${stamp}@modaltest.dev`);
  await page.fill("#password", "AdminPass1");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("body");

  // 1. no-login create → modal closes + person appears (patient wait)
  await page.getByRole("button", { name: /add (a )?person/i }).first().click();
  await page.waitForSelector('[role="dialog"]');
  const dlg = page.getByRole("dialog");
  await dlg.locator('input[name="name"]').fill("Plain Person");
  const t0 = Date.now();
  await dlg.getByRole("button", { name: /^(create|save|add)/i }).last().click();
  let ok1 = false, closed = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const txt = await newText(page);
    if (txt.includes("plain person")) ok1 = true;
    if ((await page.getByRole("dialog").count()) === 0) closed = true;
    if (ok1 && closed) break;
  }
  log(ok1, `1. person created (${Math.round((Date.now() - t0) / 1000)}s)`);
  log(closed, `2. modal closed itself`);

  // (createPerson redirects to the new person's page — go back to the list)
  await page.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);

  // 2. swipe-to-delete the row
  const row = page.locator("a", { hasText: "Plain Person" }).first();
  const box = await row.boundingBox().catch(() => null);
  log(!!box, `3. row rendered for swipe`);
  if (box) {
    // click-and-hold (desktop) reveals delete
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const del = page.getByRole("button", { name: /delete plain person/i });
    log(await del.first().isVisible().catch(() => false), `4. hold revealed Delete (visible)`);
    if (await del.first().isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await del.first().click({ force: true });
      let gone = false;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(2500);
        if (!(await newText(page)).includes("plain person")) { gone = true; break; }
      }
      log(gone, `5. delete removed the person`);
    }
  }

  // 3. volunteer with login: temp password card + they sign in + no delete UI
  await page.getByRole("button", { name: /add (a )?person/i }).first().click();
  await page.waitForSelector('[role="dialog"]');
  const dlg2 = page.getByRole("dialog");
  await dlg2.locator('input[name="name"]').fill("Creds Volunteer");
  await dlg2.locator('input[name="email"]').fill(`cv${stamp}@modaltest.dev`);
  await dlg2.getByRole("checkbox").first().check();
  await dlg2.getByRole("button", { name: /^(create|save|add)/i }).last().click();
  let volPw = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const m = (await newText(page)).match(/[a-f0-9]{8}!\d{2}/);
    if (m) { volPw = m[0].toUpperCase(); break; }
  }
  log(!!volPw, `6. temp password card shown (${volPw})`);
  const dlgTxt = await page.getByRole("dialog").innerText().catch(() => "");
  log(/login created/i.test(dlgTxt), `7. one-time creds card visible`);
  await page.getByRole("button", { name: /^done$/i }).click().catch(() => {});
  await page.waitForTimeout(500);

  // volunteer session
  const vctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const vp = await vctx.newPage();
  await vp.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await vp.fill("#email", `cv${stamp}@modaltest.dev`);
  await vp.fill("#password", volPw);
  await Promise.all([
    vp.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    vp.click('button[type="submit"]'),
  ]);
  const vurl = vp.url();
  log(!/login/.test(vurl) || /dashboard/.test(vurl), `8. volunteer signed in with temp pw (${vurl.replace(BASE, "").slice(0, 30)})`);

  // change password
  await vp.goto(BASE + "/settings/security", { waitUntil: "domcontentloaded", timeout: 90000 });
  await vp.waitForSelector('input[name="currentPassword"]', { timeout: 30000 });
  await vp.fill('input[name="currentPassword"]', volPw);
  await vp.fill('input[name="newPassword"]', "VolNewPass9");
  await vp.fill('input[name="confirmPassword"]', "VolNewPass9");
  await vp.getByRole("button", { name: /change|update|save/i }).first().click();
  let changed = false;
  for (let i = 0; i < 10; i++) {
    await vp.waitForTimeout(2500);
    if (/changed|updated|success/i.test(await newText(vp))) { changed = true; break; }
  }
  log(changed, `9. password change confirmed`);

  // volunteer: no delete affordance on people rows
  await vp.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
  await vp.waitForTimeout(2500);
  const vrow = vp.locator("a", { hasText: "Creds Volunteer" }).first();
  const vbox = await vrow.boundingBox().catch(() => null);
  log(!!vbox, `10. volunteer sees the person list`);
  if (vbox) {
    await vp.mouse.move(vbox.x + vbox.width * 0.75, vbox.y + vbox.height / 2);
    await vp.mouse.down();
    await vp.waitForTimeout(900);
    await vp.mouse.up();
    await vp.waitForTimeout(500);
    const vdelVisible = await vp.locator('button[aria-label^="Delete"]').filter({ visible: true }).count();
    log(vdelVisible === 0, `11. volunteer hold shows NO delete`);
  }
  await page.screenshot({ path: "/tmp/final-admin.png" });
  console.log("org: Final " + stamp);
} finally {
  await browser.close();
}
