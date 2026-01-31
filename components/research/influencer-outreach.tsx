"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  Mail,
  Send,
  Loader2,
  Check,
  X,
  ExternalLink,
  Instagram,
  Youtube,
  Twitter,
  RefreshCw,
  User,
  Star,
  Copy,
  Search,
  Globe,
  Sparkles,
  MessageCircle,
  Video,
  Play,
  Pause,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  type Influencer,
  type EmailDraft,
  type ProductInfo,
  findInfluencers,
  generateOutreachEmails,
  sendOutreachEmail,
} from "@/app/_actions";

interface InfluencerOutreachProps {
  product: ProductInfo;
  videoUrl?: string;
  audioUrl?: string; // ElevenLabs voiceover audio URL
  onBack: () => void;
}

export function InfluencerOutreach({ product, videoUrl, audioUrl, onBack }: InfluencerOutreachProps) {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isGeneratingEmails, startGenerateEmails] = useTransition();
  const [searchComplete, setSearchComplete] = useState(false);

  const handleSearchInfluencers = () => {
    startSearch(async () => {
      const result = await findInfluencers(
        product.title || "product",
        product.category || "consumer goods",
        product.brand
      );
      setInfluencers(result.influencers);
      setSearchComplete(true);

      // Auto-generate emails for influencers with email addresses
      if (result.influencers.length > 0) {
        startGenerateEmails(async () => {
          const drafts = await generateOutreachEmails(
            result.influencers,
            product,
            videoUrl
          );
          setEmailDrafts(drafts);
        });
      }
    });
  };

  const handleSendEmail = async (draft: EmailDraft) => {
    const result = await sendOutreachEmail(
      draft,
      "hello@yourbrand.com", // This should be configurable
      videoUrl
    );

    if (result.success) {
      setEmailDrafts(prev =>
        prev.map(d =>
          d.id === draft.id
            ? { ...d, status: "sent" as const, sentAt: new Date().toISOString() }
            : d
        )
      );
    } else {
      setEmailDrafts(prev =>
        prev.map(d =>
          d.id === draft.id ? { ...d, status: "failed" as const } : d
        )
      );
    }
  };

  const getDraftForInfluencer = (influencer: Influencer) => {
    return emailDrafts.find(d => d.influencer.id === influencer.id);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 py-3 border-b">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to videos
        </button>
        <div className="flex items-center gap-3">
          {!searchComplete ? (
            <button
              onClick={handleSearchInfluencers}
              disabled={isSearching}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  Find Influencers
                </>
              )}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {influencers.length} influencers found
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      {!searchComplete && !isSearching ? (
        <EmptyState onSearch={handleSearchInfluencers} />
      ) : isSearching ? (
        <SearchingState />
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 pt-6 overflow-hidden">
          {/* Left: Influencer List */}
          <div className="flex flex-col min-h-0">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Discovered Influencers
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {influencers.map(influencer => (
                <InfluencerCard
                  key={influencer.id}
                  influencer={influencer}
                  isSelected={selectedInfluencer?.id === influencer.id}
                  onSelect={() => setSelectedInfluencer(influencer)}
                  emailStatus={getDraftForInfluencer(influencer)?.status}
                />
              ))}
              {influencers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No influencers found. Try adjusting your product category.
                </p>
              )}
            </div>
          </div>

          {/* Right: Outreach Message */}
          <div className="flex flex-col min-h-0">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Outreach Message
            </h3>
            <div className="flex-1 overflow-y-auto pr-2">
              {isGeneratingEmails ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">Generating personalized emails...</span>
                </div>
              ) : selectedInfluencer ? (
                <EmailDraftView
                  draft={getDraftForInfluencer(selectedInfluencer)}
                  influencer={selectedInfluencer}
                  onSend={handleSendEmail}
                  videoUrl={videoUrl}
                  audioUrl={audioUrl}
                />
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">Select an influencer to view their email draft</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12">
      <div className="size-20 rounded-2xl bg-muted flex items-center justify-center">
        <Mail className="size-10 text-muted-foreground" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold mb-2">Find Influencers & Send Outreach</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Discover relevant influencers on Instagram, TikTok, X, and YouTube who could
          promote your product. We'll draft personalized emails with your video attached.
        </p>
        <button
          onClick={onSearch}
          className="flex items-center gap-2 px-6 py-3 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity mx-auto"
        >
          <RefreshCw className="size-4" />
          Start Influencer Search
        </button>
      </div>
    </div>
  );
}

// Influencer search steps that mirror what happens in findInfluencers
const INFLUENCER_SEARCH_STEPS = [
  {
    id: "ig-1",
    label: "Searching Instagram creators",
    description: "Finding influencers with brand partnerships",
    icon: Instagram,
    color: "bg-pink-500",
  },
  {
    id: "ig-2",
    label: "Analyzing Instagram profiles",
    description: "Checking engagement and followers",
    icon: Instagram,
    color: "bg-pink-600",
  },
  {
    id: "tt-1",
    label: "Searching TikTok creators",
    description: "Finding viral content creators",
    icon: () => <span className="text-xs font-bold text-white">TT</span>,
    color: "bg-slate-800",
  },
  {
    id: "tt-2",
    label: "Analyzing TikTok trends",
    description: "Checking brand deal history",
    icon: () => <span className="text-xs font-bold text-white">TT</span>,
    color: "bg-slate-700",
  },
  {
    id: "x-1",
    label: "Searching X/Twitter influencers",
    description: "Finding thought leaders",
    icon: Twitter,
    color: "bg-blue-500",
  },
  {
    id: "yt-1",
    label: "Searching YouTube reviewers",
    description: "Finding product review channels",
    icon: Youtube,
    color: "bg-red-500",
  },
  {
    id: "yt-2",
    label: "Analyzing YouTube channels",
    description: "Checking subscriber counts",
    icon: Youtube,
    color: "bg-red-600",
  },
  {
    id: "extract",
    label: "Extracting influencer profiles",
    description: "Processing search results with AI",
    icon: Sparkles,
    color: "bg-purple-500",
  },
  {
    id: "rank",
    label: "Ranking by relevance",
    description: "Scoring fit for your product",
    icon: Star,
    color: "bg-amber-500",
  },
];

function SearchingState() {
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Stagger the appearance of steps
    const showInterval = setInterval(() => {
      setVisibleSteps((prev) => {
        if (prev < INFLUENCER_SEARCH_STEPS.length) {
          return prev + 1;
        }
        clearInterval(showInterval);
        return prev;
      });
    }, 700); // New card every 700ms

    // Mark steps as completed after they've been visible for a bit
    const completeInterval = setInterval(() => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        for (let i = 0; i < INFLUENCER_SEARCH_STEPS.length; i++) {
          if (i < visibleSteps - 2) {
            next.add(i);
          }
        }
        return next;
      });
    }, 700);

    return () => {
      clearInterval(showInterval);
      clearInterval(completeInterval);
    };
  }, [visibleSteps]);

  return (
    <div className="flex-1 flex flex-col py-8 overflow-hidden">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold mb-1">Finding Influencers</h2>
        <p className="text-sm text-muted-foreground">
          Searching across social platforms for relevant creators
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="max-w-md mx-auto space-y-2.5">
          {INFLUENCER_SEARCH_STEPS.slice(0, visibleSteps).map((step, index) => {
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
      </div>

      {visibleSteps > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            {completedSteps.size} of {INFLUENCER_SEARCH_STEPS.length} searches completed
          </p>
        </div>
      )}
    </div>
  );
}

function InfluencerCard({
  influencer,
  isSelected,
  onSelect,
  emailStatus,
}: {
  influencer: Influencer;
  isSelected: boolean;
  onSelect: () => void;
  emailStatus?: EmailDraft["status"];
}) {
  const PlatformIcon = {
    instagram: Instagram,
    tiktok: () => <span className="text-xs font-bold">TT</span>,
    twitter: Twitter,
    youtube: Youtube,
  }[influencer.platform];

  const platformColors = {
    instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    tiktok: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    twitter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    youtube: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? "border-foreground bg-muted/30 ring-1 ring-foreground"
          : "border-border hover:border-foreground/30 hover:bg-muted/10"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="size-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{influencer.name}</span>
            {emailStatus === "sent" && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="size-3 mr-1" />
                Sent
              </Badge>
            )}
            {emailStatus === "failed" && (
              <Badge variant="destructive">
                <X className="size-3 mr-1" />
                Failed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{influencer.handle}</span>
            {influencer.followers && (
              <>
                <span>·</span>
                <span>{influencer.followers} followers</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className={platformColors[influencer.platform]}>
              <PlatformIcon className="size-3 mr-1" />
              {influencer.platform}
            </Badge>
            {influencer.niche && (
              <Badge variant="outline" className="text-xs">
                {influencer.niche}
              </Badge>
            )}
            <div className="flex items-center gap-0.5 ml-auto">
              <Star className="size-3 text-amber-500 fill-amber-500" />
              <span className="text-xs font-medium">{influencer.relevanceScore}/10</span>
            </div>
          </div>
          {/* Reasoning: Why this influencer is a good fit */}
          {influencer.reasoning && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground/70">Why they're a fit:</span>{" "}
                {influencer.reasoning}
              </p>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function EmailDraftView({
  draft,
  influencer,
  onSend,
  videoUrl,
  audioUrl,
}: {
  draft?: EmailDraft;
  influencer: Influencer;
  onSend: (draft: EmailDraft) => void;
  videoUrl?: string;
  audioUrl?: string;
}) {
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const handleSend = async () => {
    if (!draft || !influencer.email) return;
    setIsSending(true);
    await onSend(draft);
    setIsSending(false);
  };

  const handleCopy = async () => {
    if (!draft) return;
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      // Sync video to audio time before playing
      if (audioRef.current) {
        videoRef.current.currentTime = audioRef.current.currentTime;
      }
      videoRef.current.play();
      audioRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleMediaEnd = () => {
    setIsPlaying(false);
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  // Platform-specific DM URLs
  const getDmUrl = (platform: Influencer["platform"], handle: string) => {
    const cleanHandle = handle.replace("@", "");
    switch (platform) {
      case "instagram":
        return `https://instagram.com/${cleanHandle}`;
      case "tiktok":
        return `https://tiktok.com/@${cleanHandle}`;
      case "twitter":
        return `https://twitter.com/messages/compose?recipient_id=${cleanHandle}`;
      case "youtube":
        return `https://youtube.com/${cleanHandle}`;
      default:
        return influencer.profileUrl;
    }
  };

  const platformLabels = {
    instagram: "DM on Instagram",
    tiktok: "DM on TikTok",
    twitter: "DM on X",
    youtube: "Message on YouTube",
  };

  const platformColors = {
    instagram: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600",
    tiktok: "bg-slate-800 hover:bg-slate-900",
    twitter: "bg-blue-500 hover:bg-blue-600",
    youtube: "bg-red-600 hover:bg-red-700",
  };

  const PlatformIcon = {
    instagram: Instagram,
    tiktok: () => <span className="text-xs font-bold">TT</span>,
    twitter: Twitter,
    youtube: Youtube,
  }[influencer.platform];

  if (!draft) {
    return (
      <div className="p-6 rounded-xl border bg-muted/10 text-center">
        <Loader2 className="size-5 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Generating message for {influencer.name}...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {/* Header - Influencer info without email */}
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center">
              <User className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{influencer.name}</p>
              <p className="text-xs text-muted-foreground">{influencer.handle}</p>
            </div>
          </div>
          <a
            href={influencer.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View Profile <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {/* Subject */}
      <div className="px-4 py-3 border-b">
        <span className="text-xs text-muted-foreground">Subject: </span>
        <span className="text-sm font-medium">{draft.subject}</span>
      </div>

      {/* Body with embedded video */}
      <div className="p-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{draft.body}</p>
        
        {/* Embedded Video Preview with Voiceover */}
        {videoUrl && (
          <div className="mt-4 rounded-lg overflow-hidden border bg-black">
            <div className="aspect-video relative">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                playsInline
                muted // Video is muted, audio comes from ElevenLabs
                loop
                onEnded={handleMediaEnd}
              />
              {audioUrl && (
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onEnded={handleMediaEnd}
                />
              )}
              
              {/* Play/Pause Button Overlay */}
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
              >
                <div className="size-14 rounded-full bg-white/90 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                  {isPlaying ? (
                    <Pause className="size-6 text-black" />
                  ) : (
                    <Play className="size-6 text-black ml-1" />
                  )}
                </div>
              </button>
            </div>
            <div className="p-3 bg-muted/30 border-t">
              <div className="flex items-center gap-2">
                <Video className="size-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Sample product video with voiceover</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Copy button */}
      <div className="px-4 py-2 border-t">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="size-4" />
              Copied to clipboard
            </>
          ) : (
            <>
              <Copy className="size-4" />
              Copy message
            </>
          )}
        </button>
      </div>

      {/* Outreach Actions */}
      <div className="p-4 border-t bg-muted/10">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
          Reach out via
        </p>
        
        {draft.status === "sent" ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Check className="size-3 mr-1" />
            Email Sent
          </Badge>
        ) : draft.status === "failed" ? (
          <Badge variant="destructive">
            <X className="size-3 mr-1" />
            Send Failed
          </Badge>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* Platform-specific DM button - always show */}
            <a
              href={getDmUrl(influencer.platform, influencer.handle)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-all ${platformColors[influencer.platform]}`}
            >
              <MessageCircle className="size-4" />
              {platformLabels[influencer.platform]}
            </a>

            {/* Email button - only show if email is available */}
            {influencer.email && (
              <button
                onClick={handleSend}
                disabled={isSending}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    Send via Email
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
