// Interactive demos for the COP docs page (shortcodes cop_demo and cop_uri).
// Everything runs locally: a toy wallet talks to a toy merchant server over an
// in-memory stream, and every line that would cross the wire is logged.
(() => {
  "use strict";

  const ENDPOINT = "5f1c9d0a27e4b6c38d2f71a09e4b5c6d8a3f2e1b0c9d8e7f6a5b4c3d2e1f0a9b";
  const MENU = { margherita: ["Margherita", 850], pepperoni: ["Pepperoni", 1000], funghi: ["Funghi", 950] };
  const TOPPINGS = { olives: ["Olives", 100], chili: ["Chili", 75] };
  const CODES = [
    { label: "Flyer", uri: `cop://${ENDPOINT}#name=Luigi%27s%20Pizza` },
    { label: "Till 2", uri: `cop://${ENDPOINT}#till=2` },
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const bytes = (n) => crypto.getRandomValues(new Uint8Array(n));
  const hex = (n) => Array.from(bytes(n), (b) => b.toString(16).padStart(2, "0")).join("");
  const token = () => btoa(String.fromCharCode(...bytes(16))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const short = (h) => h.slice(0, 4) + "…" + h.slice(-4);
  const usd = (c) => "$" + (c / 100).toFixed(2);
  const toSats = (c) => c * 10; // demo exchange rate: $1 = 1,000 sats
  const fmt = (n) => n.toLocaleString("en-US");
  const now = () => Math.floor(Date.now() / 1000);
  const MERCHANT_NODE = hex(33);
  const WALLET_NODE = hex(33);

  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (v != null && v !== false) el.setAttribute(k, v === true ? "" : v);
    }
    el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
    return el;
  }

  const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
  function setPath(obj, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    for (const k of keys) obj = obj[k] ??= {};
    obj[last] = value;
  }
  function merge(into, from) {
    for (const [k, v] of Object.entries(from)) {
      if (v && typeof v === "object" && !Array.isArray(v)) merge((into[k] ??= {}), v);
      else into[k] = v;
    }
  }
  function parseFragment(uri) {
    const frag = uri.split("#")[1] || "";
    return Object.fromEntries(frag.split("&").filter(Boolean).map((kv) => kv.split("=").map(decodeURIComponent)));
  }

  // Decorative QR-like square, deterministic per string.
  function qr(text) {
    const n = 21;
    let s = [...text].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0, 7);
    const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 2 ** 32;
    const corners = [[0, 0], [n - 7, 0], [0, n - 7]];
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = corners.find(([fx, fy]) => x >= fx - 1 && x < fx + 8 && y >= fy - 1 && y < fy + 8);
        let on;
        if (c) {
          const r = Math.max(Math.abs(x - c[0] - 3), Math.abs(y - c[1] - 3));
          on = r !== 2 && r !== 4;
        } else on = rnd() < 0.5;
        if (on) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    const wrap = h("span", { class: "cop-qr", "aria-hidden": "true" });
    wrap.innerHTML = `<svg viewBox="-1 -1 23 23" shape-rendering="crispEdges"><path fill="currentColor" d="${d}"/></svg>`;
    return wrap;
  }

  // The merchant's side: Luigi's Pizza. Keeps one order per session string.
  function makeServer() {
    const orders = new Map();
    let nextNo = 427;

    const el = (d) => ["element", d];
    const items = (o, word = "") =>
      MENU[o.pizza][0] + word + (o.topping ? " + " + TOPPINGS[o.topping][0].toLowerCase() : "");
    const total = (o) => MENU[o.pizza][1] + (o.topping ? TOPPINGS[o.topping][1] : 0);
    const bill = (cents, memo) => [
      "invoice",
      {
        invoice: { payment_hash: short(hex(32)), amount_msat: toSats(cents) * 1000, payee: short(MERCHANT_NODE), expires_at: now() + 900 },
        memo,
      },
    ];

    const pages = {
      menu: () => [
        el({ id: "title", type: "text", variant: "h1", text: "Choose your pizza" }),
        el({ id: "menu", type: "list" }),
        ...Object.entries(MENU).map(([id, [name, c]]) =>
          el({ id, type: "button", parent: "menu", label: `${name} — ${usd(c)}`, onPress: { action: "selectPizza", payload: { pizza: id } } })
        ),
      ],
      topping: (o) => [
        el({ id: "title", type: "text", variant: "h1", text: "Your order" }),
        el({ id: "selected", type: "text", text: `${items(o, " pizza")} — ${usd(total(o))}` }),
        el({ id: "toppings", type: "card", title: "Add an extra topping?" }),
        el({ id: "topping_row", type: "row", parent: "toppings" }),
        ...Object.entries(TOPPINGS).map(([id, [name, c]]) =>
          el({ id, type: "button", parent: "topping_row", label: `${name} (+${usd(c)})`, onPress: { action: "selectTopping", payload: { topping: id } } })
        ),
        el({ id: "skip", type: "button", parent: "topping_row", variant: "plain", label: "No extra topping", onPress: { action: "selectTopping", payload: { topping: null } } }),
      ],
      address: (o) => [
        ["signal", { order: { address: "" } }],
        el({ id: "title", type: "text", variant: "h1", text: "Where should we deliver?" }),
        el({ id: "selected", type: "text", text: `${items(o, " pizza")} — ${usd(total(o))}` }),
        el({ id: "address", type: "input", label: "Delivery address", bind: "order.address" }),
        el({ id: "pay", type: "button", variant: "primary", label: `Pay ${usd(total(o))}`, disabled: { cel: "s.order.address == ''" }, onPress: { action: "pay" } }),
      ],
      paid: (o) => [
        el({ id: "title", type: "text", variant: "h1", text: "Order confirmed" }),
        el({ id: "selected", type: "text", text: `${items(o, " pizza")} → ${o.address}` }),
        el({ id: "receipt", type: "card", title: `Order #${o.no}` }),
        el({ id: "status", type: "text", parent: "receipt", text: `Paid ${fmt(toSats(total(o)))} sats · arriving in about 35 min` }),
        el({ id: "cancel", type: "button", parent: "receipt", variant: "plain", label: "Cancel order & refund", onPress: { action: "cancel" } }),
      ],
      refunded: (o) => [
        el({ id: "title", type: "text", variant: "h1", text: "Order cancelled" }),
        el({ id: "selected", type: "text", text: `${items(o, " pizza")} → ${o.address}` }),
        el({ id: "receipt", type: "card", title: `Order #${o.no}` }),
        el({ id: "status", type: "text", parent: "receipt", text: `Refunded ${fmt(toSats(total(o)))} sats to your wallet` }),
      ],
    };

    return {
      hello({ params }) {
        let o = orders.get(params.session);
        if (params.till) {
          if (!o) orders.set(params.session, (o = { till: params.till, stage: "unpaid" }));
          const meta = ["metadata", { name: "Luigi's Pizza", description: `Till ${params.till}` }];
          if (o.stage === "paid") {
            return [
              meta,
              el({ id: "title", type: "text", variant: "h1", text: `Paid at Till ${params.till}` }),
              el({ id: "items", type: "text", text: "1 × flat white — 3,500 sats" }),
            ];
          }
          return [meta, bill(350, "1 × flat white")];
        }
        if (!o) orders.set(params.session, (o = { stage: "menu" }));
        return [["metadata", { name: "Luigi's Pizza", description: "Wood-fired pizza, Via Roma 12" }], ...pages[o.stage](o)];
      },

      // Payloads are untrusted: only item ids are accepted, prices are looked up here.
      action(conn, { name, payload, signals }) {
        const o = orders.get(conn.params.session);
        switch (name) {
          case "selectPizza":
            if (o.stage !== "menu" || !MENU[payload?.pizza]) return [];
            o.pizza = payload.pizza;
            o.stage = "topping";
            return [["remove", { id: "menu" }], ...pages.topping(o)];
          case "selectTopping":
            if (o.stage !== "topping") return [];
            o.topping = TOPPINGS[payload?.topping] ? payload.topping : null;
            o.stage = "address";
            return [["remove", { id: "toppings" }], ...pages.address(o)];
          case "pay": {
            const address = String(signals?.order?.address ?? "").trim();
            if (o.stage !== "address" || !address) return [];
            o.address = address;
            return [bill(total(o), `${items(o)}, to ${address}`)];
          }
          case "cancel":
            if (o.stage !== "paid") return [];
            return [
              ["invoicerequest", { amount: toSats(total(o)), networks: ["liquid", "cashu::mint.example.com"], memo: `Refund for order #${o.no}`, expiresIn: 900 }],
            ];
        }
        return [];
      },

      // The server notices settlement on its own Cassis node, not on this stream.
      settled(conn) {
        const o = orders.get(conn.params.session);
        if (o.till) {
          o.stage = "paid";
          return [];
        }
        o.stage = "paid";
        o.no = nextNo++;
        return [["remove", { id: "address" }], ["remove", { id: "pay" }], ...pages.paid(o)];
      },

      // The wallet answered an invoicerequest: pay its invoice over Cassis.
      invoice(conn, { invoice }) {
        const o = orders.get(conn.params.session);
        if (o.stage !== "paid" || invoice.amount_msat !== toSats(total(o)) * 1000) return { paid: 0, msgs: [] };
        o.stage = "refunded";
        return { paid: invoice.amount_msat, msgs: [["remove", { id: "cancel" }], ...pages.refunded(o)] };
      },
    };
  }

  // The payer's side: a wallet that renders server elements with its own components.
  function mountOrderDemo(root) {
    const screen = root.querySelector(".cop-screen");
    const log = root.querySelector(".cop-log-lines");
    root.querySelector("[data-reset]").addEventListener("click", reset);

    let server, balance, recents, conn, queue;
    let nodes, signals, notedTyping, ui;

    function line(dir, tag, obj) {
      log.append(
        h(
          "div",
          { class: `cop-line cop-${dir}` },
          h("span", { class: "cop-dir" }, dir === "out" ? "wallet →" : "← server"),
          h("span", { class: "cop-msg" }, h("span", { class: "cop-tag" }, tag), " " + JSON.stringify(obj))
        )
      );
      log.scrollTop = log.scrollHeight;
    }
    function note(text) {
      log.append(h("div", { class: "cop-note" }, text));
      log.scrollTop = log.scrollHeight;
    }

    function send(tag, obj) {
      line("out", tag, obj);
    }
    function deliver(c, msgs) {
      queue = queue.then(async () => {
        for (const [tag, obj] of msgs) {
          await sleep(160);
          if (conn !== c) return;
          line("in", tag, obj);
          handle(tag, obj);
        }
      });
    }

    function reset() {
      server = makeServer();
      balance = 50000;
      recents = [];
      conn = null;
      queue = Promise.resolve();
      log.replaceChildren();
      note("Scan one of the codes on the wallet to start.");
      home();
    }

    function home() {
      conn = null;
      screen.replaceChildren(
        h(
          "div",
          { class: "cop-home" },
          h("div", { class: "cop-wallet-head" }, h("div", { class: "cop-kicker" }, "Your wallet"), h("div", { class: "cop-balance" }, fmt(balance), h("span", {}, " sats"))),
          h("div", { class: "cop-section" }, "Scan a code"),
          h(
            "div",
            { class: "cop-codes" },
            CODES.map((c) => h("button", { type: "button", class: "cop-code", onclick: () => connect(c.uri) }, qr(c.uri), h("span", {}, c.label)))
          ),
          recents.length > 0 && [
            h("div", { class: "cop-section" }, "Recent orders"),
            recents.map((r) =>
              h(
                "button",
                { type: "button", class: "cop-recent", onclick: () => connect(r.uri, r) },
                h("span", { class: "cop-recent-name" }, r.name),
                h("span", { class: "cop-recent-desc" }, r.desc),
                h("span", { class: "cop-recent-go" }, "Reopen ›")
              )
            ),
          ]
        )
      );
    }

    function connect(uri, rec) {
      if (rec) {
        recents.splice(recents.indexOf(rec), 1);
        note("Reopening a past order: same parameters, same session string.");
      } else {
        rec = { uri, session: token(), name: "Luigi's Pizza", desc: "" };
        note(`Dialing ${short(ENDPOINT)} over Iroh (ALPN cassis-order) with a fresh session string.`);
      }
      recents.unshift(rec);
      const c = (conn = { rec, params: { ...parseFragment(uri), session: rec.session } });
      openFlow();
      const hello = { params: c.params };
      send("hello", hello);
      deliver(c, server.hello(hello));
    }

    function close() {
      note("Connection closed. The order stays under Recent orders.");
      home();
    }

    function openFlow() {
      nodes = new Map();
      signals = {};
      notedTyping = false;
      ui = {
        name: h("div", { class: "cop-bar-name" }, "Connecting…"),
        desc: h("div", { class: "cop-bar-desc" }, "endpoint " + short(ENDPOINT)),
        empty: h("div", { class: "cop-empty" }, "Waiting for the server…"),
        sheet: h("div", {}),
      };
      ui.page = h("div", { class: "cop-page" }, ui.empty);
      screen.replaceChildren(
        h(
          "div",
          { class: "cop-flow" },
          h("div", { class: "cop-bar" }, h("button", { type: "button", class: "cop-close", "aria-label": "Close order", onclick: close }, "×"), h("div", {}, ui.name, ui.desc)),
          ui.page,
          ui.sheet
        )
      );
    }

    function handle(tag, d) {
      switch (tag) {
        case "metadata":
          ui.name.textContent = conn.rec.name = d.name;
          conn.rec.desc = d.description;
          ui.desc.textContent = d.description;
          break;
        case "element":
          putElement(d);
          break;
        case "remove":
          nodes.get(d.id)?.el.remove();
          for (const [id, n] of nodes) if (!ui.page.contains(n.el)) nodes.delete(id);
          break;
        case "signal":
          merge(signals, d);
          refresh();
          break;
        case "invoice":
          paySheet(d);
          break;
        case "invoicerequest":
          receiveSheet(d);
          break;
      }
    }

    function putElement(d) {
      ui.empty.remove();
      const el = build(d);
      const old = nodes.get(d.id);
      if (old) {
        if (old.box && el._box) el._box.append(...old.box.childNodes);
        old.el.replaceWith(el);
      } else {
        ((d.parent && nodes.get(d.parent)?.box) || ui.page).append(el);
      }
      nodes.set(d.id, { d, el, box: el._box });
      refresh();
    }

    function build(d) {
      switch (d.type) {
        case "text":
          return h("div", { class: d.variant === "h1" ? "cop-h1" : "cop-text" }, d.text);
        case "list":
        case "row": {
          const el = h("div", { class: `cop-${d.type}` });
          el._box = el;
          return el;
        }
        case "card": {
          const box = h("div", { class: "cop-card-body" });
          const el = h("div", { class: "cop-card" }, d.title && h("div", { class: "cop-card-title" }, d.title), box);
          el._box = box;
          return el;
        }
        case "button":
          return h("button", { type: "button", class: `cop-btn cop-btn-${d.variant || "default"}`, onclick: () => act(d.onPress) }, d.label);
        case "input": {
          const input = h("input", {
            type: "text",
            value: getPath(signals, d.bind) ?? "",
            placeholder: "e.g. 221B Baker St",
            oninput: (e) => {
              setPath(signals, d.bind, e.target.value);
              refresh();
              if (!notedTyping) {
                notedTyping = true;
                note(`Typing updates the local signal ${d.bind}. Nothing is sent.`);
              }
            },
          });
          return h("label", { class: "cop-field" }, h("span", {}, d.label), input);
        }
      }
      return h("div", { class: "cop-text" }, `[unsupported element: ${d.type}]`);
    }

    // Only the one expression shape this demo's server uses is understood.
    function cel(expr) {
      const m = /^s\.([\w.]+) == ''$/.exec(expr);
      return m ? (getPath(signals, m[1]) ?? "") === "" : false;
    }
    function refresh() {
      for (const { d, el } of nodes.values()) if (d.disabled?.cel) el.disabled = cel(d.disabled.cel);
    }

    function act(onPress) {
      const msg = { name: onPress.action };
      if (onPress.payload) msg.payload = onPress.payload;
      msg.signals = structuredClone(signals);
      send("action", msg);
      deliver(conn, server.action(conn, msg));
    }

    function sheet(title, ...kids) {
      ui.sheet.replaceChildren(
        h("div", { class: "cop-scrim" }),
        h("div", { class: "cop-sheet", role: "dialog", "aria-label": title }, h("div", { class: "cop-sheet-kicker" }, "Wallet screen"), h("div", { class: "cop-sheet-title" }, title), ...kids)
      );
    }
    const closeSheet = () => ui.sheet.replaceChildren();
    const rows = (pairs) =>
      h("div", { class: "cop-rows" }, pairs.map(([k, v]) => h("div", {}, h("span", {}, k), h("span", {}, v))));
    const amount = (sats, sign = "") => h("div", { class: "cop-sheet-amount" }, sign + fmt(sats), h("span", {}, " sats"));
    const mins = (t) => `in ${Math.round((t - now()) / 60)} min`;

    function done(text) {
      sheet("Done", h("div", { class: "cop-done" }, "✓ " + text), h("div", { class: "cop-sheet-actions" }, h("button", { type: "button", class: "cop-sheet-btn primary", onclick: closeSheet }, "Done")));
    }

    function paySheet({ invoice, memo }) {
      if (nodes.size === 0) {
        ui.empty.textContent = "No order page: this server went straight to an invoice.";
        ui.page.append(ui.empty);
      }
      const sats = invoice.amount_msat / 1000;
      const c = conn;
      const status = h("div", { class: "cop-sheet-status" });
      const cancel = h("button", { type: "button", class: "cop-sheet-btn", onclick: () => (closeSheet(), note("Payment cancelled on the wallet's screen. Nothing is sent.")) }, "Cancel");
      const pay = h(
        "button",
        {
          type: "button",
          class: "cop-sheet-btn primary",
          onclick: async () => {
            if (sats > balance) return void (status.textContent = "Not enough balance.");
            pay.disabled = cancel.disabled = true;
            status.textContent = "Paying over Cassis…";
            await sleep(800);
            if (conn !== c) return;
            balance -= sats;
            note(`Paid ${fmt(sats)} sats over Cassis. The server sees it settle on its own node, not on this stream.`);
            done(`Paid ${fmt(sats)} sats`);
            deliver(c, server.settled(c));
          },
        },
        `Pay`
      );
      sheet("Pay invoice", amount(sats), rows([["To", invoice.payee], ["Memo", memo || "—"], ["Expires", mins(invoice.expires_at)]]), status, h("div", { class: "cop-sheet-actions" }, cancel, pay));
    }

    function receiveSheet({ amount: sats, networks, memo, expiresIn }) {
      const c = conn;
      const status = h("div", { class: "cop-sheet-status" });
      const decline = h("button", { type: "button", class: "cop-sheet-btn", onclick: () => (closeSheet(), note("Offer declined. The wallet simply doesn't reply.")) }, "Decline");
      const accept = h(
        "button",
        {
          type: "button",
          class: "cop-sheet-btn primary",
          onclick: async () => {
            accept.disabled = decline.disabled = true;
            const inv = { invoice: { payment_hash: short(hex(32)), amount_msat: sats * 1000, payee: short(WALLET_NODE), expires_at: now() + (expiresIn || 900) } };
            note(`The wallet issues its own invoice on ${networks[0]} and sends it back.`);
            send("invoice", inv);
            status.textContent = "Waiting for the server to pay…";
            await sleep(900);
            if (conn !== c) return;
            const { paid, msgs } = server.invoice(c, inv);
            balance += paid / 1000;
            note(`The server paid that invoice over Cassis: +${fmt(paid / 1000)} sats.`);
            done(`Received ${fmt(paid / 1000)} sats`);
            deliver(c, msgs);
          },
        },
        "Accept"
      );
      sheet("Incoming payment offer", amount(sats, "+"), rows([["Memo", memo || "—"], ["Pays from", networks.join(", ")], ["Expires", `in ${Math.round((expiresIn || 900) / 60)} min`]]), status, h("div", { class: "cop-sheet-actions" }, decline, accept));
    }

    reset();
  }

  function mountUri(root) {
    const parts = root.querySelectorAll("[data-part]");
    const infos = root.querySelectorAll("[data-info]");
    const show = (key) => {
      parts.forEach((p) => p.setAttribute("aria-pressed", p.dataset.part === key));
      infos.forEach((i) => (i.hidden = i.dataset.info !== key));
    };
    parts.forEach((p) => {
      p.setAttribute("role", "button");
      p.setAttribute("tabindex", "0");
      p.addEventListener("click", () => show(p.dataset.part));
      p.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          show(p.dataset.part);
        }
      });
    });
    root.classList.add("is-live");
    show(parts[0].dataset.part);
  }

  document.querySelectorAll("[data-cop-order-demo]").forEach(mountOrderDemo);
  document.querySelectorAll("[data-cop-uri]").forEach(mountUri);
})();
