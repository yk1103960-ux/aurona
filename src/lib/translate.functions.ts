import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  texts: z.array(z.string().min(1).max(400)).min(1).max(120),
  target: z.enum(["hi"]),
});

/** Machine-translates short UI strings. Returns a map of source -> translation. */
export const translateTexts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return {};

    const language = data.target === "hi" ? "Hindi (Devanagari script)" : "English";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                `You translate e-commerce website UI strings into ${language}. ` +
                "Input is a JSON array of strings. Reply with ONLY a JSON array of the same length, " +
                "in the same order, each item the translation of the matching input string. " +
                "Keep brand names (Aurona), product model names, SKUs, numbers, units (W, LED, mm), " +
                "prices and symbols unchanged. Preserve leading/trailing punctuation and casing style. " +
                "Never add commentary.",
            },
            { role: "user", content: JSON.stringify(data.texts) },
          ],
        }),
      });

      if (!res.ok) {
        console.error(`[translate] http=${res.status}`);
        return {};
      }

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content ?? "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return {};

      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return {};

      const out: Record<string, string> = {};
      data.texts.forEach((source, i) => {
        const value = parsed[i];
        if (typeof value === "string" && value.trim()) out[source] = value.trim();
      });
      return out;
    } catch (error) {
      console.error("[translate] failed", error);
      return {};
    }
  });
