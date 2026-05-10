import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Phone, PhoneOff, Video, Sparkles } from "lucide-react";
import { useInterview } from "../context/InterviewContext";
import { startInterview, endInterview } from "../lib/api";

type ConvoStatus = "idle" | "connecting" | "connected" | "ended";

export default function InterviewPage() {
  const navigate = useNavigate();
  const {
    resumeText,
    conversationId,
    conversationUrl,
    setConversationId,
    setConversationUrl,
    planSummary,
    setPlanSummary,
  } = useInterview();

  const [status, setStatus] = useState<ConvoStatus>("idle");
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState("");
  const [loadingStep, setLoadingStep] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!resumeText) navigate("/");
  }, [resumeText, navigate]);

  useEffect(() => {
    if (status === "connected") {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const handleStart = useCallback(async () => {
    setStatus("connecting");
    setError("");
    setLoadingStep("Reading your resume...");

    try {
      const res = await startInterview(resumeText);
      if (res.error) {
        setError(res.error);
        setStatus("idle");
        return;
      }

      if (res.plan_summary) setPlanSummary(res.plan_summary);
      setConversationId(res.conversation_id);
      setConversationUrl(res.conversation_url);

      setLoadingStep("Connecting to your AI interviewer...");
      // The iframe will mount in render; flip to "connected" so the UI swaps
      setStatus("connected");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start the interview";
      setError(msg);
      setStatus("idle");
    }
  }, [resumeText, setConversationId, setConversationUrl, setPlanSummary]);

  const handleEnd = useCallback(async () => {
    setStatus("ended");
    if (conversationId) {
      // Best-effort end; the analyze endpoint also ends the call.
      void endInterview(conversationId);
    }
    navigate("/results");
  }, [conversationId, navigate]);

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
            <Video className="text-nexus-cyan" size={32} />
          </div>
          <h2 className="font-display text-2xl font-bold text-nexus-text mb-3">Ready to Begin?</h2>
          <p className="text-nexus-muted mb-2 text-sm leading-relaxed">
            You'll have a <span className="text-nexus-cyan font-semibold">live video conversation</span> with our AI interviewer.
          </p>
          <p className="text-nexus-muted mb-4 text-xs">
            Our system analyzes your resume and crafts personalized questions — then the video interview begins.
          </p>

          {planSummary && status === "connecting" && (
            <div className="glass rounded-lg p-4 mb-4 text-left space-y-2">
              <div className="text-xs text-nexus-cyan font-display font-semibold flex items-center gap-1.5">
                <Sparkles size={12} />
                Interview Plan Ready
              </div>
              <p className="text-xs text-nexus-text/80">{planSummary.candidate_summary}</p>
              <div className="flex gap-2 flex-wrap text-[10px] text-nexus-muted">
                <span className="px-2 py-0.5 rounded-full bg-nexus-cyan/10 text-nexus-cyan">{planSummary.target_role}</span>
                <span className="px-2 py-0.5 rounded-full bg-nexus-violet/10 text-nexus-violet">{planSummary.experience_level}</span>
                <span className="px-2 py-0.5 rounded-full bg-nexus-amber/10 text-nexus-amber">
                  {planSummary.question_count} questions
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-nexus-red/10 border border-nexus-red/30 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs text-nexus-red">{error}</p>
            </div>
          )}

          <motion.button
            onClick={() => {
              setError("");
              handleStart();
            }}
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
            ) : error ? (
              "Retry"
            ) : (
              "Start Video Interview"
            )}
          </motion.button>

          <p className="text-[10px] text-nexus-muted/70 mt-3">
            Your browser will request camera + microphone permission.
          </p>
        </motion.div>
      </div>
    );
  }

  // Live or ended: full-bleed video tile with floating controls
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-nexus-bg">
      {/* Top bar — slim, holds branding + the primary End Interview action */}
      <div className="glass border-b border-nexus-border/40 px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-display font-bold gradient-text text-lg shrink-0">NEXUS</span>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`w-2 h-2 rounded-full ${
                status === "connected" ? "bg-nexus-green animate-pulse" : "bg-nexus-red"
              }`}
            />
            <span className="text-nexus-muted text-sm font-display">
              {status === "connected" ? "Live Interview" : "Interview Ended"}
            </span>
          </div>
          {planSummary && (
            <div className="hidden md:flex items-center gap-2 text-xs min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-nexus-cyan/10 text-nexus-cyan max-w-[260px] truncate">
                {planSummary.target_role}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-nexus-violet/10 text-nexus-violet shrink-0">
                {planSummary.experience_level}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-nexus-amber/10 text-nexus-amber shrink-0">
                {planSummary.question_count} Qs
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-nexus-text font-display font-semibold text-sm tabular-nums">
            <Clock size={14} className="text-nexus-cyan" />
            {formatTime(timer)}
          </div>
          {status === "connected" ? (
            <motion.button
              onClick={handleEnd}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexus-red/10 text-nexus-red
                border border-nexus-red/30 hover:bg-nexus-red/20 hover:border-nexus-red/50
                transition-all font-display font-semibold text-sm"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <PhoneOff size={14} />
              End Interview
            </motion.button>
          ) : (
            <motion.button
              onClick={() => navigate("/results")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-violet
                font-display font-semibold text-white text-sm shadow-md shadow-nexus-cyan/20"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              See Results
            </motion.button>
          )}
        </div>
      </div>

      {/* Video area — fills remaining viewport */}
      <div className="flex-1 min-h-0 flex items-stretch justify-center px-3 md:px-6 py-3 md:py-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[1600px] relative rounded-2xl overflow-hidden"
          style={{
            boxShadow:
              "0 0 0 1px rgba(6,182,212,0.18), 0 30px 80px -20px rgba(6,182,212,0.18), 0 30px 80px -20px rgba(139,92,246,0.18)",
          }}
        >
          {/* Subtle gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-nexus-cyan via-nexus-violet to-nexus-amber z-10 pointer-events-none" />

          {conversationUrl ? (
            <iframe
              src={conversationUrl}
              allow="camera; microphone; autoplay; display-capture; fullscreen"
              className="block w-full h-full border-0 bg-black"
              title="NEXUS AI Interviewer"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-nexus-surface/40">
              <div className="flex flex-col items-center gap-3">
                <Phone className="text-nexus-muted" size={40} />
                <p className="text-nexus-muted text-sm">No active call</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
