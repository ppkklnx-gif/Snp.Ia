import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "../App";
import { Zap, Copy, Check, ChevronRight, Loader, AlertTriangle, Shield, Target, Activity } from "lucide-react";
import ChainAttack from "./ChainAttack";

const PRIORITY_COLORS = { CRITICAL: "#FF3B30", HIGH: "#FF5A00", MEDIUM: "#FFB020", LOW: "#4299E1" };
const RISK_COLORS = { CRITICAL: "#FF3B30", HIGH: "#FF5A00", MEDIUM: "#FFB020", LOW: "#4299E1", INFO: "#94A3B8", UNKNOWN: "#94A3B8" };

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{ background: "transparent", border: "1px solid #1A2235", color: copied ? "#00FF41" : "#94A3B8", cursor: "pointer", padding: "3px 8px", fontSize: 10, fontFamily: "JetBrains Mono", display: "flex", alignItems: "center", gap: 4, transition: "all 150ms" }}>
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

function CommandBlock({ cmd, scanId }) {
  const navigate = useNavigate();
  const [executing, setExecuting] = useState(false);

  const executeCommand = async () => {
    // Parse command to extract target/mode/workspace
    const parts = cmd.match(/sniper\s+-t\s+(\S+)\s+-m\s+(\S+)(?:\s+-w\s+(\S+))?/);
    if (!parts) return;

    setExecuting(true);
    try {
      const res = await fetch(`${API}/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: parts[1],
          mode: parts[2],
          workspace: parts[3] || parts[1].replace(/[^a-zA-Z0-9_-]/g, "_")
        })
      });
      if (res.ok) {
        const scan = await res.json();
        navigate(`/scan/${scan.id}`);
      }
    } catch (e) { }
    setExecuting(false);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#000", border: "1px solid #1A2235", borderLeft: "3px solid #00FF41", padding: "8px 12px" }}>
        <code style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "#00FF41", flex: 1 }}>{cmd}</code>
        <div style={{ display: "flex", gap: 6, marginLeft: 12, flexShrink: 0 }}>
          <CopyButton text={cmd} />
          <button onClick={executeCommand} disabled={executing}
            style={{ background: executing ? "transparent" : "rgba(0,255,65,0.1)", border: "1px solid rgba(0,255,65,0.3)", color: "#00FF41", cursor: "pointer", padding: "3px 10px", fontSize: 10, fontFamily: "JetBrains Mono", display: "flex", alignItems: "center", gap: 4, transition: "all 150ms" }}>
            {executing ? <Loader size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Target size={10} />}
            {executing ? "LAUNCHING..." : "EXECUTE"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttackPlan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [showChain, setShowChain] = useState(false);

  const fetchPlan = async () => {
    const [planRes, scanRes] = await Promise.all([
      fetch(`${API}/scans/${id}/plan`),
      fetch(`${API}/scans/${id}`)
    ]);
    if (planRes.ok) setPlan(await planRes.json());
    if (scanRes.ok) setScan(await scanRes.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchPlan();
  }, [id]);

  useEffect(() => {
    if (plan?.status === "not_ready" || !plan?.attack_phases) {
      const timer = setTimeout(() => {
        fetchPlan();
        setPollCount(p => p + 1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [plan, pollCount]);

  const triggerAnalysis = async () => {
    setAnalyzing(true);
    await fetch(`${API}/scans/${id}/analyze`, { method: "POST" });
    setTimeout(() => { fetchPlan(); setAnalyzing(false); }, 4000);
  };

  if (loading) return (
    <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 8 }}>
      <Loader size={16} color="#00FF41" style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ fontFamily: "JetBrains Mono", color: "#94A3B8" }}>Loading attack plan...</span>
    </div>
  );

  const isNotReady = plan?.status === "not_ready" || !plan?.attack_phases;

  return (
    <div style={{ padding: 24, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 16, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>KIMI AI ANALYSIS</div>
          <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>
            Attack Execution Plan
            {scan && <span style={{ fontSize: 14, color: "#94A3B8", fontWeight: 400 }}> — {scan.target}</span>}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" data-testid="back-to-scan-btn" onClick={() => navigate(`/scan/${id}`)}>
            <ChevronRight size={12} style={{ transform: "rotate(180deg)" }} /> BACK TO SCAN
          </button>
          <button
            data-testid="chain-attack-btn"
            onClick={() => setShowChain(v => !v)}
            style={{ background: showChain ? "rgba(255,176,32,0.1)" : "transparent", border: "1px solid rgba(255,176,32,0.4)", color: "#FFB020", cursor: "pointer", padding: "7px 14px", fontSize: 11, fontFamily: "JetBrains Mono", display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={12} /> {showChain ? "OCULTAR CHAIN" : "CHAIN ATTACK"}
          </button>
          <button className="btn-primary" data-testid="reanalyze-btn" onClick={triggerAnalysis} disabled={analyzing}>
            {analyzing ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />}
            {analyzing ? "ANALYZING..." : "RE-ANALYZE"}
          </button>
        </div>
      </div>

      {/* Chain Attack Panel */}
      {showChain && (
        <div style={{ marginBottom: 24 }} className="fade-in">
          <ChainAttack scanId={id} onClose={() => setShowChain(false)} />
        </div>
      )}

      {/* Not ready state */}
      {isNotReady && (
        <div data-testid="plan-not-ready" style={{ textAlign: "center", padding: "64px 24px" }}>
          {analyzing ? (
            <>
              <div className="ai-thinking" style={{ display: "inline-block", padding: "24px 32px", marginBottom: 16 }}>
                <Loader size={32} color="#00FF41" style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} />
              </div>
              <div style={{ fontSize: 14, color: "#00FF41", fontFamily: "JetBrains Mono" }}>Kimi AI is generating your attack plan...</div>
            </>
          ) : (
            <>
              <Zap size={40} color="#1A2235" style={{ margin: "0 auto 16px" }} />
              <div style={{ fontSize: 14, color: "#94A3B8", fontFamily: "JetBrains Mono", marginBottom: 16 }}>
                No attack plan generated yet.
              </div>
              <button className="btn-primary" data-testid="generate-plan-btn" onClick={triggerAnalysis}>
                <Zap size={13} /> GENERATE ATTACK PLAN
              </button>
            </>
          )}
        </div>
      )}

      {/* Plan content */}
      {!isNotReady && plan && (
        <div className="fade-in">
          {/* Executive Summary */}
          <div style={{ background: "#111622", border: "1px solid #1A2235", padding: 20, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 6 }}>EXECUTIVE SUMMARY</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: RISK_COLORS[plan.risk_level] || "#94A3B8" }}>
                    RISK: {plan.risk_level}
                  </span>
                  {plan.target_profile && <span style={{ fontSize: 12, color: "#94A3B8" }}>— {plan.target_profile}</span>}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#E2E8F0", lineHeight: 1.7 }}>{plan.executive_summary}</p>

            {plan.key_findings?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>KEY FINDINGS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {plan.key_findings.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <AlertTriangle size={12} color="#FF3B30" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#E2E8F0" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.immediate_next_command && (
              <div style={{ marginTop: 16 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>IMMEDIATE NEXT ACTION</div>
                <CommandBlock cmd={plan.immediate_next_command} scanId={id} />
              </div>
            )}
          </div>

          {/* CVE Findings */}
          {plan.cve_findings?.length > 0 && (
            <div style={{ background: "#111622", border: "1px solid #1A2235", padding: 20, marginBottom: 24 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>CVE VULNERABILITIES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {plan.cve_findings.map((cve, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "#0D1117" }}>
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700, color: "#FF3B30", width: 140, flexShrink: 0 }}>{cve.cve}</span>
                    <span style={{ fontSize: 12, color: "#94A3B8", width: 100, flexShrink: 0 }}>{cve.service}</span>
                    <span style={{ fontSize: 11, color: "#E2E8F0" }}>{cve.description}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "JetBrains Mono", color: PRIORITY_COLORS[cve.severity] || "#94A3B8", flexShrink: 0 }}>{cve.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attack Phases */}
          <div className="section-label" style={{ marginBottom: 12 }}>ATTACK EXECUTION PHASES</div>
          {plan.attack_phases?.map((phase, idx) => (
            <div key={idx} data-testid={`phase-${idx}`} style={{ marginBottom: 16, background: "#111622", border: "1px solid #1A2235" }}>
              {/* Phase header */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #1A2235", display: "flex", alignItems: "center", gap: 12, background: "#0D1117" }}>
                <div style={{ width: 28, height: 28, background: PRIORITY_COLORS[phase.priority] || "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "JetBrains Mono", fontWeight: 800, fontSize: 12, color: "#000", flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 13, color: "#E2E8F0" }}>{phase.phase_name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{phase.expected_outcome}</div>
                </div>
                <span style={{ fontSize: 10, fontFamily: "JetBrains Mono", color: PRIORITY_COLORS[phase.priority] || "#94A3B8", border: `1px solid ${PRIORITY_COLORS[phase.priority]}40`, padding: "2px 8px", flexShrink: 0 }}>
                  {phase.priority}
                </span>
              </div>

              <div style={{ padding: 16 }}>
                {phase.rationale && (
                  <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14, lineHeight: 1.6 }}>{phase.rationale}</p>
                )}

                {phase.findings?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="section-label" style={{ marginBottom: 6 }}>EXPLOITABLE FINDINGS</div>
                    {phase.findings.map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                        <Shield size={11} color="#FF3B30" style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#E2E8F0" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="section-label" style={{ marginBottom: 8 }}>COMMANDS</div>
                {phase.commands?.map((cmd, ci) => (
                  <CommandBlock key={ci} cmd={cmd} scanId={id} />
                ))}
              </div>
            </div>
          ))}

          {/* Remediation */}
          {plan.remediation_summary && (
            <div style={{ background: "rgba(66,153,225,0.06)", border: "1px solid rgba(66,153,225,0.2)", padding: 16 }}>
              <div className="section-label" style={{ color: "#4299E1", marginBottom: 8 }}>DEFENDER REMEDIATION</div>
              <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>{plan.remediation_summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
