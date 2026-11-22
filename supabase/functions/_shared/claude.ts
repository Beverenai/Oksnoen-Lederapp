// Claude (Anthropic API) for lederappens AI-funksjoner, i stedet for Lovable sin AI (bestemt av August 22.11.2026).
//
// claudeChat tar imot samme forespørsel som før (OpenAI-format: messages med system/user, tekst og
// image_url, og eventuelt ett verktøy med tool_choice) og gir tilbake et svar i samme form
// (choices[0].message.content / tool_calls). Da trenger funksjonene bare å bytte selve kallet.
// Nøkkelen ANTHROPIC_API_KEY ligger bare som edge-secret.

export const CLAUDE_SONNET = "claude-sonnet-5-5";
export const CLAUDE_HAIKU = "claude-haiku-5-5";

type OAContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
type OAMessage = { role: "system" | "user" | "assistant"; content: OAContent };
type OATool = { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } };
type OARequest = {
  model?: string;
  messages: OAMessage[];
  tools?: OATool[];
  tool_choice?: { type: "function"; function: { name: string } };
  max_tokens?: number;
};

export type ChatResponse = { ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> };

export async function claudeChat(req: OARequest, model: string = CLAUDE_SONNET): Promise<ChatResponse> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY mangler");

  const system = req.messages.filter((m) => m.role === "system").map((m) => (typeof m.content === "string" ? m.content : "")).join("\n\n");
  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string"
        ? m.content
        : m.content.map((c) => c.type === "text"
          ? { type: "text", text: c.text }
          : { type: "image", source: { type: "url", url: c.image_url.url } }),
    }));

  const body: Record<string, unknown> = { model, max_tokens: req.max_tokens ?? 1024, messages };
  if (system) body.system = system;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
    if (req.tool_choice) body.tool_choice = { type: "tool", name: req.tool_choice.function.name };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, text: async () => raw, json: async () => JSON.parse(raw) };
  }
  const data = JSON.parse(raw);
  const blocks = (data.content ?? []) as Array<{ type: string; text?: string; name?: string; input?: unknown; id?: string }>;
  const content = blocks.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const tool_calls = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
  const openAiShape = { choices: [{ message: { role: "assistant", content, ...(tool_calls.length ? { tool_calls } : {}) } }], model: data.model, usage: data.usage };
  return { ok: true, status: 200, text: async () => JSON.stringify(openAiShape), json: async () => openAiShape };
}
