# INTERFACE — `angebotsvergleich`

> **Zweck:** Kanonische Schnittstellen-Dokumentation dieser App fuer alle anderen Apps.
> **Pflicht laut Konvention §23.10:** Bei jeder Schnittstellen-Aenderung in selbem Commit aktualisieren.
> **Verweis:** Inbox-Schema steht in `APP_CONVENTION.md §8 + §8.1`. Diese Datei beschreibt nur das App-spezifische.
> **Stand:** 2026-05-06 (initial scaffold)

---

## 1. Basis

| Eigenschaft | Wert |
|-------------|------|
| App-Slug | `angebotsvergleich` |
| Backend-Port | `4110` (extern via nginx unter `/angebotsvergleich/`) |
| DB-Port (intern) | N/A |
| Container-Name | `angebotsvergleich-app` |
| Stack | Next.js + Prisma + Postgres |
| Repo | https://github.com/Kleinerfratz007/angebotsvergleich |

## 2. Health & Status

```
GET /angebotsvergleich//api/health
→ 200 { status: "ok", app: "angebotsvergleich", version: "<x.y.z>", db: "ok", latency_ms: <n>, uptime_s: <n>, timestamp: "<iso>" }
```

Schema-Pflicht laut §24.9. TODO: Verifikation in App-Code, falls noch abweichend.

## 3. Inbox-Verhalten

### 3.1 Empfaenger (was die App akzeptiert)

| `type` | Quelle (`fromApp`) | Domain-Action beim Accept | Validierungen |
|--------|-------------------|---------------------------|---------------|
| TODO | TODO | TODO | TODO |

**Inbox-API-Endpoints (alle hinter Auth):**
- `POST /angebotsvergleich//api/inbox` (Service-Token) — Push empfangen
- `GET /angebotsvergleich//api/inbox?status=pending` (User-Auth) — Liste
- `GET /angebotsvergleich//api/inbox/count` (User-Auth) — Pending-Counter
- `POST /angebotsvergleich//api/inbox/:id/accept` (User-Auth)
- `POST /angebotsvergleich//api/inbox/:id/reject` (User-Auth, Body: `{reviewNote}`)
- `POST /angebotsvergleich//api/inbox/bulk-accept` (User-Auth)
- `POST /angebotsvergleich//api/inbox/bulk-reject` (User-Auth)

TODO: Status der Implementation pro Endpoint vermerken.

### 3.2 Sender (was die App pusht)

| `type` | Ziel-App | Trigger | Required `payload`-Felder |
|--------|---------|---------|----------------------------|
| TODO | TODO | TODO | TODO |

**Sender-API:**
- `POST /angebotsvergleich//api/inbox-push` (User-Auth)

### 3.3 Inbox-Schema-Stand (Pflicht-Sektion fuer Migrations-Tracking)

**Aktuell vorhanden** (TODO: Boxen anhaken nach Schema-Audit):
- [ ] `id`, `fromApp`, `fromUserId`, `fromUserName`, `type`, `payload`, `refUrl`, `status`, `createdAt`, `reviewedAt`, `reviewedById`, `reviewNote`
- [ ] `targetUserId`
- [ ] `priority` (Reserve §8.1)
- [ ] `expiresAt` (Reserve §8.1)
- [ ] `correlationId` (Reserve §8.1)
- [ ] `meta` (Reserve §8.1)

**Migrations-TODO (was fehlt noch laut §8.1):** TODO

## 4. Service-Token-Variablen

**Diese App liest (als Empfaenger):**
- `INBOX_SERVICE_TOKEN` — gemeinsam mit allen anderen Empfaenger-Apps geteilt

**Diese App liest (als Sender):**
- TODO: `<EMPFAENGER>_INBOX_TOKEN` pro Ziel-App

## 5. Master-Data-Konsumenten

Welche Master-Data-Entitaeten liest die App?

- TODO: `GET /master-data/api/projects?scope=visible-to-me` — Begruendung
- TODO: `GET /master-data/api/customers?scope=common` — Begruendung
- TODO: `GET /master-data/api/users` — Begruendung

**Spiegelung lokal?** TODO: ja/nein. Falls ja: Tabelle + Subscribe-Pattern via `/api/master-data-sync`.

## 6. Lesbare REST-API fuer andere Apps

| Endpoint | Auth | Zweck | Schema-Snippet |
|----------|------|-------|-----------------|
| TODO | TODO | TODO | TODO |

TODO: Sobald §32 OpenAPI-Pflicht greift, hier Verweis auf `INTERFACE.openapi.json`.

## 7. Versionierung

- App-Version: siehe `package.json` (semver)
- Schnittstellen-Version: `0.1.0` (initial scaffold)
- Letzter Inbox-Schema-Update: 2026-05-06 (Konvention Rev 12)

## 8. Deprecated / Abgekuendigt

(Welche Endpoints/Felder sollen nicht mehr verwendet werden, ab wann fliegen sie raus.)

Stand 2026-05-06: keine Deprecations.
