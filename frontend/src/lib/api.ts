// NEXUS Interview API client
const API_BASE = "http://localhost:8002";

export async function uploadResume(file: File): Promise<{ text: string; name: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload-resume`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload resume");
  return res.json();
}

export async function startInterview(resumeText: string): Promise<{
  agent_id: string;
  signed_url: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/api/start-interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume_text: resumeText }),
  });
  if (!res.ok) throw new Error("Failed to start interview");
  return res.json();
}

// SSE stream helper
async function consumeSSE(
  url: string,
  body: object,
  onEvent: (event: Record<string, unknown>) => void
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          onEvent(data);
        } catch {}
      }
    }
  }

  if (buffer.trim().startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.trim().slice(6));
      onEvent(data);
    } catch {}
  }
}

export interface AnalysisQuestionScore {
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

export interface StructuredData {
  strengths?: string[];
  weaknesses?: string[];
  improvements?: string[];
  question_scores?: AnalysisQuestionScore[];
}

export interface AnalysisCallbacks {
  onScore: (score: number) => void;
  onToken: (text: string) => void;
  onStructured: (data: StructuredData) => void;
  onStatus: (message: string) => void;
  onDone: () => void;
  onError?: (message: string) => void;
}

export async function getAnalysisStream(
  agentId: string,
  conversationId: string,
  callbacks: AnalysisCallbacks
): Promise<void> {
  await consumeSSE(`${API_BASE}/api/analyze`, { agent_id: agentId, conversation_id: conversationId }, (event) => {
    switch (event.type) {
      case "score": {
        const data = event.data as { overall_score: number };
        callbacks.onScore(data.overall_score);
        break;
      }
      case "token": {
        const data = event.data as { text: string };
        callbacks.onToken(data.text);
        break;
      }
      case "structured": {
        callbacks.onStructured(event.data as StructuredData);
        break;
      }
      case "status": {
        const data = event.data as { message: string };
        callbacks.onStatus(data.message);
        break;
      }
      case "done":
        callbacks.onDone();
        break;
      case "error":
        callbacks.onError?.(event.message as string);
        break;
    }
  });
}
