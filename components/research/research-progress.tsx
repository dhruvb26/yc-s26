"use client";

import { useState, useEffect } from "react";
import { Search, Globe, FileText, TrendingUp, ShoppingBag, Sparkles, Check } from "lucide-react";

// Research steps that mirror what happens in runSearchResearch
const RESEARCH_STEPS = [
  {
    id: "scrape",
    label: "Scraping product page",
    description: "Extracting product details and metadata",
    icon: FileText,
    color: "bg-blue-500",
  },
  {
    id: "pain-1",
    label: "Searching user complaints",
    description: "Finding reviews and feedback",
    icon: Search,
    color: "bg-amber-500",
  },
  {
    id: "pain-2",
    label: "Analyzing feature requests",
    description: "Reddit, ProductHunt, Twitter",
    icon: TrendingUp,
    color: "bg-orange-500",
  },
  {
    id: "pain-3",
    label: "Finding pain points",
    description: "User forums and communities",
    icon: Globe,
    color: "bg-red-500",
  },
  {
    id: "comp-1",
    label: "Discovering competitors",
    description: "Product comparisons and alternatives",
    icon: ShoppingBag,
    color: "bg-purple-500",
  },
  {
    id: "comp-2",
    label: "Analyzing market position",
    description: "G2, Capterra, comparison sites",
    icon: TrendingUp,
    color: "bg-indigo-500",
  },
  {
    id: "comp-3",
    label: "Finding competitor content",
    description: "Social media and ad campaigns",
    icon: Sparkles,
    color: "bg-pink-500",
  },
  {
    id: "scrape-deep",
    label: "Deep-scraping sources",
    description: "Extracting detailed insights",
    icon: FileText,
    color: "bg-cyan-500",
  },
  {
    id: "analyze",
    label: "Processing results",
    description: "Structuring research data",
    icon: Sparkles,
    color: "bg-green-500",
  },
];

export function ResearchProgress() {
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Stagger the appearance of steps
    const showInterval = setInterval(() => {
      setVisibleSteps((prev) => {
        if (prev < RESEARCH_STEPS.length) {
          return prev + 1;
        }
        clearInterval(showInterval);
        return prev;
      });
    }, 800); // New card every 800ms

    // Mark steps as completed after they've been visible for a bit
    const completeInterval = setInterval(() => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        // Complete steps that have been visible for 2+ cycles
        for (let i = 0; i < RESEARCH_STEPS.length; i++) {
          if (i < visibleSteps - 2) {
            next.add(i);
          }
        }
        return next;
      });
    }, 800);

    return () => {
      clearInterval(showInterval);
      clearInterval(completeInterval);
    };
  }, [visibleSteps]);

  return (
    <div className="w-full max-w-md mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-lg font-semibold mb-1">Analyzing Product</h2>
        <p className="text-sm text-muted-foreground">
          Running market research across multiple sources
        </p>
      </div>

      <div className="space-y-3">
        {RESEARCH_STEPS.slice(0, visibleSteps).map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.has(index);
          const isActive = index === visibleSteps - 1;

          return (
            <div
              key={step.id}
              className={`
                flex items-center gap-3 p-3 rounded-lg border bg-background
                transition-all duration-500 ease-out
                ${isActive ? "ring-2 ring-foreground/20 shadow-sm" : ""}
                ${isCompleted ? "opacity-60" : ""}
                animate-in slide-in-from-bottom-2 fade-in
              `}
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: "backwards",
              }}
            >
              <div
                className={`
                  size-9 rounded-lg flex items-center justify-center shrink-0
                  transition-all duration-300
                  ${isCompleted ? "bg-green-100 dark:bg-green-900/30" : step.color}
                `}
              >
                {isCompleted ? (
                  <Check className="size-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Icon className={`size-4 ${isCompleted ? "" : "text-white"}`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isCompleted ? "text-muted-foreground" : ""}`}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {step.description}
                </p>
              </div>

              {isActive && !isCompleted && (
                <div className="flex gap-1">
                  <span className="size-1.5 rounded-full bg-foreground animate-pulse" />
                  <span className="size-1.5 rounded-full bg-foreground animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="size-1.5 rounded-full bg-foreground animate-pulse" style={{ animationDelay: "300ms" }} />
                </div>
              )}

              {isCompleted && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Done</span>
              )}
            </div>
          );
        })}
      </div>

      {visibleSteps > 0 && (
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            {completedSteps.size} of {RESEARCH_STEPS.length} steps completed
          </p>
        </div>
      )}
    </div>
  );
}
