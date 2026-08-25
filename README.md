# Claude Queue Platform

Multi-User-Plattform mit eigener Authentifizierung, in der jeder Nutzer Projekte anlegt und
Tasks in eine Queue schreibt, die automatisch abgearbeitet wird - inklusive automatischem
Warten und Fortsetzen bei Rate-/Usage-Limits. Pro Nutzer frei wählbar: eigener Anthropic
API-Key (serverseitig, 24/7) oder ein lokaler Client mit dem eigenen Claude-Abo (läuft,
solange das eigene Gerät online ist).

## Features

- **Zwei Ausführungsmodi, eine Queue**: Anthropic API-Key (serverseitig) oder lokaler
  Agent, der Tasks über die installierte Claude-Code-CLI ausführt
- **Automatisches Rate-Limit-Handling**: Tasks pausieren bei Limits selbstständig und
  setzen zur Reset-Zeit ohne manuelles Zutun fort
- **Modellauswahl pro Task**: im API-Key-Modus live von der Anthropic Models-API, im
  CLI-Modus über Aliase (`opus`/`sonnet`/`haiku`), die immer auf die aktuelle Version zeigen
- **Volle Task-Kontrolle**: Pausieren (die Claude-Session bleibt erhalten), Fortsetzen
  per Session-Resume und endgültiges Abbrechen
- **Live-Logs im Dashboard**: Tool-Aufrufe, Textausgaben, Token-Verbrauch, Kosten und
  Dauer pro Task, gestreamt per WebSocket
- **Projekt-Arbeitsordner**: jedes Projekt bekommt automatisch einen eigenen Unterordner
  im Basisverzeichnis des Agenten
- **Concurrency 1-4** pro Nutzer, wirkt sofort in beiden Modi
- **Mandantentrennung**: Projekte, Tasks und Geräte eines Nutzers sind für andere nie
  erreichbar

## Aufbau

```
apps/api/       NestJS-Backend (Auth, Projekte, Tasks, Queue, WebSocket, Device-Pairing)
apps/web/       Next.js-Dashboard
apps/agent/     Lokaler Client (npm-CLI) für den Abo-Modus
migrations/     SQL-Schema (wird beim Start automatisch angewendet)
k8s/            Kubernetes-Manifeste für das Prod-Deployment (Flux)
docker-compose.yml
```

## Schnellstart mit Docker (empfohlen)

Voraussetzung: Docker + Docker Compose.

```bash
cp .env.example .env
# JWT_SECRET und CLAUDE_KEY_ENCRYPTION_SECRET in .env auf zufällige, lange Werte setzen
# z.B. mit: openssl rand -hex 32

docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

Beim ersten Start legt das Backend automatisch das Datenbankschema an (kein manueller
Migrationsschritt nötig).

## Manueller Start ohne Docker (für Entwicklung)

Voraussetzungen: Node.js 20+, eine laufende PostgreSQL- und Redis-Instanz.

```bash
# Backend
cd apps/api
cp .env.example .env   # Werte anpassen (DATABASE_URL, REDIS_URL, Secrets)
npm install
npm run build && npm run start
# oder für Hot-Reload: npm run start:dev

# Frontend (neues Terminal)
cd apps/web
npm install
npm run dev
```

## Ersten Nutzer anlegen und testen

1. http://localhost:3000/register öffnen, Konto anlegen.
2. Unter „Einstellungen" Modus wählen:
   - **API-Key**: eigenen Anthropic API-Key eintragen, Concurrency (1-4) wählen, speichern.
   - **Lokaler Client**: „Neues Gerät koppeln" klicken, den angezeigten Befehl auf dem
     eigenen Rechner ausführen (siehe unten); dort muss Claude Code installiert und via
     `claude login` eingeloggt sein.
3. Ein Projekt anlegen, einen Task in die Queue schreiben - er wird automatisch abgearbeitet.

### Lokalen Agenten installieren (nur für den Modus „Lokaler Client")

```bash
cd apps/agent
npm install && npm run build
npm link   # macht "claude-queue-agent" global verfügbar

claude-queue-agent pair --url http://localhost:4000 --code <CODE-AUS-DEM-DASHBOARD> --name "Mein Laptop"
claude-queue-agent start
```

Weitere Befehle:

```bash
claude-queue-agent config                    # aktuelle Konfiguration anzeigen
claude-queue-agent config --baseDir <Pfad>   # Basisverzeichnis für Projektordner setzen
```

Der Agent muss laufen, damit Tasks im lokalen Modus ausgeführt werden. Läuft er nicht,
bleiben Tasks als „Wartet" in der Queue und werden automatisch nachgeholt, sobald er
wieder online ist. Windows wird unterstützt (die npm-Installation der Claude-CLI wird
automatisch aufgelöst).

## Deployment auf Kubernetes

Die Manifeste unter [`k8s/`](k8s/) sind für ein k3s-Cluster (arm64) mit Flux, Gateway API,
CloudNativePG und SealedSecrets ausgelegt:

- Postgres läuft als CNPG-Cluster; die App-Zugangsdaten erzeugt der Operator
- `JWT_SECRET` und `CLAUDE_KEY_ENCRYPTION_SECRET` werden als SealedSecret eingespielt
  (Anleitung im Kopf von `k8s/01-secrets-sealed.yaml`)
- Routing per HTTPRoute über das bestehende Gateway; die nötigen Listener und
  Zertifikate sind im Kopf von `k8s/06-routes.yaml` dokumentiert
- Die Images kommen aus der CI/CD-Pipeline (siehe unten) und sind multi-arch
  (amd64 + arm64)

## CI/CD

Die Pipeline ([`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)) baut bei jedem
Push und Pull Request alle drei Apps. Auf `main` wird zusätzlich per semantic-release
(Conventional Commits) automatisch versioniert und released: Die Images
`ghcr.io/lukislp/claude-queue-api` und `ghcr.io/lukislp/claude-queue-web` werden nativ für
amd64 und arm64 gebaut, zu einem Multi-Arch-Manifest zusammengeführt und mit Trivy gescannt.

## Architektur-Kernpunkte

- **Dispatch**: `apps/api/src/tasks/tasks.service.ts` entscheidet, ob ein Task an BullMQ
  (API-Key-Modus) oder an den WebSocket-Dispatcher (lokaler Modus) geht.
- **Rate-Limit-Handling**: `apps/api/src/queue/queue-manager.service.ts` (API-Key-Modus)
  und `apps/agent/src/claude-runner.ts` (lokaler Modus) setzen bei einem Limit den Status
  `PAUSED_RATE_LIMIT` mit `retryAt` und planen selbstständig einen verzögerten neuen
  Versuch ein.
- **Task-Kontrolle**: Pausieren beendet den laufenden CLI-Prozess, behält aber die
  Claude-Session-ID; Fortsetzen reiht den Task mit `--resume` wieder ein.
- **Rohes SQL statt ORM**: Migrationen liegen unter `migrations/*.sql` und werden beim
  Start automatisch und idempotent angewendet.
