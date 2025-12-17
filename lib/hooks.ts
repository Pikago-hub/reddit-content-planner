"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Campaign,
  CompanyInfo,
  Persona,
  Subreddit,
  Keyword,
  WeeklyPlan,
  PlannedPost,
  PlannedComment,
} from "./types";

// ============ Query Keys ============

export const queryKeys = {
  campaigns: ["campaigns"] as const,
  campaign: (id: string) => ["campaigns", id] as const,
  calendar: (campaignId: string, weeklyPlanId: string) =>
    ["calendar", campaignId, weeklyPlanId] as const,
};

// ============ Types ============

interface CampaignListItem {
  id: string;
  name: string;
  company_name: string;
  company_info?: CompanyInfo;
  posts_per_week: number;
  created_at: string;
}

interface CampaignDetail extends Campaign {
  personas: Persona[];
  subreddits: Subreddit[];
  keywords: Keyword[];
  weekly_plans: WeeklyPlan[];
}

interface CalendarData {
  plans: WeeklyPlan[];
  posts: (PlannedPost & { author: Persona })[];
  comments: (PlannedComment & { author: Persona })[];
}

interface CreateCampaignInput {
  name: string;
  company_name: string;
  company_info?: CompanyInfo;
  posts_per_week: number;
}

interface CreatePersonaInput {
  username: string;
  bio: string;
}

interface CreateSubredditInput {
  name?: string;
  names?: string[];
}

interface CreateKeywordInput {
  keyword_text?: string;
  texts?: string[];
}

interface GenerateCalendarResponse {
  success: boolean;
  error?: string;
  postsGenerated?: number;
  commentsGenerated?: number;
  weekStartDate?: string;
}

// ============ API Functions ============

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }
  return res.json();
}

// ============ Campaign Hooks ============

export function useCampaigns() {
  return useQuery({
    queryKey: queryKeys.campaigns,
    queryFn: () => fetchJson<CampaignListItem[]>("/api/campaigns"),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: () => fetchJson<CampaignDetail>(`/api/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      fetchJson<Campaign>("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
    },
  });
}

interface UpdateCampaignInput {
  name?: string;
  company_name?: string;
  company_info?: CompanyInfo;
  posts_per_week?: number;
}

export function useUpdateCampaign(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCampaignInput) =>
      fetchJson<Campaign>(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) =>
      fetchJson<{ success: boolean }>(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
    },
  });
}

// ============ Calendar Hooks ============

export function useCalendar(campaignId: string, weeklyPlanId: string) {
  return useQuery({
    queryKey: queryKeys.calendar(campaignId, weeklyPlanId),
    queryFn: () =>
      fetchJson<CalendarData>(
        `/api/campaigns/${campaignId}/calendar?weeklyPlanId=${weeklyPlanId}`
      ),
    enabled: !!campaignId && !!weeklyPlanId,
  });
}

export function useGenerateCalendar(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<GenerateCalendarResponse>("/api/generate-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

export function useGenerateNextWeek(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<GenerateCalendarResponse>("/api/generate-next-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

interface RegenerateCalendarResponse {
  success: boolean;
  weeklyPlanId?: string;
  weekStartDate?: string;
  totalPosts?: number;
  error?: string;
}

export function useDeleteWeeklyPlan(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (weeklyPlanId: string) =>
      fetchJson<{ success: boolean }>(
        `/api/campaigns/${campaignId}/calendar?weeklyPlanId=${weeklyPlanId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

export function useRegenerateCalendar(
  campaignId: string,
  weeklyPlanId: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<RegenerateCalendarResponse>(
        `/api/campaigns/${campaignId}/calendar/${weeklyPlanId}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendar(campaignId, weeklyPlanId),
      });
      if (data.weeklyPlanId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.calendar(campaignId, data.weeklyPlanId),
        });
      }
    },
  });
}

// ============ Persona Hooks ============

export function useAddPersona(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePersonaInput) =>
      fetchJson<Persona>(`/api/campaigns/${campaignId}/personas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

export function useDeletePersona(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (personaId: string) =>
      fetchJson<void>(
        `/api/campaigns/${campaignId}/personas?personaId=${personaId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

export function useSetOperatorPersona(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (personaId: string) =>
      fetchJson<Persona>(`/api/campaigns/${campaignId}/personas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

// ============ Subreddit Hooks ============

export function useAddSubreddit(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSubredditInput) =>
      fetchJson<Subreddit>(`/api/campaigns/${campaignId}/subreddits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

export function useDeleteSubreddit(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subredditId: string) =>
      fetchJson<void>(
        `/api/campaigns/${campaignId}/subreddits?subredditId=${subredditId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

// ============ Keyword Hooks ============

export function useAddKeyword(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKeywordInput) =>
      fetchJson<Keyword>(`/api/campaigns/${campaignId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

export function useDeleteKeyword(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keywordId: string) =>
      fetchJson<void>(
        `/api/campaigns/${campaignId}/keywords?keywordId=${keywordId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

// ============ Create Weekly Plan Hook ============

interface CreateWeeklyPlanResponse {
  weeklyPlanId: string;
  weekStartDate: string;
  totalPosts: number;
}

export function useCreateWeeklyPlan(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options?: { weekStartDate?: string; isNextWeek?: boolean }) =>
      fetchJson<CreateWeeklyPlanResponse>(
        `/api/campaigns/${campaignId}/calendar/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options || {}),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign(campaignId),
      });
    },
  });
}

// ============ SSE Streaming Hook for Calendar Page ============

export interface GenerationProgress {
  type: "progress" | "complete" | "error";
  step?: string;
  postIndex?: number;
  totalPosts?: number;
  subredditName?: string;
  message?: string;
  weeklyPlanId?: string;
  postsGenerated?: number;
  commentsGenerated?: number;
  errors?: string[];
  error?: string;
}

interface UseCalendarGenerationOptions {
  onProgress?: (progress: GenerationProgress) => void;
  onPostComplete?: () => void;
  onComplete?: (result: GenerationProgress) => void;
  onError?: (error: string) => void;
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  step?: string;
  postIndex?: number;
  subredditName?: string;
}

export function useCalendarGeneration(
  campaignId: string,
  weeklyPlanId: string,
  options: UseCalendarGenerationOptions = {}
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const queryClient = useQueryClient();

  const startGeneration = async () => {
    setIsGenerating(true);
    setProgress(null);
    setLogs([]);

    try {
      const response = await fetch("/api/generate-calendar-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyPlanId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start generation");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as GenerationProgress;
              setProgress(data);

              // Accumulate log entries
              if (data.message) {
                setLogs((prev) => [
                  ...prev,
                  {
                    timestamp: new Date(),
                    message: data.message!,
                    step: data.step,
                    postIndex: data.postIndex,
                    subredditName: data.subredditName,
                  },
                ]);
              }
              if (data.type === "progress") {
                options.onProgress?.(data);
                if (data.step === "post_complete") {
                  options.onPostComplete?.();
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.calendar(campaignId, weeklyPlanId),
                  });
                }
              } else if (data.type === "complete") {
                setLogs((prev) => [
                  ...prev,
                  {
                    timestamp: new Date(),
                    message: `🎉 Generation complete! ${data.postsGenerated} posts, ${data.commentsGenerated} comments`,
                  },
                ]);
                options.onComplete?.(data);
                queryClient.invalidateQueries({
                  queryKey: queryKeys.campaign(campaignId),
                });
                queryClient.invalidateQueries({
                  queryKey: queryKeys.calendar(campaignId, weeklyPlanId),
                });
              } else if (data.type === "error") {
                setLogs((prev) => [
                  ...prev,
                  {
                    timestamp: new Date(),
                    message: `❌ Error: ${data.error}`,
                  },
                ]);
                options.onError?.(data.error || "Unknown error");
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setLogs((prev) => [
        ...prev,
        { timestamp: new Date(), message: `❌ Error: ${message}` },
      ]);
      options.onError?.(message);
      setProgress({ type: "error", error: message });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearLogs = () => setLogs([]);

  return {
    startGeneration,
    isGenerating,
    progress,
    logs,
    clearLogs,
  };
}
