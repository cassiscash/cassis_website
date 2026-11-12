+++
title = "FAQ"
description = "Questions you might have about the Cassis protocol."
weight = 8
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

Lightning currently serves the purpose of being the glue between some of the existing layers, and because of its prevalence it's expected to play an important role in Cassis too. But we need a system that is generic and doesn't *require* Lightning and can evolve without it, if that's necessary.

For networks like Bark and Spark, for example, the Lightning gateway is centralized and can't be opted out of. For Fedimint it is in theory open, but most federations end up using the same gateway. Arkade has had problems in the past with their Lightning gateway going out of business, and the barrier to entry for running a Cashu mint is much higher today because it requires every mint operator to run its own Lightning node. In all these cases, Cassis can be a simpler and better solution.

## Does Cassis need a new invoice format?

Yes, in a way, but it can also be hacked into the BOLT11 Lightning invoice so both methods of payment are supported at first.

At the same time we are working on a related invoicing and commerce method called the [Cassis Order Protocol (COP)](@/docs/cop.md) that allows much more flexible and rich payment flows &mdash; buying items, ordering from menus, subscribing, calculating fiat prices &mdash; directly inside a wallet without relying on web technologies.

## Is Cassis safe to use yet?

It is experimental software under active development. The protocol logic is small and auditable, but the implementation is young. Only put in money you are comfortable losing, see the [quickstart](@/docs/quickstart.md).

## What happens if a payment gets stuck?

If something fails midway (a router goes offline, the payee never claims), the payment can't complete, but nobody can take your funds: claiming any HTLC needs the preimage, which only the payee has. What can happen is that your funds stay locked until your HTLC expires, which for a long route can be an hour or two ([timeouts](@/docs/how-it-works.md#timeouts) explains why). After that your wallet refunds them on its own, as long as it is running, and so does every router on the way. A payment that fails before your HTLC is locked, e.g. because a router refused it, costs nothing and you can retry right away.
