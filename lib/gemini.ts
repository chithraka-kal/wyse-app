export async function askGemini(
  prompt: string,
  timeoutMs = 5000,
): Promise<string | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("Gemini API key is not configured");
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    if (!res.ok) {
      console.error("Gemini request failed", res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return typeof text === "string" ? text : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Gemini call failed", message);
    return null;
  }
}
