+++
title = "FAQ"
description = "Questions you might have about the Cassis protocol."
weight = 5
+++

## Is Cassis a token?

No. Cassis moves **satoshis** that already exist on each layer. No new asset
is minted, no bridge custody is created, nothing is wrapped.

## Is a Cassis payment custodial?

Per hop, as custodial as the layer itself. On-chain and channel hops are
non-custodial by script; mint and federation hops inherit exactly the trust of
the mint or federation. Intermediaries are bound by HTLCs &mdash; they cannot
run away with funds, only lock them until timeout.

## What happens if a router disappears mid-payment?

Their hop times out and refunds upstream. Because timeouts decrease along the
route, downstream legs settle or refund *before* upstream money is at risk.
Worst case: a delayed refund, never a loss to a contract holder.

## Why SHA-256 for the route hash?

Every candidate layer can evaluate it: Lightning mandates it, Liquid and
Rootstock expose it as an opcode/precompile, ark scripts and ecash mints can
check it cheaply. One hash function everywhere keeps routes uniform.

## Does this compete with Lightning?

No &mdash; Lightning is a first-class citizen. Cassis uses Lightning's own
HTLCs for any hop touching the network and is designed to make Lightning the
cheapest router inside multi-layer paths.

## Can I run a router?

Yes. A router is any service that (1) watches locks for hashes it knows,
(2) extends matching locks downstream, (3) claims with revealed preimages.

## Is there a testnet?

Router implementations run against the layers' own testnets/signets. The
quickstart examples work unchanged with testnet endpoints.
