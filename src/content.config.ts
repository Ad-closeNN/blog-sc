import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().optional().default(false),
    description: z.string().optional().default(""),
    image: z.string().optional().default(""),
    tags: z.array(z.string()).optional().default([]),
    category: z.string().optional().nullable().default(""),
    showcover: z.boolean().optional().default(true),
    customcover: z.string().optional().default(""),
    pinned: z.boolean().optional().default(false),
    outdated: z.boolean().optional().default(false),
    lang: z.string().optional().default(""),
    aiSummary: z.string().optional().default(""),
    aiSummaryModel: z.string().optional().default(""),
  }),
})

export const collections = { posts }
