"use client";

import { useState } from "react";
import { Copy, Check, MessageSquare, Video } from "lucide-react";
import type { VideoClip } from "@/app/_actions";

interface StoryboardViewProps {
  clips: VideoClip[];
}

export function StoryboardView({ clips }: StoryboardViewProps) {
  if (clips.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p className="text-sm">No clips generated yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} />
      ))}
    </div>
  );
}

function ClipCard({ clip }: { clip: VideoClip }) {
  const [copiedField, setCopiedField] = useState<"prompt" | "voiceover" | null>(null);

  const handleCopy = async (text: string, field: "prompt" | "voiceover") => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex">
        {/* Left: Label */}
        <div className="w-40 shrink-0 p-4 bg-muted/30 border-r flex flex-col justify-center">
          <div className="flex items-center justify-center h-16 mb-3">
            <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
              <Video className="size-5 text-muted-foreground" />
            </div>
          </div>
          <div className="px-2 py-1 rounded bg-background border text-xs font-medium text-center">
            {clip.label}
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 p-4 space-y-4">
          {/* Voiceover */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="size-3" />
                Voiceover
              </div>
              <button
                onClick={() => handleCopy(clip.voiceover, "voiceover")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedField === "voiceover" ? (
                  <>
                    <Check className="size-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-sm">{clip.voiceover}</p>
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Video className="size-3" />
                Prompt
              </div>
              <button
                onClick={() => handleCopy(clip.prompt, "prompt")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedField === "prompt" ? (
                  <>
                    <Check className="size-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-muted-foreground">{clip.prompt}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
