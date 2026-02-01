"use client";

import { useState, useTransition } from "react";
import { ArrowRight, ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";
import {
  scrapeProductUrl,
  refreshProductResearch,
  generateStoryboards,
  type ScrapeResult,
  type CreativeOutput,
} from "@/app/_actions";
import { UrlInput } from "./research/url-input";
import { ResearchProgress } from "./research/research-progress";
import { ProductDetails } from "./research/product-details";
import { ResearchResults } from "./research/research-results";
import { StoryboardView } from "./research/storyboard-view";
import { InfluencerOutreach } from "./research/influencer-outreach";

// Hardcoded URL for testing
const DEFAULT_URL = "https://www.amazon.com/Mens-Cloud-Black-11-Medium/dp/B0D31TQ9LW";

type Stage = "input" | "analyzing" | "results" | "creative" | "outreach";

export function ProductScraper() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [stage, setStage] = useState<Stage>("input");
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [creative, setCreative] = useState<CreativeOutput | null>(null);
  const [generatedMuxPlaybackId, setGeneratedMuxPlaybackId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();

  const handleSubmit = (submittedUrl: string) => {
    setUrl(submittedUrl);
    setStage("analyzing");
    
    const toastId = toast.loading("Scraping product page with Firecrawl...");
    
    startTransition(async () => {
      try {
        toast.loading("Running market research...", { id: toastId });
        const scraped = await scrapeProductUrl(submittedUrl, true);
        setResult(scraped);
        setStage("results");
        
        if (scraped.success) {
          const imageCount = (scraped.data.imageUrls?.length || 0) + (scraped.data.imageUrl ? 1 : 0);
          toast.success(`Found ${imageCount} images, ${scraped.research?.painPoints.length || 0} pain points`, { id: toastId });
        } else {
          toast.error(`Scrape failed: ${scraped.error}`, { id: toastId });
        }
      } catch (err) {
        toast.error("Failed to analyze product", { id: toastId });
        setStage("input");
      }
    });
  };

  const handleReset = () => {
    setStage("input");
    setResult(null);
    setCreative(null);
  };

  const handleRefresh = () => {
    if (!result?.success || !result.data.title) return;

    const toastId = toast.loading("Refreshing market research...");
    
    startRefreshTransition(async () => {
      try {
        const research = await refreshProductResearch(
          result.data.title!,
          result.data.brand,
          result.data.category
        );
        setResult((prev) => (prev?.success ? { ...prev, research } : prev));
        toast.success(`Found ${research.painPoints.length} pain points, ${research.competitors.length} competitors`, { id: toastId });
      } catch {
        toast.error("Failed to refresh research", { id: toastId });
      }
    });
  };

  const handleGenerateCreative = () => {
    if (!result?.success || !result.research) return;

    const toastId = toast.loading("Generating ad storyboard...");
    
    startGenerateTransition(async () => {
      try {
        const output = await generateStoryboards(result.data, result.research!);
        setCreative(output);
        setStage("creative");
        toast.success(`Generated ${output.clips.length} video scenes`, { id: toastId });
      } catch {
        toast.error("Failed to generate creative", { id: toastId });
      }
    });
  };

  const handleBackToResearch = () => {
    setStage("results");
  };

  const handleGoToOutreach = () => {
    setStage("outreach");
  };

  const handleBackToCreative = () => {
    setStage("creative");
  };

  // Callback to receive generated Mux playback ID from StoryboardView
  const handleMediaGenerated = (muxPlaybackId: string) => {
    setGeneratedMuxPlaybackId(muxPlaybackId);
  };

  // Stage 1: URL Input
  if (stage === "input") {
    return (
      <div className="h-full flex items-center justify-center">
        <UrlInput defaultValue={url} onSubmit={handleSubmit} />
      </div>
    );
  }

  // Stage 2: Analyzing
  if (stage === "analyzing" || isPending) {
    return (
      <div className="h-full flex flex-col">
        <UrlDisplay url={url} onReset={handleReset} />
        <div className="flex-1 flex items-center justify-center">
          <ResearchProgress />
        </div>
      </div>
    );
  }

  // Stage 5: Influencer Outreach
  if (stage === "outreach" && result?.success) {
    return (
      <div className="h-full">
        <InfluencerOutreach
          product={result.data}
          videoUrl={generatedMuxPlaybackId ? `https://stream.mux.com/${generatedMuxPlaybackId}/high.mp4` : undefined}
          onBack={handleBackToCreative}
        />
      </div>
    );
  }

  // Stage 4: Creative - Storyboards
  if (stage === "creative" && creative && result?.success) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between gap-4 py-3 border-b">
          <button
            onClick={handleBackToResearch}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to research
          </button>
          <div className="flex items-center gap-4">
            <ProductMini product={result.data} />
            <p className="text-sm text-muted-foreground">
              {creative.clips.length} clips
            </p>
            <button
              onClick={handleGoToOutreach}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
            >
              <Users className="size-3.5" />
              Find Influencers
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pt-6 pr-2">
          <StoryboardView 
            clips={creative.clips} 
            onMediaGenerated={handleMediaGenerated}
          />
        </div>
      </div>
    );
  }

  // Stage 3: Results - Split layout
  if (result?.success) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between gap-4 py-3 border-b">
          <p className="text-sm text-muted-foreground truncate flex-1">{url}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Change
            </button>
            {result.research && (result.research.painPoints.length > 0 || result.research.competitors.length > 0) && (
              <button
                onClick={handleGenerateCreative}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Create Ads"}
                {!isGenerating && <ArrowRight className="size-3.5" />}
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0 pt-6">
          <div className="overflow-y-auto pr-2">
            <ProductDetails product={result.data} sourceUrl={result.url} />
          </div>
          <div className="overflow-y-auto pr-2">
            <ResearchResults
              research={result.research}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="h-full flex flex-col">
      <UrlDisplay url={url} onReset={handleReset} />
      <div className="flex-1 flex items-center justify-center">
        <ErrorMessage message={result?.error || "Something went wrong"} onRetry={handleReset} />
      </div>
    </div>
  );
}

function ProductMini({ product }: { product: import("@/app/_actions").ProductInfo }) {
  return (
    <div className="flex items-center gap-3">
      {product.imageUrl?.startsWith("http") && (
        <div className="size-8 rounded border bg-background overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.title || "Product"}
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate max-w-[200px]">
          {product.title || "Product"}
        </p>
      </div>
    </div>
  );
}

function UrlDisplay({ url, onReset }: { url: string; onReset: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b">
      <p className="text-sm text-muted-foreground truncate flex-1">{url}</p>
      <button
        onClick={onReset}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Change
      </button>
    </div>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-destructive mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
