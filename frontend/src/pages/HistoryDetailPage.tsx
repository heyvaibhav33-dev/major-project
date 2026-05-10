import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Sparkles, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase, type InterviewHistoryRow } from "../lib/supabase";

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
        ul: ({ children }) => <ul className="space-y-1.5 my-2 ml-1">{children}</ul>,
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

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<InterviewHistoryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("interview_history")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (err) setError(err.message);
      else setRow(data as InterviewHistoryRow);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-nexus-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <p className="text-nexus-red mb-4">{error || "Interview not found."}</p>
          <Link
            to="/history"
            className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-nexus-cyan/10 text-nexus-cyan font-display font-semibold text-sm border border-nexus-cyan/30"
          >
            <ArrowLeft size={14} /> Back to history
          </Link>
        </div>
      </div>
    );
  }

  const score10 =
    row.overall_score != null ? (row.overall_score / 10).toFixed(1) : null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="orb orb-cyan w-[500px] h-[500px] -top-40 -right-40 animate-float" />
      <div className="orb orb-violet w-[400px] h-[400px] bottom-20 -left-40 animate-float" style={{ animationDelay: "3s" }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-sm text-nexus-muted hover:text-nexus-cyan mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to history
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-nexus-amber/10 flex items-center justify-center shrink-0">
              <Trophy className="text-nexus-amber" size={22} />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-nexus-text">
                {row.target_role || "Interview Session"}
              </h1>
              <p className="text-xs text-nexus-muted mt-1">
                {new Date(row.created_at).toLocaleString()}
              </p>
              {row.candidate_summary && (
                <p className="text-sm text-nexus-text/70 mt-3 leading-relaxed">
                  {row.candidate_summary}
                </p>
              )}
            </div>
            {score10 && (
              <div className="text-right">
                <div className="font-display text-3xl font-bold gradient-text">{score10}</div>
                <div className="text-[10px] text-nexus-muted uppercase tracking-wider">/ 10</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 md:p-8 mb-6 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nexus-cyan via-nexus-violet to-nexus-amber" />
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-nexus-cyan" />
            <h2 className="font-display font-bold text-nexus-text">Detailed Analysis</h2>
          </div>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <StreamingMarkdown text={row.analysis_markdown} />
          </div>
        </motion.div>

        {/* Transcript */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-nexus-violet" />
            <h2 className="font-display font-bold text-nexus-text">Conversation Transcript</h2>
          </div>
          <pre className="text-xs text-nexus-text/75 whitespace-pre-wrap font-mono leading-relaxed max-h-[50vh] overflow-y-auto">
            {row.transcript}
          </pre>
        </motion.div>
      </div>
    </div>
  );
}
