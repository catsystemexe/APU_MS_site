import { createRequestTelemetrySink } from "../../telemetry/model-usage-adapter";
import { requirePilotRulesAcceptance } from "../../pilot-rules-server";
import { getAccessIdentity } from "../../access-auth";
import { NEED_ROUTING_INSTRUCTIONS, NEED_ROUTING_SCHEMA, parseNeedRoutingDecision } from "../../f2-need-routing";
import { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload } from "../../openai-responses-instrumentation";

export const runtime = "edge";

export async function POST(request: Request) {
  const identity = await getAccessIdentity(request.headers);
  if (!identity) return Response.json({ error: "Chybí platná identita Cloudflare Access." }, { status: 401 });
  const rulesDenied = await requirePilotRulesAcceptance(identity);
  if (rulesDenied) return rulesDenied;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Neplatný formát požadavku." }, { status: 400 }); }
  const needText = body && typeof body === "object" ? (body as Record<string, unknown>).needText : null;
  if (typeof needText !== "string" || !needText.trim() || needText.length > 2000) return Response.json({ error: "Neplatná pedagogická potřeba." }, { status: 400 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "APU není dokončeno: chybí serverová konfigurace." }, { status: 503 });
  const collector = createRequestUsageCollector(await createRequestTelemetrySink(request, identity));
  try {
    const { usage_record, application_result } = await callOpenAIResponses({
      api_key: apiKey, request_id: crypto.randomUUID(), phase: "F2", operation: "need_routing", requested_model: "gpt-5.6-terra", reasoning_effort: "low", requested_service_tier: "default", collector,
      payload: {
        model: "gpt-5.6-terra", reasoning: { effort: "low" }, service_tier: "default", store: false,
        instructions: NEED_ROUTING_INSTRUCTIONS, input: JSON.stringify({ needText: needText.trim() }),
        text: { format: { type: "json_schema", name: "apu_f2_need_route", strict: true, schema: NEED_ROUTING_SCHEMA } },
      },
      validate_application_response: (response) => {
        const provider = response as Record<string, unknown>;
        const parts = (Array.isArray(response.output) ? response.output : []).flatMap((item) => Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : []);
        const text = typeof provider.output_text === "string" ? provider.output_text : parts.find((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string");
        const output = typeof text === "string" ? text : (text as { text?: string } | undefined)?.text;
        if (!output) throw new Error("missing structured output");
        return parseNeedRoutingDecision(JSON.parse(output));
      },
    });
    if (usage_record.provider_status !== "completed" || !application_result) return Response.json(modelUsagePayload({ error: "Cíl potřeby se nepodařilo určit. Zkuste to znovu." }, collector, identity), { status: 502 });
    return Response.json(modelUsagePayload({ decision: application_result }, collector, identity));
  } catch (cause) {
    return Response.json(usageErrorPayload(cause, collector, identity, "Cíl potřeby se nepodařilo určit. Zkuste to znovu.") ?? modelUsagePayload({ error: "Cíl potřeby se nepodařilo určit. Zkuste to znovu." }, collector, identity), { status: 502 });
  }
}
