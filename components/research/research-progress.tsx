"use client";

import { Loader2 } from "lucide-react";

export function ResearchProgress() {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-4">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">Analyzing</p>
        <p className="text-xs text-muted-foreground">
          Searching and scraping relevant sources
        </p>
      </div>
    </div>
  );
}
