+++
title = "How it works"
description = "The mental model behind Cassis: routes, hops, hashes and timeouts."
weight = 2
+++

The description of the lifecycle of a routing node and the actions taken by a payer should give you a picture of how the system works.

At its core it's just a set of HTLCs that get resolved atomically, the coordination and communication part is where most of the complexity lies, but it's still simple enough.

## The routing nodes

Cassis comes with a `router` daemon that can be compiled with support for a set of layers. When you run it, you decide what networks you'll route through.

While we can call "Fedimint" a **layer**, a **network**, in Cassis terms, is a particular system of that, e.g. the "Orange Club Africa" federation. For some layers, like _Rootstock_, there are only the mainnet and testnet networks.

Such node will run an **Iroh** node that will be listening for incoming connections from anyone. Whenever someone connects they can send a `PREPARE` message containing the intention of routing a payment between any two of the supported networks of this router, to which the router can reply if it accepts or not the terms (including fee, default timeout and the next hop of the route) of the deal. The router can use the information in that message and the identity of the peer contacting it to judge whether it can and whether it's wise to accept the proposal.

After confirming, next the node will receive an `EXECUTE` message associated with the initial `PREPARE`. The `EXECUTE` message includes a `payment_hash` (a random 32-byte string) and information about an incoming HTLC in the incoming network. The node should then verify whether that HTLC was created correctly targeting himself and using the specified `payment_hash` and timeouts, then create an outgoing HTLC and reply with information about it.

Later, the routing node will receive a `COMMIT` message containing the `preimage` such that `sha256(preimage) == payment_hash` and be able to redeem the incoming HTLC. If that doesn't happen, it has to watch the network where the outgoing HTLC was created, to gather the `preimage` from the very act of claiming it by the next hop node, and then claim the incoming HTLC. If the outgoing HTLC is not claimed that means something went wrong and the payment wasn't completed. After some pre-specified time the node can reclaim it to itself.

## The payer

Cassis comes with a `cassis-client` crate that can manage funds in any layer and be used to make payments. The payment process starts with the receiver issuing an invoice specifying an amount, a `payment_hash` and any number of networks a payment can be accepted in.

Upon receiving that, the payer can consult the routing nodes it knows exist and trace a route between them. For example, if the receiver accepts payments on _Arkade_ and the payer can pay on the "Minibits" _Cashu_, it might find a router that bridges from that to _Liquid_, and another that bridges from _Liquid_ to _Arkade_.

Once the payer has the route, it sends a `PREPARE` message to each node in the route, then starts the process by creating its own HTLC to the first hop node and sending an `EXECUTE` message to it, then relaying the information from its response to the second hop and so on. Until it gets to the receiver, who then replies with a `COMMIT` message containing the `preimage`, which is then relayed to each hop so they can immediately settle their HTLCs.
