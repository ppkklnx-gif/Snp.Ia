import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "../App";
import { Zap, Square, ChevronRight, Loader, Terminal as TerminalIcon, Activity, Check, AlertTriangle } from "lucide-react";
import { SeverityBadge, StatusBadge } from "./Dashboard";

// ── Detección de fase por keywords en el output ──
const FASES = [
  { key: "GATHERING DNS",     nombre: "Reconocimiento DNS",       num: 1 },
  { key: "PINGING HOST",      nombre: "Verificando host activo",  num: 2 },
  { key: "RUNNING TCP PORT",  nombre: "Escaneando puertos TCP",   num: 3 },
  { key: "RUNNING INTRUSIVE", nombre: "Exploits por servicio",    num: 4 },
  { key: "RUNNING METASPLOIT",nombre: "Módulos Metasploit",       num: 5 },
  { key: "SCANNING ALL HTTP", nombre: "Análisis web",             num: 6 },
  { key: "SCAN COMPLETE",     nombre: "Completado",               num: 7 },
];
const TOTAL_FASES = 7;

function detectarFase(lineas) {
  let ultima = { nombre: "Iniciando...", num: 0 };
  for (const l of lineas) {
    const up = l.toUpperCase();
    for (const f of FASES) {
      if (up.includes(f.key)) ultima = f;
    }
  }
  return ultima;
}

function colorLinea(linea) {
  if (!linea.trim()) return "default";
  const l = linea.toLowerCase();
  if (l.includes("[!]") || l.includes("scan complete") || l.includes("critical")) return "err";
  if (l.includes("[+]") || l.includes("open") || l.includes("found") || l.includes("ok")) return "ok";
  if (l.includes("[*]") || l.includes("running") || l.includes("checking")) return "info";
  if (l.includes("=====") || l.includes("------")) return "header";
  if (l.includes("session opened") || l.includes("meterpreter")) return "ok";
  if (l.includes("warn") || l.includes("failed")) return "warn";
  return "default";
}

// ── Alertas en tiempo real ──
const ALERTAS_CLAVE = [
  { texto: "session opened",         nivel: "CRITICAL", msg: "Sesión Meterpreter obtenida" },
  { texto: "meterpreter session",    nivel: "CRITICAL", msg: "Sesión Meterpreter activa" },
  { texto: "command shell session",  nivel: "CRITICAL", msg: "Shell de comandos obtenida" },
  { texto: "anonymous ftp",          nivel: "HIGH",     msg: "FTP anónimo confirmado" },
  { texto: "sql injection",          nivel: "HIGH",     msg: "Inyección SQL detectada" },
  { texto: "may be vulnerable",      nivel: "HIGH",     msg: "Posible vulnerabilidad encontrada" },
  { texto: "is vulnerable",          nivel: "CRITICAL", msg: "Vulnerabilidad confirmada" },
  { texto: "file saved",             nivel: "HIGH",     msg: "Archivo capturado" },
];

function buscarAlertas(lineas) {
  const alertas = [];
  for (const l of lineas) {
    const lo = l.toLowerCase();
    for (const a of ALERTAS_CLAVE) {
      if (lo.includes(a.texto) && !alertas.find(x => x.msg === a.msg)) {
        alertas.push(a);
      }
    }
  }
  return alertas;
}

export default function ScanMonitor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [offset, setOffset] = useState(0);
  const [findings, setFindings] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [faseActual, setFaseActual] = useState({ nombre: "Iniciando...", num: 0 });
  const [tiempoInicio, setTiempoInicio] = useState(null);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState("00:00");
  const [lineasPorSeg, setLineasPorSeg] = useState(0);
  const [analizando, setAnalizando] = useState(false);
  const [planListo, setPlanListo] = useState(false);
  const [aiChat, setAiChat] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const termRef = useRef(null);
  const pollingRef = useRef(null);
  const lineasPrevRef = useRef(0);
  const offsetRef = useRef(0);

  const fetchScan = useCallback(async () => {
    const r = await fetch(`${API}/scans/${id}`);
    if (r.ok) {
      const d = await r.json();
      setScan(d);
      if (d.started_at && !tiempoInicio) setTiempoInicio(new Date(d.started_at));
      if (d.has_plan) setPlanListo(true);
      return d;
    }
    return null;
  }, [id]);

  const fetchFindings = useCallback(async () => {
    const r = await fetch(`${API}/scans/${id}/findings`);
    if (r.ok) setFindings(await r.json());
  }, [id]);

  const fetchOutput = useCallback(async () => {
    const r = await fetch(`${API}/scans/${id}/output?offset=${offsetRef.current}`);
    if (!r.ok) return;
    const d = await r.json();
    if (d.lines?.length > 0) {
      setLineas(prev => {
        const nuevas = [...prev, ...d.lines];
        setFaseActual(detectarFase(nuevas));
        setAlertas(buscarAlertas(nuevas));
        return nuevas;
      });
      offsetRef.current = d.offset;
      setOffset(d.offset);
      setTimeout(() => {
        if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
      }, 50);
    }
  }, [id]);

  // Contador de tiempo transcurrido
  useEffect(() => {
    if (!tiempoInicio) return;
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - tiempoInicio.getTime()) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      setTiempoTranscurrido(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(t);
  }, [tiempoInicio]);

  // Contador de actividad (líneas/seg)
  useEffect(() => {
    const t = setInterval(() => {
      const nuevas = offset - lineasPrevRef.current;
      setLineasPorSeg(Math.max(0, nuevas));
      lineasPrevRef.current = offset;
    }, 3000);
    return () => clearInterval(t);
  }, [offset]);

  useEffect(() => {
    fetchScan();
    fetchFindings();

    pollingRef.current = setInterval(async () => {
      const sc = await fetchScan();
      await fetchOutput();
      await fetchFindings();
      if (sc?.status === "completed" || sc?.status === "failed" || sc?.status === "stopped") {
        clearInterval(pollingRef.current);
        // Auto-navegar al plan cuando esté listo
        if (sc?.has_plan) setPlanListo(true);
      }
    }, 1500);

    return () => clearInterval(pollingRef.current);
  }, [id]);

  // Polling extra rápido para detectar plan listo
  useEffect(() => {
    if (scan?.status !== "completed" || planListo) return;
    const t = setInterval(async () => {
      const r = await fetch(`${API}/scans/${id}`);
      if (r.ok) {
        const d = await r.json();
        if (d.has_plan) { setPlanListo(true); clearInterval(t); }
      }
    }, 3000);
    return () => clearInterval(t);
  }, [scan?.status, planListo]);

  const detener = async () => {
    await fetch(`${API}/scans/${id}/stop`, { method: "POST" });
    fetchScan();
  };

  const analizarManual = async () => {
    setAnalizando(true);
    await fetch(`${API}/scans/${id}/analyze`, { method: "POST" });
    setTimeout(() => { setAnalizando(false); }, 3000);
  };

  const enviarChat = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    const msg = chatInput;
    setChatInput("");
    const r = await fetch(`${API}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, scan_id: id })
    });
    if (r.ok) {
      const d = await r.json();
      setAiChat(d.response);
    }
    setChatLoading(false);
  };

  const sevCount = (s) => findings.filter(f => f.severity === s).length;
  const pct = Math.round((faseActual.num / TOTAL_FASES) * 100);

  if (!scan) return (
    <div style={{ padding: 24, display: "flex", gap: 8, alignItems: "center" }}>
      <Loader size={16} color="#00FF41" style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ fontFamily: "JetBrains Mono", color: "#94A3B8" }}>Cargando...</span>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #1A2235", background: "#05070A", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <TerminalIcon size={15} color="#00FF41" />
        <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, color: "#E2E8F0" }}>{scan.target}</span>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#94A3B8" }}>/ {scan.mode?.toUpperCase()} / {scan.workspace}</span>
        <StatusBadge status={scan.status} />
        {scan.demo && <span style={{ fontSize: 10, color: "#FFB020", fontFamily: "JetBrains Mono", background: "rgba(255,176,32,0.1)", border: "1px solid rgba(255,176,32,0.3)", padding: "1px 6px" }}>DEMO</span>}

        {/* Tiempo transcurrido */}
        {(scan.status === "running" || scan.status === "completed") && (
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>
            ⏱ {tiempoTranscurrido}
          </span>
        )}

        {/* Actividad */}
        {scan.status === "running" && (
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: lineasPorSeg > 0 ? "#00FF41" : "#94A3B8" }}>
            {lineasPorSeg > 0 ? `● ${lineasPorSeg} líneas/3s` : "● esperando output..."}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {scan.status === "running" && (
            <button className="btn-danger" data-testid="stop-scan-btn" onClick={detener} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
              <Square size={11} /> Detener
            </button>
          )}
          {scan.status === "completed" && !planListo && (
            <button className="btn-primary" data-testid="analyze-ai-btn" onClick={analizarManual} disabled={analizando} style={{ fontSize: 11 }}>
              {analizando ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />}
              {analizando ? "Analizando..." : "Analizar con IA"}
            </button>
          )}
          {planListo && (
            <button className="btn-primary" data-testid="view-plan-btn" onClick={() => navigate(`/scan/${id}/plan`)} style={{ fontSize: 11, background: "#00FF41", color: "#000" }}>
              <Check size={12} /> Plan Listo — Ver Ataque
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso de fases */}
      {(scan.status === "running" || scan.status === "completed") && (
        <div style={{ background: "#0D1117", borderBottom: "1px solid #1A2235", padding: "8px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#00FF41" }}>
              {scan.status === "completed" ? "COMPLETADO" : `FASE ${faseActual.num}/${TOTAL_FASES} — ${faseActual.nombre.toUpperCase()}`}
            </span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#94A3B8" }}>{pct}%</span>
          </div>
          <div style={{ height: 4, background: "#1A2235", borderRadius: 0 }}>
            <div style={{ height: "100%", width: `${scan.status === "completed" ? 100 : pct}%`, background: scan.status === "completed" ? "#4299E1" : "#00FF41", transition: "width 500ms ease", boxShadow: "0 0 8px rgba(0,255,65,0.4)" }} />
          </div>
        </div>
      )}

      {/* Alertas en tiempo real */}
      {alertas.length > 0 && (
        <div style={{ background: "rgba(255,59,48,0.08)", borderBottom: "1px solid rgba(255,59,48,0.3)", padding: "6px 20px", display: "flex", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
          {alertas.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <AlertTriangle size={11} color={a.nivel === "CRITICAL" ? "#FF3B30" : "#FFB020"} />
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: a.nivel === "CRITICAL" ? "#FF3B30" : "#FFB020" }}>
                {a.msg}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Split principal */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "60% 40%", overflow: "hidden" }}>

        {/* Terminal */}
        <div style={{ borderRight: "1px solid #1A2235", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "5px 12px", background: "#000", borderBottom: "1px solid #1A2235", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF3B30" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFB020" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF41" }} />
            <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono", marginLeft: 6 }}>
              sudo sniper -t {scan.target} -m {scan.mode} -w {scan.workspace}
            </span>
          </div>
          <div ref={termRef} className="terminal" style={{ flex: 1, overflow: "auto" }} data-testid="terminal-output">
            {lineas.length === 0 ? (
              <div style={{ color: "#94A3B8" }}>
                <span className="cursor-blink">Esperando output del escaneo</span>
              </div>
            ) : lineas.map((l, i) => (
              <div key={i} className={`terminal-line ${colorLinea(l)}`}>{l || "\u00A0"}</div>
            ))}
            {scan.status === "running" && <div className="terminal-line ok cursor-blink"> </div>}
            {scan.status === "completed" && !planListo && (
              <div style={{ color: "#4299E1", fontFamily: "JetBrains Mono", fontSize: 12, marginTop: 8 }}>
                [*] Escaneo completado. Generando análisis IA automáticamente...
              </div>
            )}
            {planListo && (
              <div style={{ color: "#00FF41", fontFamily: "JetBrains Mono", fontSize: 12, marginTop: 8, fontWeight: 700 }}>
                [+] Plan de ataque generado por Kimi AI — haz clic en "Plan Listo" arriba
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Contadores */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1A2235", background: "#111622", flexShrink: 0 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>HALLAZGOS EN VIVO</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["CRIT", sevCount("CRITICAL"), "#FF3B30"], ["ALTO", sevCount("HIGH"), "#FF5A00"], ["MED", sevCount("MEDIUM"), "#FFB020"], ["BAJO", sevCount("LOW"), "#4299E1"]].map(([l, c, col]) => (
                <div key={l} style={{ flex: 1, background: "#0D1117", border: "1px solid #1A2235", padding: "6px 4px", textAlign: "center" }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 700, color: col }}>{c}</div>
                  <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Findings */}
          <div style={{ flex: 1, overflow: "auto", padding: "10px 14px" }}>
            <div className="section-label" style={{ marginBottom: 8 }}>HALLAZGOS DETECTADOS</div>
            {findings.length === 0 && scan.status === "running" && (
              <div style={{ textAlign: "center", padding: 20, color: "#94A3B8", fontSize: 11, fontFamily: "JetBrains Mono" }}>
                <Loader size={14} color="#00FF41" style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 6px" }} />
                Escaneando...
              </div>
            )}
            {findings.slice(0, 12).map((f, i) => (
              <div key={i} style={{ marginBottom: 6, padding: "7px 8px", background: "#0D1117", border: "1px solid #1A2235" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#E2E8F0", flex: 1 }}>{f.title}</span>
                  <SeverityBadge severity={f.severity} />
                </div>
                {f.cve && <div style={{ fontSize: 10, color: "#FF5A00", fontFamily: "JetBrains Mono", marginTop: 2 }}>{f.cve}</div>}
              </div>
            ))}
          </div>

          {/* Respuesta IA */}
          {aiChat && (
            <div style={{ padding: "8px 14px", borderTop: "1px solid #1A2235", background: "rgba(0,255,65,0.03)", maxHeight: 140, overflow: "auto", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", marginBottom: 4 }}>KIMI AI</div>
              <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>{aiChat}</div>
            </div>
          )}

          {/* Chat IA */}
          <div style={{ padding: "8px 14px", borderTop: "1px solid #1A2235", background: "#111622", display: "flex", gap: 6, flexShrink: 0 }}>
            <input className="input-dark" data-testid="ai-chat-input"
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && enviarChat()}
              placeholder="Pregunta a la IA sobre este escaneo..."
              style={{ flex: 1, fontSize: 11, padding: "6px 8px" }} />
            <button className="btn-primary" onClick={enviarChat} disabled={chatLoading} style={{ padding: "6px 10px" }}>
              {chatLoading ? <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={11} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
