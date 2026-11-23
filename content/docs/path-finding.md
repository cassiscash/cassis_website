+++
title = "Path finding"
description = "How routers announce themselves, and how payers decide which nodes to use."
weight = 3
+++

There is no central directory of routers. Each routing node announces its routes on **Nostr**, and payers build a local graph from those announcements.

A router publishes one **kind `35515`** event per direction it offers. The event is signed with the router's node key (`pubkey`) and carries the hop parameters in its tags:

```json
{
  "kind": 35515,
  "pubkey": "<router nostr pubkey>",
  "tags": [
    ["d", "liquid->arkade"],
    ["iroh", "<iroh peer id>", "<iroh relay url>"],
    ["fee_base_msat", "1000"],
    ["fee_ppm", "500"],
    ["incoming_delta_secs", "600"]
  ]
}
```

Each event announces a single directed edge `from -> to` in the `d` tag. A router that bridges both directions publishes two events. Tags:

- `d` &mdash; the directed route `<from>-><to>`, e.g. `liquid->arkade`. Network IDs follow the format in [Layers](@/docs/layers.md).
- `iroh` &mdash; the router's Iroh peer ID (value 1) and optional relay URL (value 2).
- `fee_base_msat` &mdash; flat fee in millisatoshis per payment, including the router's cost to claim on the incoming network.
- `fee_ppm` &mdash; proportional fee in parts per million of the forwarded amount.
- `incoming_delta_secs` &mdash; the gap in seconds this hop needs between its outgoing and incoming HTLC expiries: enough time to claim on the incoming network if it learns the preimage at the last moment, plus any clock lag on the outgoing network's refund path. It includes all the slack the hop needs; payers add nothing to it. By default it is computed from the two networks (or falls back to the incoming network's default margin if omitted; see [layers](@/docs/layers.md)), and operators can override it.
- `testmoney` &mdash; marks the hop as moving test money. Test routers publish to separate test relays.

From these tags alone, a payer can calculate the total fee and every HTLC expiry across a route before contacting any node (see [timeouts](@/docs/how-it-works.md#timeouts)).

## Building the graph

A payer fetches kind `35515` events from its configured relays, parses each into a `RouteAnnouncement`, and keeps the latest announcement per `(pubkey, d)` pair. This forms a directed graph where nodes are **networks** and edges are **routers**.

Finding a route is a Dijkstra shortest-path search over that graph, weighting each edge by `fee_base_msat` plus its `fee_ppm` share of the payment amount. The payer then works backwards from the payee's expiry delta, adding each hop's `incoming_delta_secs` to compute the amount and expiry for every leg. A router can still refuse at `PREPARE` if the resulting HTLC would exceed its `max_htlc_secs`.

## Filtering out bad nodes

An announcement is just a claim. Routes can go stale, nodes can go offline or misbehave (wasting time and HTLC creation fees), and an attacker could try to flood relays with fake identities.

Payers filter the graph in two basic ways:

- **Freshness.** Routers re-announce every 3 hours, and payers ignore announcements older than 24 hours.
- **Blocking bad nodes.** Payers can manually block routers that misbehave or fail to respond.

Manual blocking only works if identities are expensive to replace &mdash; which holds as long as payers read routes from Nostr relays that charge an upfront fee to publish. By default, Cassis reads real-money routes from [`nostr.wine`](https://nostr.wine/), a paid relay, while test-money routes use free public relays (`relay.primal.net`, `nos.lol`, `relay.ditto.pub` and `relay.damus.io`). Over time, other relays may become canonical places to publish routes, and some could even vet or run quality checks on routers before listing them.

Two further mechanisms can be layered on top as the network grows, though neither is built yet:

- **Peer attestations.** Known peers could publish Nostr events attesting to a router's reliability (or warning against bad ones) to help others decide which nodes to block or prefer.
- **Trustless identity costs.** If there is appetite for avoiding reliance on paid relays, identities can also be made expensive through cryptographic proof of Bitcoin ownership (such as JoinMarket-style fidelity bonds).
