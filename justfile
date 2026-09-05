set shell := ["bash", "-uc"]

output := "public"

css:
    npx @tailwindcss/cli -i input.css -o static/site.css --minify

css-watch:
    npx @tailwindcss/cli -i input.css -o static/site.css --watch

# run local dev server (autoreload + css watch)
dev:
    zola serve

# build production site
build: css
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
