"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

interface UrlInputProps {
  defaultValue?: string;
  onSubmit: (url: string) => void;
}

export function UrlInput({ defaultValue = "", onSubmit }: UrlInputProps) {
  const [url, setUrl] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="space-y-6">
       
        
        <div className="relative">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/product..."
            className="w-full h-14 px-5 pr-14 rounded-lg border bg-background text-base outline-none transition-colors focus:border-foreground/20"
            autoFocus
          />
          <button
            type="submit"
            disabled={!url.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-md bg-foreground text-background disabled:opacity-30 transition-opacity"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
