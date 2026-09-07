+++
title = "Run a router"
description = "Become a Cassis router and carry interlayer payments for a fee."
weight = 4
+++

## What a router does

A Cassis router holds liquidity across two or more networks and extends HTLC
chains between them. For every hop it carries it charges a small fee, and every
hop it takes is bound by the same hash and timeout guarantees as any other leg
&mdash; a router can never run away with the funds.

## Get the software

```text
$ cargo install --path cassis-cli
```

## Fund the networks you want to bridge

Use `cassis-cli` to deposit funds on every network you plan to route between.
For example, a router bridging Arkade, Liquid and Cashu:

```text
$ cassis-cli arkade deposit
$ cassis-cli liquid deposit
$ cassis-cli cashu receive
```

## Run the router

```text
$ cassis-cli router \
    --network arkade \
    --network liquid \
    --network cashu::mint.example.com
```

The router announces itself on Nostr and starts accepting route proposals. Its
announcement carries the networks it bridges and its fees, so senders and the
explorer can discover it.

## The announcement event

A router publishes one **kind `35515`** event per direction it offers. The
event is a signed Nostr note whose `pubkey` is the router's identity, with the
route spelled out in its tags:

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
    ["transit_slack_secs", "60"],
    ["relay", "wss://relay.example.com"]
  ]
}
```

Each event announces a **single directed edge** `from -> to`, carried in the
`d` tag as `<network_from>-><network_to>`. A router bridging both directions
publishes two events, one per direction. Tags:

- `d` &mdash; the directed route `<from>-><to>`, e.g. `liquid->arkade`. The
  `NetworkId` strings follow the scheme documented in [Layers](@/docs/layers.md).
- `iroh` &mdash; the router's Iroh peer id (value 1) and optional relay URL
  (value 2), used to reach the router over Iroh.
- `fee_base_msat` &mdash; flat fee in millisatoshis added to every payment the
  hop carries.
- `fee_ppm` &mdash; proportional fee, parts-per-million of the forwarded amount.
- `incoming_delta_secs` &mdash; per-hop timelock budget in seconds: the time
  this hop needs between receiving the incoming HTLC and forwarding the outgoing
  one. `0` or absent means senders fall back to a per-network default.
- `transit_slack_secs` &mdash; extra buffer (seconds) the sender adds to
  deadlines to absorb in-flight latency and clock skew. `0` or absent means
  senders fall back to a global default.
- `relay` &mdash; a Nostr relay (repeatable) where the announcement is
  published and where the router can be reached.

Senders filter for kind `35515` events, keep only those fresher than 24 hours,
parse the tags into a `RouteAnnouncement`, and run a shortest-path search over
the resulting directed graph.

## Lightning is special

For Lightning there is no embedded wallet. Run **LND** to manage the channel
wallet, and let the Cassis router connect to it over the LND REST API:

```text
$ cassis-cli router \
    --network lightning \
    --lnd-rest-url https://127.0.0.1:8080 \
    --lnd-tls-cert /path/to/tls.cert \
    --lnd-macaroon /path/to/admin.macaroon
```

The router drives hold invoices through LND; it never touches your LND seed and
you keep full control of the channels.
