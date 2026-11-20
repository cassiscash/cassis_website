+++
title = "How it works"
description = "The mental model behind Cassis: routes, hops, hashes and timeouts."
weight = 2
+++

The description of the lifecycle of a routing node and the actions taken by a payer should give you a picture of how the system works.

At its core it's just a set of HTLCs that get resolved atomically, the coordination and communication part is where most of the complexity lies, but it's still simple enough.

## The routing nodes

Routing is its own daemon, `cassis-routerd`. Its `config.toml` lists the networks it opens (each with a wallet key) and one `[[routes]]` entry per direction it offers, with `fee_base_msat` and `fee_ppm`; the configured base fee is added to what claiming on the incoming network costs. A `cassis-wallet` only pays and receives, routing is not one of its commands. Support for each layer lives in its own crate under `networks/` (`cassis-cashu`, `cassis-arkade`, ...), compiled into `cassis-wallet` and `cassis-routerd` as features.

While we can call "Fedimint" a **layer**, a **network**, in Cassis terms, is a particular system of that, e.g. the "Orange Club Africa" federation. For some layers, like _Rootstock_, there are only the mainnet and testnet networks.

Such a router announces each direction it routes on Nostr (see [path finding](@/docs/path-finding.md)) and runs an **Iroh** node that will be listening for incoming connections from anyone. Whenever someone connects they can send a `PREPARE` message containing the intention of routing a payment between any two of the supported networks of this router, to which the router can reply if it accepts or not the terms (including fee, default timeout and the target the next hop must be funded to) of the deal. The router can use the information in that message and the identity of the peer contacting it to judge whether it can and whether it's wise to accept the proposal.

After confirming, next the node will receive an `EXECUTE` message associated with the initial `PREPARE`. The `EXECUTE` message includes the descriptor of the incoming HTLC and the target its outgoing HTLC must be funded to. The node should then verify whether the incoming HTLC was created correctly, targeting the claim key it returned and using the agreed `payment_hash`, amount and timeout, then create an outgoing HTLC and reply with its descriptor.

Later, the routing node will receive a `SETTLE` message containing the `preimage` such that `sha256(preimage) == payment_hash` and be able to redeem the incoming HTLC. If that doesn't happen, it has to watch the network where the outgoing HTLC was created, to gather the `preimage` from the very act of claiming it by the next hop node, and then claim the incoming HTLC. If the outgoing HTLC is not claimed that means something went wrong and the payment wasn't completed. Once the HTLC expires the node refunds it to itself (see [failures and refunds](#failures-and-refunds)).

## The payer

The protocol logic lives in the `cassis-core` crate, which wallets embed together with the crates of the layers they support; `cassis-wallet` is one such wallet. The payment process starts with the receiver issuing an invoice specifying an amount, a `payment_hash` and any number of networks a payment can be accepted in.

Upon receiving that, the payer can consult the routing nodes it knows exist and trace a route between them. For example, if the receiver accepts payments on _Arkade_ and the payer can pay on the "Minibits" _Cashu_, it might find a router that bridges from that to _Liquid_, and another that bridges from _Liquid_ to _Arkade_.

Once the payer has the route, it connects directly to each node on the route over **Iroh** &mdash; including directly to the receiver node. Because the payer speaks directly to every hop rather than passing messages blindly down a chain, payments are fast and simple with far less room for mysterious routing errors (total payment speed is only constrained by how long it takes to issue an HTLC on each layer, which in most cases is instant). Because Iroh handles NAT traversal out of the box, routing nodes and merchants can operate from home behind NAT without issue, and because Iroh supports **Tor**, peers can also choose to remain completely private (though neither home routing nor direct home receiving requires Tor; see [privacy](@/docs/privacy.md)).

The payer sends a `PREPARE` to every router concurrently and tells the receiver which HTLC it will be committed, which the receiver may refuse. It then funds its own HTLC to the first hop and sends `EXECUTE` to it, relaying each response to the next hop. Once the last router has funded the final HTLC, the payer sends `COMMIT` to the receiver; the receiver verifies and claims it and returns the preimage, which the payer fans out to every router with `SETTLE` so they can immediately settle their HTLCs. A `DISCARD` releases the reservations of an attempt that will not proceed; `EXECUTE` and `COMMIT` may answer *pending* while an incoming HTLC becomes final, and the payer repeats the same request until it gets the outcome.

## Timeouts

Every HTLC in a route has an expiry, and they decrease from the payer to the payee. A router must be able to claim its incoming HTLC after learning the preimage at the last possible moment, which is when its outgoing HTLC expires &mdash; or later, because a network opens its refund path by its own clock, which can lag behind wall time. So the payer gives each router a gap between its two HTLCs: the router's announced **incoming delta** (its incoming network's claim margin plus its outgoing network's **outgoing lag**, see the tables in [layers](@/docs/layers.md), unless the router's operator sets it otherwise), which carries all the slack the router wants. The payee's HTLC gets the payee's own margin (carried in its invoice, or the network's default).

The payer's lock therefore grows with every hop. For a payment from Arkade through Cashu and Rootstock to a Fedimint payee:

| Leg | Received on | Expires after |
|---|---|---|
| payer → router 1 | Arkade | 213 min |
| router 1 → router 2 | Cashu | 191 min |
| router 2 → router 3 | Rootstock | 125 min |
| router 3 → payee | Fedimint | 44 min |

A successful payment settles in seconds, and these times only matter when it fails: they are how long funds can stay locked. Routers also cap how long an incoming HTLC may run (`max_htlc_secs`, three days by default) and refuse a `PREPARE` that asks for longer, before anything is locked. Some networks additionally constrain what they can receive: an Arkade HTLC must end before its coins' batch expires (see [layers](@/docs/layers.md)).

## Failures and refunds

A payment can stop midway: a router goes offline, the payee never claims, a claim transaction fails. Nobody can take funds that were not theirs (claiming needs the preimage), but HTLCs already locked stay locked until they expire. Then:

- Each party whose outgoing HTLC was never claimed refunds it to itself once it expires, on its own, without asking anyone.
- A router whose outgoing HTLC was claimed learns the preimage from that claim and has its incoming delta left to claim upstream. If it was offline, it still gets paid as long as it is back before its incoming HTLC expires.
- Refunds need the node to run its checks: routers always run, but a wallet is stateless between commands, so run `cassis-wallet sync` to let it settle its payments and refund expired HTLCs. Until then, the payment shows as pending.

The longest wait is the payer's lock, the first row of the table above. Some ledgers count expiries in blocks, which can make a refund go through a few blocks later than planned.
