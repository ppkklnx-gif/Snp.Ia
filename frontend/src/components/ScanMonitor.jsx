import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "../App";
import { Zap, Square, ChevronRight, Loader, RefreshCw, AlertTriangle, Terminal as TerminalIcon, Activity } from "lucide-react";
import { SeverityBadge, StatusBadge } from "./Dashboard";

function colorLine(line) {
  if (!line.trim()) return { cls: "default", text: line };
  const l = line.toLowerCase();
  if (l.includes("[!]") || l.includes("scan complete") || l.includes("critical")) return { cls: "err", text: line };
  if (l.includes("[+]") || l.includes("open") || l.includes("found") || l.includes("ok")) return { cls: "ok", text: line };
  if (l.includes("[*]") || l.includes("running") || l.includes("checking")) return { cls: "info", text: line };
  if (l.includes("=====") || l.includes("------")) return { cls: "header", text: line };
  if (l.includes("warn") || l.includes("failed")) return { cls: "warn", text: line };
  return { cls: "default", text: line };
}

export default function ScanMonitor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [lines, setLines] = useState([]);
  const [offset, setOffset] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [findings, setFindings] = useState([]);
  const [aiMessage, setAiMessage] = useState("");
  const [aiChatInput, setAiChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const terminalRef = useRef(null);
  const pollingRef = useRef(null);

  const fetchScan = useCallback(async () => {
    const res = await fetch(`${API}/scans/${id}`);
    if (res.ok) {
      const data = await res.json();
      setScan(data);
      return data;
    }
    return null;
  }, [id]);

  const fetchOutput = useCallback(async (currentOffset) => {
    const res = await fetch(`${API}/scans/${id}/output?offset=${currentOffset}`);
    if (res.ok) {
      const data = await res.json();
      if (data.lines?.length > 0) {
        setLines(prev => [...prev, ...data.lines]);
        setOffset(data.offset);
        setTimeout(() => {
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          }
        }, 50);
      }
      return data;
    }
    return null;
  }, [id]);

  const fetchFindings = useCallback(async () => {
    const res = await fetch(`${API}/scans/${id}/findings`);
    if (res.ok) setFindings(await res.json());
  }, [id]);

  useEffect(() => {
    fetchScan();
    fetchFindings();

    let currentOffset = 0;
    pollingRef.current = setInterval(async () => {
      const scanData = await fetchScan();
      const outputData = await fetch(`${API}/scans/${id}/output?offset=${currentOffset}`).then(r => r.json()).catch(() => null);
      if (outputData?.lines?.length > 0) {
        setLines(prev => [...prev, ...outputData.lines]);
        currentOffset = outputData.offset;
        setTimeout(() => {
          if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }, 50);
      }
      if (outputData?.status === "completed" || outputData?.status === "failed" || outputData?.status === "stopped") {
        clearInterval(pollingRef.current);
        fetchFindings();
      }
    }, 1000);

    return () => clearInterval(pollingRef.current);
  }, [id]);

  const stopScan = async () => {
    await fetch(`${API}/scans/${id}/stop`, { method: "POST" });
    fetchScan();
  };

  const analyzeWithAI = async () => {
    setAnalyzing(true);
    setAiMessage("Kimi AI is analyzing scan results...");
    try {
      const res = await fetch(`${API}/scans/${id}/analyze`, { method: "POST" });
      if (res.ok) {
        setAiMessage("Analysis started! Generating attack plan...");
        setTimeout(() => {
          navigate(`/scan/${id}/plan`);
        }, 2000);
      }
    } catch (e) {
      setAiMessage("Analysis failed. Try again.");
    }
    setAnalyzing(false);
  };

  const sendAiChat = async () => {
    if (!aiChatInput.trim()) return;
    setChatLoading(true);
    const msg = aiChatInput;
    setAiChatInput("");
    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, scan_id: id })
      });
      const data = await res.json();
      setAiMessage(data.response);
    } catch (e) {
      setAiMessage("AI chat failed.");
    }
    setChatLoading(false);
  };

  const sevCount = (sev) => findings.filter(f => f.severity === sev).length;

  if (!scan) return (
    <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 8 }}>
      <Loader size={16} color="#00FF41" style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ fontFamily: "JetBrains Mono", color: "#94A3B8" }}>Loading scan...</span>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #1A2235", background: "#05070A", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <TerminalIcon size={16} color="#00FF41" />
        <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, color: "#E2E8F0" }}>{scan.target}</span>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#94A3B8" }}>/ {scan.mode?.toUpperCase()} / {scan.workspace}</span>
        <StatusBadge status={scan.status} />
        {scan.demo && <span style={{ fontSize: 10, color: "#FFB020", fontFamily: "JetBrains Mono", background: "rgba(255,176,32,0.1)", border: "1px solid rgba(255,176,32,0.3)", padding: "1px 6px" }}>DEMO</span>}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {scan.status === "running" && (
            <button className="btn-danger" data-testid="stop-scan-btn" onClick={stopScan} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
              <Square size={11} /> STOP
            </button>
          )}
          {(scan.status === "completed" || scan.status === "failed") && (
            <button className="btn-primary" data-testid="analyze-ai-btn" onClick={analyzeWithAI} disabled={analyzing}>
              {analyzing ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />}
              {analyzing ? "ANALYZING..." : "ANALYZE WITH AI"}
            </button>
          )}
          {scan.has_plan && (
            <button className="btn-secondary" data-testid="view-plan-btn" onClick={() => navigate(`/scan/${id}/plan`)}>
              <ChevronRight size={12} /> ATTACK PLAN
            </button>
          )}
          {(scan.status === "completed") && (
            <button
              data-testid="chain-attack-monitor-btn"
              onClick={() => navigate(`/scan/${id}/plan`)}
              style={{ background: "rgba(255,176,32,0.08)", border: "1px solid rgba(255,176,32,0.4)", color: "#FFB020", cursor: "pointer", padding: "7px 14px", fontSize: 11, fontFamily: "JetBrains Mono", display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={12} /> CHAIN ATTACK
            </button>
          )}
        </div>
      </div>

      {/* Main Split */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "60% 40%", overflow: "hidden" }}>
        {/* Terminal */}
        <div style={{ borderRight: "1px solid #1A2235", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 12px", background: "#000", borderBottom: "1px solid #1A2235", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF3B30" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFB020" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF41" }} />
            <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "JetBrains Mono", marginLeft: 8 }}>
              sniper -t {scan.target} -m {scan.mode} -w {scan.workspace}
            </span>
          </div>
          <div ref={terminalRef} className="terminal" style={{ flex: 1, overflow: "auto" }}
            data-testid="terminal-output">
            {lines.length === 0 ? (
              <div style={{ color: "#94A3B8" }}>
                <span className="cursor-blink">Waiting for scan output</span>
              </div>
            ) : lines.map((line, i) => {
              const { cls, text } = colorLine(line);
              return <div key={i} className={`terminal-line ${cls}`}>{text || "\u00A0"}</div>;
            })}
            {scan.status === "running" && (
              <div className="terminal-line ok cursor-blink"> </div>
            )}
          </div>
        </div>

        {/* AI Panel */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Findings summary */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1A2235", background: "#111622" }}>
            <div className="section-label" style={{ marginBottom: 10 }}>LIVE INTELLIGENCE</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["CRIT", sevCount("CRITICAL"), "#FF3B30"], ["HIGH", sevCount("HIGH"), "#FF5A00"], ["MED", sevCount("MEDIUM"), "#FFB020"], ["LOW", sevCount("LOW"), "#4299E1"]].map(([label, count, color]) => (
                <div key={label} style={{ flex: 1, background: "#0D1117", border: "1px solid #1A2235", padding: "6px 8px", textAlign: "center" }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 700, color }}>{count}</div>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent findings */}
          <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
            <div className="section-label" style={{ marginBottom: 10 }}>DETECTED FINDINGS</div>
            {findings.length === 0 && scan.status === "running" && (
              <div style={{ textAlign: "center", padding: 24, color: "#94A3B8", fontSize: 11, fontFamily: "JetBrains Mono" }}>
                <Loader size={16} color="#00FF41" style={{ animation: "spin 1s linear infinite", marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                Scanning in progress...
              </div>
            )}
            {findings.slice(0, 12).map((f, i) => (
              <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: "#0D1117", border: "1px solid #1A2235" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#E2E8F0", flex: 1 }}>{f.title}</span>
                  <SeverityBadge severity={f.severity} />
                </div>
                {f.cve && <div style={{ fontSize: 10, color: "#FF5A00", fontFamily: "JetBrains Mono", marginTop: 3 }}>{f.cve}</div>}
              </div>
            ))}
          </div>

          {/* AI Message */}
          {aiMessage && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #1A2235", background: "rgba(0,255,65,0.04)", maxHeight: 160, overflow: "auto" }}>
              <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", marginBottom: 6 }}>KIMI AI</div>
              <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>{aiMessage}</div>
            </div>
          )}

          {/* AI Chat */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #1A2235", background: "#111622", display: "flex", gap: 8 }}>
            <input className="input-dark" data-testid="ai-chat-input"
              value={aiChatInput} onChange={e => setAiChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendAiChat()}
              placeholder="Ask AI about this scan..." style={{ flex: 1, fontSize: 12, padding: "7px 10px" }} />
            <button className="btn-primary" data-testid="ai-chat-send" onClick={sendAiChat} disabled={chatLoading} style={{ padding: "7px 12px" }}>
              {chatLoading ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
