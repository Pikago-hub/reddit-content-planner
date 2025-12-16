"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useCampaigns, useCreateCampaign } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Home() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();

  const [open, setOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    company_name: "",
    company_url: "",
    company_description: "",
    posts_per_week: 3,
  });

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCampaign.mutateAsync({
        name: newCampaign.name,
        company_name: newCampaign.company_name,
        company_info: {
          website: newCampaign.company_url || undefined,
          description: newCampaign.company_description || undefined,
        },
        posts_per_week: newCampaign.posts_per_week,
      });
      setOpen(false);
      setNewCampaign({
        name: "",
        company_name: "",
        company_url: "",
        company_description: "",
        posts_per_week: 3,
      });
      toast.success("Campaign created!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create campaign";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-3xl font-bold text-foreground">
            Reddit Content Planner
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate natural-looking content calendars with posts and threaded
            comments
          </p>
        </header>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">Campaigns</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>+ New Campaign</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Campaign</DialogTitle>
                <DialogDescription>
                  Set up a new content campaign for your company.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCampaign}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">
                      Campaign Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={newCampaign.name}
                      onChange={(e) =>
                        setNewCampaign({ ...newCampaign, name: e.target.value })
                      }
                      placeholder="e.g., SlideForge Q1 Campaign"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="company">
                      Company Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="company"
                      value={newCampaign.company_name}
                      onChange={(e) =>
                        setNewCampaign({
                          ...newCampaign,
                          company_name: e.target.value,
                        })
                      }
                      placeholder="e.g., SlideForge"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="company_url">
                      Company URL{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="company_url"
                      value={newCampaign.company_url}
                      onChange={(e) =>
                        setNewCampaign({
                          ...newCampaign,
                          company_url: e.target.value,
                        })
                      }
                      placeholder="e.g., slideforge.ai"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="company_description">
                      Company Description{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      id="company_description"
                      value={newCampaign.company_description}
                      onChange={(e) =>
                        setNewCampaign({
                          ...newCampaign,
                          company_description: e.target.value,
                        })
                      }
                      placeholder="What does your company do? Who is your ICP?"
                      className="h-24"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="posts">
                      Posts per Week <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="posts"
                      type="number"
                      min="1"
                      max="14"
                      value={newCampaign.posts_per_week}
                      onChange={(e) =>
                        setNewCampaign({
                          ...newCampaign,
                          posts_per_week: parseInt(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCampaign.isPending}>
                    {createCampaign.isPending && <Spinner size="sm" />}
                    {createCampaign.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">
                No campaigns yet. Create your first one!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{campaign.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {campaign.company_name}
                          {campaign.company_info?.website && (
                            <> • {campaign.company_info.website}</>
                          )}
                        </CardDescription>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {campaign.posts_per_week} posts/week
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Created{" "}
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
