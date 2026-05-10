import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export interface PlanSummary {
  target_role: string;
  experience_level: string;
  candidate_summary: string;
  question_count: number;
}

export interface ChatTurn {
  role: "agent" | "user";
  text: string;
}

interface InterviewState {
  resumeText: string;
  resumeName: string;
  conversationId: string;
  conversationUrl: string;
  planSummary: PlanSummary | null;
  chatHistory: ChatTurn[];
  setResumeText: (text: string) => void;
  setResumeName: (name: string) => void;
  setConversationId: (id: string) => void;
  setConversationUrl: (url: string) => void;
  setPlanSummary: (p: PlanSummary | null) => void;
  setChatHistory: (h: ChatTurn[] | ((prev: ChatTurn[]) => ChatTurn[])) => void;
  reset: () => void;
}

const InterviewContext = createContext<InterviewState | null>(null);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [resumeText, setResumeText] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [conversationUrl, setConversationUrl] = useState("");
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);

  const reset = () => {
    setResumeText("");
    setResumeName("");
    setConversationId("");
    setConversationUrl("");
    setPlanSummary(null);
    setChatHistory([]);
  };

  return (
    <InterviewContext.Provider
      value={{
        resumeText,
        resumeName,
        conversationId,
        conversationUrl,
        planSummary,
        chatHistory,
        setResumeText,
        setResumeName,
        setConversationId,
        setConversationUrl,
        setPlanSummary,
        setChatHistory,
        reset,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error("useInterview must be used within InterviewProvider");
  return ctx;
}
