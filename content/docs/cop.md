+++
title = "Cassis Order Protocol (COP)"
description = "A rich, wallet-native protocol for buying, subscribing, pricing in fiat, and ordering from menus without web technologies."
weight = 6
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

## Protocol overview

Every message on the `cassis-order` stream is a single line: a tag, a space, and a JSON object (`<tag> <json>`). A typical flow has four phases, though the order is flexible and the UI phase is optional:

1. **Connect:** The payer scans a `cop://` URI or opens a web address that publishes one. The wallet dials the server's Iroh endpoint (`cassis-order` ALPN) and sends a `hello` line carrying a random `session` string and any fragment parameters from the URI (such as a table or till number).
2. **Order:** The server streams hypereffect `metadata`, `element`, `remove` and `signal` messages to build and update the page. As the user taps buttons or fills in inputs, the wallet sends `action` messages and the server updates the page.
3. **Pay (`invoice`):** At any point, the server sends an `invoice` message containing a Cassis invoice. The wallet displays **its own payment screen** from the invoice fields and pays it over Cassis.
4. **Refund or payout (`invoicerequest`):** At any point, the server can send an `invoicerequest` offering an amount in sats and listing the Cassis networks it can pay from. If the user accepts, the wallet generates a Cassis invoice with its own keys and sends it back in an `invoice` message for the server to pay.

## Walkthrough: a pizza ordering flow

Here is a complete wire exchange between a wallet and a restaurant's COP server.

### 1. Scan & connect

The payer scans a QR code on a flyer containing:

```text
cop://5f1c9d0a27e4b6c38d2f71a09e4b5c6d8a3f2e1b0c9d8e7f6a5b4c3d2e1f0a9b#name=Luigi%27s%20Pizza
```

The wallet connects to that Iroh endpoint and sends `hello` with the URI's parameters and a freshly generated 128-bit `session` token:

```text
hello {"params":{"name":"Luigi's Pizza","session":"f1K9xQ2v8Tn4LmZp7Rb3wq"}}
```

### 2. Server streams the menu

The server identifies itself with `metadata` and streams the menu elements:

```text
metadata {"name":"Luigi's Pizza","description":"Wood-fired pizza, Via Roma 12"}
element {"id":"title","type":"text","variant":"h1","text":"Choose your pizza"}
element {"id":"menu","type":"list"}
element {"id":"margherita","type":"button","parent":"menu","label":"Margherita — $8.50","onPress":{"action":"selectPizza","payload":{"pizza":"margherita"}}}
element {"id":"pepperoni","type":"button","parent":"menu","label":"Pepperoni — $10.00","onPress":{"action":"selectPizza","payload":{"pizza":"pepperoni"}}}
element {"id":"funghi","type":"button","parent":"menu","label":"Funghi — $9.50","onPress":{"action":"selectPizza","payload":{"pizza":"funghi"}}}
```

Notice that action payloads carry only *what* was chosen (`"pizza": "pepperoni"`), never its price &mdash; the server looks up prices itself.

### 3. Payer picks a pizza and a topping

When the payer taps *Pepperoni*, the wallet sends:

```text
action {"name":"selectPizza","payload":{"pizza":"pepperoni"},"signals":{}}
```

The server replaces the menu with a topping selector:

```text
remove {"id":"menu"}
element {"id":"title","type":"text","variant":"h1","text":"Your order"}
element {"id":"selected","type":"text","text":"Pepperoni pizza — $10.00"}
element {"id":"toppings","type":"card","title":"Add an extra topping?"}
element {"id":"topping_row","type":"row","parent":"toppings"}
element {"id":"olives","type":"button","parent":"topping_row","label":"Olives (+$1.00)","onPress":{"action":"selectTopping","payload":{"topping":"olives"}}}
element {"id":"chili","type":"button","parent":"topping_row","label":"Chili (+$0.75)","onPress":{"action":"selectTopping","payload":{"topping":"chili"}}}
element {"id":"skip","type":"button","parent":"topping_row","variant":"plain","label":"No extra topping","onPress":{"action":"selectTopping","payload":{"topping":null}}}
```

The payer taps *Chili*:

```text
action {"name":"selectTopping","payload":{"topping":"chili"},"signals":{}}
```

### 4. Delivery address and reactive signals

The server updates the page with a delivery address input bound to a local reactive `signal` (`order.address`) and a pay button that stays disabled until the address is non-empty:

```text
remove {"id":"toppings"}
signal {"order":{"address":""}}
element {"id":"title","type":"text","variant":"h1","text":"Where should we deliver?"}
element {"id":"selected","type":"text","text":"Pepperoni pizza + chili — $10.75"}
element {"id":"address","type":"input","label":"Delivery address","bind":"order.address"}
element {"id":"pay","type":"button","variant":"primary","label":"Pay $10.75","disabled":{"cel":"s.order.address == ''"},"onPress":{"action":"pay"}}
```

Typing into the address field updates the wallet's local signals without network round-trips. When the user taps *Pay $10.75*, the wallet sends the action along with the current signal state:

```text
action {"name":"pay","signals":{"order":{"address":"221B Baker St, London NW1 6XE"}}}
```

### 5. Server sends the Cassis invoice

The server converts $10.75 to satoshis at the current exchange rate, generates a Cassis invoice, and sends an `invoice` message:

```text
invoice {"invoice":{"payment_hash":"3f9a…e21c","amount_msat":10750000,"expires_at":1793875200,…},"memo":"Pepperoni + chili, to 221B Baker St"}
```

On receiving `invoice`, the wallet pops up **its own native payment screen** displaying the amount, payee and expiry from the verified invoice. Once the Cassis payment settles, the server detects settlement on its node and can update the page into a receipt with an order number and estimated delivery time.

## Flows with no UI at all & reverse payments

Because a COP flow is just a message stream, the UI stage is completely optional:

### Paying at a till

A QR code on a point-of-sale terminal (`cop://...#till=2`) identifies the till. As soon as the wallet connects, the server &mdash; which already knows the bill for Till 2 &mdash; sends `metadata` followed immediately by an `invoice`, with zero UI elements:

```text
metadata {"name":"Luigi's Pizza","description":"Till 2"}
invoice {"invoice":{"payment_hash":"b207…41d9","amount_msat":3500000,"expires_at":1793871900,…},"memo":"1 × flat white"}
```

### Refunds, cashbacks and withdrawals (`invoicerequest`)

To send money *to* the customer, the server sends an `invoicerequest` naming the amount in sats and the Cassis networks it can pay from:

```text
invoicerequest {"amount":24000,"networks":["liquid","cashu::mint.example.com"],"memo":"Refund for unused days","expiresIn":900}
```

The wallet shows the offer to the user. If they accept, the wallet creates a Cassis invoice with its own keys on one of the listed networks (or a network reachable from them) and replies with an `invoice` line:

```text
invoice {"invoice":{"payment_hash":"5c04…9a7e","amount_msat":24000000,"expires_at":1793872800,…}}
```

The server then pays that invoice over Cassis.

## Connection URIs and web addresses

A merchant publishes an order endpoint either as a direct `cop://` URI or via an HTTPS web address.

```text
cop://<endpoint-id>[?_relay=<relay-url>][#<parameters>]
```

- **`<endpoint-id>`** &mdash; the server's Iroh endpoint ID (its 64-character hex Ed25519 public key). Iroh authenticates the connection against this key.
- **`_relay`** *(optional query parameter)* &mdash; a custom Iroh relay URL to reach the server through instead of the default relays. A privacy-conscious merchant can specify their own relay, including a `.onion` Tor hidden service relay. `_relay` is consumed by the wallet's transport and never sent in `hello`.
- **`#<parameters>`** *(optional fragment)* &mdash; `&`-separated `key=value` pairs passed to the server in `hello` (for example `#table=12&name=Luigi%27s%20Pizza`).

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
