# SniperAI Command Center

## Estado del proyecto (actualización masiva 2026-04-07)

## Architecture
- **Frontend**: React + Tailwind — completamente en ESPAÑOL
- **Backend**: FastAPI + SQLite (sin MongoDB)
- **AI**: Kimi k2.5 via Moonshot AI (api.moonshot.ai/v1)
- **Ejecución**: sudo sniper con conf METASPLOIT_EXPLOIT=1

## Funcionalidades implementadas

### Core
- [x] Dashboard en español — estadísticas, scans recientes, hallazgos críticos con tiempo relativo
- [x] Nuevo Escaneo — selector de modo, opciones, contexto del objetivo, LHOST/LPORT
- [x] Monitor de Escaneo — terminal en tiempo real, barra de progreso por fases, contador de tiempo, actividad, alertas en caliente
- [x] Auto-análisis IA — Kimi analiza automáticamente al terminar sin clic manual
- [x] Plan de Ataque — fases priorizadas, comandos ejecutables, CVE mapping
- [x] Ataque en Cadena — IA decide siguiente paso automáticamente (hasta 5 pasos)
- [x] Metasploit Runner — ejecuta módulos MSF directamente desde el plan
- [x] Hallazgos — filtros por severidad y tipo, expandibles con enlace NVD
- [x] Campañas (workspaces) — grid de cards con estadísticas

### Inteligencia IA
- [x] Kimi k2.5 — análisis de resultados con plan multi-fase
- [x] Recomendación de modo antes de escanear
- [x] Chat con IA durante el escaneo
- [x] Contexto del objetivo (CTF, banco, red universitaria, etc.)
- [x] Auto-análisis al completar scan (sin clic manual)

### Integración real con Sn1per
- [x] sudo sniper con conf METASPLOIT_EXPLOIT=1
- [x] stdbuf -oL para output no bufferado
- [x] Detección automática en rutas conocidas de Kali
- [x] LHOST/LPORT configurables para payloads reversos
- [x] VULNSCAN eliminado (requería OpenVAS separado)

### UX
- [x] Interfaz completamente en español
- [x] Barra de progreso por fases del scan
- [x] Tiempo transcurrido en tiempo real
- [x] Indicador de actividad (líneas/seg)
- [x] Alertas en caliente (sesión obtenida, SQLi, FTP anónimo, etc.)
- [x] Notificaciones del navegador cuando scan completa
- [x] Borrar scans con confirmación
- [x] Tiempo relativo en lista de scans ("hace 2h")

## Config AI (backend/.env)
```
AI_API_KEY="sk-Tjogln5eXiFoxyYNZifgFRpUKDa3r7VLqQBbAbgAv1BmfSCw"
AI_MODEL="kimi-k2.5"
AI_BASE_URL="https://api.moonshot.ai/v1"
```

## Pendiente (backlog)
- [ ] Listener automático MSF cuando IA lanza payload reverso
- [ ] Reporte de sesiones Meterpreter en dashboard
- [ ] IA reactiva en tiempo real (reacciona mientras corre el scan)
- [ ] Memoria entre campañas
- [ ] Validación de hallazgos (confirmar antes de marcar CRITICAL)
- [ ] Exportar reporte PDF
