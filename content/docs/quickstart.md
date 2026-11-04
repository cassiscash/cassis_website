+++
title = "Quickstart"
description = "Send your first interlayer payment with Cassis in a few steps."
weight = 1
+++

> **Experimental software.** Cassis is early-stage and under active
> development. Only deposit money you are comfortable losing, for now.

This guide uses **mutinynet**, a bitcoin test network with 30-second
blocks and a [faucet](https://faucet.mutinynet.com), so nothing here
costs real money. Swap the network ids for their mainnet ones (see
[layers](@/docs/layers.md)) once you are comfortable.

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

This example pays from the public mutinynet _Arkade_ operator to the
mutinynet _Cashu_ mint (see [layers](@/docs/layers.md) for every network
id):

```text
$ cassis-cli --home ~/.cassis-sender enable arkade::mutinynet
$ cassis-cli --home ~/.cassis-receiver enable cashu::cashu.mutinynet.com
```

## 3. Deposit into the sender wallet

Get a boarding address, send it some sats from the
[faucet](https://faucet.mutinynet.com) and, once it confirms, onboard it
into spendable funds:

```text
$ cassis-cli --home ~/.cassis-sender arkade --network arkade::mutinynet address
$ cassis-cli --home ~/.cassis-sender arkade --network arkade::mutinynet onboard
$ cassis-cli --home ~/.cassis-sender arkade --network arkade::mutinynet balance
```

Arkade coins expire with their batch: if the balance reads 0 some hours
later, run `onboard` again to move them into a new one.

## 4. Check there is a route

Routers announce themselves on Nostr (see [path finding](@/docs/path-finding.md)).
Make sure at least one route connects your two networks:

```text
$ cassis-cli --home ~/.cassis-sender route \
    --from arkade::mutinynet \
    --to cashu::cashu.mutinynet.com \
    --amount-msat 21300000
```

A payment only works if some router bridges your networks, directly or
through other routers. If there is none, the command says so, or says
why the cheapest one can't be used (e.g. a leg would run longer than its
router accepts). You can then [run a router](#run-a-router)
yourself, or pick networks that are connected.

## 5. Create an invoice on the receiver wallet

On the receiving instance, ask for a payment:

```text
$ cassis-cli --home ~/.cassis-receiver invoice \
    --amount-msat 21300000 \
    --network cashu::cashu.mutinynet.com \
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
    --from arkade::mutinynet
```

The wallet finds a route through the router mesh, locks the source hop, and the
preimage cascades back as every leg settles. That's it.

If the payment fails midway, your funds stay locked until your HTLC
expires (up to an hour or two, depending on the route; see
[failures and refunds](@/docs/how-it-works.md#failures-and-refunds)).
Your wallet refunds them once it is running after that:

```text
$ cassis-cli --home ~/.cassis-sender run
$ cassis-cli --home ~/.cassis-sender payments
```

## Run a router

A router is a node with funds on two or more networks, routing between
them for a fee. Enable the networks, fund each wallet (the funds it sends
on each side are what it can forward), and run it with `--route`:

```text
$ cassis-cli --home ~/.cassis-router enable arkade::mutinynet cashu::cashu.mutinynet.com
$ cassis-cli --home ~/.cassis-router run --route --fee-base-msat 1000 --fee-ppm 500
```

It announces both directions on Nostr every 6h and serves payers over
Iroh while it runs. Keep it running: it claims, and refunds after
failures, on its own. See each network's notes in
[layers](@/docs/layers.md) before funding it: Rootstock wallets need gas
for claims, and Arkade wallets must keep their coins inside a live batch.
`cassis-cli <network kind> --help` lists each wallet's commands.

For a whole test network on one machine (local cashu mints, a fedimint
federation and an arkade operator on mutinynet, Rootstock testnet, and
scripts for payments of up to five hops and failure tests), see
[`scripts/live`](https://github.com/cassiscash/cassis/tree/master/scripts/live)
in the repository.

## Next steps

- Read [how it works](@/docs/how-it-works.md) for the full mental model.
- See how routers announce themselves in [path finding](@/docs/path-finding.md).
- Browse the source on [GitHub](https://github.com/cassiscash/cassis).
