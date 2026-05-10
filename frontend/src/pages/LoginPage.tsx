import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (session) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="orb orb-cyan w-[500px] h-[500px] -top-40 -right-40 animate-float" />
      <div className="orb orb-violet w-[400px] h-[400px] bottom-20 -left-40 animate-float" style={{ animationDelay: "3s" }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6 text-sm text-nexus-cyan">
            <Sparkles size={14} />
            Welcome back
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight mb-2">
            <span className="gradient-text">NEXUS</span>
          </h1>
          <p className="text-nexus-muted">Sign in to continue your interview prep</p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-8 w-full max-w-md space-y-4"
        >
          <div>
            <label className="text-xs font-display font-semibold text-nexus-muted block mb-2">EMAIL</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-nexus-surface/50 border border-nexus-border rounded-lg pl-10 pr-3 py-2.5 text-nexus-text text-sm
                  focus:outline-none focus:border-nexus-cyan/50 focus:bg-nexus-surface transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-display font-semibold text-nexus-muted block mb-2">PASSWORD</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" size={16} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-nexus-surface/50 border border-nexus-border rounded-lg pl-10 pr-3 py-2.5 text-nexus-text text-sm
                  focus:outline-none focus:border-nexus-cyan/50 focus:bg-nexus-surface transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="bg-nexus-red/10 border border-nexus-red/30 rounded-lg p-3">
              <p className="text-xs text-nexus-red">{error}</p>
            </div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-violet
              font-display font-semibold text-white flex items-center justify-center gap-2
              disabled:opacity-50 transition-all"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={16} />
                Sign In
              </>
            )}
          </motion.button>

          <p className="text-center text-sm text-nexus-muted pt-2">
            New here?{" "}
            <Link to="/signup" className="text-nexus-cyan hover:underline font-semibold">
              Create an account
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
