"use client";

import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  useCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useDeleteWeeklyPlan,
  useAddPersona,
  useDeletePersona,
  useSetOperatorPersona,
  useAddSubreddit,
  useDeleteSubreddit,
  useAddKeyword,
  useDeleteKeyword,
  useCreateWeeklyPlan,
} from "@/lib/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { CampaignHeader } from "@/components/campaign/campaign-header";
import { OverviewTab } from "@/components/overview/overview-tab";
import { PersonasTab } from "@/components/personas/personas-tab";
import { SubredditsTab } from "@/components/subreddits/subreddits-tab";
import { KeywordsTab } from "@/components/keywords/keywords-tab";
import { CalendarTab } from "@/components/calendar/calendar-tab";

export default function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: campaign, isLoading } = useCampaign(id);

  const updateCampaign = useUpdateCampaign(id);
  const deleteCampaign = useDeleteCampaign();
  const deleteWeeklyPlan = useDeleteWeeklyPlan(id);
  const addPersona = useAddPersona(id);
  const deletePersona = useDeletePersona(id);
  const setOperatorPersona = useSetOperatorPersona(id);
  const addSubreddit = useAddSubreddit(id);
  const deleteSubreddit = useDeleteSubreddit(id);
  const addKeyword = useAddKeyword(id);
  const deleteKeyword = useDeleteKeyword(id);
  const createWeeklyPlan = useCreateWeeklyPlan(id);

  const handleUpdateCampaign = async (data: {
    name: string;
    company_name: string;
    company_url: string;
    company_description: string;
    posts_per_week: number;
  }) => {
    await updateCampaign.mutateAsync({
      name: data.name,
      company_name: data.company_name,
      company_info: {
        website: data.company_url || undefined,
        description: data.company_description || undefined,
      },
      posts_per_week: data.posts_per_week,
    });
  };

  const handleDeleteCampaign = async () => {
    await deleteCampaign.mutateAsync(id);
    router.push("/");
  };

  const handleGenerateCalendar = async () => {
    try {
      const result = await createWeeklyPlan.mutateAsync({});
      router.push(`/campaigns/${id}/calendar/${result.weeklyPlanId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create calendar";
      toast.error(message);
    }
  };

  const handleGenerateNextWeek = async () => {
    try {
      const result = await createWeeklyPlan.mutateAsync({ isNextWeek: true });
      router.push(`/campaigns/${id}/calendar/${result.weeklyPlanId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create calendar";
      toast.error(message);
    }
  };

  const handleAddPersona = async (persona: {
    username: string;
    bio: string;
  }) => {
    try {
      await addPersona.mutateAsync(persona);
      toast.success("Persona added!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add persona";
      toast.error(message);
      throw err;
    }
  };

  const handleAddSubreddits = async (names: string[]) => {
    try {
      await addSubreddit.mutateAsync({ names });
      toast.success(
        names.length === 1
          ? "Subreddit added!"
          : `${names.length} subreddits added!`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add subreddits";
      toast.error(message);
      throw err;
    }
  };

  const handleAddKeywords = async (texts: string[]) => {
    try {
      await addKeyword.mutateAsync({ texts });
      toast.success(
        texts.length === 1
          ? "Keyword added!"
          : `${texts.length} keywords added!`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add keywords";
      toast.error(message);
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Campaign not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          href="/"
          className="text-primary hover:text-primary/80 text-sm mb-4 inline-block"
        >
          ← Back to Campaigns
        </Link>

        <CampaignHeader
          campaign={campaign}
          onUpdate={handleUpdateCampaign}
          onDelete={handleDeleteCampaign}
          isUpdating={updateCampaign.isPending}
          isDeleting={deleteCampaign.isPending}
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="personas">
              Personas ({campaign.personas.length})
            </TabsTrigger>
            <TabsTrigger value="subreddits">
              Subreddits ({campaign.subreddits.length})
            </TabsTrigger>
            <TabsTrigger value="keywords">
              Keywords ({campaign.keywords.length})
            </TabsTrigger>
            <TabsTrigger value="calendar">
              Calendar ({campaign.weekly_plans.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              personasCount={campaign.personas.length}
              subredditsCount={campaign.subreddits.length}
              keywordsCount={campaign.keywords.length}
              weeklyPlansCount={campaign.weekly_plans.length}
              isGenerating={createWeeklyPlan.isPending}
              onGenerateCalendar={handleGenerateCalendar}
              onGenerateNextWeek={handleGenerateNextWeek}
            />
          </TabsContent>

          <TabsContent value="personas">
            <PersonasTab
              personas={campaign.personas}
              onAddPersona={handleAddPersona}
              onDeletePersona={(id) => deletePersona.mutateAsync(id)}
              onSetOperator={(id) => setOperatorPersona.mutate(id)}
              isAddingPersona={addPersona.isPending}
              isDeletingPersona={deletePersona.isPending}
              isSettingOperator={setOperatorPersona.isPending}
            />
          </TabsContent>

          <TabsContent value="subreddits">
            <SubredditsTab
              subreddits={campaign.subreddits}
              onAddSubreddits={handleAddSubreddits}
              onDeleteSubreddit={(id) => deleteSubreddit.mutateAsync(id)}
              isAddingSubreddit={addSubreddit.isPending}
              isDeletingSubreddit={deleteSubreddit.isPending}
            />
          </TabsContent>

          <TabsContent value="keywords">
            <KeywordsTab
              keywords={campaign.keywords}
              onAddKeywords={handleAddKeywords}
              onDeleteKeyword={(id) => deleteKeyword.mutateAsync(id)}
              isAddingKeyword={addKeyword.isPending}
              isDeletingKeyword={deleteKeyword.isPending}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarTab
              weeklyPlans={campaign.weekly_plans}
              campaignId={id}
              onDeleteWeeklyPlan={(id) => deleteWeeklyPlan.mutateAsync(id)}
              isDeletingWeeklyPlan={deleteWeeklyPlan.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
