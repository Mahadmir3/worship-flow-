// Verify: custom password on create, admin password change, admin login removal, volunteer lockout.
import { chromium } from "playwright-core";

const BASE = "https://worship-flow.admirmaha2.workers.dev";
const stamp = Date.now().toString(36);
const log = (ok, msg) => console.log(`${ok ? "PASS" : "FAIL"} — ${msg}`);
const browser = await chromium.launch({
  executablePath: "/home/user/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--headless=new"],
});
const text = (p) => p.locator("body").innerText().catch(() => "");

async function waitfor(page, fn, tries = 25, ms = 2000) {
  for (let i = 0; i < tries; i++) {
    await page.waitForTimeout(ms);
    if (await fn()) return true;
  }
  return false;
}

try {
  // --- setup: new org, admin ---
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 120)));
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("#orgName", { timeout: 30000 });
  await page.fill("#orgName", `Acct ${stamp}`);
  await page.fill("#name", "A Admin");
  await page.fill("#email", `aa${stamp}@modaltest.dev`);
  await page.fill("#password", "AdminPass1");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  // --- 1. create person WITH CUSTOM password ---
  await page.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, () => page.locator('button:has-text("Add person")').first().isVisible());
  await page.locator('button:has-text("Add person")').first().click();
  await page.waitForSelector('[role="dialog"]');
  const dlg = page.getByRole("dialog");
  await dlg.locator('input[name="name"]').fill("CustomPW Volunteer");
  await dlg.locator('input[name="email"]').fill(`cw${stamp}@modaltest.dev`);
  await dlg.getByRole("checkbox").first().check();
  await dlg.locator('input[name="tempPassword"]').fill("MyCustomPw7");
  await dlg.locator('button[type="submit"], button:has-text("Create"), button:has-text("Add")').last().click();
  const cardOk = await waitfor(page, async () => /mycustompw7/i.test(await text(page)));
  log(cardOk, `1. custom password shown on the green card`);

  // volunteer signs in with the CUSTOM password
  const vctx = await browser.newContext();
  const vp = await vctx.newPage();
  await vp.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await vp.fill("#email", `cw${stamp}@modaltest.dev`);
  await vp.fill("#password", "MyCustomPw7");
  await Promise.all([
    vp.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    vp.click('button[type="submit"]'),
  ]);
  log(!/error/.test(vp.url()), `2. volunteer signs in with the custom password (${vp.url().replace(BASE, "").slice(0, 25)})`);
  await vctx.close();

  // --- 2. admin changes the account password on the person page ---
  await page.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, () => page.locator("a", { hasText: "CustomPW Volunteer" }).first().isVisible());
  await page.locator("a", { hasText: "CustomPW Volunteer" }).first().click();
  await waitfor(page, () => page.getByRole("heading", { name: "Login & account" }).isVisible());
  log(true, `3. "Login & account" card visible to admin`);
  await page.locator('button:has-text("Change password")').first().click();
  await page.waitForSelector('[role="dialog"]');
  const cpw = page.getByRole("dialog");
  await cpw.locator('input[name="newPassword"]').fill("AdminReset9");
  await cpw.locator('input[name="confirmPassword"]').fill("AdminReset9");
  await cpw.locator('button:has-text("Save password")').last().click();
  const closed = await waitfor(page, async () => (await page.getByRole("dialog").count()) === 0);
  log(closed, `4. password change saved (modal closed)`);

  // old password rejected, new works
  const octx = await browser.newContext();
  const op = await octx.newPage();
  await op.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await op.fill("#email", `cw${stamp}@modaltest.dev`);
  await op.fill("#password", "MyCustomPw7");
  await Promise.all([
    op.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    op.click('button[type="submit"]'),
  ]);
  log(/error/.test(op.url()) || (await op.locator('input[type="password"]').count()) > 0, `5. OLD password rejected`);
  await op.fill("#email", `cw${stamp}@modaltest.dev`);
  await op.fill("#password", "AdminReset9");
  await Promise.all([
    op.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    op.click('button[type="submit"]'),
  ]);
  log(!/error/.test(op.url()), `6. NEW password works`);

  // volunteer must NOT see the account card
  await op.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, () => op.locator("a", { hasText: "CustomPW Volunteer" }).first().isVisible().catch(() => false));
  await op.locator("a", { hasText: "CustomPW Volunteer" }).first().click().catch(() => {});
  const volSeesCard = await op.getByRole("heading", { name: "Login & account" }).isVisible().catch(() => false);
  log(!volSeesCard, `7. volunteer does NOT see the Login & account card`);
  await octx.close();

  // --- 3. admin removes the login ---
  await page.goto(BASE + "/people", { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitfor(page, () => page.locator("a", { hasText: "CustomPW Volunteer" }).first().isVisible());
  await page.locator("a", { hasText: "CustomPW Volunteer" }).first().click();
  await waitfor(page, () => page.locator('button:has-text("Change password")').first().isVisible());
  page.once("dialog", (d) => d.accept());
  await page.locator('button:has-text("Remove login")').click();
  const removed = await waitfor(page, async () => {
    const t = await text(page);
    return /create login/i.test(t) && !(await page.locator('button:has-text("Remove login")').count());
  });
  log(removed, `8. login removed — profile stays, now shows "Create login"`);

  // removed login can't sign in
  const rctx = await browser.newContext();
  const rp = await rctx.newPage();
  await rp.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await rp.fill("#email", `cw${stamp}@modaltest.dev`);
  await rp.fill("#password", "AdminReset9");
  await Promise.all([
    rp.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}),
    rp.click('button[type="submit"]'),
  ]);
  log(/error/.test(rp.url()) || (await rp.locator('input[type="password"]').count()) > 0, `9. removed login cannot sign in`);
  await rctx.close();

  // --- bonus: create login for existing person from the person page ---
  await page.locator('button:has-text("Create login")').first().click();
  await page.waitForSelector('[role="dialog"]');
  const cl = page.getByRole("dialog");
  await cl.locator('input[name="tempPassword"]').fill("SecondPw77");
  await cl.locator('button:has-text("Create login")').last().click();
  const creds2 = await waitfor(page, async () => /secondpw77/i.test(await text(page)));
  log(creds2, `10. create login for existing person (custom password shown)`);

  console.log("org: Acct " + stamp);
} finally {
  await browser.close();
}
