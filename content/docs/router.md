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
