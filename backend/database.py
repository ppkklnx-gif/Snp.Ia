import aiosqlite
import json
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')

DB_PATH = os.environ.get("SQLITE_DB", "/app/backend/sniperai.db")


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    db = await get_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            target TEXT NOT NULL,
            mode TEXT DEFAULT 'normal',
            workspace TEXT,
            status TEXT DEFAULT 'pending',
            options TEXT DEFAULT '{}',
            created_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            log_file TEXT,
            pid INTEGER,
            demo INTEGER DEFAULT 0,
            has_plan INTEGER DEFAULT 0,
            error TEXT
        );

        CREATE TABLE IF NOT EXISTS findings (
            id TEXT PRIMARY KEY,
            scan_id TEXT,
            workspace TEXT,
            type TEXT,
            severity TEXT,
            title TEXT,
            description TEXT,
            host TEXT,
            port INTEGER,
            service TEXT,
            product TEXT,
            version TEXT,
            cve TEXT,
            raw TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS attack_plans (
            id TEXT PRIMARY KEY,
            scan_id TEXT UNIQUE,
            target TEXT,
            workspace TEXT,
            executive_summary TEXT,
            risk_level TEXT,
            target_profile TEXT,
            key_findings TEXT DEFAULT '[]',
            attack_phases TEXT DEFAULT '[]',
            immediate_next_command TEXT,
            cve_findings TEXT DEFAULT '[]',
            remediation_summary TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            scan_id TEXT,
            user_message TEXT,
            ai_response TEXT,
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS chain_runs (
            id TEXT PRIMARY KEY,
            parent_scan_id TEXT,
            step INTEGER DEFAULT 0,
            status TEXT DEFAULT 'running',
            scan_ids TEXT DEFAULT '[]',
            log TEXT DEFAULT '',
            created_at TEXT,
            completed_at TEXT
        );
    """)
    await db.commit()
    await db.close()


def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    # Parse JSON fields
    for field in ["options", "key_findings", "attack_phases", "cve_findings"]:
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                pass
    for field in ["scan_ids"]:
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                pass
    # Convert demo/has_plan ints to bools
    for field in ["demo", "has_plan"]:
        if field in d:
            d[field] = bool(d[field])
    return d
