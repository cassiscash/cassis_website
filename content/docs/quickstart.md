+++
title = "Quickstart"
description = "Send your first interlayer payment with Cassis in a few steps."
weight = 1
+++

> **Experimental software.** Cassis is early-stage and under active
> development. Only deposit money you are comfortable losing, for now.

## 1. Install cassis-cli

The only supported wallet today is **cassis-cli**:

```text
$ git clone https://github.com/cassiscash/cassis
$ cd cassis
$ cargo install --path cassis-cli
```

You will need **two instances**, each on a different network &mdash; one to pay
and one to receive. They can run on the same machine with different node
directories (`--home`).

## 2. Enable a network on each instance

This example pays from _Arkade_ to a _Fedimint_ federation (see
[layers](@/docs/layers.md) for every network id):

```text
$ cassis-cli --home ~/.cassis-sender enable arkade
$ cassis-cli --home ~/.cassis-receiver enable fedimint::<invite_code>
```

## 3. Deposit into the sender wallet

Get a boarding address, send bitcoin to it and, once it confirms, onboard it
into spendable funds:

```text
$ cassis-cli --home ~/.cassis-sender arkade address
$ cassis-cli --home ~/.cassis-sender arkade onboard
$ cassis-cli --home ~/.cassis-sender arkade balance
```

## 4. Check there is a route

Routers announce themselves on Nostr (see [path finding](@/docs/path-finding.md)).
Make sure at least one route connects your two networks:

```text
$ cassis-cli --home ~/.cassis-sender route \
    --from arkade \
    --to fedimint::<invite_code> \
    --amount-msat 21300000
```

## 5. Create an invoice on the receiver wallet

On the receiving instance, ask for a payment:

```text
$ cassis-cli --home ~/.cassis-receiver invoice \
    --amount-msat 21300000 \
    --network fedimint::<invite_code> \
    --description "lunch" \
    --wait
```

This generates a fresh secret `R`, keeps it local, and prints an invoice
carrying only the hash `H = sha256(R)`. With `--wait` the node keeps running
until the invoice is paid, so it can claim the payment.

## 6. Pay the invoice on the sender wallet

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
