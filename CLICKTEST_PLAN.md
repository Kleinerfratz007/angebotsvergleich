# Klicktest-Plan Angebotsvergleich

> Konvention §11 (Browser-Tests) — präziser, user-übergreifender Klick-Plan.
> Stand: 2026-05-04 nach Settings-UI Deployment.

## Test-Accounts

| Rolle              | Account                       | Erwartung                       |
|--------------------|-------------------------------|---------------------------------|
| Admin (Eigentümer) | sartor.m@id-engineering.com   | Vollzugriff inkl. Settings      |
| Non-Admin          | beliebiger 2. Authentik-User  | KEIN Zugriff (Personal-App)     |
| Anonym             | nicht eingeloggt              | Redirect zu Authentik-Login     |

> Angebotsvergleich ist eine **Personal-App** (nur sartor.m). Cross-User-Tests
> prüfen primär, dass kein anderer User Daten sieht.

---

## Phase 0 · Smoke (jede Iteration zuerst, < 30 s)

| #   | Aktion                                                    | Erwartung                                              |
|-----|-----------------------------------------------------------|--------------------------------------------------------|
| 0.1 | curl https://…/angebotsvergleich/api/health               | HTTP 200, `{"status":"ok","app":"…"}`                  |
| 0.2 | Portal-Tile auf https://id-engineering-portal.com/portal/ | Card "Angebotsvergleich" dauerhaft sichtbar            |
| 0.3 | Tile-Klick                                                | Öffnet `/angebotsvergleich/` ohne 502/504              |
| 0.4 | Inkognito-Tab `/angebotsvergleich/`                       | Redirect zu Authentik (NICHT 200 ohne Login)           |

---

## Phase 1 · Auth & Sichtbarkeit (user-übergreifend)

### 1A — Admin (sartor.m)
| #    | Aktion                                | Erwartung                                  |
|------|---------------------------------------|--------------------------------------------|
| 1A.1 | Login → Tile klicken                  | Sidebar mit Vergleiche/Neu/Benachr/Einst.  |
| 1A.2 | "Einstellungen"                       | 5 Key-Cards laden                          |
| 1A.3 | "← Zum Portal"                        | Geht zurück nach `/portal/`                |
| 1A.4 | F5 auf jeder Seite                    | Bleibt eingeloggt                          |

### 1B — Non-Admin
| #    | Aktion                                              | Erwartung                                    |
|------|-----------------------------------------------------|----------------------------------------------|
| 1B.1 | Login als Non-Admin → Portal                        | Tile sichtbar / nicht (Definition!)          |
| 1B.2 | URL `/angebotsvergleich/einstellungen`              | "Nur für Admins"-Card (kein 500)             |
| 1B.3 | URL `/angebotsvergleich/`                           | Liste leer (eigene records=0)                |
| 1B.4 | POST `/angebotsvergleich/api/settings`              | 403 Admin only                               |
| 1B.5 | GET `/angebotsvergleich/api/comparisons/<id>`       | 404 / 403 (kein fremder Vergleich)           |

### 1C — Anonym
| #    | Aktion                                       | Erwartung                          |
|------|----------------------------------------------|------------------------------------|
| 1C.1 | `/angebotsvergleich/` ohne Cookie            | 302/307 → Authentik-Login          |
| 1C.2 | `/angebotsvergleich/api/health` ohne Cookie  | 200 (öffentlich)                   |
| 1C.3 | `/api/comparisons` ohne Cookie               | 401 oder 302                       |
| 1C.4 | `/api/settings` ohne Cookie                  | 401                                |

---

## Phase 2 · Settings-UI (Admin)

| #    | Aktion                                                    | Erwartung                                                     |
|------|-----------------------------------------------------------|---------------------------------------------------------------|
| 2.1  | `/einstellungen` öffnen                                   | 5 Key-Cards                                                   |
| 2.2  | Encryption-Banner sichtbar?                               | NEIN (APP_ENCRYPTION_KEY gesetzt)                             |
| 2.3  | API-Key leeren String speichern                           | Status "noch nicht gesetzt"                                   |
| 2.4  | API-Key "sk-ant-…" + Save                                 | Card maskiert, Status "✓ in DB"                               |
| 2.5  | Reload                                                    | Maskiert bleibt (DB persistent)                               |
| 2.6  | "Claude testen"                                           | Toast: "claude: claude-opus-4-7 → 'OK' (X in / Y out)"        |
| 2.7  | Falscher Key → testen                                     | Rote Toast: 401 unauthorized                                  |
| 2.8  | ANTHROPIC_MODEL = "claude-sonnet-4-5" + testen            | Toast mit Modell-Name                                         |
| 2.9  | MODEL leeren                                              | Default claude-opus-4-7                                       |
| 2.10 | GOOGLE_API_KEY leer → "Gemini testen"                     | Rote Toast: "Kein GOOGLE_API_KEY"                             |
| 2.11 | F12 Network beim Save                                     | POST nur key+value, KEIN Klartext im Response                 |
| 2.12 | DB: SELECT key, value_encrypted FROM app_settings         | Hex-encoded, NICHT lesbar                                     |

---

## Phase 3 · CRUD Vergleiche (Admin)

| #    | Aktion                                          | Erwartung                                            |
|------|-------------------------------------------------|------------------------------------------------------|
| 3.1  | "Neuer Vergleich" → Title="Test-1" → Submit     | Detail-Page                                          |
| 3.2  | Background-Info eintragen + Save                | Bleibt nach Reload                                   |
| 3.3  | Custom-Prompt eintragen + Save                  | s. o.                                                |
| 3.4  | PDF #1 upload                                   | Card sichtbar                                        |
| 3.5  | PDF #2 upload                                   | 2. Card                                              |
| 3.6  | PDF #3 upload                                   | 3. Card                                              |
| 3.7  | Doppelt-Upload                                  | Idempotent ODER neue Position (definieren)           |
| 3.8  | PDF > 10 MB                                     | Validation-Error, kein 500                           |
| 3.9  | .docx (kein PDF)                                | Validation-Error                                     |
| 3.10 | Lösche eine Offer                               | Card weg, DB-Row weg                                 |
| 3.11 | Lösche ganzen Vergleich                         | Cascading delete                                     |

---

## Phase 4 · KI-Run (braucht echten Key)

| #    | Aktion                                              | Erwartung                                                       |
|------|-----------------------------------------------------|-----------------------------------------------------------------|
| 4.1  | Vergleich + 3 PDFs (OneDrive/Claude Ai/Angebote/)   | 3 Offer-Cards                                                   |
| 4.2  | Background: "Stahlwinkel-Charge X"                  | Gespeichert                                                     |
| 4.3  | Custom-Prompt: "Liefertermin + Skonto wichtig"      | Gespeichert                                                     |
| 4.4  | "KI starten" (claude default)                       | Loading 30–90 s                                                 |
| 4.5  | F5/Tab-Wechsel während Run                          | Status persistiert (DB), nicht abgebrochen                      |
| 4.6  | Run fertig                                          | Ranking, Pareto, TCO, Weighted Score, Sensitivität              |
| 4.7  | Token-Kosten-Anzeige                                | Footer mit input/output tokens                                  |
| 4.8  | Re-Run                                              | Neuer Run, History                                              |
| 4.9  | PDF tauschen → Re-Run                               | Aktualisierter Inhalt                                           |
| 4.10 | KI liefert kaputtes JSON                            | Graceful Error-Card, kein Crash                                 |
| 4.11 | Internet-Cut (iptables im Container)                | 503-Toast, Job nicht halb-committed                             |

---

## Phase 5 · Notifications

| #   | Aktion                          | Erwartung                                       |
|-----|---------------------------------|-------------------------------------------------|
| 5.1 | Sidebar "Benachrichtigungen"    | Liste, leer initial                             |
| 5.2 | KI-Run abschließen (Phase 4)    | Notification "Vergleich fertig"                 |
| 5.3 | Push-Permission ablehnen        | App OK, kein Push                               |
| 5.4 | Push erlauben → Run             | Browser-Push (Konvention §13)                   |

---

## Phase 6 · Mobile + PWA

| #   | Aktion                                  | Erwartung                                  |
|-----|-----------------------------------------|--------------------------------------------|
| 6.1 | iPhone Safari → Portal                  | Tile sichtbar, klickbar                    |
| 6.2 | Sidebar / Hamburger / BottomNav         | Mobile-Variante (Konvention Mobile parity) |
| 6.3 | PDF-Upload via Safari Datei-Wahl        | Multipart klappt                           |
| 6.4 | "Zum Homescreen" → PWA                  | Standalone-Window                          |
| 6.5 | Flugzeugmodus                           | Online-only Hinweis-Banner, kein Crash     |

---

## Phase 7 · Resilienz und Security

| #   | Aktion                                                    | Erwartung                                  |
|-----|-----------------------------------------------------------|--------------------------------------------|
| 7.1 | XSS Title (script-Tag)                                    | Escaped, kein Alert                        |
| 7.2 | SQLi Title (DROP TABLE)                                   | String, DB intakt                          |
| 7.3 | Custom-Prompt 50 KB                                       | Gespeichert oder Validation                |
| 7.4 | API-Direkt-POST (Postman, ohne CSRF)                      | 401/403 (Cookie-only)                      |
| 7.5 | Long-Polling während Run                                  | Kein Memory-Leak                           |
| 7.6 | Container-Restart während Run                             | Run wird "failed" markiert                 |
| 7.7 | DB-Restart                                                | App reconnected                            |
| 7.8 | Cookie löschen → Reload                                   | Redirect Login                             |

---

## Phase 8 · Multi-User Isolation Beweise

| #   | Aktion                                              | Erwartung                            |
|-----|-----------------------------------------------------|--------------------------------------|
| 8.1 | sartor.m legt "Geheim" an, id=X                     |                                      |
| 8.2 | Non-Admin → `/angebotsvergleich/X` direkt           | 404 (NICHT 200)                      |
| 8.3 | Non-Admin GET /api/comparisons                      | Leere Liste                          |
| 8.4 | Non-Admin POST {id:X} an Update-Route               | 403/404                              |
| 8.5 | DB SELECT createdById FROM comparisons              | Genau ein User-ID-Wert               |

---

## Automation

- **Smoke-Loop** alle 60 s (siehe `/loop`)
- **Cron-Watch** Container-Healthcheck + Log-Tail "error/failed"
- **NotifyWithPref** Hook bei jedem failed Run an sartor.m

## Rollback

1. `docker tag …:previous …:latest && docker compose up -d`
2. `git revert` im Repo
3. Failed-Test in `docs/test-failures/` mit Screenshot
