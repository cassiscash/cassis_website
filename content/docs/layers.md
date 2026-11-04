+++
title = "Layers"
description = "The bitcoin layers Cassis routes across, and how each one expresses an HTLC."
weight = 4
+++

## Overview

A Cassis payment is a route with any number of hops, each of which is an HTLC,
all bound to the same hash `H` and honoring strictly decreasing timeouts.
Each network expresses that HTLC in its own idiom, the preimage `R` (with
`H = sha256(R)`) is the only key that settles a hop, and a timeout always
opens a refund path.

For each layer below:

- **HTLC descriptor** is what describes a locked HTLC on the wire: the
  sender returns it in reply to `EXECUTE`, and the receiver checks it
  against the ledger before going on.
- **Default incoming delta** is how long a router needs, after learning
  the preimage at the last possible moment (when its outgoing HTLC
  expires), to get the claim of its incoming HTLC through on that
  network before the HTLC can be refunded. Each hop adds the delta of
  the network it receives on, so a route's total lock time depends on
  the networks it crosses (see [how it works](@/docs/how-it-works.md#timeouts)).

## <span style="color:#eab308">●</span> Lightning

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://github.com/lightning/bolts">BOLT</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>lightning</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">native BOLT <code>update_add_htlc</code> with <code>payment_hash</code> and <code>cltv_expiry</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">BOLT11 hold invoice (<code>payment_request</code>), sent as the outgoing target the payer pays verbatim to preserve the payment secret</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">60 min</dd>
</dl>

The hold invoice must be settled before its CLTV runs out, and that is
counted in bitcoin blocks, which can come early.

## <span style="color:#5ab7ec">●</span> Liquid

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://liquid.net">Liquid</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>liquid</code> (mainnet), <code>liquid::testnet</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">P2WSH script, <code>OP_HASH160 &lt;RIPEMD160(payment_hash)&gt;</code> claim path with CLTV refund</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">lockup outpoint (<code>lockup_txid</code> + <code>lockup_vout</code>) pinning the broadcast lockup tx, plus <code>refund_pubkey</code> and <code>refund_locktime</code>; the claim side is rebuilt from the route hash</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">10 min</dd>
</dl>

Liquid has regular one-minute blocks; the claim must confirm before the
refund path opens.

## <span style="color:#a855f7">●</span> Arkade

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://arkadeos.com/">Arkade</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>arkade</code> (arkade.computer, mainnet), <code>arkade::mutinynet</code> (the public mutinynet operator), <code>arkade::&lt;operator host&gt;</code> (each operator is a separate network)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>VhtlcScript</code> taproot tree, <code>RIPEMD160(payment_hash)</code>, seconds-based timelocks</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">VHTLC options — <code>sender</code>, <code>receiver</code>, <code>server</code> x-only keys, <code>payment_hash160</code>, <code>refund_locktime</code>, and three unilateral CSV delays (<code>unilateral_claim_delay</code>, <code>unilateral_refund_delay</code>, <code>unilateral_refund_without_receiver_delay</code>)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">20 min</dd>
</dl>

**Batch expiry.** Arkade VTXOs live in *batches*, and every VTXO expires
with the batch it descends from (VTXOs created offchain inherit their
inputs' expiry). After that the operator may sweep it, and it can no
longer be spent offchain: a VHTLC still running then could neither be
claimed nor refunded. So:

- An HTLC must be over at least **20 minutes before** the batch of its
  VHTLC expires. Receivers reject VHTLCs that are not.
- Before locking an HTLC, a sender moves coins that would expire too
  early into a new batch.
- Routers learn the operator's batch lifetime from their wallet's VTXOs,
  announce it (less the margin) as `max_incoming_lifetime_secs`, and
  refuse longer HTLCs; payers only plan routes that fit. Set it by hand
  with `cassis-cli enable <network> --max-incoming-lifetime <secs>`.
- Wallet coins older than a batch read as 0 until
  `cassis-cli arkade onboard` settles them into a new one.

**Dust.** Operators refuse outputs below their dust limit (330 sats by
default), including change: a payment smaller than that, or one that
would leave less change than that, is refused before anything is
locked.

## <span style="color:#1d4ed8">●</span> Cashu

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://cashu.space">Cashu</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>cashu::&lt;host[:port]&gt;</code> (each mint is a separate network)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">NUT-14 spending conditions on a NUT-10 HTLC secret</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">NUT-14 locked ecash proofs, one base64-encoded NUT-00 <code>Proof</code> per element</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">5 min</dd>
</dl>

Claims are a single request to the mint, timed by the mint's clock. Real
mints may charge input fees (e.g. 100 ppk), so a payee on such a mint
nets slightly less than the invoiced amount.

## <span style="color:#ef4444">●</span> Fedimint

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://fedimint.org">Fedimint</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>fedimint::&lt;invite_code&gt;</code> (each fedimint is a separate network)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">LNv2 Lightning module</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">Bolt11 invoice the counterparty must pay (fedimint sells its own preimage, so the descriptor is the invoice, not a proof set)</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">40 min</dd>
</dl>

Contracts expire after a number of bitcoin blocks, which can come early
or late: refunds may only go through a few blocks after the time the
HTLC was planned to expire.

## <span style="color:#22c55e">●</span> Rootstock

<dl class="my-6 grid grid-cols-[12rem_1fr] border-[3px] border-ink bg-card shadow-m">
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase first:border-t-0">Protocol</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem] first:border-t-0"><a href="https://rootstock.io">Rootstock</a></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">NetworkId</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>rootstock</code> (mainnet), <code>rootstock::testnet</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><a href="https://explorer.rootstock.io/address/0x3612e393cA2fbB8874854B88fFCf04307a518239?tab=contract">EtherSwap v3</a> contract, <code>sha256</code> precompile matches <code>H</code> byte-for-byte</dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">HTLC descriptor</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]"><code>contract</code> address, <code>amount_wei</code>, <code>claim_address</code>, <code>refund_address</code>, and block-height <code>timelock</code></dd>
  <dt class="border-t-2 border-ink bg-alt px-4 py-2.5 font-space text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">Default incoming delta</dt>
  <dd class="m-0 border-t-2 border-ink px-4 py-2.5 text-[0.9rem]">20 min</dd>
</dl>

Rootstock has ~30 s blocks with some variance, and its timelocks are
block heights. Claiming is a contract call, so **the receiver needs a
little RBTC for gas**, the payee included: without it the claim fails
and the whole route stays locked until it expires.
