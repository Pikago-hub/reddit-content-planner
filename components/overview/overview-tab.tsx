"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface OverviewTabProps {
  personasCount: number;
  subredditsCount: number;
  keywordsCount: number;
  weeklyPlansCount: number;
  isGenerating: boolean;
  onGenerateCalendar: () => void;
  onGenerateNextWeek: () => void;
}

export function OverviewTab({
  personasCount,
  subredditsCount,
  keywordsCount,
  weeklyPlansCount,
  isGenerating,
  onGenerateCalendar,
  onGenerateNextWeek,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Content Calendar</CardTitle>
          <CardDescription>
            Make sure you have at least 2 personas, 1 subreddit, and some
            keywords before generating.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {weeklyPlansCount === 0 ? (
            <Button
              onClick={onGenerateCalendar}
              disabled={
                isGenerating || personasCount < 2 || subredditsCount < 1
              }
            >
              Generate This Week
            </Button>
          ) : (
            <Button onClick={onGenerateNextWeek} disabled={isGenerating}>
              Generate Next Week
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{personasCount}</p>
            <p className="text-sm text-muted-foreground">Personas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{subredditsCount}</p>
            <p className="text-sm text-muted-foreground">Subreddits</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{keywordsCount}</p>
            <p className="text-sm text-muted-foreground">Keywords</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
