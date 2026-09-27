+++
title = "Path finding"
description = "How routers announce themselves, and how payers and routers decide which nodes to trust."
weight = 3
+++

Nobody keeps a central directory of routers. Instead, every routing node announces itself publicly on **Nostr** and every participant builds its own local graph out of those announcements.

A router publishes one **kind `35515`** event per direction it offers. The event is a signed Nostr note whose `pubkey` is the router's identity, with the hop parameters in its tags:

```json
{
  "kind": 35515,
  "pubkey": "<router nostr pubkey>",
  "tags": [
    ["d", "liquid->arkade"],
    ["iroh", "<iroh peer id>", "<iroh relay url>"],
    ["fee_base_msat", "1000"],
    ["fee_ppm", "500"],
    ["incoming_delta_secs", "300"],
    ["transit_slack_secs", "60"]
  ]
}
```

Each event announces a **single directed edge** `from -> to`, carried in the `d` tag as `<network_from>-><network_to>`. A router bridging both directions publishes two events, one per direction. Tags:

- `d` &mdash; the directed route `<from>-><to>`, e.g. `liquid->arkade`. The `NetworkId` strings follow the scheme documented in [Layers](@/docs/layers.md).
- `iroh` &mdash; the router's Iroh peer id (value 1) and optional relay URL (value 2), used to reach the router over Iroh.
- `fee_base_msat` &mdash; flat fee in millisatoshis added to every payment the hop carries.
- `fee_ppm` &mdash; proportional fee, parts-per-million of the forwarded amount.
- `incoming_delta_secs` &mdash; per-hop timelock budget in seconds: the time this hop needs between receiving the incoming HTLC and forwarding the outgoing one. `0` or absent means senders fall back to a per-network default.
- `transit_slack_secs` &mdash; extra buffer (seconds) the sender adds to deadlines to absorb in-flight latency and clock skew. `0` or absent means senders fall back to a global default.

Because the tags are self-describing, a payer can compute the total price and the total time budget of a route *before* contacting anyone.

## Building the graph

A participant collects kind `35515` events from the relays it talks to, parses each set of tags into a `RouteAnnouncement`, and keeps the freshest announcement per `(pubkey, d)` pair. Each surviving announcement becomes one directed edge in a local graph whose nodes are **networks** and whose edges are **routers**. Path finding is then a Dijkstra shortest-path search over that graph, with the cost of an edge being that router's `fee_base_msat` plus its `fee_ppm` share of the amount being sent, subject to the per-hop `incoming_delta_secs` and `transit_slack_secs` budget.

## Filtering out invalid nodes

An announcement is a *claim*, not a guarantee. Announcements can be stale, malformed, or simply lies (a Sybil attacker can mint thousands of identities and flood the network with fake edges).

To mitigate that, we can use some strategies:

- **Freshness.** Routing nodes re-announce the availability of their routes at least once every 24h, and payers looking at the graph discard older announcements.
- **Proof of Bitcoin ownership.** If nodes can prove they controls something on-chain that makes mass identity generation expensive.
- **Attestations from trusted or known peers.** Participants that have a relationship with a node or have successfully routed payments through it before can publish attestations to their integrity, which would make them more accessible.

In the beginning, the Sybil resistance mechanism is not necessary, but once the network is large and valuable enough there will be peers trying to disrupt it, so the other measures can be layered on top.

## A rating system

The attestations mentioned before are important not only for Sybil-resistance, they are also serve the purpose of identifying bad or unreliable actors whose lack of responsiveness can cause others to waste time and lose some money on HTLC creation fees.

This system isn't developed yet.
