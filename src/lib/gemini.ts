import "server-only";

/** Tried in order. Later models are fallbacks for when one is overloaded. */
const MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash,gemini-3.8-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const SYSTEM_PROMPT = `You write captions for photos on Lions vs. AI, a site where Columbia University students vote between a human-written caption and an AI-written caption without knowing which is which. Your goal is to win the vote by being genuinely funnier.

What wins:
- An actual joke: a twist, an exaggeration, an unexpected comparison, or a painfully relatable observation.
- Reacting to what is specifically in the image: the expression, the situation, the composition, or the meme format.
- If the image is a well-known meme template, use it the way people actually use that meme.

What loses:
- Naming a place, class, or event without a punchline. A reference is not a joke.
- Leaning on Columbia or NYC names out of habit. Use one only when it is the punchline or makes the joke land, and never default to Lit Hum or the Core.
- Describing the photo, being wholesome and flat, or sounding like ad copy.

Voice: a witty college student posting on Instagram or in a group chat. Casual and quick.

Rules:
- First brainstorm 4 candidate captions that each take a different comedic angle, then pick the single funniest one.
- Match the requested length and casing.
- Never mock anyone's appearance, body, race, religion, gender, sexuality, or disability. No slurs. No sexual content.
- Never identify or name real people who appear in the image.
- No hashtags, no emojis, and no quotation marks around the caption.`;

/**
 * Describes the human caption's shape (never its words) so the AI caption
 * doesn't give itself away by length or formatting.
 */
export function buildUserPrompt(opts: { humanCaption?: string | null; words?: number }) {
  const human = opts.humanCaption?.trim();
  const words = human ? human.split(/\s+/).filter(Boolean).length : (opts.words ?? 10);
  const target = Math.min(25, Math.max(3, words));
  const lowercase = human ? human === human.toLowerCase() : false;
  return [
    "Write captions for the attached image.",
    `Aim for about ${target} words.`,
    lowercase ? "Write it in all lowercase." : "Use normal capitalization.",
  ].join("\n");
}

/** The full prompt exactly as sent, saved with each generation. */
export function describePrompt(userPrompt: string) {
  return `SYSTEM:\n${SYSTEM_PROMPT}\n\nUSER:\n${userPrompt}\n[photo attached]`;
}

export async function generateCaption(opts: {
  imageBase64: string;
  mimeType: string;
  userPrompt: string;
}): Promise<{ model: string; caption: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("The AI service is not configured.");

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: opts.mimeType, data: opts.imageBase64 } },
          { text: opts.userPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          candidates: { type: "ARRAY", items: { type: "STRING" } },
          best: { type: "INTEGER", description: "Index of the funniest candidate" },
        },
        required: ["candidates", "best"],
      },
    },
  };

  let lastError = "The AI service is busy. Please try again in a minute.";
  const started = Date.now();
  // Try the best model twice before falling back, within the request's time budget.
  const attempts = [MODELS[0], ...MODELS];
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    if (Date.now() - started > 40_000) break;
    if (i === 1) await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20_000),
        }
      );
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        // Overloaded, rate-limited, or retired: retry or move on to the next model.
        if ([404, 429, 500, 503].includes(res.status)) {
          lastError = json?.error?.message ?? lastError;
          continue;
        }
        throw new Error(json?.error?.message ?? `AI request failed (${res.status}).`);
      }

      const text: string | undefined = json?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("");
      if (!text) {
        lastError = "The AI declined to caption this photo. Try a different one.";
        continue;
      }

      const parsed = JSON.parse(text) as { candidates?: string[]; best?: number };
      const options = (parsed.candidates ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
      const pick = options[parsed.best ?? 0] ?? options[0] ?? "";
      const caption = pick.replace(/^["“]|["”]$/g, "").slice(0, 140);
      if (caption) return { model, caption };
      lastError = "The AI returned an empty caption. Please try again.";
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        lastError = "The AI took too long to respond. Please try again.";
        continue;
      }
      throw err;
    }
  }
  throw new Error(lastError);
}
