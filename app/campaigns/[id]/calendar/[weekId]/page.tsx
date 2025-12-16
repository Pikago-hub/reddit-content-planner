"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCalendar,
  useRegenerateCalendar,
  useCalendarGeneration,
} from "@/lib/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

export default function CalendarViewPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>;
}) {
  const { id: campaignId, weekId } = use(params);
  const router = useRouter();
  const { data, isLoading, refetch } = useCalendar(campaignId, weekId);
  const regenerateMutation = useRegenerateCalendar(campaignId, weekId);
  const generationStartedRef = useRef(false);

  const plan = data?.plans?.[0] || null;
  const posts = data?.posts || [];
  const comments = data?.comments || [];
  const isGeneratingStatus = plan?.status === "generating";

  const { startGeneration, isGenerating, progress, logs } =
    useCalendarGeneration(campaignId, weekId, {
      onPostComplete: () => refetch(),
      onComplete: (result) => {
        toast.success(
          `Generated ${result.postsGenerated} posts and ${result.commentsGenerated} comments!`
        );
        refetch();
      },
      onError: (error) => {
        toast.error(error);
        refetch();
      },
    });

  const logContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (isGeneratingStatus && !isGenerating && !generationStartedRef.current) {
      generationStartedRef.current = true;
      startGeneration();
    }
  }, [isGeneratingStatus, isGenerating, startGeneration]);

  const handleRegenerate = async () => {
    try {
      const result = await regenerateMutation.mutateAsync();
      if (result.weeklyPlanId) {
        toast.success(
          `Regenerated ${result.postsGenerated} posts and ${result.commentsGenerated} comments`
        );
        router.push(`/campaigns/${campaignId}/calendar/${result.weeklyPlanId}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to regenerate calendar"
      );
    }
  };

  const getCommentsForPost = (postId: string) => {
    return comments.filter((c) => c.planned_post_id === postId);
  };

  const renderCommentThread = (
    postComments: typeof comments,
    parentId: string | null = null,
    depth: number = 0
  ): React.ReactNode => {
    const children = postComments.filter(
      (c) => c.reply_to_comment_id === parentId
    );

    return children.map((comment) => (
      <div
        key={comment.id}
        className={`${depth > 0 ? "ml-6 border-l-2 border-border pl-4" : ""}`}
      >
        <div className="py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-primary">
              u/{comment.author?.username || "unknown"}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {new Date(comment.scheduled_at || "").toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="text-foreground mt-1">{comment.comment_text}</p>
        </div>
        {renderCommentThread(postComments, comment.id, depth + 1)}
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link
          href={`/campaigns/${campaignId}`}
          className="text-primary hover:text-primary/80 text-sm mb-4 inline-block"
        >
          ← Back to Campaign
        </Link>

        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Content Calendar
              </h1>
              {plan && (
                <p className="text-muted-foreground">
                  Week of {new Date(plan.week_start_date).toLocaleDateString()}{" "}
                  • {posts.length} posts • {comments.length} comments
                </p>
              )}
            </div>
            <Button
              onClick={handleRegenerate}
              disabled={regenerateMutation.isPending || isGenerating}
              variant="outline"
            >
              {regenerateMutation.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Regenerating...
                </>
              ) : (
                "Regenerate Calendar"
              )}
            </Button>
          </div>
        </header>

        {isGenerating && progress && (
          <Card className="mb-6 border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Spinner size="sm" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{progress.message}</p>
                  {progress.postIndex !== undefined &&
                    progress.totalPosts !== undefined && (
                      <div className="mt-2 space-y-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500 ease-out"
                            style={{
                              width: `${(progress.postIndex / progress.totalPosts) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Post {progress.postIndex} of {progress.totalPosts}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {logs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-primary/20">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Generation Log
                  </p>
                  <div
                    ref={logContainerRef}
                    className="max-h-48 overflow-y-auto bg-background/50 rounded-lg p-3 font-mono text-xs space-y-1"
                  >
                    {logs.map((log, i) => (
                      <div
                        key={i}
                        className="text-muted-foreground leading-relaxed"
                      >
                        <span className="text-muted-foreground/60">
                          {log.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>{" "}
                        {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {posts.length === 0 && !isGenerating ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No posts in this calendar</p>
            </CardContent>
          </Card>
        ) : posts.length === 0 && isGenerating ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner size="lg" />
              <p className="text-muted-foreground">
                Generating content... Posts will appear here as they&apos;re
                created.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const postComments = getCommentsForPost(post.id);

              return (
                <Card key={post.id} className="overflow-hidden">
                  <div className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      >
                        r/{post.subreddit_name}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(post.scheduled_at || "").toLocaleDateString()}{" "}
                        at{" "}
                        {new Date(post.scheduled_at || "").toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.target_keyword_codes.map((code) => (
                        <Badge key={code} variant="outline" className="text-xs">
                          {code}
                        </Badge>
                      ))}
                      <Badge
                        variant={
                          post.quality_score >= 0.7
                            ? "default"
                            : post.quality_score >= 0.5
                              ? "secondary"
                              : "destructive"
                        }
                        className={
                          post.quality_score >= 0.7
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : post.quality_score >= 0.5
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : ""
                        }
                      >
                        {Math.round(post.quality_score * 100)}%
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-primary font-medium">
                        u/{post.author?.username || "unknown"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        OP
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {post.body}
                    </p>
                  </CardContent>

                  {postComments.length > 0 && (
                    <div className="border-t">
                      <div className="px-4 py-2 bg-muted/50">
                        <span className="text-sm font-medium text-muted-foreground">
                          {postComments.length} Comments
                        </span>
                      </div>
                      <div className="p-4">
                        {renderCommentThread(postComments)}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Calendar Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Posts</p>
                <p className="text-xl font-bold">{posts.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Comments</p>
                <p className="text-xl font-bold">{comments.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Subreddits</p>
                <p className="text-xl font-bold">
                  {new Set(posts.map((p) => p.subreddit_name)).size}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Quality</p>
                <p className="text-xl font-bold">
                  {posts.length > 0
                    ? Math.round(
                        (posts.reduce((sum, p) => sum + p.quality_score, 0) /
                          posts.length) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-muted-foreground text-sm mb-2">
                Personas Used
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  new Set([
                    ...posts.map((p) => p.author?.username),
                    ...comments.map((c) => c.author?.username),
                  ])
                )
                  .filter(Boolean)
                  .map((username) => (
                    <Badge key={username} variant="secondary">
                      u/{username}
                    </Badge>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
