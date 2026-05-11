import OpenAI from "openai";
import { z } from "zod";
import { Tag } from "./db/schema";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-chat";

const COMPLEXITY = ["low", "medium", "high", "extra_high"] as const;

const IMPROVEMENT_CATEGORY = [
    "typo",
    "grammar",
    "clarity",
    "factual",
    "structure",
    "missing_context",
] as const;

const reviewPrompt = (article: string, tags: Tag[]) => `
You are a junior software developer with no specialised domain knowledge
beyond general programming fundamentals. Read the article below and
evaluate it from that perspective.

ARTICLE (everything between the <<<ARTICLE>>> markers, verbatim):
<<<ARTICLE>>>
${article}
<<<ARTICLE>>>

AVAILABLE TAGS (JSON array; use only these ids in suggested_tags):
${JSON.stringify(tags.map(t => ({ id: t.id, label: t.label, tooltip: t.tooltip })))}

Produce four pieces of analysis:

1. READING TIME — whole minutes a junior reader needs end-to-end. Build
   the estimate from:
   - baseline reading speed of 180 words per minute
   - extra time for dynamic elements (interactive plots, embedded
     widgets, runnable code, etc.)
   - thinking time for non-trivial arguments, derivations or code
   - time to skim each external link
   - time to look up unfamiliar terms or concepts

2. COMPLEXITY — exactly one of: "low" | "medium" | "high" | "extra_high".
   Base the rating on:
   - amount of prerequisite knowledge a junior would lack
   - depth of mathematics, formal proofs or low-level details
   - length and structural clarity (sections, headings, examples)
   - quality and quantity of worked examples

3. SUGGESTED_TAGS — ids from AVAILABLE TAGS that best describe the
   article. Empty array if nothing fits. Never invent ids.

4. IMPROVEMENTS — concrete edits that would help a junior reader.
   \`range.start\` and \`range.end\` are 0-indexed character offsets into
   the ARTICLE string (end-exclusive); \`correction\` replaces that slice.
   For pure additions, set \`start === end\` at the insertion point.

   Categories (pick the most specific one that applies):
   - "typo"             — misspellings, wrong characters, broken
                          punctuation, accidental duplications.
   - "grammar"          — agreement, tense, articles, word order;
                          sentence is wrong but meaning is recoverable.
   - "clarity"          — sentence is grammatical but confusing,
                          ambiguous, wordy or jargon-heavy; rewrite for
                          a junior reader without changing meaning.
   - "factual"          — statement is incorrect, outdated or
                          misleading; fix the claim itself.
   - "structure"        — ordering, sectioning or flow problems
                          (missing headings, buried lede, wrong place
                          for a paragraph, redundant repetition).
   - "missing_context"  — a junior would get stuck because a term,
                          assumption, prerequisite or motivation is
                          not introduced; add the missing context.

OUTPUT FORMAT
Return ONLY a JSON value that matches this TypeScript type. No prose,
no markdown fences, no trailing commas, no comments.

type Result = {
    reading_time_min: number;
    complexity: "low" | "medium" | "high" | "extra_high";
    suggested_tags: number[];
    improvements: {
        category: "typo" | "grammar" | "clarity" | "factual"
                | "structure" | "missing_context";
        range: { start: number; end: number };
        correction: string;
        msg: string;
    }[];
};
`

const reviewResponseSchema = z.object({
    reading_time_min: z.number().int().positive(),
    complexity: z.enum(COMPLEXITY),
    suggested_tags: z.array(z.number().int()),
    improvements: z.array(
        z.object({
            category: z.enum(IMPROVEMENT_CATEGORY),
            range: z
                .object({
                    start: z.number().int().nonnegative(),
                    end: z.number().int().nonnegative(),
                })
                .refine((r) => r.end >= r.start, {
                    message: "range.end must be >= range.start",
                }),
            correction: z.string(),
            msg: z.string(),
        }),
    ),
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

export const reviewRequest = async (
    token: string,
    article: string,
    tags: Tag[],
): Promise<ReviewResponse> => {
    const client = new OpenAI({
        apiKey: token,
        baseURL: DEEPSEEK_BASE_URL,
        timeout: 120_000,
        maxRetries: 2,
    });

    const completion = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages: [{ role: "user", content: reviewPrompt(article, tags) }],
        response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
        throw new Error("DeepSeek returned an empty response");
    }

    return reviewResponseSchema.parse(JSON.parse(raw));
};