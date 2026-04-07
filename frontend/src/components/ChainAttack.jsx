import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "../App";
import { Zap, Loader, ChevronRight, Activity, Check, AlertTriangle } from "lucide-react";
import { StatusBadge } from "./Dashboard";

function colorChainLine(line) {
  if (!line.trim()) return "#94A3B8";
  const l = line.toLowerCase();
  if (l.includes("[error]") || l.includes("failed")) return "#FF3B30";
  if (l.includes("complete") || l.includes("[+]")) return "#00FF41";
  if (l.includes("launching") || l.includes("next_scan")) return "#FFB020";
  if (l.includes("[chain step")) return "#4299E1";
  return "#94A3B8";
}

export default function ChainAttack({ scanId: propScanId, onClose }) {
  const [chain, setChain] = useState(null);
  const [scans, setScans] = useState({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef(null);
  const scanId = propScanId;

  const fetchChain = async () => {
    const res = await fetch(`${API}/scans/${scanId}/chain`);
    if (res.ok) {
      const data = await res.json();
      setChain(data);
      // Fetch individual scans in chain
      if (data.scan_ids?.length > 0) {
        const scanData = {};
        for (const sid of data.scan_ids) {
          const sr = await fetch(`${API}/scans/${sid}`);
          if (sr.ok) scanData[sid] = await sr.json();
        }
        setScans(scanData);
      }
      return data;
    }
    return null;
  };

  useEffect(() => {
    fetchChain();
  }, [scanId]);

  useEffect(() => {
    if (chain?.status === "running") {
      const interval = setInterval(async () => {
        const c = await fetchChain();
        if (c?.status !== "running") clearInterval(interval);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [chain?.status]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [chain?.log_lines]);

  const startChain = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`${API}/scans/${scanId}/chain-start`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "Failed to start chain");
      } else {
        await fetchChain();
      }
    } catch (e) {
      setError(e.message);
    }
    setStarting(false);
  };

  const isRunning = chain?.status === "running";
  const isComplete = chain?.status === "completed";
  const scanIds = chain?.scan_ids || [];

  return (
    <div style={{ background: "#111622", border: "1px solid #1A2235", padding: 0 }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1A2235", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={15} color="#FFB020" />
          <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 13, color: "#E2E8F0" }}>
            CHAIN ATTACK
          </span>
          {isRunning && (
            <span style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", background: "rgba(0,255,65,0.1)", border: "1px solid rgba(0,255,65,0.3)", padding: "1px 7px" }}>
              ACTIVE
            </span>
          )}
          {isComplete && (
            <span style={{ fontSize: 10, color: "#4299E1", fontFamily: "JetBrains Mono", background: "rgba(66,153,225,0.1)", border: "1px solid rgba(66,153,225,0.3)", padding: "1px 7px" }}>
              DONE
            </span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      <div style={{ padding: 16 }}>
        {/* Description */}
        <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14, lineHeight: 1.6 }}>
          La IA analiza los hallazgos de cada escaneo y decide automáticamente el siguiente paso de ataque. Máximo 5 pasos encadenados.
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.3)", color: "#FF3B30", fontSize: 12, fontFamily: "JetBrains Mono", marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* No chain yet */}
        {(!chain || chain.status === "none") && (
          <button className="btn-primary" data-testid="start-chain-btn" onClick={startChain} disabled={starting}
            style={{ width: "100%", justifyContent: "center" }}>
            {starting ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={13} />}
            {starting ? "INICIANDO CADENA..." : "INICIAR CHAIN ATTACK"}
          </button>
        )}

        {/* Chain progress */}
        {chain && chain.status !== "none" && (
          <>
            {/* Step indicators */}
            {scanIds.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>PASOS EJECUTADOS</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {scanIds.map((sid, i) => {
                    const s = scans[sid];
                    return (
                      <div key={sid} style={{ padding: "6px 10px", background: "#0D1117", border: "1px solid #1A2235", display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 18, height: 18, background: s?.status === "completed" ? "#00FF41" : s?.status === "running" ? "#FFB020" : "#1A2235", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: "JetBrains Mono", fontWeight: 700, color: "#000" }}>
                          {i + 1}
                        </div>
                        <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#E2E8F0" }}>
                          {s?.mode?.toUpperCase() || "..."}
                        </span>
                        {s?.status === "completed" && <Check size={10} color="#00FF41" />}
                        {s?.status === "running" && <Loader size={10} color="#FFB020" style={{ animation: "spin 1s linear infinite" }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chain log */}
            <div className="section-label" style={{ marginBottom: 8 }}>CHAIN LOG</div>
            <div ref={logRef} style={{ background: "#000", border: "1px solid #1A2235", padding: "10px 12px", height: 180, overflowY: "auto", fontFamily: "JetBrains Mono", fontSize: 11 }}>
              {(chain.log_lines || []).filter(l => l).map((line, i) => (
                <div key={i} style={{ color: colorChainLine(line), marginBottom: 2, lineHeight: 1.4 }}>{line}</div>
              ))}
              {isRunning && <div style={{ color: "#00FF41" }} className="cursor-blink"> </div>}
            </div>

            {/* Re-run if complete */}
            {isComplete && (
              <button className="btn-secondary" data-testid="restart-chain-btn" onClick={startChain} disabled={starting}
                style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>
                <Zap size={12} /> NUEVA CADENA
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
