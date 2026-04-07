import React, { useState, useEffect } from "react";
import { API } from "../App";
import { Filter, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { SeverityBadge } from "./Dashboard";

const SEVERITIES = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const TYPES = ["ALL", "open_port", "vulnerability", "web_finding", "credential", "domain"];

export default function Results() {
  const [findings, setFindings] = useState([]);
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (severityFilter !== "ALL") params.set("severity", severityFilter);
    fetch(`${API}/findings?limit=200&${params.toString()}`)
      .then(r => r.json())
      .then(data => { setFindings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [severityFilter]);

  const filtered = typeFilter === "ALL" ? findings : findings.filter(f => f.type === typeFilter);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ padding: 24, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1A2235", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: "#00FF41", fontFamily: "JetBrains Mono", letterSpacing: "0.2em", marginBottom: 4 }}>INTELLIGENCE DATABASE</div>
        <h1 style={{ fontFamily: "JetBrains Mono", fontSize: 22, fontWeight: 800, color: "#E2E8F0" }}>All Findings</h1>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>SEVERITY</div>
          <div style={{ display: "flex", gap: 1, background: "#1A2235" }}>
            {SEVERITIES.map(s => (
              <button key={s} data-testid={`filter-sev-${s.toLowerCase()}`}
                onClick={() => setSeverityFilter(s)}
                style={{ padding: "6px 12px", background: severityFilter === s ? "rgba(0,255,65,0.1)" : "#111622", border: "none", color: severityFilter === s ? "#00FF41" : "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 10, cursor: "pointer", fontWeight: severityFilter === s ? 700 : 400 }}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>TYPE</div>
          <div style={{ display: "flex", gap: 1, background: "#1A2235", flexWrap: "wrap" }}>
            {TYPES.map(t => (
              <button key={t} data-testid={`filter-type-${t.toLowerCase()}`}
                onClick={() => setTypeFilter(t)}
                style={{ padding: "6px 12px", background: typeFilter === t ? "rgba(0,255,65,0.1)" : "#111622", border: "none", color: typeFilter === t ? "#00FF41" : "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 10, cursor: "pointer" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: "auto", alignSelf: "flex-end", fontFamily: "JetBrains Mono", fontSize: 11, color: "#94A3B8" }}>
          {filtered.length} FINDINGS
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#111622", border: "1px solid #1A2235" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px", gap: 0, padding: "8px 16px", borderBottom: "1px solid #1A2235", background: "#0D1117" }}>
          {["FINDING", "HOST", "PORT", "TYPE", "SEV"].map(h => (
            <div key={h} style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono", letterSpacing: "0.1em" }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 12 }}>Loading findings...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontFamily: "JetBrains Mono", fontSize: 12 }}>No findings match the current filters.</div>
        ) : filtered.map((f, i) => (
          <div key={f.id || i} data-testid={`finding-${i}`}>
            <div
              onClick={() => toggleExpand(f.id || i)}
              style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px", gap: 0, padding: "10px 16px", borderBottom: "1px solid #0D1117", cursor: "pointer", alignItems: "center", transition: "background 150ms" }}
              onMouseEnter={e => e.currentTarget.style.background = "#0D1117"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ overflow: "hidden", display: "flex", alignItems: "center", gap: 8 }}>
                {expanded[f.id || i] ? <ChevronUp size={12} color="#94A3B8" /> : <ChevronDown size={12} color="#94A3B8" />}
                <div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                  {f.cve && <div style={{ fontSize: 10, color: "#FF5A00", fontFamily: "JetBrains Mono" }}>{f.cve}</div>}
                </div>
              </div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#94A3B8" }}>{f.host}</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#E2E8F0" }}>{f.port || "—"}</div>
              <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono" }}>{f.type?.replace("_", " ")}</div>
              <div><SeverityBadge severity={f.severity} /></div>
            </div>

            {expanded[f.id || i] && (
              <div style={{ padding: "12px 16px 16px 36px", background: "#080C12", borderBottom: "1px solid #0D1117" }}>
                {f.description && <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10, lineHeight: 1.6 }}>{f.description}</p>}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {f.service && <div style={{ fontSize: 11 }}><span style={{ color: "#94A3B8" }}>Service: </span><span style={{ color: "#E2E8F0", fontFamily: "JetBrains Mono" }}>{f.service}</span></div>}
                  {f.product && <div style={{ fontSize: 11 }}><span style={{ color: "#94A3B8" }}>Product: </span><span style={{ color: "#E2E8F0", fontFamily: "JetBrains Mono" }}>{f.product} {f.version}</span></div>}
                  {f.cve && (
                    <a href={`https://nvd.nist.gov/vuln/detail/${f.cve}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#FF5A00", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                      <ExternalLink size={10} /> {f.cve} on NVD
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
