"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Copy, Check, MessageSquare, Video, Play, Loader2, Pause, Sparkles } from "lucide-react";
import { type VideoClip, type WordTiming, generateClipMedia } from "@/app/_actions";

interface StoryboardViewProps {
  clips: VideoClip[];
  onMediaGenerated?: (videoUrl: string, audioUrl: string) => void;
}

export function StoryboardView({ clips, onMediaGenerated }: StoryboardViewProps) {
  if (clips.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p className="text-sm">No clips generated yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clips.map((clip, index) => (
        <ClipCard 
          key={clip.id} 
          clip={clip} 
          index={index + 1} 
          onMediaGenerated={onMediaGenerated}
        />
      ))}
    </div>
  );
}

function ClipCard({ clip, index, onMediaGenerated }: { 
  clip: VideoClip; 
  index: number;
  onMediaGenerated?: (videoUrl: string, audioUrl: string) => void;
}) {
  const [copiedField, setCopiedField] = useState<"prompt" | "voiceover" | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
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
        setWordTimings(result.wordTimings);
        // Notify parent of generated video and audio URLs
        onMediaGenerated?.(result.videoUrl, result.audioUrl);
      } else {
        setError(result.error);
      }
    });
  };

  // Update subtitles based on audio time using interval
  useEffect(() => {
    if (!isPlaying || wordTimings.length === 0) {
      return;
    }

    const updateSubtitle = () => {
      if (!audioRef.current) return;
      
      const currentTime = audioRef.current.currentTime;
      
      // Find words that are currently being spoken (show a few words at a time for readability)
      const activeWords: string[] = [];
      const windowSize = 0.5; // Show words within a 0.5s window
      
      for (const timing of wordTimings) {
        // Show word if it's currently being spoken or about to be spoken
        if (currentTime >= timing.start - 0.1 && currentTime <= timing.end + windowSize) {
          activeWords.push(timing.word);
        }
        // Limit to ~5-6 words for readability
        if (activeWords.length >= 6) break;
      }
      
      setCurrentSubtitle(activeWords.join(" "));
    };

    // Update subtitles at 60fps for smooth display
    const intervalId = setInterval(updateSubtitle, 16);
    
    return () => {
      clearInterval(intervalId);
      // Clear subtitle when stopping
      setCurrentSubtitle("");
    };
  }, [isPlaying, wordTimings]);

  const handlePlayPause = () => {
    if (!videoRef.current || !audioRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Sync video to audio time before playing
      videoRef.current.currentTime = audioRef.current.currentTime;
      videoRef.current.play();
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Handle audio end (audio is the source of truth for timing)
  const handleAudioEnd = () => {
    setIsPlaying(false);
    setCurrentSubtitle("");
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  // If video is generated, show the expanded 50/50 split layout
  if (videoUrl) {
    return (
      <div className="rounded-xl border bg-background overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center size-6 rounded-full bg-foreground text-background text-xs font-semibold">
              {index}
            </span>
            <span className="font-medium">{clip.label}</span>
          </div>
        </div>

        {/* 50/50 Split Content */}
        <div className="grid grid-cols-2 min-h-[280px]">
          {/* Left: Video with Subtitles */}
          <div className="relative bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain max-h-[320px]"
              playsInline
              muted // Video is muted, audio comes from ElevenLabs
              loop // Loop video in case audio is longer
            />
            {audioUrl && (
              <audio 
                ref={audioRef} 
                src={audioUrl} 
                onEnded={handleAudioEnd}
              />
            )}
            
            {/* Subtitle Overlay */}
            {currentSubtitle && (
              <div className="absolute bottom-8 left-4 right-4 flex justify-center pointer-events-none">
                <div className="bg-black/80 text-white px-4 py-2 rounded-lg max-w-[90%]">
                  <p className="text-center text-sm font-medium leading-relaxed">
                    {currentSubtitle}
                  </p>
                </div>
              </div>
            )}
            
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
            >
              <div className="size-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isPlaying ? (
                  <Pause className="size-6 text-black" />
                ) : (
                  <Play className="size-6 text-black ml-1" />
                )}
              </div>
            </button>
          </div>

          {/* Right: Voiceover + Prompt */}
          <div className="flex flex-col">
            {/* Voiceover */}
            <div className="flex-1 p-5 border-b">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <MessageSquare className="size-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium">Voiceover</span>
                </div>
                <CopyButton
                  text={clip.voiceover}
                  field="voiceover"
                  copiedField={copiedField}
                  onCopy={handleCopy}
                />
              </div>
              <p className="text-sm leading-relaxed">{clip.voiceover}</p>
            </div>

            {/* Prompt */}
            <div className="flex-1 p-5 bg-muted/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-medium">Video Prompt</span>
                </div>
                <CopyButton
                  text={clip.prompt}
                  field="prompt"
                  copiedField={copiedField}
                  onCopy={handleCopy}
                />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{clip.prompt}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact card when video not yet generated
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="flex items-stretch">
        {/* Left: Generate Video Section */}
        <div className="w-48 shrink-0 p-5 bg-muted/20 border-r flex flex-col items-center justify-center gap-4">
          <div className="size-16 rounded-xl bg-muted flex items-center justify-center">
            <Video className="size-7 text-muted-foreground" />
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background border text-xs font-medium mb-3">
              <span className="size-4 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center">
                {index}
              </span>
              {clip.label}
            </div>
            
            <button
              onClick={handleGenerateVideo}
              disabled={isPending}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Generate
                </>
              )}
            </button>
            
            {error && (
              <p className="text-xs text-destructive mt-2">{error}</p>
            )}
          </div>
        </div>

        {/* Right: Content Preview */}
        <div className="flex-1 p-5 space-y-4">
          {/* Voiceover */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Voiceover</span>
              </div>
              <CopyButton
                text={clip.voiceover}
                field="voiceover"
                copiedField={copiedField}
                onCopy={handleCopy}
              />
            </div>
            <p className="text-sm">{clip.voiceover}</p>
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Video Prompt</span>
              </div>
              <CopyButton
                text={clip.prompt}
                field="prompt"
                copiedField={copiedField}
                onCopy={handleCopy}
              />
            </div>
            <p className="text-sm text-muted-foreground">{clip.prompt}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({
  text,
  field,
  copiedField,
  onCopy,
}: {
  text: string;
  field: "prompt" | "voiceover";
  copiedField: "prompt" | "voiceover" | null;
  onCopy: (text: string, field: "prompt" | "voiceover") => void;
}) {
  const isCopied = copiedField === field;
  
  return (
    <button
      onClick={() => onCopy(text, field)}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {isCopied ? (
        <>
          <Check className="size-3" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="size-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
