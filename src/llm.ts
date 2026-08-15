const API_KEY = process.env.OPENAI_API_KEY || "";
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function llm(prompt: string, system = "You are a helpful assistant."): Promise<string> {
  if (!API_KEY) throw new Error("OPENAI_API_KEY is required for LLM activities.");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export function configured(): boolean {
  return Boolean(API_KEY);
}
