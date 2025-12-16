"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Subreddit } from "@/lib/types";

interface SubredditCardProps {
  subreddit: Subreddit;
  onDelete: () => void;
}

export function SubredditCard({ subreddit, onDelete }: SubredditCardProps) {
  return (
    <Card>
      <CardContent className="py-3 flex justify-between items-center">
        <p className="font-medium">r/{subreddit.name}</p>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
