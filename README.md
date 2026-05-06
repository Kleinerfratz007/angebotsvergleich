# angebotsvergleich

ID Engineering Portal — angebotsvergleich

Teil des **ID Engineering Portal** Stacks. Für Konventionen-Übersicht siehe `/opt/id-portal-shared/conventions/APP_CONVENTION.md`.

## Setup

```bash
npm install
cp .env.example .env  # Werte ausfüllen
npm run dev
```

## Deployment

Per pm2 oder docker compose. Siehe `docker-compose.yml` oder `ecosystem.config.js`.

## Konventionen

- §1 SSO via Authentik
- §8 Inter-App-Inbox Schema
- §13 Notifications-API als Source-of-Truth
- §35 Pre-Push-Hook (siehe `.git/hooks/pre-push`)

Vollständige Liste: `/opt/id-portal-shared/conventions/`

## Inbox-Verhalten

Siehe `INTERFACE.md`.

---
*README scaffold by Claude review run 2026-05-06 (§28 Konvention).*
