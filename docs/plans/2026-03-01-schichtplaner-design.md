# Schichtplaner 2.0 – Design Document

> **Datum:** 01.03.2026
> **Status:** Approved
> **Basiert auf:** Reverse-Engineering von schichtplaner-online.de (1600 Zeilen technische Doku)

---

## 1. Projektziel

Nachbau von schichtplaner-online.de mit modernem Tech-Stack, besserem Design und KI-Funktionen. Einsatz: Erst intern bei yoummday, dann als SaaS-Produkt. Multi-Tenant von Anfang an.

---

## 2. Tech-Stack

| Layer | Technologie |
|---|---|
| **Framework** | Next.js 15 + App Router |
| **Sprache** | TypeScript |
| **UI** | Tailwind CSS + shadcn/ui |
| **Icons** | Lucide Icons |
| **DB** | PostgreSQL 16 + Prisma ORM |
| **Auth** | NextAuth.js v5 (Credentials + Magic Link) |
| **Realtime** | Socket.io (Custom Server) |
| **KI** | Claude API (Anthropic SDK) |
| **i18n** | next-intl (DE + EN, erweiterbar) |
| **Drag & Drop** | dnd-kit |
| **Charts** | Recharts |
| **Export** | @react-pdf/renderer + exceljs |
| **State** | Zustand + React Query |
| **Validation** | Zod |
| **Deployment** | Docker Compose (self-hosted) |

---

## 3. Deployment (Self-Hosted)

```yaml
# Docker Compose
services:
  app:        Next.js Custom Server (Node.js) + Socket.io
  postgres:   PostgreSQL 16
  redis:      Redis (Session Cache + Socket.io Adapter)
  minio:      MinIO (S3-kompatibler Datei-Storage)

# Reverse Proxy: Caddy (HTTPS + WebSocket Upgrade)
```

Alles auf dem aktuellen Server (`/root/workspace/schichtplaner`).

---

## 4. Datenbank-Schema

### Multi-Tenancy

Row-Level Security über `organizationId` auf allen Tabellen. Prisma Middleware filtert automatisch.

### Kern-Entities

```
Organization (Firma)
  ├── members[]              → User ↔ Org (mit Rolle)
  ├── branches[]             → Filialen
  ├── divisions[]            → Arbeitsbereiche (Farbe, Beschreibung)
  ├── schedules[]            → Schichtpläne (KW-basiert)
  │   ├── shifts[]           → Einzelne Schichten
  │   │   ├── bookings[]     → MA-Buchungen
  │   │   └── requests[]     → Wunschplan-Anfragen
  │   ├── briefings[]        → Briefing-Texte
  │   └── liveSession        → Live-Modus-State
  ├── timeRecords[]          → Zeiterfassungen
  ├── timeCategories[]       → Erfassungs-Kategorien
  ├── absences[]             → Abwesenheiten
  ├── absenceCategories[]    → Abwesenheits-Kategorien (Farbe)
  ├── messages[]             → Nachrichten
  ├── files[]                → Portal-Dateien
  ├── folders[]              → Portal-Ordner
  └── topics[]               → Forum-Themen
      └── posts[]            → Forum-Beiträge

User (global, Multi-Org-fähig)
  ├── email, passwordHash
  ├── firstName, lastName, nickname
  ├── phone, profileImage
  ├── locale                 → Sprach-Präferenz
  └── memberships[]          → OrganizationMember
```

### Unterschiede zum Original

- UUIDs statt Auto-Increment IDs
- `DateTime` statt Unix-Timestamps
- Soft-Deletes (`deletedAt`)
- User global (Multi-Org), Employee = OrganizationMember
- Feiertage als separate Tabelle (DE/AT/CH + erweiterbar)

---

## 5. Authentifizierung & Rollen

### Auth-Flow

- NextAuth.js v5 mit Credentials Provider + Magic Link
- JWT-basiert, HttpOnly Cookies, 30 Tage Refresh Token
- Registrierung: Firma erstellen → User wird OWNER
- MA-Einladung: Email mit Aktivierungslink → Passwort setzen

### Rollen-Matrix

| Funktion | OWNER | ADMIN | MANAGER | EMPLOYEE |
|---|---|---|---|---|
| Schichtplan erstellen/bearbeiten | ✅ | ✅ | ✅ | ❌ |
| Mitarbeiter buchen/austragen | ✅ | ✅ | ✅ | ❌ |
| Wunschplan senden | ✅ | ✅ | ✅ | ✅ |
| Zeiterfassung (eigene) | ✅ | ✅ | ✅ | ✅ |
| Zeiterfassung (andere) | ✅ | ✅ | ✅ | ❌ |
| Mitarbeiter verwalten | ✅ | ✅ | ❌ | ❌ |
| Einstellungen | ✅ | ✅ | ❌ | ❌ |
| KI-Features | ✅ | ✅ | Eingeschränkt | Nur Chat |
| Auswertung | ✅ | ✅ | ✅ | ❌ |
| Admins ernennen/Org löschen | ✅ | ❌ | ❌ | ❌ |

---

## 6. Module & Routing

```
app/[locale]/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── activate/[token]/
│
├── (dashboard)/                    # Auth-Layout mit Top-Nav
│   ├── schedule/
│   │   ├── flexible/[kw]/         # Hauptansicht
│   │   ├── classic/[kw]/
│   │   ├── employee/[kw]/
│   │   └── month/[month]/
│   ├── time/                       # Zeiterfassung
│   ├── employees/
│   │   └── [id]/                   # Detail + E-Dash
│   ├── divisions/                  # Arbeitsbereiche
│   ├── portal/
│   │   ├── inbox/
│   │   ├── sent/
│   │   ├── trash/
│   │   ├── files/
│   │   └── topics/[id]/
│   ├── reporting/[month]/          # Auswertung
│   ├── settings/                   # Alle Sub-Bereiche
│   └── ai/                         # NEU: KI-Dashboard
│       ├── chat/
│       └── insights/
│
└── api/                            # ~60 API Routes
    ├── auth/
    ├── schedules/
    ├── shifts/
    ├── time/
    ├── employees/
    ├── divisions/
    ├── messages/
    ├── files/
    ├── reporting/
    ├── settings/
    ├── ai/
    └── ws/
```

### Top-Navigation

7 Tabs wie Original: SCHICHTPLÄNE | ZEITERFASSUNG | MITARBEITER | ARBEITSBEREICHE | PORTAL | AUSWERTUNG | EINSTELLUNGEN

Plus: KI-Sparkle-Icon rechts für den AI-Bereich.

---

## 7. UI/Design-System

### Farbpalette

```
Primary:      #6366f1 (Indigo)
Success:      #22c55e (Grün - voll besetzt)
Warning:      #f59e0b (Amber - Unterbesetzung)
Danger:       #ef4444 (Rot - Fehler/gesperrt)
Live-Modus:   #a855f7 (Purple, pulsierend)
Heute:        #3b82f6 (Blau)
Neutral:      Slate-Palette (50-950)
Background:   #fafafa (Light) / #0f172a (Dark)
```

### Dark Mode

Von Anfang an, Toggle in Top-Bar.

### Komponenten-Mapping (Original → Modern)

| Original | Modern |
|---|---|
| Bootstrap Modal | shadcn Dialog / Sheet |
| AlertifyJS | Sonner Toasts (top-right) |
| jQuery UI DnD | dnd-kit |
| Bootstrap Datetimepicker | shadcn Calendar + Time Picker |
| Bootstrap Multiselect | shadcn Combobox |
| jQuery DataTables | TanStack Table |
| Font Awesome | Lucide Icons |
| pace.js | nprogress |

### Schichtplan-Grid

- 7-Spalten Mo-So (wie Original)
- Schicht-Karten mit subtilen Schatten
- Division-Farbe als linker Akzent-Streifen
- Smooth Animationen beim Buchen/Austragen
- DnD zum Verschieben von MA zwischen Schichten
- Hover Quick-Actions

### Responsive

- Desktop (1280px+): Volles 7-Spalten-Grid
- Tablet (768px): 3-4 Spalten, scrollbar
- Mobile (<768px): Tagesansicht, Swipe zwischen Tagen

### Typografie

Inter (System-Font-Stack Fallback)

---

## 8. KI-Features (Claude API)

### 8.1 KI-Auto-Planer

- Button "KI-Vorschlag" im Schichtplan
- Sammelt Kontext: bisherige Pläne, Verfügbarkeiten, Abwesenheiten, Stunden-Limits
- Claude generiert optimalen Plan als JSON
- Vorschlag-Overlay (halbtransparente Karten)
- Admin akzeptiert/ablehnt einzeln oder gesamt

### 8.2 Intelligente MA-Empfehlung

- Beim Öffnen eines leeren Buchungs-Slots
- Score-Badge (0-100) basierend auf: Stunden-Balance, Verfügbarkeit, Bereich, Historie
- Regelbasiert (kein LLM nötig)

### 8.3 Anomalie-Erkennung

- Automatisch bei jeder Zeiterfassung
- Prüft: zu lange Schichten, Lücken, Doppelungen, Soll/Ist-Abweichung
- Gelbe/rote Badges in Zeiterfassungs-Übersicht

### 8.4 Prognose-Dashboard

- Tab im Auswertungs-Bereich
- Trendlinie letzte 3 Monate → Prognose
- Personalbedarf-Vorhersage
- Claude für natürlichsprachliche Zusammenfassung

### 8.5 NLP-Chat Interface

- Floating Button unten rechts
- Natürlichsprachliche Befehle (DE/EN)
- Claude mit Tool-Use Pattern → mappt auf interne APIs
- Bestätigung vor destruktiven Aktionen

### 8.6 Smart Briefing Generator

- Button "KI-Briefing" beim Briefing erstellen
- Claude analysiert Schichtplan → generiert Briefing
- Admin kann bearbeiten vor Veröffentlichung

### KI-Konfiguration

- Alle Features optional aktivierbar in Einstellungen
- Caching wo möglich
- Rate-Limiting pro Organization

---

## 9. Realtime (Socket.io)

### Events

```
schedule:updated      → Schicht CRUD
booking:changed       → MA gebucht/ausgetragen
live:started/stopped  → Live-Modus Toggle
live:booking          → Echtzeit-Buchung
time:watch            → Stoppuhr Start/Stop
message:new           → Neue Nachricht
ai:result             → KI-Berechnung fertig
```

### Rooms

- Organization-Room (alle Events der Firma)
- Schedule-Room (Live-Modus Events)
- Fallback: Polling alle 5s wenn WebSocket fehlschlägt

---

## 10. Export

| Format | Library | Verwendung |
|---|---|---|
| PDF | @react-pdf/renderer | Stundenzettel, Schichtpläne (MiLog) |
| Excel | exceljs | Auswertungen, Zeiterfassung |
| CSV | Eigene Logik | Daten-Export |
| HTML | Server-Rendering | Druckbare Ansicht |

---

## 11. Multi-Language (next-intl)

- Namespace-basierte JSON-Files (`messages/de.json`, `messages/en.json`)
- Sprach-Erkennung: Browser → User-Setting → Org-Default → Fallback DE
- Datums-/Zeitformate locale-aware (date-fns)
- KI-Chat antwortet in gewählter Sprache
- User-generierte Inhalte werden NICHT übersetzt

---

*Design approved am 01.03.2026*
