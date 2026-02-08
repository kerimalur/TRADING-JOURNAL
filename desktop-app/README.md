# Trading Journal - Desktop App

Eine professionelle Desktop-Anwendung für Trading-Journaling mit Electron, React und TypeScript.

## 🚀 Features

- **Native Desktop App** - Kein Browser, keine Cloud, vollständige Datensouveränität
- **Lokale Datenspeicherung** - JSON-Datenbank im User-Verzeichnis
- **Screenshot-Speicherung** - Echte Bilddateien statt Base64-Blobs
- **Moderne UI** - React 18 mit TailwindCSS
- **Typsicher** - Vollständige TypeScript-Integration
- **Offline-First** - Funktioniert komplett ohne Internet

## 📋 Voraussetzungen

- Node.js 18+ 
- npm oder yarn

## 🛠️ Installation

```bash
# In das Projektverzeichnis wechseln
cd desktop-app

# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev

# Electron-App im Dev-Modus starten
npm run electron:dev
```

## 🏗️ Build

```bash
# Windows .exe erstellen
npm run electron:build:win

# Das installierbare Setup befindet sich in:
# dist/Trading Journal Setup 1.0.0.exe
```

## 📁 Projektstruktur

```
desktop-app/
├── electron/                 # Electron Main Process
│   ├── main.ts              # Hauptprozess & IPC Handler
│   ├── preload.ts           # Context Bridge für Renderer
│   └── services/
│       ├── database.ts      # JSON-Datenbankservice
│       └── screenshots.ts   # Screenshot-Speicherung
│
├── src/                     # React App (Renderer Process)
│   ├── components/          # Wiederverwendbare UI-Komponenten
│   │   ├── layout/
│   │   ├── trades/
│   │   └── ui/
│   ├── pages/               # Seiten-Komponenten
│   ├── stores/              # Zustand State Management
│   ├── types/               # TypeScript Definitionen
│   ├── utils/               # Hilfsfunktionen
│   ├── App.tsx              # Root Komponente
│   └── main.tsx             # Entry Point
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 📊 Datenspeicherung

Alle Daten werden lokal im User-Verzeichnis gespeichert:

**Windows:** `%APPDATA%/trading-journal-desktop/`

```
trading-journal-desktop/
├── database.json           # Alle Trades & Konfiguration
└── screenshots/            # Trade-Screenshots als .png/.jpg
    ├── trade-001-1.png
    ├── trade-001-2.png
    └── ...
```

## 🔄 Migration von der Browser-Version

Die App unterstützt den Import von Backups aus der alten Browser-Version:

1. In der alten Version: Einstellungen → Backup erstellen
2. In der neuen Desktop-App: Einstellungen → Backup laden
3. Die Datei auswählen → Daten werden automatisch migriert

## 🔧 Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Desktop Container | Electron 31 |
| Frontend Framework | React 18 |
| Language | TypeScript 5.5 |
| Build Tool | Vite 5 |
| State Management | Zustand 4.5 |
| Styling | TailwindCSS 3.4 |
| Charts | Recharts 2.13 |
| Icons | Lucide React |
| Date Handling | date-fns 3.6 |

## 🔒 Sicherheit

- **Context Isolation** - Kein direkter Node.js-Zugriff aus dem Renderer
- **Preload Script** - Nur definierte APIs sind verfügbar
- **Lokale Daten** - Keine Cloud-Verbindungen, keine Telemetrie

## 📝 Verfügbare npm Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm run dev` | Startet Vite Dev Server |
| `npm run build` | Baut die React App |
| `npm run electron:dev` | Startet Electron mit Hot Reload |
| `npm run electron:build:win` | Erstellt Windows .exe Installer |
| `npm run lint` | Führt ESLint aus |
| `npm run type-check` | TypeScript Typ-Prüfung |

## 🎨 Design System

Die App verwendet ein dunkles Farbschema optimiert für Trading:

- **Background**: `#0a0a0f` (Deep Dark)
- **Surface**: `#111119` (Card Background)
- **Accent**: `#d4af37` (Gold)
- **Positive**: `#10b981` (Emerald Green)
- **Negative**: `#ef4444` (Red)

## 📄 Lizenz

MIT License - Freie Nutzung für private und kommerzielle Zwecke.
