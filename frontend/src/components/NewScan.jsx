import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../App";
import { Zap, Target, ChevronRight, Loader, Check } from "lucide-react";

function cleanTarget(raw) {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").split("/")[0];
}

const MODOS = [
  { value: "normal",      label: "NORMAL",    desc: "Scan completo + Metasploit por puerto + exploits automáticos" },
  { value: "stealth",     label: "STEALTH",   desc: "No-intrusivo, evita WAF/IPS. Sin MSF." },
  { value: "web",         label: "WEB",       desc: "Análisis web completo: nikto, dirb, cabeceras, SSL, SQLi, XSS" },
  { value: "webscan",     label: "WEBSCAN",   desc: "Avanzado: Burpsuite + Arachni + OWASP ZAP" },
  { value: "fullportonly",label: "FULLPORT",  desc: "Scan completo de los 65535 puertos con XML" },
  { value: "nuke",        label: "NUKE",      desc: "FULL: todos los exploits MSF + bruteforce + OSINT" },
  { value: "discover",    label: "DISCOVER",  desc: "Subnet/CIDR — mapea todos los hosts activos" },
  { value: "airstrike",   label: "AIRSTRIKE", desc: "Puertos + fingerprint rápido en múltiples hosts" },
];

const OPCIONES = [
  { key: "osint",      label: "OSINT",      desc: "theHarvester, Shodan, Censys" },
  { key: "recon",      label: "RECON",      desc: "subfinder, amass, massdns" },
  { key: "bruteforce", label: "FUERZA BRUTA", desc: "Hydra, Medusa — ataques SSH/FTP/SMB" },
  { key: "full_port",  label: "TODOS LOS PUERTOS", desc: "Escanea los 65535 puertos" },
];

const CONTEXTOS = [
  { v: "",            l: "Sin contexto específico" },
  { v: "CTF",         l: "CTF / Laboratorio de práctica" },
  { v: "red interna", l: "Red interna corporativa" },
  { v: "universidad", l: "Red universitaria" },
  { v: "banco",       l: "Institución financiera" },
  { v: "servidor web",l: "Servidor web / aplicación" },
  { v: "IoT",         l: "Dispositivos IoT / embebidos" },
];

export default function NuevoEscaneo() {
  const navigate = useNavigate();
  const [objetivo, setObjetivo] = useState("");
  const [modo, setModo] = useState("normal");
  const [workspace, setWorkspace] = useState("");
  const [opciones, setOpciones] = useState({ osint: false, recon: false, bruteforce: false, full_port: false });
  const [lhost, setLhost] = useState("");
  const [lport, setLport] = useState("4444");
  const [contexto, setContexto] = useState("");
  const [recomendacion, setRecomendacion] = useState(null);
  const [recCargando, setRecCargando] = useState(false);
  const [lanzando, setLanzando] = useState(false);
  const [error, setError] = useState("");

  const obtenerRecomendacion = async () => {
    if (!objetivo.trim()) return;
    setRecCargando(true);
    setRecomendacion(null);
    setError("");
    const limpio = cleanTarget(objetivo);
    try {
      const r = await fetch(`${API}/ai/recommend`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: limpio, context: contexto })
      });
      const d = await r.json();
      setRecomendacion(d);
      if (d.recommended_mode) setModo(d.recommended_mode);
      if (d.recommended_options) setOpciones(d.recommended_options);
    } catch {
      setError("Error conectando con el servidor de IA.");
    }
    setRecCargando(false);
  };

  const lanzarEscaneo = async () => {
    if (!objetivo.trim()) { setError("Debes ingresar un objetivo"); return; }
    setLanzando(true);
    setError("");
    const limpio = cleanTarget(objetivo);
    const ws = workspace.trim() || limpio.replace(/[^a-zA-Z0-9_-]/g, "_");
    try {
      const r = await fetch(`${API}/scans`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: limpio, mode: modo, workspace: ws, options: opciones,
          lhost: lhost.trim() || "0.0.0.0", lport: parseInt(lport) || 4444, context: contexto })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `Error del servidor (${r.status})`);
      }
      const scan = await r.json();
      navigate(`/scan/${scan.id}`);
    } catch (e) {
      setError(e.message.includes("fetch") ? "No se puede conectar al backend. ¿Está corriendo en puerto 8001?" : e.message);
      setLanzando(false);
    }
  };

  const toggleOpcion = (k) => setOpciones(p => ({ ...p, [k]: !p[k] }));

  return (
    <div style={{ padding: 24, minHeight: "100vh" }}>
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>OPS OFENSIVAS</div>
        <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>Nuevo Escaneo</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Objetivo */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Objetivo</label>
            <input className="input-dark" data-testid="target-input"
              value={objetivo} onChange={e => setObjetivo(e.target.value)}
              placeholder="192.168.1.1 | empresa.com | 10.0.0.0/24"
              onKeyDown={e => e.key === "Enter" && obtenerRecomendacion()}
              style={{ fontSize: 14 }} />
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
              IP, dominio, URL o rango CIDR — el https:// se elimina automáticamente
              {objetivo && cleanTarget(objetivo) !== objetivo.trim() && (
                <span style={{ color: "#00FF41", marginLeft: 8 }}>→ se usará: <strong>{cleanTarget(objetivo)}</strong></span>
              )}
            </div>
          </div>

          {/* Contexto */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Contexto del objetivo <span style={{ color: "#94A3B8", fontSize: 9, fontWeight: 400 }}>(ayuda a la IA a priorizar)</span></label>
            <select value={contexto} onChange={e => setContexto(e.target.value)}
              style={{ background: "#111622", border: "1px solid #1A2235", color: "#E2E8F0", fontFamily: "JetBrains Mono", fontSize: 12, padding: "8px 10px", width: "100%", outline: "none", cursor: "pointer" }}>
              {CONTEXTOS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>

          {/* Modo */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Modo de Escaneo</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#1A2235" }}>
              {MODOS.map(m => (
                <div key={m.value} data-testid={`modo-${m.value}`} onClick={() => setModo(m.value)}
                  style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    background: modo === m.value ? "rgba(0,255,65,0.08)" : "#111622",
                    borderLeft: modo === m.value ? "3px solid #00FF41" : "3px solid transparent",
                    transition: "all 150ms" }}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700, color: modo === m.value ? "#00FF41" : "#E2E8F0", width: 78 }}>{m.label}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{m.desc}</span>
                  {modo === m.value && <Check size={11} color="#00FF41" style={{ marginLeft: "auto" }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Opciones */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Opciones de Ataque</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#1A2235" }}>
              {OPCIONES.map(o => (
                <div key={o.key} data-testid={`opt-${o.key}`} onClick={() => toggleOpcion(o.key)}
                  style={{ padding: "9px 10px", cursor: "pointer",
                    background: opciones[o.key] ? "rgba(0,255,65,0.08)" : "#111622",
                    borderLeft: opciones[o.key] ? "2px solid #00FF41" : "2px solid transparent",
                    transition: "all 150ms" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 11, height: 11, border: opciones[o.key] ? "none" : "1px solid #1A2235", background: opciones[o.key] ? "#00FF41" : "transparent", flexShrink: 0 }} />
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700, color: opciones[o.key] ? "#00FF41" : "#E2E8F0" }}>{o.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{o.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* LHOST/LPORT */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>
              LHOST / LPORT <span style={{ color: "#94A3B8", fontSize: 9, fontWeight: 400 }}>(para shells reversos de Metasploit)</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 8 }}>
              <input className="input-dark" data-testid="lhost-input" value={lhost} onChange={e => setLhost(e.target.value)} placeholder="Tu IP local (ej: 192.168.1.50)" style={{ fontSize: 12 }} />
              <input className="input-dark" data-testid="lport-input" value={lport} onChange={e => setLport(e.target.value)} placeholder="4444" style={{ fontSize: 12 }} />
            </div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>Necesario con NORMAL y NUKE. Vacío si solo haces reconocimiento.</div>
          </div>

          {/* Workspace */}
          <div>
            <label className="section-label" style={{ display: "block", marginBottom: 8 }}>Nombre de Campaña</label>
            <input className="input-dark" data-testid="workspace-input" value={workspace} onChange={e => setWorkspace(e.target.value)} placeholder="Se genera automáticamente del objetivo" />
          </div>

          {error && (
            <div style={{ padding: "8px 12px", background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.3)", fontSize: 12, color: "#FF3B30", fontFamily: "JetBrains Mono" }}>{error}</div>
          )}

          {/* Botones */}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" data-testid="ai-recommend-btn" onClick={obtenerRecomendacion} disabled={!objetivo.trim() || recCargando} style={{ flex: 1 }}>
              {recCargando ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />}
              {recCargando ? "Analizando..." : "Recomendación IA"}
            </button>
            <button className="btn-primary" data-testid="launch-scan-btn" onClick={lanzarEscaneo} disabled={lanzando || !objetivo.trim()} style={{ flex: 2 }}>
              {lanzando ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Target size={12} />}
              {lanzando ? "Lanzando..." : "Lanzar Escaneo"}
            </button>
          </div>
        </div>

        {/* RIGHT: IA */}
        <div style={{ background: "#111622", border: "1px solid #1A2235", padding: 20 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>ANÁLISIS ESTRATÉGICO IA</div>

          {!recomendacion && !recCargando && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Zap size={28} color="#1A2235" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>
                Ingresa un objetivo y haz clic en <strong style={{ color: "#E2E8F0" }}>Recomendación IA</strong> para obtener una estrategia de ataque inteligente.
              </div>
            </div>
          )}

          {recCargando && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Loader size={22} color="#00FF41" style={{ animation: "spin 1s linear infinite", margin: "0 auto 10px", display: "block" }} />
              <div style={{ fontSize: 12, color: "#00FF41", fontFamily: "JetBrains Mono" }}>Kimi AI analizando objetivo...</div>
            </div>
          )}

          {recomendacion && !recCargando && (
            <div className="fade-in">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>NIVEL DE RIESGO:</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700, color: recomendacion.risk_level === "AGGRESSIVE" ? "#FF3B30" : "#FFB020" }}>
                  {recomendacion.risk_level}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#E2E8F0", marginBottom: 14, lineHeight: 1.7 }}>{recomendacion.rationale}</div>

              <div style={{ marginBottom: 14 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>CADENA DE ATAQUE RECOMENDADA</div>
                {recomendacion.scan_chain?.map((s, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div className="code-block" style={{ marginBottom: 3 }}>{s.command}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4 }}>{s.purpose}</div>
                  </div>
                ))}
              </div>

              {recomendacion.expected_findings?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="section-label" style={{ marginBottom: 6 }}>QUÉ ESPERAR ENCONTRAR</div>
                  {recomendacion.expected_findings.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                      <ChevronRight size={11} color="#00FF41" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: "7px 10px", background: "rgba(0,255,65,0.04)", border: "1px solid rgba(0,255,65,0.2)", fontSize: 11, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>
                DURACIÓN EST.: <span style={{ color: "#E2E8F0" }}>{recomendacion.estimated_duration}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
