/**
 * Brenda's Homestead Kitchen — shared data store (browser localStorage)
 * Products, orders, expenses, and settings live on this device/browser.
 */
(function (global) {
  const STORAGE_KEY = "bhk_store_v1";
  const SESSION_KEY = "bhk_admin_session";

  const DEFAULT_SETTINGS = {
    businessName: "Brenda's Homestead Kitchen",
    ownerName: "Brenda Shoemaker",
    city: "McArthur",
    state: "OH",
    zip: "45651",
    address: "",
    phone: "",
    email: "",
    venmo: "",
    cashapp: "",
    paypal: "",
    zelle: "",
    pickupNotes:
      "Local pickup in McArthur, Ohio. Payment by Venmo, Cash App, PayPal, Zelle, or cash at pickup. Ohio sales only.",
    tagline:
      "Brenda bakes Ohio cottage foods and pours handmade soap at home. Browse what’s ready, send a quick order, and pick up in town.",
    about:
      "Hi — I’m Brenda Shoemaker. Everything here is made in my kitchen in McArthur: labeled cottage foods and simple handmade soap bars, sold for local pickup.",
    adminUsername: "Brenda",
    adminPassword: "HomesteadKitchen",
    // Paste from Google Forms → Send → Embed / link. Editable anytime in Admin.
    googleFormEmbedUrl: "",
    googleFormEditUrl: "",
    googleFormResponsesUrl: "",
    useGoogleForm: true,
    // Shown on the homepage when filled — seasonal drop / this week's bake
    featuredTitle: "This week from the kitchen",
    featuredNote: "",
    // Manual goal checkoffs Brenda can tick on the Goals tab (offline / real-world steps)
    goalChecks: {},
  };

  /** Suggested starter questions for Brenda's Google Order Form */
  const GOOGLE_FORM_TEMPLATE = {
    title: "Brenda's Homestead Kitchen — Order Form",
    description:
      "Thanks for ordering! Local pickup in McArthur, Ohio. Cottage foods are labeled “This product is home produced.” Payment by Venmo, Cash App, PayPal, Zelle, or cash at pickup.",
    questions: [
      { type: "Short answer", title: "Your full name", required: true },
      { type: "Short answer", title: "Phone number", required: true },
      { type: "Short answer", title: "Email (optional)", required: false },
      {
        type: "Paragraph",
        title: "What would you like to order?",
        help: "List each item and quantity. Example: 1 dozen cinnamon cookies, 2 lavender soap bars",
        required: true,
      },
      {
        type: "Multiple choice",
        title: "Preferred payment method",
        options: ["Venmo", "Cash App", "PayPal", "Zelle", "Cash at pickup"],
        required: true,
      },
      {
        type: "Multiple choice",
        title: "Preferred pickup timing",
        options: ["This week", "Next week", "Flexible — Brenda will text me"],
        required: true,
      },
      { type: "Paragraph", title: "Notes for Brenda (allergies, questions, etc.)", required: false },
    ],
  };

  const CATEGORIES = [
    { id: "baked", label: "Baked goods & foods", short: "Foods" },
    { id: "soap", label: "Soap", short: "Soap" },
    { id: "bundle", label: "Gift boxes & bundles", short: "Bundle" },
    { id: "other", label: "Other", short: "Other" },
  ];

  const LIVE_SITE_URL = "https://kr8zysho3.github.io/Brenda-s-Homestead-Kitchen";

  /** Bump these when deploying so Brenda can confirm the live site updated */
  const SITE_VERSION = "1.6.5";
  const SITE_UPDATED_ISO = "2026-10-08T18:10:00-04:00";
  const SITE_UPDATED_LABEL = "Oct 8, 2026 · 6:10 PM ET";

  /**
   * Guided practice — strawberry jam priced by kitchen scale (ounces).
   * Brenda enters how many oz (or each) went into the batch; we check against answers.
   */
  const FOOD_COST_EXERCISE = {
    id: "strawberry_jam_practice_weight",
    title: "Practice batch — Strawberry jam (by weight)",
    blurb:
      "Use a kitchen scale in real life. Here, enter how much of each package went into the batch — mostly in ounces. Hints and Fill correct numbers are there if you get stuck.",
    unitLabel: "jars",
    lines: [
      {
        id: "berries",
        label: "Strawberries",
        hint: "$6.00 for a 32 oz (2 lb) box · scale said 24 oz went into the pot",
        packageCost: 6,
        packageSize: 32,
        unit: "oz",
        usedAnswer: 24,
        // 6 * (24/32) = 4.50
      },
      {
        id: "sugar",
        label: "Sugar",
        hint: "$3.00 for a 40 oz bag · scale said 16 oz of sugar went in",
        packageCost: 3,
        packageSize: 40,
        unit: "oz",
        usedAnswer: 16,
        // 3 * (16/40) = 1.20
      },
      {
        id: "pectin",
        label: "Pectin + lemon",
        hint: "$4.00 for a 10 oz pectin tin · you used 2 oz for this batch (lemon folded in)",
        packageCost: 4,
        packageSize: 10,
        unit: "oz",
        usedAnswer: 2,
        // 4 * (2/10) = 0.80
      },
      {
        id: "jars",
        label: "Jars + lids",
        hint: "$2.00 for a 6-pack · you used all 6 jars (count as “each,” not ounces)",
        packageCost: 2,
        packageSize: 6,
        unit: "each",
        usedAnswer: 6,
        // 2 * (6/6) = 2.00
      },
    ],
    batchTotal: 8.5,
    yieldAnswer: 6,
    perUnit: 1.4167,
    sellMinOk: 2.85,
    sellMaxOk: 5.5,
    moneyTolerance: 0.03,
    amountTolerance: 0.05,
  };

  const FOOD_COST_UNITS = [
    { value: "oz", label: "oz" },
    { value: "lb", label: "lb" },
    { value: "g", label: "g" },
    { value: "each", label: "each" },
  ];

  /** Line cost from weight: package$ × (used ÷ package size). Fraction mode kept as a shortcut. */
  function calcFoodCost(lines, yieldCount, packagingCost) {
    const rows = (lines || []).map((row) => {
      const name = String(row.name || "").trim();
      const packageCost = Math.max(0, Number(row.packageCost) || 0);
      const mode = row.mode === "fraction" ? "fraction" : "weight";
      const unit = String(row.unit || "oz");
      const packageSize = Math.max(0, Number(row.packageSize) || 0);
      const usedAmount = Math.max(0, Number(row.usedAmount) || 0);
      let fraction = Math.max(0, Number(row.fraction) || 0);
      let lineCost = 0;

      if (mode === "fraction") {
        lineCost = Math.round(packageCost * fraction * 100) / 100;
      } else if (packageSize > 0) {
        fraction = usedAmount / packageSize;
        lineCost = Math.round(packageCost * fraction * 100) / 100;
      }

      return {
        name,
        packageCost,
        packageSize,
        usedAmount,
        unit,
        fraction,
        mode,
        lineCost,
      };
    });
    const pack = Math.max(0, Number(packagingCost) || 0);
    const ingredientTotal = rows.reduce((sum, r) => sum + r.lineCost, 0);
    const batchCost = Math.round((ingredientTotal + pack) * 100) / 100;
    const yieldSafe = Math.max(0, Number(yieldCount) || 0);
    const perUnit =
      yieldSafe > 0 ? Math.round((batchCost / yieldSafe) * 100) / 100 : 0;
    return {
      rows,
      packagingCost: pack,
      batchCost,
      yield: yieldSafe,
      perUnit,
      suggest2x: Math.round(perUnit * 2 * 100) / 100,
      suggest25x: Math.round(perUnit * 2.5 * 100) / 100,
      suggest3x: Math.round(perUnit * 3 * 100) / 100,
    };
  }

  function lineCostFromWeight(packageCost, packageSize, usedAmount) {
    const size = Math.max(0, Number(packageSize) || 0);
    if (!(size > 0)) return 0;
    return (
      Math.round(
        Math.max(0, Number(packageCost) || 0) *
          (Math.max(0, Number(usedAmount) || 0) / size) *
          100
      ) / 100
    );
  }

  function moneyClose(a, b, tolerance) {
    const tol = tolerance == null ? 0.03 : Number(tolerance);
    return Math.abs(Number(a) - Number(b)) <= tol;
  }

  const SAMPLE_PRODUCTS = [
    {
      id: "p_sample_1",
      name: "Cinnamon Sugar Cookies",
      category: "baked",
      description: "Soft, buttery cookies rolled in cinnamon sugar. Perfect with coffee.",
      price: 8,
      unit: "dozen",
      quantityOnHand: 6,
      available: true,
      ingredients: "Flour, butter, sugar, eggs, cinnamon, vanilla, salt",
      allergens: "Wheat, eggs, milk",
      image: "",
      createdAt: Date.now(),
    },
    {
      id: "p_sample_2",
      name: "Strawberry Jam",
      category: "baked",
      description: "Sweet homemade jam from ripe strawberries. Great on toast or biscuits.",
      price: 7,
      unit: "8 oz jar",
      quantityOnHand: 10,
      available: true,
      ingredients: "Strawberries, sugar, lemon juice, pectin",
      allergens: "None",
      image: "",
      createdAt: Date.now(),
    },
    {
      id: "p_sample_3",
      name: "Chocolate Chip Banana Bread",
      category: "baked",
      description: "Moist banana bread studded with chocolate chips.",
      price: 12,
      unit: "loaf",
      quantityOnHand: 4,
      available: true,
      ingredients: "Bananas, flour, sugar, eggs, butter, chocolate chips, baking soda, salt",
      allergens: "Wheat, eggs, milk, soy",
      image: "",
      createdAt: Date.now(),
    },
    {
      id: "p_sample_soap_1",
      name: "Lavender Garden Soap",
      category: "soap",
      description: "Gentle handmade bar soap with a soft lavender scent. Made for everyday washing.",
      price: 6,
      unit: "bar",
      quantityOnHand: 12,
      available: true,
      ingredients: "Olive oil, coconut oil, palm oil, sodium hydroxide (lye), water, lavender essential oil",
      allergens: "None listed — ask if you have fragrance sensitivities",
      image: "",
      createdAt: Date.now(),
    },
    {
      id: "p_sample_soap_2",
      name: "Honey Oatmeal Soap",
      category: "soap",
      description: "Creamy handmade soap with oatmeal. A cozy everyday cleanser.",
      price: 6.5,
      unit: "bar",
      quantityOnHand: 10,
      available: true,
      ingredients: "Olive oil, coconut oil, shea butter, sodium hydroxide (lye), water, honey, oatmeal",
      allergens: "Contains oatmeal — ask about sensitivities",
      image: "",
      createdAt: Date.now(),
    },
  ];

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function normalizeCategory(value) {
    const id = String(value || "").toLowerCase();
    if (id === "soap" || id === "baked" || id === "bundle" || id === "other") return id;
    return "baked";
  }

  /** Sample / demo products seeded with the site — not counted as Brenda's real catalog */
  function isSampleProduct(product) {
    const id = String((product && product.id) || "");
    return id.indexOf("p_sample_") === 0;
  }

  function realAvailableProducts() {
    return (load().products || []).filter((p) => p.available && !isSampleProduct(p));
  }

  function isGoalChecked(id) {
    const checks = (load().settings && load().settings.goalChecks) || {};
    return !!checks[id];
  }

  function setGoalChecked(id, done) {
    const data = load();
    const checks = { ...(data.settings.goalChecks || {}) };
    if (done) checks[id] = true;
    else delete checks[id];
    data.settings.goalChecks = checks;
    save(data);
    return checks;
  }

  /**
   * Phased business goals for Brenda — auto steps detect site data;
   * manual steps are real-world checkoffs she ticks herself.
   * Used by Admin dashboard summary + Goals walkthrough tab.
   */
  function getBusinessGoals() {
    const s = load().settings;
    const orders = load().orders || [];
    const expenses = load().expenses || [];
    const realProducts = realAvailableProducts();
    const withPhoto = realProducts.filter((p) => p.image);
    const sampleStillListed = (load().products || []).some(
      (p) => isSampleProduct(p) && p.available
    );
    const defaultPassword = s.adminPassword === "HomesteadKitchen";
    const hasPay = !!(s.venmo || s.cashapp || s.paypal || s.zelle);
    const hasForm = hasGoogleFormConfigured();
    const hasAddress = !!(s.address && String(s.address).trim());
    const hasContact = !!(s.phone || s.email);
    const hasFeatured = !!(s.featuredNote && String(s.featuredNote).trim());
    const hasCompletedOrder = orders.some((o) => o.status === "completed" || o.status === "paid");
    const hasAnyOrder = orders.length > 0;
    const hasExpense = expenses.length > 0;

    function auto(id, done, label, why, tab, href) {
      return {
        id,
        done: !!done,
        label,
        why,
        tab: tab || "",
        href: href || "",
        kind: "auto",
      };
    }
    function manual(id, label, why, tab, href) {
      return {
        id,
        done: isGoalChecked(id),
        label,
        why,
        tab: tab || "",
        href: href || "",
        kind: "manual",
      };
    }

    const foodCostLessonKeys = [
      "fc_know_batch",
      "fc_know_unit",
      "fc_know_price",
      "fc_know_track",
    ];
    const foodCostUnderstood = foodCostLessonKeys.every((key) => isGoalChecked(key));
    const foodCostExerciseDone = isGoalChecked("fc_exercise_done");
    const foodCostPricedOne = isGoalChecked("fc_priced_one");

    const phases = [
      {
        id: "setup",
        title: "Setup",
        blurb: "Get the kitchen ready so customers can reach you and pay you.",
        items: [
          auto(
            "password",
            !defaultPassword,
            "Change the default admin password",
            "The starter password is public in the login tip. Change it so only you can edit products and orders.",
            "settings"
          ),
          auto(
            "address",
            hasAddress,
            "Add your street address for cottage-food labels",
            "Ohio cottage-food labels need your name and home address. Fill this once in Settings, then print labels.",
            "settings"
          ),
          auto(
            "contact",
            hasContact,
            "Add a phone or email customers can reach",
            "Shoppers need a way to ask about pickup or allergies. Phone is usually best for McArthur locals.",
            "settings"
          ),
          auto(
            "pay",
            hasPay,
            "Add at least one payment handle (Venmo / Cash App / etc.)",
            "Handles show on the order page so people know where to send money before pickup.",
            "settings"
          ),
          auto(
            "gform",
            hasForm,
            "Connect the Google Order Form",
            "Orders land in your Gmail/Sheets. Paste the form link under Google Order Form when it’s ready.",
            "gform"
          ),
        ],
      },
      {
        id: "stock",
        title: "Stock",
        blurb: "Put your real foods and soaps on the site — samples don’t count.",
        items: [
          auto(
            "products",
            realProducts.length >= 3,
            "List at least 3 real products for sale",
            "Demo cookies and soap are only examples. Add your own items (or edit samples into real ones) so the shop shows what you actually bake and craft.",
            "products"
          ),
          auto(
            "photos",
            withPhoto.length >= 1,
            "Add a photo to at least one real product",
            "A clear phone photo of the finished product sells better than a blank card. Natural light near a window works well.",
            "products"
          ),
          auto(
            "featured",
            hasFeatured,
            "Write a “this week” kitchen note for the homepage",
            "Tell neighbors what’s fresh right now — jam jars, a soap restock, Saturday pickup. Update it when the batch changes.",
            "settings"
          ),
          manual(
            "hide_samples",
            "Hide or delete sample products once your real ones are listed",
            "Until you replace them, shoppers may think the demo items are for sale. In Products, hide or delete each sample.",
            "products"
          ),
          auto(
            "understand_food_costs",
            foodCostUnderstood,
            "Learn food costs and check that you understand",
            "Before you set prices, know what a batch costs you. Open Food costs, read the example, and check each “I understand” box.",
            "foodcosts"
          ),
          auto(
            "food_cost_exercise",
            foodCostExerciseDone,
            "Complete the food cost practice (weigh the jam batch)",
            "On Food costs, enter how many ounces (or jars) went into the pretend strawberry jam, check jars made, and pick a selling price. Checking your answers marks this done.",
            "foodcosts"
          ),
          auto(
            "food_cost_price_one",
            foodCostPricedOne,
            "Price one real product with the calculator",
            "Use “Price your own recipe” on Food costs (by weight is best), then apply a suggested price. Do this for each item you sell over time.",
            "foodcosts"
          ),
        ],
      },
      {
        id: "sell",
        title: "Sell",
        blurb: "Get your name and link in front of local people.",
        items: [
          manual(
            "print_labels",
            "Print cottage-food labels with your address",
            "Every food package needs the required wording and your contact info. Use the Print food labels page.",
            "",
            "../labels.html"
          ),
          manual(
            "print_flyer",
            "Print a market flyer (with QR to your site)",
            "Tape one at the farmers market table, church board, or café. The flyer includes a QR code to your live site.",
            "",
            "../flyer.html"
          ),
          manual(
            "share_link",
            "Text or email your site link to 5 local people",
            "Friends, family, and coworkers are the easiest first customers. Ask them to share with one more person each.",
            ""
          ),
          manual(
            "post_once",
            "Post once in a local Facebook / community group",
            "Keep it simple: what you make, that it’s Ohio cottage food / handmade soap, pickup in McArthur, and your site link.",
            ""
          ),
        ],
      },
      {
        id: "grow",
        title: "Grow",
        blurb: "Turn first sales into a steady habit.",
        items: [
          auto(
            "first_order",
            hasAnyOrder,
            "Log your first sale (website, phone, or market)",
            "Use Orders for market and phone sales so stock and tax totals stay accurate. Website orders appear when the form is connected.",
            "orders"
          ),
          auto(
            "first_paid",
            hasCompletedOrder,
            "Mark at least one order paid / completed",
            "When Venmo or cash lands, mark the order paid. That keeps your year-to-date sales ready for taxes.",
            "orders"
          ),
          manual(
            "weekly_featured",
            "Update the homepage “this week” note after each new batch",
            "A stale note makes the site feel closed. Fresh wording tells regulars there’s something new.",
            "settings"
          ),
          manual(
            "ask_referral",
            "Ask one happy customer to tell a neighbor",
            "Word of mouth in a small town beats ads. A simple “If you liked it, send a friend my way” works.",
            "goals"
          ),
        ],
      },
      {
        id: "tidy",
        title: "Tidy",
        blurb: "Stay organized so tax time and busy weeks stay calm.",
        items: [
          auto(
            "log_expense",
            hasExpense,
            "Log at least one supply expense",
            "Flour, jars, oils, market fees — capture them under Taxes & expenses so Schedule C numbers are easier later.",
            "taxes"
          ),
          manual(
            "backup_once",
            "Download a backup after you add real products",
            "Admin data lives in this browser. A backup file protects you if the phone clears storage or you switch devices.",
            "settings"
          ),
          manual(
            "read_learn",
            "Read the Learn rules tab once (foods + soap)",
            "Know what Ohio allows for cottage foods, what labels need, and that soap follows different rules than baked goods.",
            "learn"
          ),
          manual(
            "backup_habit",
            "Download a backup after every busy market weekend",
            "Make it a habit: close the market table → open Admin → Download backup. Takes under a minute.",
            "settings"
          ),
        ],
      },
    ];

    // Special: hide_samples auto-completes if no available samples remain
    phases.forEach((phase) => {
      phase.items.forEach((item) => {
        if (item.id === "hide_samples" && !sampleStillListed) {
          item.done = true;
          item.kind = "auto";
        }
      });
    });

    const allItems = phases.reduce((acc, p) => acc.concat(p.items), []);
    const doneCount = allItems.filter((i) => i.done).length;
    const nextItem = allItems.find((i) => !i.done) || null;
    const setupDone = phases[0].items.every((i) => i.done);
    const stockDone = phases[1].items.every((i) => i.done);

    return {
      phases,
      items: allItems,
      doneCount,
      totalCount: allItems.length,
      nextItem,
      setupDone,
      stockDone,
      launchReady: setupDone && stockDone,
    };
  }

  /** Flat checklist for older dashboard callers — same steps, no phase grouping */
  function getLaunchChecklist() {
    return getBusinessGoals().items.map((item) => ({
      id: item.id,
      done: item.done,
      label: item.label,
      tab: item.tab || "goals",
      kind: item.kind,
      why: item.why,
      href: item.href || "",
    }));
  }

  function categoryLabel(id) {
    const found = CATEGORIES.find((c) => c.id === normalizeCategory(id));
    return found ? found.label : "Baked goods & foods";
  }

  function categoryShort(id) {
    const found = CATEGORIES.find((c) => c.id === normalizeCategory(id));
    return found ? found.short : "Foods";
  }

  function normalizeProduct(product) {
    return {
      ...product,
      category: normalizeCategory(product && product.category),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = {
          settings: { ...DEFAULT_SETTINGS },
          products: SAMPLE_PRODUCTS.map((p) => ({ ...p })),
          orders: [],
          expenses: [],
          recipes: [],
        };
        save(fresh);
        return fresh;
      }
      const data = JSON.parse(raw);
      data.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      data.products = (Array.isArray(data.products) ? data.products : []).map(normalizeProduct);
      data.orders = Array.isArray(data.orders) ? data.orders : [];
      data.expenses = Array.isArray(data.expenses) ? data.expenses : [];
      data.recipes = (Array.isArray(data.recipes) ? data.recipes : []).map(normalizeRecipe);
      // Refresh stock marketing copy when Brenda still has the old defaults
      let marketingDirty = false;
      const legacyTaglines = [
        "Homemade cottage foods and handcrafted soaps from McArthur, Ohio",
        "Homemade cottage foods and handcrafted soaps — baked, jarred, and poured with quiet care in the hills of southeastern Ohio.",
      ];
      const legacyAbouts = [
        "Hello! I'm Brenda Shoemaker. I bake approved Ohio cottage foods and craft handmade soaps right here at home in McArthur.",
        "Hello! I'm Brenda Shoemaker. I bake approved Ohio cottage foods and craft handmade soaps right here at home in McArthur. Every batch is made with care — foods are labeled the Ohio way: This product is home produced.",
      ];
      if (legacyTaglines.indexOf(String(data.settings.tagline || "")) !== -1) {
        data.settings.tagline = DEFAULT_SETTINGS.tagline;
        marketingDirty = true;
      }
      if (legacyAbouts.indexOf(String(data.settings.about || "")) !== -1) {
        data.settings.about = DEFAULT_SETTINGS.about;
        marketingDirty = true;
      }
      if (marketingDirty) save(data);
      return data;
    } catch (err) {
      console.error("Store load failed", err);
      return {
        settings: { ...DEFAULT_SETTINGS },
        products: [],
        orders: [],
        expenses: [],
        recipes: [],
      };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getStore() {
    return load();
  }

  function updateSettings(patch) {
    const data = load();
    data.settings = { ...data.settings, ...patch };
    save(data);
    return data.settings;
  }

  /**
   * Normalize a pasted Google Forms link into an embeddable URL.
   * Accepts viewform, formResponse, or /d/e/... links.
   */
  function toGoogleFormEmbedUrl(raw) {
    const input = String(raw || "").trim();
    if (!input) return "";
    try {
      const url = new URL(input);
      if (!/docs\.google\.com$/i.test(url.hostname) && !/forms\.gle$/i.test(url.hostname)) {
        return input;
      }
      // forms.gle short links cannot be embedded until expanded; keep as-is for Brenda to replace
      if (/forms\.gle$/i.test(url.hostname)) return input;

      let path = url.pathname;
      // /forms/d/e/FORM_ID/viewform or formResponse
      if (/\/forms\/d\/e\/[^/]+/i.test(path)) {
        path = path.replace(/\/(viewform|formResponse|edit).*$/i, "/viewform");
        return `https://docs.google.com${path}?embedded=true`;
      }
      // Sometimes people paste the edit URL /forms/d/ID/edit — cannot embed edit page
      if (/\/forms\/d\/[^/]+\/edit/i.test(path)) {
        return input;
      }
      if (path.includes("/viewform")) {
        url.searchParams.set("embedded", "true");
        return url.toString();
      }
      return input;
    } catch (err) {
      return input;
    }
  }

  function toGoogleFormViewUrl(embedOrView) {
    const embed = toGoogleFormEmbedUrl(embedOrView) || String(embedOrView || "").trim();
    if (!embed) return "";
    return embed.replace("?embedded=true", "").replace("&embedded=true", "");
  }

  function hasGoogleFormConfigured() {
    const s = load().settings;
    return !!(s.useGoogleForm && String(s.googleFormEmbedUrl || "").trim());
  }

  function listProducts(opts) {
    const data = load();
    let list = data.products.slice().sort((a, b) => {
      const cat = categoryShort(a.category).localeCompare(categoryShort(b.category));
      if (cat !== 0) return cat;
      return (a.name || "").localeCompare(b.name || "");
    });
    if (opts && opts.availableOnly) {
      list = list.filter((p) => p.available && Number(p.quantityOnHand) > 0);
    }
    if (opts && opts.category && opts.category !== "all") {
      list = list.filter((p) => normalizeCategory(p.category) === opts.category);
    }
    return list;
  }

  function getProduct(id) {
    return load().products.find((p) => p.id === id) || null;
  }

  function upsertProduct(product) {
    const data = load();
    const next = normalizeProduct({
      ...product,
      category: normalizeCategory(product.category),
    });
    if (!next.id) {
      next.id = uid("p");
      next.createdAt = Date.now();
      data.products.push(next);
    } else {
      const idx = data.products.findIndex((p) => p.id === next.id);
      if (idx >= 0) data.products[idx] = { ...data.products[idx], ...next };
      else data.products.push(next);
    }
    save(data);
    return next;
  }

  /** Seed sample soaps into an existing store that only has food samples. */
  function ensureSoapSamples() {
    const data = load();
    const hasSoap = data.products.some((p) => normalizeCategory(p.category) === "soap");
    if (hasSoap) return false;
    const soapSamples = SAMPLE_PRODUCTS.filter((p) => p.category === "soap").map((p) => ({
      ...p,
      id: uid("p"),
      createdAt: Date.now(),
    }));
    data.products = data.products.concat(soapSamples);
    save(data);
    return true;
  }

  function deleteProduct(id) {
    const data = load();
    data.products = data.products.filter((p) => p.id !== id);
    save(data);
  }

  function listOrders() {
    return load()
      .orders.slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function getOrder(id) {
    return load().orders.find((o) => o.id === id) || null;
  }

  function createOrder(orderInput) {
    const data = load();
    const items = (orderInput.items || []).map((item) => {
      const product = data.products.find((p) => p.id === item.productId);
      const name = product ? product.name : item.name || "Item";
      const price = product ? Number(product.price) : Number(item.price) || 0;
      const qty = Math.max(1, Number(item.qty) || 1);
      return {
        productId: item.productId || "",
        name,
        qty,
        price,
        lineTotal: Math.round(price * qty * 100) / 100,
      };
    });

    if (!items.length) throw new Error("Add at least one item to the order.");

    // Reduce stock for known products
    items.forEach((item) => {
      if (!item.productId) return;
      const product = data.products.find((p) => p.id === item.productId);
      if (product) {
        product.quantityOnHand = Math.max(0, Number(product.quantityOnHand || 0) - item.qty);
      }
    });

    const total = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
    const order = {
      id: uid("o"),
      createdAt: Date.now(),
      customerName: (orderInput.customerName || "").trim(),
      customerPhone: (orderInput.customerPhone || "").trim(),
      customerEmail: (orderInput.customerEmail || "").trim(),
      notes: (orderInput.notes || "").trim(),
      paymentMethod: orderInput.paymentMethod || "venmo",
      paymentReceived: !!orderInput.paymentReceived,
      status: orderInput.status || "new",
      items,
      total,
      source: orderInput.source || "website",
    };

    data.orders.unshift(order);
    save(data);
    return order;
  }

  function updateOrder(id, patch) {
    const data = load();
    const idx = data.orders.findIndex((o) => o.id === id);
    if (idx < 0) return null;
    data.orders[idx] = { ...data.orders[idx], ...patch, id };
    save(data);
    return data.orders[idx];
  }

  function deleteOrder(id) {
    const data = load();
    data.orders = data.orders.filter((o) => o.id !== id);
    save(data);
  }

  function listExpenses() {
    return load()
      .expenses.slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  function addExpense(expense) {
    const data = load();
    const row = {
      id: uid("e"),
      date: expense.date || new Date().toISOString().slice(0, 10),
      category: expense.category || "Supplies",
      description: (expense.description || "").trim(),
      amount: Math.round(Number(expense.amount || 0) * 100) / 100,
    };
    data.expenses.unshift(row);
    save(data);
    return row;
  }

  function deleteExpense(id) {
    const data = load();
    data.expenses = data.expenses.filter((e) => e.id !== id);
    save(data);
  }

  function normalizeRecipe(recipe) {
    const r = recipe || {};
    const mode = r.mode === "fraction" ? "fraction" : "weight";
    const lines = (Array.isArray(r.lines) ? r.lines : []).map((line) => ({
      name: String((line && line.name) || "").trim(),
      packageCost: Math.max(0, Number(line && line.packageCost) || 0),
      packageSize: Math.max(0, Number(line && line.packageSize) || 0),
      usedAmount: Math.max(0, Number(line && line.usedAmount) || 0),
      unit: String((line && line.unit) || "oz"),
      fraction: Math.max(0, Number(line && line.fraction) || 0),
      mode,
    }));
    const packaging = Math.max(0, Number(r.packaging) || 0);
    const yieldCount = Math.max(0, Number(r.yield) || 0);
    const priced = calcFoodCost(lines, yieldCount, packaging);
    return {
      id: r.id || uid("recipe"),
      name: String(r.name || "").trim() || "Untitled recipe",
      mode,
      lines,
      packaging,
      yield: yieldCount,
      productId: r.productId ? String(r.productId) : "",
      multiplier: [2, 2.5, 3].indexOf(Number(r.multiplier)) >= 0 ? Number(r.multiplier) : 2.5,
      notes: String(r.notes || "").trim(),
      batchCost: priced.batchCost,
      perUnit: priced.perUnit,
      createdAt: r.createdAt || Date.now(),
      updatedAt: r.updatedAt || Date.now(),
    };
  }

  function listRecipes() {
    return load()
      .recipes.slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function getRecipe(id) {
    return listRecipes().find((r) => r.id === id) || null;
  }

  function upsertRecipe(recipe) {
    const data = load();
    if (!Array.isArray(data.recipes)) data.recipes = [];
    const normalized = normalizeRecipe({
      ...recipe,
      updatedAt: Date.now(),
      createdAt: recipe && recipe.createdAt ? recipe.createdAt : Date.now(),
    });
    const idx = data.recipes.findIndex((r) => r.id === normalized.id);
    if (idx >= 0) {
      normalized.createdAt = data.recipes[idx].createdAt || normalized.createdAt;
      data.recipes[idx] = normalized;
    } else {
      data.recipes.unshift(normalized);
    }
    save(data);
    return normalized;
  }

  function deleteRecipe(id) {
    const data = load();
    data.recipes = (data.recipes || []).filter((r) => r.id !== id);
    save(data);
  }

  function taxSummary(year) {
    const y = String(year || new Date().getFullYear());
    const orders = listOrders().filter((o) => {
      const d = new Date(o.createdAt);
      return String(d.getFullYear()) === y && o.status !== "cancelled";
    });
    const expenses = listExpenses().filter((e) => String(e.date || "").startsWith(y));
    const revenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const paidRevenue = orders
      .filter((o) => o.paymentReceived)
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    return {
      year: y,
      orderCount: orders.length,
      revenue: Math.round(revenue * 100) / 100,
      paidRevenue: Math.round(paidRevenue * 100) / 100,
      expenses: Math.round(expenseTotal * 100) / 100,
      estimatedProfit: Math.round((revenue - expenseTotal) * 100) / 100,
      orders,
      expenseRows: expenses,
    };
  }

  function exportCsv(rows, filename) {
    if (!rows.length) {
      alert("Nothing to export yet.");
      return;
    }
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v == null ? "" : v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = [headers.join(",")]
      .concat(rows.map((r) => headers.map((h) => escape(r[h])).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function money(n) {
    return "$" + (Number(n) || 0).toFixed(2);
  }

  function formatDate(ts) {
    const d = typeof ts === "number" ? new Date(ts) : new Date(ts || Date.now());
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function isAdminLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  }

  function login(username, password) {
    const { settings } = load();
    const ok =
      username.trim() === settings.adminUsername &&
      password === settings.adminPassword;
    if (ok) sessionStorage.setItem(SESSION_KEY, "1");
    return ok;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function exportBackup() {
    const data = load();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brendas-homestead-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== "object") throw new Error("Invalid file");
          save({
            settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
            products: Array.isArray(data.products) ? data.products : [],
            orders: Array.isArray(data.orders) ? data.orders : [],
            expenses: Array.isArray(data.expenses) ? data.expenses : [],
            recipes: (Array.isArray(data.recipes) ? data.recipes : []).map(normalizeRecipe),
          });
          resolve(true);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  global.BHK = {
    getStore,
    updateSettings,
    listProducts,
    getProduct,
    upsertProduct,
    deleteProduct,
    ensureSoapSamples,
    listOrders,
    getOrder,
    createOrder,
    updateOrder,
    deleteOrder,
    listExpenses,
    addExpense,
    deleteExpense,
    taxSummary,
    exportCsv,
    money,
    formatDate,
    isAdminLoggedIn,
    login,
    logout,
    exportBackup,
    importBackup,
    normalizeCategory,
    categoryLabel,
    categoryShort,
    CATEGORIES,
    GOOGLE_FORM_TEMPLATE,
    toGoogleFormEmbedUrl,
    toGoogleFormViewUrl,
    hasGoogleFormConfigured,
    getLaunchChecklist,
    getBusinessGoals,
    isSampleProduct,
    setGoalChecked,
    isGoalChecked,
    FOOD_COST_EXERCISE,
    FOOD_COST_UNITS,
    calcFoodCost,
    lineCostFromWeight,
    listRecipes,
    getRecipe,
    upsertRecipe,
    deleteRecipe,
    moneyClose,
    LIVE_SITE_URL,
    SITE_VERSION,
    SITE_UPDATED_ISO,
    SITE_UPDATED_LABEL,
    DEFAULT_SETTINGS,
  };

  function mountSiteVersion() {
    if (document.getElementById("siteVersion")) return;
    const el = document.createElement("div");
    el.id = "siteVersion";
    el.className = "site-version";
    el.setAttribute("aria-label", "Site version");
    el.innerHTML =
      '<span class="site-version-num">v' +
      SITE_VERSION +
      '</span><span class="site-version-time">' +
      SITE_UPDATED_LABEL +
      "</span>";
    document.body.appendChild(el);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSiteVersion);
  } else {
    mountSiteVersion();
  }
})(window);
