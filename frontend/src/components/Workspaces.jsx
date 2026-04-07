import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../App";
import { FolderOpen, Loader, ChevronRight, Target, Trash2 } from "lucide-react";

export default function Campanas() {
  const navigate = useNavigate();
  const [campanas, setCampanas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    fetch(`${API}/workspaces`).then(r => r.json())
      .then(d => { setCampanas(d); setCargando(false); }).catch(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const formatFecha = (iso) => {
    if (!iso) return "Sin fecha";
    try { return new Date(iso).toLocaleDateString("es-MX", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return "Sin fecha"; }
  };

  return (
    <div style={{ padding: 24, minHeight: "100vh" }}>
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 14, marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>GESTOR DE CAMPAÑAS</div>
          <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>Campañas Activas</h1>
        </div>
        <button className="btn-primary" data-testid="new-campaign-btn" onClick={() => navigate("/scan/new")}>
          <Target size={13} /> NUEVA CAMPAÑA
        </button>
      </div>

      {cargando ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 12 }}>
          <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Cargando campañas...
        </div>
      ) : campanas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 24px" }}>
          <FolderOpen size={36} color="#1A2235" style={{ margin: "0 auto 14px" }} />
          <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: "JetBrains Mono", marginBottom: 14 }}>Sin campañas. Lanza tu primer escaneo.</div>
          <button className="btn-primary" onClick={() => navigate("/scan/new")} data-testid="start-first-scan-btn">LANZAR PRIMER ESCANEO</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
          {campanas.map((c, i) => (
            <div key={c.name} data-testid={`workspace-card-${i}`}
              style={{ background: "#111622", border: "1px solid #1A2235", padding: 18, cursor: "pointer", transition: "all 150ms" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,255,65,0.3)"; e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,65,0.07)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1A2235"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 14, color: "#E2E8F0" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{c.target}</div>
                </div>
                <FolderOpen size={16} color="#94A3B8" />
              </div>
              <div style={{ display: "flex", gap: 1, marginBottom: 14, background: "#1A2235" }}>
                {[
                  { etiqueta: "ESCANEOS", valor: c.scan_count || 0, color: "#4299E1" },
                  { etiqueta: "CRÍTICOS", valor: c.critical_findings || 0, color: c.critical_findings > 0 ? "#FF3B30" : "#94A3B8" },
                ].map(s => (
                  <div key={s.etiqueta} style={{ flex: 1, background: "#111622", padding: "7px 10px", textAlign: "center" }}>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 700, color: s.color }}>{s.valor}</div>
                    <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "JetBrains Mono", letterSpacing: "0.1em" }}>{s.etiqueta}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>Último scan: {formatFecha(c.last_scan)}</div>
                <button onClick={(e) => { e.stopPropagation(); navigate("/scan/new"); }}
                  style={{ background: "transparent", border: "none", color: "#00FF41", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "JetBrains Mono" }}>
                  ESCANEAR <ChevronRight size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
