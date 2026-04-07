import React, { useState, useEffect } from "react";
import { API } from "../App";
import { Filter, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { SeverityBadge } from "./Dashboard";

const SEVERIDADES = ["TODOS", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const TIPOS = ["TODOS", "open_port", "vulnerability", "web_finding", "credential", "domain"];
const TIPO_ES = { open_port: "Puerto Abierto", vulnerability: "Vulnerabilidad", web_finding: "Web", credential: "Credencial", domain: "Dominio" };

export default function Hallazgos() {
  const [hallazgos, setHallazgos] = useState([]);
  const [filtroSev, setFiltroSev] = useState("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [expandido, setExpandido] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filtroSev !== "TODOS") params.set("severity", filtroSev);
    fetch(`${API}/findings?limit=200&${params.toString()}`)
      .then(r => r.json()).then(d => { setHallazgos(d); setCargando(false); }).catch(() => setCargando(false));
  }, [filtroSev]);

  const filtrados = filtroTipo === "TODOS" ? hallazgos : hallazgos.filter(f => f.type === filtroTipo);
  const toggle = (id) => setExpandido(p => ({ ...p, [id]: !p[id] }));

  return (
    <div style={{ padding: 24, minHeight: "100vh" }}>
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 14, marginBottom: 22 }}>
        <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>BASE DE INTELIGENCIA</div>
        <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>Todos los Hallazgos</h1>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>SEVERIDAD</div>
          <div style={{ display: "flex", gap: 1, background: "#1A2235" }}>
            {SEVERIDADES.map(s => (
              <button key={s} data-testid={`filter-sev-${s.toLowerCase()}`} onClick={() => setFiltroSev(s)}
                style={{ padding: "5px 10px", background: filtroSev === s ? "rgba(0,255,65,0.1)" : "#111622", border: "none", color: filtroSev === s ? "#00FF41" : "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 10, cursor: "pointer", fontWeight: filtroSev === s ? 700 : 400 }}>
                {s === "TODOS" ? "TODOS" : s === "CRITICAL" ? "CRÍTICO" : s === "HIGH" ? "ALTO" : s === "MEDIUM" ? "MEDIO" : s === "LOW" ? "BAJO" : s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>TIPO</div>
          <div style={{ display: "flex", gap: 1, background: "#1A2235", flexWrap: "wrap" }}>
            {TIPOS.map(t => (
              <button key={t} data-testid={`filter-type-${t.toLowerCase()}`} onClick={() => setFiltroTipo(t)}
                style={{ padding: "5px 10px", background: filtroTipo === t ? "rgba(0,255,65,0.1)" : "#111622", border: "none", color: filtroTipo === t ? "#00FF41" : "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 10, cursor: "pointer" }}>
                {t === "TODOS" ? "TODOS" : (TIPO_ES[t] || t)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: "auto", alignSelf: "flex-end", fontFamily: "JetBrains Mono", fontSize: 11, color: "#94A3B8" }}>
          {filtrados.length} hallazgos
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background: "#111622", border: "1px solid #1A2235" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 100px 80px", gap: 0, padding: "7px 14px", borderBottom: "1px solid #1A2235", background: "#0D1117" }}>
          {["HALLAZGO", "HOST", "PUERTO", "TIPO", "SEV"].map(h => (
            <div key={h} style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono", letterSpacing: "0.1em" }}>{h}</div>
          ))}
        </div>

        {cargando ? (
          <div style={{ padding: 28, textAlign: "center", color: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 12 }}>Cargando hallazgos...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 12 }}>Sin hallazgos con los filtros actuales.</div>
        ) : filtrados.map((f, i) => (
          <div key={f.id || i} data-testid={`finding-${i}`}>
            <div onClick={() => toggle(f.id || i)}
              style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 100px 80px", padding: "9px 14px", borderBottom: "1px solid #0D1117", cursor: "pointer", alignItems: "center", transition: "background 150ms" }}
              onMouseEnter={e => e.currentTarget.style.background = "#0D1117"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ overflow: "hidden", display: "flex", alignItems: "center", gap: 7 }}>
                {expandido[f.id || i] ? <ChevronUp size={11} color="#94A3B8" /> : <ChevronDown size={11} color="#94A3B8" />}
                <div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                  {f.cve && <div style={{ fontSize: 10, color: "#FF5A00", fontFamily: "JetBrains Mono" }}>{f.cve}</div>}
                </div>
              </div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#94A3B8" }}>{f.host}</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#E2E8F0" }}>{f.port || "—"}</div>
              <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>{TIPO_ES[f.type] || f.type}</div>
              <div><SeverityBadge severity={f.severity} /></div>
            </div>
            {expandido[f.id || i] && (
              <div style={{ padding: "10px 14px 14px 32px", background: "#080C12", borderBottom: "1px solid #0D1117" }}>
                {f.description && <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 8, lineHeight: 1.6 }}>{f.description}</p>}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {f.service && <div style={{ fontSize: 11 }}><span style={{ color: "#94A3B8" }}>Servicio: </span><span style={{ color: "#E2E8F0", fontFamily: "JetBrains Mono" }}>{f.service}</span></div>}
                  {f.product && <div style={{ fontSize: 11 }}><span style={{ color: "#94A3B8" }}>Producto: </span><span style={{ color: "#E2E8F0", fontFamily: "JetBrains Mono" }}>{f.product} {f.version}</span></div>}
                  {f.cve && (
                    <a href={`https://nvd.nist.gov/vuln/detail/${f.cve}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#FF5A00", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                      <ExternalLink size={10} /> {f.cve} en NVD
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
