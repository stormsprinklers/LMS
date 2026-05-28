import {
  courseBlueprintSchema,
  normalizeLlmBlueprint,
  type CourseBlueprint,
} from "./blueprint-schema";
import { buildReworkMessages } from "./build-prompt";
import { AI_GENERATION_MODEL, requireOpenAI } from "./openai-client";
import { courseBlueprintJsonSchema } from "./blueprint-schema";
import { validateBlueprint } from "./validate-blueprint";

export async function reworkBlueprintSection(
  blueprint: CourseBlueprint,
  instruction: string,
  moduleIndex?: number,
  itemIndex?: number,
): Promise<{ blueprint?: CourseBlueprint; error?: string; issues?: ReturnType<typeof validateBlueprint>["issues"] }> {
  const openai = requireOpenAI();
  const { system, user } = buildReworkMessages(
    blueprint,
    instruction,
    moduleIndex,
    itemIndex,
  );

  const completion = await openai.chat.completions.create({
    model: AI_GENERATION_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "course_blueprint",
        strict: false,
        schema: courseBlueprintJsonSchema as Record<string, unknown>,
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return { error: "No response from AI." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "AI returned invalid JSON." };
  }

  const normalized = normalizeLlmBlueprint(parsed);
  const next = courseBlueprintSchema.safeParse(normalized);
  if (!next.success) {
    return { error: next.error.message };
  }

  const validation = validateBlueprint(next.data);
  return { blueprint: next.data, issues: validation.issues };
}
