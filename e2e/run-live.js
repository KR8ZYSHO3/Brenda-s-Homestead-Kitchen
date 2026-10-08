/**
 * Brenda's Homestead Kitchen — live end-to-end smoke suite
 *
 * Runs against GitHub Pages by default:
 *   node e2e/run-live.js
 *
 * Optional base URL:
 *   node e2e/run-live.js https://kr8zysho3.github.io/Brenda-s-Homestead-Kitchen
 *   node e2e/run-live.js http://localhost:5173
 *
 * Uses a fresh browser context (isolated localStorage) so Brenda's real
 * admin data on her machine is never touched.
 */
const { chromium } = require("playwright");

const BASE =
  (process.argv[2] || "https://kr8zysho3.github.io/Brenda-s-Homestead-Kitchen").replace(
    /\/$/,
    ""
  );

const results = [];
let passed = 0;
let failed = 0;

function ok(name, detail) {
  passed += 1;
  results.push({ status: "PASS", name, detail: detail || "" });
  console.log(`  PASS  ${name}${detail ? " — " + detail : ""}`);
}

function fail(name, detail) {
  failed += 1;
  results.push({ status: "FAIL", name, detail: detail || "" });
  console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    ok(name, typeof detail === "string" ? detail : "");
  } catch (err) {
    fail(name, err && err.message ? err.message : String(err));
  }
}

async function expectVisible(page, selector, label) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 12000 });
  if (!(await loc.isVisible())) throw new Error(`${label || selector} not visible`);
}

async function loginAdmin(page) {
  await page.goto(BASE + "/admin/", { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', "Brenda");
  await page.fill('input[name="password"]', "HomesteadKitchen");
  await page.click('#loginForm button[type="submit"]');
  await expectVisible(page, "#adminView", "admin shell");
  await expectVisible(page, "#dashNextTitle", "Do this next title");
}

async function openTab(page, tabId) {
  const inMore = ["learn", "howto"].includes(tabId);
  if (inMore) {
    const more = page.locator("#adminNavMore");
    if (!(await more.evaluate((el) => el.open))) {
      await page.click("#adminNavMore summary");
    }
  }
  await page.click(`#adminNav button[data-tab="${tabId}"]`);
  await expectVisible(page, `#tab-${tabId}.active`, `tab ${tabId}`);
}

(async () => {
  console.log(`\nBHK live E2E → ${BASE}\n`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  // ——— Public site ———
  await check("Home loads with farmhouse header + version stamp", async () => {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await expectVisible(page, ".site-header", "header");
    await expectVisible(page, ".hero-card", "hero");
    await expectVisible(page, "#siteVersion", "version pill");
    const ver = (await page.textContent("#siteVersion")) || "";
    if (!/v1\.5\.\d/.test(ver)) throw new Error("unexpected version: " + ver);
    const topBar = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".site-header"), "::before");
      return s.height;
    });
    if (topBar !== "4px") throw new Error("header brass rail height " + topBar);
    return ver.replace(/\s+/g, " ").trim();
  });

  await check("Products page lists cards", async () => {
    await page.goto(BASE + "/products.html", { waitUntil: "networkidle" });
    await expectVisible(page, ".product-grid", "product grid");
    const count = await page.locator(".product-card").count();
    if (count < 1) throw new Error("no product cards");
    return count + " cards";
  });

  await check("Order page loads (form or Google embed shell)", async () => {
    await page.goto(BASE + "/order.html", { waitUntil: "networkidle" });
    await expectVisible(page, "h1, .page-title, .order-layout", "order page");
    const hasBuiltIn = (await page.locator("#orderForm, form").count()) > 0;
    const hasGoogle = (await page.locator("iframe, #googleFormWrap, .google-form").count()) > 0;
    const hasCopy = (await page.locator("text=order").count()) > 0;
    if (!hasBuiltIn && !hasGoogle && !hasCopy) throw new Error("order page empty");
    return hasGoogle ? "google/embed path present" : "built-in or copy present";
  });

  await check("Labels + flyer print pages load", async () => {
    await page.goto(BASE + "/labels.html", { waitUntil: "networkidle" });
    await expectVisible(page, "body", "labels body");
    const labelsText = await page.locator("body").innerText();
    if (!/home produced|label/i.test(labelsText)) throw new Error("labels page missing cottage text");
    await page.goto(BASE + "/flyer.html", { waitUntil: "networkidle" });
    await expectVisible(page, "body", "flyer body");
    const flyerText = await page.locator("body").innerText();
    if (!/Homestead|McArthur|QR|order/i.test(flyerText)) throw new Error("flyer looks empty");
    return "labels + flyer ok";
  });

  // ——— Admin login + navigation ———
  await check("Admin login with default credentials", async () => {
    await loginAdmin(page);
    return "signed in";
  });

  await check("Main nav includes Taxes & expenses", async () => {
    const mainTaxes = await page.locator('#adminNav > button[data-tab="taxes"]').count();
    const moreTaxes = await page.locator('#adminNavMore button[data-tab="taxes"]').count();
    if (mainTaxes !== 1) throw new Error("taxes missing from Main");
    if (moreTaxes !== 0) throw new Error("taxes still under More");
    return "taxes on Main";
  });

  const mainTabs = [
    "dashboard",
    "goals",
    "foodcosts",
    "products",
    "orders",
    "taxes",
    "gform",
    "settings",
  ];
  for (const tab of mainTabs) {
    await check(`Main tab opens: ${tab}`, async () => {
      await openTab(page, tab);
      return "active";
    });
  }

  await check("More tabs open: learn + howto", async () => {
    await openTab(page, "learn");
    await openTab(page, "howto");
    const moreOpen = await page.locator("#adminNavMore").evaluate((el) => el.open);
    if (!moreOpen) throw new Error("More did not stay open");
    return "learn + howto";
  });

  await check("Home Shortcuts switch tabs", async () => {
    await openTab(page, "dashboard");
    await page.click('.dash-shortcuts button[data-goto-tab="products"]');
    await expectVisible(page, "#tab-products.active", "products via shortcut");
    await openTab(page, "dashboard");
    await page.click('.dash-shortcuts button[data-goto-tab="taxes"]');
    await expectVisible(page, "#tab-taxes.active", "taxes via shortcut");
    await openTab(page, "dashboard");
    await page.click('.dash-shortcuts button[data-goto-tab="foodcosts"]');
    await expectVisible(page, "#tab-foodcosts.active", "foodcosts via shortcut");
    return "products + taxes + foodcosts";
  });

  await check("Do this next card has a working action", async () => {
    await openTab(page, "dashboard");
    const title = ((await page.textContent("#dashNextTitle")) || "").trim();
    if (!title || title === "Loading…") throw new Error("next title empty");
    const btn = page.locator("#dashNextActions [data-goto-tab]").first();
    await btn.waitFor({ state: "visible" });
    const target = await btn.getAttribute("data-goto-tab");
    await btn.click();
    if (target) await expectVisible(page, `#tab-${target}.active`, "next target");
    return title.slice(0, 60);
  });

  // ——— Food costs practice ———
  await check("Food-cost practice: fill + check steps 1–4", async () => {
    await openTab(page, "foodcosts");
    await expectVisible(page, "#foodCostExercisePanel", "exercise panel");
    await page.click("#fcExFill1");
    await page.click("#fcExCheck1");
    await page.waitForSelector('.foodcost-ex-step[data-fc-step="2"]:not([hidden])', { timeout: 8000 });
    await page.click("#fcExFill2");
    await page.click("#fcExCheck2");
    await page.waitForSelector('.foodcost-ex-step[data-fc-step="3"]:not([hidden])', { timeout: 8000 });
    await page.fill("#fcExSell", "4.00");
    await page.click("#fcExCheck3");
    await page.waitForSelector('.foodcost-ex-step[data-fc-step="4"]:not([hidden])', { timeout: 8000 });
    await page.click("#fcExFinish");
    await page.waitForTimeout(250);
    return "practice finished";
  });

  await check("Food-cost calculator updates totals", async () => {
    await openTab(page, "foodcosts");
    await expectVisible(page, "#foodCostCalculatorPanel", "calculator");
    // Ensure at least one row; fill first cost inputs if present
    const nameInput = page.locator("#fcCalcRows input, #fcCalcRows [name='name']").first();
    const costInput = page.locator("#fcCalcRows input[type='number']").first();
    if (await costInput.count()) {
      await costInput.fill("4.50");
    }
    if (await page.locator("#fcCalcPackaging").count()) {
      await page.fill("#fcCalcPackaging", "0.50");
    }
    if (await page.locator("#fcCalcYield").count()) {
      await page.fill("#fcCalcYield", "12");
    }
    await page.waitForTimeout(200);
    const batch = ((await page.textContent("#fcCalcBatch")) || "").trim();
    if (!batch) throw new Error("batch total empty");
    return "batch " + batch;
  });

  // ——— Products CRUD ———
  await check("Add a real product and see it in the table", async () => {
    await openTab(page, "products");
    await page.click("#addProductBtn");
    await page.waitForSelector("#productModal.open", { timeout: 8000 });
    const form = page.locator("#productForm");
    const stamp = Date.now().toString().slice(-6);
    const name = `E2E Test Jam ${stamp}`;
    await form.locator('[name="name"]').fill(name);
    await form.locator('[name="category"]').selectOption("baked");
    await form.locator('[name="price"]').fill("6.50");
    await form.locator('[name="unit"]').fill("8 oz jar");
    await form.locator('[name="quantityOnHand"]').fill("8");
    await form.locator('[name="available"]').selectOption("true");
    await form.locator('[name="ingredients"]').fill("Strawberries, sugar, lemon juice");
    await form.locator('button[type="submit"]').click();
    await page.waitForSelector("#productModal.open", { state: "detached", timeout: 5000 }).catch(async () => {
      await page.waitForFunction(() => !document.getElementById("productModal").classList.contains("open"));
    });
    await page.waitForTimeout(300);
    const tableText = await page.locator("#productsTable").innerText();
    if (!tableText.includes(name)) throw new Error("new product not in table: " + name);
    return name;
  });

  // ——— Orders ———
  await check("Log a manual order", async () => {
    await openTab(page, "orders");
    await page.click("#manualOrderBtn");
    await page.waitForSelector("#orderModal.open", { timeout: 8000 });
    const form = page.locator("#manualOrderForm");
    const stamp = Date.now().toString().slice(-5);
    const customer = `E2E Neighbor ${stamp}`;
    await form.locator('[name="customerName"]').fill(customer);
    const select = form.locator("#manualProductSelect");
    await select.waitFor({ state: "visible" });
    const optionCount = await select.locator("option").count();
    if (optionCount < 1) throw new Error("no products available for manual order");
    // Prefer a non-empty value option
    const value = await select.locator("option").nth(optionCount > 1 ? 1 : 0).getAttribute("value");
    if (!value) {
      const firstVal = await select.locator("option").first().getAttribute("value");
      if (!firstVal) throw new Error("product select has empty values");
      await select.selectOption(firstVal);
    } else {
      await select.selectOption(value);
    }
    await form.locator('[name="qty"]').fill("1");
    await form.locator('[name="paymentMethod"]').selectOption("cash");
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => !document.getElementById("orderModal").classList.contains("open"));
    await page.waitForTimeout(300);
    const table = await page.locator("#ordersTable").innerText();
    if (!table.includes(customer)) throw new Error("manual order not listed: " + customer);
    return customer;
  });

  // ——— Taxes / expenses ———
  await check("Add an expense under Taxes", async () => {
    await openTab(page, "taxes");
    const form = page.locator("#expenseForm");
    await expectVisible(page, "#expenseForm", "expense form");
    const stamp = Date.now().toString().slice(-5);
    const label = `E2E jars ${stamp}`;
    const today = new Date().toISOString().slice(0, 10);
    await form.locator('[name="date"]').fill(today);
    await form.locator('[name="description"]').fill(label);
    await form.locator('[name="amount"]').fill("3.25");
    const cat = form.locator('[name="category"]');
    if (await cat.count()) {
      const opts = await cat.locator("option").count();
      if (opts > 1) await cat.selectOption({ index: 1 }).catch(() => {});
    }
    await form.locator('button[type="submit"]').click();
    await page.waitForTimeout(400);
    const table = await page.locator("#expensesTable").innerText();
    if (!table.includes(label)) throw new Error("expense not listed");
    return label;
  });

  // ——— Settings ———
  await check("Settings save a phone number", async () => {
    await openTab(page, "settings");
    const form = page.locator("#settingsForm");
    await expectVisible(page, "#settingsForm", "settings form");
    await form.locator('[name="phone"]').fill("740-555-0199");
    await form.locator('button[type="submit"]').click();
    await page.waitForTimeout(300);
    // Re-open / re-read
    await openTab(page, "dashboard");
    await openTab(page, "settings");
    const phone = await form.locator('[name="phone"]').inputValue();
    if (phone !== "740-555-0199") throw new Error("phone not persisted: " + phone);
    return phone;
  });

  await check("Goals walkthrough renders phases", async () => {
    await openTab(page, "goals");
    await expectVisible(page, "#goalsPhases", "goals phases");
    const text = await page.locator("#goalsPhases").innerText();
    if (!/Setup|Stock|Sell/i.test(text)) throw new Error("phases missing");
    const progress = ((await page.textContent("#goalsProgressLabel")) || "").trim();
    return progress || "phases ok";
  });

  await check("Logout returns to login", async () => {
    await page.click("#logoutBtn");
    await expectVisible(page, "#loginView", "login view");
    const adminHidden = await page.locator("#adminView").evaluate((el) => {
      return el.style.display === "none" || el.hasAttribute("hidden");
    });
    if (!adminHidden) throw new Error("admin still visible after logout");
    return "logged out";
  });

  await browser.close();

  console.log("\n────────────────────────────");
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log("────────────────────────────\n");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error("\nSuite crashed:", err);
  process.exit(2);
});
