"use server";

import FirecrawlApp from "@mendable/firecrawl-js";
import OpenAI from "openai";
import RunwayML from "@runwayml/sdk";
import { ElevenLabsClient } from "elevenlabs";
import { z } from "zod";

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
            },
          },
        },
      ],
    });

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

// Initialize OpenAI
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey });
}

// Generate and validate video clips using GPT-4.1
async function generateClipsWithAI(
  productName: string,
  painPoints: string[],
  competitors: string[],
  features: string[]
): Promise<VideoClip[]> {
  try {
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are a short-form video ad creator. Generate video clips for a product ad.

Each clip needs:
1. label: Short label like "Hook", "Problem", "Solution", "B-roll-product", "Testimonial", "CTA"
2. prompt: Direction for video generation (what visuals to show)
3. voiceover: The exact text to be spoken as audio (keep each under 15 words)

Output valid JSON array of clips. Generate 4-6 clips that flow together as a cohesive ad.`
        },
        {
          role: "user",
          content: `Product: ${productName}

Pain points users have:
${painPoints.slice(0, 3).map(p => `- ${p}`).join("\n") || "- General frustration with alternatives"}

Competitors:
${competitors.slice(0, 2).map(c => `- ${c}`).join("\n") || "- Other products in the market"}

Key features:
${features.slice(0, 3).map(f => `- ${f}`).join("\n") || "- Quality and reliability"}

Generate a JSON array of video clips. Return ONLY the JSON, no explanation:`
        }
      ],
      max_tokens: 800,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    // Parse JSON, handling potential markdown code blocks
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const clips = JSON.parse(jsonStr) as Array<{ label: string; prompt: string; voiceover: string }>;

    return clips.map(clip => ({
      id: crypto.randomUUID(),
      label: clip.label,
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

  // Extract research data
  const painPoints = research.painPoints.map(p => p.issue);
  const competitors = research.competitors.map(c => c.productName || c.brand);
  const features = product.features || (product.description ? [product.description] : []);

  // Generate clips with AI
  console.log("Generating clips with GPT-4.1...");
  let clips = await generateClipsWithAI(productName, painPoints, competitors, features);

  // Fallback if AI fails
  if (clips.length === 0) {
    const shortName = product.brand || productName.split(" ")[0];
    const painPoint = painPoints[0] || "struggling with alternatives";

    clips = [
      {
        id: crypto.randomUUID(),
        label: "Hook",
        prompt: `Person looking frustrated, relatable moment, casual setting`,
        voiceover: `Ever felt like your current solution just isn't cutting it?`,
      },
      {
        id: crypto.randomUUID(),
        label: "Problem",
        prompt: `Quick cuts showing common frustrations, real scenarios`,
        voiceover: `${painPoint.slice(0, 40)}. We've all been there.`,
      },
      {
        id: crypto.randomUUID(),
        label: "B-roll-product",
        prompt: `Clean product shot, ${shortName} in focus, professional lighting`,
        voiceover: `That's why ${shortName} exists.`,
      },
      {
        id: crypto.randomUUID(),
        label: "Demo",
        prompt: `Product in action, hands using it, showing key feature`,
        voiceover: `It just works. No hassle. No frustration.`,
      },
      {
        id: crypto.randomUUID(),
        label: "CTA",
        prompt: `Product with text overlay, clean background, call to action`,
        voiceover: `Try it yourself. Link in bio.`,
      },
    ];
  }

  console.log(`Generated ${clips.length} video clips`);

  return {
    clips,
    generatedAt: new Date().toISOString(),
  };
}

// Video + voiceover generation result type
export type ClipGenerationResult =
  | { success: true; videoUrl: string; audioUrl: string }
  | { success: false; error: string };

// Generate voiceover audio using ElevenLabs REST API
async function generateVoiceover(text: string): Promise<{ success: true; audioUrl: string } | { success: false; error: string }> {
  const apiKey = (process.env.ELEVEN_API_KEY || process.env.ELEVENLABS_API_KEY)?.trim();
  
  if (!apiKey) {
    return { success: false, error: "ELEVEN_API_KEY not configured" };
  }

  try {
    console.log("Generating voiceover for:", text.slice(0, 50) + "...");

    // Use REST API directly for better error handling
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - default voice
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", response.status, errorText);
      return { success: false, error: `ElevenLabs API error: ${response.status} - ${errorText}` };
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    console.log("Voiceover generation complete");
    return { success: true, audioUrl };
  } catch (error) {
    console.error("Voiceover generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate voiceover",
    };
  }
}

// Generate video from a clip prompt using RunwayML
async function generateVideoOnly(promptText: string): Promise<{ success: true; videoUrl: string } | { success: false; error: string }> {
  if (!process.env.RUNWAYML_API_SECRET) {
    return { success: false, error: "RUNWAYML_API_SECRET not configured" };
  }

  try {
    const client = new RunwayML();

    console.log("Starting video generation for:", promptText.slice(0, 50) + "...");

    const task = await client.textToVideo
      .create({
        model: "veo3.1_fast",
        promptText,
        ratio: "1280:720",
        duration: 4,
      })
      .waitForTaskOutput();

    console.log("Video generation complete:", task);

    if (task.output && Array.isArray(task.output) && task.output[0]) {
      return { success: true, videoUrl: task.output[0] };
    }

    return { success: false, error: "No video output returned" };
  } catch (error) {
    console.error("Video generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate video",
    };
  }
}

// Generate both video and voiceover for a clip
export async function generateClipMedia(
  videoPrompt: string,
  voiceoverText: string
): Promise<ClipGenerationResult> {
  // Run both in parallel
  const [videoResult, audioResult] = await Promise.all([
    generateVideoOnly(videoPrompt),
    generateVoiceover(voiceoverText),
  ]);

  if (!videoResult.success) {
    return { success: false, error: `Video: ${videoResult.error}` };
  }

  if (!audioResult.success) {
    return { success: false, error: `Audio: ${audioResult.error}` };
  }

  return {
    success: true,
    videoUrl: videoResult.videoUrl,
    audioUrl: audioResult.audioUrl,
  };
}
