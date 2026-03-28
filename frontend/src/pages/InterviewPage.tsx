import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, MicOff, Volume2, Clock, StopCircle, Phone, PhoneOff } from "lucide-react";
import { useInterview } from "../context/InterviewContext";
import { startInterview } from "../lib/api";
import { Conversation } from "@11labs/client";

type ConvoStatus = "idle" | "connecting" | "connected" | "ended";
type AgentMode = "listening" | "speaking";

export default function InterviewPage() {
  const navigate = useNavigate();
  const { resumeText, setSessionId, setAgentId: ctxSetAgentId } = useInterview();

  const [status, setStatus] = useState<ConvoStatus>("idle");
  const [agentMode, setAgentMode] = useState<AgentMode>("listening");
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState("");
  const [planSummary, setPlanSummary] = useState<{ target_role: string; experience_level: string; candidate_summary: string; question_count: number } | null>(null);
  const [loadingStep, setLoadingStep] = useState("");
  const [agentText, setAgentText] = useState("");
  const [userText, setUserText] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);

  const conversationRef = useRef<Conversation | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentIdRef = useRef("");
  const conversationIdRef = useRef("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resumeText) navigate("/");
  }, [resumeText, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  useEffect(() => {
    if (status === "connected") {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const handleStart = useCallback(async () => {
    setStatus("connecting");
    setError("");
    setLoadingStep("Gemini is analyzing your resume...");

    try {
      // 1. Gemini creates interview plan + ElevenLabs agent is created
      const res = await startInterview(resumeText);
      if (res.error) {
        setError(res.error);
        setStatus("idle");
        return;
      }

      agentIdRef.current = res.agent_id;
      ctxSetAgentId(res.agent_id);
      if ((res as any).plan_summary) {
        setPlanSummary((res as any).plan_summary);
      }

      // 2. Request microphone permission
      setLoadingStep("Requesting microphone access...");
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setLoadingStep("Connecting to AI interviewer...");

      // 3. Start ElevenLabs conversation
      const conversation = await Conversation.startSession({
        signedUrl: res.signed_url,
        onConnect: ({ conversationId }) => {
          console.log("Connected:", conversationId);
          conversationIdRef.current = conversationId;
          setSessionId(conversationId);
          setStatus("connected");
        },
        onDisconnect: () => {
          console.log("Disconnected");
          setStatus("ended");
        },
        onMessage: (message) => {
          // message: { source: 'ai' | 'user', message: string }
          const role = message.source === "ai" ? "agent" : "user";
          const text = message.message;

          if (role === "agent") {
            setAgentText(text);
            setChatHistory((prev) => [...prev, { role: "agent", text }]);
          } else {
            setUserText(text);
            setChatHistory((prev) => [...prev, { role: "user", text }]);
          }
        },
        onModeChange: (mode) => {
          setAgentMode(mode.mode === "speaking" ? "speaking" : "listening");
        },
        onError: (error) => {
          console.error("Conversation error:", error);
          setError(typeof error === "string" ? error : "Conversation error");
        },
      });

      conversationRef.current = conversation;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start conversation";
      setError(msg);
      setStatus("idle");
    }
  }, [resumeText, setSessionId, ctxSetAgentId]);

  const handleEnd = useCallback(async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
    }
    setStatus("ended");
    // Navigate to results with agent_id and conversation_id
    navigate("/results");
  }, [navigate]);

  // Pre-start screen
  if (status === "idle" || status === "connecting") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-10 text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-nexus-cyan/10 flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
            <Phone className="text-nexus-cyan" size={32} />
          </div>
          <h2 className="font-display text-2xl font-bold text-nexus-text mb-3">Ready to Begin?</h2>
          <p className="text-nexus-muted mb-2 text-sm leading-relaxed">
            You'll have a <span className="text-nexus-cyan font-semibold">real voice conversation</span> with an AI interviewer powered by ElevenLabs.
          </p>
          <p className="text-nexus-muted mb-4 text-xs">
            Gemini will first analyze your resume and craft personalized questions — then the voice interview begins.
          </p>

          {/* Plan summary shows while connecting */}
          {planSummary && status === "connecting" && (
            <div className="glass rounded-lg p-4 mb-4 text-left space-y-2">
              <div className="text-xs text-nexus-cyan font-display font-semibold">Interview Plan Ready</div>
              <p className="text-xs text-nexus-text/80">{planSummary.candidate_summary}</p>
              <div className="flex gap-3 text-[10px] text-nexus-muted">
                <span className="px-2 py-0.5 rounded-full bg-nexus-cyan/10 text-nexus-cyan">{planSummary.target_role}</span>
                <span className="px-2 py-0.5 rounded-full bg-nexus-violet/10 text-nexus-violet">{planSummary.experience_level}</span>
                <span className="px-2 py-0.5 rounded-full bg-nexus-amber/10 text-nexus-amber">{planSummary.question_count} questions</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-nexus-red/10 border border-nexus-red/30 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs text-nexus-red">{error}</p>
            </div>
          )}

          <motion.button
            onClick={() => { setError(""); handleStart(); }}
            disabled={status === "connecting"}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-violet
              font-display font-semibold text-white disabled:opacity-50 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {status === "connecting" ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {loadingStep || "Preparing..."}
              </span>
            ) : error ? "Retry" : "Start Voice Interview"}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Active conversation or ended
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="glass border-b border-nexus-border/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-display font-bold gradient-text text-lg">NEXUS</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-nexus-green animate-pulse" : "bg-nexus-red"}`} />
            <span className="text-nexus-muted text-sm">
              {status === "connected" ? "Live Interview" : "Interview Ended"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-nexus-muted text-sm">
            <Clock size={14} />
            {formatTime(timer)}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Conversation view */}
        <div className="flex-1 p-6 flex flex-col">
          {/* AI Status */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500
              ${agentMode === "speaking" ? "bg-nexus-cyan/20 glow-cyan" : "bg-nexus-surface"}`}
            >
              {agentMode === "speaking" && (
                <div className="absolute inset-0 rounded-full animate-pulse-glow" />
              )}
              <div className="flex gap-0.5 items-end h-7">
                {[...Array(7)].map((_, i) => (
                  <motion.div
                    key={i}
                    className={`w-1 rounded-full ${agentMode === "speaking" ? "bg-nexus-cyan" : "bg-nexus-muted/30"}`}
                    animate={agentMode === "speaking" ? {
                      height: [6, 22, 6],
                    } : { height: 6 }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.08,
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="font-display font-semibold text-nexus-text">AI Interviewer</div>
              <div className="text-sm" style={{ color: agentMode === "speaking" ? "#06d6a0" : "#f59e0b" }}>
                {agentMode === "speaking" ? "Speaking..." : "Listening to you..."}
              </div>
            </div>
          </div>

          {/* Latest agent message */}
          {agentText && (
            <motion.div
              key={agentText}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5 mb-4"
            >
              <p className="font-display text-nexus-text leading-relaxed">{agentText}</p>
            </motion.div>
          )}

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {chatHistory.slice(0, -1).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: msg.role === "agent" ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : ""}`}
              >
                <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                  msg.role === "agent"
                    ? "bg-nexus-surface/50 text-nexus-muted"
                    : "bg-nexus-cyan/10 text-nexus-text/80 border border-nexus-cyan/20"
                }`}>
                  <div className="text-[10px] uppercase tracking-wider mb-1 opacity-50">
                    {msg.role === "agent" ? "Interviewer" : "You"}
                  </div>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </motion.div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Right: Controls */}
        <div className="lg:w-80 p-6 flex flex-col items-center justify-center gap-6 border-t lg:border-t-0 lg:border-l border-nexus-border/30">
          {/* Mic status indicator */}
          <div className="relative">
            {agentMode === "listening" && status === "connected" && (
              <>
                <div className="absolute inset-0 rounded-full bg-nexus-cyan/20 animate-ripple" />
                <div className="absolute inset-0 rounded-full bg-nexus-cyan/10 animate-ripple" style={{ animationDelay: "0.5s" }} />
              </>
            )}
            <div className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500
              ${agentMode === "listening" && status === "connected"
                ? "bg-gradient-to-br from-nexus-cyan to-nexus-violet glow-cyan"
                : agentMode === "speaking"
                  ? "bg-nexus-surface border-2 border-nexus-cyan/30"
                  : "bg-nexus-surface/50"
              }`}
            >
              {agentMode === "listening" && status === "connected" ? (
                <Mic size={36} className="text-white" />
              ) : agentMode === "speaking" ? (
                <Volume2 size={36} className="text-nexus-cyan" />
              ) : (
                <MicOff size={36} className="text-nexus-muted" />
              )}
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-display font-semibold text-nexus-text">
              {agentMode === "listening" && status === "connected" ? "Your turn — speak now" :
               agentMode === "speaking" ? "AI is speaking" : "Interview ended"}
            </p>
            <p className="text-xs text-nexus-muted mt-1">
              {status === "connected" ? "Just talk naturally, like a real interview" : ""}
            </p>
          </div>

          {/* Current user speech */}
          {userText && (
            <div className="w-full glass rounded-xl p-4">
              <div className="text-xs text-nexus-muted mb-2 font-display">Your last answer</div>
              <p className="text-sm text-nexus-text/80 leading-relaxed">{userText}</p>
            </div>
          )}

          {/* End interview button */}
          {status === "connected" && (
            <motion.button
              onClick={handleEnd}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-nexus-red/10 text-nexus-red
                border border-nexus-red/30 hover:bg-nexus-red/20 transition-all font-display font-semibold text-sm"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <PhoneOff size={16} />
              End Interview
            </motion.button>
          )}

          {status === "ended" && (
            <motion.button
              onClick={() => navigate("/results")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-violet
                font-display font-semibold text-white"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              See Results
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
