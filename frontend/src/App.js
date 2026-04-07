import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import "./index.css";
import Dashboard from "./components/Dashboard";
import NewScan from "./components/NewScan";
import ScanMonitor from "./components/ScanMonitor";
import AttackPlan from "./components/AttackPlan";
import Results from "./components/Results";
import Workspaces from "./components/Workspaces";
import {
  LayoutDashboard, PlusCircle, Terminal, ShieldAlert,
  FolderOpen, Database, Zap, Activity, ChevronRight
} from "lucide-react";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NAV_ITEMS = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/scan/new", icon: PlusCircle, label: "New Scan" },
  { path: "/workspaces", icon: FolderOpen, label: "Workspaces" },
  { path: "/findings", icon: ShieldAlert, label: "All Findings" },
];

function Sidebar({ stats }) {
  const location = useLocation();

  return (
    <aside style={{ width: 220, background: "#05070A", borderRight: "1px solid #1A2235", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1A2235" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, background: "#00FF41", boxShadow: "0 0 8px #00FF41" }} />
          <span style={{ fontFamily: "JetBrains Mono", fontWeight: 800, fontSize: 15, color: "#E2E8F0", letterSpacing: "0.05em" }}>
            SNIPER<span style={{ color: "#00FF41" }}>AI</span>
          </span>
        </div>
        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4, fontFamily: "JetBrains Mono", letterSpacing: "0.15em" }}>
          COMMAND CENTER
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
          return (
            <NavLink
              key={path}
              to={path}
              data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 16px", textDecoration: "none",
                color: active ? "#00FF41" : "#94A3B8",
                background: active ? "rgba(0,255,65,0.06)" : "transparent",
                borderLeft: active ? "2px solid #00FF41" : "2px solid transparent",
                fontSize: 13, fontWeight: 500, transition: "all 150ms ease"
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* Stats footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1A2235" }}>
        <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono", letterSpacing: "0.15em", marginBottom: 8 }}>
          SYSTEM
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: stats?.sniper_available ? "#00FF41" : "#FF3B30" }} />
          <span style={{ color: stats?.sniper_available ? "#00FF41" : "#FF5A00", fontFamily: "JetBrains Mono", fontSize: 11 }}>
            {stats?.sniper_available ? "SNIPER ONLINE" : "DEMO MODE"}
          </span>
        </div>
        {stats?.active_scans > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11 }}>
            <Activity size={11} color="#00FF41" />
            <span style={{ color: "#00FF41", fontFamily: "JetBrains Mono" }}>
              {stats.active_scans} ACTIVE SCAN{stats.active_scans > 1 ? "S" : ""}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

function AppLayout() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = () => {
      fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(() => {});
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#05070A" }}>
      <Sidebar stats={stats} />
      <main style={{ flex: 1, overflow: "auto" }}>
        <Routes>
          <Route path="/" element={<Dashboard stats={stats} />} />
          <Route path="/scan/new" element={<NewScan />} />
          <Route path="/scan/:id" element={<ScanMonitor />} />
          <Route path="/scan/:id/plan" element={<AttackPlan />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/findings" element={<Results />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
