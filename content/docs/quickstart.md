+++
title = "Quickstart"
description = "Send your first interlayer payment with Cassis in a few steps."
weight = 1
+++

> **Experimental software.** Cassis is early-stage and under active
> development. Only deposit money you are comfortable losing, for now.

## Get a supported wallet

The only supported wallet today is **cassis-cli**:

```text
$ cargo install --path cassis-cli
```

You will need **two instances**, each on a different network &mdash; one to pay
and one to receive. They can run on the same machine with different config
directories (`--home`).

## Check the router mesh

Before choosing your networks, visit
[explorer.cassis.cash](https://explorer.cassis.cash) to see which routers are
active and which networks they bridge. Pick a source and destination that are
actually connected.

## 1. Deposit into the sender wallet

Fund the wallet on the network you will pay from:

```text
$ cassis-cli --home ~/.cassis-sender arkade deposit
$ cassis-cli --home ~/.cassis-sender liquid deposit
$ cassis-cli --home ~/.cassis-sender rootstock info
```

## 2. Create an invoice on the receiver wallet

On the receiving instance, ask for a payment:

```text
$ cassis-cli --home ~/.cassis-receiver invoice \
    --amount 21300 \
    --network fedimint \
    --payee geppetto@fedimint \
    --description "lunch"
```

This generates a fresh secret `R`, keeps it local, and prints an invoice
carrying only the hash `H = sha256(R)`.

## 3. Pay the invoice on the sender wallet

Hand the invoice to the sender and pay:

```text
$ cassis-cli --home ~/.cassis-sender pay \
    --invoice '{"...": "..."}' \
    --from arkade
```

The wallet finds a route through the router mesh, locks the source hop, and the
preimage cascades back as every leg settles. That's it.

## Next steps

- Read [how it works](@/docs/how-it-works.md) for the full mental model.
- See how routers announce themselves in [path finding](@/docs/path-finding.md).
- Browse the source on [GitHub](https://github.com/cassiscash/cassis).
