import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../App";
import { Activity, ShieldAlert, Zap, Target, ChevronRight, Clock, AlertTriangle } from "lucide-react";

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
      style={{ background: "#111622", border: "1px solid #1A2235", padding: "16px 20px", flex: 1, minWidth: 160 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono", letterSpacing: "0.15em", textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "JetBrains Mono", color: color || "#E2E8F0", marginTop: 6 }}>{value ?? "—"}</div>
        </div>
        <div style={{ padding: 8, background: "rgba(0,255,65,0.05)", border: "1px solid #1A2235" }}>
          <Icon size={18} color={color || "#94A3B8"} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const cls = { CRITICAL: "badge-critical", HIGH: "badge-high", MEDIUM: "badge-medium", LOW: "badge-low", INFO: "badge-info" };
  return (
    <span className={cls[severity] || "badge-info"} style={{ fontSize: 10, fontFamily: "JetBrains Mono", padding: "2px 7px", fontWeight: 700, letterSpacing: "0.1em" }}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const cls = { running: "badge-running", completed: "badge-completed", failed: "badge-failed", pending: "badge-pending", stopped: "badge-stopped" };
  return (
    <span className={cls[status] || "badge-info"} style={{ fontSize: 10, fontFamily: "JetBrains Mono", padding: "2px 7px", fontWeight: 700, letterSpacing: "0.1em" }}>
      {status?.toUpperCase()}
    </span>
  );
}

export { SeverityBadge, StatusBadge };

export default function Dashboard({ stats }) {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [findings, setFindings] = useState([]);

  useEffect(() => {
    fetch(`${API}/scans`).then(r => r.json()).then(data => setScans(data.slice(0, 8))).catch(() => {});
    fetch(`${API}/findings?limit=8`).then(r => r.json()).then(setFindings).catch(() => {});
  }, []);

  return (
    <div style={{ padding: "24px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>COMMAND CENTER</div>
        <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>Attack Surface Overview</h1>
      </div>

      {/* Stats Row */}
      <div style={{ display: "flex", gap: 1, marginBottom: 24, background: "#1A2235" }}>
        <StatCard label="Active Scans" value={stats?.active_scans ?? 0} color="#00FF41" icon={Activity} />
        <StatCard label="Total Scans" value={stats?.total_scans ?? 0} color="#4299E1" icon={Target} />
        <StatCard label="Critical CVEs" value={stats?.critical_findings ?? 0} color="#FF3B30" icon={AlertTriangle} />
        <StatCard label="AI Plans" value={stats?.attack_plans ?? 0} color="#FFB020" icon={Zap} />
        <StatCard label="Findings" value={stats?.total_findings ?? 0} color="#E2E8F0" icon={ShieldAlert} />
      </div>

      {/* Demo Mode Banner */}
      {stats && !stats.sniper_available && (
        <div data-testid="demo-banner" style={{ background: "rgba(255,176,32,0.08)", border: "1px solid rgba(255,176,32,0.3)", padding: "10px 16px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={14} color="#FFB020" />
          <span style={{ fontSize: 12, color: "#FFB020", fontFamily: "JetBrains Mono" }}>
            DEMO MODE — Sn1per not installed. Scans will use realistic simulated data. Deploy on a machine with Sn1per for live operation.
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Recent Scans */}
        <div style={{ background: "#111622", border: "1px solid #1A2235" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1A2235", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.15em" }}>RECENT SCANS</span>
            <button onClick={() => navigate("/scan/new")} className="btn-primary" data-testid="new-scan-quick-btn" style={{ fontSize: 10, padding: "5px 12px" }}>
              + NEW
            </button>
          </div>
          <div>
            {scans.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 12, fontFamily: "JetBrains Mono" }}>
                No scans yet. Launch your first attack.
              </div>
            ) : scans.map((s, i) => (
              <div key={s.id} data-testid={`scan-row-${i}`}
                onClick={() => navigate(`/scan/${s.id}`)}
                style={{ padding: "10px 16px", borderBottom: "1px solid #0D1117", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 150ms" }}
                onMouseEnter={e => e.currentTarget.style.background = "#0D1117"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: "#E2E8F0", fontWeight: 600 }}>{s.target}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    {s.mode?.toUpperCase()} &nbsp;·&nbsp; {s.workspace}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusBadge status={s.status} />
                  <ChevronRight size={12} color="#94A3B8" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Findings */}
        <div style={{ background: "#111622", border: "1px solid #1A2235" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1A2235" }}>
            <span style={{ fontSize: 11, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.15em" }}>CRITICAL FINDINGS</span>
          </div>
          <div>
            {findings.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 12, fontFamily: "JetBrains Mono" }}>
                No findings yet. Start a scan to discover vulnerabilities.
              </div>
            ) : findings.map((f, i) => (
              <div key={f.id || i} data-testid={`finding-row-${i}`}
                style={{ padding: "10px 16px", borderBottom: "1px solid #0D1117", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{f.host} {f.port ? `· port ${f.port}` : ""}</div>
                </div>
                <SeverityBadge severity={f.severity} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
