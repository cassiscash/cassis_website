+++
title = "How it works"
description = "The mental model behind Cassis: routes, hops, hashes and timeouts."
weight = 2
+++

The description of the lifecycle of a routing node and the actions taken by a payer should give you a picture of how the system works.

At its core it's just a set of HTLCs that get resolved atomically, the coordination and communication part is where most of the complexity lies, but it's still simple enough.

## The routing nodes

Any `cassis-cli` node can route: enable the networks you want to bridge (`cassis-cli enable <network>...`), fund a wallet on each, and run it with `cassis-cli run --route`, optionally setting your fees with `--fee-base-msat` and `--fee-ppm`. The node then routes between every pair of its networks. Support for each layer lives in its own crate (`cassis-cashu`, `cassis-arkade`, ...), compiled into `cassis-cli` as features.

While we can call "Fedimint" a **layer**, a **network**, in Cassis terms, is a particular system of that, e.g. the "Orange Club Africa" federation. For some layers, like _Rootstock_, there are only the mainnet and testnet networks.

Such a node announces each direction it routes on Nostr (see [path finding](@/docs/path-finding.md)) and runs an **Iroh** node that will be listening for incoming connections from anyone. Whenever someone connects they can send a `PREPARE` message containing the intention of routing a payment between any two of the supported networks of this router, to which the router can reply if it accepts or not the terms (including fee, default timeout and the next hop of the route) of the deal. The router can use the information in that message and the identity of the peer contacting it to judge whether it can and whether it's wise to accept the proposal.

After confirming, next the node will receive an `EXECUTE` message associated with the initial `PREPARE`. The `EXECUTE` message includes a `payment_hash` (a random 32-byte string) and information about an incoming HTLC in the incoming network. The node should then verify whether that HTLC was created correctly targeting itself and using the specified `payment_hash` and timeouts, then create an outgoing HTLC and reply with information about it.

Later, the routing node will receive a `COMMIT` message containing the `preimage` such that `sha256(preimage) == payment_hash` and be able to redeem the incoming HTLC. If that doesn't happen, it has to watch the network where the outgoing HTLC was created, to gather the `preimage` from the very act of claiming it by the next hop node, and then claim the incoming HTLC. If the outgoing HTLC is not claimed that means something went wrong and the payment wasn't completed. Once the HTLC expires the node refunds it to itself (see [failures and refunds](#failures-and-refunds)).

## The payer

The protocol logic lives in the `cassis-core` crate, which wallets embed together with the crates of the layers they support; `cassis-cli` is one such wallet. The payment process starts with the receiver issuing an invoice specifying an amount, a `payment_hash` and any number of networks a payment can be accepted in.

Upon receiving that, the payer can consult the routing nodes it knows exist and trace a route between them. For example, if the receiver accepts payments on _Arkade_ and the payer can pay on the "Minibits" _Cashu_, it might find a router that bridges from that to _Liquid_, and another that bridges from _Liquid_ to _Arkade_.

Once the payer has the route, it sends a `PREPARE` message to each node in the route, then starts the process by creating its own HTLC to the first hop node and sending an `EXECUTE` message to it, then relaying the information from its response to the second hop and so on. Until it gets to the receiver, who then replies with a `COMMIT` message containing the `preimage`, which is then relayed to each hop so they can immediately settle their HTLCs.

## Timeouts

Every HTLC in a route has an expiry, and they decrease from the payer to the payee. A router must be able to claim its incoming HTLC after learning the preimage at the last possible moment, which is when its outgoing HTLC expires. So the payer planning the route gives each router a gap between its two HTLCs: the router's announced **incoming delta** (how long its incoming network needs to get a claim through, see the defaults in [layers](@/docs/layers.md)) plus its **transit slack** (time to set up its outgoing HTLC). The payee's HTLC must also stay claimable while the route is being set up.

The payer's lock therefore grows with every hop. For a payment from Arkade through Cashu and Rootstock to a Fedimint payee:

| Leg | Received on | Expires after |
|---|---|---|
| payer → router 1 | Arkade | 92 min |
| router 1 → router 2 | Cashu | 71 min |
| router 2 → router 3 | Rootstock | 65 min |
| router 3 → payee | Fedimint | 44 min |

A successful payment settles in seconds, and these times only matter when it fails: they are how long funds can stay locked. Some networks also limit how long an HTLC they receive may run (an Arkade HTLC must end before its coins' batch expires, see [layers](@/docs/layers.md)). Routers announce that limit, invoices carry the payee's, and payers only pick routes in which every leg fits. If no route fits, the payer's error says which leg would run too long.

## Failures and refunds

A payment can stop midway: a router goes offline, the payee never claims, a claim transaction fails. Nobody can take funds that were not theirs (claiming needs the preimage), but HTLCs already locked stay locked until they expire. Then:

- Each party whose outgoing HTLC was never claimed refunds it to itself once it expires, on its own, without asking anyone.
- A router whose outgoing HTLC was claimed learns the preimage from that claim and has its incoming delta left to claim upstream. If it was offline, it still gets paid as long as it is back before its incoming HTLC expires.
- Refunds need the node to be running: routers always are, but a payer has to keep its wallet open (`cassis-cli run`) or open it again after the expiry. Until then, the payment shows as pending.

The longest wait is the payer's lock, the first row of the table above. Some ledgers count expiries in blocks, which can make a refund go through a few blocks later than planned.

