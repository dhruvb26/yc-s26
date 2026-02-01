"use client";

import { useState, useMemo } from "react";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AdIntelligenceResult, AdIntelItem } from "@/app/_actions";

interface AdIntelligenceViewProps {
  data: AdIntelligenceResult;
}

// Group ads by competitor name
function groupAdsByCompetitor(ads: AdIntelItem[]): Map<string, AdIntelItem[]> {
  const grouped = new Map<string, AdIntelItem[]>();
  for (const ad of ads) {
    const name = ad.competitorName || "Unknown";
    const existing = grouped.get(name) || [];
    existing.push(ad);
    grouped.set(name, existing);
  }
  return grouped;
}

export function AdIntelligenceView({ data }: AdIntelligenceViewProps) {
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);

  const groupedAds = useMemo(() => groupAdsByCompetitor(data.ads), [data.ads]);
  const competitors = useMemo(() => Array.from(groupedAds.keys()), [groupedAds]);

  if (data.ads.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No competitor ads found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Competitor Ads
        </h3>
        <span className="text-xs text-muted-foreground">
          {data.ads.length} ads
        </span>
      </div>

      {/* Competitor List */}
      <div className="space-y-2">
        {competitors.map((name) => {
          const ads = groupedAds.get(name) || [];
          const isSelected = selectedCompetitor === name;
          const activeCount = ads.filter((a) => a.isActive).length;
          const platforms = [...new Set(ads.map((a) => a.platform))];

          return (
            <div key={name}>
              <button
                onClick={() => setSelectedCompetitor(isSelected ? null : name)}
                className="w-full flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate">{name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {ads.length} ad{ads.length !== 1 ? "s" : ""} • {platforms.join(", ")}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {activeCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {activeCount} active
                    </Badge>
                  )}
                  {isSelected ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded Ads */}
              {isSelected && (
                <div className="mt-2 ml-11 space-y-2">
                  {ads.map((ad, i) => (
                    <AdCard key={i} ad={ad} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sources */}
      {data.sources.length > 0 && (
        <p className="text-xs text-muted-foreground pt-4 border-t">
          {data.sources.length} sources analyzed
        </p>
      )}
    </div>
  );
}

function AdCard({ ad }: { ad: AdIntelItem }) {
  return (
    <div className="p-3 rounded-lg border bg-muted/20">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="secondary" className="text-xs">
          {ad.platform}
        </Badge>
        {ad.isActive && (
          <Badge variant="outline" className="text-xs">
            Active
          </Badge>
        )}
      </div>

      {ad.headline && (
        <p className="text-sm font-medium mb-1 line-clamp-2">{ad.headline}</p>
      )}

      {ad.adCopy && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{ad.adCopy}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        {ad.callToAction && (
          <span className="text-xs text-muted-foreground">
            CTA: {ad.callToAction}
          </span>
        )}
        {ad.pageUrl && (
          <a
            href={ad.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Source <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}
