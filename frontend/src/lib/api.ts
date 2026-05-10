// NEXUS Interview API client
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8002";

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

export interface StartInterviewResponse {
  conversation_id: string;
  conversation_url: string;
  plan_summary?: {
    target_role: string;
    experience_level: string;
    candidate_summary: string;
    question_count: number;
  };
  error?: string;
}

export async function startInterview(resumeText: string): Promise<StartInterviewResponse> {
  const res = await fetch(`${API_BASE}/api/start-interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume_text: resumeText }),
  });
  if (!res.ok) throw new Error("Failed to start interview");
  return res.json();
}

export async function endInterview(conversationId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/end-interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
  } catch {
    // best-effort cleanup; analyze flow also ends the conversation
  }
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
        } catch {
          /* ignore unparseable */
        }
      }
    }
  }

  if (buffer.trim().startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.trim().slice(6));
      onEvent(data);
    } catch {
      /* ignore */
    }
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
  onTranscript?: (transcript: string) => void;
  onDone: () => void;
  onError?: (message: string) => void;
}

export async function getAnalysisStream(
  conversationId: string,
  callbacks: AnalysisCallbacks
): Promise<void> {
  await consumeSSE(`${API_BASE}/api/analyze`, { conversation_id: conversationId }, (event) => {
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
      case "transcript": {
        const data = event.data as { transcript: string };
        callbacks.onTranscript?.(data.transcript);
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
