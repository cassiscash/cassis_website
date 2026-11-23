+++
title = "Cassis Order Protocol (COP)"
description = "A wallet-native protocol for buying, subscribing, pricing in fiat, and ordering from menus without web technologies."
weight = 6

[extra]
scripts = ["cop-demos.js"]
+++

> **Specification v1.0 (Draft).** The full specification is at [cop.cassis.cash](https://cop.cassis.cash/).

The **Cassis Order Protocol (COP)** lets Bitcoin wallets handle real-world commerce directly inside the wallet.

Scan a QR code (or paste an address) and the merchant's order page opens in the wallet, rendered with the wallet's own native buttons, lists and form inputs. Pick what you want, fill in any details, and pay on the wallet's own payment screen.

- **No browser in the wallet** &mdash; the wallet renders a small set of native UI components instead of embedding a webview, JavaScript engine or cookies.
- **No website for the merchant** &mdash; the merchant needs no web server, domain name or TLS certificate. An Iroh public key is the address, and a server can run on a VPS, a vending machine, or a phone.
- **Two-way payments** &mdash; a merchant can also send money *back* to the customer (for refunds, cashback or withdrawals) in the same flow.
- **Persistent sessions** &mdash; the wallet can reconnect to a past order later to view a receipt, check delivery status, ask for a refund, or pay the next month of a subscription.

## Architecture & roles

COP is built on **[hypereffect](https://hypereffect.dev)**, a small JSON-line protocol for server-driven UI, carried over an encrypted **[Iroh](https://iroh.computer)** peer-to-peer stream (`cassis-order` ALPN).

The page itself &mdash; framing, elements, reactive signals, CEL expressions and actions &mdash; is standard hypereffect. COP adds three things:

1. **Transport & discovery:** an Iroh connection opened from a `cop://` [connection URI](#connection-uris-and-web-addresses) or an HTTPS URL that publishes one.
2. **Session resumption:** a client-generated `session` string in the `hello` handshake so a flow can be reopened later.
3. **Two messages for money:** `invoice` (asking the wallet to pay a Cassis invoice) and `invoicerequest` (offering the wallet money and asking it to issue an invoice).

Each flow has two sides:

- **Server (merchant):** a shop, restaurant, vending machine, online service, or person selling something. It sends the UI, handles user actions, prices the order, and issues invoices or invoice requests.
- **Client (wallet):** the payer's Bitcoin wallet. It opens the connection, renders the page with native components, sends user actions back, and shows its own payment screen when an invoice arrives.

## Try it

The demo below runs a toy wallet and restaurant server in your browser. The left side is what the payer sees; the right side logs every line on the `cassis-order` stream (a tag, a space, and a JSON object).

Drag the camera view to scan one of the two QR codes on the table:

- **The menu flyer** (`cop://…#name=Luigi%27s%20Pizza`) opens the full ordering flow: pick a pizza and topping, enter a delivery address, and pay.
- **The checkout terminal** (`cop://…#register=2`) skips straight to payment for two slices already rung up on register 2.

Both codes dial the same server; the fragment after `#` tells it what to show.

{{<cop_demo />}}

As you click through:

- **Connect.** The wallet sends `hello` with the URI parameters and a random `session` string. The server replies with `metadata` and the page's `element`s.
- **Order.** Tapping an item sends an `action` with *what* was chosen, never a price. The server prices it and updates the page with `element` and `remove`.
- **Local state.** Typing an address sends nothing yet. The input updates a local `signal`, and the wallet evaluates a CEL expression locally to enable the pay button. Signals are sent along with the next `action`.
- **Pay.** The server prices the order in sats and sends an `invoice`. The amount you confirm comes from the cryptographic invoice on the wallet's own payment screen, not from text on the page.
- **Money back.** *Cancel order & refund* triggers an `invoicerequest` from the server. If you accept, the wallet signs a fresh `invoice` and sends it back for the server to pay.
- **No UI at all.** The checkout terminal sends an `invoice` right away with no page or `metadata`, so the wallet shows only the endpoint ID it dialed.
- **Come back later.** Close an order and reopen it under *Recent orders*. The wallet reconnects with the same `session` string, and the server resumes the order or shows the receipt.

## Connection URIs and web addresses

A merchant publishes an order endpoint as a `cop://` URI, usually in a QR code:

{{<cop_uri />}}

### Web address discovery

Wherever a wallet accepts a `cop://` URI, it can also take an HTTPS URL like `example.com/order/123`. The wallet fetches the URL (`GET`) and looks in the HTML `<head>` for:

```html
<link rel="cassis-order" href="cop://5f1c9d0a27e4b6c38d2f71a09e4b5c6d8a3f2e1b0c9d8e7f6a5b4c3d2e1f0a9b#table=12">
```

The HTML is only used to discover the `cop://` URI. The wallet never renders the page, runs scripts, or follows links, and the server is still authenticated by the Iroh endpoint ID in the URI.

## Sessions and identity

Every `hello` includes a `session` token generated by the wallet with **at least 128 bits of randomness**:

- The wallet saves each session locally (endpoint ID, relay, URI parameters, `session` string, and invoices paid or issued).
- Tapping a past order reconnects with the same `session` and parameters, so the server can resume checkout, show a receipt or delivery status, offer a refund, or renew a subscription.

The server also sees the wallet's Iroh endpoint public key. A wallet can manage this key depending on the privacy tradeoff it wants:

- **A new key per order** so orders cannot be linked by endpoint ID.
- **One key per merchant** so a service recognises a returning customer without cross-merchant tracking.
- **A single key** if the user wants a portable identity across servers.

## Security model

- **Only the wallet's payment screen is trusted.** The server draws the entire order page, including any prices shown as text. When an `invoice` arrives, the wallet ignores page text and builds its payment sheet strictly from the signed invoice (`amount_msat`, `payee`, `expires_at`).
- **Money only moves through `invoice` and `invoicerequest`.** Hypereffect has no payment component, and links opened from a page must never trigger `bitcoin:`, `lightning:` or `cassis:` URI handlers.
- **Actions are untrusted input.** A client can put arbitrary values in `action` payloads and signals. Servers should only take item IDs and quantities from the client and compute all prices and totals themselves.
- **Remote media privacy.** Remote `image` URLs leak the customer's IP address to the image host. Wallets should let users block remote images, and must never load them when connected through a `.onion` Tor relay.
