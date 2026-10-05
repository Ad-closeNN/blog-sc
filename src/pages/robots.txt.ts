import type { APIRoute } from "astro"

import { site } from "@/config"

const sitemapUrl = new URL("/sitemap-index.xml", site.url).toString()

const body = `User-agent: *
Allow: /
Disallow: /?tag=

Disallow: /search-index.json

Sitemap: ${sitemapUrl}
`

export const GET: APIRoute = () =>
  new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
