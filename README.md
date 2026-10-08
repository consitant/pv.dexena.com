# PV-Portal (pv.dexena.com)

Kundenportal und Admin-Backend für das Monitoring von SolarMax-Wechselrichtern.
Ein Gateway (LXC-Container) nimmt die TCP-Verbindungen der WLAN-Sticks an (ein Port pro Wechselrichter, 18900–18999),
fragt die Wechselrichter per Modbus ab und sendet die Messwerte an `POST /api/ingest`.
Die Port-Zuordnung wird hier im Admin-Bereich gepflegt und vom Gateway über `GET /api/gateway/config` abgeholt.

Stack: Next.js 16 (App Router, Server Actions), Tailwind 4, Drizzle ORM + Neon Postgres, Auth.js v5 (Credentials, JWT),
Vercel Blob (privat, Firmware), zod, recharts, vitest + PGlite.

## Setup

1. **Neon/Vercel-Umgebung**: Die Neon-Integration setzt `DATABASE_URL` / `DATABASE_URL_UNPOOLED`; dazu kommen
   `BLOB_READ_WRITE_TOKEN` (privater Blob-Store), `AUTH_SECRET` und `CRON_SECRET` (siehe `.env.example`).
   Alle Variablen in Vercel für Production (und ggf. Preview) setzen, lokal: `vercel env pull .env.local`.
   `AUTH_URL` wird **nicht** benötigt (`trustHost: true`).
2. Abhängigkeiten: `npm install`
3. **Migration** (nutzt `DATABASE_URL_UNPOOLED` aus `.env.local`):
   ```bash
   npm run db:migrate          # wendet drizzle/*.sql an
   # Schemaänderungen: src/db/schema.ts anpassen → npm run db:generate → Migration committen
   ```
4. **Admin anlegen** (Passwort wird zufällig erzeugt und nur einmal ausgegeben):
   ```bash
   npm run db:seed-admin -- admin@example.com
   ```
5. Entwicklung: `npm run dev` · Tests: `npm test` · Lint: `npm run lint` · Build: `npm run build`

## Betrieb

### Gateway (Device) registrieren
- Im Admin unter **Gateways → Gateway registrieren** oder per CLI: `npm run db:create-device -- "LXC solarmax-gateway"`.
- Das Token (`smx_…`) wird **einmalig** angezeigt, gespeichert wird nur der SHA-256-Hash. Bei Verlust: „Neues Token erzeugen“.
- Abfrageintervall (`pollIntervalS`, Standard 300 s) und Offline-Schwelle (Standard 15 min) sind je Gateway einstellbar.

### Gateway verbinden
Im Gateway das Portal und Token hinterlegen; es nutzt:
- `GET /api/gateway/config` – Port-Zuordnung (`{pollIntervalS, inverters:[{ref,port,enabled}]}`), nur Inverter dieses Gateways
- `POST /api/ingest` – Messwerte/Heartbeat (Body ≤ 1 MB, ≤ 500 Messwerte), Antwort `{accepted, duplicates, rejected}`
- `GET /api/firmware/latest?current=x` – 204 oder `{version,url,sha256,size}` (URL 10 min gültig, HMAC-signiert)

Alle mit `Authorization: Bearer <Token>`. Vertrag: `solarmax/docs/api-contract.md`.

### Kunde anlegen
**Kunden → Neuer Kunde**, danach auf der Kundenseite Anlagen (Sites) und Login-Benutzer anlegen
(Passwort leer lassen → wird generiert und einmalig angezeigt).

### Wechselrichter anlegen und Port zuweisen
**Wechselrichter → Wechselrichter anlegen**: Kennung (Modul-ID des Sticks, `**` wird entfernt), Gateway wählen –
der nächste freie Port wird vorgeschlagen –, optional Kunde/Anlage. Die Seite zeigt den AT-Befehl für den Stick:

```
AT+SOCKB=TCP,<port>,solarmax.dexena.com
AT+Z
```

Kunde/Anlage lassen sich jederzeit umhängen (Anlage legt den Kunden fest); „Deaktivieren“ schließt den Port im Gateway
beim nächsten Config-Abruf.

## Kundenbereich
- **Übersicht** `/dashboard`: Portfolio-Karten je Anlage (Leistung, heute, Status, Sparkline) und Auswertung über alle Anlagen.
  Bei genau einer Anlage direkte Weiterleitung auf deren Dashboard. Admins: `?customer=<id>` („Als Kunde ansehen“, klar markiert).
- **Anlage** `/dashboard/sites/<id>`: Zeiträume `?view=day|month|year|total&date=YYYY-MM-DD|YYYY-MM|YYYY`, Wechselrichter-Filter
  `?inv=<id>,<id>`, Vergleich Vormonat/Vorjahr (laufende Zeiträume: gleicher Zeitraum), Ertragskalender, Energiefluss (Schätzung),
  CSV-Export (`/api/export`, serverseitig auf den Kunden beschränkt; UTF-8 mit BOM, `;`, Dezimalkomma).
- **Wechselrichter** `/dashboard/inverters/<id>`: PV-Strings, AC-Phasen, Temperatur, Statusverlauf je Tag.
- **Strompreis** `/dashboard/sites/<id>/settings`: Tarife mit Gültigkeit (Bezugspreis, Einspeisevergütung, Eigenverbrauchsquote);
  Ersparnis je Tag mit dem gültigen Tarif. Ohne Tarif wird keine Ersparnis berechnet (Hinweis statt 0 €). Pflege durch Admin und Kunde.
- **Status „Nachtruhe“**: offline zwischen ca. 18 und 8 Uhr (Berlin) oder letzter Wert < 50 W → grau statt Störung.
- **Konto** `/account`: Profil (Name/Telefon) und eigenes Passwort ändern.

## Kundenverwaltung (Admin)
- Liste mit Suche (Name, Kundennr., E-Mail, Ort, Tags), Filtern (aktiv/inaktiv, mit Störung, ohne Daten > 24 h), Sortierung, Pagination, Status-Ampel.
- Kundennummer automatisch (`K-00001`, Sequenz `customer_no_seq`), editierbar. Privat/Firma, Ansprechpartner, Adresse, Tags,
  Vertragsbeginn, Wartungsvertrag + nächster Termin, interne Notizen.
- Detailseite mit Tabs: Übersicht, Anlagen (kWp, Inbetriebnahme, Tarif), Wechselrichter (Port, AT-Befehl), Benutzer (sperren,
  Passwort neu erzeugen – einmalig angezeigt), Notizen & Verlauf (Audit-Log je Kunde).
- Kunde deaktivieren sperrt den Login aller seiner Benutzer sofort (auch laufende Sessions). Löschen nur mit eingetipptem Kundennamen.
- **E-Mail-Versand** (Einladung, Passwort vergessen) ist noch nicht gebaut. Vorgesehen: Mail-Provider anbinden, Tabelle
  `password_reset_tokens` (Hash, Ablauf, einmalig) und Route `/reset/<token>`; bis dahin vergibt der Admin Passwörter.

## Datenmodell und Aggregation
- `measurements` (PK `inverter_id, ts`) – Ingest ist idempotent (`ON CONFLICT DO NOTHING`).
- **Tagesertrag = max(`energy_today_wh`) je Inverter und Kalendertag in Europe/Berlin**
  (`(ts AT TIME ZONE 'Europe/Berlin')::date`); Monat = Summe der Tage, Jahr = Summe der Monate,
  Gesamt = letzter `energy_total_kwh`. Beim Ingest wird der aktuelle Tag sofort per `GREATEST` aktualisiert.
- Crons (`vercel.json`, Header `Authorization: Bearer $CRON_SECRET`):
  - `/api/cron/aggregate` alle 15 min – rechnet die letzten 2 Berliner Tage + betroffene Monate neu
  - `/api/cron/offline` alle 5 min – markiert Gateways (nach `offline_after_min`) und Inverter (15 min ohne Erfolg) offline,
    räumt alte Rate-Limit-Einträge auf

## Sicherheit
- Kundenbereich: jede Abfrage läuft über `src/lib/portal-data.ts` und filtert über die `customer_id` aus der Session;
  fremde IDs → 404. Rolle und Kunde werden bei jedem Request frisch aus der DB geladen (nicht aus dem JWT).
- Admin-Seiten und **alle** Server Actions prüfen `requireAdmin()` serverseitig; `src/proxy.ts` leitet nur optimistisch um.
- Passwörter bcrypt (Cost 12), Login-Rate-Limit pro IP und E-Mail, generische Fehlermeldung.
- Rate-Limits (Postgres, Fixed Window): Ingest 30/min je Gateway, ungültige Device-Tokens 10/min je IP.
- Security-Header (CSP, X-Frame-Options, HSTS …) in `next.config.ts`.
- **Öffentliches Repo:** keine Secrets, echten Seriennummern, IPs oder Kundendaten committen.

## Tests
`npm test` startet eine In-Process-Postgres (PGlite) mit denselben Migrationen und prüft Ingest (Auth, Validierung,
Duplikate, fremde Inverter, Heartbeat), Rechtetrennung zwischen Kunden, Aggregation (Berliner Mitternacht,
Sommer-/Winterzeit, Maximum statt Differenz, Monatssummen), Gateway-Config, Offline-Erkennung, Admin-Logik und Login.
