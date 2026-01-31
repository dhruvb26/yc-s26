"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MarketResearch, PainPoint, CompetitorProduct, CompetitorAd } from "@/app/_actions";

interface ResearchResultsProps {
  research?: MarketResearch;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function ResearchResults({ research, onRefresh, isRefreshing }: ResearchResultsProps) {
  const hasData = research && (
    research.painPoints.length > 0 ||
    research.competitors.length > 0 ||
    (research.competitorAds?.length ?? 0) > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader>Research</SectionHeader>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {isRefreshing ? (
        <LoadingState />
      ) : !hasData ? (
        <EmptyState onRefresh={onRefresh} />
      ) : (
        <div className="space-y-8">
          {/* Analysis Section - Pain Points */}
          {research!.painPoints.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Analysis</h4>
              <PainPointsSection items={research!.painPoints} />
            </div>
          )}

          {/* Competitor Analysis Section - Products & Ads */}
          {(research!.competitors.length > 0 || (research!.competitorAds?.length ?? 0) > 0) && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Competitor Analysis</h4>
              <div className="space-y-4">
                {research!.competitors.length > 0 && (
                  <CompetitorsSection items={research!.competitors} />
                )}
                {(research!.competitorAds?.length ?? 0) > 0 && (
                  <CompetitorAdsSection items={research!.competitorAds!} />
                )}
              </div>
            </div>
          )}

          {research!.sources.length > 0 && (
            <SourcesFooter count={research!.sources.length} />
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {children}
    </h3>
  );
}

function LoadingState() {
  return (
    <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      <span className="text-sm">Analyzing product...</span>
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-muted-foreground">No research data</p>
      <button
        onClick={onRefresh}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Run analysis
      </button>
    </div>
  );
}

function PainPointsSection({ items }: { items: PainPoint[] }) {
  return (
    <CollapsibleSection title="Pain Points" count={items.length} defaultOpen>
      <div className="space-y-2">
        {items.map((item, i) => (
          <InsightCard key={i} url={item.url} source={item.source}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium flex-1 line-clamp-2">{item.issue}</p>
              <SeverityBadge severity={item.sentiment} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{item.frequency}</p>
          </InsightCard>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function CompetitorsSection({ items }: { items: CompetitorProduct[] }) {
  return (
    <CollapsibleSection title="Competing Products" count={items.length} defaultOpen>
      <div className="space-y-2">
        {items.map((item, i) => (
          <InsightCard key={i} url={item.url} source={item.source}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {item.brand && (
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.brand}</p>
                )}
                <p className="text-sm font-semibold line-clamp-2">{item.productName}</p>
              </div>
              {item.price && (
                <span className="text-sm font-medium shrink-0">{item.price}</span>
              )}
            </div>
            {item.keyDifference && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.keyDifference}</p>
            )}
          </InsightCard>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function CompetitorAdsSection({ items }: { items: CompetitorAd[] }) {
  const platformColors: Record<CompetitorAd["platform"], string> = {
    instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    tiktok: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    youtube: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    other: "bg-muted text-muted-foreground",
  };

  return (
    <CollapsibleSection title="Competitor Ads" count={items.length} defaultOpen>
      <div className="space-y-2">
        {items.map((item, i) => (
          <InsightCard key={i} url={item.url} source={item.source}>
            <div className="flex items-start gap-2 mb-1">
              <Badge variant="secondary" className={platformColors[item.platform]}>
                {item.platform}
              </Badge>
              {item.competitorName && (
                <span className="text-xs text-muted-foreground">{item.competitorName}</span>
              )}
            </div>
            <p className="text-sm font-medium line-clamp-2">{item.title}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
            )}
          </InsightCard>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{count}</span>
          {isOpen ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {isOpen && <div className="pt-2">{children}</div>}
    </div>
  );
}

function InsightCard({ 
  children, 
  url, 
  source 
}: { 
  children: React.ReactNode;
  url?: string;
  source?: string;
}) {
  return (
    <div className="p-3 rounded-lg border bg-muted/20">
      {children}
      {(url || source) && (
        <div className="mt-2 pt-2 border-t border-border/50">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {source || new URL(url).hostname} →
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">{source}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "critical" | "moderate" | "minor" }) {
  if (severity === "critical") {
    return <Badge variant="destructive">critical</Badge>;
  }
  if (severity === "moderate") {
    return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">moderate</Badge>;
  }
  return <Badge variant="outline">minor</Badge>;
}

function SourcesFooter({ count }: { count: number }) {
  return (
    <p className="text-xs text-muted-foreground pt-4 border-t">
      {count} sources analyzed
    </p>
  );
}
