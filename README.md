# cassis.cash

Source for the Cassis website — a [Zola](https://www.getzola.org/) static site with
Tailwind CSS compiled via the standalone CLI.

## Local development

```sh
just tailwind   # compile static/site.css once
just dev        # zola serve + Tailwind watch
just build      # production build into ./public
```

Requires [Zola](https://www.getzola.org/documentation/getting-started/installation/) and Node.js 20+.

## Deployment

Every push to `master` triggers `.github/workflows/deploy.yml`, which:

1. installs Zola (pinned in the workflow's `ZOLA_VERSION`),
2. compiles Tailwind into `static/site.css`,
3. runs `zola build` into `public/`,
4. force-publishes `public/` to the `gh-pages` branch (with `.nojekyll` and `CNAME`).

The workflow can also be run manually from the **Actions** tab (`workflow_dispatch`).

### One-time repository setup

1. **Workflow permissions** — Settings → Actions → General → Workflow permissions →
   *Read and write permissions* (the workflow needs to push to `gh-pages`). Or ensure the
   org policy allows `contents: write` for this repo.
2. **Publish source** — Settings → Pages → *Build and deployment* → Source:
   **Deploy from a branch** → Branch: **`gh-pages`**, folder **`/ (root)`**, then Save.
   (`gh-pages` appears in the list after the first successful workflow run.)
3. **Custom domain** — Settings → Pages → *Custom domain*: enter `cassis.cash` and Save.
   The domain is also committed as `static/CNAME`, so it survives every deploy even if
   the build artifacts replace the branch contents.
4. **Enforce HTTPS** — tick *Enforce HTTPS* once GitHub has issued the certificate
   (can take up to 24 hours after DNS is correct).

### DNS configuration for `cassis.cash`

DNS is hosted on Cloudflare (`gabriel.ns.cloudflare.com`, `riya.ns.cloudflare.com`).
The zone points at GitHub Pages with **DNS-only** records (grey cloud) — do not enable
Cloudflare proxying on these, because GitHub has to terminate TLS and issue the
certificate itself.

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| `A` | `@` | `185.199.108.153` | DNS only |
| `A` | `@` | `185.199.109.153` | DNS only |
| `A` | `@` | `185.199.110.153` | DNS only |
| `A` | `@` | `185.199.111.153` | DNS only |
| `AAAA` | `@` | `2606:50c0:8000::153` | DNS only |
| `AAAA` | `@` | `2606:50c0:8001::153` | DNS only |
| `AAAA` | `@` | `2606:50c0:8002::153` | DNS only |
| `AAAA` | `@` | `2606:50c0:8003::153` | DNS only |
| `CNAME` | `www` | `cassiscash.github.io` | DNS only |

Leave the Zoho mail records untouched (`MX mx.zoho.in/mx2/mx3`, SPF and DKIM TXT), as
well as the `demo-stores` and `mint.mutinynet` A records.

Inspect or edit the records with Cloudflare's `cf` CLI (installed at
`~/npm_modules/bin`, not on `PATH` by default):

```sh
cf dns records list -z cassis.cash
cf dns records batch -z cassis.cash --deletes @deletes.json --posts @posts.json
```

Verify propagation with:

```sh
dig cassis.cash +noall +answer -t A
dig www.cassis.cash +noall +answer
```

With the apex configured, GitHub redirects `www.cassis.cash` to `cassis.cash`
automatically (and HTTPS is issued for both).

### Notes

- `config.toml` already uses `base_url = "https://cassis.cash"`, so canonical URLs and
  `get_url()` links resolve against the custom domain, not `*.github.io`.
- GitHub Pages is the only deployment target; the previous Cloudflare Pages setup has
  been retired.
- There is no `package-lock.json` yet; the workflow uses `npm install`. Committing a
  lockfile and switching to `npm ci` would make builds reproducible.
