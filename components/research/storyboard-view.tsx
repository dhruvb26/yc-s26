"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Video, Play, Loader2, Film, Download } from "lucide-react";
import { toast } from "sonner";
import MuxPlayer from "@mux/mux-player-react";
import { type VideoClip, generateClipMedia } from "@/app/_actions";

interface StoryboardViewProps {
  clips: VideoClip[];
  onMediaGenerated?: (muxPlaybackId: string) => void;
}

export function StoryboardView({ clips, onMediaGenerated }: StoryboardViewProps) {
  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null);
  const [sceneCount, setSceneCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (clips.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p className="text-sm">No clips generated yet</p>
      </div>
    );
  }

  const handleGenerateFullAd = () => {
    setError(null);
    
    const toastId = toast.loading("Starting video generation...");
    
    startTransition(async () => {
      try {
        toast.loading("Generating 4 video scenes in parallel...", { id: toastId });
        
        const result = await generateClipMedia(
          clips[0].prompt,
          clips[0].voiceover,
          clips
        );
        
        if (result.success) {
          setMuxPlaybackId(result.muxPlaybackId);
          setSceneCount(result.sceneCount);
          toast.success("Video generated and uploaded to Mux!", { id: toastId });
          onMediaGenerated?.(result.muxPlaybackId);
        } else {
          setError(result.error);
          toast.error(`Generation failed: ${result.error}`, { id: toastId });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
        toast.error(`Error: ${message}`, { id: toastId });
      }
    });
  };

  const handleDownload = async () => {
    if (!muxPlaybackId) return;
    
    const downloadUrl = `https://stream.mux.com/${muxPlaybackId}/high.mp4`;
    
    toast.loading("Preparing download...");
    
    try {
      // Open in new tab for download
      window.open(downloadUrl, "_blank");
      toast.success("Download started!");
    } catch {
      toast.error("Download failed. Try right-clicking the video.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Video Player or Generate Button */}
      {muxPlaybackId ? (
        <FullAdPlayer
          muxPlaybackId={muxPlaybackId}
          sceneCount={sceneCount}
          onDownload={handleDownload}
        />
      ) : (
        <div className="rounded-xl border bg-muted/30 p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="size-16 rounded-xl bg-muted flex items-center justify-center">
              <Film className="size-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-medium mb-1">Generate Advertisement</h3>
              <p className="text-sm text-muted-foreground">
                4 scenes × 4 seconds = 16 second video
              </p>
            </div>
            <button
              onClick={handleGenerateFullAd}
              disabled={isPending || clips.length < 4}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Generate Video
                </>
              )}
            </button>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {clips.length < 4 && (
              <p className="text-xs text-muted-foreground">
                Need at least 4 clips
              </p>
            )}
          </div>
        </div>
      )}

      {/* Scene Breakdown */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">
          Scenes
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clips.slice(0, 4).map((clip, index) => (
            <SceneCard 
              key={clip.id} 
              clip={clip} 
              index={index + 1}
              sceneType={["Hook", "Problem", "Solution", "CTA"][index]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FullAdPlayer({
  muxPlaybackId,
  sceneCount,
  onDownload,
}: {
  muxPlaybackId: string;
  sceneCount: number;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Film className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Advertisement</span>
          <span className="text-xs text-muted-foreground">• {sceneCount} scenes</span>
        </div>
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
        >
          <Download className="size-4" />
          Download
        </button>
      </div>

      <div className="bg-black aspect-video">
        <MuxPlayer
          playbackId={muxPlaybackId}
          streamType="on-demand"
          autoPlay={false}
          muted={false}
          style={{
            width: "100%",
            height: "100%",
            aspectRatio: "16/9",
          }}
          accentColor="#525252"
          primaryColor="#ffffff"
          secondaryColor="#171717"
        />
      </div>

      <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center justify-between">
        <span>stream.mux.com/{muxPlaybackId}.m3u8</span>
        <span>MP4: stream.mux.com/{muxPlaybackId}/high.mp4</span>
      </div>
    </div>
  );
}

function SceneCard({ 
  clip, 
  index,
  sceneType 
}: { 
  clip: VideoClip; 
  index: number;
  sceneType: string;
}) {
  const [copiedField, setCopiedField] = useState<"prompt" | "voiceover" | null>(null);

  const handleCopy = async (text: string, field: "prompt" | "voiceover") => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center size-6 rounded bg-muted text-xs font-medium">
          {index}
        </span>
        <span className="text-sm font-medium">{sceneType}</span>
        <span className="text-xs text-muted-foreground">• {clip.label}</span>
      </div>
      
      {/* Voiceover */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Script</span>
          <CopyButton
            text={clip.voiceover}
            field="voiceover"
            copiedField={copiedField}
            onCopy={handleCopy}
          />
        </div>
        <p className="text-sm">&ldquo;{clip.voiceover}&rdquo;</p>
      </div>

      {/* Prompt */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Visual</span>
          <CopyButton
            text={clip.prompt}
            field="prompt"
            copiedField={copiedField}
            onCopy={handleCopy}
          />
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{clip.prompt}</p>
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
        </>
      )}
    </button>
  );
}
