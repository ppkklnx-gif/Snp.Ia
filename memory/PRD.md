# SniperAI Command Center — PRD

## Problem Statement
Build an AI-enhanced web dashboard for Sn1per (automated pentesting tool). The AI knows all Sn1per variants/modes, analyzes scan results, creates attack execution plans, and potentiates the tool for maximum attack and reconnaissance automation. Tool runs on user's local PC alongside Sn1per.

## Architecture
- **Frontend**: React + Tailwind (dark hacker aesthetic, JetBrains Mono, terminal green #00FF41)
- **Backend**: FastAPI + SQLite (aiosqlite, sin MongoDB - compatible con Kali)
- **AI**: GPT-4.1 via Emergent Universal Key (emergentintegrations library)
- **Scan execution**: Real Sn1per when installed / Demo mode with realistic simulated data when not

## Core Features Implemented (as of 2026-02-15)
- [x] Dashboard - Stats (active scans, total, critical CVEs, AI plans, findings), recent scans table, recent findings table
- [x] New Scan - Target input, 9 Sn1per mode selector, 4 attack options (OSINT, Recon, Bruteforce, FullPort), AI recommendation via GPT-4.1
- [x] Scan Monitor - Real-time terminal output (1s polling), terminal colorization, live findings panel, AI chat, stop scan
- [x] Attack Plan - AI-generated multi-phase attack plan with Execute buttons that launch new scans, CVE mapping, remediation
- [x] All Findings - Findings database with severity/type filters, expandable rows, NVD CVE links
- [x] Workspaces - Campaign cards with scan count and critical findings
- [x] Demo Mode - When Sn1per not installed, simulates realistic scan output + 10 findings over 15 seconds
- [x] AI Analysis - GPT-4.1 analyzes scan terminal output + loot files and generates JSON attack plan
- [x] AI Recommendation - Before scanning, AI recommends best mode + scan chain based on target type

## Tech Stack
- Backend: FastAPI, Motor (async MongoDB), asyncio subprocess for scan execution
- AI: emergentintegrations library, GPT-4.1, EMERGENT_LLM_KEY
- Frontend: React 19, React Router, Tailwind CSS, Lucide React icons
- Fonts: JetBrains Mono (headings/terminal), IBM Plex Sans (body)

## Key API Routes
- POST /api/scans - Create + start scan
- GET /api/scans - List scans
- GET /api/scans/{id}/output?offset=N - Terminal output polling
- POST /api/scans/{id}/analyze - Trigger AI analysis
- GET /api/scans/{id}/plan - Get AI attack plan
- GET /api/scans/{id}/findings - Get scan findings
- POST /api/ai/recommend - Get AI mode recommendation
- POST /api/ai/chat - AI chat about scan
- GET /api/workspaces - List workspaces
- GET /api/findings - All findings (with filters)
- GET /api/stats - Dashboard stats

## Sn1per Modes Supported by AI
normal, stealth, web, webscan, fullportonly, vulnscan, nuke, discover, airstrike, flyover, port, webporthttp, webporthttps, massweb, masswebscan, massportscan, massvulnscan

## AI Integration
- Provider: OpenAI GPT-4.1 via Emergent Universal Key
- Library: emergentintegrations
- System prompt: Full Sn1per mode reference + attack chaining strategies
- Outputs: JSON attack plan with phases, exact commands, CVE mappings, risk level

## What's Been Tested (2026-02-15)
- Backend: 100% (15/15 tests passed)
- Frontend: 95% (all pages load, all key features work)
- Demo scan flow: works end-to-end
- AI attack plan generation: confirmed CRITICAL risk level, 4 phases, exact commands

## Prioritized Backlog

### P0 (Critical)
- None - all core features working

### P1 (High)
- Persist terminal logs to MongoDB (currently in /tmp - lost on restart)
- Real Sn1per integration testing on a machine with Sn1per installed
- WebSocket for true real-time output (replace polling)

### P2 (Medium)
- Export scan report as PDF
- Scheduled recurring scans
- Notifications (Slack webhook) when critical finding found
- Multi-target upload (file of IPs/domains)
- Dark mode/light mode toggle (currently always dark)

### Future
- SILENTCHAIN AI integration (Sn1per Enterprise feature)
- Historical comparison between scans on same target
- Integration with Metasploit console for direct exploit execution
- Shodan/Censys API integration for passive recon before active scan

## Actualizacion 2026-02-15 — Compatibilidad Kali + AI flexible

### Cambios
- requirements.txt reducido a 7 paquetes esenciales (antes 125 lineas de pip freeze)
- ai_engine.py: deteccion automatica de emergentintegrations vs openai SDK estandar
- .env: usa AI_API_KEY + AI_MODEL + AI_BASE_URL (configurable para cualquier proveedor)
- install.sh: instalador completo para Kali con venv
- start.sh: script de arranque con venv + backend + frontend
- README.md: guia rapida de instalacion

### Uso en Kali
```bash
bash install.sh   # instala todo en venv
nano backend/.env  # configura AI_API_KEY
bash start.sh     # arranca SniperAI
```
