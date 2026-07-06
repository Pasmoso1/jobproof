export async function transcribeAudioWithWhisper(
  audioBytes: ArrayBuffer,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const blob = new Blob([audioBytes], { type: mimeType });
    const form = new FormData();
    form.append("file", blob, fileName);
    form.append("model", "whisper-1");
    form.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      console.error("[transcribeAudioWithWhisper] OpenAI error", response.status);
      return null;
    }

    const payload = (await response.json()) as { text?: string };
    const text = String(payload.text ?? "").trim();
    return text || null;
  } catch (err) {
    console.error("[transcribeAudioWithWhisper]", err);
    return null;
  }
}
