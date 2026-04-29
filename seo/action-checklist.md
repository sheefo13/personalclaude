# SEO Action Checklist — The Arab Card Game
Priority order: do the top items first, they have the highest ROI.

---

## Week 1 — Technical Foundation (highest impact, one-time work)

- [ ] **Google Search Console** — verify your site at search.google.com/search-console. Submit sitemap.xml. This is free and tells Google you exist.
- [ ] **Bing Webmaster Tools** — same as above for Bing (also reaches Arab users in UAE, Saudi via Edge browser).
- [ ] **Add meta tags** — copy `head-meta-tags.html` into every page's `<head>`. At minimum: title, description, og:title, og:description, og:image.
- [ ] **Add structured data** — add the Organization JSON-LD to every page. Add Product JSON-LD to each product page. Add FAQPage JSON-LD to your FAQ page.
- [ ] **Upload sitemap.xml** — use `sitemap-template.xml` as a base. Upload to your site root.
- [ ] **Check page speed** — run both product pages through pagespeed.web.dev. Score should be 80+ on mobile. Slow pages rank lower AND lose mobile Arab Diaspora buyers.
- [ ] **Fix URL slugs** — make sure product URLs include the game name: `/products/arab-card-game-original` not `/products/12345`.
- [ ] **Add alt text to all images** — every product photo needs a descriptive alt tag (see page-copy-rewrites.md).

---

## Week 2 — On-Page Content

- [ ] **Rewrite H1 headings** — one H1 per page, keyword-rich (see page-copy-rewrites.md).
- [ ] **Rewrite product descriptions** — use the templates in page-copy-rewrites.md.
- [ ] **Create FAQ page** — use the questions from structured-data.json + page-copy-rewrites.md. This captures long-tail searches.
- [ ] **Add "Ships worldwide" copy** — mention specific countries (US, UK, Canada, Australia, UAE, etc.) on product pages. Diaspora buyers search "[product] shipping to [country]".
- [ ] **Add social proof** — star ratings, review counts, and 1-2 quoted testimonials on every product page.

---

## Week 3 — Off-Page & Community (builds authority over time)

- [ ] **Arab American community groups** — post authentically in Facebook groups like "Arabs in [City]", Arab Student Association groups, Arab diaspora subreddits (r/arabs, r/lebanese, etc.). Don't spam — share your story.
- [ ] **Arab influencers / creators** — send free games to Arab TikTok/Instagram creators in the US, UK, Canada, Australia. Even 1 viral video can drive thousands of visits.
- [ ] **Arab Student Associations** — reach out to ASA chapters at US universities. Offer a bulk discount. They run events that need games.
- [ ] **Arab-American news sites** — pitch your story to Arab America (arabamerica.com), Arab News English edition. A feature article = massive backlink + traffic.
- [ ] **Get listed on gift guides** — reach out to "Arab gift", "Middle Eastern gift", "cultural gift" Etsy, gift curators, and blog round-ups. Ask for inclusion or offer to write a guest post.
- [ ] **Google Business Profile** — create one even if you're online-only. Adds credibility and shows in searches.

---

## Ongoing — Content Marketing

- [ ] **Write 1 blog post per month** — use the keyword targets in keyword-strategy.md. Each post targets a different search query and funnels to your product pages.
- [ ] **Seasonal landing pages** — create dedicated pages for Eid, Ramadan, and the holiday season. Publish 4-6 weeks early. Delete/redirect after (or archive).
- [ ] **Collect and publish reviews** — email every customer post-purchase asking for a review. Reviews improve conversion AND give you social proof copy.
- [ ] **Build an email list** — add a signup form ("Get 10% off your first order"). Email is the highest-ROI owned channel; it's not SEO but amplifies everything else.

---

## Arabic Language (medium-term — high payoff)

- [ ] **Add an Arabic version of the site** (even just the homepage and product pages). Use `hreflang` tags (see head-meta-tags.html). Arab users in Gulf countries often search in Arabic.
- [ ] **Translate product descriptions into Arabic** — use a native speaker, not just Google Translate.
- [ ] **Add Arabic to your og:locale:alternate tag** — improves WhatsApp/Facebook preview for Arabic-speaking sharers.

---

## Metrics to track (free tools)

| Metric | Tool | Target |
|---|---|---|
| Organic search traffic | Google Search Console | Growing month-over-month |
| Keyword rankings | Google Search Console > Performance | Appear for "arab card game" top 3 |
| Page speed | PageSpeed Insights | 80+ mobile score |
| Conversion rate | Shopify/analytics | 2–4% of visitors buying |
| Backlinks | Google Search Console > Links | Growing over time |
