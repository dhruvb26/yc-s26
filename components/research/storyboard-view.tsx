"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Copy, Check, MessageSquare, Video, Play, Loader2, Pause } from "lucide-react";
import { type VideoClip, generateClipMedia } from "@/app/_actions";

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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleCopy = async (text: string, field: "prompt" | "voiceover") => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerateVideo = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateClipMedia(clip.prompt, clip.voiceover);
      if (result.success) {
        setVideoUrl(result.videoUrl);
        setAudioUrl(result.audioUrl);
      } else {
        setError(result.error);
      }
    });
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      audioRef.current?.pause();
    } else {
      videoRef.current.play();
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Auto-play when video loads
  useEffect(() => {
    if (videoUrl && videoRef.current && audioRef.current) {
      const playMedia = async () => {
        try {
          await videoRef.current?.play();
          await audioRef.current?.play();
          setIsPlaying(true);
        } catch {
          // Auto-play blocked
        }
      };
      playMedia();
    }
  }, [videoUrl]);

  // Sync video end
  const handleVideoEnd = () => {
    setIsPlaying(false);
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex">
        {/* Left: Label + Video Preview */}
        <div className="w-40 shrink-0 p-4 bg-muted/30 border-r flex flex-col justify-center">
          {videoUrl ? (
            <div className="relative mb-3">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full aspect-video rounded bg-black"
                playsInline
                onEnded={handleVideoEnd}
              />
              {audioUrl && <audio ref={audioRef} src={audioUrl} />}
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="size-6 text-white" />
                ) : (
                  <Play className="size-6 text-white ml-0.5" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-16 mb-3">
              <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                <Video className="size-5 text-muted-foreground" />
              </div>
            </div>
          )}
          <div className="px-2 py-1 rounded bg-background border text-xs font-medium text-center mb-2">
            {clip.label}
          </div>
          {!videoUrl && (
            <button
              onClick={handleGenerateVideo}
              disabled={isPending}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-foreground text-background rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="size-3" />
                  Generate Video
                </>
              )}
            </button>
          )}
          {error && (
            <p className="text-xs text-destructive mt-1 text-center">{error}</p>
          )}
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
