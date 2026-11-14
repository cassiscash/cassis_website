+++
title = "Offline payments"
description = "How payees can receive payments while offline using a gateway and a preimage server."
weight = 5
+++

In a standard Cassis payment, the payer connects directly to the receiver to lock the final hop and obtain the preimage. That requires the receiver's wallet to be online when the payment happens.

Requiring an always-on wallet is fine when two people are actively coordinating, but in practice many payments happen asynchronously. Merchants and online stores need to accept payments without keeping a hot wallet exposed on a server, creators want to receive tips or sales passively, and even everyday peer-to-peer payments between friends often happen when the recipient's phone is in their pocket with no connection.

On networks that support asynchronous HTLC creation &mdash; where a sender can lock an HTLC to a recipient's public key without the recipient signing anything at that moment, such as [Cashu](@/docs/layers.md#cashu), [Arkade](@/docs/layers.md#arkade), [Liquid](@/docs/layers.md#liquid) and [Rootstock](@/docs/layers.md#rootstock) &mdash; Cassis handles offline receiving through two auxiliary parties:

- **A gateway** (inspired by a Fedimint design), which acts as the destination of the Cassis route and shares a network with the final payee.
- **A preimage server**, which holds the payment preimage and only releases it to the gateway once the gateway proves it has locked a new HTLC to the final payee.

Cassis supports two ways of running this flow: pre-created invoices and full delegation. In both, the payee signs a **receive authorization** naming both the gateway and the preimage server, with limits on validity, amount, networks, description and the minimum final timeout. A *single* authorization covers one invoice; a *standing* one lets the gateway issue invoices alone.

## 1. Pre-created invoices

In the first mode, the final payee creates the invoice ahead of time.

The invoice points to the **gateway** as the destination node for the Cassis route, so the payer knows to route the payment there. However, the invoice also carries two signatures: one from the **final payee** authorizing the gateway to receive the payment on their behalf, and one from the **gateway** itself. When the payer reads the invoice, they can see they are actually paying the final payee and verify that the gateway was authorized to take the payment. The payee's signed authorization was also handed to the preimage server, under which it issued the payment hash.

The gateway never holds the payment custodially. When the Cassis payment arrives, the funds are locked to a `payment_hash` whose preimage the gateway does not have. Instead, the preimage is held by the **preimage server**.

Suppose both the gateway and the final payee are on the same Cashu mint. When the incoming Cassis payment reaches the gateway:

1. The gateway creates a new HTLC on that Cashu mint locked to the **final payee**, using the same `payment_hash` and a long expiry &mdash; for example, two weeks.
2. Although the HTLC is locked for two weeks, the gateway does not expect to wait that long to recover its liquidity. Beforehand, the preimage server assured the gateway that it knows the preimage and will release it as soon as the HTLC is created.
3. The gateway presents the new HTLC to the preimage server. Once the preimage server verifies that the HTLC is validly locked to the final payee, it releases the preimage to the gateway and stores the HTLC descriptor for the payee.
4. The gateway uses the preimage to settle the incoming Cassis payment, immediately getting back the liquidity it put into the payee's HTLC.
5. The final payee can come back online anytime over the next two weeks, fetch the pending HTLC details from the preimage server, and claim the funds.

Because the gateway already recovered its money from the incoming Cassis payment, a well-behaved gateway will never try to refund the two-week HTLC to itself. The refund timeout on that HTLC only exists as a safety net for the gateway in case the preimage server loses the preimage or disappears in the brief moment between the gateway creating the HTLC to the payee and redeeming the incoming Cassis payment.

## 2. Delegated mode

In the fully delegated mode, the final payee does not need to create each invoice in advance. Instead, before going offline, the payee signs a single **standing authorization** that names both the **gateway** and the **preimage server**. It authorizes the gateway to issue invoices in the payee's name within limits: how long it is valid, the amount range, the networks and claim keys the gateway may pay to, an optional description every invoice must carry, and the minimum final timeout. The delegated invoice then carries that authorization (with the payee's signature) and the preimage server's issuance of its hash, in place of a per-invoice payee signature.

While the payee is offline:

1. The preimage server can generate any number of preimages on behalf of the final payee, within the authorization's limits.
2. Whenever a payer wants to pay the payee, the gateway talks directly to the preimage server to get a fresh `payment_hash` and serves the invoice.
3. When the Cassis payment arrives at the gateway, the gateway already knows it can talk to that same preimage server: it locks a long-lived HTLC to the final payee, presents it to the preimage server, gets the preimage back, and settles the incoming route.
4. Just as in the first mode, the preimage server stores the HTLC descriptors and parameters for every payment that arrived. When the final payee comes back online, they connect to the preimage server and claim all their pending payments.

## Trust model and future improvements

This design splits responsibilities so that no single party has custody of the payee's funds:

- **Final payee and preimage server:** The final payee trusts the preimage server to only release the preimage when presented with a valid HTLC locked to the payee, and to keep the HTLC parameters available until the payee returns online.
- **Gateway and preimage server:** The gateway trusts the preimage server to actually have the preimage and hand it over as soon as the gateway locks the HTLC to the payee.
- **Final payee and gateway:** There is **no trust relationship** between the final payee and the gateway.

The preimage server is a trusted third party, but it is **not custodial**. Because the HTLC is locked to the final payee's public key, neither the preimage server nor the gateway can take the money on its own; stealing a payment would require the preimage server and the gateway to collude.

In the future, the single preimage server can be replaced by a small federation &mdash; for example, three independent operators instead of one &mdash; using multiparty computation (MPC) or zero-knowledge proofs so that no single server is trusted on its own.

