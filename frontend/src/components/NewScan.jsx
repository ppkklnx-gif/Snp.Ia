import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../App";
import { Zap, Target, ChevronRight, Loader, AlertTriangle, Check } from "lucide-react";

const MODES = [
  { value: "normal", label: "NORMAL", desc: "Standard scan: DNS, ports, per-service nmap+MSF" },
  { value: "stealth", label: "STEALTH", desc: "Non-intrusive, avoids WAF/IPS detection" },
  { value: "web", label: "WEB", desc: "Full web app scan: nikto, dirb, HTTP headers, SSL" },
  { value: "webscan", label: "WEBSCAN", desc: "Advanced: Burpsuite + Arachni + OWASP ZAP" },
  { value: "fullportonly", label: "FULLPORT", desc: "Complete port scan 1-65535 with XML output" },
  { value: "vulnscan", label: "VULNSCAN", desc: "OpenVAS/GVM CVE assessment with CVSS scoring" },
  { value: "nuke", label: "NUKE", desc: "FULL audit: all options, MSF exploits, bruteforce" },
  { value: "discover", label: "DISCOVER", desc: "CIDR subnet scan - maps all live hosts" },
  { value: "airstrike", label: "AIRSTRIKE", desc: "Quick ports + fingerprinting on multiple hosts" },
];

// Limpia el target: quita http://, https://, espacios y slash final
function cleanTarget(raw) {
  return raw.trim()
    .replace(/^https?:\/\//i, "")   // quita http:// o https://
    .replace(/\/+$/, "")             // quita slash al final
    .split("/")[0];                  // solo el hostname (sin path)
}

export default function NewScan() {
  const navigate = useNavigate();
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState("normal");
  const [workspace, setWorkspace] = useState("");
  const [options, setOptions] = useState({ osint: false, recon: false, bruteforce: false, full_port: false });
  const [recommendation, setRecommendation] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const getRecommendation = async () => {
    if (!target.trim()) return;
    setRecLoading(true);
    setRecommendation(null);
    setError("");
    const cleaned = cleanTarget(target);
    try {
      const res = await fetch(`${API}/ai/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: cleaned })
      });
      const data = await res.json();
      setRecommendation(data);
      if (data.recommended_mode) setMode(data.recommended_mode);
      if (data.recommended_options) setOptions(data.recommended_options);
    } catch (e) {
      setError("Error conectando con el servidor AI. Verifica que el backend está corriendo.");
    }
    setRecLoading(false);
  };

  const launchScan = async () => {
    if (!target.trim()) { setError("Debes ingresar un objetivo"); return; }
    setLaunching(true);
    setError("");
    const cleaned = cleanTarget(target);
    const ws = workspace.trim() || cleaned.replace(/[^a-zA-Z0-9_-]/g, "_");
    try {
      const res = await fetch(`${API}/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: cleaned, mode, workspace: ws, options })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error del servidor (${res.status})`);
      }
      const scan = await res.json();
      navigate(`/scan/${scan.id}`);
    } catch (e) {
      setError(e.message.includes("fetch") ? "No se puede conectar al backend. ¿Está corriendo en puerto 8001?" : e.message);
      setLaunching(false);
    }
  };

  const toggleOption = (key) => setOptions(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ padding: 24, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>OFFENSIVE OPS</div>
        <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>Launch New Scan</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* LEFT: Config */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Target */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Target</label>
            <input className="input-dark" data-testid="target-input"
              value={target} onChange={e => setTarget(e.target.value)}
              placeholder="192.168.1.1 | finsq.ens.uabc.mx | 10.0.0.0/24"
              onKeyDown={e => e.key === "Enter" && getRecommendation()}
              style={{ fontSize: 14 }} />
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
              IP, dominio o CIDR — el https:// se quita automáticamente
              {target && cleanTarget(target) !== target.trim() && (
                <span style={{ color: "#00FF41", marginLeft: 8 }}>
                  → se usará: <strong>{cleanTarget(target)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Scan Mode</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#1A2235" }}>
              {MODES.map(m => (
                <div key={m.value} data-testid={`mode-${m.value}`}
                  onClick={() => setMode(m.value)}
                  style={{
                    padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                    background: mode === m.value ? "rgba(0,255,65,0.08)" : "#111622",
                    borderLeft: mode === m.value ? "3px solid #00FF41" : "3px solid transparent",
                    transition: "all 150ms"
                  }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700, color: mode === m.value ? "#00FF41" : "#E2E8F0", width: 80 }}>{m.label}</span>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{m.desc}</span>
                  {mode === m.value && <Check size={12} color="#00FF41" style={{ marginLeft: "auto" }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Attack Options</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#1A2235" }}>
              {[
                { key: "osint", label: "OSINT", desc: "theHarvester, Shodan, Censys" },
                { key: "recon", label: "RECON", desc: "subfinder, amass, massdns" },
                { key: "bruteforce", label: "BRUTEFORCE", desc: "Hydra, Medusa auth attacks" },
                { key: "full_port", label: "FULLPORT", desc: "Scan all 65535 ports" },
              ].map(opt => (
                <div key={opt.key} data-testid={`opt-${opt.key}`}
                  onClick={() => toggleOption(opt.key)}
                  style={{
                    padding: "10px 12px", cursor: "pointer", background: options[opt.key] ? "rgba(0,255,65,0.08)" : "#111622",
                    borderLeft: options[opt.key] ? "2px solid #00FF41" : "2px solid transparent", transition: "all 150ms"
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, border: options[opt.key] ? "none" : "1px solid #1A2235", background: options[opt.key] ? "#00FF41" : "transparent", flexShrink: 0 }} />
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700, color: options[opt.key] ? "#00FF41" : "#E2E8F0" }}>{opt.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Workspace */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Workspace Name</label>
            <input className="input-dark" data-testid="workspace-input"
              value={workspace} onChange={e => setWorkspace(e.target.value)}
              placeholder="Auto-generated from target" />
          </div>

          {error && (
            <div style={{ padding: "8px 12px", background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.3)", fontSize: 12, color: "#FF3B30", fontFamily: "JetBrains Mono" }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" data-testid="ai-recommend-btn"
              onClick={getRecommendation} disabled={!target.trim() || recLoading}
              style={{ flex: 1 }}>
              {recLoading ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={13} />}
              {recLoading ? "ANALYZING..." : "AI RECOMMEND"}
            </button>
            <button className="btn-primary" data-testid="launch-scan-btn"
              onClick={launchScan} disabled={launching || !target.trim()}
              style={{ flex: 2 }}>
              {launching ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Target size={13} />}
              {launching ? "LAUNCHING..." : "LAUNCH SCAN"}
            </button>
          </div>
        </div>

        {/* RIGHT: AI Recommendation */}
        <div style={{ background: "#111622", border: "1px solid #1A2235", padding: 20 }}>
          <div className="section-label" style={{ marginBottom: 16 }}>AI STRATEGY ANALYSIS</div>

          {!recommendation && !recLoading && (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <Zap size={32} color="#1A2235" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>
                Ingresa un objetivo y haz click en AI RECOMMEND para obtener una estrategia de ataque inteligente.
              </div>
            </div>
          )}

          {recLoading && (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <Loader size={24} color="#00FF41" style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: 12, color: "#00FF41", fontFamily: "JetBrains Mono" }}>Kimi AI analyzing target...</div>
            </div>
          )}

          {recommendation && !recLoading && (
            <div className="fade-in">
              {/* Risk level */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>RISK POSTURE:</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700, color: recommendation.risk_level === "AGGRESSIVE" ? "#FF3B30" : "#FFB020" }}>
                  {recommendation.risk_level}
                </span>
              </div>

              <div style={{ fontSize: 13, color: "#E2E8F0", marginBottom: 16, lineHeight: 1.6 }}>{recommendation.rationale}</div>

              <div style={{ marginBottom: 16 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>RECOMMENDED CHAIN</div>
                {recommendation.scan_chain?.map((step, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div className="code-block" style={{ marginBottom: 4 }}>{step.command}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4 }}>{step.purpose}</div>
                  </div>
                ))}
              </div>

              {recommendation.expected_findings?.length > 0 && (
                <div>
                  <div className="section-label" style={{ marginBottom: 8 }}>EXPECTED FINDINGS</div>
                  {recommendation.expected_findings.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                      <ChevronRight size={12} color="#00FF41" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16, padding: "8px 12px", background: "rgba(0,255,65,0.05)", border: "1px solid rgba(0,255,65,0.2)", fontSize: 11, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>
                EST. DURATION: <span style={{ color: "#E2E8F0" }}>{recommendation.estimated_duration}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
