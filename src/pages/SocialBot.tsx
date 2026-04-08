import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Bot, Send, BarChart3, Clock, CheckCircle, XCircle, AlertCircle, Copy, RefreshCw, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "zujrmifaabkletgnpoyw";
const FUNCTIONS_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

async function callPostToTwitter(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${FUNCTIONS_URL}/post-to-twitter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

const statusIcon = (status: string) => {
  if (status === "posted") return <CheckCircle className="w-4 h-4 text-green-400" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" />;
  return <AlertCircle className="w-4 h-4 text-yellow-400" />;
};

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    posted: "bg-green-500/20 text-green-300 border-green-500/30",
    failed: "bg-red-500/20 text-red-300 border-red-500/30",
    pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${colors[status] || colors.pending}`}>
      {statusIcon(status)} {status}
    </span>
  );
};

export default function SocialBot() {
  const queryClient = useQueryClient();
  const [autoPostEnabled, setAutoPostEnabled] = useState(true);

  const { data: statsData } = useQuery({
    queryKey: ["social-bot-stats"],
    queryFn: () => callPostToTwitter("stats"),
    refetchInterval: 30000,
  });

  const { data: previewData } = useQuery({
    queryKey: ["social-bot-preview"],
    queryFn: () => callPostToTwitter("preview"),
    refetchInterval: 60000,
  });

  const { data: recentData, isLoading: loadingPosts } = useQuery({
    queryKey: ["social-bot-recent"],
    queryFn: () => callPostToTwitter("recent"),
    refetchInterval: 15000,
  });

  const postNowMutation = useMutation({
    mutationFn: () => callPostToTwitter("post_now"),
    onSuccess: (data) => {
      if (data.status === "posted") toast.success("Tweet posted successfully!");
      else if (data.status === "draft") toast.info("Saved as draft — no Twitter account configured");
      else if (data.status === "no_discovery") toast.warning("No discoveries found in last 24h");
      else if (data.status === "already_posted") toast.info("Top discovery already posted");
      else toast.info(data.message || "Post queued");
      queryClient.invalidateQueries({ queryKey: ["social-bot-recent"] });
      queryClient.invalidateQueries({ queryKey: ["social-bot-stats"] });
    },
    onError: () => toast.error("Failed to post"),
  });

  const stats = statsData?.stats || { total: 0, posted: 0, failed: 0, pending: 0 };
  const preview = previewData?.preview;
  const posts = recentData?.posts || [];

  const statCards = [
    { label: "Total Posts", value: stats.total || 0, icon: BarChart3, color: "from-purple-500 to-indigo-600" },
    { label: "Posted", value: stats.posted || 0, icon: CheckCircle, color: "from-green-500 to-emerald-600" },
    { label: "Pending", value: stats.pending || 0, icon: Clock, color: "from-yellow-500 to-amber-600" },
    { label: "Failed", value: stats.failed || 0, icon: XCircle, color: "from-red-500 to-rose-600" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead title="Social Bot — MEEET STATE" description="Automated Twitter/X posting bot for MEEET discoveries" />
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
              <Bot className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Social Bot</h1>
              <p className="text-sm text-muted-foreground">Auto-post top discoveries to X / Twitter</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
              {autoPostEnabled ? <Power className="w-4 h-4 text-green-400" /> : <PowerOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm">{autoPostEnabled ? "Active" : "Paused"}</span>
              <Switch checked={autoPostEnabled} onCheckedChange={setAutoPostEnabled} />
            </div>
            <Button
              onClick={() => postNowMutation.mutate()}
              disabled={postNowMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Send className="w-4 h-4 mr-2" />
              {postNowMutation.isPending ? "Posting…" : "Post Now"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="p-4 rounded-xl bg-card border border-border hover:border-purple-500/30 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${s.color}`}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Preview */}
          <div className="lg:col-span-1">
            <div className="rounded-xl bg-card border border-border p-5">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Next Scheduled Post
              </h2>
              {preview ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Discovery: <span className="text-foreground font-medium">{preview.discovery.title}</span></p>
                  <p className="text-xs text-muted-foreground">Impact: <Badge variant="secondary">{preview.discovery.impact_score}</Badge></p>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm whitespace-pre-wrap break-words">
                    {preview.tweet}
                  </div>
                  <p className="text-xs text-muted-foreground">{preview.tweet.length}/280 characters</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(preview.tweet);
                      toast.success("Tweet copied!");
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copy Tweet
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No discoveries in the last 24h to post.</p>
              )}
            </div>
          </div>

          {/* Recent Posts Feed */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-card border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Recent Posts
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["social-bot-recent"] })}
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
              {loadingPosts ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-lg bg-muted/20 animate-pulse" />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No posts yet. Click "Post Now" to create your first social post.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {posts.map((post: any) => (
                    <div key={post.id} className="p-3 rounded-lg border border-border hover:border-purple-500/20 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-purple-400">
                            {post.platform === "twitter" ? "𝕏" : post.platform}
                          </span>
                          {statusBadge(post.status)}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {post.posted_at
                            ? new Date(post.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">{post.post_content}</p>
                      {post.engagement_metrics && Object.keys(post.engagement_metrics).length > 0 && post.engagement_metrics.tweet_id && (
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <a
                            href={`https://x.com/i/status/${post.engagement_metrics.tweet_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:underline"
                          >
                            View on 𝕏 →
                          </a>
                        </div>
                      )}
                      {post.error_message && (
                        <p className="mt-1 text-xs text-red-400 truncate">Error: {post.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
