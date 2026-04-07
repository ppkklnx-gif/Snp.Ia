import React, { useState, useEffect, useRef } from "react";
import { API } from "../App";
import { Terminal, Loader, Play, X, AlertTriangle, Check } from "lucide-react";

// Extrae el módulo MSF de un comando sniper o texto del AI
function extractMsfModule(text) {
  const patterns = [
    /use\s+(exploit\/[^\s;]+)/i,
    /use\s+(auxiliary\/[^\s;]+)/i,
    /use\s+(post\/[^\s;]+)/i,
    /-x\s+"[^"]*use\s+([\w/]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

// Detecta si un comando/texto tiene módulos MSF
export function hasMsfContent(text) {
  return /msfconsole|metasploit|use exploit|use auxiliary|CVE-\d{4}/i.test(text);
}

// Sugiere módulo MSF basado en CVE o servicio
function suggestModule(finding) {
  const cve = finding?.cve || "";
  const title = (finding?.title || "").toLowerCase();
  const service = (finding?.service || "").toLowerCase();

  if (cve === "CVE-2021-27928") return "exploit/linux/mysql/mysql_yassl_getname";
  if (title.includes("vsftpd") || title.includes("2.3.4")) return "exploit/unix/ftp/vsftpd_234_backdoor";
  if (title.includes("ftp anon") || title.includes("anonymous ftp")) return "auxiliary/scanner/ftp/anonymous";
  if (service === "ssh") return "auxiliary/scanner/ssh/ssh_version";
  if (service === "smb" || service === "ms-ds") return "exploit/windows/smb/ms17_010_eternalblue";
  if (service === "rdp") return "auxiliary/scanner/rdp/ms12_020_check";
  if (service === "mysql") return "auxiliary/scanner/mysql/mysql_version";
  if (title.includes("webmin")) return "exploit/web/defcon_webmin_unauth_rce";
  return null;
}

export default function MsfRunner({ target, scanId, findings = [], suggestedModule = "" }) {
  const [module, setModule] = useState(suggestedModule || "");
  const [port, setPort] = useState("");
  const [lhost, setLhost] = useState("0.0.0.0");
  const [lport, setLport] = useState("4444");
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [lines, setLines] = useState([]);
  const [offset, setOffset] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const termRef = useRef(null);

  // Sugerir módulos de los findings
  const suggestions = [];
  findings.forEach(f => {
    const mod = suggestModule(f);
    if (mod && !suggestions.find(s => s.module === mod)) {
      suggestions.push({ module: mod, label: f.title, cve: f.cve });
    }
  });

  useEffect(() => {
    if (!jobId || jobStatus === "completed" || jobStatus === "failed" || jobStatus === "pwned") return;
    const interval = setInterval(async () => {
      const r = await fetch(`${API}/msf/jobs/${jobId}/output?offset=${offset}`);
      if (r.ok) {
        const d = await r.json();
        if (d.lines?.length > 0) {
          setLines(prev => [...prev, ...d.lines]);
          setOffset(d.offset);
          setTimeout(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, 50);
        }
        if (d.status !== "running") { setJobStatus(d.status); setRunning(false); }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [jobId, jobStatus, offset]);

  const runModule = async () => {
    if (!module.trim()) { setError("Ingresa el módulo MSF"); return; }
    setRunning(true); setError(""); setLines([]); setOffset(0); setJobId(null); setJobStatus(null);
    try {
      const res = await fetch(`${API}/msf/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_id: scanId, module: module.trim(), target, port: port ? parseInt(port) : null, lhost, lport: parseInt(lport) })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Error iniciando MSF");
      }
      const d = await res.json();
      setJobId(d.job_id);
      setJobStatus("running");
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  };

  const colorLine = (l) => {
    const lo = l.toLowerCase();
    if (lo.includes("meterpreter session") || lo.includes("session opened") || lo.includes("command shell session")) return "#00FF41";
    if (lo.includes("[+]")) return "#00FF41";
    if (lo.includes("[-]") || lo.includes("error") || lo.includes("failed")) return "#FF3B30";
    if (lo.includes("[*]")) return "#4299E1";
    if (lo.includes("[!]")) return "#FFB020";
    return "#94A3B8";
  };

  if (!show) return (
    <button data-testid="open-msf-btn" onClick={() => setShow(true)}
      style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.3)", color: "#FF3B30", fontFamily: "JetBrains Mono", fontSize: 11, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 150ms" }}>
      <Terminal size={12} /> LANZAR METASPLOIT
    </button>
  );

  return (
    <div data-testid="msf-panel" style={{ background: "#080C12", border: "1px solid rgba(255,59,48,0.3)", marginTop: 12 }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,59,48,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,59,48,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Terminal size={13} color="#FF3B30" />
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700, color: "#FF3B30" }}>METASPLOIT</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#94A3B8" }}>→ {target}</span>
        </div>
        <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: 14 }}>
        {/* Sugerencias */}
        {suggestions.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono", letterSpacing: "0.1em", marginBottom: 6 }}>MÓDULOS SUGERIDOS POR IA</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setModule(s.module)}
                  style={{ background: module === s.module ? "rgba(255,59,48,0.15)" : "#111622", border: `1px solid ${module === s.module ? "rgba(255,59,48,0.5)" : "#1A2235"}`, color: module === s.module ? "#FF3B30" : "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 10, padding: "4px 10px", cursor: "pointer" }}>
                  {s.module.split("/").pop()} {s.cve ? `(${s.cve})` : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Config */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "JetBrains Mono", marginBottom: 3 }}>MÓDULO</div>
            <input className="input-dark" data-testid="msf-module-input"
              value={module} onChange={e => setModule(e.target.value)}
              placeholder="exploit/unix/ftp/vsftpd_234_backdoor"
              style={{ fontSize: 11, padding: "6px 8px" }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "JetBrains Mono", marginBottom: 3 }}>RPORT</div>
            <input className="input-dark" value={port} onChange={e => setPort(e.target.value)} placeholder="auto" style={{ fontSize: 11, padding: "6px 8px" }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "JetBrains Mono", marginBottom: 3 }}>LHOST</div>
            <input className="input-dark" value={lhost} onChange={e => setLhost(e.target.value)} style={{ fontSize: 11, padding: "6px 8px" }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "JetBrains Mono", marginBottom: 3 }}>LPORT</div>
            <input className="input-dark" value={lport} onChange={e => setLport(e.target.value)} style={{ fontSize: 11, padding: "6px 8px" }} />
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.3)", color: "#FF3B30", fontFamily: "JetBrains Mono", fontSize: 11, padding: "6px 10px", marginBottom: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: lines.length > 0 ? 10 : 0 }}>
          <button data-testid="msf-run-btn" onClick={runModule} disabled={running || !module.trim()}
            style={{ background: running ? "transparent" : "rgba(255,59,48,0.15)", border: "1px solid rgba(255,59,48,0.5)", color: "#FF3B30", fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700, padding: "7px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.1em" }}>
            {running ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} />}
            {running ? "EJECUTANDO..." : "EJECUTAR"}
          </button>
          {jobStatus === "pwned" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#00FF41", fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700 }}>
              <Check size={14} /> SESION OBTENIDA
            </div>
          )}
          {jobStatus === "completed" && (
            <span style={{ color: "#4299E1", fontFamily: "JetBrains Mono", fontSize: 11 }}>Completado</span>
          )}
          {jobStatus === "failed" && (
            <span style={{ color: "#FF3B30", fontFamily: "JetBrains Mono", fontSize: 11 }}>Fallido — objetivo no vulnerable o inaccesible</span>
          )}
        </div>

        {/* Terminal output */}
        {lines.length > 0 && (
          <div ref={termRef} style={{ background: "#000", border: "1px solid #1A2235", padding: "8px 12px", height: 200, overflowY: "auto", fontFamily: "JetBrains Mono", fontSize: 11 }}>
            {lines.map((l, i) => <div key={i} style={{ color: colorLine(l), marginBottom: 1 }}>{l || "\u00a0"}</div>)}
            {running && <div style={{ color: "#00FF41" }} className="cursor-blink"> </div>}
          </div>
        )}
      </div>
    </div>
  );
}
