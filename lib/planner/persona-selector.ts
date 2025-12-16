import { Persona, PlannedPost, PlannedComment, Subreddit } from "../types";

interface PersonaSelection {
  persona: Persona;
  reason: string;
}

interface PersonaUsage {
  postsThisWeek: number;
  commentsThisWeek: number;
}

const DEFAULT_MAX_POSTS_PER_WEEK = 2;
const DEFAULT_MAX_COMMENTS_PER_WEEK = 10;

/**
 * Selects a persona to author a post.
 *
 * If an "operator" persona is designated, they make ALL posts (the "seeker" pattern).
 * Otherwise, falls back to distributing posts across personas.
 */
export function selectPostAuthor(
  personas: Persona[],
  subreddit: Subreddit,
  existingPosts: PlannedPost[],
  existingComments: PlannedComment[]
): PersonaSelection | null {
  const activePersonas = personas.filter((p) => p.is_active);

  if (activePersonas.length === 0) {
    return null;
  }

  const operatorPersona = activePersonas.find((p) => p.is_operator);
  if (operatorPersona) {
    return {
      persona: operatorPersona,
      reason: "operator",
    };
  }

  const usage = calculatePersonaUsage(
    activePersonas,
    existingPosts,
    existingComments
  );

  const scoredPersonas = activePersonas
    .map((persona) => {
      const personaUsage = usage.get(persona.id) || {
        postsThisWeek: 0,
        commentsThisWeek: 0,
      };

      if (personaUsage.postsThisWeek >= DEFAULT_MAX_POSTS_PER_WEEK) {
        return { persona, score: -1, reason: "at_max_posts" };
      }

      let score = 100;
      score -= personaUsage.postsThisWeek * 25;

      const relevanceBoost = calculateRelevanceScore(persona, subreddit);
      score += relevanceBoost;
      score += Math.random() * 15;

      return {
        persona,
        score,
        reason: relevanceBoost > 10 ? "topic_match" : "available",
      };
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (scoredPersonas.length === 0) {
    return null;
  }

  return {
    persona: scoredPersonas[0].persona,
    reason: scoredPersonas[0].reason,
  };
}

/**
 * Selects personas to comment on a post, respecting constraints:
 * - Variety across personas (max 10 comments per persona by default)
 * - Author of post shouldn't be first commenter
 * - Not all personas should comment on every post (2-4 is natural)
 */
export function selectCommenters(
  personas: Persona[],
  postAuthorId: string,
  existingPosts: PlannedPost[],
  existingComments: PlannedComment[],
  targetCommentCount: number = 3
): PersonaSelection[] {
  const activePersonas = personas.filter((p) => p.is_active);
  const usage = calculatePersonaUsage(
    activePersonas,
    existingPosts,
    existingComments
  );

  const nonAuthors = activePersonas.filter((p) => p.id !== postAuthorId);

  const scoredPersonas = nonAuthors
    .map((persona) => {
      const personaUsage = usage.get(persona.id) || {
        postsThisWeek: 0,
        commentsThisWeek: 0,
      };

      if (personaUsage.commentsThisWeek >= DEFAULT_MAX_COMMENTS_PER_WEEK) {
        return { persona, score: -1, reason: "at_max_comments" };
      }

      let score = 100;
      score -= personaUsage.commentsThisWeek * 5;
      score += Math.random() * 30;

      return {
        persona,
        score,
        reason: "available",
      };
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);

  const actualCount = Math.min(
    targetCommentCount,
    scoredPersonas.length,
    Math.floor(Math.random() * 3) + 2
  );

  const selections: PersonaSelection[] = scoredPersonas
    .slice(0, actualCount)
    .map((s) => ({
      persona: s.persona,
      reason: s.reason,
    }));

  if (Math.random() > 0.5) {
    const postAuthor = activePersonas.find((p) => p.id === postAuthorId);
    if (postAuthor) {
      const authorUsage = usage.get(postAuthorId) || {
        postsThisWeek: 0,
        commentsThisWeek: 0,
      };
      if (authorUsage.commentsThisWeek < DEFAULT_MAX_COMMENTS_PER_WEEK) {
        selections.push({
          persona: postAuthor,
          reason: "author_reply",
        });
      }
    }
  }

  return selections;
}

/**
 * Calculate how much each persona has been used this week
 */
function calculatePersonaUsage(
  personas: Persona[],
  posts: PlannedPost[],
  comments: PlannedComment[]
): Map<string, PersonaUsage> {
  const usage = new Map<string, PersonaUsage>();

  for (const persona of personas) {
    usage.set(persona.id, { postsThisWeek: 0, commentsThisWeek: 0 });
  }

  for (const post of posts) {
    const current = usage.get(post.author_persona_id);
    if (current) {
      current.postsThisWeek++;
    }
  }

  for (const comment of comments) {
    const current = usage.get(comment.author_persona_id);
    if (current) {
      current.commentsThisWeek++;
    }
  }

  return usage;
}

/**
 * Calculate how relevant a persona is to a subreddit
 * based on persona bio and subreddit name
 */
function calculateRelevanceScore(
  persona: Persona,
  subreddit: Subreddit
): number {
  if (!persona.bio) {
    return 0;
  }

  const bioLower = persona.bio.toLowerCase();
  const subredditLower = subreddit.name.toLowerCase();
  let score = 0;

  if (bioLower.includes(subredditLower)) {
    score += 15;
  }

  const roleKeywords: Record<string, string[]> = {
    consultant: ["consulting", "client", "strategy", "business"],
    sales: ["sales", "pitch", "customer", "deal", "prospect"],
    student: ["student", "university", "academic", "class", "professor"],
    pm: ["product", "roadmap", "feature", "engineering", "design"],
    ops: ["operations", "process", "team", "startup"],
  };

  const subredditThemes: Record<string, string[]> = {
    powerpoint: ["presentations", "slides", "deck"],
    consulting: ["consultant", "business", "strategy"],
    entrepreneur: ["startup", "business", "founder"],
    productivity: ["ops", "process", "workflow"],
    marketing: ["sales", "customer", "growth"],
  };

  for (const [role, keywords] of Object.entries(roleKeywords)) {
    const hasRole = keywords.some((k) => bioLower.includes(k));
    const matchesSubreddit = subredditThemes[subredditLower]?.some((theme) =>
      keywords.some((k) => k.includes(theme) || theme.includes(k))
    );
    if (hasRole && matchesSubreddit) {
      score += 10;
    }
  }

  return Math.min(score, 30);
}
