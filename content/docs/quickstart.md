+++
title = "Quickstart"
description = "Send your first interlayer payment with Cassis in a few steps."
weight = 1
+++

## What you need

- A wallet on any [supported layer](@/docs/layers.md) (source)
- A receiver willing to generate a secret `R` (destination)
- One Cassis router serving both layers (or a chain of them)

## 1. Request a payment

The receiver creates a payment request containing the hash of a fresh secret:

```text
  cassis:?amount=21300&h=a3f9c1...&dst=fedimint:gepperto@federation.example
```

The receiver **never publishes** `R` until it is time to claim.

## 2. Find a route

Ask the router mesh for a path from your layer to the destination layer:

```text
$ cassis route --from arkade --to fedimint --hash a3f9c1... --amount 21300

  hop 0  arkade      21,300 msat  cltv 144
  hop 1  liquid      21,288 msat  cltv 96    fee 12 msat
  hop 2  fedimint    21,276 msat  cltv 0     fee 12 msat
```

## 3. Lock the source hop

Your wallet creates the first HTLC &mdash; on ark, a VTXO with a hash-lock
branch:

```text
  claim:   sha256(preimage) == a3f9c1... before cltv 144
  refund:  back to sender after cltv 144
```

The router sees the lock and extends the chain downstream, hop by hop, until
the destination is covered.

## 4. Claim and settle

The receiver reveals `R` against the final hop. The preimage cascades
backwards and every leg settles. Your wallet watches it happen:

```text
$ cassis watch --hash a3f9c1...

  [ok] fedimint   settled   21,276 msat
  [ok] liquid     settled   21,288 msat
  [ok] arkade     consumed  21,300 msat
```

Total cost: two hop fees (24 msat above). Trust added: zero.

## Next steps

- Read [how it works](@/docs/how-it-works.md) for the full mental model.
- Browse the source on [GitHub](https://github.com/cassiscash/cassis).
