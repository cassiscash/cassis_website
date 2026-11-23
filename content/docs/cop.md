+++
title = "Cassis Order Protocol (COP)"
description = "A rich, wallet-native protocol for buying, subscribing, pricing in fiat, and ordering from menus without web technologies."
weight = 6

[extra]
scripts = ["cop-demos.js"]
+++

> **Specification v1.0 (Draft).** The full specification is published at [cop.cassis.cash](https://cop.cassis.cash/). See [For wallet developers](@/docs/wallets.md) for how to integrate COP into a wallet.

The **Cassis Order Protocol (COP)** allows Bitcoin wallets to offer a rich, interactive experience for paying for anything in the real world without leaving the wallet interface.

Scan a QR code (or paste an address) and the merchant's order page opens directly inside the wallet, rendered with the wallet's own native buttons, lists and form inputs. Pick what you want, fill in any details, and pay on the wallet's own payment screen.

- **No browser in the wallet** &mdash; the wallet renders a small set of native UI components instead of embedding a bloated webview, JavaScript engine or cookie jar.
- **No website for the merchant** &mdash; the merchant needs no web server, domain name or TLS certificate. An Iroh public key is the address, and a server can run on an always-on machine, a vending machine, or the merchant's own phone.
- **Two-way money flows** &mdash; besides paying merchants, a merchant can offer money *back* to the customer (for refunds, cashbacks or withdrawals) in the exact same flow.
- **Persistent sessions** &mdash; the wallet can reconnect to any past order later to view a receipt, check delivery status, request a refund or pay for another month of a subscription.

## Architecture & roles

COP is built on **[hypereffect](https://hypereffect.dev)**, a small JSON-line protocol for server-driven UI, transported over an encrypted **[Iroh](https://iroh.computer)** peer-to-peer stream (using the `cassis-order` ALPN).

Everything about the page itself &mdash; framing, elements, reactive signals, CEL expressions and actions &mdash; is standard hypereffect. COP defines only three things on top:

1. **Transport & discovery:** an Iroh connection discovered from a `cop://` [connection URI](#connection-uris-and-web-addresses) (usually in a QR code) or an HTTPS web address that publishes one.
2. **Session resumption:** a client-generated `session` string sent in the opening `hello` handshake so a flow can be reopened later.
3. **Two messages for money:** `invoice` (asking the wallet to pay a Cassis invoice) and `invoicerequest` (offering the wallet money and asking it to issue an invoice).

There are two roles in every flow:

- **Server (merchant's side):** a shop, restaurant, vending machine, online service, or person selling something. It describes the UI, reacts to the client's actions, prices the order, and sends invoices or invoice requests.
- **Client (payer's side):** the customer's Bitcoin wallet. It always initiates the connection, draws the order page with its own native components, sends user actions back, and presents its own trusted payment screen when an invoice arrives.

## Try it

The demo below runs a toy wallet against a toy restaurant server, entirely in your browser. On the left is what the payer sees. On the right is every line that crosses the `cassis-order` stream: a tag, a space, and a JSON object.

Scan the **Flyer** code to order a pizza, or the **Till 2** code to pay a bill that is already waiting.

{{<cop_demo />}}

Things to notice as you click through:

- **Connect.** The wallet opens with a `hello` carrying the URI's parameters and a fresh random `session` string. The server answers with `metadata` and the `element`s of its page.
- **Order.** A tap sends an `action` naming only *what* was chosen, never a price. The server looks prices up itself and updates the page with `element` and `remove`.
- **Local state.** Typing the address sends nothing. The field is bound to a local `signal`, and the pay button's enabled state is a CEL expression the wallet evaluates on its own. The signals ride along with the next `action`.
- **Pay.** The server prices the order in sats and sends an `invoice`. The amount you confirm comes from the wallet's own payment screen, built from the invoice itself, not from anything the server drew on the page.
- **Money back.** *Cancel order & refund* makes the server send an `invoicerequest`. If you accept, the wallet issues an invoice with its own keys, sends it back as an `invoice`, and the server pays it.
- **No UI at all.** The till skips the page entirely and sends an `invoice` right after `metadata`.
- **Come back later.** Close an order and reopen it from *Recent orders*. The wallet reconnects with the same `session` string, and the server picks up where you left off or shows the receipt.

## Connection URIs and web addresses

A merchant publishes an order endpoint as a `cop://` URI, usually in a QR code:

{{<cop_uri />}}

### Web address discovery

Anywhere a `cop://` URI can be scanned or pasted, a user can also use an HTTPS web address such as `example.com/order/123`. The wallet fetches the URL over HTTPS (`GET`) and looks in the HTML `<head>` for:

```html
<link rel="cassis-order" href="cop://5f1c9d0a27e4b6c38d2f71a09e4b5c6d8a3f2e1b0c9d8e7f6a5b4c3d2e1f0a9b#table=12">
```

The HTML page is used strictly to publish the `cop://` URI &mdash; the wallet never renders the HTML, executes scripts, or follows links from it, and the server is still authenticated by the Iroh endpoint ID in the resolved URI.

## Sessions and identity

Every `hello` carries a `session` parameter generated by the wallet with **at least 128 bits of randomness**. The `session` string acts as a bearer token for that specific order:

- The wallet stores a local record of its sessions (the server's endpoint ID, relay, URI parameters, `session` string, and any invoices paid or issued).
- When the user taps a past order in their wallet, the wallet reconnects with the same `session` string and parameters. The server can resume an unfinished checkout, display a receipt or delivery tracker, offer a refund button, or let the user renew a subscription.

Separately from `session`, the server also sees the wallet's Iroh endpoint public key. Wallets choose how to manage this key depending on the privacy tradeoff they want:

- **A fresh Iroh key per flow** (ephemeral) so two orders can never be linked to the same wallet by endpoint ID.
- **One key per merchant** so a specific service recognises a returning customer without cross-merchant linkability.
- **A permanent key** if the user wants a portable identity across servers.

## Security model

- **Only the wallet's payment screen is trustworthy.** Everything on the order page is drawn by the server, including text claiming what an item costs. The wallet never trusts page text for payment details: when an `invoice` arrives, the wallet displays its own un-spoofable payment sheet populated strictly from the cryptographic invoice (`amount_msat`, `payee`, `expires_at`).
- **Money enters a flow only through `invoice` and `invoicerequest`.** There is no payment UI component in hypereffect, and a button that asks to open an external URL must never trigger a `bitcoin:`, `lightning:` or `cassis:` payment handler.
- **Actions are untrusted payer input.** Modified clients can put arbitrary values in `action` payloads and signals. Servers send only item identifiers in button payloads and compute all prices and totals server-side.
- **Remote media privacy.** Remote `image` URLs can reveal the customer's IP address to whoever hosts the image. Wallets should let users disable remote images and must never load remote media when connecting through a `.onion` Tor relay.
