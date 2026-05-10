import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Clock,
  Trophy,
  ArrowRight,
  Trash2,
  LogOut,
  Plus,
  History as HistoryIcon,
  TrendingUp,
  Target,
  Award,
  Calendar,
} from "lucide-react";
import { supabase, type InterviewHistoryRow } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

function score10(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.round((v / 10) * 10) / 10;
}

function scoreColor(s: number | null) {
  if (s == null) return "#64748b";
  if (s >= 8) return "#06d6a0";
  if (s >= 6) return "#06b6d4";
  if (s >= 4) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(s: number | null) {
  if (s == null) return "—";
  if (s >= 8) return "Excellent";
  if (s >= 6) return "Good";
  if (s >= 4) return "Average";
  return "Needs Work";
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between mb-3 relative">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-nexus-muted font-display font-semibold mb-1">
        {label}
      </div>
      <div className="font-display text-2xl font-bold text-nexus-text">{value}</div>
      {hint && <div className="text-[11px] text-nexus-muted mt-1">{hint}</div>}
    </div>
  );
}

function SparklineChart({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) return null;
  const min = 0;
  const max = 10;
  const w = 100;
  const h = 28;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [rows, setRows] = useState<InterviewHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("interview_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else {
        setRows((data ?? []) as InterviewHistoryRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const scored = rows
      .map((r) => score10(r.overall_score))
      .filter((v): v is number => v != null);
    const avg =
      scored.length > 0
        ? scored.reduce((a, b) => a + b, 0) / scored.length
        : null;
    const best = scored.length > 0 ? Math.max(...scored) : null;
    const trendValues = [...rows]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((r) => score10(r.overall_score) ?? 0);
    const latest = rows[0]?.created_at ?? null;

    // simple trend: compare avg of last 3 vs prior 3
    let delta: number | null = null;
    if (trendValues.length >= 2) {
      const half = Math.max(1, Math.floor(trendValues.length / 2));
      const recent = trendValues.slice(-half);
      const earlier = trendValues.slice(0, -half);
      if (earlier.length > 0) {
        const r = recent.reduce((a, b) => a + b, 0) / recent.length;
        const e = earlier.reduce((a, b) => a + b, 0) / earlier.length;
        delta = r - e;
      }
    }

    return { count: rows.length, avg, best, latest, trendValues, delta };
  }, [rows]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this interview record? This cannot be undone.")) return;
    const { error: err } = await supabase.from("interview_history").delete().eq("id", id);
    if (err) {
      alert(err.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="orb orb-cyan w-[500px] h-[500px] -top-40 -right-40 animate-float" />
      <div className="orb orb-violet w-[400px] h-[400px] bottom-20 -left-40 animate-float" style={{ animationDelay: "3s" }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10"
        >
          <Link to="/" className="font-display text-2xl font-bold gradient-text">
            NEXUS
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-nexus-muted hidden sm:block">{user?.email}</span>
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg glass text-sm text-nexus-cyan hover:bg-nexus-cyan/10 transition-all"
            >
              <Plus size={14} />
              New Interview
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg glass text-sm text-nexus-muted hover:text-nexus-red transition-all"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-4 text-sm text-nexus-violet">
            <HistoryIcon size={14} />
            Dashboard
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-nexus-text">
            Welcome <span className="gradient-text">back</span>
          </h1>
          <p className="text-nexus-muted text-sm mt-2">
            Track your progress and review past interviews.
          </p>
        </motion.div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-nexus-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl p-6 border border-nexus-red/30">
            <p className="text-nexus-red text-sm">{error}</p>
            <p className="text-nexus-muted text-xs mt-2">
              Make sure the migration in <code>supabase/migrations/0001_init.sql</code> has been applied.
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats grid */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <StatCard
                icon={Target}
                color="#06b6d4"
                label="Total Interviews"
                value={String(stats.count)}
                hint={stats.count === 0 ? "Take your first" : "completed"}
              />
              <StatCard
                icon={TrendingUp}
                color="#8b5cf6"
                label="Average Score"
                value={stats.avg != null ? `${stats.avg.toFixed(1)} / 10` : "—"}
                hint={
                  stats.delta != null
                    ? `${stats.delta >= 0 ? "▲" : "▼"} ${Math.abs(stats.delta).toFixed(1)} vs earlier`
                    : "Awaiting more data"
                }
              />
              <StatCard
                icon={Award}
                color="#06d6a0"
                label="Best Score"
                value={stats.best != null ? `${stats.best.toFixed(1)} / 10` : "—"}
                hint={stats.best != null ? scoreLabel(stats.best) : "—"}
              />
              <StatCard
                icon={Calendar}
                color="#f59e0b"
                label="Last Interview"
                value={stats.latest ? timeAgo(stats.latest) : "—"}
                hint={stats.latest ? new Date(stats.latest).toLocaleDateString() : "Never"}
              />
            </motion.div>

            {/* Trend sparkline */}
            {stats.trendValues.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass rounded-2xl p-5 mb-8"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-nexus-muted font-display font-semibold">
                      Score Trend
                    </div>
                    <div className="text-sm text-nexus-text">
                      Across {stats.trendValues.length} sessions
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-nexus-muted">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#06b6d4" }} />
                    score / 10
                  </div>
                </div>
                <SparklineChart values={stats.trendValues} color="#06b6d4" />
                <div className="flex justify-between text-[10px] text-nexus-muted mt-1">
                  <span>oldest</span>
                  <span>latest</span>
                </div>
              </motion.div>
            )}

            {/* List header */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-between mb-3"
            >
              <h2 className="font-display font-bold text-nexus-text">Recent Sessions</h2>
              <span className="text-xs text-nexus-muted">{rows.length} total</span>
            </motion.div>

            {rows.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-2xl p-12 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-nexus-cyan/10 flex items-center justify-center mx-auto mb-4">
                  <HistoryIcon className="text-nexus-cyan" size={28} />
                </div>
                <h3 className="font-display font-semibold text-nexus-text mb-2">No interviews yet</h3>
                <p className="text-sm text-nexus-muted mb-6">Take your first practice interview to see it here.</p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-violet font-display font-semibold text-white"
                >
                  Start Interview
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {rows.map((row, i) => {
                  const s = score10(row.overall_score);
                  const color = scoreColor(s);
                  return (
                    <motion.div
                      key={row.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="glass rounded-2xl p-5 hover:border-nexus-cyan/40 transition-all border border-transparent group"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 relative"
                          style={{ backgroundColor: `${color}15`, border: `1px solid ${color}40` }}
                        >
                          <Trophy size={14} style={{ color }} />
                          <div className="flex items-baseline gap-0.5 mt-0.5">
                            <span
                              className="text-base font-display font-bold"
                              style={{ color }}
                            >
                              {s != null ? s.toFixed(1) : "—"}
                            </span>
                            <span className="text-[9px] text-nexus-muted">/10</span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-display font-semibold text-nexus-text truncate">
                              {row.target_role || "Interview Session"}
                            </h3>
                            {row.experience_level && (
                              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-nexus-violet/10 text-nexus-violet">
                                {row.experience_level}
                              </span>
                            )}
                            <span
                              className="text-[10px] font-display font-semibold uppercase tracking-wider"
                              style={{ color }}
                            >
                              {scoreLabel(s)}
                            </span>
                          </div>
                          {row.candidate_summary && (
                            <p className="text-xs text-nexus-muted leading-relaxed line-clamp-1 mb-2">
                              {row.candidate_summary}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-nexus-muted">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {timeAgo(row.created_at)}
                            </span>
                            <span className="opacity-50">·</span>
                            <span>{new Date(row.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="p-2 rounded-lg hover:bg-nexus-red/10 text-nexus-muted hover:text-nexus-red transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                          <Link
                            to={`/history/${row.id}`}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-nexus-cyan/10 text-nexus-cyan text-xs font-display font-semibold hover:bg-nexus-cyan/20 transition-all"
                          >
                            View
                            <ArrowRight size={12} />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
