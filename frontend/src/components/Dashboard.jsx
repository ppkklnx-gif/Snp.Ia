import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../App";
import { Activity, ShieldAlert, Zap, Target, ChevronRight, AlertTriangle, Trash2, Clock } from "lucide-react";

function TarjetaStat({ etiqueta, valor, color, icono: Icono }) {
  return (
    <div data-testid={`stat-${etiqueta.toLowerCase().replace(/\s/g, "-")}`}
      style={{ background: "#111622", border: "1px solid #1A2235", padding: "14px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono", letterSpacing: "0.15em", textTransform: "uppercase" }}>{etiqueta}</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "JetBrains Mono", color: color || "#E2E8F0", marginTop: 5 }}>{valor ?? "—"}</div>
        </div>
        <div style={{ padding: 7, background: "rgba(0,255,65,0.05)", border: "1px solid #1A2235" }}>
          <Icono size={17} color={color || "#94A3B8"} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

function BadgeSeveridad({ severity }) {
  const cls = { CRITICAL: "badge-critical", HIGH: "badge-high", MEDIUM: "badge-medium", LOW: "badge-low", INFO: "badge-info" };
  return (
    <span className={cls[severity] || "badge-info"} style={{ fontSize: 10, fontFamily: "JetBrains Mono", padding: "2px 7px", fontWeight: 700 }}>
      {severity === "CRITICAL" ? "CRÍTICO" : severity === "HIGH" ? "ALTO" : severity === "MEDIUM" ? "MEDIO" : severity === "LOW" ? "BAJO" : severity}
    </span>
  );
}

function BadgeEstado({ status }) {
  const cfg = {
    running:   { cls: "badge-running",   txt: "CORRIENDO" },
    completed: { cls: "badge-completed", txt: "COMPLETADO" },
    failed:    { cls: "badge-failed",    txt: "FALLIDO" },
    pending:   { cls: "badge-pending",   txt: "PENDIENTE" },
    stopped:   { cls: "badge-stopped",   txt: "DETENIDO" },
  };
  const c = cfg[status] || { cls: "badge-info", txt: status?.toUpperCase() };
  return <span className={c.cls} style={{ fontSize: 10, fontFamily: "JetBrains Mono", padding: "2px 7px", fontWeight: 700 }}>{c.txt}</span>;
}

export { BadgeSeveridad as SeverityBadge, BadgeEstado as StatusBadge };

export default function Dashboard({ stats }) {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);

  const cargarScans = () =>
    fetch(`${API}/scans`).then(r => r.json()).then(d => setScans(d.slice(0, 10))).catch(() => {});

  useEffect(() => {
    cargarScans();
    fetch(`${API}/findings?limit=8`).then(r => r.json()).then(setHallazgos).catch(() => {});
    const t = setInterval(cargarScans, 8000);
    return () => clearInterval(t);
  }, []);

  const eliminarScan = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("¿Eliminar este escaneo y todos sus datos?")) return;
    await fetch(`${API}/scans/${id}`, { method: "DELETE" });
    cargarScans();
  };

  const tiempoRelativo = (iso) => {
    if (!iso) return "";
    try {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diff < 60) return "hace " + diff + "s";
      if (diff < 3600) return "hace " + Math.floor(diff / 60) + "m";
      if (diff < 86400) return "hace " + Math.floor(diff / 3600) + "h";
      return "hace " + Math.floor(diff / 86400) + "d";
    } catch { return ""; }
  };

  return (
    <div style={{ padding: "24px", minHeight: "100vh" }}>
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 14, marginBottom: 22 }}>
        <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>CENTRO DE COMANDO</div>
        <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>Superficie de Ataque</h1>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 1, marginBottom: 22, background: "#1A2235" }}>
        <TarjetaStat etiqueta="Escaneos Activos" valor={stats?.active_scans ?? 0} color="#00FF41" icono={Activity} />
        <TarjetaStat etiqueta="Total Escaneos" valor={stats?.total_scans ?? 0} color="#4299E1" icono={Target} />
        <TarjetaStat etiqueta="CVEs Críticos" valor={stats?.critical_findings ?? 0} color="#FF3B30" icono={AlertTriangle} />
        <TarjetaStat etiqueta="Planes IA" valor={stats?.attack_plans ?? 0} color="#FFB020" icono={Zap} />
        <TarjetaStat etiqueta="Hallazgos" valor={stats?.total_findings ?? 0} color="#E2E8F0" icono={ShieldAlert} />
      </div>

      {/* Banner demo */}
      {stats && !stats.sniper_available && (
        <div data-testid="demo-banner" style={{ background: "rgba(255,176,32,0.08)", border: "1px solid rgba(255,176,32,0.3)", padding: "9px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={13} color="#FFB020" />
          <span style={{ fontSize: 11, color: "#FFB020", fontFamily: "JetBrains Mono" }}>
            MODO DEMO — Sn1per no instalado. Para operación real instala Sn1per en Kali.
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {/* Escaneos recientes */}
        <div style={{ background: "#111622", border: "1px solid #1A2235" }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid #1A2235", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.15em" }}>ESCANEOS RECIENTES</span>
            <button onClick={() => navigate("/scan/new")} className="btn-primary" data-testid="new-scan-quick-btn" style={{ fontSize: 10, padding: "4px 10px" }}>
              + NUEVO
            </button>
          </div>
          <div>
            {scans.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "#94A3B8", fontSize: 12, fontFamily: "JetBrains Mono" }}>
                Sin escaneos. Lanza tu primer ataque.
              </div>
            ) : scans.map((s, i) => (
              <div key={s.id} data-testid={`scan-row-${i}`} onClick={() => navigate(`/scan/${s.id}`)}
                style={{ padding: "9px 14px", borderBottom: "1px solid #0D1117", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 150ms" }}
                onMouseEnter={e => e.currentTarget.style.background = "#0D1117"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: "#E2E8F0", fontWeight: 600 }}>{s.target}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{s.mode?.toUpperCase()}</span>
                    <span>·</span>
                    <span>{s.workspace}</span>
                    {s.created_at && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={9} />{tiempoRelativo(s.created_at)}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <BadgeEstado status={s.status} />
                  <button data-testid={`delete-scan-${i}`} onClick={(e) => eliminarScan(e, s.id)} title="Eliminar"
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: 3, color: "#94A3B8", display: "flex", alignItems: "center", transition: "color 150ms" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#FF3B30"}
                    onMouseLeave={e => e.currentTarget.style.color = "#94A3B8"}>
                    <Trash2 size={12} />
                  </button>
                  <ChevronRight size={11} color="#94A3B8" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hallazgos críticos */}
        <div style={{ background: "#111622", border: "1px solid #1A2235" }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid #1A2235" }}>
            <span style={{ fontSize: 11, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.15em" }}>HALLAZGOS CRÍTICOS</span>
          </div>
          <div>
            {hallazgos.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "#94A3B8", fontSize: 12, fontFamily: "JetBrains Mono" }}>
                Sin hallazgos. Inicia un escaneo para descubrir vulnerabilidades.
              </div>
            ) : hallazgos.map((f, i) => (
              <div key={f.id || i} data-testid={`finding-row-${i}`}
                style={{ padding: "9px 14px", borderBottom: "1px solid #0D1117", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{f.host}{f.port ? ` · puerto ${f.port}` : ""}</div>
                </div>
                <BadgeSeveridad severity={f.severity} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
