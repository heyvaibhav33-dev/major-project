import { createContext, useContext, useState, ReactNode } from "react";

interface InterviewState {
  resumeText: string;
  resumeName: string;
  sessionId: string; // conversationId from ElevenLabs
  agentId: string;
  setResumeText: (text: string) => void;
  setResumeName: (name: string) => void;
  setSessionId: (id: string) => void;
  setAgentId: (id: string) => void;
  reset: () => void;
}

const InterviewContext = createContext<InterviewState | null>(null);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [resumeText, setResumeText] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [agentId, setAgentId] = useState("");

  const reset = () => {
    setResumeText("");
    setResumeName("");
    setSessionId("");
    setAgentId("");
  };

  return (
    <InterviewContext.Provider
      value={{
        resumeText, resumeName, sessionId, agentId,
        setResumeText, setResumeName, setSessionId, setAgentId, reset,
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
