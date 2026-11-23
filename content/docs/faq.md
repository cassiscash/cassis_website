+++
title = "FAQ"
description = "Questions you might have about the Cassis protocol."
weight = 9
+++

## What problem does Cassis solve?

Bitcoin is scaling through layers: Lightning, Liquid, Arkade, Cashu, Fedimint and others being invented every day. A user of one of these networks can't pay someone on the other. Currently, the developers of such solutions have hacked a bridge solution using a centralized swap provider or Lightning gateway.

Cassis abstracts the swap part into the pure **HTLC** level, makes it into an open and interoperable protocol that any of these networks can participate in and enables multi-hop routing. One can use _Lightning_ where it makes sense, pay directly between _Liquid_ and _Cashu_, or hop through two different _Fedimint_ bridges before reaching the receiver at _Arkade_.

## Can a router steal my payment?

No. A router cannot redeem an HTLC without the `preimage` such that `sha256(R) == payment_hash`, and it cannot produce that preimage without the receiver revealing it. Once the receiver reveals it that is equivalent to the receiver issuing a receipt for the payment.

Every hop is enforced by the network it sits on, using that layer's own HTLC construction, so the guarantee does not depend on the router's honesty. Each individual network can have bugs in its logic or be controlled by some malicious actor that may steal the HTLC, but that loss is part of the risk each router accepts when they decide to bridge that specific network.

## Does this system need its own wallet?

No. Existing wallets do not have to implement multiple layer protocols &mdash; they can remain focused on their single layer and add Cassis as a thin layer on top of their normal operation.

## Can a merchant receive payments while offline?

Yes, on layers that support asynchronous HTLC creation (such as Cashu, Arkade, Fedimint, Rootstock and Liquid). A gateway can accept any number of incoming Cassis payments on the payee's behalf noncustodially while the payee's wallet is completely offline. See [offline payments](@/docs/offline-payments.md).

## Why not just use Lightning?

Lightning currently serves the purpose of being the glue between some of the existing layers, and because of its prevalence it's expected to play an important role in Cassis too. However, in practice, the bridging role Lightning plays today relies heavily on centralized gateways and swap providers (such as Boltz), and most wallet integrations hardcode these central players directly. Abstracting away that single-provider dependency into an open routing market would be a big win on its own &mdash; and we need a generic system that doesn't *require* Lightning as an intermediary and can evolve without it if necessary.

For networks like Bark and Spark, for example, the Lightning gateway is centralized and can't be opted out of. For Fedimint it is in theory open, but most federations end up using the same gateway. Arkade has had problems in the past with their Lightning gateway going out of business, and the barrier to entry for running a Cashu mint is much higher today because it requires every mint operator to run its own Lightning node. In all these cases, Cassis can be a simpler and better solution.

## How does Cassis compare to swap services like Boltz, Atomiq, or Kaleidoswap?

Services like Boltz and Atomiq are centralized swap providers, and projects like Kaleidoswap focus on being applications or DEXs where users go to explicitly trade assets.

Cassis has a different goal: it is not a swap service or a standalone trading app, but an open, decentralized **payments protocol**. Rather than making users manually swap funds between layers, Cassis is meant to be integrated directly into wallets so that every cross-layer payment seamlessly becomes a routed swap under the hood. Neither the sender, the recipient, nor their wallets need to juggle multiple networks or care which layer the other party is using.

## Is Cassis safe to use yet?

It is experimental software under active development. The protocol logic is small and auditable, but the implementation is young. Only put in money you are comfortable losing, see the [quickstart](@/docs/quickstart.md).

## What happens if a payment gets stuck?

If something fails midway (a router goes offline, the payee never claims), the payment can't complete, but nobody can take your funds: claiming any HTLC needs the preimage, which only the payee has. What can happen is that your funds stay locked until your HTLC expires, which for a long route can be a few hours ([timeouts](@/docs/how-it-works.md#timeouts) explains why). After that, `cassis-wallet sync` refunds them, and every router on the way does the same. A payment that fails before your HTLC is locked, e.g. because a router refused it, costs nothing and you can retry right away.
