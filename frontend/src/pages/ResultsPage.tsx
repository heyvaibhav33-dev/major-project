import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Trophy, RotateCcw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useInterview } from "../context/InterviewContext";
import { getAnalysisStream } from "../lib/api";

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v * 10) / 10);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(motionVal, value, { duration, ease: "easeOut" });
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => { controls.stop(); unsub(); };
  }, [value, duration, motionVal, rounded]);

  return <>{display}</>;
}

/* ─── Semi-circular Gauge (rated /10) ─── */
function ScoreGauge({ score100 }: { score100: number }) {
  const score10 = score100 / 10;
  const clampedScore = Math.min(10, Math.max(0, score10));
  const percentage = clampedScore / 10;

  const cx = 150, cy = 140, r = 110;
  const startAngle = Math.PI;
  const totalAngle = Math.PI;

  const bgStartX = cx + r * Math.cos(startAngle);
  const bgStartY = cy - r * Math.sin(startAngle);
  const bgEndX = cx + r * Math.cos(0);
  const bgEndY = cy - r * Math.sin(0);
  const bgPath = `M ${bgStartX} ${bgStartY} A ${r} ${r} 0 0 1 ${bgEndX} ${bgEndY}`;

  const activeAngle = startAngle - totalAngle * percentage;
  const activeEndX = cx + r * Math.cos(activeAngle);
  const activeEndY = cy - r * Math.sin(activeAngle);
  const largeArc = percentage > 0.5 ? 1 : 0;
  const activePath = `M ${bgStartX} ${bgStartY} A ${r} ${r} 0 ${largeArc} 1 ${activeEndX} ${activeEndY}`;

  const needleLen = r - 15;

  const getColor = (s: number) => {
    if (s >= 8) return { main: "#06d6a0", label: "Excellent" };
    if (s >= 6) return { main: "#06b6d4", label: "Good" };
    if (s >= 4) return { main: "#f59e0b", label: "Average" };
    return { main: "#ef4444", label: "Needs Work" };
  };

  const colorInfo = getColor(clampedScore);

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 300 170" className="w-72 h-auto">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="65%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#06d6a0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <path d={bgPath} fill="none" stroke="#1e3a5f" strokeWidth="16" strokeLinecap="round" />

        <motion.path
          d={activePath}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth="16"
          strokeLinecap="round"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
        />

        {[...Array(11)].map((_, i) => {
          const angle = startAngle - (totalAngle * i) / 10;
          const x1 = cx + (r + 12) * Math.cos(angle);
          const y1 = cy - (r + 12) * Math.sin(angle);
          const x2 = cx + (r + 5) * Math.cos(angle);
          const y2 = cy - (r + 5) * Math.sin(angle);
          const lx = cx + (r + 24) * Math.cos(angle);
          const ly = cy - (r + 24) * Math.sin(angle);
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth={i % 5 === 0 ? 2 : 1} opacity={0.5} />
              {i % 2 === 0 && (
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                  fill="#64748b" fontSize="10" fontFamily="Sora, sans-serif">{i}</text>
              )}
            </g>
          );
        })}

        <motion.g
          initial={{ rotate: 180 }}
          animate={{ rotate: 180 - percentage * 180 }}
          transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
          <line x1={cx} y1={cy} x2={cx - needleLen} y2={cy}
            stroke={colorInfo.main} strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
          <circle cx={cx} cy={cy} r="6" fill={colorInfo.main} />
          <circle cx={cx} cy={cy} r="3" fill="#030712" />
        </motion.g>
      </svg>

      <div className="absolute bottom-2 flex flex-col items-center">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-5xl font-bold" style={{ color: colorInfo.main }}>
            <AnimatedNumber value={clampedScore} duration={2} />
          </span>
          <span className="text-xl text-nexus-muted font-display">/ 10</span>
        </div>
        <motion.span
          className="text-sm font-display font-semibold mt-1"
          style={{ color: colorInfo.main }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          {colorInfo.label}
        </motion.span>
      </div>
    </div>
  );
}

/* ─── Styled Markdown Renderer for streaming ─── */
function StreamingMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => {
          const str = String(children).toLowerCase();
          let color = "#e2e8f0";
          if (str.includes("strength")) color = "#10b981";
          else if (str.includes("weakness")) color = "#ef4444";
          else if (str.includes("improve")) color = "#f59e0b";
          else if (str.includes("question") || str.includes("breakdown")) color = "#06b6d4";
          return (
            <h2 className="font-display font-bold text-lg mt-6 mb-3 flex items-center gap-2" style={{ color }}>
              <div className="w-1.5 h-5 rounded-full" style={{ background: color }} />
              {children}
            </h2>
          );
        },
        h3: ({ children }) => (
          <h3 className="font-display font-semibold text-base mt-4 mb-2 text-nexus-text">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-nexus-text/80 leading-relaxed my-1.5">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-display font-semibold text-nexus-text">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="space-y-1.5 my-2 ml-1">{children}</ul>
        ),
        li: ({ children }) => (
          <li className="flex gap-2 text-sm text-nexus-text/85 leading-relaxed">
            <span className="text-nexus-cyan mt-1.5 text-[6px] shrink-0">●</span>
            <span>{children}</span>
          </li>
        ),
        hr: () => <hr className="border-nexus-border/30 my-5" />,
        em: ({ children }) => (
          <em className="text-nexus-muted not-italic text-xs">{children}</em>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

/* ─── Main Results Page ─── */
export default function ResultsPage() {
  const navigate = useNavigate();
  const { sessionId, agentId, reset } = useInterview();

  const [score, setScore] = useState<number | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [statusMsg, setStatusMsg] = useState("Connecting...");
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const hasFetched = useRef(false);
  const streamRef = useRef<HTMLDivElement>(null);

  // Auto-scroll as text streams in
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamedText]);

  useEffect(() => {
    if (!sessionId || !agentId || hasFetched.current) {
      if (!sessionId || !agentId) {
        setIsLoading(false);
        setError("No interview data found. Please start an interview first.");
      }
      return;
    }
    hasFetched.current = true;

    getAnalysisStream(agentId, sessionId, {
      onScore: (s) => {
        setScore(s);
        setIsLoading(false);
      },
      onToken: (text) => {
        setStreamedText((prev) => prev + text);
      },
      onStructured: () => {
        // Structured data received — could use for enhanced UI later
      },
      onStatus: (msg) => {
        setStatusMsg(msg);
      },
      onDone: () => {
        setIsDone(true);
      },
      onError: (msg) => {
        setError(msg);
        setIsLoading(false);
      },
    }).catch((e) => {
      setError(e.message || "Failed to analyze");
      setIsLoading(false);
    });
  }, [sessionId, agentId]);

  const handleTryAgain = () => {
    reset();
    navigate("/");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-nexus-border" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-nexus-cyan border-t-transparent animate-spin" />
          </div>
          <p className="font-display text-nexus-text">{statusMsg}</p>
          <p className="text-xs text-nexus-muted/60">This may take a few seconds</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error && !score) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <p className="text-nexus-red mb-4">{error}</p>
          <button onClick={handleTryAgain}
            className="px-6 py-2 rounded-lg bg-nexus-cyan/10 text-nexus-cyan font-display font-semibold text-sm border border-nexus-cyan/30">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="orb orb-cyan w-[500px] h-[500px] -top-40 -right-40 animate-float" />
      <div className="orb orb-violet w-[400px] h-[400px] bottom-20 -left-40 animate-float" style={{ animationDelay: "3s" }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-4 text-sm text-nexus-amber"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
          >
            <Trophy size={14} />
            Interview Complete
          </motion.div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-nexus-text mb-2">
            Performance <span className="gradient-text">Report</span>
          </h1>
        </motion.div>

        {/* Gauge */}
        {score !== null && (
          <motion.div
            className="flex justify-center mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <div className="glass rounded-3xl p-8 pb-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-nexus-cyan/5 to-transparent pointer-events-none" />
              <ScoreGauge score100={score} />
            </div>
          </motion.div>
        )}

        {/* Streaming analysis */}
        <motion.div
          className="glass rounded-2xl p-6 md:p-8 relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nexus-cyan via-nexus-violet to-nexus-amber" />

          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-nexus-cyan" />
            <h2 className="font-display font-bold text-nexus-text">Detailed Analysis</h2>
            {!isDone && (
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-nexus-cyan animate-pulse" />
                <span className="text-xs text-nexus-muted">Streaming...</span>
              </div>
            )}
          </div>

          <div ref={streamRef} className="max-h-[60vh] overflow-y-auto pr-2">
            <StreamingMarkdown text={streamedText} />
            {!isDone && streamedText && (
              <span className="inline-block w-0.5 h-4 bg-nexus-cyan animate-pulse ml-0.5" />
            )}
          </div>
        </motion.div>

        {/* Try again */}
        {isDone && (
          <motion.div
            className="mt-10 text-center pb-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              onClick={handleTryAgain}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-nexus-cyan to-nexus-violet
                font-display font-bold text-white inline-flex items-center gap-2.5
                hover:shadow-xl hover:shadow-nexus-cyan/20 transition-all text-lg"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              <RotateCcw size={20} />
              Try Again
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
