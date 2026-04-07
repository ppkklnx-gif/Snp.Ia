import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../App";
import { FolderOpen, Loader, ChevronRight, Target, Trash2 } from "lucide-react";

export default function Workspaces() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = () => {
    fetch(`${API}/workspaces`)
      .then(r => r.json())
      .then(data => { setWorkspaces(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchWorkspaces(); }, []);

  const formatDate = (iso) => {
    if (!iso) return "N/A";
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return "N/A"; }
  };

  return (
    <div style={{ padding: 24, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 16, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>WORKSPACE MANAGER</div>
          <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>Active Campaigns</h1>
        </div>
        <button className="btn-primary" data-testid="new-campaign-btn" onClick={() => navigate("/scan/new")}>
          <Target size={13} /> NEW CAMPAIGN
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 12 }}>
          <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading workspaces...
        </div>
      ) : workspaces.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <FolderOpen size={40} color="#1A2235" style={{ margin: "0 auto 16px" }} />
          <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: "JetBrains Mono", marginBottom: 16 }}>No workspaces yet. Launch your first scan.</div>
          <button className="btn-primary" onClick={() => navigate("/scan/new")} data-testid="start-first-scan-btn">
            LAUNCH FIRST SCAN
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {workspaces.map((ws, i) => (
            <div key={ws.name} data-testid={`workspace-card-${i}`}
              style={{ background: "#111622", border: "1px solid #1A2235", padding: 20, cursor: "pointer", transition: "all 150ms", position: "relative" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,255,65,0.3)"; e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,65,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1A2235"; e.currentTarget.style.boxShadow = "none"; }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 14, color: "#E2E8F0" }}>{ws.name}</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>{ws.target}</div>
                </div>
                <FolderOpen size={18} color="#94A3B8" />
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 1, marginBottom: 16, background: "#1A2235" }}>
                {[
                  { label: "SCANS", value: ws.scan_count || 0, color: "#4299E1" },
                  { label: "CRITICAL", value: ws.critical_findings || 0, color: ws.critical_findings > 0 ? "#FF3B30" : "#94A3B8" },
                ].map(stat => (
                  <div key={stat.label} style={{ flex: 1, background: "#111622", padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "JetBrains Mono", letterSpacing: "0.1em" }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>Last scan: {formatDate(ws.last_scan)}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/scan/new"); }}
                  style={{ background: "transparent", border: "none", color: "#00FF41", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "JetBrains Mono" }}>
                  SCAN AGAIN <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
