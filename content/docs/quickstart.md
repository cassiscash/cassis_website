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

## 1. Install cassis-wallet

The reference wallet is **cassis-wallet**:

```text
$ git clone https://github.com/cassiscash/cassis
$ cd cassis
$ cargo install --path cassis-wallet
```

You will need **two instances**, each on a different network &mdash; one to pay
and one to receive. They can run on the same machine with different node
directories (`--home`).

## 2. Enable a network on each instance

This example pays from the public mutinynet _Arkade_ operator to the
mutinynet _Cashu_ mint (see [layers](@/docs/layers.md) for every network
id):

```text
$ cassis-wallet --home ~/.cassis-sender enable arkade::mutinynet
$ cassis-wallet --home ~/.cassis-receiver enable cashu::cashu.mutinynet.com
```

## 3. Deposit into the sender wallet

Get a boarding address, send it some sats from the
[faucet](https://faucet.mutinynet.com) and, once it confirms, onboard it
into spendable funds:

```text
$ cassis-wallet --home ~/.cassis-sender arkade --network arkade::mutinynet address
$ cassis-wallet --home ~/.cassis-sender arkade --network arkade::mutinynet onboard
$ cassis-wallet --home ~/.cassis-sender arkade --network arkade::mutinynet balance
```

Arkade coins expire with their batch: if the balance reads 0 some hours
later, run `onboard` again to move them into a new one.

## 4. Check there is a route

Routers announce themselves on Nostr (see [path finding](@/docs/path-finding.md)).
Because this guide uses test money, tell the wallet to use the test relays
(with `--test-relays`). Make sure at least one route connects your two
networks:

```text
$ cassis-wallet --home ~/.cassis-sender --test-relays route \
    --from arkade::mutinynet \
    --to cashu::cashu.mutinynet.com \
    --amount-msat 21300000
```

A payment only works if some router bridges your networks, directly or
through other routers. If there is none, the command says so. You can then
[run a router](#run-a-router) yourself, or pick networks that are connected.

## 5. Create an invoice on the receiver wallet

On the receiving instance, ask for a payment:

```text
$ cassis-wallet --home ~/.cassis-receiver receive \
    --amount-msat 21300000 \
    --network cashu::cashu.mutinynet.com \
    --description "lunch"
```

This generates a fresh secret `R`, keeps it local, and prints an invoice
carrying only the hash `H = sha256(R)`. `receive` keeps the node running
until the invoice is paid, so it can claim the payment; with `--gateway` it
returns at once and you claim later with `redeem`.

## 6. Pay the invoice on the sender wallet

Hand the invoice to the sender and pay:

```text
$ cassis-wallet --home ~/.cassis-sender --test-relays pay \
    --invoice '{"...": "..."}' \
    --from arkade::mutinynet
```

The wallet finds a route through the router mesh, locks the source hop, and the
preimage cascades back as every leg settles. That's it.

If the payment fails midway, your funds stay locked until your HTLC
expires (usually a few hours, depending on the route; see
[failures and refunds](@/docs/how-it-works.md#failures-and-refunds)).
The wallet is stateless between commands: nothing runs in the background.
`sync` settles its payments and refunds expired HTLCs, and `payments` lists
what moved:

```text
$ cassis-wallet --home ~/.cassis-sender sync
$ cassis-wallet --home ~/.cassis-sender payments
```

## Run a router

A router is its own daemon, **cassis-routerd**. It offers the directed
routes you configure between two or more networks, for a fee.

```text
$ cargo install --path cassis-routerd
```

Start it once, then stop it and add the networks and routes to the config
it wrote (keep its `mnemonic`):

```text
$ cassis-routerd --data-dir ~/.cassis-router
```

```toml
# ~/.cassis-router/config.toml
nostr_relays = ["wss://nos.lol", "wss://relay.primal.net", "wss://relay.damus.io"]

[networks."arkade::mutinynet"]
secret = "<64 hex characters>"

[networks."cashu::cashu.mutinynet.com"]
secret = "<64 hex characters>"

[[routes]]
from = "arkade::mutinynet"
to = "cashu::cashu.mutinynet.com"
fee_base_msat = 1000
fee_ppm = 500
test_money = true

[[routes]]
from = "cashu::cashu.mutinynet.com"
to = "arkade::mutinynet"
fee_base_msat = 1000
fee_ppm = 500
test_money = true
```

Each `secret` is that network's wallet key: 32 random bytes as 64 hex
characters, for example from `openssl rand -hex 32`. Back up the whole file:
it holds the router's mnemonic and every key, and controls its funds. The
admin page (the console prints how to reach it; see `[admin]` in the
generated file) can add networks and routes for you, and asks each wallet
for its deposit addresses.

Fund each network's wallet, then start the daemon and keep it running:

```text
$ cassis-routerd --data-dir ~/.cassis-router
```

It announces each configured direction on Nostr every 3h and serves payers
over Iroh while it runs. It claims, and refunds after failures, on its own.
`fee_base_msat` is the extra you charge, on top of what claiming on the
incoming network costs; `test_money` marks the announcement as test money,
and this example uses the test relays so real nodes do not see it. See each
network's notes in [layers](@/docs/layers.md) before funding it: Rootstock
wallets need gas for claims, and Arkade wallets must keep their coins inside
a live batch. `cassis-wallet <network kind> --help` lists each wallet's
commands; a router's wallets are managed from its admin page.

For a whole test network on one machine (local cashu mints, a fedimint
federation and an arkade operator on mutinynet, Rootstock testnet, and
scripts for payments of up to five hops and failure tests), see
[`scripts/live`](https://github.com/cassiscash/cassis/tree/master/scripts/live)
in the repository.

## Next steps

- Read [how it works](@/docs/how-it-works.md) for the full mental model.
- See how routers announce themselves in [path finding](@/docs/path-finding.md).
- Browse the source on [GitHub](https://github.com/cassiscash/cassis).
