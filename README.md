# Instagram Profile Intel — No Login · Bio Emails · 25+ Fields

📦 **Open source · MIT:** [github.com/AnshumanAtrey/instagram-profile-intel-no-login](https://github.com/AnshumanAtrey/instagram-profile-intel-no-login)


**No Instagram login required. No cookies. No auth. No friction.** Drop in usernames. Get back 25+ structured intel layers per profile in one call.

Built for B2B sales teams, influencer-marketing agencies, lead-gen consultants, recruiters, brand-safety analysts, and competitive intelligence researchers.

## Why we beat every Instagram scraper on Apify

Most Instagram actors stop at profile metadata. We layer 25+ enrichments on top — bio email regex, multi-link expansion, engagement scoring, account age estimation, posting patterns, communication style, hashtag campaigns, top/worst post identification, cross-platform presence on 8 platforms, tech stack of their website, bio link health checks (with HEAD/GET fallback), profile picture metadata, MX email validation, pincode extraction — all in a single API call with zero authentication required.

## The 25+ enrichment layers

| Layer | Returns |
|---|---|
| 1. **Identity** | username, full_name, IG ID, Facebook ID, EIMU ID, category, pronouns |
| 2. **Counts** | followers, following, total posts, highlights |
| 3. **Account flags** | is_verified, is_business, is_professional, is_private, is_joined_recently, hide_engagement |
| 4. **IG Capabilities** | has_clips (reels), has_channel (broadcast), has_guides, has_onboarded_to_threads, has_ar_effects, is_regulated_c18, AI agent flags |
| 5. **Business contact** | `business_contact_method` preference (CALL / EMAIL / TEXT / UNKNOWN) |
| 6. **Bio + Links** | full bio, structured `bio_links[]`, `external_url`, profile pic + HD pic |
| 7. **Profile pic metadata** | dimensions / content-type / file size (HEAD verified) |
| 8. **Bio Contact Extraction** | Emails (incl. anti-bot `hello [at] domain dot com`), phones, WhatsApp/Telegram/YouTube/LinkedIn handles, ALL URLs in bio text |
| 9. **MX-validated emails** | DNS MX lookup per email — confirms domain accepts email (filters typos + fake domains) |
| 10. **Pincode (India)** | 6-digit Indian postal code extracted from bio |
| 11. **Recent posts** | 12 most recent with caption, likes, comments, video views, timestamp, tagged users, location |
| 12. **Account Age** | Estimated join year/month from user ID + age bucket (newcomer/recent/established/veteran/legacy) |
| 13. **Engagement Quality** | Rate calculation + Phlanx-tier classification (excellent/good/low/**fake-follower-signal**) |
| 14. **Posting Pattern** | Modal hour (IST + UTC), modal day of week, consistency score |
| 15. **Communication Style** | Emoji density, bio languages (en/hi detection), Hinglish flag, bio word count |
| 16. **Hashtag Pattern** | Total uses, unique count, diversity ratio, **branded hashtag detection**, top 10 |
| 17. **Hashtag Campaigns** | Hashtags used 3+ times in last 12 posts → active campaign detection |
| 18. **Top Mentioned Accounts** | Frequency-sorted @mentions in captions (influencer graph) |
| 19. **Top + Worst Post** | Best- and worst-performing post of last 12 with engagement rate + caption |
| 20. **Cross-Platform Presence** | Threads, GitHub, Reddit, YouTube, Pinterest, Spotify, **Twitter/X, Facebook** — does this username exist there? |
| 21. **External URL Metadata** | og:title, og:description, og:image, body emails + phones |
| 22. **Tech Stack Detection** | Shopify, Wix, Webflow, WordPress, Squarespace, Next.js, Vercel, Cloudflare, Stripe, Razorpay, AWS-S3 — what's behind their website |
| 23. **Bio Link Health Check** | HEAD each `bio_link[]` URL with automatic GET fallback on 405/403 (handles LinkedIn etc.) |
| 24. **Multi-Link Bio Expansion** | linktr.ee, beacons.ai, bio.link, lnk.bio, taplink, etc. — all child links extracted |
| 25. **Collab Detection** | Recent co-authored posts + who they collab with |
| 26. **Niche Auto-Detection** | food/beauty/fashion/tech/fitness/wedding/travel/B2B/etc. |

## Sample output (real `@biryanibykilo` record, May 2026)

```json
{
  "username": "biryanibykilo",
  "fullName": "Biryani By Kilo",
  "followerCount": 75988,
  "category": "Product/service",
  "isVerified": true,
  "pincode": null,

  "igCapabilities": {
    "hasClips": true,
    "hasChannel": false,
    "hasGuides": false,
    "hasOnboardedToThreads": true,
    "hideEngagement": false
  },

  "accountAge": {
    "estimatedJoinDate": "2014-12",
    "ageYears": 11.4,
    "ageBucket": "legacy"
  },

  "engagement": {
    "engagementRate": 0.0023,
    "engagementQuality": "fake-follower-signal",
    "postingFrequency": { "postsPerWeek": 4.42, "isActive": true, "lastPostDaysAgo": 1 }
  },

  "postingPattern": {
    "modalHourIST": 20,
    "modalDayOfWeek": "Friday",
    "consistencyScore": 0.33
  },

  "topPost": {
    "url": "https://www.instagram.com/p/DYaPE5GpUPw/",
    "likes": 95,
    "comments": 0,
    "videoViewCount": 4837,
    "engagementRate": 0.0013,
    "caption": "Log bolte hai ki vo abhi bhi gloves hi pehen raha he..."
  },
  "worstPost": {
    "url": "https://www.instagram.com/p/DYfS2BHtvnR/",
    "likes": 16,
    "comments": 1,
    "engagementRate": 0.0002
  },

  "crossPlatform": {
    "threads":   {"exists": true, "url": "https://www.threads.net/@biryanibykilo"},
    "github":    {"exists": true, "url": "https://github.com/biryanibykilo"},
    "youtube":   {"exists": false},
    "pinterest": {"exists": true, "url": "https://pinterest.com/biryanibykilo/"},
    "spotify":   {"exists": true, "url": "https://open.spotify.com/user/biryanibykilo"},
    "reddit":    {"exists": true, "url": "https://reddit.com/user/biryanibykilo/about.json"},
    "twitter":   {"exists": true, "url": "https://x.com/biryanibykilo"},
    "facebook":  {"exists": true, "url": "https://facebook.com/biryanibykilo"}
  },

  "externalUrlMeta": {
    "title": "Biryani by Kilo",
    "ogTitle": "Biryani By Kilo - Best Biryani Home Delivery",
    "ogDescription": "India's most Premium Biryani & Kebab delivery chain...",
    "techStack": ["aws-s3"],
    "extractedFromSite": {"emails": [], "phones": []}
  },

  "bioLinkHealth": [
    {"url": "https://web.biryanibykilo.com/", "alive": true, "status": 200},
    {"url": "https://www.youtube.com/watch?v=...", "alive": true, "status": 200},
    {"url": "http://web.biryanibykilo.com/store-locators", "alive": true, "status": 200},
    {"url": "https://docs.google.com/forms/d/.../viewform", "alive": false, "status": 404, "title": "Valentine's Day #LoveKaDum"}
  ],

  "profilePicMeta": {
    "contentType": "image/jpeg",
    "contentLength": 8032,
    "status": 200
  },

  "extractedFromBio": {"emails": [], "phones": [], "whatsappLinks": [], "allUrls": []},
  "mxValidatedEmails": null,
  "topMentions": [],
  "recentCollabs": [],
  "detectedNiche": "food",
  "recentPosts": [/* 12 posts */]
}
```

## Why this beats every Instagram scraper on Apify

| Feature | apify/instagram-scraper | data-slayer/cookieless | **Us** |
|---|:---:|:---:|:---:|
| Profile metadata | ✅ | ✅ | ✅ |
| Bio email extraction | ❌ | ✅ | ✅ |
| MX-validated emails | ❌ | partial (SMTP $12/1k tier) | ✅ (FREE in basic) |
| Bio phone extraction | ❌ | ✅ | ✅ |
| `bio_links[]` array | ❌ | ✅ | ✅ |
| Country code | ❌ | ✅ | ✅ |
| Recent posts (12) | ✅ | ❌ | ✅ |
| **Engagement rate + quality classification** | ❌ | ❌ | ✅ |
| **Account age estimation** | ❌ | partial (paid tier) | ✅ |
| **Posting pattern (best hour/day)** | ❌ | ❌ | ✅ |
| **Communication style (emoji + language)** | ❌ | ❌ | ✅ |
| **Hashtag campaign detection** | ❌ | ❌ | ✅ |
| **Branded hashtag detection** | ❌ | ❌ | ✅ |
| **Top + worst performing post** | ❌ | ❌ | ✅ |
| **Top mentioned accounts (graph)** | ❌ | ❌ | ✅ |
| **Pincode extraction (India)** | ❌ | ❌ | ✅ |
| **Cross-platform username check (8 plats)** | ❌ | ❌ | ✅ |
| **External URL og:metadata** | ❌ | ❌ | ✅ |
| **Multi-link bio expander** | ❌ | ❌ | ✅ |
| **Tech stack detection of website** | ❌ | ❌ | ✅ |
| **Bio link health check** | ❌ | ❌ | ✅ |
| **Profile picture metadata** | ❌ | ❌ | ✅ |
| **IG capabilities (clips/channel/threads)** | ❌ | ❌ | ✅ |
| **Collab/coauthor detection** | ❌ | ❌ | ✅ |
| **Niche auto-detection** | ❌ | ❌ | ✅ |
| Anti-bot obfuscated email decode | ❌ | ❌ | ✅ |

**Combined: we have 17 unique features no competitor offers.**

## Quick start

1. Paste usernames (with or without `@`, full URLs also work):
   ```
   biryanibykilo
   plumgoodness
   @shaadiwish
   https://www.instagram.com/mokobara/
   ```
2. Pick **Enrichment level**: `Full` (recommended) or `Basic`
3. Toggle individual enrichments to balance speed vs depth (default: ALL ON)
4. Click **Run**

Typical run: 50 usernames in ~5-8 minutes with all enrichments ON (parallel per profile).

## Pricing

**$0.005 actor-start + $0.05 per profile (full mode) / $0.02 per profile (basic mode).**

| Profiles (full enrichment) | Approx cost |
|---|---|
| 10 | $0.51 |
| 50 | $2.51 |
| 100 | $5.01 |
| 500 | $25.01 |
| 1000 | $50.01 |

## Common use cases

### B2B SaaS targeting verified-engagement Indian SMBs
> "Food businesses in India, 5K-50K followers, 5+ years old, ACTIVE posting, with valid email or WhatsApp in bio."

```
Filter: detectedNiche == "food" AND
        category CONTAINS "food" AND
        followerCount BETWEEN 5000 AND 50000 AND
        accountAge.ageBucket IN ["established", "veteran", "legacy"] AND
        engagement.postingFrequency.isActive == true AND
        (mxValidatedEmails ANY hasValidMx == true OR extractedFromBio.whatsappLinks.length > 0)
```

### Agency vetting influencers — kill fake-follower frauds
> "Filter creators with REAL engagement, NOT bot-padded follower counts."

```
Filter: engagement.engagementQuality IN ["excellent", "good"] AND
        crossPlatform.youtube.exists == true AND
        engagement.postingFrequency.isActive == true AND
        accountAge.ageYears > 2
```

### Lead gen with multi-link expansion
> "Plum Goodness's bio has linktr.ee — give me all their product URLs."

The `multiLinkExpanded.childLinks` field returns all 20 product links with titles. Saves hours of manual click-through.

### Tech stack intelligence for B2B targeting
> "Find brands using Shopify (to sell them a Shopify-app) or using Razorpay (to sell Indian payment infra)."

```
Filter: externalUrlMeta.techStack CONTAINS "shopify"
Filter: externalUrlMeta.techStack CONTAINS "razorpay"
```

### Brand monitoring / fake-account detection
> "Find suspiciously new accounts impersonating my brand."

```
Filter: fullName CONTAINS "mybrand" AND
        accountAge.ageBucket == "newcomer" AND
        engagement.engagementQuality == "fake-follower-signal"
```

### Competitor posting-pattern intel
> "When does my competitor post? Avoid posting at the same time."

The `postingPattern` field shows modal hour + day. Plan your launches for opposite slots.

### Dead-link surveillance for brand maintenance
> "Find businesses with broken bio links — these are easy wins for sales (offer to fix their funnel)."

```
Filter: bioLinkHealth ANY alive == false
```

## Inputs

| Field | Default | Description |
|---|---|---|
| `usernames` | required | Array of usernames or full IG URLs |
| `enrichLevel` | `full` | `basic` or `full` |
| `checkCrossPlatform` | `true` | Threads/GitHub/Reddit/YouTube/Pinterest/Spotify/Twitter/Facebook |
| `enrichExternalUrl` | `true` | og:metadata + body emails/phones + tech stack |
| `expandMultiLinkBio` | `true` | linktr.ee / beacons.ai / bio.link expansion |
| `fetchCountryCode` | `true` | 2-letter ISO from /about page |
| `validateEmailsViaMx` | `true` | DNS MX lookup per extracted email |
| `checkBioLinkHealth` | `true` | HEAD each bio_link for 200/404 |
| `fetchProfilePicMeta` | `true` | HEAD pic for dimensions/size |
| `useResidentialProxy` | `true` | Apify Residential Proxy rotation |
| `requestDelayMs` | 1500 | Polite delay between IG profile calls |
| `maxRetries` | 3 | Per-username retry on 429/5xx |

## Account age estimation — how it works

Instagram user IDs are **roughly sequential** (lower ID = older account). Using a calibration table of 25+ known reference points (e.g., `@instagram` joined Oct 2010 at ID 25M; ID 1B = mid-2014; ID 50B = mid-2021), we interpolate the join date.

**Accuracy:**
- ±3 months for accounts < 5 years old
- ±6 months for accounts 5-10 years old
- ±12 months for legacy accounts (10+ years)

**Age buckets:**
- `newcomer` — < 6 months
- `recent` — 6 months to 2 years
- `established` — 2-5 years
- `veteran` — 5-10 years
- `legacy` — 10+ years

## Engagement quality buckets

Phlanx/HypeAuditor-style thresholds, **adjusted by follower tier**:

| Follower tier | `excellent` | `good` | `low` | `fake-follower-signal` |
|---|---|---|---|---|
| < 10K | ≥ 6% | ≥ 2% | ≥ 0.5% | < 0.5% |
| 10K-100K | ≥ 4% | ≥ 1.5% | ≥ 0.3% | < 0.3% |
| 100K-1M | ≥ 3% | ≥ 0.8% | ≥ 0.15% | < 0.15% |
| > 1M | ≥ 2% | ≥ 0.5% | ≥ 0.1% | < 0.1% |

`engagementRate = (avgLikes + avgComments) / followerCount` from the 12 most recent posts.

## MX email validation

For every email extracted from bio, we run a DNS MX lookup on the domain. Returns:
- `hasValidMx: true` → the domain has mail-exchange records → email can be received
- `hasValidMx: false` → typo, fake domain, or domain has no email setup → skip

This is **free** (no API key needed) and faster than SMTP verification. We use Node's built-in DNS module. It catches ~80% of bad emails before you waste outreach on them.

## Tech stack detection

For each external URL, we detect:
- **E-commerce**: Shopify, Wix, Squarespace, Webflow, WordPress
- **Frameworks**: Next.js, Gatsby
- **CDN/Hosting**: Cloudflare, Vercel, Netlify, AWS-S3
- **Payments**: Stripe, Razorpay (Indian payment gateway)

Detection uses HTTP response headers + HTML signatures. Useful for:
- B2B targeting (sell Shopify apps to Shopify stores)
- Lead-quality scoring (custom-built site = more sophisticated business)
- Competitor intel (what's our competitor's stack?)

## Integrations

- **Zapier** — trigger on new HubSpot/Pipedrive contact
- **Make (Integromat)** — route by `detectedNiche`, `engagementQuality`, `accountAge.ageBucket`, `category`
- **n8n** — self-hosted workflows
- **Webhooks** — Apify dispatches on run completion
- **MCP Server** — Claude/ChatGPT/Cursor agent integration via [Apify MCP](https://docs.apify.com/platform/integrations/mcp)
- **HTTP API + SDKs** — Python, Node.js, .NET, PHP

## FAQ

### Do I need to log into Instagram?
**No.** Zero authentication. Pure public-data scraping.

### How does the account age estimation work?
IG user IDs are roughly sequential. We use a calibration table mapping known ID ranges to dates. Accuracy ±3-12 months depending on age.

### Why is `business_email` always null but `extractedFromBio.emails` has values?
Instagram's `business_email` field is gated (requires auth). We parse the **bio text** with regex and find emails businesses put DIRECTLY in their bio.

### What's the difference between MX validation and SMTP verification?
- **MX validation** (ours, free): DNS lookup confirms the domain has mail servers → 80% accuracy on "email is reachable"
- **SMTP verification** (paid services like MillionVerifier): actually pings the mail server → 95%+ accuracy
- We ship MX-only because it's free + catches obvious typos. For 100% deliverability, run our output through MillionVerifier separately.

### How accurate is cross-platform check?
- **Threads** — 100% (Meta auto-creates Threads for every IG)
- **GitHub / YouTube / Pinterest / Spotify** — reliable 200/404 signal
- **Reddit** — uses `/about.json` for clean detection
- **Twitter/X, Facebook** — GET-based with redirect detection (catches login redirects = user doesn't exist)

### What's the tech stack detection accuracy?
- **Shopify** (via `x-shopid` header or `cdn.shopify.com` URLs): 95%+
- **Wix, Webflow, WordPress, Squarespace**: 85-95% (HTML signature matching)
- **Frameworks (Next.js, Gatsby)**: 90%+
- **Payments (Stripe, Razorpay)**: only detected if checkout script is embedded on homepage
- **AWS-S3, Cloudflare**: from response headers, 100%

### Can I scrape followers/following/stories/reels/comments?
No — those require Instagram auth. This actor is intentionally auth-free. For follower lists see [scraping_solutions/instagram-scraper-followers-following-no-cookies](https://apify.com/scraping_solutions/instagram-scraper-followers-following-no-cookies).

### Is this legal?
We access only publicly visible Instagram data + public profile pages on other platforms. No auth bypass, no ToS circumvention. You're responsible for:
- GDPR/DPDP compliance when storing data
- Having lawful basis for processing personal data
- CAN-SPAM / anti-spam laws for outreach
- Not using extracted contacts for mass cold-calling without consent

## Pairs nicely with

Bundle for richer B2B + OSINT workflows:

- **[Holehe Email OSINT](https://apify.com/anshumanatrey/holehe-email-osint)** — Take bio emails extracted here, check which platforms each is registered on
- **[NetIntel](https://apify.com/anshumanatrey/netintel)** — WHOIS/DNS/SSL/GeoIP for `externalUrl` and child links
- **[theHarvester](https://apify.com/anshumanatrey/theharvester-osint)** — Discover subdomains + emails for the account's primary website
- **[Social Analyzer](https://apify.com/anshumanatrey/social-analyzer)** — Find the same username across 900+ platforms (deeper than our 8)
- **[Bug Bounty Finder](https://apify.com/anshumanatrey/bug-bounty-finder)** — Check if websites have disclosure programs
- **[nmap](https://apify.com/anshumanatrey/nmap-scanner)** — Network recon for discovered websites
- **[Zomato Restaurant Scraper](https://apify.com/anshumanatrey/zomato-restaurant-scraper)** — Restaurant lead lists

## Limits & honest caveats

- **Rate limits:** ~200 requests/hour per IP unauthenticated. Apify Residential Proxy comfortably handles 500-1000 profiles per run
- **Private accounts:** username + private flag only (intentional)
- **Deleted/banned accounts:** `status: "not_found"`
- **Account age accuracy:** ±3-12 months (calibration estimate, not exact join date)
- **Cross-platform check:** 8 platforms; some (LinkedIn, TikTok) excluded due to anti-bot
- **External URL crawl hit rate:** ~50-70% (Cloudflare/Shopify aggressively block; we gracefully skip)
- **MX validation accuracy:** ~80% of bad emails caught (the other 20% have valid MX but rejected mailboxes — would need SMTP for 95%+)
- **Engagement formula:** based on 12 most recent posts. Viral post in last 12 inflates avg.
- **Niche detection:** keyword-based, English-focused. Hindi-only accounts return `other` more often
- **Tech stack:** signatures may miss obfuscated builds (e.g., headless Shopify via Hydrogen)

## Credits & built by

Built by [Anshuman Atrey](https://apify.com/anshumanatrey) — independent OSINT + lead-gen tool builder.

Public data only. No Instagram credentials are requested, transmitted, or stored.
