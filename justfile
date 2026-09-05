set shell := ["bash", "-uc"]

output := "public"

# run local dev server (autoreload + sass watch)
dev:
    zola serve

# build production site
build:
    zola build

# clean build output
clean:
    rm -rf {{output}}

# build and preview prod locally
preview:
    zola build && zola serve

# deploy to cloudflare pages
deploy: build
    wrangler pages deploy {{output}} --project-name cassis
