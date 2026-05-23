import { Actor, log } from 'apify';
import { gotScraping } from 'got-scraping';
import { promises as dns } from 'node:dns';
import { createHash } from 'node:crypto';

// Generate Apify-proxy-safe session ID (alphanumeric only) from any string
function safeSessionId(prefix, raw) {
    const hash = createHash('md5').update(String(raw)).digest('hex').slice(0, 16);
    return `${prefix}_${hash}`;
}

// Hard timeout wrapper — got-scraping's request timeout doesn't always fire
// when streams hang on TLS handshake. This guarantees a kill.
async function withTimeout(promise, ms, label) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`HARD_TIMEOUT_${ms}ms:${label || 'unknown'}`)), ms);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timer);
    }
}

// Skip-list — these domains aggressively block scraping; mark as "blocked" instead of trying
const BLOCKED_DOMAINS = ['linkedin.com', 'www.linkedin.com', 'in.linkedin.com'];
function isBlockedDomain(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
        return false;
    }
}

// ────────────────────────────────────────────────────────────────────
// Regex patterns
// ────────────────────────────────────────────────────────────────────
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const OBFUSCATED_EMAIL_RE = /([a-zA-Z0-9._%+-]+)\s*[\[\(\{]?\s*at\s*[\]\)\}]?\s*([a-zA-Z0-9.-]+)\s*[\[\(\{]?\s*(?:dot|\.)\s*[\]\)\}]?\s*([a-zA-Z]{2,})/gi;
const PHONE_RE = /(?:\+91[-.\s]?)?\d{5}[-.\s]?\d{5}|\+\d{1,3}\s?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const WHATSAPP_RE = /(?:wa\.me\/|whatsapp\.com\/send\?phone=|api\.whatsapp\.com\/send\?phone=)([+\d\-]+)/gi;
const TELEGRAM_RE = /(?:t\.me\/|telegram\.me\/)([a-zA-Z0-9_]+)/gi;
const YOUTUBE_RE = /(?:youtube\.com\/(?:c\/|channel\/|user\/|@)|youtu\.be\/)([a-zA-Z0-9_-]+)/gi;
const LINKEDIN_RE = /linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_-]+)/gi;
const HASHTAG_RE = /#([a-zA-Z0-9_]+)/g;
const MENTION_RE = /@([a-zA-Z0-9._]+)/g;
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'\)]+/g;
const PINCODE_IN_RE = /\b([1-9]\d{5})\b/g; // Indian 6-digit postal code
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const DEVANAGARI_RE = /[ऀ-ॿ]/g;
const LATIN_RE = /[a-zA-Z]/g;

// ────────────────────────────────────────────────────────────────────
// Niche detection keyword sets
// ────────────────────────────────────────────────────────────────────
const NICHE_KEYWORDS = {
    food: ['food', 'restaurant', 'cafe', 'eats', 'biryani', 'pizza', 'cuisine', 'chef', 'kitchen', 'recipe', 'foodie', 'foodblog', 'meals', 'dining', 'dahi', 'sweets', 'bakery'],
    beauty: ['beauty', 'skincare', 'makeup', 'cosmetic', 'glow', 'salon', 'haircare', 'spa', 'serum', 'lipstick', 'nail'],
    fashion: ['fashion', 'style', 'apparel', 'boutique', 'designer', 'clothing', 'outfit', 'wear', 'streetwear', 'couture', 'jewelry', 'jewellery', 'saree', 'kurta'],
    fitness: ['fitness', 'gym', 'workout', 'yoga', 'pilates', 'crossfit', 'wellness', 'trainer', 'health', 'nutrition', 'protein'],
    travel: ['travel', 'wanderlust', 'explore', 'tourism', 'trip', 'vacation', 'destination', 'adventure', 'backpack', 'hotel', 'resort', 'tour'],
    tech: ['tech', 'developer', 'software', 'startup', 'saas', 'ai', 'ml', 'engineer', 'coding', 'programming', 'devops', 'cloud', 'cyber'],
    finance: ['finance', 'investing', 'stocks', 'crypto', 'trading', 'wealth', 'money', 'savings', 'mutual fund', 'sip', 'banker', 'fintech'],
    gaming: ['gaming', 'gamer', 'esports', 'streamer', 'twitch', 'pubg', 'valorant', 'fortnite', 'minecraft', 'console'],
    education: ['education', 'learning', 'tutor', 'coach', 'course', 'student', 'teacher', 'academy', 'institute', 'training', 'upsc', 'jee', 'neet'],
    b2b: ['b2b', 'enterprise', 'consulting', 'agency', 'solution', 'professional', 'corporate', 'business', 'commercial'],
    wedding: ['wedding', 'shaadi', 'bridal', 'groom', 'mehndi', 'haldi', 'sangeet', 'reception', 'matrimonial'],
    realestate: ['real estate', 'realty', 'property', 'realtor', 'apartment', 'home', 'rental', 'plot', 'condo'],
    automotive: ['car', 'auto', 'bike', 'motorcycle', 'vehicle', 'automotive', 'showroom', 'dealership'],
};

// ────────────────────────────────────────────────────────────────────
// Account-age calibration table
// ────────────────────────────────────────────────────────────────────
const ACCOUNT_AGE_CALIBRATION = [
    { id: 1, year: 2010, month: 10 },
    { id: 1_000_000, year: 2010, month: 11 },
    { id: 10_000_000, year: 2011, month: 1 },
    { id: 25_025_320, year: 2011, month: 2 },
    { id: 100_000_000, year: 2012, month: 6 },
    { id: 180_000_000, year: 2013, month: 1 },
    { id: 500_000_000, year: 2014, month: 1 },
    { id: 1_000_000_000, year: 2014, month: 6 },
    { id: 1_500_000_000, year: 2014, month: 9 },
    { id: 2_000_000_000, year: 2014, month: 12 },
    { id: 3_000_000_000, year: 2015, month: 9 },
    { id: 4_000_000_000, year: 2016, month: 6 },
    { id: 5_000_000_000, year: 2017, month: 6 },
    { id: 8_000_000_000, year: 2018, month: 1 },
    { id: 10_000_000_000, year: 2018, month: 6 },
    { id: 15_000_000_000, year: 2019, month: 1 },
    { id: 20_000_000_000, year: 2019, month: 6 },
    { id: 30_000_000_000, year: 2020, month: 3 },
    { id: 35_000_000_000, year: 2020, month: 6 },
    { id: 45_000_000_000, year: 2021, month: 3 },
    { id: 50_000_000_000, year: 2021, month: 6 },
    { id: 55_000_000_000, year: 2021, month: 12 },
    { id: 60_000_000_000, year: 2022, month: 6 },
    { id: 63_000_000_000, year: 2023, month: 6 },
    { id: 65_000_000_000, year: 2024, month: 1 },
    { id: 67_000_000_000, year: 2025, month: 1 },
    { id: 68_500_000_000, year: 2026, month: 1 },
];

// Cross-platform endpoints (HEAD + GET hybrid)
const CROSS_PLATFORM_CHECKS = [
    { name: 'threads', method: 'HEAD', urlFn: (u) => `https://www.threads.net/@${u}` },
    { name: 'github', method: 'HEAD', urlFn: (u) => `https://github.com/${u}` },
    { name: 'reddit', method: 'HEAD', urlFn: (u) => `https://www.reddit.com/user/${u}/about.json` },
    { name: 'youtube', method: 'HEAD', urlFn: (u) => `https://www.youtube.com/@${u}` },
    { name: 'pinterest', method: 'HEAD', urlFn: (u) => `https://www.pinterest.com/${u}/` },
    { name: 'spotify', method: 'HEAD', urlFn: (u) => `https://open.spotify.com/user/${u}` },
    { name: 'twitter', method: 'GET', urlFn: (u) => `https://x.com/${u}` },
    { name: 'facebook', method: 'GET', urlFn: (u) => `https://www.facebook.com/${u}` },
];

const MULTILINK_PLATFORMS = [
    { name: 'linktree', match: /linktr\.ee\/([a-zA-Z0-9._-]+)/i },
    { name: 'beacons', match: /beacons\.ai\/([a-zA-Z0-9._-]+)/i },
    { name: 'biolink', match: /bio\.link\/([a-zA-Z0-9._-]+)/i },
    { name: 'lnkbio', match: /lnk\.bio\/([a-zA-Z0-9._-]+)/i },
    { name: 'linkinbio', match: /linkin\.bio\/([a-zA-Z0-9._-]+)/i },
    { name: 'taplink', match: /taplink\.cc\/([a-zA-Z0-9._-]+)/i },
    { name: 'koji', match: /(?:koji\.to|withkoji\.com)\/([a-zA-Z0-9._-]+)/i },
    { name: 'solo', match: /solo\.to\/([a-zA-Z0-9._-]+)/i },
];

// Tech stack signatures
const TECH_SIGNATURES = [
    { tech: 'shopify', test: (h, b) => /x-shopid/i.test(JSON.stringify(h)) || /cdn\.shopify\.com|myshopify\.com/i.test(b || '') },
    { tech: 'wix', test: (h, b) => /x-wix-request-id/i.test(JSON.stringify(h)) || /wixstatic\.com|static\.parastorage\.com/i.test(b || '') },
    { tech: 'webflow', test: (h, b) => /webflow/i.test(JSON.stringify(h)) || /assets\.website-files\.com|webflow\.com/i.test(b || '') },
    { tech: 'wordpress', test: (h, b) => /wp-content|wp-json|wp-includes/i.test(b || '') },
    { tech: 'squarespace', test: (h, b) => /static1\.squarespace|squarespace\.com\/static/i.test(b || '') },
    { tech: 'next.js', test: (h, b) => /\/_next\/|__next_data__/i.test(b || '') },
    { tech: 'gatsby', test: (h, b) => /gatsby/i.test(b || '') },
    { tech: 'cloudflare', test: (h) => /cloudflare/i.test(JSON.stringify(h)) },
    { tech: 'vercel', test: (h) => /vercel|x-vercel/i.test(JSON.stringify(h)) },
    { tech: 'netlify', test: (h) => /netlify/i.test(JSON.stringify(h)) },
    { tech: 'stripe', test: (h, b) => /js\.stripe\.com|checkout\.stripe/i.test(b || '') },
    { tech: 'razorpay', test: (h, b) => /checkout\.razorpay\.com|razorpay/i.test(b || '') },
    { tech: 'aws-s3', test: (h) => /amazons3/i.test((h?.server || '')) },
];

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function parseUsername(input) {
    const s = (input || '').toString().trim();
    if (!s) return null;
    const urlMatch = s.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?/);
    if (urlMatch) return urlMatch[1].toLowerCase();
    return s.replace(/^@/, '').toLowerCase();
}

function uniqueClean(arr) {
    return [...new Set(arr.filter(Boolean).map((x) => x.toString().trim()))].filter((x) => x.length > 0);
}

function extractFromText(text) {
    if (!text) return { emails: [], phones: [], whatsappLinks: [], telegramLinks: [], youtubeLinks: [], linkedinLinks: [], hashtags: [], mentions: [], allUrls: [] };
    const t = text.toString();

    const emails = new Set();
    for (const m of t.matchAll(EMAIL_RE)) {
        const e = m[0].toLowerCase();
        if (!/(?:sentry|example\.com|wixpress|@2x|@3x)/.test(e) && !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e)) {
            emails.add(e);
        }
    }
    for (const m of t.matchAll(OBFUSCATED_EMAIL_RE)) {
        emails.add(`${m[1]}@${m[2]}.${m[3]}`.toLowerCase());
    }

    const phones = new Set();
    for (const m of t.matchAll(PHONE_RE)) {
        const p = m[0].replace(/\s+/g, ' ').trim();
        if (p.replace(/\D/g, '').length >= 8) phones.add(p);
    }

    const whatsappLinks = new Set();
    for (const m of t.matchAll(WHATSAPP_RE)) whatsappLinks.add(m[1]);

    const telegramLinks = new Set();
    for (const m of t.matchAll(TELEGRAM_RE)) telegramLinks.add(m[1]);

    const youtubeLinks = new Set();
    for (const m of t.matchAll(YOUTUBE_RE)) youtubeLinks.add(m[1]);

    const linkedinLinks = new Set();
    for (const m of t.matchAll(LINKEDIN_RE)) linkedinLinks.add(m[1]);

    const hashtags = uniqueClean([...t.matchAll(HASHTAG_RE)].map((m) => `#${m[1]}`)).slice(0, 30);
    const mentions = uniqueClean([...t.matchAll(MENTION_RE)].map((m) => `@${m[1]}`)).slice(0, 30);
    const allUrls = uniqueClean([...t.matchAll(URL_RE)].map((m) => m[0])).slice(0, 20);

    return {
        emails: [...emails].slice(0, 10),
        phones: [...phones].slice(0, 10),
        whatsappLinks: [...whatsappLinks].slice(0, 5),
        telegramLinks: [...telegramLinks].slice(0, 5),
        youtubeLinks: [...youtubeLinks].slice(0, 5),
        linkedinLinks: [...linkedinLinks].slice(0, 5),
        hashtags,
        mentions,
        allUrls,
    };
}

function detectNiche(bioText, captionsText) {
    const haystack = `${bioText || ''} ${captionsText || ''}`.toLowerCase();
    const scores = {};
    for (const [niche, kws] of Object.entries(NICHE_KEYWORDS)) {
        let score = 0;
        for (const kw of kws) {
            const matches = haystack.match(new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'g'));
            if (matches) score += matches.length;
        }
        if (score > 0) scores[niche] = score;
    }
    if (Object.keys(scores).length === 0) return 'other';
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function classifyEngagementQuality(engagementRate, followerCount) {
    let tier;
    if (followerCount < 10_000) tier = { excellent: 0.06, good: 0.02, low: 0.005 };
    else if (followerCount < 100_000) tier = { excellent: 0.04, good: 0.015, low: 0.003 };
    else if (followerCount < 1_000_000) tier = { excellent: 0.03, good: 0.008, low: 0.0015 };
    else tier = { excellent: 0.02, good: 0.005, low: 0.001 };
    if (engagementRate >= tier.excellent) return 'excellent';
    if (engagementRate >= tier.good) return 'good';
    if (engagementRate >= tier.low) return 'low';
    return 'fake-follower-signal';
}

// ────────────────────────────────────────────────────────────────────
// Enrichment: Account age from user ID
// ────────────────────────────────────────────────────────────────────
function estimateAccountAge(userId) {
    const id = parseInt(userId, 10);
    if (!Number.isFinite(id) || id < 1) {
        return { estimatedJoinDate: null, ageYears: null, ageBucket: 'unknown' };
    }
    let lo = ACCOUNT_AGE_CALIBRATION[0];
    let hi = ACCOUNT_AGE_CALIBRATION[ACCOUNT_AGE_CALIBRATION.length - 1];
    for (let i = 0; i < ACCOUNT_AGE_CALIBRATION.length - 1; i += 1) {
        if (id >= ACCOUNT_AGE_CALIBRATION[i].id && id < ACCOUNT_AGE_CALIBRATION[i + 1].id) {
            lo = ACCOUNT_AGE_CALIBRATION[i];
            hi = ACCOUNT_AGE_CALIBRATION[i + 1];
            break;
        }
    }
    if (id >= ACCOUNT_AGE_CALIBRATION[ACCOUNT_AGE_CALIBRATION.length - 1].id) {
        lo = ACCOUNT_AGE_CALIBRATION[ACCOUNT_AGE_CALIBRATION.length - 1];
        hi = lo;
    }
    const loTs = new Date(lo.year, lo.month - 1, 15).getTime();
    const hiTs = new Date(hi.year, hi.month - 1, 15).getTime();
    const frac = hi.id > lo.id ? (id - lo.id) / (hi.id - lo.id) : 0;
    const estTs = loTs + frac * (hiTs - loTs);
    const estDate = new Date(estTs);
    const ageYears = Math.round(((Date.now() - estTs) / (365.25 * 86400 * 1000)) * 10) / 10;
    let ageBucket;
    if (ageYears >= 10) ageBucket = 'legacy';
    else if (ageYears >= 5) ageBucket = 'veteran';
    else if (ageYears >= 2) ageBucket = 'established';
    else if (ageYears >= 0.5) ageBucket = 'recent';
    else ageBucket = 'newcomer';
    return {
        estimatedJoinDate: estDate.toISOString().slice(0, 7),
        estimatedJoinYear: estDate.getFullYear(),
        estimatedJoinMonth: estDate.getMonth() + 1,
        ageYears,
        ageBucket,
        calibrationNote: 'Estimated from user ID. Accuracy ±3 months for accounts < 5 years old, ±6 months for older.',
    };
}

// ────────────────────────────────────────────────────────────────────
// Enrichment: Posting time pattern
// ────────────────────────────────────────────────────────────────────
function calculatePostingPattern(posts) {
    const timestamps = (posts || []).map((e) => e?.node?.taken_at_timestamp).filter((t) => typeof t === 'number');
    if (timestamps.length === 0) return { modalHourUTC: null, modalHourIST: null, modalDayOfWeek: null, consistencyScore: null };
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    for (const ts of timestamps) {
        const d = new Date(ts * 1000);
        hourCounts[d.getUTCHours()] += 1;
        dayCounts[d.getUTCDay()] += 1;
    }
    const modalHourUTC = hourCounts.indexOf(Math.max(...hourCounts));
    const modalHourIST = (modalHourUTC + 5) % 24;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const modalDayOfWeek = days[dayCounts.indexOf(Math.max(...dayCounts))];
    const consistencyScore = Math.round((hourCounts[modalHourUTC] / timestamps.length) * 100) / 100;
    return { modalHourUTC, modalHourIST, modalDayOfWeek, consistencyScore };
}

// ────────────────────────────────────────────────────────────────────
// Enrichment: Communication style
// ────────────────────────────────────────────────────────────────────
function analyzeCommunicationStyle(bioText, captionsText) {
    const bio = bioText || '';
    const captions = captionsText || '';
    const combined = `${bio} ${captions}`;
    const emojiMatches = combined.match(EMOJI_RE) || [];
    const emojiDensity = combined.length > 0 ? Math.round((emojiMatches.length / combined.length) * 1000) / 1000 : 0;
    const devanagariCount = (combined.match(DEVANAGARI_RE) || []).length;
    const latinCount = (combined.match(LATIN_RE) || []).length;
    const totalScript = devanagariCount + latinCount;
    const bioLanguages = [];
    if (totalScript > 0) {
        if (latinCount / totalScript > 0.1) bioLanguages.push('en');
        if (devanagariCount / totalScript > 0.1) bioLanguages.push('hi');
    }
    if (bioLanguages.length === 0) bioLanguages.push('unknown');
    return {
        emojiCount: emojiMatches.length,
        emojiDensity,
        bioLanguages,
        isHinglish: bioLanguages.includes('hi') && bioLanguages.includes('en'),
        bioWordCount: bio.split(/\s+/).filter(Boolean).length,
        captionAvgWordCount: captions ? Math.round((captions.split(/\s+/).filter(Boolean).length) / Math.max(1, 12)) : 0,
    };
}

// ────────────────────────────────────────────────────────────────────
// Enrichment: Hashtag pattern
// ────────────────────────────────────────────────────────────────────
function analyzeHashtagPattern(captionsText, username) {
    const allHashtags = [...(captionsText || '').matchAll(HASHTAG_RE)].map((m) => `#${m[1].toLowerCase()}`);
    const total = allHashtags.length;
    if (total === 0) return { totalUses: 0, unique: 0, diversityRatio: null, brandedHashtag: null, topHashtags: [], campaigns: [] };
    const counts = {};
    for (const h of allHashtags) counts[h] = (counts[h] || 0) + 1;
    const unique = Object.keys(counts).length;
    const diversityRatio = Math.round((unique / total) * 100) / 100;
    const usernameLower = (username || '').toLowerCase();
    const brandedHashtag = Object.keys(counts).find((h) => h.includes(usernameLower)) || null;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topHashtags = sorted.slice(0, 10).map(([h, c]) => ({ hashtag: h, uses: c }));
    // Campaign detection: hashtags used 3+ times in the last 12 posts
    const campaigns = sorted.filter(([, c]) => c >= 3).map(([h, c]) => ({ hashtag: h, uses: c }));
    return { totalUses: total, unique, diversityRatio, brandedHashtag, topHashtags, campaigns };
}

// ────────────────────────────────────────────────────────────────────
// Enrichment: Top mentioned accounts (influencer graph)
// ────────────────────────────────────────────────────────────────────
function topMentionedAccounts(captionsText, ownUsername) {
    const own = (ownUsername || '').toLowerCase();
    const allMentions = [...(captionsText || '').matchAll(MENTION_RE)]
        .map((m) => `@${m[1].toLowerCase()}`)
        .filter((u) => u.slice(1) !== own);
    if (allMentions.length === 0) return [];
    const counts = {};
    for (const m of allMentions) counts[m] = (counts[m] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([account, mentions]) => ({ account, mentions }));
}

// ────────────────────────────────────────────────────────────────────
// Enrichment: Coauthor / collab detection
// ────────────────────────────────────────────────────────────────────
function extractCollabs(posts, ownUsername) {
    const own = (ownUsername || '').toLowerCase();
    const collabs = [];
    for (const edge of posts || []) {
        const p = edge?.node || {};
        const coauthors = (p.coauthor_producers || [])
            .map((c) => (c.username ? c.username.toLowerCase() : null))
            .filter((u) => u && u !== own)
            .map((u) => `@${u}`);
        if (coauthors.length > 0) {
            collabs.push({
                postUrl: p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : null,
                takenAt: p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : null,
                coauthors,
            });
        }
    }
    return collabs;
}

// ────────────────────────────────────────────────────────────────────
// NEW v1.2: Instagram capabilities surface
// ────────────────────────────────────────────────────────────────────
function extractIgCapabilities(user) {
    return {
        hasClips: !!user.has_clips,
        hasChannel: !!user.has_channel,
        hasGuides: !!user.has_guides,
        hasOnboardedToThreads: !!user.has_onboarded_to_text_post_app,
        hideEngagement: !!user.hide_like_and_view_counts,
        isRegulatedC18: !!user.is_regulated_c18,
        hasArEffects: !!user.has_ar_effects,
        pinnedChannelsCount: user.pinned_channels_list_count || 0,
        aiAgentOwnerUsername: user.ai_agent_owner_username || null,
        aiAgentType: user.ai_agent_type || null,
        showAccountTransparencyDetails: !!user.show_account_transparency_details,
        verifiedByMv4b: !!user.is_verified_by_mv4b,
    };
}

// ────────────────────────────────────────────────────────────────────
// NEW v1.2: Top + worst performing post
// ────────────────────────────────────────────────────────────────────
function identifyBestWorstPost(posts, followerCount) {
    if (!posts || posts.length === 0 || !followerCount) return { topPost: null, worstPost: null };
    const scored = posts.map((edge) => {
        const p = edge?.node || {};
        const likes = p.edge_liked_by?.count || p.edge_media_preview_like?.count || 0;
        const comments = p.edge_media_to_comment?.count || 0;
        const engagementRate = (likes + comments) / followerCount;
        return {
            shortcode: p.shortcode,
            url: p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : null,
            likes,
            comments,
            engagementRate: Math.round(engagementRate * 10000) / 10000,
            takenAt: p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : null,
            isVideo: !!p.is_video,
            videoViewCount: p.video_view_count || null,
            caption: (p.edge_media_to_caption?.edges?.[0]?.node?.text || '').slice(0, 200),
        };
    });
    const sorted = scored.slice().sort((a, b) => b.engagementRate - a.engagementRate);
    return { topPost: sorted[0], worstPost: sorted[sorted.length - 1] };
}

// ────────────────────────────────────────────────────────────────────
// NEW v1.2: Indian pincode extraction
// ────────────────────────────────────────────────────────────────────
function extractPincode(bioText) {
    const matches = [...(bioText || '').matchAll(PINCODE_IN_RE)];
    if (matches.length === 0) return null;
    return matches[0][1];
}

// ────────────────────────────────────────────────────────────────────
// NEW v1.2: MX validation for extracted emails
// ────────────────────────────────────────────────────────────────────
async function validateEmailMx(emails) {
    const validated = await Promise.all(
        emails.map(async (email) => {
            const domain = email.split('@')[1];
            if (!domain) return { email, hasValidMx: false, mxRecords: [] };
            try {
                const records = await dns.resolveMx(domain);
                const mxList = records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange).slice(0, 3);
                return { email, hasValidMx: mxList.length > 0, mxRecords: mxList };
            } catch {
                return { email, hasValidMx: false, mxRecords: [] };
            }
        }),
    );
    return validated;
}

// ────────────────────────────────────────────────────────────────────
// NEW v1.2: Cross-platform with hybrid HEAD/GET
// ────────────────────────────────────────────────────────────────────
async function checkCrossPlatform(username, { proxyConfig }) {
    const results = {};
    const promises = CROSS_PLATFORM_CHECKS.map(async ({ name, method, urlFn }) => {
        const url = urlFn(username);
        try {
            const proxyUrl = proxyConfig ? await proxyConfig.newUrl(safeSessionId(name, username)) : undefined;
            const response = await withTimeout(gotScraping({
                url,
                method,
                proxyUrl,
                followRedirect: true,
                timeout: { request: method === 'GET' ? 4000 : 4000, connect: 2500, response: 3000 },
                throwHttpErrors: false,
                retry: { limit: 0 },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
                },
            }), 6000, `crossplat_${name}`);
            const finalUrl = response.url || url;
            let exists = response.statusCode >= 200 && response.statusCode < 400;
            // Filter redirects to login (means user doesn't exist)
            if (name === 'twitter' && (finalUrl.includes('/login') || finalUrl.includes('?continue_with'))) exists = false;
            if (name === 'facebook' && finalUrl.includes('/login/web')) exists = false;
            results[name] = { exists, url: exists ? url : null, status: response.statusCode };
        } catch (err) {
            results[name] = { exists: false, url: null, error: err.code || err.name };
        }
    });
    await Promise.all(promises);
    return results;
}

// ────────────────────────────────────────────────────────────────────
// NEW v1.2: Tech stack detection from external URL
// ────────────────────────────────────────────────────────────────────
function detectTechStack(headers, html) {
    const detected = [];
    for (const { tech, test } of TECH_SIGNATURES) {
        try {
            if (test(headers || {}, html || '')) detected.push(tech);
        } catch { /* skip */ }
    }
    return detected;
}

// ────────────────────────────────────────────────────────────────────
// External URL og:metadata + tech stack
// ────────────────────────────────────────────────────────────────────
async function fetchOgMetadata(targetUrl, { proxyConfig }) {
    if (!targetUrl) return null;
    if (isBlockedDomain(targetUrl)) {
        return { fetched: false, url: targetUrl, skipped: true, reason: 'Domain blocks scraping' };
    }
    try {
        const proxyUrl = proxyConfig ? await proxyConfig.newUrl(safeSessionId('og', targetUrl)) : undefined;
        const response = await withTimeout(gotScraping({
            url: targetUrl,
            proxyUrl,
            followRedirect: true,
            timeout: { request: 8000, connect: 4000, response: 5000 },
            throwHttpErrors: false,
            retry: { limit: 0 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        }), 10000, 'ogMeta');
        if (response.statusCode !== 200 || !response.body) {
            return { fetched: false, status: response.statusCode, url: targetUrl };
        }
        const html = response.body.toString().slice(0, 80000);
        const meta = { fetched: true, status: 200, finalUrl: response.url || targetUrl };
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) meta.title = titleMatch[1].trim().slice(0, 200);
        for (const m of html.matchAll(/<meta\s+(?:property|name)="(og:[^"]+|twitter:[^"]+|description)"\s+content="([^"]+)"/gi)) {
            const key = m[1].toLowerCase();
            const val = m[2].slice(0, 300);
            if (key === 'og:title') meta.ogTitle = val;
            else if (key === 'og:description') meta.ogDescription = val;
            else if (key === 'og:image') meta.ogImage = val;
            else if (key === 'og:url') meta.ogUrl = val;
            else if (key === 'description') meta.description = val;
            else if (key === 'twitter:title' && !meta.ogTitle) meta.ogTitle = val;
        }
        const bodyEmails = uniqueClean(
            [...html.matchAll(EMAIL_RE)]
                .map((x) => x[0].toLowerCase())
                .filter((e) => !/(?:sentry|example\.com|wixpress|@2x|@3x)/.test(e) && !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e)),
        );
        const bodyMailtos = uniqueClean([...html.matchAll(/mailto:([^?"'\s<>]+)/gi)].map((x) => x[1].toLowerCase()));
        const bodyPhones = uniqueClean([...html.matchAll(/tel:([+\d\s\-()]+)/gi)].map((x) => x[1].trim()));
        meta.extractedFromSite = {
            emails: [...new Set([...bodyEmails, ...bodyMailtos])].slice(0, 10),
            phones: bodyPhones.slice(0, 5),
        };
        meta.techStack = detectTechStack(response.headers || {}, html);
        return meta;
    } catch (err) {
        return { fetched: false, status: null, url: targetUrl, error: err.code || err.name };
    }
}

// ────────────────────────────────────────────────────────────────────
// Multi-link expander
// ────────────────────────────────────────────────────────────────────
function detectMultiLinkPlatform(url) {
    if (!url) return null;
    for (const p of MULTILINK_PLATFORMS) if (p.match.test(url)) return p.name;
    return null;
}

async function expandMultiLink(targetUrl, { proxyConfig }) {
    if (!targetUrl) return null;
    const platform = detectMultiLinkPlatform(targetUrl);
    if (!platform) return null;
    try {
        const proxyUrl = proxyConfig ? await proxyConfig.newUrl(safeSessionId('ml', targetUrl)) : undefined;
        const response = await withTimeout(gotScraping({
            url: targetUrl,
            proxyUrl,
            followRedirect: true,
            timeout: { request: 8000, connect: 4000, response: 5000 },
            throwHttpErrors: false,
            retry: { limit: 0 },
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36' },
        }), 10000, 'multiLink');
        if (response.statusCode !== 200 || !response.body) {
            return { platform, originalUrl: targetUrl, expanded: false, status: response.statusCode };
        }
        const html = response.body.toString();
        const links = new Map();
        if (platform === 'linktree') {
            const nextMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
            if (nextMatch) {
                try {
                    const data = JSON.parse(nextMatch[1]);
                    const items = data?.props?.pageProps?.links || [];
                    for (const it of items) if (it.url) links.set(it.url, it.title || '');
                } catch { /* fall through */ }
            }
        }
        if (links.size === 0) {
            for (const m of html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{0,100})<\/a>/gi)) {
                const url = m[1];
                if (/(?:cdn|static|assets|fonts|googletagmanager|facebook\.com\/tr|google-analytics)/i.test(url)) continue;
                if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|ico)(\?|$)/i.test(url)) continue;
                if (links.has(url)) continue;
                links.set(url, m[2].trim().slice(0, 100));
            }
        }
        const childLinks = [...links.entries()]
            .filter(([url]) => !url.includes(new URL(targetUrl).host))
            .slice(0, 20)
            .map(([url, title]) => ({ url, title }));
        return { platform, originalUrl: targetUrl, expanded: true, childLinkCount: childLinks.length, childLinks };
    } catch (err) {
        return { platform, originalUrl: targetUrl, expanded: false, error: err.code || err.name };
    }
}

// ────────────────────────────────────────────────────────────────────
// NEW v1.2: Bio link health check (parallel HEAD with GET fallback on 405/403/400)
// Some sites (LinkedIn, certain Cloudflare-protected) reject HEAD with 4xx
// ────────────────────────────────────────────────────────────────────
async function checkBioLinkHealth(bioLinks, { proxyConfig }) {
    if (!bioLinks || bioLinks.length === 0) return [];
    const promises = bioLinks.map(async (link) => {
        // Skip known-blocked domains — they actively reject all scraping
        if (isBlockedDomain(link.url)) {
            return {
                url: link.url,
                title: link.title,
                status: null,
                alive: null,
                method: 'skipped',
                reason: 'Domain actively blocks anti-bot scraping; cannot verify',
            };
        }
        const sendRequest = async (method, extraHeaders = {}) => {
            const proxyUrl = proxyConfig ? await proxyConfig.newUrl(safeSessionId(`bl_${method.toLowerCase()}`, link.url)) : undefined;
            return withTimeout(gotScraping({
                url: link.url,
                method,
                proxyUrl,
                followRedirect: true,
                timeout: { request: 6000, connect: 4000, response: 4000 },
                throwHttpErrors: false,
                retry: { limit: 0 },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
                    'Accept': method === 'GET' ? 'text/html,*/*;q=0.8' : '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    ...extraHeaders,
                },
            }), 8000, `bioLink_${method}`);
        };
        const tryHead = async () => {
            try {
                return { ok: true, response: await sendRequest('HEAD') };
            } catch (err) {
                return { ok: false, error: err.code || err.name };
            }
        };
        const tryGet = async () => {
            try {
                return { ok: true, response: await sendRequest('GET', { Range: 'bytes=0-2047' }) };
            } catch (err) {
                return { ok: false, error: err.code || err.name };
            }
        };

        // Try HEAD first
        let result = await tryHead();
        let usedMethod = 'HEAD';
        let lastError = null;

        // Fallback to GET if HEAD threw, returned 405/403/400/501, OR returned 999 (LinkedIn)
        if (!result.ok) {
            lastError = result.error;
            result = await tryGet();
            usedMethod = 'GET';
        } else if ([400, 403, 405, 501, 999].includes(result.response.statusCode)) {
            result = await tryGet();
            usedMethod = 'GET';
        }

        if (!result.ok) {
            return { url: link.url, title: link.title, status: null, alive: false, method: usedMethod, error: result.error || lastError };
        }
        // 206 (Partial Content) and 200 both count as alive
        const alive = result.response.statusCode >= 200 && result.response.statusCode < 400;
        return {
            url: link.url,
            title: link.title,
            status: result.response.statusCode,
            alive,
            method: usedMethod,
            finalUrl: result.response.url || link.url,
        };
    });
    return Promise.all(promises);
}

// ────────────────────────────────────────────────────────────────────
// NEW v1.2: Profile pic metadata (HEAD)
// ────────────────────────────────────────────────────────────────────
async function fetchProfilePicMeta(picUrl, { proxyConfig }) {
    if (!picUrl) return null;
    try {
        const proxyUrl = proxyConfig ? await proxyConfig.newUrl(safeSessionId('pic', picUrl)) : undefined;
        const response = await withTimeout(gotScraping({
            url: picUrl,
            method: 'HEAD',
            proxyUrl,
            followRedirect: true,
            timeout: { request: 5000, connect: 3000, response: 3000 },
            throwHttpErrors: false,
            retry: { limit: 0 },
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0' },
        }), 7000, 'profilePic');
        return {
            url: picUrl,
            status: response.statusCode,
            contentType: response.headers?.['content-type'] || null,
            contentLength: response.headers?.['content-length'] ? parseInt(response.headers['content-length'], 10) : null,
        };
    } catch (err) {
        return { url: picUrl, status: null, error: err.code || err.name };
    }
}

// ────────────────────────────────────────────────────────────────────
// Engagement metrics
// ────────────────────────────────────────────────────────────────────
function computeEngagement(user) {
    const followerCount = user?.edge_followed_by?.count || 0;
    const posts = user?.edge_owner_to_timeline_media?.edges || [];
    if (posts.length === 0 || followerCount === 0) {
        return { recentPostsAnalyzed: 0, avgLikes: null, avgComments: null, avgVideoViews: null, engagementRate: null, engagementQuality: 'unknown', postingFrequency: { postsPerWeek: null, isActive: false, lastPostDaysAgo: null } };
    }
    let totalLikes = 0;
    let totalComments = 0;
    let totalVideoViews = 0;
    let videoCount = 0;
    const allCaptions = [];
    const timestamps = [];
    for (const edge of posts) {
        const p = edge.node || {};
        totalLikes += p.edge_liked_by?.count || p.edge_media_preview_like?.count || 0;
        totalComments += p.edge_media_to_comment?.count || 0;
        if (p.is_video) { videoCount += 1; totalVideoViews += p.video_view_count || 0; }
        const caption = p.edge_media_to_caption?.edges?.[0]?.node?.text || '';
        if (caption) allCaptions.push(caption);
        if (p.taken_at_timestamp) timestamps.push(p.taken_at_timestamp);
    }
    const avgLikes = Math.round(totalLikes / posts.length);
    const avgComments = Math.round(totalComments / posts.length);
    const avgVideoViews = videoCount > 0 ? Math.round(totalVideoViews / videoCount) : null;
    const engagementRate = (avgLikes + avgComments) / followerCount;
    let postsPerWeek = null;
    let isActive = false;
    let lastPostDaysAgo = null;
    if (timestamps.length >= 2) {
        const sorted = timestamps.slice().sort((a, b) => b - a);
        const newest = sorted[0];
        const oldest = sorted[sorted.length - 1];
        const daysSpan = (newest - oldest) / 86400;
        postsPerWeek = daysSpan > 0 ? Math.round((sorted.length / daysSpan) * 7 * 100) / 100 : null;
        lastPostDaysAgo = Math.round((Date.now() / 1000 - newest) / 86400);
        isActive = lastPostDaysAgo <= 90;
    }
    return {
        recentPostsAnalyzed: posts.length,
        avgLikes,
        avgComments,
        avgVideoViews,
        engagementRate: Math.round(engagementRate * 10000) / 10000,
        engagementQuality: classifyEngagementQuality(engagementRate, followerCount),
        postingFrequency: { postsPerWeek, isActive, lastPostDaysAgo },
        captionsText: allCaptions.join('\n'),
    };
}

function compactPosts(user) {
    const posts = user?.edge_owner_to_timeline_media?.edges || [];
    return posts.slice(0, 12).map((edge) => {
        const p = edge.node || {};
        const caption = p.edge_media_to_caption?.edges?.[0]?.node?.text || '';
        const taggedUsers = (p.edge_media_to_tagged_user?.edges || []).map((e) => `@${e.node?.user?.username}`).filter(Boolean);
        return {
            id: p.id,
            shortcode: p.shortcode,
            url: p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : null,
            displayUrl: p.display_url,
            caption: caption.slice(0, 500),
            likes: p.edge_liked_by?.count || p.edge_media_preview_like?.count || 0,
            comments: p.edge_media_to_comment?.count || 0,
            isVideo: !!p.is_video,
            videoViewCount: p.video_view_count || null,
            takenAtTimestamp: p.taken_at_timestamp,
            takenAt: p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : null,
            taggedUsers,
            location: p.location?.name || null,
            dimensions: p.dimensions || null,
        };
    });
}

// ────────────────────────────────────────────────────────────────────
// Instagram fetch + retry
// ────────────────────────────────────────────────────────────────────
async function fetchProfile(username, { proxyConfig, requestDelayMs, maxRetries }) {
    const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'x-ig-app-id': '936619743392459',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
    };
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
            const proxyUrl = proxyConfig ? await proxyConfig.newUrl(safeSessionId(`ig${attempt}`, username)) : undefined;
            const response = await withTimeout(
                gotScraping({ url, headers, proxyUrl, responseType: 'json', timeout: { request: 12000, connect: 5000, response: 8000 }, throwHttpErrors: false, retry: { limit: 0 } }),
                15000,
                'fetchProfile',
            );
            if (response.statusCode === 200 && response.body?.data?.user) return { ok: true, user: response.body.data.user };
            if (response.statusCode === 404) return { ok: false, status: 'not_found', error: 'Username does not exist on Instagram' };
            if (response.statusCode === 429) {
                lastError = `Rate limited (429) on attempt ${attempt}`;
                log.warning(`[${username}] ${lastError} — retrying in ${requestDelayMs * attempt}ms`);
                await sleep(requestDelayMs * attempt);
                continue;
            }
            lastError = `HTTP ${response.statusCode}`;
        } catch (err) {
            lastError = `${err.name}: ${err.message}`;
            log.warning(`[${username}] Attempt ${attempt} threw: ${lastError}`);
        }
        await sleep(requestDelayMs);
    }
    return { ok: false, status: 'error', error: lastError || 'unknown' };
}

// ────────────────────────────────────────────────────────────────────
// Main entry
// ────────────────────────────────────────────────────────────────────
await Actor.init();

try {
    const input = (await Actor.getInput()) || {};
    const {
        usernames = [],
        enrichLevel = 'full',
        useResidentialProxy = true,
        requestDelayMs = 1500,
        maxRetries = 3,
        checkCrossPlatform: doCrossPlatform = true,
        enrichExternalUrl: doExternalUrl = true,
        expandMultiLinkBio = true,
        validateEmailsViaMx = true,
        checkBioLinkHealth: doBioLinkHealth = true,
        fetchProfilePicMeta: doProfilePicMeta = true,
    } = input;

    const cleanedUsernames = uniqueClean(usernames.map(parseUsername));
    if (cleanedUsernames.length === 0) {
        throw new Error('No valid usernames provided. Pass at least one in the "usernames" array.');
    }

    log.info(`Starting Instagram Profile Intel v1.3`, {
        usernameCount: cleanedUsernames.length,
        enrichLevel,
        useResidentialProxy,
        toggles: { doCrossPlatform, doExternalUrl, expandMultiLinkBio, validateEmailsViaMx, doBioLinkHealth, doProfilePicMeta },
    });

    const proxyConfig = useResidentialProxy ? await Actor.createProxyConfiguration({ groups: ['RESIDENTIAL'] }) : null;

    const startedAt = Date.now();
    const summary = {
        usernamesRequested: cleanedUsernames.length,
        profilesScraped: 0,
        profilesNotFound: 0,
        profilesPrivate: 0,
        profilesError: 0,
        totalEmailsFound: 0,
        totalPhonesFound: 0,
        totalBioLinks: 0,
        totalCollabsFound: 0,
        totalCrossPlatformHits: 0,
        totalChildLinksExpanded: 0,
        totalCampaignsDetected: 0,
        totalEmailsMxValidated: 0,
        totalAliveBioLinks: 0,
        totalDeadBioLinks: 0,
        errors: [],
    };

    for (let i = 0; i < cleanedUsernames.length; i += 1) {
        const username = cleanedUsernames[i];
        log.info(`[${i + 1}/${cleanedUsernames.length}] @${username}`);

        const result = await fetchProfile(username, { proxyConfig, requestDelayMs, maxRetries });
        if (!result.ok) {
            const record = { recordType: 'profile', username, profileUrl: `https://www.instagram.com/${username}/`, scrapedAt: new Date().toISOString(), status: result.status, error: result.error };
            await Actor.pushData(record);
            if (result.status === 'not_found') summary.profilesNotFound += 1;
            else summary.profilesError += 1;
            summary.errors.push({ username, error: result.error });
            if (i < cleanedUsernames.length - 1) await sleep(requestDelayMs);
            continue;
        }

        const u = result.user;
        const bioText = u.biography || '';
        const extractedFromBio = extractFromText(bioText);
        const bioLinks = (u.bio_links || []).map((b) => ({ url: b.url || '', title: b.title || '', linkType: b.link_type || null })).filter((b) => b.url);
        const posts = u.edge_owner_to_timeline_media?.edges || [];
        const engagement = enrichLevel === 'full' ? computeEngagement(u) : null;
        const captionsText = engagement?.captionsText || '';
        if (engagement) delete engagement.captionsText;

        const recentPosts = compactPosts(u);
        const detectedNiche = detectNiche(bioText, captionsText);
        const accountAge = estimateAccountAge(u.id);
        const postingPattern = enrichLevel === 'full' ? calculatePostingPattern(posts) : null;
        const communicationStyle = enrichLevel === 'full' ? analyzeCommunicationStyle(bioText, captionsText) : null;
        const hashtagPattern = enrichLevel === 'full' ? analyzeHashtagPattern(captionsText, u.username) : null;
        const recentCollabs = enrichLevel === 'full' ? extractCollabs(posts, u.username) : null;

        // ── v1.2 new fields ──
        const igCapabilities = extractIgCapabilities(u);
        const { topPost, worstPost } = identifyBestWorstPost(posts, u.edge_followed_by?.count || 0);
        const topMentions = enrichLevel === 'full' ? topMentionedAccounts(captionsText, u.username) : null;
        const pincode = extractPincode(bioText);
        const businessContactMethod = u.business_contact_method && u.business_contact_method !== 'UNKNOWN' ? u.business_contact_method : null;

        // ── Network-dependent enrichments — all kicked off in PARALLEL per profile ──
        log.info(`[${username}]   ↳ running ${[validateEmailsViaMx && extractedFromBio.emails.length && 'mxValidation', doCrossPlatform && 'crossPlatform', doExternalUrl && u.external_url && 'externalUrl', expandMultiLinkBio && u.external_url && detectMultiLinkPlatform(u.external_url) && 'multiLink', doBioLinkHealth && bioLinks.length && 'bioLinkHealth', doProfilePicMeta && 'profilePicMeta'].filter(Boolean).join(', ')} in parallel`);

        const enrichmentTasks = await Promise.all([
            validateEmailsViaMx && extractedFromBio.emails.length > 0 ? validateEmailMx(extractedFromBio.emails) : Promise.resolve(null),
            doCrossPlatform ? checkCrossPlatform(username, { proxyConfig }) : Promise.resolve(null),
            doExternalUrl && u.external_url ? fetchOgMetadata(u.external_url, { proxyConfig }) : Promise.resolve(null),
            expandMultiLinkBio && u.external_url && detectMultiLinkPlatform(u.external_url) ? expandMultiLink(u.external_url, { proxyConfig }) : Promise.resolve(null),
            doBioLinkHealth && bioLinks.length > 0 ? checkBioLinkHealth(bioLinks, { proxyConfig }) : Promise.resolve(null),
            doProfilePicMeta && (u.profile_pic_url_hd || u.profile_pic_url) ? fetchProfilePicMeta(u.profile_pic_url_hd || u.profile_pic_url, { proxyConfig }) : Promise.resolve(null),
        ]);
        const [mxValidatedEmails, crossPlatform, externalUrlMeta, multiLinkExpanded, bioLinkHealth, profilePicMeta] = enrichmentTasks;

        const record = {
            recordType: 'profile',
            username: u.username,
            profileUrl: `https://www.instagram.com/${u.username}/`,
            scrapedAt: new Date().toISOString(),
            status: u.is_private ? 'private' : 'public',

            id: u.id,
            fbid: u.fbid,
            eimuId: u.eimu_id,
            fullName: u.full_name,
            pronouns: u.pronouns || [],
            biography: bioText,
            category: u.category_name || u.business_category_name || u.overall_category_name,

            profilePicUrl: u.profile_pic_url,
            profilePicUrlHd: u.profile_pic_url_hd,
            profilePicMeta,

            followerCount: u.edge_followed_by?.count || 0,
            followingCount: u.edge_follow?.count || 0,
            postCount: u.edge_owner_to_timeline_media?.count || 0,
            highlightCount: u.highlight_reel_count || 0,

            isVerified: !!u.is_verified,
            isBusinessAccount: !!u.is_business_account,
            isProfessionalAccount: !!u.is_professional_account,
            isPrivate: !!u.is_private,
            isJoinedRecently: !!u.is_joined_recently,
            shouldShowPublicContacts: !!u.should_show_public_contacts,
            isEmbedsDisabled: !!u.is_embeds_disabled,
            businessContactMethod,

            externalUrl: u.external_url || null,
            bioLinks,
            bioLinkHealth,
            extractedFromBio,
            mxValidatedEmails,
            pincode,

            detectedNiche,
            accountAge,
            igCapabilities,
            engagement,
            postingPattern,
            communicationStyle,
            hashtagPattern,
            topMentions,
            topPost,
            worstPost,
            recentCollabs,
            crossPlatform,
            externalUrlMeta,
            multiLinkExpanded,
            recentPosts,
        };

        // Update summary
        if (u.is_private) summary.profilesPrivate += 1;
        else summary.profilesScraped += 1;
        summary.totalEmailsFound += extractedFromBio.emails.length + (externalUrlMeta?.extractedFromSite?.emails?.length || 0);
        summary.totalPhonesFound += extractedFromBio.phones.length + (externalUrlMeta?.extractedFromSite?.phones?.length || 0);
        summary.totalBioLinks += bioLinks.length;
        summary.totalCollabsFound += recentCollabs?.length || 0;
        if (crossPlatform) summary.totalCrossPlatformHits += Object.values(crossPlatform).filter((p) => p.exists).length;
        summary.totalChildLinksExpanded += multiLinkExpanded?.childLinkCount || 0;
        summary.totalCampaignsDetected += hashtagPattern?.campaigns?.length || 0;
        summary.totalEmailsMxValidated += (mxValidatedEmails || []).filter((e) => e.hasValidMx).length;
        summary.totalAliveBioLinks += (bioLinkHealth || []).filter((l) => l.alive).length;
        summary.totalDeadBioLinks += (bioLinkHealth || []).filter((l) => !l.alive).length;

        await Actor.pushData(record);
        if (i < cleanedUsernames.length - 1) await sleep(requestDelayMs);
    }

    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    await Actor.pushData({ recordType: 'summary', ...summary, durationSeconds: durationSec, completedAt: new Date().toISOString() });
    log.info('Run complete', { ...summary, durationSec });
} catch (err) {
    log.exception(err, 'Run failed');
    throw err;
} finally {
    await Actor.exit();
}
