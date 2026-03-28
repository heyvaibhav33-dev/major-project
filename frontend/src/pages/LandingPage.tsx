import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, FileText, ArrowRight, Sparkles, Zap, Brain } from "lucide-react";
import { useInterview } from "../context/InterviewContext";
import { uploadResume } from "../lib/api";

export default function LandingPage() {
  const navigate = useNavigate();
  const { setResumeText, setResumeName, resumeText, resumeName } = useInterview();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }
    setIsUploading(true);
    setError("");
    try {
      const result = await uploadResume(file);
      setResumeText(result.text);
      setResumeName(result.name);
    } catch {
      setError("Failed to parse resume. Make sure the backend is running.");
    } finally {
      setIsUploading(false);
    }
  }, [setResumeText, setResumeName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background orbs */}
      <div className="orb orb-cyan w-[500px] h-[500px] -top-40 -right-40 animate-float" />
      <div className="orb orb-violet w-[400px] h-[400px] bottom-20 -left-40 animate-float" style={{ animationDelay: "3s" }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        {/* Logo & Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 text-sm text-nexus-cyan"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Sparkles size={14} />
            AI-Powered Interview Practice
          </motion.div>

          <h1 className="font-display text-6xl md:text-8xl font-bold tracking-tight mb-4">
            <span className="gradient-text">NEXUS</span>
          </h1>
          <p className="font-display text-xl md:text-2xl text-nexus-muted max-w-xl mx-auto leading-relaxed">
            Upload your resume. Practice with AI.
            <br />
            <span className="text-nexus-text">Ace your next interview.</span>
          </p>
        </motion.div>

        {/* Features row */}
        <motion.div
          className="flex gap-6 mb-12 flex-wrap justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {[
            { icon: Brain, label: "AI Interviewer", desc: "Gemini-powered questions" },
            { icon: Zap, label: "Voice Interaction", desc: "Natural conversation" },
            { icon: Sparkles, label: "Smart Analysis", desc: "Detailed feedback" },
          ].map((feat, i) => (
            <div key={i} className="glass rounded-xl px-5 py-4 text-center w-44">
              <feat.icon className="mx-auto mb-2 text-nexus-cyan" size={22} />
              <div className="font-display font-semibold text-sm text-nexus-text">{feat.label}</div>
              <div className="text-xs text-nexus-muted mt-1">{feat.desc}</div>
            </div>
          ))}
        </motion.div>

        {/* Upload area */}
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          {!resumeText ? (
            <label
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`
                relative block rounded-2xl border-2 border-dashed p-12 cursor-pointer
                transition-all duration-300 text-center
                ${isDragging
                  ? "border-nexus-cyan bg-nexus-cyan/5 glow-cyan"
                  : "border-nexus-border hover:border-nexus-cyan/50 bg-nexus-surface/50"
                }
                ${isUploading ? "pointer-events-none opacity-60" : ""}
              `}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="hidden"
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-nexus-cyan border-t-transparent rounded-full animate-spin" />
                  <span className="text-nexus-muted">Parsing resume...</span>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-nexus-cyan/10 flex items-center justify-center mx-auto mb-4">
                    <Upload className="text-nexus-cyan" size={28} />
                  </div>
                  <div className="font-display font-semibold text-nexus-text mb-2">
                    Drop your resume here
                  </div>
                  <div className="text-sm text-nexus-muted">
                    or click to browse — PDF format
                  </div>
                </>
              )}
            </label>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-nexus-green/10 flex items-center justify-center">
                  <FileText className="text-nexus-green" size={24} />
                </div>
                <div className="text-left flex-1">
                  <div className="font-display font-semibold text-nexus-text">{resumeName}</div>
                  <div className="text-sm text-nexus-muted">
                    {resumeText.length} characters parsed
                  </div>
                </div>
                <button
                  onClick={() => { setResumeText(""); setResumeName(""); }}
                  className="text-xs text-nexus-muted hover:text-nexus-red transition-colors"
                >
                  Remove
                </button>
              </div>

              <div className="bg-nexus-bg/50 rounded-lg p-3 max-h-32 overflow-y-auto mb-4">
                <p className="text-xs text-nexus-muted leading-relaxed whitespace-pre-wrap">
                  {resumeText.slice(0, 500)}
                  {resumeText.length > 500 && "..."}
                </p>
              </div>

              <motion.button
                onClick={() => navigate("/interview")}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-violet
                  font-display font-semibold text-white flex items-center justify-center gap-2
                  hover:shadow-lg hover:shadow-nexus-cyan/20 transition-all duration-300"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Start Interview
                <ArrowRight size={18} />
              </motion.button>
            </motion.div>
          )}

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-nexus-red text-sm mt-3 text-center"
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
