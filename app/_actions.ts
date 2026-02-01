"use server";

import FirecrawlApp from "@mendable/firecrawl-js";
import OpenAI from "openai";
import RunwayML from "@runwayml/sdk";
import { ElevenLabsClient } from "elevenlabs";
import Mux from "@mux/mux-node";
import { z } from "zod";

// Initialize Mux client
function getMuxClient() {
  const tokenId = process.env.MUX_ACCESS_TOKEN || process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_SECRET_KEY || process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_ACCESS_TOKEN/MUX_TOKEN_ID and MUX_SECRET_KEY/MUX_TOKEN_SECRET must be configured");
  }
  return new Mux({ tokenId, tokenSecret });
}

// Product info type for extraction
export type ProductInfo = {
  title?: string;
  price?: string;
  currency?: string;
  rating?: number;
  reviewCount?: string;
  availability?: string;
  description?: string;
  features?: string[];
  brand?: string;
  category?: string;
  imageUrl?: string;
  imageUrls?: string[]; // Multiple product images
};

// Market research types
export type PainPoint = {
  issue: string;
  frequency: string;
  sentiment: "critical" | "moderate" | "minor";
  source?: string;
  url?: string;
};

export type CompetitorProduct = {
  productName: string;
  brand: string;
  price?: string;
  keyDifference: string;
  url?: string;
  source?: string;
};

export type CompetitorAd = {
  platform: "instagram" | "tiktok" | "youtube" | "other";
  competitorName: string;
  title: string;
  description?: string;
  url: string;
  source?: string;
};

export type MarketResearch = {
  painPoints: PainPoint[];
  competitors: CompetitorProduct[];
  competitorAds: CompetitorAd[];
  marketSummary?: string;
  sources: string[];
};

export type ScrapeResult =
  | { success: true; data: ProductInfo; url: string; research?: MarketResearch }
  | { success: false; error: string };

// Creative/Storyboard types
export type VideoClip = {
  id: string;
  label: string; // e.g., "A-roll", "B-roll-product", "Hook"
  prompt: string; // Video generation prompt/direction
  voiceover: string; // Audio script to be spoken
};

export type CreativeOutput = {
  clips: VideoClip[];
  generatedAt: string;
};

// Ad Intelligence types
export type AdIntelItem = {
  screenshotUrl?: string;       // Full page screenshot if available
  adCopy: string;               // Primary text/copy
  headline: string;             // Ad headline
  callToAction: string;         // CTA text
  platform: "meta" | "tiktok" | "google" | "other";
  competitorName: string;
  isActive: boolean;
  pageUrl: string;
};

export type AdPatterns = {
  commonHooks: string[];        // Opening hooks/attention grabbers
  emotionalTriggers: string[];  // Emotional appeals used
  ctaPatterns: string[];        // Call-to-action patterns
  messagingThemes: string[];    // Common themes in messaging
};

export type AdIntelligenceResult = {
  ads: AdIntelItem[];
  patterns: AdPatterns;
  summary: string;
  sources: string[];
};

// Initialize Firecrawl
function getFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("Firecrawl API key not configured");
  return new FirecrawlApp({ apiKey });
}

// Zod schemas for structured agent responses
const PainPointsSchema = z.object({
  painPoints: z.array(
    z.object({
      issue: z.string().describe("Specific user complaint, missing feature, or problem. Be concrete and actionable."),
      frequency: z.string().describe("How widespread: 'widespread issue', 'frequently mentioned', 'occasionally mentioned', or 'edge case'"),
      sentiment: z.enum(["critical", "moderate", "minor"]).describe("critical = blocking/deal-breaker, moderate = frustrating but workable, minor = nice-to-fix"),
      source: z.string().optional().describe("Where this was found (Reddit, G2, Twitter, etc.)"),
    })
  ).describe("User pain points, complaints, and feature requests"),
});

const CompetitorSchema = z.object({
  competitors: z.array(
    z.object({
      productName: z.string().describe("Exact competing product name (not brand). E.g., 'Notion', 'Figma', 'Slack'"),
      brand: z.string().describe("Company/brand that makes this product"),
      price: z.string().optional().describe("Pricing info if available (e.g., '$10/mo', 'Free tier available', '$99/year')"),
      keyDifference: z.string().describe("Why users choose this over the target product - specific differentiator"),
    })
  ).describe("Direct competing products that users compare or switch to"),
});

// Deep research using Firecrawl Agent API
async function runAgentResearch<T>(
  firecrawl: FirecrawlApp,
  prompt: string,
  schema: z.ZodType<T>
): Promise<{ data: T | null; sources: string[] }> {
  try {
    console.log("Running agent research:", prompt.slice(0, 100) + "...");

    const result = await (firecrawl as unknown as {
      agent: (params: {
        prompt: string;
        schema: z.ZodType<T>;
        model: string;
      }) => Promise<{
        success: boolean;
        data: T;
        sources?: string[];
      }>;
    }).agent({
      prompt,
      schema,
      model: "spark-1-mini", // Use mini for cost efficiency
    });

    if (result.success && result.data) {
      return {
        data: result.data,
        sources: result.sources || [],
      };
    }
    return { data: null, sources: [] };
  } catch (error) {
    console.error("Agent research error:", error);
    return { data: null, sources: [] };
  }
}

// Autonomous market research using Agent API
async function runMarketResearch(
  firecrawl: FirecrawlApp,
  productName: string,
  brand?: string,
  category?: string
): Promise<MarketResearch> {
  const productContext = [
    productName,
    brand && `by ${brand}`,
    category && `in the ${category} category`,
  ]
    .filter(Boolean)
    .join(" ");

  // Run research agents in parallel
  const [painPointsResult, competitorResult] = await Promise.all([
    // Agent 1: Pain Points & Feature Gaps Research  
    runAgentResearch(
      firecrawl,
      `Research user feedback and pain points for "${productContext}".
       
       Find:
       - Customer complaints and negative reviews
       - Missing features users frequently request
       - Usability issues and friction points
       - Performance or reliability problems
       - Pricing or value concerns
       
       Search Reddit discussions, G2/Capterra reviews, Twitter/X complaints, ProductHunt comments, and user forums.
       Focus on specific, actionable insights that a product team could address.`,
      PainPointsSchema
    ),

    // Agent 2: Direct Competitor Products
    runAgentResearch(
      firecrawl,
      `Find direct competitor products to "${productContext}" that users actively compare or switch to.
       
       Look for:
       - Specific competing products (not just brands) mentioned in "vs" comparisons
       - Products users switched TO from ${brand || productName}
       - Products users switched FROM to ${brand || productName}
       - Direct alternatives in the same price range and category
       
       For each competitor: exact product name, company, pricing if available, and their key differentiator.
       Search G2 comparisons, Capterra alternatives, ProductHunt similar products, and "X vs Y" articles.`,
      CompetitorSchema
    ),
  ]);

  // Combine all sources
  const allSources = [
    ...painPointsResult.sources,
    ...competitorResult.sources,
  ].filter((s, i, arr) => arr.indexOf(s) === i);

  return {
    painPoints: painPointsResult.data?.painPoints || [],
    competitors: (competitorResult.data?.competitors || []).map(c => ({
      ...c,
      url: undefined,
      source: undefined,
    })),
    competitorAds: [], // Agent API doesn't search for competitor ads
    marketSummary: undefined,
    sources: allSources,
  };
}

// Build search terms for common competitors based on product category
function buildCompetitorSearchTerms(productName: string, brand: string, category: string): string {
  const lowerCategory = category.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  const lowerProduct = productName.toLowerCase();

  // Category-specific competitor mappings (expand as needed)
  const categoryCompetitors: Record<string, string[]> = {
    // Footwear
    "shoes": ["Nike", "Adidas", "New Balance", "Puma", "Reebok", "Asics", "Brooks", "Saucony", "Hoka", "On Running"],
    "running shoes": ["Nike", "Adidas", "Brooks", "Asics", "Hoka", "Saucony", "New Balance", "On Running", "Mizuno"],
    "sneakers": ["Nike", "Adidas", "Jordan", "New Balance", "Puma", "Converse", "Vans", "Reebok"],
    "boots": ["Timberland", "Dr. Martens", "Red Wing", "Clarks", "UGG", "Wolverine", "Thursday Boot"],
    // Electronics
    "headphones": ["Sony", "Bose", "Apple", "Samsung", "Sennheiser", "JBL", "Beats", "Audio-Technica"],
    "earbuds": ["Apple", "Samsung", "Sony", "Jabra", "Bose", "Google", "Nothing", "Anker"],
    "smartphone": ["Apple", "Samsung", "Google", "OnePlus", "Xiaomi", "Oppo", "Motorola"],
    "laptop": ["Apple", "Dell", "HP", "Lenovo", "Asus", "Microsoft", "Acer", "Razer"],
    "tablet": ["Apple", "Samsung", "Microsoft", "Amazon", "Lenovo", "Huawei"],
    // Apparel
    "clothing": ["Nike", "Adidas", "Lululemon", "Under Armour", "Gap", "H&M", "Zara", "Uniqlo"],
    "activewear": ["Nike", "Adidas", "Lululemon", "Under Armour", "Gymshark", "Athleta", "Alo Yoga"],
    "jacket": ["The North Face", "Patagonia", "Columbia", "Arc'teryx", "Canada Goose", "Marmot"],
    // Beauty/Skincare
    "skincare": ["CeraVe", "The Ordinary", "La Roche-Posay", "Drunk Elephant", "Tatcha", "Glow Recipe"],
    "makeup": ["Maybelline", "L'Oreal", "MAC", "Fenty Beauty", "Charlotte Tilbury", "NARS", "Urban Decay"],
    // Home
    "mattress": ["Casper", "Purple", "Tempur-Pedic", "Saatva", "Nectar", "Helix", "DreamCloud"],
    "vacuum": ["Dyson", "Shark", "Roomba", "Bissell", "Miele", "Tineco", "Samsung"],
    // Kitchen
    "blender": ["Vitamix", "Ninja", "KitchenAid", "Nutribullet", "Cuisinart", "Breville"],
    "coffee maker": ["Nespresso", "Keurig", "Breville", "De'Longhi", "Cuisinart", "Mr. Coffee"],
    // Fitness
    "fitness tracker": ["Fitbit", "Apple Watch", "Garmin", "Samsung", "Whoop", "Oura"],
    "treadmill": ["Peloton", "NordicTrack", "ProForm", "Bowflex", "Sole", "Echelon"],
  };

  // Find matching category
  let competitors: string[] = [];
  for (const [cat, brands] of Object.entries(categoryCompetitors)) {
    if (lowerCategory.includes(cat) || cat.includes(lowerCategory) ||
      lowerProduct.includes(cat) || cat.includes(lowerProduct.split(" ")[0])) {
      competitors = brands.filter(b => b.toLowerCase() !== lowerBrand);
      break;
    }
  }

  // If no specific category match, use generic approach
  if (competitors.length === 0) {
    // Return empty string to let the search be more general
    return "";
  }

  // Return top 4-5 competitor brands as OR query
  const topCompetitors = competitors.slice(0, 5);
  return topCompetitors.map(c => `"${c}"`).join(" OR ");
}

// Fallback: Use Search API with scrapeOptions for content
async function runSearchResearch(
  firecrawl: FirecrawlApp,
  productName: string,
  brand?: string,
  category?: string
): Promise<MarketResearch> {
  console.log("\n========================================");
  console.log("🔍 STARTING MARKET RESEARCH");
  console.log("========================================");
  console.log("Product:", productName);
  console.log("Brand:", brand || "(none)");
  console.log("Category:", category || "(none)");

  // Clean product name for better search results
  const cleanProductName = productName.replace(/[^\w\s]/g, " ").trim();
  const searchBrand = brand || "";
  const searchCategory = category || "product";

  console.log("Clean product name:", cleanProductName);

  // First, build a list of likely competitor brand search terms
  // This helps find actual competitor ads rather than generic category content
  const competitorSearchTerms = buildCompetitorSearchTerms(cleanProductName, searchBrand, searchCategory);

  const queries = [
    // Pain points queries (indices 0-2) - user complaints, feature requests, negative feedback
    `"${cleanProductName}" OR "${searchBrand}" review complaints problems -site:amazon.com`,
    `"${cleanProductName}" "I wish" OR "should have" OR "missing feature" OR "doesn't work" reddit OR twitter`,
    `"${searchBrand}" ${searchCategory} issues frustrating user feedback site:reddit.com OR site:producthunt.com`,
    // Competitor product queries (indices 3-5) - direct 1:1 alternatives
    `"${cleanProductName}" vs OR versus OR alternative OR "compared to" ${searchCategory}`,
    `best ${searchCategory} alternatives to "${searchBrand}" OR "${cleanProductName}" 2024 2025`,
    `"switch from ${cleanProductName}" OR "moved from ${searchBrand}" OR "${cleanProductName} competitor"`,
    // Competitor social ads queries (indices 6-10) - ads from OTHER brands in this category
    // Query 6: Find competitor brand ads on YouTube (excluding our brand)
    `${competitorSearchTerms} ${searchCategory} ad OR commercial OR review -"${searchBrand}" site:youtube.com`,
    // Query 7: Find competitor sponsored content on social media
    `${searchCategory} "${competitorSearchTerms}" sponsored OR "#ad" OR "paid partnership" -"${searchBrand}" site:instagram.com OR site:tiktok.com`,
    // Query 8: Find competitor brand comparisons and reviews (these often contain ad-style content)
    `"best ${searchCategory}" OR "top ${searchCategory}" 2024 2025 -"${searchBrand}" brand review site:youtube.com`,
    // Query 9: Find competitor brand TikTok/Instagram marketing
    `${searchCategory} brand ad OR promo OR campaign -"${searchBrand}" site:tiktok.com OR site:instagram.com`,
    // Query 10: Find competitor ads via Facebook Ad Library style searches
    `${competitorSearchTerms} ${searchCategory} ad campaign OR advertisement OR marketing 2024 2025 -"${searchBrand}"`,
  ];

  console.log("\n📋 Search queries:");
  queries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));

  // Search result item type
  type SearchResultItem = {
    title?: string;
    url?: string;
    description?: string;
    markdown?: string;
  };

  const allResults: Array<{
    title: string;
    url: string;
    description: string;
    content?: string;
    queryType: "painpoint" | "competitor" | "competitorAd";
  }> = [];

  // Collect URLs to scrape for deep insights
  const urlsToScrape: Array<{
    url: string;
    title: string;
    description: string;
    queryType: "painpoint" | "competitor" | "competitorAd";
  }> = [];

  // Run all searches in parallel for speed
  const searchPromises = queries.map(async (query, i) => {
    try {
      console.log(`🔎 Search ${i + 1}: "${query.slice(0, 50)}..."`);

      const startTime = Date.now();
      const response = await firecrawl.search(query, {
        limit: 8, // Increased from 4
      });
      const elapsed = Date.now() - startTime;

      // Handle response - it comes back as { web: [...] } directly
      let items: SearchResultItem[] = [];
      const anyResponse = response as Record<string, unknown>;

      if ("web" in anyResponse && Array.isArray(anyResponse.web)) {
        items = anyResponse.web as SearchResultItem[];
      } else if ("data" in anyResponse) {
        const data = anyResponse.data;
        if (Array.isArray(data)) {
          items = data as SearchResultItem[];
        } else if (data && typeof data === "object" && "web" in (data as object)) {
          items = (data as { web: SearchResultItem[] }).web;
        }
      }

      console.log(`   ✅ Search ${i + 1}: ${items.length} results in ${elapsed}ms`);

      // Determine query type based on index (0-2: painpoint, 3-5: competitor, 6-10: competitorAd)
      const queryType: "painpoint" | "competitor" | "competitorAd" =
        i < 3 ? "painpoint" : i < 6 ? "competitor" : "competitorAd";

      return items
        .filter(item => item.url && item.title)
        .map(item => ({
          url: item.url!,
          title: item.title!,
          description: item.description || "",
          queryType,
        }));
    } catch (error) {
      console.error(`❌ Search ${i + 1} FAILED:`, error);
      return [];
    }
  });

  // Wait for all searches to complete
  const searchResults = await Promise.all(searchPromises);

  // Flatten results
  for (const results of searchResults) {
    urlsToScrape.push(...results);
  }

  console.log(`\n========================================`);
  console.log(`📊 SEARCH COMPLETE: ${urlsToScrape.length} URLs found`);
  console.log(`========================================`);

  // Deduplicate URLs
  const uniqueUrls = urlsToScrape.filter(
    (item, i, arr) => arr.findIndex((x) => x.url === item.url) === i
  );
  console.log(`📊 After dedup: ${uniqueUrls.length} unique URLs`);

  // Scrape top URLs for each category to get detailed content
  const scrapeLimit = 6; // URLs per category
  const painPointUrls = uniqueUrls.filter(u => u.queryType === "painpoint").slice(0, scrapeLimit);
  const competitorUrls = uniqueUrls.filter(u => u.queryType === "competitor").slice(0, scrapeLimit);
  const competitorAdUrls = uniqueUrls.filter(u => u.queryType === "competitorAd").slice(0, scrapeLimit);

  console.log(`\n🔬 SCRAPING FOR DEEP INSIGHTS`);
  console.log(`   Pain Point URLs: ${painPointUrls.length}`);
  console.log(`   Competitor URLs: ${competitorUrls.length}`);
  console.log(`   Competitor Ad URLs: ${competitorAdUrls.length}`);

  // Scrape URLs in parallel
  const scrapeUrl = async (item: typeof uniqueUrls[0]): Promise<typeof allResults[0] | null> => {
    try {
      console.log(`\n   📥 Scraping: ${item.url.slice(0, 60)}...`);
      const startTime = Date.now();

      const result = await firecrawl.scrape(item.url, {
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      });

      const elapsed = Date.now() - startTime;
      const contentLength = result?.markdown?.length || 0;
      console.log(`      ✅ Got ${contentLength} chars in ${elapsed}ms`);

      return {
        title: item.title,
        url: item.url,
        description: item.description,
        content: result?.markdown?.slice(0, 3000) || "",
        queryType: item.queryType,
      };
    } catch (error) {
      console.error(`      ❌ Scrape failed:`, error);
      return {
        title: item.title,
        url: item.url,
        description: item.description,
        content: "",
        queryType: item.queryType,
      };
    }
  };

  // Scrape all URLs in parallel
  const scrapePromises = [...painPointUrls, ...competitorUrls, ...competitorAdUrls].map(scrapeUrl);
  const scrapedResults = await Promise.all(scrapePromises);

  // Filter out nulls and add to results
  for (const result of scrapedResults) {
    if (result) {
      allResults.push(result);
    }
  }

  console.log(`\n========================================`);
  console.log(`📊 SCRAPE COMPLETE: ${allResults.length} results with content`);
  console.log(`========================================`);

  // Transform scraped results into structured insights
  const painPointResults = allResults.filter((r) => r.queryType === "painpoint");
  const competitorResults = allResults.filter((r) => r.queryType === "competitor");
  const competitorAdResults = allResults.filter((r) => r.queryType === "competitorAd");

  // Extract pain points from content
  const painPoints: PainPoint[] = painPointResults.slice(0, 6).map((r) => {
    const content = r.content || r.description || "";
    const text = (r.title + " " + content).toLowerCase();

    // Analyze severity based on language intensity
    const criticalWords = ["terrible", "worst", "broken", "unusable", "scam", "avoid", "disaster", "awful", "hate", "garbage", "waste"];
    const moderateWords = ["problem", "issue", "disappointing", "frustrated", "annoying", "slow", "confusing", "expensive", "lacking", "wish"];

    let sentiment: "critical" | "moderate" | "minor" = "minor";
    if (criticalWords.some((w) => text.includes(w))) {
      sentiment = "critical";
    } else if (moderateWords.some((w) => text.includes(w))) {
      sentiment = "moderate";
    }

    // Extract specific issue from content - look for product feedback patterns
    let issue = r.title;
    if (content.length > 50) {
      // Look for common feedback patterns
      const feedbackPatterns = [
        /(?:I wish|wish it|should have|needs to|missing)[^.]{10,120}/i,
        /(?:the|main|biggest)\s+(?:problem|issue|complaint|downside)[^.]{10,120}/i,
        /(?:doesn't|does not|won't|can't|cannot)\s+[^.]{10,100}/i,
        /(?:too\s+(?:slow|expensive|confusing|complicated|buggy))[^.]{10,100}/i,
        /(?:feature\s+(?:request|missing|needed|lacking))[^.]{10,100}/i,
      ];

      for (const pattern of feedbackPatterns) {
        const match = content.match(pattern);
        if (match) {
          issue = match[0].trim();
          break;
        }
      }
    }

    // Determine frequency/impact from content
    let frequency = "user reported";
    if (text.includes("everyone") || text.includes("all users") || text.includes("common issue")) {
      frequency = "widespread issue";
    } else if (text.includes("many") || text.includes("most") || text.includes("lots of")) {
      frequency = "frequently mentioned";
    } else if (text.includes("some") || text.includes("few") || text.includes("occasionally")) {
      frequency = "occasionally mentioned";
    }

    return {
      issue: issue.slice(0, 150),
      frequency,
      sentiment,
      source: extractDomain(r.url),
      url: r.url,
    };
  });

  // Extract competitor products from content - looking for 1-to-1 product comparisons
  const competitors: CompetitorProduct[] = competitorResults.slice(0, 6).map((r) => {
    const content = r.content || r.description || "";
    const title = r.title || "";

    // Try to extract product/company name from title
    let productName = title;

    // Clean up common title patterns
    productName = productName
      .replace(/\s*[-|]\s*(G2|Capterra|Product Hunt|Amazon|Best Buy).*$/i, "")
      .replace(/^Best\s+/i, "")
      .replace(/\s+Review$/i, "")
      .replace(/\s+vs\.?\s+.*$/i, "")
      .replace(/\s+alternatives?.*$/i, "")
      .slice(0, 80);

    // Try to extract brand/company name - look for capitalized words or quoted names
    const brandMatch = content.match(/(?:by\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    const brand = brandMatch?.[1] || productName.split(/\s+/)[0] || "";

    // Try to extract price from content (various formats)
    const priceMatch = content.match(/\$\d{1,4}(?:\.\d{2})?(?:\/mo(?:nth)?)?|\d+(?:\.\d{2})?\s*(?:USD|EUR)/i);
    const price = priceMatch?.[0];

    // Extract key difference - what makes this product notable
    let keyDifference = r.description?.slice(0, 150) || "";

    // Look for comparison phrases
    const differencePatterns = content.match(/(?:features?|offers?|provides?|includes?|known for|stands out|specializes?|focuses?)[^.]{10,100}/i);
    if (differencePatterns) {
      keyDifference = differencePatterns[0].trim().slice(0, 150);
    }

    return {
      productName: productName.slice(0, 100),
      brand,
      price,
      keyDifference: keyDifference || "See source for details",
      url: r.url,
      source: extractDomain(r.url),
    };
  });

  // Known brand names to look for in competitor ad content
  const knownBrands = [
    // Footwear
    "Nike", "Adidas", "New Balance", "Puma", "Reebok", "Asics", "Brooks", "Saucony", "Hoka", "On Running", "On Cloud",
    "Jordan", "Converse", "Vans", "Timberland", "Dr. Martens", "UGG", "Clarks",
    // Electronics
    "Apple", "Samsung", "Sony", "Bose", "Google", "Microsoft", "Dell", "HP", "Lenovo", "Asus",
    "Beats", "JBL", "Sennheiser", "Jabra", "Nothing", "OnePlus", "Xiaomi", "Oppo",
    // Apparel
    "Lululemon", "Under Armour", "Gymshark", "Athleta", "North Face", "Patagonia", "Columbia", "Arc'teryx",
    "Gap", "H&M", "Zara", "Uniqlo",
    // Beauty
    "CeraVe", "The Ordinary", "La Roche-Posay", "Drunk Elephant", "Tatcha", "Maybelline", "L'Oreal", "MAC", "Fenty",
    // Home/Kitchen
    "Dyson", "Vitamix", "Ninja", "KitchenAid", "Casper", "Purple", "Tempur-Pedic", "Roomba", "Shark",
    // Fitness
    "Fitbit", "Garmin", "Whoop", "Peloton", "NordicTrack",
  ];

  // Extract competitor social media ads - filter for actual competitor content
  const competitorAds: CompetitorAd[] = competitorAdResults
    .filter((r) => {
      // Filter out results that contain the original brand (not a competitor)
      const text = (r.title + " " + (r.content || "") + " " + (r.description || "")).toLowerCase();
      const originalBrand = (brand || "").toLowerCase();
      // If original brand is heavily featured, it's probably not a competitor ad
      if (originalBrand && text.split(originalBrand).length > 3) {
        return false;
      }
      return true;
    })
    .slice(0, 8)
    .map((r) => {
      const url = r.url.toLowerCase();
      const title = r.title || "";
      const content = r.content || r.description || "";
      const fullText = title + " " + content;

      let platform: CompetitorAd["platform"] = "other";
      if (url.includes("instagram.com")) platform = "instagram";
      else if (url.includes("tiktok.com")) platform = "tiktok";
      else if (url.includes("youtube.com") || url.includes("youtu.be")) platform = "youtube";

      // Try to extract competitor name - first check for known brands
      let competitorName = "";
      const originalBrandLower = (brand || "").toLowerCase();

      // Check for known brands in the content (excluding the original brand)
      for (const knownBrand of knownBrands) {
        if (knownBrand.toLowerCase() !== originalBrandLower &&
          fullText.toLowerCase().includes(knownBrand.toLowerCase())) {
          competitorName = knownBrand;
          break;
        }
      }

      // Fallback: try to extract from title patterns
      if (!competitorName) {
        // Look for brand mentions or channel names in title
        const brandPatterns = [
          /^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+(?:ad|commercial|review|vs|comparison)/i,
          /by\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/i,
          /([A-Z][a-zA-Z0-9]+)\s+(?:official|brand|channel)/i,
        ];
        for (const pattern of brandPatterns) {
          const match = title.match(pattern);
          if (match && match[1] && match[1].toLowerCase() !== originalBrandLower) {
            competitorName = match[1];
            break;
          }
        }
      }

      // Last fallback: extract first capitalized word from title
      if (!competitorName) {
        const firstWord = title.match(/^([A-Z][a-zA-Z0-9]+)/);
        if (firstWord && firstWord[1].length > 2) {
          competitorName = firstWord[1];
        } else {
          competitorName = "Competitor Brand";
        }
      }

      // Determine ad type from content
      let description = r.description?.slice(0, 200) || "";
      if (content.toLowerCase().includes("sponsored") || content.toLowerCase().includes("#ad")) {
        description = "[Sponsored] " + description;
      }

      return {
        platform,
        competitorName: competitorName.slice(0, 50),
        title: title.slice(0, 100),
        description,
        url: r.url,
        source: extractDomain(r.url),
      };
    })
    // Filter out duplicates by competitor name
    .filter((ad, idx, arr) => arr.findIndex(a => a.competitorName === ad.competitorName) === idx);

  // Helper to extract domain
  function extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url.split("/")[2] || "unknown";
    }
  }

  console.log(`\n📈 RESEARCH RESULTS:`);
  console.log(`   Pain points: ${painPoints.length}`);
  painPoints.forEach((p, i) => console.log(`     ${i + 1}. [${p.sentiment}] ${p.issue.slice(0, 50)}...`));
  console.log(`   Competitors: ${competitors.length}`);
  competitors.forEach((c, i) => console.log(`     ${i + 1}. ${c.brand} - ${c.productName.slice(0, 40)}...`));
  console.log(`   Competitor Ads: ${competitorAds.length}`);
  competitorAds.forEach((s, i) => console.log(`     ${i + 1}. [${s.platform}] ${s.competitorName} - ${s.title.slice(0, 30)}...`));
  console.log(`========================================\n`);

  return {
    painPoints,
    competitors,
    competitorAds,
    marketSummary: painPoints.length > 0 || competitors.length > 0 || competitorAds.length > 0
      ? `Found ${painPoints.length} pain points, ${competitors.length} competing products, and ${competitorAds.length} competitor ads.`
      : undefined,
    sources: allResults.map((r) => r.url),
  };
}

export async function scrapeProductUrl(
  url: string,
  enableResearch = false
): Promise<ScrapeResult> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    return { success: false, error: "Invalid URL format" };
  }

  try {
    const firecrawl = getFirecrawl();

    console.log("Scraping product page with Firecrawl...");

    // Scrape product info with structured extraction
    const result = await firecrawl.scrape(url, {
      formats: [
        {
          type: "json",
          schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Product name/title" },
              price: { type: "string", description: "Product price with currency symbol" },
              currency: { type: "string", description: "Currency code (USD, EUR, etc.)" },
              rating: { type: "number", description: "Product rating out of 5" },
              reviewCount: { type: "string", description: "Number of reviews" },
              availability: { type: "string", description: "Stock availability status" },
              description: { type: "string", description: "Product description (first 300 chars)" },
              features: {
                type: "array",
                items: { type: "string" },
                description: "Key product features as bullet points (max 5)",
              },
              brand: { type: "string", description: "Product brand name" },
              category: { type: "string", description: "Product category" },
              imageUrl: { type: "string", description: "Main product image URL (full URL starting with http)" },
              imageUrls: {
                type: "array",
                items: { type: "string" },
                description: "All product image URLs (full URLs starting with http, max 8 images)",
              },
            },
          },
        },
      ],
    });
    
    console.log("Firecrawl scrape complete");

    if (!result || !result.json) {
      return { success: false, error: "Failed to scrape the page - no data returned" };
    }

    const jsonData = result.json as ProductInfo;

    // Run market research if enabled
    let research: MarketResearch | undefined;
    if (enableResearch && jsonData.title) {
      console.log("Starting autonomous market research for:", jsonData.title);

      // Use Search API directly (Agent API requires special access)
      research = await runSearchResearch(
        firecrawl,
        jsonData.title,
        jsonData.brand,
        jsonData.category
      );

      // If search returned no results, try Agent API as fallback
      if (
        research.painPoints.length === 0 &&
        research.competitors.length === 0 &&
        (research.competitorAds?.length ?? 0) === 0
      ) {
        console.log("Search API returned no results, trying Agent API...");
        try {
          const agentResearch = await runMarketResearch(
            firecrawl,
            jsonData.title,
            jsonData.brand,
            jsonData.category
          );
          if (
            agentResearch.painPoints.length > 0 ||
            agentResearch.competitors.length > 0
          ) {
            research = agentResearch;
          }
        } catch (agentError) {
          console.log("Agent API not available:", agentError);
        }
      }

      console.log(
        `Research complete: ${research.painPoints.length} pain points, ` +
        `${research.competitors.length} competitors, ${research.competitorAds?.length ?? 0} competitor ads`
      );
    }

    return {
      success: true,
      data: jsonData,
      url,
      research,
    };
  } catch (error) {
    console.error("Scrape error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape product information",
    };
  }
}

// Refresh research independently
export async function refreshProductResearch(
  productName: string,
  brand?: string,
  category?: string
): Promise<MarketResearch> {
  try {
    const firecrawl = getFirecrawl();

    console.log("Refreshing research for:", productName);

    // Use Search API (more reliable)
    const research = await runSearchResearch(firecrawl, productName, brand, category);

    console.log(
      `Refresh complete: ${research.painPoints.length} pain points, ` +
      `${research.competitors.length} competitors, ${research.competitorAds?.length ?? 0} competitor ads`
    );

    return research;
  } catch (error) {
    console.error("Research refresh error:", error);
    return {
      painPoints: [],
      competitors: [],
      competitorAds: [],
      sources: [],
    };
  }
}

// Schema for Ad Intelligence extraction
const AdIntelSchema = z.object({
  ads: z.array(
    z.object({
      adCopy: z.string().describe("The main ad copy/text"),
      headline: z.string().describe("The ad headline"),
      callToAction: z.string().describe("The call-to-action text (e.g., 'Shop Now', 'Learn More')"),
      competitorName: z.string().describe("Name of the competitor running this ad"),
      isActive: z.boolean().describe("Whether this ad appears to be currently running"),
    })
  ).describe("Competitor advertisements found"),
  patterns: z.object({
    commonHooks: z.array(z.string()).describe("Common opening hooks used to grab attention"),
    emotionalTriggers: z.array(z.string()).describe("Emotional appeals and triggers used"),
    ctaPatterns: z.array(z.string()).describe("Common call-to-action patterns"),
    messagingThemes: z.array(z.string()).describe("Common themes in the messaging"),
  }),
  summary: z.string().describe("Brief summary of competitor ad strategies"),
});

// Scrape competitor ad intelligence using Firecrawl
export async function scrapeCompetitorAdIntel(
  productName: string,
  brand?: string,
  category?: string,
  competitors?: string[]
): Promise<AdIntelligenceResult> {
  try {
    const firecrawl = getFirecrawl();
    const openai = getOpenAI();

    console.log("🔍 Starting competitor ad intelligence for:", productName);

    // Build search context
    const productContext = [productName, brand, category].filter(Boolean).join(" ");
    const competitorList = competitors?.slice(0, 5) || [];

    // Search for competitor ads using Firecrawl
    const searchQueries = [
      `${productContext} advertisement marketing campaign`,
      `${category || productName} brand ads creative examples`,
      ...competitorList.map(c => `${c} ${category || "product"} advertisement`),
    ];

    const allContent: { url: string; content: string; title: string }[] = [];
    const sources: string[] = [];

    // Run searches in parallel
    const searchPromises = searchQueries.slice(0, 4).map(async (query) => {
      try {
        const response = await firecrawl.search(query, {
          limit: 5,
        });

        // Handle response - it comes back as { web: [...] } directly
        type SearchItem = { url?: string; title?: string; description?: string; markdown?: string };
        let items: SearchItem[] = [];
        const anyResponse = response as Record<string, unknown>;

        if ("web" in anyResponse && Array.isArray(anyResponse.web)) {
          items = anyResponse.web as SearchItem[];
        } else if ("data" in anyResponse) {
          const data = anyResponse.data;
          if (Array.isArray(data)) {
            items = data as SearchItem[];
          } else if (data && typeof data === "object" && "web" in (data as object)) {
            items = (data as { web: SearchItem[] }).web;
          }
        }

        for (const item of items) {
          if (item.url) {
            sources.push(item.url);
            allContent.push({
              url: item.url,
              content: item.markdown?.slice(0, 2000) || item.description || "",
              title: item.title || "",
            });
          }
        }
      } catch (error) {
        console.error(`Search error for "${query}":`, error);
      }
    });

    await Promise.all(searchPromises);

    // Scrape Meta Ad Library if we have competitor names
    if (competitorList.length > 0) {
      try {
        const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(competitorList[0])}`;
        
        const adLibraryResult = await firecrawl.scrape(adLibraryUrl, {
          formats: ["markdown"],
          timeout: 20000,
        });

        if (adLibraryResult?.markdown) {
          sources.push(adLibraryUrl);
          allContent.push({
            url: adLibraryUrl,
            content: adLibraryResult.markdown.slice(0, 4000),
            title: "Meta Ad Library",
          });
        }
      } catch (error) {
        console.error("Meta Ad Library scrape failed:", error);
      }
    }

    console.log(`📊 Gathered ${allContent.length} content sources, analyzing...`);

    // Use GPT to analyze and extract ad intelligence
    const combinedContent = allContent
      .map(c => `### ${c.title}\nURL: ${c.url}\n${c.content}`)
      .join("\n\n---\n\n")
      .slice(0, 15000);

    // Original brand to exclude from results
    const originalBrand = brand?.toLowerCase().trim() || "";
    const productNameLower = productName.toLowerCase();

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an advertising intelligence analyst. Analyze competitor ads and marketing content to extract actionable insights.

Focus on:
- Actual ad copy and headlines used by COMPETITORS ONLY
- Common hooks and attention-grabbers
- Emotional triggers and pain points addressed
- Call-to-action patterns
- Messaging themes and positioning

IMPORTANT: Only include ads from COMPETITOR brands. Do NOT include ads from the original brand being researched.

Return structured JSON with ads array, patterns object, and summary.`,
        },
        {
          role: "user",
          content: `Analyze competitor advertising for: "${productContext}"

ORIGINAL BRAND (DO NOT INCLUDE ADS FROM THIS BRAND): ${brand || productName}

Competitors to focus on: ${competitorList.join(", ") || "any relevant competitors"}

Content to analyze:
${combinedContent}

Extract ad intelligence in this JSON format:
{
  "ads": [{ "adCopy": "", "headline": "", "callToAction": "", "competitorName": "", "isActive": true }],
  "patterns": {
    "commonHooks": ["hook1", "hook2"],
    "emotionalTriggers": ["trigger1", "trigger2"],
    "ctaPatterns": ["cta1", "cta2"],
    "messagingThemes": ["theme1", "theme2"]
  },
  "summary": "Brief analysis of competitor ad strategies"
}

Remember: DO NOT include any ads from "${brand || productName}" - only competitor brands.`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim() || "{}";
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse ad intel JSON:", content);
      parsed = { ads: [], patterns: { commonHooks: [], emotionalTriggers: [], ctaPatterns: [], messagingThemes: [] }, summary: "" };
    }

    // Transform ads to include platform and pageUrl, filtering out the original brand
    const ads: AdIntelItem[] = (parsed.ads || [])
      .filter((ad: { competitorName: string }) => {
        const competitorNameLower = ad.competitorName?.toLowerCase().trim() || "";
        // Filter out ads from the original brand
        if (originalBrand && competitorNameLower.includes(originalBrand)) return false;
        if (originalBrand && originalBrand.includes(competitorNameLower) && competitorNameLower.length > 2) return false;
        if (competitorNameLower.includes(productNameLower) || productNameLower.includes(competitorNameLower)) return false;
        return true;
      })
      .map((ad: { adCopy: string; headline: string; callToAction: string; competitorName: string; isActive: boolean }, i: number) => ({
        ...ad,
        platform: "meta" as const,
        pageUrl: sources[i] || "",
        screenshotUrl: undefined,
      }));

    console.log(`✅ Ad Intel complete: ${ads.length} competitor ads (filtered out original brand)`);

    return {
      ads,
      patterns: parsed.patterns || { commonHooks: [], emotionalTriggers: [], ctaPatterns: [], messagingThemes: [] },
      summary: parsed.summary || "",
      sources: [...new Set(sources)],
    };
  } catch (error) {
    console.error("Ad intelligence error:", error);
    return {
      ads: [],
      patterns: { commonHooks: [], emotionalTriggers: [], ctaPatterns: [], messagingThemes: [] },
      summary: "",
      sources: [],
    };
  }
}

// Initialize OpenAI
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey });
}

// Generate and validate video clips using GPT-4.1
// Creates a cohesive 4-scene advertisement narrative: Hook → Problem → Solution → CTA
async function generateClipsWithAI(
  productName: string,
  brandName: string | undefined,
  painPoints: string[],
  competitors: string[],
  features: string[]
): Promise<VideoClip[]> {
  try {
    const openai = getOpenAI();

    // Build branded product identifier for prompts
    // Avoid duplicating brand name if it's already in the product name
    const brandedProduct = brandName && !productName.toLowerCase().includes(brandName.toLowerCase())
      ? `${brandName} ${productName}` 
      : productName;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are a premium short-form video ad creator. Generate EXACTLY 4 video scenes that flow together as a cohesive advertisement narrative.

ADVERTISEMENT STRUCTURE (4 SCENES TOTAL):
1. HOOK (Scene 1): Dramatic, attention-grabbing product reveal. Create intrigue and stop the scroll.
2. PROBLEM (Scene 2): Subtly show the frustration or limitation the product solves. Build tension.
3. SOLUTION (Scene 3): Showcase the product's key feature in action. The "aha" moment.
4. CTA (Scene 4): Final glamour shot with brand prominence. Create desire and urgency.

CRITICAL RULES:
- Generate EXACTLY 4 scenes that tell a complete story
- Product-only B-roll footage - NO people, hands, or faces
- Each scene must flow naturally into the next (visual and narrative continuity)
- Use cinematic language: "macro shot", "dramatic lighting", "slow reveal", "floating product", "cinematic sweep"
- The voiceover script must form one cohesive narrative when read in sequence
- Keep each voiceover line punchy (8-12 words max) - they will be combined into one audio track

PRODUCT: "${brandedProduct}"
BRAND: "${brandName || productName}"

Output valid JSON array with exactly 4 clips, each having: label, prompt, voiceover`
        },
        {
          role: "user",
          content: `Product: ${brandedProduct}

PAIN POINTS TO ADDRESS:
${painPoints.slice(0, 2).map(p => `- ${p}`).join("\n") || "- Frustration with inferior alternatives"}

KEY FEATURES TO HIGHLIGHT:
${features.slice(0, 2).map(f => `- ${f}`).join("\n") || "- Premium quality and performance"}

Generate a 4-scene advertisement that tells a compelling story:
- Scene 1 (Hook): Dramatic reveal that grabs attention
- Scene 2 (Problem): Visual tension showing what life was like before  
- Scene 3 (Solution): The product solving the problem beautifully
- Scene 4 (CTA): Aspirational close with brand prominence

The 4 voiceover lines MUST flow together as one script. Example flow:
"What if silence was this beautiful?" → "No more compromises." → "Pure, immersive sound." → "${brandName || productName}. Hear everything."

Return ONLY the JSON array with exactly 4 clips:`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    // Parse JSON, handling potential markdown code blocks
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const clips = JSON.parse(jsonStr) as Array<{ label: string; prompt: string; voiceover: string }>;

    // Ensure we have exactly 4 clips
    const finalClips = clips.slice(0, 4);
    
    return finalClips.map((clip, index) => ({
      id: crypto.randomUUID(),
      label: clip.label || ["Hook", "Problem", "Solution", "CTA"][index],
      prompt: clip.prompt,
      voiceover: clip.voiceover,
    }));
  } catch (error) {
    console.error("AI clip generation error:", error);
    return [];
  }
}

// Generate ad clips based on research insights
export async function generateStoryboards(
  product: ProductInfo,
  research: MarketResearch
): Promise<CreativeOutput> {
  console.log("Generating video clips for:", product.title);

  const productName = product.title || product.brand || "this product";
  const brandName = product.brand;

  // Extract research data
  const painPoints = research.painPoints.map(p => p.issue);
  const competitors = research.competitors.map(c => c.productName || c.brand);
  const features = product.features || (product.description ? [product.description] : []);
  
  // Generate clips with AI (now includes brand name for branding)
  console.log("Generating clips with GPT-4.1...");
  let clips = await generateClipsWithAI(productName, brandName, painPoints, competitors, features);

  // Fallback if AI fails - 4-scene narrative structure
  if (clips.length === 0) {
    const shortName = product.brand || productName.split(" ")[0];
    // Avoid duplicating brand name if it's already in the product name
    const brandedProduct = brandName && !productName.toLowerCase().includes(brandName.toLowerCase())
      ? `${brandName} ${productName}` 
      : productName;
    const mainFeature = features[0] || "premium quality";
    const painPoint = painPoints[0] || "settling for less";

    // 4-scene narrative: Hook → Problem → Solution → CTA
    clips = [
      {
        id: crypto.randomUUID(),
        label: "Hook",
        prompt: `Dramatic slow reveal of ${brandedProduct} emerging from darkness into spotlight, cinematic lighting, particles floating, mysterious atmosphere, premium product photography`,
        voiceover: `What if everything changed?`,
      },
      {
        id: crypto.randomUUID(),
        label: "Problem",
        prompt: `Split screen effect: dim, desaturated generic products on one side fading away, ${brandedProduct} glowing on the other side, visual contrast, tension building`,
        voiceover: `No more ${painPoint.slice(0, 25).toLowerCase()}.`,
      },
      {
        id: crypto.randomUUID(),
        label: "Solution",
        prompt: `${brandedProduct} in action, extreme macro detail shot highlighting ${mainFeature.slice(0, 30)}, golden hour lighting, shallow depth of field, premium feel`,
        voiceover: `Experience ${mainFeature.slice(0, 20)}. Perfected.`,
      },
      {
        id: crypto.randomUUID(),
        label: "CTA",
        prompt: `${brandedProduct} hero shot with ${shortName} logo prominently visible, floating on gradient background, lens flare, aspirational mood, call to action energy`,
        voiceover: `${shortName}. This is it.`,
      },
    ];
  }

  // Ensure exactly 4 clips for the ad structure
  clips = clips.slice(0, 4);

  console.log(`Generated ${clips.length} video clips`);

  return {
    clips,
    generatedAt: new Date().toISOString(),
  };
}

// Video + voiceover generation result type
export type ClipGenerationResult =
  | { 
      success: true; 
      muxPlaybackId: string;  // Mux playback ID for the video player
      muxAssetId: string;     // Mux asset ID for management
      sceneCount: number;
      audioDuration: number;  // Duration in seconds
    }
  | { success: false; error: string };

// Generate voiceover audio using ElevenLabs REST API
async function generateVoiceover(text: string): Promise<
  | { success: true; audioBase64: string; duration: number }
  | { success: false; error: string }
> {
  const apiKey = (process.env.ELEVEN_API_KEY || process.env.ELEVENLABS_API_KEY)?.trim();
  
  if (!apiKey) {
    return { success: false, error: "ELEVEN_API_KEY not configured" };
  }

  try {
    console.log("Generating voiceover for:", text.slice(0, 50) + "...");

    // Using "Charlotte" voice - confident, warm female voice perfect for ads
    const voiceId = "XB0fDUnXU5powFXDhCwa"; // Charlotte - confident female voice
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2", // Most realistic model
        voice_settings: {
          stability: 0.6, // Balanced for natural variation
          similarity_boost: 0.8, // High for authentic voice
          style: 0.5, // Expressive for advertisement feel
          use_speaker_boost: true, // Enhanced audio quality
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", response.status, errorText);
      return { success: false, error: `ElevenLabs API error: ${response.status} - ${errorText}` };
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    // Estimate duration based on text length (rough approximation: ~150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60;

    console.log(`Voiceover generation complete (~${estimatedDuration.toFixed(1)}s estimated)`);
    return { success: true, audioBase64, duration: estimatedDuration };
  } catch (error) {
    console.error("Voiceover generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate voiceover",
    };
  }
}

// Generate a single short video scene (2 seconds) using RunwayML
async function generateVideoScene(promptText: string, sceneIndex: number): Promise<{ success: true; videoUrl: string; sceneIndex: number } | { success: false; error: string; sceneIndex: number }> {
  if (!process.env.RUNWAYML_API_SECRET) {
    return { success: false, error: "RUNWAYML_API_SECRET not configured", sceneIndex };
  }

  try {
    const client = new RunwayML();

    console.log(`Starting scene ${sceneIndex + 1} generation for:`, promptText.slice(0, 50) + "...");

    const task = await client.textToVideo
      .create({
        model: "veo3.1_fast",
        promptText,
        ratio: "1280:720",
        duration: 4, // 4 seconds per scene, 4 scenes = 16 seconds total (fast-paced ad cuts)
      })
      .waitForTaskOutput();

    console.log(`Scene ${sceneIndex + 1} generation complete`);

    if (task.output && Array.isArray(task.output) && task.output[0]) {
      return { success: true, videoUrl: task.output[0], sceneIndex };
    }

    return { success: false, error: "No video output returned", sceneIndex };
  } catch (error) {
    console.error(`Scene ${sceneIndex + 1} generation error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate video",
      sceneIndex,
    };
  }
}

// Upload video to Mux and get playback ID
async function uploadToMux(
  videoFilePath: string
): Promise<{ success: true; playbackId: string; assetId: string } | { success: false; error: string }> {
  try {
    const mux = getMuxClient();
    
    console.log("Uploading video to Mux...");
    
    // Read the video file
    const { readFileSync } = await import("node:fs");
    const videoBuffer = readFileSync(videoFilePath);
    
    // Create a direct upload URL
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policies: ["public"],
        encoding_tier: "baseline", // Fast encoding
      },
    });

    // Upload the video to Mux
    const uploadResponse = await fetch(upload.url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    console.log("Video uploaded, waiting for Mux to process...");

    // Poll for the asset to be ready
    let asset = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max wait

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const uploadStatus = await mux.video.uploads.retrieve(upload.id);
      
      if (uploadStatus.asset_id) {
        asset = await mux.video.assets.retrieve(uploadStatus.asset_id);
        
        if (asset.status === "ready") {
          console.log("Mux asset ready!");
          break;
        } else if (asset.status === "errored") {
          throw new Error("Mux asset processing failed");
        }
      }
      
      attempts++;
      console.log(`Waiting for Mux processing... (attempt ${attempts}/${maxAttempts})`);
    }

    if (!asset || asset.status !== "ready") {
      throw new Error("Timed out waiting for Mux to process video");
    }

    const playbackId = asset.playback_ids?.[0]?.id;
    if (!playbackId) {
      throw new Error("No playback ID returned from Mux");
    }

    console.log("Mux upload complete. Playback ID:", playbackId);
    return { success: true, playbackId, assetId: asset.id };
  } catch (error) {
    console.error("Mux upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload to Mux",
    };
  }
}

// Combine multiple video scenes with audio using ffmpeg
async function combineVideosWithAudio(
  videoUrls: string[],
  audioBase64: string
): Promise<{ success: true; outputFilePath: string; tempDir: string } | { success: false; error: string }> {
  const { execSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = mkdtempSync(join(tmpdir(), "video-combine-"));
    console.log("Created temp directory:", tempDir);

    // Download all videos in parallel
    console.log("Downloading", videoUrls.length, "video scenes...");
    const videoPromises = videoUrls.map(async (url, i) => {
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const filePath = join(tempDir!, `scene_${i}.mp4`);
      writeFileSync(filePath, buffer);
      return filePath;
    });

    const videoFiles = await Promise.all(videoPromises);
    console.log("Downloaded all video scenes");

    // Write audio file
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const audioFile = join(tempDir, "audio.mp3");
    writeFileSync(audioFile, audioBuffer);

    // Create ffmpeg concat file
    const concatFile = join(tempDir, "concat.txt");
    const concatContent = videoFiles.map(f => `file '${f}'`).join("\n");
    writeFileSync(concatFile, concatContent);

    // Concatenate videos (re-encode to ensure consistent codec)
    const concatenatedVideo = join(tempDir, "concatenated.mp4");
    execSync(`ffmpeg -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -crf 23 -an "${concatenatedVideo}"`, {
      stdio: "pipe",
    });
    console.log("Concatenated videos");

    // Combine video with audio - ensure audio is properly encoded
    const outputFile = join(tempDir, "final.mp4");
    execSync(
      `ffmpeg -i "${concatenatedVideo}" -i "${audioFile}" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest "${outputFile}"`,
      { stdio: "pipe" }
    );
    console.log("Combined video with audio");

    // Return the file path and temp dir (caller will clean up after Mux upload)
    return { success: true, outputFilePath: outputFile, tempDir };
  } catch (error) {
    console.error("Video combination error:", error);
    // Cleanup on error
    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to combine videos",
    };
  }
}

// Cleanup helper for temp directories
async function cleanupTempDir(tempDir: string) {
  const { rmSync, existsSync } = await import("node:fs");
  if (existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
      console.log("Cleaned up temp directory");
    } catch {
      console.warn("Failed to cleanup temp directory");
    }
  }
}

// Generate a complete advertisement with multiple cuts
// Takes all clips, generates 4 scene videos in parallel, combines with voiceover, uploads to Mux
export async function generateClipMedia(
  videoPrompt: string,
  voiceoverText: string,
  allClips?: VideoClip[]
): Promise<ClipGenerationResult> {
  // If we have all clips, generate a multi-scene ad
  if (allClips && allClips.length >= 4) {
    console.log("Generating multi-scene advertisement with", allClips.length, "clips");
    
    // Take first 4 clips for the scenes (Hook → Problem → Solution → CTA)
    const scenesToGenerate = allClips.slice(0, 4);
    
    // Combine all voiceovers into one cohesive script
    const combinedVoiceover = scenesToGenerate.map(c => c.voiceover).join(" ");
    
    // Generate all 4 video scenes in parallel + voiceover
    console.log("Generating 4 scenes in parallel + voiceover...");
    const [scene1, scene2, scene3, scene4, audioResult] = await Promise.all([
      generateVideoScene(scenesToGenerate[0].prompt, 0),
      generateVideoScene(scenesToGenerate[1].prompt, 1),
      generateVideoScene(scenesToGenerate[2].prompt, 2),
      generateVideoScene(scenesToGenerate[3].prompt, 3),
      generateVoiceover(combinedVoiceover),
    ]);

    // Check for failures
    const sceneResults = [scene1, scene2, scene3, scene4];
    const failedScenes = sceneResults.filter(s => !s.success);
    
    if (failedScenes.length > 0) {
      const errors = failedScenes.map(s => `Scene ${s.sceneIndex + 1}: ${(s as { error: string }).error}`);
      return { success: false, error: `Video generation failed: ${errors.join(", ")}` };
    }

    if (!audioResult.success) {
      return { success: false, error: `Audio: ${audioResult.error}` };
    }

    // Get all successful video URLs in order
    const videoUrls = sceneResults
      .filter((s): s is { success: true; videoUrl: string; sceneIndex: number } => s.success)
      .sort((a, b) => a.sceneIndex - b.sceneIndex)
      .map(s => s.videoUrl);

    // Combine videos with audio using ffmpeg
    console.log("Combining", videoUrls.length, "scenes with audio...");
    const combineResult = await combineVideosWithAudio(videoUrls, audioResult.audioBase64);

    if (!combineResult.success) {
      return { success: false, error: `Combine: ${combineResult.error}` };
    }

    // Upload to Mux for professional video hosting
    console.log("Uploading combined video to Mux...");
    const muxResult = await uploadToMux(combineResult.outputFilePath);
    
    // Cleanup temp files after upload
    await cleanupTempDir(combineResult.tempDir);

    if (!muxResult.success) {
      return { success: false, error: `Mux upload: ${muxResult.error}` };
    }

    return {
      success: true,
      muxPlaybackId: muxResult.playbackId,
      muxAssetId: muxResult.assetId,
      sceneCount: 4,
      audioDuration: audioResult.duration,
    };
  }

  // Single clip mode (fallback) - still upload to Mux
  console.log("Generating single video clip");
  const [videoResult, audioResult] = await Promise.all([
    generateVideoScene(videoPrompt, 0),
    generateVoiceover(voiceoverText),
  ]);

  if (!videoResult.success) {
    return { success: false, error: `Video: ${videoResult.error}` };
  }

  if (!audioResult.success) {
    return { success: false, error: `Audio: ${audioResult.error}` };
  }

  // Combine single video with audio
  const combineResult = await combineVideosWithAudio([videoResult.videoUrl], audioResult.audioBase64);
  
  if (!combineResult.success) {
    return { success: false, error: `Combine: ${combineResult.error}` };
  }

  // Upload to Mux
  const muxResult = await uploadToMux(combineResult.outputFilePath);
  await cleanupTempDir(combineResult.tempDir);

  if (!muxResult.success) {
    return { success: false, error: `Mux upload: ${muxResult.error}` };
  }

  return {
    success: true,
    muxPlaybackId: muxResult.playbackId,
    muxAssetId: muxResult.assetId,
    sceneCount: 1,
    audioDuration: audioResult.duration,
  };
}

// ============================================
// INFLUENCER DISCOVERY & EMAIL OUTREACH
// ============================================

export type Influencer = {
  id: string;
  name: string;
  handle: string;
  platform: "instagram" | "tiktok" | "twitter" | "youtube";
  followers?: string;
  niche?: string;
  bio?: string;
  profileUrl: string;
  email?: string;
  relevanceScore: number; // 1-10
  reasoning: string; // Why this influencer is a good fit for this product
};

export type EmailDraft = {
  id: string;
  influencer: Influencer;
  subject: string;
  body: string;
  status: "draft" | "sent" | "failed";
  sentAt?: string;
};

export type InfluencerSearchResult = {
  influencers: Influencer[];
  searchSummary: string;
};

// Zod schema for influencer extraction
const InfluencerSchema = z.object({
  influencers: z.array(
    z.object({
      name: z.string().describe("Full name or display name of the influencer"),
      handle: z.string().describe("Social media handle/username (e.g., @username)"),
      platform: z.enum(["instagram", "tiktok", "twitter", "youtube"]).describe("Primary platform"),
      followers: z.string().optional().describe("Follower count (e.g., '100K', '1.2M')"),
      niche: z.string().optional().describe("Content niche (e.g., 'tech reviews', 'fashion', 'fitness')"),
      bio: z.string().optional().describe("Short bio or description"),
      profileUrl: z.string().describe("URL to their profile"),
      email: z.string().optional().describe("Contact email if available"),
      relevanceScore: z.number().min(1).max(10).describe("How relevant this influencer is for the product (1-10)"),
      reasoning: z.string().describe("1-2 sentence explanation of WHY this influencer is a good fit for promoting this specific product - their audience overlap, content style match, etc."),
    })
  ).describe("List of relevant influencers found"),
});

// Find influencers relevant to a product using Firecrawl search
export async function findInfluencers(
  productName: string,
  category: string,
  brand?: string
): Promise<InfluencerSearchResult> {
  console.log("\n========================================");
  console.log("🔍 STARTING INFLUENCER DISCOVERY");
  console.log("========================================");
  console.log("Product:", productName);
  console.log("Category:", category);

  const firecrawl = getFirecrawl();

  // Build search queries for different platforms
  const queries = [
    // Instagram influencers
    `${category} influencer instagram "contact" OR "email" OR "collab" -site:facebook.com`,
    `"${category}" creator instagram followers brand partnership`,
    // TikTok creators
    `${category} TikTok creator "brand deals" OR "partnerships" OR "contact"`,
    `"${category}" tiktoker popular reviews sponsored`,
    // Twitter/X thought leaders
    `${category} twitter influencer "${brand || productName}" OR "reviews" followers`,
    // YouTube reviewers
    `${category} youtube reviewer channel "contact" OR "business inquiries"`,
    `"${category}" youtuber unboxing review subscribers`,
  ];

  type SearchResultItem = {
    title?: string;
    url?: string;
    description?: string;
    markdown?: string;
  };

  const allResults: Array<{
    title: string;
    url: string;
    description: string;
    content?: string;
    platform: Influencer["platform"];
  }> = [];

  // Run searches in parallel
  const searchPromises = queries.map(async (query, i) => {
    try {
      console.log(`🔎 Search ${i + 1}: "${query.slice(0, 50)}..."`);

      const response = await firecrawl.search(query, { limit: 6 });

      let items: SearchResultItem[] = [];
      const anyResponse = response as Record<string, unknown>;

      if ("web" in anyResponse && Array.isArray(anyResponse.web)) {
        items = anyResponse.web as SearchResultItem[];
      } else if ("data" in anyResponse && Array.isArray(anyResponse.data)) {
        items = anyResponse.data as SearchResultItem[];
      }

      // Determine platform from query index
      let platform: Influencer["platform"] = "instagram";
      if (i >= 2 && i < 4) platform = "tiktok";
      else if (i === 4) platform = "twitter";
      else if (i >= 5) platform = "youtube";

      return items
        .filter(item => item.url && item.title)
        .map(item => ({
          url: item.url!,
          title: item.title!,
          description: item.description || "",
          platform,
        }));
    } catch (error) {
      console.error(`❌ Search ${i + 1} FAILED:`, error);
      return [];
    }
  });

  const searchResults = await Promise.all(searchPromises);

  for (const results of searchResults) {
    allResults.push(...results);
  }

  console.log(`📊 Found ${allResults.length} raw results`);

  // Deduplicate by URL
  const uniqueResults = allResults.filter(
    (item, i, arr) => arr.findIndex(x => x.url === item.url) === i
  ).slice(0, 20);

  // Use OpenAI to extract structured influencer data
  const openai = getOpenAI();

  const influencerData = uniqueResults.map(r =>
    `Platform: ${r.platform}\nTitle: ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`
  ).join("\n\n---\n\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are an influencer marketing expert. Extract influencer profiles from search results.

For each valid influencer found, extract:
- name: Their display name
- handle: Their social handle (with @)
- platform: instagram, tiktok, twitter, or youtube
- followers: Follower count if mentioned
- niche: Their content focus
- bio: Brief description
- profileUrl: Direct link to their profile
- email: Contact email if found
- relevanceScore: 1-10 how relevant they are for promoting "${productName}" in the "${category}" space
- reasoning: 1-2 sentences explaining WHY this influencer is a great fit for this specific product. Focus on audience overlap, content style match, past brand collaborations in similar categories, or their authentic voice in this space. Be specific about the product-influencer synergy.

Only include actual influencers/creators, not brands or news articles. Return valid JSON.`
        },
        {
          role: "user",
          content: `Product to promote: ${productName}
Category: ${category}
Brand: ${brand || "N/A"}

Search results to analyze:
${influencerData}

Extract influencers as JSON. For each influencer, INCLUDE a "reasoning" field explaining why they're a good fit for promoting "${productName}". Return ONLY the JSON object with an "influencers" array:`
        }
      ],
      max_tokens: 2500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim() || '{"influencers":[]}';
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr) as { influencers: Array<Omit<Influencer, "id">> };

    const influencers: Influencer[] = parsed.influencers.map(inf => ({
      ...inf,
      id: crypto.randomUUID(),
      reasoning: inf.reasoning || "Content aligns with this product category.",
    }));

    // Sort by relevance
    influencers.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log(`✅ Extracted ${influencers.length} influencers`);

    return {
      influencers: influencers.slice(0, 10), // Top 10
      searchSummary: `Found ${influencers.length} relevant influencers for ${productName} in the ${category} space.`,
    };
  } catch (error) {
    console.error("Influencer extraction error:", error);
    return {
      influencers: [],
      searchSummary: "Failed to extract influencer data",
    };
  }
}

// Generate email drafts for influencer outreach
export async function generateOutreachEmails(
  influencers: Influencer[],
  product: ProductInfo,
  videoUrl?: string
): Promise<EmailDraft[]> {
  console.log("📧 Generating outreach emails for", influencers.length, "influencers");

  const openai = getOpenAI();
  const productName = product.title || product.brand || "our product";
  const brandName = product.brand || "Our brand";

  const drafts: EmailDraft[] = [];

  for (const influencer of influencers) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `You are a brand partnership manager writing personalized influencer outreach emails.

Write emails that are:
- Personalized to the influencer's niche and style
- Professional but friendly
- Clear about the collaboration opportunity
- Include a specific call to action
- Keep it concise (under 200 words)

The brand has created a sample video ad that showcases how influencers could feature the product.`
          },
          {
            role: "user",
            content: `Write an outreach email to:
Name: ${influencer.name}
Handle: ${influencer.handle}
Platform: ${influencer.platform}
Niche: ${influencer.niche || "content creation"}
Followers: ${influencer.followers || "N/A"}

Product: ${productName}
Brand: ${brandName}
Product description: ${product.description || "Premium quality product"}
Price: ${product.price || "N/A"}

${videoUrl ? "We have a sample video showcasing the product that will be included in the email." : ""}

Return JSON with "subject" and "body" fields only:`
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content?.trim() || '{}';
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const email = JSON.parse(jsonStr) as { subject: string; body: string };

      drafts.push({
        id: crypto.randomUUID(),
        influencer,
        subject: email.subject,
        body: email.body,
        status: "draft",
      });
    } catch (error) {
      console.error(`Failed to generate email for ${influencer.name}:`, error);
    }
  }

  console.log(`✅ Generated ${drafts.length} email drafts`);
  return drafts;
}

// Send email via Resend
export async function sendOutreachEmail(
  draft: EmailDraft,
  fromEmail: string,
  videoUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  if (!draft.influencer.email) {
    return { success: false, error: "Influencer has no email address" };
  }

  try {
    // Build email HTML with optional video embed
    let htmlBody = draft.body.replace(/\n/g, "<br>");

    if (videoUrl) {
      htmlBody += `
        <br><br>
        <p><strong>Check out this sample video we created:</strong></p>
        <p><a href="${videoUrl}" style="color: #3b82f6;">Watch Sample Video</a></p>
      `;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: draft.influencer.email,
        subject: draft.subject,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${htmlBody}
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend error:", response.status, errorText);
      return { success: false, error: `Resend API error: ${response.status}` };
    }

    console.log(`✅ Email sent to ${draft.influencer.email}`);
    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
