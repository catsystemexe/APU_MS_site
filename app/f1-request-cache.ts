/**
 * GPT-5.6 standalone requests only: top-level instructions are developer
 * instructions, but explicit breakpoints require an input_text content block.
 * Keep the complete trusted instruction string first, verbatim; the variable
 * user JSON stays outside the boundary and explicit-only mode prevents writes
 * of that changing suffix. Do not use for previous_response_id conversations:
 * input messages would persist differently from per-response instructions.
 * https://developers.openai.com/api/docs/guides/prompt-caching
 */
export function cacheableF1Input(instructions: string, userInput: string) {
  return {
    prompt_cache_options: { mode: "explicit" as const },
    input: [
      {
        role: "developer" as const,
        content: [{ type: "input_text" as const, text: instructions, prompt_cache_breakpoint: { mode: "explicit" as const } }],
      },
      { role: "user" as const, content: [{ type: "input_text" as const, text: userInput }] },
    ],
  };
}
