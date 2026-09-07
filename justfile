set shell := ["bash", "-uc"]

output := "public"

# build tailwind css
tailwind:
    npx @tailwindcss/cli -i input.css -o static/site.css --minify

# watch tailwind css
tailwind-watch:
    npx @tailwindcss/cli -i input.css -o static/site.css --watch

# build css (alias)
css: tailwind

# run local dev server (autoreload + css watch)
dev: tailwind
    npx @tailwindcss/cli -i input.css -o static/site.css --watch & zola serve

# build production site
build: tailwind
    zola build

# clean build output
clean:
    rm -rf {{output}}

# build and preview prod locally
preview: tailwind
    zola build && zola serve

# deploy to cloudflare pages
deploy: build
    wrangler pages deploy {{output}} --project-name cassis
