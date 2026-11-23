+++
title = "For wallet developers"
description = "How to integrate Cassis payments and the Cassis Order Protocol into an existing Bitcoin wallet."
weight = 5
+++

Cassis is designed to be embedded directly into existing single-layer Bitcoin wallets. Your wallet keeps full custody and control of its own keys, coins and layer SDK &mdash; the Cassis node holds no balance of its own.

To integrate basic Cassis payments, a wallet only needs to:

1. Start a **`cassis-wallet`** [`Node`](https://github.com/cassiscash/cassis) (or bind an endpoint with **`cassis-wasm`** in browser/TypeScript wallets).
2. Register two hooks for its network &mdash; **`set_funder`** ([`HtlcFunder`]) and **`set_receiver`** ([`HtlcReceiver`]) &mdash; so Cassis locks, checks, claims and refunds HTLCs through the wallet's own balance.

Once those hooks are in place, the real value-added step (and slightly more work) is integrating the **[Cassis Order Protocol (COP)](@/docs/cop.md)** so users can interact with merchants, menus, carts and refunds natively inside your wallet.

## 1. Start a `cassis-wallet` node

In a Rust wallet, depend on `cassis-core` and `cassis-wallet` (plus the helper crate for your layer from `cassis-networks`, such as `cassis-arkade`, `cassis-cashu`, `cassis-fedimint`, `cassis-liquid` or `cassis-rootstock`).

Derive the node's keys from your wallet's recovery phrase, open its database (where it journals in-flight HTLCs and invoices), start a [`Node`] with an empty list of built-in network wallets, and pass in your wallet's funder and receiver hooks:

```rust
use std::sync::Arc;
use cassis_core::{keys::NodeKeys, NetworkId};
use cassis_wallet::{open_db, Node, NodeConfig};

let keys = NodeKeys::from_mnemonic(&mnemonic_words)?;
let db = open_db(&data_dir.join("cassis"))?;

let node = Node::start(
    NodeConfig {
        keys,
        db,
        span: tracing::info_span!("my-wallet"),
        serve: true, // listen on Iroh to receive payments & run the settlement loop
    },
    Vec::new(),
)
.await?;

let network = NetworkId::parse("arkade")?;
let htlcs = Arc::new(MyWalletHtlcs::new(my_wallet));

node.set_funder(network.clone(), htlcs.clone());
node.set_receiver(network, htlcs);
```

Because `Vec::new()` is passed to `Node::start`, `cassis-wallet` does not open a separate layer wallet of its own. Every satoshi locked into an outgoing HTLC comes straight from your wallet, and every claimed or refunded HTLC lands straight back in your wallet.

## 2. Implement the `HtlcFunder` and `HtlcReceiver` hooks

The two hooks live in `cassis_core::network` and bridge Cassis's protocol state machine to your wallet's layer client. The per-layer crates in `cassis-networks` expose the HTLC script builders, proof checks and witness extractors so you don't have to re-implement each layer's HTLC construction by hand.

### Funding outgoing payments (`set_funder` / `HtlcFunder`)

When the user pays a Cassis invoice, the node finds a route, `PREPARE`s every hop over Iroh, and asks your **`HtlcFunder`** to lock the first hop's HTLC. The node journals the payment before calling `fund` and drives it to completion in its background settlement loop &mdash; even across app restarts.

```rust
#[async_trait]
pub trait OutgoingHtlcs: Send + Sync {
    fn network_id(&self) -> NetworkId;

    /// Report whether an outgoing HTLC is still `Pending`, was
    /// `Claimed(preimage)`, or was `Refunded`.
    async fn check_outgoing(&self, htlc: &Htlc) -> Result<OutgoingState, NetworkError>;

    /// Sweep an expired outgoing HTLC back into the wallet.
    async fn refund_outgoing(&self, htlc: &Htlc) -> Result<(), NetworkError>;
}

#[async_trait]
pub trait HtlcFunder: OutgoingHtlcs {
    /// Lock `request.amount_msat` to `request.target` with
    /// `request.payment_hash` and `request.expiry`, and a refund path
    /// only this wallet can take. Returns once the next hop can verify it.
    async fn fund(&self, request: &HtlcRequest) -> Result<HtlcDescriptor, NetworkError>;
}
```

### Receiving incoming payments (`set_receiver` / `HtlcReceiver`)

When your wallet issues an invoice or receives a payment, the node asks your **`HtlcReceiver`** where payers should lock funds, verifies the incoming HTLC when a payer sends `COMMIT`, and claims it with the preimage:

```rust
#[async_trait]
pub trait HtlcReceiver: Send + Sync {
    fn network_id(&self) -> NetworkId;

    /// Seconds this wallet needs to get a claim through once the preimage is known.
    fn incoming_delta_secs(&self) -> u64;

    /// Minimum HTLC amount this network can hold (e.g. dust floor).
    fn min_htlc_msat(&self) -> u64 { 0 }

    /// The target (claim pubkey or hold invoice) a payer must lock the HTLC to.
    async fn incoming_target(
        &self,
        payment_hash: Bytes32,
        amount_msat: u64,
        expiry: u64,
    ) -> Result<InvoiceTarget, NetworkError>;

    async fn cancel_incoming(&self, payment_hash: Bytes32) -> Result<(), NetworkError>;

    /// Check on the layer that `htlc` exists, pays this wallet's target,
    /// and matches the agreed payment hash, amount and expiry.
    async fn verify_incoming(&self, htlc: &Htlc) -> Result<(), NetworkError>;

    /// Reveal `preimage` to claim the HTLC into the wallet's balance.
    async fn claim_incoming(&self, htlc: &Htlc, preimage: Bytes32) -> Result<(), NetworkError>;
}
```

If your wallet also builds stateless invoices (such as on-the-fly invoices for refunds whose terms ride in the invoice `metadata` rather than the database), you can additionally register **`node.set_preimage_releaser(...)`** ([`PreimageReleaser`]) to vet `PREPARE` and release the preimage on `COMMIT`.

## 3. Paying and creating invoices

With `set_funder` and `set_receiver` registered, paying and receiving are single calls on `Node`:

- **Pay an invoice:** `node.pay_retrying(&invoice, &network, &nostr_relays, DEFAULT_MAX_ROUTES).await` discovers routers on Nostr, computes local routes, `PREPARE`s every hop, calls your `HtlcFunder::fund`, drives `EXECUTE` and `COMMIT`, and returns a `PayReport` with the route taken and the preimage (Automatically retrying around any router that refuses at `PREPARE`).
- **Issue an invoice:** `cassis_wallet::node::create_invoice(node.db(), node.keys(), iroh_relay, &[node.receiver(&network)?], amount_msat, expires_at, description, metadata).await` queries your `HtlcReceiver::incoming_target`, signs the invoice with the node's Iroh key, and records it so the running node automatically claims it when paid.

## Browser and TypeScript wallets (`cassis-wasm`)

For browser and WebAssembly wallets that manage their layer in TypeScript/JavaScript, the **`cassis-wasm`** crate compiles the transport and wire types to WebAssembly:

- **`CassisEndpoint.bind(secret)`** opens an Iroh endpoint in the browser (using Iroh relays).
  - **`endpoint.hopRequest(peer, relay, requestJson)`** sends `PreparePayee` and `Commit` requests as a payer.
  - **`endpoint.serveHop(handler)`** answers incoming `PreparePayee` and `Commit` requests as a payee while the wallet is open.
  - **`endpoint.openOrder(peer, relay, handshakeJson)`** opens a bidirectional [Cassis Order Protocol](@/docs/cop.md) stream (`OrderStream`).
- **`parseInvoice`** and **`endpoint.signInvoice`** validate and sign invoices using `cassis-core`'s canonical signing and verification rules so the JS side never drifts from the Rust protocol.

## The real value-add: integrating the Cassis Order Protocol (COP)

Hooking up `set_funder` and `set_receiver` gives your wallet cross-layer invoice payments in very little code. **The real value-added part of a Cassis integration &mdash; and slightly more work &mdash; is supporting the [Cassis Order Protocol (COP)](@/docs/cop.md).**

Instead of treating your wallet as a dumb invoice scanner while all commerce happens in external web browsers, COP lets your wallet natively render interactive merchant checkouts, menus, shopping carts, currency calculators, subscriptions and one-tap refunds over a direct peer-to-peer connection.

What a wallet implements to support COP:

1. **Recognise `cop://` URIs and web addresses** &mdash; In your wallet's QR scanner or send input, accept `cop://<endpoint-id>[?_relay=...][#<params>]` URIs as well as `https://` web addresses that publish `<link rel="cassis-order" href="cop://...">` in their HTML `<head>`.
2. **Open a `cassis-order` stream over Iroh** &mdash; Dial the merchant's Iroh endpoint with the `cassis-order` ALPN (directly via `iroh` in Rust, or via `endpoint.openOrder(...)` in `cassis-wasm`) and send the opening `hello` line with the URI's fragment parameters plus a freshly generated 128-bit `session` string.
3. **Render the [hypereffect](https://hypereffect.dev) order view** &mdash; Map hypereffect's small set of UI primitives (`text`, `button`, `input`, `list`, `row`, `column`, `card`, `image`, `notice`) to your wallet's native GUI toolkit, evaluate reactive signal bindings locally, and send user interactions back as `action` messages.
4. **Handle `invoice` and `invoicerequest` messages** &mdash;
   - When the server sends an `invoice` message, present **your wallet's own trusted payment confirmation sheet** (taking amount, payee and expiry strictly from the invoice) and pay it through your `Node`.
   - When the server sends an `invoicerequest` message (for a refund, cashback or withdrawal), prompt the user to accept, generate a Cassis invoice on one of the server's supported networks using your `HtlcReceiver`, and send it back in an `invoice` message.
5. **Persist sessions so users can reopen orders** &mdash; Save each order's `session` string, endpoint ID, relay, parameters and paid invoices so the user can tap an order in their history to reconnect for a receipt, delivery status, refund or renewal.

You can test your wallet's COP client locally at any time by running the built-in test merchant:

```text
$ cassis-wallet order-demo --name "Test Coffee Shop"
```

It prints a `cop://` URI you can scan or paste into your wallet to walk through building a cart, paying an invoice, and requesting a refund via `invoicerequest`.

Read the **[Cassis Order Protocol (COP)](@/docs/cop.md)** documentation for the full message flow, wire examples and security rules.
