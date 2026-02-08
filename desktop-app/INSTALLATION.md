# 🚀 Trading Journal Desktop - Installationsanleitung

## Voraussetzungen

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Git** (optional) - [Download](https://git-scm.com/)

---

## 📦 Schritt 1: Dependencies installieren

Öffne ein Terminal/PowerShell im `desktop-app` Ordner:

```powershell
cd "c:\Users\Kerim\Documents\Trading Journal\desktop-app"
npm install
```

Dies installiert alle benötigten Pakete (~2-3 Minuten).

---

## 🔧 Schritt 2: Entwicklungsmodus testen

```powershell
npm run electron:dev
```

Dies startet:
1. Den Vite Development Server (React)
2. Die Electron Desktop-App mit Hot-Reload

**Wichtig:** Bei Änderungen am React-Code wird die App automatisch aktualisiert!

---

## 🏗️ Schritt 3: Windows .exe erstellen

```powershell
npm run electron:build
```

Der Build-Prozess:
1. Kompiliert TypeScript → JavaScript
2. Baut die React-App (optimiert)
3. Erstellt den Windows Installer

**Ausgabe-Ordner:** `desktop-app/release/`

Die fertige Datei heißt: `Trading Journal Setup 1.0.0.exe`

---

## 📁 Ordnerstruktur nach dem Build

```
desktop-app/
├── release/                    # ← Hier liegt die .exe
│   ├── Trading Journal Setup 1.0.0.exe
│   └── win-unpacked/          # Entpackte Version
├── dist/                       # React Build
├── dist-electron/              # Electron Build
└── ...
```

---

## 🔄 Alte Daten migrieren

Die alten HTML/JS Dateien wurden nach `legacy-html-backup/` verschoben.

### Import von alten Backups:

1. Starte die neue Desktop-App
2. Gehe zu **Einstellungen** → **Backup laden**
3. Wähle deine alte Backup-Datei (.json)
4. Die Daten werden automatisch konvertiert

---

## 📍 Datenspeicherort

Alle Daten werden lokal gespeichert in:

**Windows:** `%APPDATA%\trading-journal-desktop\`

```
trading-journal-desktop/
├── database.json       # Trades & Konfiguration
└── screenshots/        # Trade-Screenshots
```

---

## ❓ Häufige Probleme

### "npm not found"
→ Node.js ist nicht installiert oder nicht im PATH

### "electron: command not found"
→ Führe `npm install` erneut aus

### Build schlägt fehl
→ Prüfe die TypeScript-Fehler mit `npm run type-check`

### Leere App nach Start
→ Warte bis der Vite-Server vollständig gestartet ist (Port 5173)

---

## 🛠️ Verfügbare Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Nur Vite Dev Server (ohne Electron) |
| `npm run electron:dev` | Entwicklungsmodus mit Electron |
| `npm run electron:build` | Windows .exe Installer erstellen |
| `npm run type-check` | TypeScript Fehler prüfen |
| `npm run lint` | ESLint Code-Prüfung |

---

## ✅ Checkliste

- [ ] Node.js 18+ installiert
- [ ] `npm install` ausgeführt
- [ ] `npm run electron:dev` funktioniert
- [ ] `npm run electron:build` erfolgreich
- [ ] .exe in `release/` vorhanden

---

**Viel Erfolg mit deinem Trading Journal! 📈**
