# Unauthenticated Instagram Scraping — Research & Feature Matrix

**Research date:** 2026-05-23
**Goal:** Build an Instagram intel scraper that requires **zero auth** from users (no sessionid, no cookies, no login).
**Approach:** Tested every known unauthenticated Instagram API + adjacent GitHub tools live against real targets.

---

## TL;DR

There's exactly ONE official-grade unauthenticated Instagram endpoint that works: **`web_profile_info`**. It returns a remarkably rich payload (profile metadata + 12 recent posts + bio_links + external_url + business flags). Layered on top, we can add 6 unique enrichment features that no competitor on Apify offers — pushing this from "another Instagram scraper" into a differentiated B2B intel product.

**Critical limit:** Without auth, we CANNOT directly extract `public_email` / `public_phone_number` from Instagram itself. But we CAN extract them from the linked website + bio text via regex — which is what we'd ship instead.

---

## What works without auth — verified live test results

| Endpoint | URL | Status | Returns | Verdict |
|---|---|---|---|---|
| **Profile info** | `i.instagram.com/api/v1/users/web_profile_info/?username=X` | ✅ **200** | Full profile JSON, 12 recent posts, bio_links, external_url, business flags | **GOLDMINE** |
| Profile HTML page | `www.instagram.com/{user}/` | ✅ 200 | og:meta tags only (follower count in og:description) | Fallback only |
| Post embed page | `www.instagram.com/p/{shortcode}/embed/` | ✅ 200 | Caption + media (no engagement) | Limited |
| oEmbed | `api.instagram.com/oembed/?url=...` | ✅ 200 | HTML embed widget only | Useless for data |
| Signed-body lookup | `i.instagram.com/api/v1/users/lookup/` | 🛑 **429** | Obfuscated email/phone (when works) | **Dead at any scale** |
| Hashtag endpoint | `i.instagram.com/api/v1/tags/web_info/?tag_name=X` | ❌ **404** | — | Dead |
| Search endpoint | `www.instagram.com/web/search/topsearch/` | ❌ **401** | — | Auth-only |
| GraphQL query | `www.instagram.com/api/graphql` | ❌ varies | doc_id rotates every 2-4 weeks | Too brittle |
| Followers/following | various | ❌ | — | Auth-only (no exceptions) |
| Stories/Reels | various | ❌ | — | Auth-only |
| Comments list | various | ❌ | — | Auth-only |

---

## The gold mine: what `web_profile_info` actually returns

Full fields available **without any cookies or auth headers** (verified live against `@zomato`, `@biryanibykilo`, `@plumgoodness`, `@shaadiwish`, `@mokobara`):

### Identity fields
- `id`, `fbid`, `eimu_id` (Instagram user ID + Facebook ID)
- `username`
- `full_name`
- `pronouns`
- `category_name`, `category_enum`, `overall_category_name`, `business_category_name`
- `transparency_label`, `transparency_product`

### Profile content
- `biography` (full bio text)
- `bio_links[]` (structured array of links Instagram lets you add to bio — title + url for each)
- `external_url`, `external_url_linkshimmed` (primary website)
- `profile_pic_url`, `profile_pic_url_hd`

### Account flags
- `is_verified`, `is_verified_by_mv4b`
- `is_business_account`, `is_professional_account`
- `is_private`
- `is_joined_recently`
- `is_embeds_disabled`
- `is_regulated_c18` (adult-content gate)
- `should_show_category`, `should_show_public_contacts` ← **signals if account has contact info hidden behind auth**

### Contact fields (always `null` without auth, but field NAMES expose what exists)
- `business_email`
- `business_phone_number`
- `business_address_json`
- `business_contact_method` (`"UNKNOWN"` without auth, otherwise `"EMAIL"`, `"CALL"`, `"TEXT"`)

### Counts
- `edge_followed_by.count` (followers)
- `edge_follow.count` (following)
- `edge_owner_to_timeline_media.count` (total posts)
- `highlight_reel_count`

### Recent posts (12 most recent, full metadata)
- `edge_owner_to_timeline_media.edges[]` — first 12 posts with:
  - `id`, `shortcode`, `display_url`
  - `is_video`, `dimensions`, `video_view_count`
  - `edge_media_to_caption` (full caption text)
  - `edge_media_to_comment.count` (comments)
  - `edge_liked_by.count`, `edge_media_preview_like.count` (likes)
  - `edge_media_to_tagged_user.edges[]` (tagged users)
  - `location` (if tagged)
  - `taken_at_timestamp`
  - `accessibility_caption` (alt-text)
  - `coauthor_producers` (collabs)

### Things returned but EMPTY without auth (don't rely on these)
- `edge_related_profiles.count` → 0
- `edge_mutual_followed_by.count` → 0
- `edge_saved_media.count` → 0
- `edge_media_collections.count` → 0

---

## Rate limit reality

**Per scrapfly research:** ~200 requests per hour per IP for unauthenticated access.

**Per Instaloader community:** 1-2 requests every 30 seconds for cloud/datacenter IPs (stricter than residential).

**Practical implication for Apify actor:**
- Use **Apify Residential Proxy** (rotating IPs) → safely 50-200/hour per user
- Add 1-3 second jitter between requests
- For 1000-username batches, expect 30-90 minute run times (acceptable for B2B)

---

## GitHub tools surveyed

| Tool | Stars | Auth req? | Useful for us? |
|---|---|---|---|
| [megadose/Toutatis](https://github.com/megadose/Toutatis) | 2K | ✅ Required (sessionid) | Reference for endpoint structure only |
| [drawrowfly/instagram-scraper](https://github.com/drawrowfly/instagram-scraper) | 830 | ✅ Required (claims "no login" but most features need sessionid) | Misleading; not useful |
| [instaloader/instaloader](https://github.com/instaloader/instaloader) | 8K+ | Anonymous mode supported for profile only | Confirms anonymous limits we found |
| [ahmedrangel/instagram-media-scraper](https://github.com/ahmedrangel/instagram-media-scraper) | 181 | GraphQL method works no-auth | Useful for single-post scraping (future feature) |
| [FKLC/IGQL](https://github.com/FKLC/IGQL) | 87 | No-auth | **Archived 2021, dead** |
| [MmdUnion/instagram-scraper](https://github.com/MmdUnion/instagram-scraper) | small | No-login + residential proxy | Confirms the proxy approach |
| [scrapfly.io/blog](https://scrapfly.io/blog/posts/how-to-scrape-instagram) | (article) | — | Best technical overview (paywalled API service) |

**Conclusion:** Nothing on GitHub does what we're proposing — a layered enrichment scraper that combines web_profile_info + bio regex + website crawling + multi-link expansion.

---

## Apify competitor analysis — what features they DON'T have

Comparison of top no-cookies Instagram actors on Apify (verified live, 2026-05-23):

| Feature | apify/instagram-scraper (25.8K MAU) | scraping_solutions/no-cookies (889 MAU) | louisdeconinck/following (268 MAU) | **Us (planned)** |
|---|---|---|---|---|
| Profile metadata | ✅ | ✅ | partial | ✅ |
| Recent posts | ✅ (deep crawl) | ❌ | ❌ | ✅ (12 from API) |
| Followers/following list | ❌ (needs auth) | ✅ | ✅ | ❌ |
| Bio text | ✅ | partial | ❌ | ✅ |
| `external_url` exposed | partial | ❌ | ❌ | ✅ |
| `bio_links` (multi-link array) | ❌ | ❌ | ❌ | **✅ UNIQUE** |
| **Regex email from bio text** | ❌ | ❌ | ❌ | **✅ UNIQUE** |
| **Regex phone from bio text** | ❌ | ❌ | ❌ | **✅ UNIQUE** |
| **WhatsApp/Telegram link detection** | ❌ | ❌ | ❌ | **✅ UNIQUE** |
| **Website crawler enrichment** | ❌ | ❌ | ❌ | **✅ UNIQUE** |
| **Multi-link expander (linktr.ee/beacons)** | ❌ | ❌ | ❌ | **✅ UNIQUE** |
| **Engagement rate calculation** | ❌ | ❌ | ❌ | **✅ UNIQUE** |
| **Bulk username processing** | ✅ | ✅ | ✅ | ✅ |
| Apify policy on contact extraction | Refused | (not their use case) | (not their use case) | (our differentiator) |

**6 unique features no competitor has.** This is meaningful product differentiation.

---

## The full feature plan — Tier 1 → Tier 6

### Tier 1 — Core profile extraction (foundational)
For each input username, hit `web_profile_info` and return:
- All identity fields (id, username, full_name, category)
- All counts (followers, following, posts, highlights)
- All flags (is_business, is_verified, is_private, should_show_public_contacts)
- Profile pic URLs (regular + HD)
- 12 most recent posts (id, caption, likes, comments, is_video, timestamp)

**Cost to user:** ~$0.005/username (qualifier tier)

### Tier 2 — Bio regex extraction (unique feature)
On the `biography` field, apply regex:
- **Email regex** — catches `hello@brand.com` style
- **Anti-bot email regex** — catches `hello [at] brand.com`, `hello (at) brand dot com`
- **Phone regex** — international format with Indian +91 priority
- **WhatsApp link** — `wa.me/+...` patterns
- **Telegram link** — `t.me/...` patterns
- **YouTube channel link** in bio
- **LinkedIn link** in bio

**Tested:** `@shaadiwish` bio contained `sendyourwish@shaadiwish.com` → extracted successfully via regex.

### Tier 3 — bio_links + external_url extraction (unique feature)
- `external_url` (primary linked site)
- `bio_links[]` — ALL the structured links Instagram lets accounts add (Pinterest, blog, store locator, secondary websites)

**Tested:** `@biryanibykilo` returned 2 `bio_links`: YouTube playlist + "Reserve your table" store-locator URL.

### Tier 4 — Website crawler enrichment (unique feature)
For the `external_url` (and each `bio_links[]` URL), best-effort fetch:
- Try `/`, `/contact`, `/contact-us`, `/about` paths
- Browser-realistic User-Agent
- Apify Residential Proxy to bypass Cloudflare/Shopify bot blocks
- Extract:
  - Emails from `mailto:` links + plain text
  - Phones from `tel:` links + plain text
  - Business address from JSON-LD (`schema.org/PostalAddress`)
  - Social profile links (Facebook, Twitter, LinkedIn, YouTube, etc.)
  - Business hours from JSON-LD

**Realistic hit rate:** 30-60% of business sites will yield contact info (some Shopify/Wix/SquareSpace block aggressively).

### Tier 5 — Multi-link expander (unique feature)
Detect popular "link in bio" services and expand them:
- `linktr.ee/X`
- `beacons.ai/X`
- `bio.link/X`
- `lnk.bio/X`
- `linkin.bio/X`
- `koji.to/X`
- `withkoji.com/X`
- `solo.to/X`
- `taplink.cc/X`

For each, fetch the page and extract ALL the links. Then optionally apply Tier 4 to each one.

**Tested:** `@plumgoodness` external_url is `https://linktr.ee/plumgoodness.com` — we can expand this and get their full link tree.

### Tier 6 — Computed metrics & quality signals (unique feature)
From the 12 recent posts + counts, derive:
- **Engagement rate** = avg(likes + comments) / follower_count
- **Posting frequency** = posts per week from last 12 post timestamps
- **Recently active** = boolean, is latest post in last 90 days?
- **Fake follower signal** = high follower count + abnormally low engagement rate (<0.5%)
- **Top hashtags** = aggregate hashtags from last 12 post captions
- **Top mentions** = aggregate @mentions from last 12 post captions
- **Avg likes**, **avg comments**, **avg video views** (for video posts)
- **Niche detection** = simple keyword-classify the bio + recent captions into ['food', 'beauty', 'tech', 'fitness', 'fashion', 'travel', 'finance', 'gaming', 'education', 'B2B']

---

## What we'll NOT ship (out of scope)

These features need authentication OR are too brittle:

- Followers/following lists (needs sessionid + 2FA challenges)
- Stories / Reels listing (needs sessionid)
- Comments on posts (needs sessionid + GraphQL doc_id rotation)
- Hashtag search (endpoint dead unauthenticated)
- Location-based search (endpoint dead unauthenticated)
- Direct messages (auth + ToS violation)
- Bulk follower scraping (auth + heavy rate limit + ban risk)
- `business_email` / `business_phone_number` directly from IG (gated)

---

## Realistic positioning

**Product name (proposed):** Instagram Profile Intel — `anshumanatrey/instagram-profile-intel`

**Target audience (in priority):**
1. B2B sales reps targeting SMB Instagram accounts
2. Influencer-marketing agencies vetting creators
3. Lead-gen agencies serving D2C brands
4. Recruiters checking candidate online presence
5. Brand safety + competitor intel

**Differentiation pitch:**
> "Most Instagram scrapers stop at profile metadata. We don't. We extract every contact-relevant signal — bio emails/phones, multi-link expansion, website crawling, engagement quality scoring — in a single per-username call. Zero authentication required, ever."

**Pricing model (PPE):**
- `$0.005` actor-start
- `$0.02` per username processed (qualifier-only mode, Tier 1+2+3 only)
- `$0.05` per username processed (full enrichment mode, all 6 tiers)

**Revenue ceiling estimate (12 months):** $200-700/month based on hybrid model comparable to `louisdeconinck/instagram-following-scraper` (268 MAU).

---

## Architecture sketch

```
┌─────────────────────────────────┐
│ Input: array of usernames OR    │
│ array of Instagram URLs         │
└────────────┬────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 1: web_profile_info per username                  │
│ (Apify Residential Proxy, 1-3s jitter, 200/hr/user)     │
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 2: Bio regex extraction                            │
│ (in-memory, no HTTP)                                     │
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 3: External URL + bio_links collection             │
│ (extract URLs from response)                             │
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 4: Multi-link expander (if linktr.ee, beacons, etc)│
│ (fetch + parse + collect child links)                    │
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 5: Website crawler enrichment                      │
│ (residential proxy, /contact + /about + JSON-LD parse)   │
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 6: Compute engagement metrics + niche detection    │
│ (math on counts + keyword classification)                │
└────────────┬────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────┐
│ Push dataset record per username │
│ + final summary record           │
└─────────────────────────────────┘
```

---

## Risks & open questions

| Risk | Mitigation |
|---|---|
| `web_profile_info` deprecated by Instagram | Fallback to og:meta tags scraping from profile HTML page |
| Rate limit on Apify shared IPs | Apify Residential Proxy (rotating) |
| Website crawler blocked by Cloudflare/Shopify | Realistic browser UA + residential proxy; gracefully skip failures |
| Apify ethics policy concerns | We only extract publicly visible data; no auth = no ToS bypass |
| DPDP (India) compliance | Document in README: "verify existing leads, not build cold-spam lists" |
| Competitor copies in 30 days | First-mover advantage + better implementation + brand momentum |

---

## Sources

- [Scrapfly: How to Scrape Instagram in 2026](https://scrapfly.io/blog/posts/how-to-scrape-instagram) — current endpoint inventory
- [megadose/Toutatis on GitHub](https://github.com/megadose/Toutatis) — reference for endpoint discovery
- [drawrowfly/instagram-scraper](https://github.com/drawrowfly/instagram-scraper) — community implementation
- [Instaloader anonymous mode docs](https://instaloader.github.io/troubleshooting.html) — rate limit guidance
- [ahmedrangel/instagram-media-scraper](https://github.com/ahmedrangel/instagram-media-scraper) — GraphQL post-extraction approach
- [Apify Residential Proxy docs](https://docs.apify.com/platform/proxy/usage) — rotation + sticky sessions
- Live API tests against @zomato, @biryanibykilo, @plumgoodness, @shaadiwish, @mokobara, @mongodb, @paytm, @devrev, @amul_india (May 23, 2026)

---

## Decision needed

**Recommended path:** Ship a v1 with Tier 1 + 2 + 3 (core profile + bio regex + external_url) at `$0.02/username`. Validate for 30 days. If MAU > 20, add Tier 4 (website crawler) + Tier 6 (engagement metrics) in v1.1 at a higher tier price. Add Tier 5 (multi-link expander) in v1.2 once we see traction.

This way we ship something genuinely valuable in 4-6 hours of dev work, validate it works, then layer complexity in response to real demand instead of pre-building features that may not be valuable.
