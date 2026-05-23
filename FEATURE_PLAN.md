# Final v1 Feature Plan — Ship Everything Now

**Date:** 2026-05-23
**Goal:** Add every shippable no-auth feature in ONE release. No v1.1+ deferrals.

---

## Competitive matrix — full sweep (live data 2026-05-23)

Comparison across all Instagram-data actors with ≥50 MAU:

| Feature | apify/instagram-scraper (25.8K MAU) | apify/instagram-profile (15.3K MAU) | data-slayer/cookieless (50 MAU) | scraping_solutions/no-cookies (889 MAU) | louisdeconinck (268 MAU) | **Us (current)** | **Us (planned)** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Profile metadata | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recent posts | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `bio_links[]` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Bio email extraction | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Bio phone extraction | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| WhatsApp/Telegram/YT links from bio | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Engagement rate | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Engagement quality classification | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Account age estimation | ❌ | ❌ | partial (paid tier) | ❌ | ❌ | ✅ | ✅ |
| Posting pattern (best hour/day) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Communication style (emoji+lang) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Hashtag pattern + branded detection | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Coauthor/collab detection | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Cross-platform username check | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (6 plats) | ✅ **(8 plats)** |
| External URL og:metadata | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Multi-link expander (linktr.ee+) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Niche auto-detection | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **SMTP/MX email verification** | ❌ | ❌ | ✅ ($12/1k tier) | ❌ | ❌ | ❌ | **✅ NEW (MX)** |
| **IG capabilities (has_clips, channels, etc.)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Top/worst performing post identification** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Hashtag campaign detection** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Top mentioned accounts (graph)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Pincode/postal code from bio** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW (India focus)** |
| **All URLs in bio (not just structured)** | ❌ | ❌ | partial | ❌ | ❌ | ❌ | **✅ NEW** |
| **Country code from /about page** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Twitter/X presence (GET-based)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Facebook page presence** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Tech stack detection (Shopify/Wix/etc)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Profile pic metadata (dimensions/size)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| **Bio link health check (200/404)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ NEW** |
| Followers/following lists | ❌ (their policy) | ❌ | ❌ | ✅ | ✅ | ❌ (auth req) | ❌ (auth req — skip) |
| Stories/Reels feed | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (auth req) | ❌ (auth req — skip) |
| Comments | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (auth req — skip) |

**After v1 ship: 25 features. Closest competitor (data-slayer) has 8.**

---

## What we tested and KILLED (saves time vs initially planned)

| Idea | Verdict | Why |
|---|---|---|
| WhatsApp existence check via `wa.me/{phone}` | ❌ Useless | Returns 200 for ALL phones even fake. No signal. |
| `/about` page deep extraction for `date_joined` | ❌ JS-rendered | data-slayer must use auth — we can't get this. Only `country_code` extractable. |
| Wayback Machine for IG profiles | ❌ Dead | Meta blocks Wayback bot |
| `/users/{id}/info/` for premium fields | ❌ Empty | Returns only 6 trivial fields without auth |
| Post embed deep parse | ❌ Low ROI | 810KB JS-heavy HTML, complex to parse for marginal data |

---

## v1 FINAL ship list (every shippable no-auth feature)

### A. Zero-extra-HTTP wins (4 new features, 0 cost)

**A1. `instagramCapabilities`** — surface 7 boolean flags from existing response
- `hasClips` (does reels marketing)
- `hasChannel` (broadcast channel — premium creator)
- `hasGuides` (content curator)
- `hasOnboardedToThreads` (multi-channel brand)
- `hideEngagement` (hides likes/views)
- `isRegulatedC18` (adult content flag)
- `aiAgentOwnerUsername` (if AI agent)

**A2. `topPost` + `worstPost`** — best + worst engagement of last 12, with shortcode + URL

**A3. `hashtagCampaigns`** — hashtags appearing in 3+ posts (active campaigns)

**A4. `topMentionedAccounts`** — frequency-sorted list of @mentions in captions (influencer graph)

**A5. `pincode`** — Indian postal code (6 digits) regex from bio

**A6. `allBioUrls`** — every URL in bio text (vs just structured `bio_links[]`)

### B. Light HTTP wins (5 new features, +2-3 HTTP per profile)

**B1. `countryCode`** — from `/{username}/about` page (proven to expose `IN`, `US`, etc.)

**B2. Cross-platform expansion** — add Twitter/X (GET-based) + Facebook to existing 6 platforms → **8 total**

**B3. `mxValidatedEmails`** — for each extracted email, DNS MX lookup. Returns `{email, hasValidMx, mxRecords}`. Free, no API key needed.

**B4. `techStack`** — detect Shopify (`x-shopid` header), Wix, WordPress, Webflow, Squarespace, Stripe Checkout from external URL response

**B5. `profilePicMeta`** — HEAD profile pic, return dimensions + content-type + size

### C. Optional heavy toggle (default ON)

**C1. `bioLinkHealth`** — HEAD each `bio_link[]` URL, return alive/dead/redirect status

---

## NOT shipping (would need auth or paid APIs)

- Followers/following lists (auth)
- Stories/Reels feed (auth)
- Post comments (auth)
- Hashtag search (dead endpoint)
- Story highlights media (auth)
- SMTP HELO email verification (would need a paid service like MillionVerifier; we ship MX-only which is 80% of the value for free)
- TinEye/Bing reverse image (paid)

---

## Implementation order

1. Add helper functions (~250 lines)
2. Wire into main pipeline loop
3. Update INPUT_SCHEMA with `bioLinkHealthCheck` toggle
4. Update output_schema with new columns
5. Update README to reflect 25 features
6. Live test on 3 real profiles
7. Push

**Estimated dev time:** 3-4 hours including test + README.
