(function () {
  const loginView = document.getElementById("loginView");
  const adminView = document.getElementById("adminView");

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showApp() {
    loginView.style.display = "none";
    loginView.setAttribute("hidden", "");
    loginView.style.pointerEvents = "none";
    adminView.style.display = "grid";
    adminView.removeAttribute("hidden");
    adminView.style.pointerEvents = "auto";
    refreshAll();
  }

  function showLogin() {
    adminView.style.display = "none";
    adminView.setAttribute("hidden", "");
    loginView.style.display = "grid";
    loginView.removeAttribute("hidden");
    loginView.style.pointerEvents = "auto";
  }

  function activateTab(tabId) {
    if (!tabId) return;
    const panel = document.getElementById("tab-" + tabId);
    if (!panel) return;
    document.querySelectorAll("#adminNav button[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
      b.setAttribute("aria-selected", b.dataset.tab === tabId ? "true" : "false");
    });
    document.querySelectorAll(".tabs-hidden").forEach((t) => t.classList.remove("active"));
    panel.classList.add("active");
    try {
      panel.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch (_) {
      /* ignore */
    }
  }

  if (BHK.isAdminLoggedIn()) showApp();
  else showLogin();

  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (BHK.login(fd.get("username"), fd.get("password"))) {
      showApp();
    } else {
      alert("That username or password is not right. Default is Brenda / HomesteadKitchen unless you changed it.");
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    BHK.logout();
    showLogin();
  });

  // Tabs — bind each button directly so clicks never miss
  const adminNav = document.getElementById("adminNav");
  adminNav.querySelectorAll("button[data-tab]").forEach((btn) => {
    btn.setAttribute("type", "button");
    btn.setAttribute("role", "tab");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      activateTab(btn.dataset.tab);
    });
  });
  adminNav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    e.preventDefault();
    activateTab(btn.dataset.tab);
  });

  // Modal close
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.close).classList.remove("open");
    });
  });

  let adminProductFilter = "all";

  function refreshAll() {
    BHK.ensureSoapSamples();
    renderDashboard();
    renderGoals();
    renderProducts();
    renderOrders();
    renderTaxes();
    fillSettings();
    fillGoogleFormSettings();
    fillManualProducts();
  }

  function fillGoogleFormSettings() {
    const s = BHK.getStore().settings;
    const form = document.getElementById("googleFormSettings");
    if (!form) return;
    form.useGoogleForm.value = s.useGoogleForm === false ? "false" : "true";
    form.googleFormEmbedUrl.value = s.googleFormEmbedUrl || "";
    form.googleFormEditUrl.value = s.googleFormEditUrl || "";
    form.googleFormResponsesUrl.value = s.googleFormResponsesUrl || "";

    const tpl = BHK.GOOGLE_FORM_TEMPLATE;
    document.getElementById("gformTemplateTitle").textContent =
      'Form title: "' + tpl.title + '" — ' + tpl.description;
    document.getElementById("gformTemplateList").innerHTML = tpl.questions
      .map((q) => {
        const req = q.required ? " (required)" : " (optional)";
        const opts = q.options ? `<br /><span class="muted">Choices: ${q.options.join(", ")}</span>` : "";
        const help = q.help ? `<br /><span class="muted">${escapeHtml(q.help)}</span>` : "";
        return `<li><span class="q-type">${escapeHtml(q.type)}</span><strong>${escapeHtml(q.title)}</strong>${req}${help}${opts}</li>`;
      })
      .join("");

    const embed = BHK.toGoogleFormEmbedUrl(s.googleFormEmbedUrl);
    const canEmbed = !!embed && !/\/forms\/d\/[^/]+\/edit/i.test(embed) && !/forms\.gle/i.test(embed);
    const empty = document.getElementById("gformPreviewEmpty");
    const wrap = document.getElementById("gformPreviewWrap");
    const frame = document.getElementById("gformPreviewFrame");
    const editBtn = document.getElementById("openFormEditorBtn");

    if (s.googleFormEditUrl) {
      editBtn.href = s.googleFormEditUrl;
      editBtn.style.display = "inline-flex";
    } else {
      editBtn.style.display = "none";
    }

    if (canEmbed && s.useGoogleForm !== false) {
      empty.style.display = "none";
      wrap.style.display = "block";
      if (frame.src !== embed) frame.src = embed;
    } else if (embed && /forms\.gle/i.test(embed)) {
      empty.style.display = "block";
      empty.className = "notice notice-warn";
      empty.innerHTML =
        "You pasted a short <strong>forms.gle</strong> link. Open it in a browser, copy the full <strong>docs.google.com/forms/...</strong> address from the address bar, and paste that instead so it can embed.";
      wrap.style.display = "none";
    } else if (embed && /\/edit/i.test(embed)) {
      empty.style.display = "block";
      empty.className = "notice notice-warn";
      empty.innerHTML =
        "That looks like the <strong>edit</strong> link. Keep it in the Edit field. For the embed field, paste the public <strong>Send → Link</strong> (viewform) URL.";
      wrap.style.display = "none";
    } else {
      empty.style.display = "block";
      empty.className = "notice notice-warn";
      empty.textContent =
        "No Google Form link saved yet. Create the form with the question list above, paste the link, and click Save — the embed will appear here and on the public Order page.";
      wrap.style.display = "none";
      frame.src = "about:blank";
    }
  }

  document.getElementById("googleFormSettings").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const rawEmbed = form.googleFormEmbedUrl.value.trim();
    // If they pasted an iframe snippet, pull src="..."
    let embedInput = rawEmbed;
    const srcMatch = rawEmbed.match(/src=["']([^"']+)["']/i);
    if (srcMatch) embedInput = srcMatch[1];

    const normalized = BHK.toGoogleFormEmbedUrl(embedInput);
    BHK.updateSettings({
      useGoogleForm: form.useGoogleForm.value === "true",
      googleFormEmbedUrl: normalized || embedInput,
      googleFormEditUrl: form.googleFormEditUrl.value.trim(),
      googleFormResponsesUrl: form.googleFormResponsesUrl.value.trim(),
    });
    form.googleFormEmbedUrl.value = normalized || embedInput;
    const notice = document.getElementById("gformSaveNotice");
    notice.style.display = "block";
    setTimeout(() => {
      notice.style.display = "none";
    }, 3500);
    fillGoogleFormSettings();
  });

  function syncProductFieldHints(category) {
    const cat = BHK.normalizeCategory(category);
    const unit = document.getElementById("productUnit");
    const ingredients = document.getElementById("productIngredients");
    const allergens = document.getElementById("productAllergens");
    const ingredientsLabel = document.getElementById("ingredientsLabelText");
    const allergensLabel = document.getElementById("allergensLabelText");
    if (cat === "soap") {
      unit.placeholder = "bar, 2-pack, set";
      ingredients.placeholder = "Oils, lye, water, essential oils...";
      allergens.placeholder = "Fragrance sensitivities, oatmeal, nut oils...";
      ingredientsLabel.textContent = "Ingredients / oils (for your labels)";
      allergensLabel.textContent = "Sensitivities / notes";
    } else {
      unit.placeholder = "dozen, loaf, 8 oz jar";
      ingredients.placeholder = "Flour, sugar, butter...";
      allergens.placeholder = "Wheat, eggs, milk";
      ingredientsLabel.textContent = "Ingredients (for your labels)";
      allergensLabel.textContent = "Allergens";
    }
  }

  function goalPercent(done, total) {
    if (!total) return 0;
    return Math.round((done / total) * 100);
  }

  function renderDashboard() {
    const products = BHK.listProducts().filter((p) => !BHK.isSampleProduct(p));
    const orders = BHK.listOrders();
    const openOrders = orders.filter((o) => !["completed", "cancelled"].includes(o.status));
    const summary = BHK.taxSummary(new Date().getFullYear());
    document.getElementById("dashStats").innerHTML = `
      <div class="stat-card"><div class="label">Real products</div><div class="value">${products.length}</div></div>
      <div class="stat-card"><div class="label">Open orders</div><div class="value">${openOrders.length}</div></div>
      <div class="stat-card"><div class="label">${summary.year} sales</div><div class="value">${BHK.money(summary.revenue)}</div></div>
      <div class="stat-card"><div class="label">${summary.year} expenses</div><div class="value">${BHK.money(summary.expenses)}</div></div>
    `;

    const goals = BHK.getBusinessGoals();
    const pct = goalPercent(goals.doneCount, goals.totalCount);
    document.getElementById("launchProgress").textContent =
      goals.doneCount + " of " + goals.totalCount + " goals complete (" + pct + "%)";
    const fill = document.getElementById("launchProgressFill");
    if (fill) fill.style.width = pct + "%";

    const next = goals.nextItem;
    const nextHint = document.getElementById("launchNextHint");
    if (nextHint) {
      nextHint.innerHTML = next
        ? "<strong>Next up:</strong> " + escapeHtml(next.label)
        : "<strong>All goals checked.</strong> Keep updating stock and the weekly note.";
    }

    // Dashboard shows next few incomplete goals only (full list lives on Goals tab)
    const upcoming = goals.items.filter((c) => !c.done).slice(0, 4);
    document.getElementById("launchChecklist").innerHTML = upcoming.length
      ? upcoming
          .map((c) => {
            const box = '<span class="box"></span>';
            const goTab = c.tab || "goals";
            const label = `<button type="button" class="launch-link" data-goto-tab="${escapeHtml(goTab)}">${escapeHtml(c.label)}</button>`;
            const kind =
              c.kind === "manual"
                ? ' <span class="goal-kind">you check off</span>'
                : ' <span class="goal-kind">auto</span>';
            return `<li>${box}<span>${label}${kind}</span></li>`;
          })
          .join("")
      : '<li><span class="box box-done" aria-hidden="true">✓</span><span class="launch-done">Everything on the walkthrough is done</span></li>';

    const recent = orders.slice(0, 5);
    document.getElementById("dashOrders").innerHTML = recent.length
      ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${recent
          .map(
            (o) => `<tr>
            <td>${BHK.formatDate(o.createdAt)}</td>
            <td>${escapeHtml(o.customerName)}</td>
            <td>${BHK.money(o.total)}</td>
            <td><span class="badge">${escapeHtml(o.status)}</span></td>
          </tr>`
          )
          .join("")}</tbody></table></div>`
      : '<p class="muted">No orders yet. When customers order on the website, they will show here.</p>';
  }

  function renderGoals() {
    const wrap = document.getElementById("goalsPhases");
    if (!wrap) return;
    const goals = BHK.getBusinessGoals();
    const pct = goalPercent(goals.doneCount, goals.totalCount);

    const progressLabel = document.getElementById("goalsProgressLabel");
    if (progressLabel) {
      progressLabel.textContent =
        goals.doneCount + " of " + goals.totalCount + " goals complete (" + pct + "%)";
    }
    const fill = document.getElementById("goalsProgressFill");
    if (fill) fill.style.width = pct + "%";

    const nextHint = document.getElementById("goalsNextHint");
    if (nextHint) {
      if (goals.nextItem) {
        nextHint.innerHTML =
          "<strong>Next up:</strong> " +
          escapeHtml(goals.nextItem.label) +
          '<br /><span class="muted">' +
          escapeHtml(goals.nextItem.why) +
          "</span>";
      } else {
        nextHint.innerHTML =
          "<strong>Walkthrough complete.</strong> Keep the weekly note and backups going.";
      }
    }

    const ready = document.getElementById("goalsLaunchReady");
    if (ready) {
      ready.style.display = goals.launchReady && goals.nextItem ? "block" : "none";
    }

    wrap.innerHTML = goals.phases
      .map((phase, idx) => {
        const phaseDone = phase.items.filter((i) => i.done).length;
        const phaseTotal = phase.items.length;
        const phasePct = goalPercent(phaseDone, phaseTotal);
        const itemsHtml = phase.items
          .map((item) => {
            const doneClass = item.done ? " goal-item-done" : "";
            let control = "";
            if (item.kind === "manual") {
              control = `<label class="goal-check">
                <input type="checkbox" data-goal-check="${escapeHtml(item.id)}" ${item.done ? "checked" : ""} />
                <span>Mark done</span>
              </label>`;
            } else {
              const box = item.done
                ? '<span class="box box-done" aria-hidden="true">✓</span>'
                : '<span class="box"></span>';
              control = box;
            }

            const actions = [];
            if (item.tab && !item.done) {
              actions.push(
                `<button type="button" class="btn btn-ghost btn-small" data-goto-tab="${escapeHtml(item.tab)}">Open</button>`
              );
            }
            if (item.href) {
              actions.push(
                `<a class="btn btn-secondary btn-small" href="${escapeHtml(item.href)}" target="_blank" rel="noopener">Open page</a>`
              );
            }

            return `<li class="goal-item${doneClass}">
              <div class="goal-item-main">
                <div class="goal-item-control">${control}</div>
                <div class="goal-item-copy">
                  <div class="goal-item-title">${escapeHtml(item.label)}</div>
                  <p class="muted goal-item-why">${escapeHtml(item.why)}</p>
                  ${actions.length ? `<div class="actions" style="margin-top:.45rem;">${actions.join("")}</div>` : ""}
                </div>
              </div>
            </li>`;
          })
          .join("");

        return `<article class="panel goal-phase">
          <div class="goal-phase-head">
            <div>
              <span class="eyebrow">Phase ${idx + 1}</span>
              <h2>${escapeHtml(phase.title)}</h2>
              <p class="muted" style="margin:.35rem 0 0;">${escapeHtml(phase.blurb)}</p>
            </div>
            <div class="goal-phase-count">${phaseDone}/${phaseTotal}</div>
          </div>
          <div class="goal-progress-track goal-progress-track-sm" aria-hidden="true">
            <div class="goal-progress-fill" style="width:${phasePct}%"></div>
          </div>
          <ul class="goal-item-list">${itemsHtml}</ul>
        </article>`;
      })
      .join("");
  }

  document.getElementById("launchPanel").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goto-tab]");
    if (!btn) return;
    activateTab(btn.getAttribute("data-goto-tab"));
  });

  document.getElementById("goalsPhases").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goto-tab]");
    if (btn) {
      activateTab(btn.getAttribute("data-goto-tab"));
      return;
    }
  });

  document.getElementById("goalsPhases").addEventListener("change", (e) => {
    const input = e.target.closest("[data-goal-check]");
    if (!input) return;
    BHK.setGoalChecked(input.getAttribute("data-goal-check"), input.checked);
    renderDashboard();
    renderGoals();
  });

  function renderProducts() {
    const rows = BHK.listProducts({
      category: adminProductFilter === "all" ? undefined : adminProductFilter,
    });
    const tbody = document.getElementById("productsTable");
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="7">No products in this view yet. Click “Add product” and choose Foods or Soap.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map((p) => {
        const thumb = p.image
          ? `<img class="thumb" src="${p.image}" alt="" />`
          : '<div class="thumb"></div>';
        return `<tr>
          <td>${thumb}</td>
          <td><strong>${escapeHtml(p.name)}</strong><br /><span class="muted">${escapeHtml(p.unit || "")}</span></td>
          <td><span class="badge">${escapeHtml(BHK.categoryShort(p.category))}</span></td>
          <td>${BHK.money(p.price)}</td>
          <td>
            <div class="qty-controls">
              <button type="button" class="btn btn-ghost btn-small" data-qty-delta="-1" data-qty-id="${p.id}" aria-label="Decrease stock">−</button>
              <span class="qty-pill">${Number(p.quantityOnHand || 0)}</span>
              <button type="button" class="btn btn-ghost btn-small" data-qty-delta="1" data-qty-id="${p.id}" aria-label="Increase stock">+</button>
            </div>
          </td>
          <td>${p.available ? '<span class="badge">For sale</span>' : '<span class="badge badge-warn">Hidden</span>'}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-small" data-edit-product="${p.id}">Edit</button>
            <button class="btn btn-danger btn-small" data-del-product="${p.id}">Delete</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  document.querySelectorAll("[data-admin-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      adminProductFilter = btn.getAttribute("data-admin-cat");
      document.querySelectorAll("[data-admin-cat]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderProducts();
    });
  });

  document.getElementById("productsTable").addEventListener("click", (e) => {
    const qtyBtn = e.target.closest("[data-qty-id]");
    if (qtyBtn) {
      const id = qtyBtn.getAttribute("data-qty-id");
      const delta = Number(qtyBtn.getAttribute("data-qty-delta") || 0);
      const product = BHK.getProduct(id);
      if (!product) return;
      const next = Math.max(0, Number(product.quantityOnHand || 0) + delta);
      BHK.upsertProduct({ ...product, quantityOnHand: next });
      refreshAll();
      return;
    }
    const editId = e.target.getAttribute("data-edit-product");
    const delId = e.target.getAttribute("data-del-product");
    if (editId) openProductModal(BHK.getProduct(editId));
    if (delId) {
      if (confirm("Delete this product?")) {
        BHK.deleteProduct(delId);
        refreshAll();
      }
    }
  });

  function openProductModal(product) {
    const form = document.getElementById("productForm");
    form.reset();
    form.id.value = product ? product.id : "";
    form.name.value = product ? product.name : "";
    form.category.value = product ? BHK.normalizeCategory(product.category) : "baked";
    form.description.value = product ? product.description || "" : "";
    form.price.value = product ? product.price : "";
    form.unit.value = product ? product.unit || "" : "";
    form.quantityOnHand.value = product ? product.quantityOnHand : 0;
    form.available.value = product ? String(!!product.available) : "true";
    form.ingredients.value = product ? product.ingredients || "" : "";
    form.allergens.value = product ? product.allergens || "" : "";
    form.image.value = product ? product.image || "" : "";
    syncProductFieldHints(form.category.value);
    const preview = document.getElementById("productImagePreview");
    if (product && product.image) {
      preview.src = product.image;
      preview.style.display = "block";
    } else {
      preview.removeAttribute("src");
      preview.style.display = "none";
    }
    document.getElementById("productModalTitle").textContent = product ? "Edit product" : "Add product";
    document.getElementById("productModal").classList.add("open");
  }

  document.getElementById("productCategory").addEventListener("change", (e) => {
    syncProductFieldHints(e.target.value);
  });

  document.getElementById("addProductBtn").addEventListener("click", () => openProductModal(null));

  document.querySelector('#productForm [name="imageFile"]').addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 1.8 * 1024 * 1024) {
      alert("Please use a photo smaller than about 2 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const form = document.getElementById("productForm");
      form.image.value = reader.result;
      const preview = document.getElementById("productImagePreview");
      preview.src = reader.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("productForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    BHK.upsertProduct({
      id: form.id.value || undefined,
      name: form.name.value.trim(),
      category: form.category.value,
      description: form.description.value.trim(),
      price: Number(form.price.value),
      unit: form.unit.value.trim(),
      quantityOnHand: Number(form.quantityOnHand.value),
      available: form.available.value === "true",
      ingredients: form.ingredients.value.trim(),
      allergens: form.allergens.value.trim(),
      image: form.image.value,
    });
    document.getElementById("productModal").classList.remove("open");
    refreshAll();
  });

  function renderOrders() {
    const orders = BHK.listOrders();
    const tbody = document.getElementById("ordersTable");
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7">No orders yet.</td></tr>';
      return;
    }
    tbody.innerHTML = orders
      .map((o) => {
        const items = (o.items || [])
          .map((i) => `${escapeHtml(i.name)} × ${i.qty}`)
          .join("<br />");
        return `<tr>
          <td>${BHK.formatDate(o.createdAt)}</td>
          <td>
            <strong>${escapeHtml(o.customerName)}</strong><br />
            <span class="muted">${escapeHtml(o.customerPhone || "")}</span>
            ${o.notes ? `<br /><span class="muted">${escapeHtml(o.notes)}</span>` : ""}
          </td>
          <td>${items}</td>
          <td>${BHK.money(o.total)}</td>
          <td>
            ${escapeHtml(o.paymentMethod || "")}<br />
            ${o.paymentReceived ? '<span class="badge">Paid</span>' : '<span class="badge badge-warn">Unpaid</span>'}
          </td>
          <td>
            <select data-status="${o.id}">
              ${["new", "confirmed", "ready", "completed", "cancelled"]
                .map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`)
                .join("")}
            </select>
          </td>
          <td class="actions">
            <button class="btn btn-ghost btn-small" data-toggle-paid="${o.id}">${o.paymentReceived ? "Mark unpaid" : "Mark paid"}</button>
            <button class="btn btn-danger btn-small" data-del-order="${o.id}">Delete</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  document.getElementById("ordersTable").addEventListener("change", (e) => {
    const id = e.target.getAttribute("data-status");
    if (!id) return;
    BHK.updateOrder(id, { status: e.target.value });
    refreshAll();
  });

  document.getElementById("ordersTable").addEventListener("click", (e) => {
    const paidId = e.target.getAttribute("data-toggle-paid");
    const delId = e.target.getAttribute("data-del-order");
    if (paidId) {
      const order = BHK.getOrder(paidId);
      if (!order) return;
      BHK.updateOrder(paidId, { paymentReceived: !order.paymentReceived });
      refreshAll();
    }
    if (delId && confirm("Delete this order?")) {
      BHK.deleteOrder(delId);
      refreshAll();
    }
  });

  document.getElementById("exportOrdersBtn").addEventListener("click", () => {
    const rows = BHK.listOrders().map((o) => ({
      date: BHK.formatDate(o.createdAt),
      customer: o.customerName,
      phone: o.customerPhone,
      email: o.customerEmail,
      items: (o.items || []).map((i) => `${i.name} x${i.qty}`).join("; "),
      total: o.total,
      paymentMethod: o.paymentMethod,
      paid: o.paymentReceived ? "yes" : "no",
      status: o.status,
      notes: o.notes,
    }));
    BHK.exportCsv(rows, "brenda-orders.csv");
  });

  function fillManualProducts() {
    const select = document.getElementById("manualProductSelect");
    const products = BHK.listProducts();
    select.innerHTML = products
      .map(
        (p) =>
          `<option value="${p.id}">[${escapeHtml(BHK.categoryShort(p.category))}] ${escapeHtml(p.name)} (${BHK.money(p.price)}) — qty ${p.quantityOnHand}</option>`
      )
      .join("");
  }

  document.getElementById("manualOrderBtn").addEventListener("click", () => {
    fillManualProducts();
    document.getElementById("manualOrderForm").reset();
    document.getElementById("orderModal").classList.add("open");
  });

  document.getElementById("manualOrderForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      BHK.createOrder({
        customerName: form.customerName.value,
        customerPhone: form.customerPhone.value,
        notes: form.notes.value,
        paymentMethod: form.paymentMethod.value,
        paymentReceived: form.paymentReceived.checked,
        status: form.paymentReceived.checked ? "completed" : "confirmed",
        source: "manual",
        items: [{ productId: form.productId.value, qty: Number(form.qty.value) }],
      });
      document.getElementById("orderModal").classList.remove("open");
      refreshAll();
    } catch (err) {
      alert(err.message || "Could not save order");
    }
  });

  function renderTaxes() {
    const yearSelect = document.getElementById("taxYear");
    const current = new Date().getFullYear();
    if (!yearSelect.options.length) {
      for (let y = current; y >= current - 5; y--) {
        const opt = document.createElement("option");
        opt.value = String(y);
        opt.textContent = String(y);
        yearSelect.appendChild(opt);
      }
    }
    const summary = BHK.taxSummary(yearSelect.value || current);
    document.getElementById("taxStats").innerHTML = `
      <div class="stat-card"><div class="label">Orders</div><div class="value">${summary.orderCount}</div></div>
      <div class="stat-card"><div class="label">Gross sales</div><div class="value">${BHK.money(summary.revenue)}</div></div>
      <div class="stat-card"><div class="label">Marked paid</div><div class="value">${BHK.money(summary.paidRevenue)}</div></div>
      <div class="stat-card"><div class="label">Est. profit</div><div class="value">${BHK.money(summary.estimatedProfit)}</div></div>
    `;
    const expenses = summary.expenseRows;
    const tbody = document.getElementById("expensesTable");
    tbody.innerHTML = expenses.length
      ? expenses
          .map(
            (ex) => `<tr>
          <td>${escapeHtml(ex.date)}</td>
          <td>${escapeHtml(ex.category)}</td>
          <td>${escapeHtml(ex.description)}</td>
          <td>${BHK.money(ex.amount)}</td>
          <td><button class="btn btn-danger btn-small" data-del-expense="${ex.id}">Delete</button></td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="5">No expenses logged for this year yet.</td></tr>';
  }

  document.getElementById("taxYear").addEventListener("change", renderTaxes);

  document.getElementById("expensesTable").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-del-expense");
    if (id && confirm("Delete this expense?")) {
      BHK.deleteExpense(id);
      refreshAll();
    }
  });

  const expenseForm = document.getElementById("expenseForm");
  expenseForm.date.value = new Date().toISOString().slice(0, 10);
  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(expenseForm);
    BHK.addExpense({
      date: fd.get("date"),
      category: fd.get("category"),
      description: fd.get("description"),
      amount: fd.get("amount"),
    });
    expenseForm.reset();
    expenseForm.date.value = new Date().toISOString().slice(0, 10);
    refreshAll();
  });

  document.getElementById("exportTaxBtn").addEventListener("click", () => {
    const year = document.getElementById("taxYear").value;
    const summary = BHK.taxSummary(year);
    const salesRows = summary.orders.map((o) => ({
      type: "sale",
      date: BHK.formatDate(o.createdAt),
      description: o.customerName + " — " + (o.items || []).map((i) => i.name + " x" + i.qty).join("; "),
      amount: o.total,
      paid: o.paymentReceived ? "yes" : "no",
      status: o.status,
    }));
    const expenseRows = summary.expenseRows.map((ex) => ({
      type: "expense",
      date: ex.date,
      description: ex.category + ": " + ex.description,
      amount: ex.amount,
      paid: "yes",
      status: "",
    }));
    BHK.exportCsv(salesRows.concat(expenseRows), `brenda-tax-${year}.csv`);
  });

  function fillSettings() {
    const s = BHK.getStore().settings;
    const form = document.getElementById("settingsForm");
    Object.keys(s).forEach((key) => {
      if (form[key] != null) form[key].value = s[key];
    });
    const warn = document.getElementById("defaultPasswordWarn");
    if (warn) {
      warn.style.display = s.adminPassword === "HomesteadKitchen" ? "block" : "none";
    }
  }

  document.getElementById("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const patch = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      patch[el.name] = el.value;
    });
    BHK.updateSettings(patch);
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "Settings saved.";
    form.prepend(notice);
    setTimeout(() => notice.remove(), 2500);
    refreshAll();
  });

  document.getElementById("backupBtn").addEventListener("click", () => BHK.exportBackup());
  document.getElementById("restoreInput").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      await BHK.importBackup(file);
      alert("Backup restored.");
      refreshAll();
    } catch (err) {
      alert("Could not restore that file.");
    }
    e.target.value = "";
  });
})();
