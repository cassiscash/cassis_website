+++
title = "Documentation"
description = "Everything you need to understand, implement and ship the Cassis interlayer payment protocol."
sort_by = "weight"
template = "docs-section.html"
page_template = "docs-page.html"
+++

Cassis routes bitcoin payments *across* layers &mdash; Lightning, Liquid, Arkade,
Cashu, Fedimint, Rootstock &mdash; using chains of hash time-locked contracts
instead of trusted bridges or wrapped tokens.

Start with [how it works](@/docs/how-it-works.md) for the mental model, then
follow the [quickstart](@/docs/quickstart.md) to build your first route, or jump
to [for wallet developers](@/docs/wallets.md) to integrate Cassis and the
[Cassis Order Protocol (COP)](@/docs/cop.md) into a wallet.
[Path finding](@/docs/path-finding.md) covers how routers announce themselves
and how payers choose which ones to trust. Also see [offline payments](@/docs/offline-payments.md)
and [privacy](@/docs/privacy.md).
