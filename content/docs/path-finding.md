+++
title = "Path finding"
description = "How routers announce themselves, and how payers and routers decide which nodes to trust."
weight = 3
+++

Nobody keeps a central directory of routers. Instead, every routing node announces itself publicly on **Nostr** and every participant builds its own local graph out of those announcements.

A router publishes one **kind `35515`** event per direction it offers. The event is a signed Nostr note whose `pubkey` is the router's node key, with the hop parameters in its tags:

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

Each event announces a **single directed edge** `from -> to`, carried in the `d` tag as `<network_from>-><network_to>`. A router bridging both directions publishes two events, one per direction. Tags:

- `d` &mdash; the directed route `<from>-><to>`, e.g. `liquid->arkade`. The `NetworkId` strings follow the scheme documented in [Layers](@/docs/layers.md).
- `iroh` &mdash; the router's Iroh peer id (value 1) and optional relay URL (value 2), used to reach the router over Iroh.
- `fee_base_msat` &mdash; flat fee in millisatoshis added to every payment the hop carries. It already includes what claiming on the incoming network costs.
- `fee_ppm` &mdash; proportional fee, parts-per-million of the forwarded amount.
- `incoming_delta_secs` &mdash; the gap in seconds this hop needs between the expiries of its outgoing and incoming HTLCs: how long, after learning the preimage at the last moment, it needs to get its claim through on the incoming network, plus how late its outgoing HTLC's refund path can open on the outgoing network. It carries all the slack the hop wants: payers add nothing to it. The router's operator can set it; by default it is computed from the two networks. Absent means the incoming network's default margin (see [layers](@/docs/layers.md)).
- `testmoney` &mdash; a valueless tag marking the hop as moving test money. Test routers announce on the test relays, separate from the default ones.

Because the tags are self-describing, a payer can compute the total price and every HTLC's expiry of a route *before* contacting anyone (see [timeouts](@/docs/how-it-works.md#timeouts)).

## Building the graph

A participant collects kind `35515` events from the relays it talks to, parses each set of tags into a `RouteAnnouncement`, and keeps the freshest announcement per `(pubkey, d)` pair. Each surviving announcement becomes one directed edge in a local graph whose nodes are **networks** and whose edges are **routers**. Path finding is then a Dijkstra shortest-path search over that graph, with the cost of an edge being that router's `fee_base_msat` plus its `fee_ppm` share of the amount being sent. The payer then computes every leg's amount and expiry from the payee's delta and the hops' `incoming_delta_secs`, and nothing else; a router can still refuse the `PREPARE` if the HTLC would outlive its `max_htlc_secs`.

## Filtering out invalid nodes

An announcement is a *claim*, not a guarantee. Announcements can be stale, malformed, or simply lies (a Sybil attacker can mint thousands of identities and flood the network with fake edges).

To mitigate that, we can use some strategies:

- **Freshness.** Routing nodes re-announce their routes every 3h, and payers looking at the graph discard announcements older than 24h.
- **Proof of Bitcoin ownership.** If nodes can prove they control something on-chain that makes mass identity generation expensive.
- **Attestations from trusted or known peers.** Participants that have a relationship with a node or have successfully routed payments through it before can publish attestations to their integrity, which would make them more accessible.

In the beginning, the Sybil resistance mechanism is not necessary, but once the network is large and valuable enough there will be peers trying to disrupt it, so the other measures can be layered on top.

## A rating system

The attestations mentioned before are important not only for Sybil-resistance, they also serve the purpose of identifying bad or unreliable actors whose lack of responsiveness can cause others to waste time and lose some money on HTLC creation fees.

This system isn't developed yet.
