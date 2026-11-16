# DocView

Et lille program til at **vise** kodestumper og filer. Det er ikke en editor. Indsæt SQL, HTML, XML, JSON, CSS, YAML osv., så finder DocView selv ud af hvilket sprog det er, formaterer det pænt og farvelægger det.

- **Genkender selv sproget**, også for små stumper uden `<!DOCTYPE>`/`<?xml>` (fx en enkelt `<td>`, et `<Order>`-element eller `select * from x`). Gættet kan rettes i dropdown-menuen.
- **Formaterer** JSON, SQL (T-SQL, PostgreSQL, MySQL m.fl.), XML, HTML, CSS/SCSS/LESS, JavaScript/TypeScript, YAML, Markdown og GraphQL. Andre sprog (C#, Java, Python, PowerShell, Shell, PHP, INI, Dockerfile, Diff) bliver kun farvelagt.
- **Kører i baggrunden** med et ikon i systembakken. Den globale genvej (standard `Win+Alt+V`) viser vinduet med det, der ligger i udklipsholderen.
- **Åbner filer** via dialog (`Ctrl+O`), træk-og-slip, "Åbn med" eller kommandolinjen.
- Lyst/mørkt tema, linjenumre, ombrydning, zoom og søgning.
- Kan bygges til **Windows** og **Linux** (Tauri v2).

## Genveje

| Genvej | Funktion |
|---|---|
| `Win+Alt+V` (global, kan ændres) | Vis DocView med udklipsholderens indhold |
| `Ctrl+V` | Indsæt nyt indhold |
| `Ctrl+O` | Åbn fil |
| `Ctrl+F`, `F3` / `Shift+F3` | Søg, næste/forrige fund |
| `Ctrl+Shift+C` | Kopiér den formaterede tekst |
| `Ctrl+E` | Åbn i ekstern editor (Notepad++ hvis den er installeret) |
| `Ctrl +` / `Ctrl -` / `Ctrl 0` | Zoom |
| `F` / `W` / `L` | Slå formatering / ombrydning / linjenumre til og fra |
| `Ctrl+,` | Indstillinger |
| `Esc` | Luk søgning, ellers skjul vinduet |

Hvis du lukker vinduet, kører programmet videre i systembakken. Du afslutter det fra menuen i systembakken.

Genvejen er bevidst ikke `Ctrl+Shift+V`. Den bruges allerede til "indsæt som ren tekst" i browsere, Office, Teams osv. Kombinationer med `Ctrl+Alt` er også undgået, fordi `Ctrl+Alt` er `AltGr` på et dansk tastatur.

## Kommandolinje

```bash
docview fil.sql          # åbn en fil
docview --clipboard      # vis udklipsholderen
docview --background     # start skjult i systembakken (bruges ved autostart)
```

Hvis DocView allerede kører, bliver argumenterne sendt videre til den kørende instans.

### Linux og Wayland

Under X11 virker den globale genvej direkte. Under Wayland (GNOME/KDE) må programmer ikke selv registrere globale genveje. Her laver du i stedet en tastaturgenvej i systemindstillingerne, der kører `docview --clipboard`. Det samme virker på Windows med en genvej til `DocView.exe --clipboard`, hvis du ikke vil have programmet kørende i baggrunden.

## Udvikling

Krav: [Node.js](https://nodejs.org) 20+ og [Rust](https://rustup.rs). På Linux skal du også bruge:

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libxdo-dev build-essential
```

```bash
npm install
```

```bash
npm run tauri dev       # kør appen med hot reload
```

```bash
npm test                # unit tests (detektion, formatering, rendering)
```

```bash
npm run tauri build     # byg installer (.msi/.exe på Windows, .deb/.AppImage på Linux)
```

`npm run dev` starter kun frontend'en i en almindelig browser på http://localhost:1420. Det er praktisk til at arbejde på visningen.

GitHub Actions (`.github/workflows/build.yml`) bygger til Windows og Linux ved hvert push. Installerne kan hentes som artifacts. Hvis du pusher et tag som `v0.1.0`, oprettes der en kladde til en release med installerne.

## Struktur

```
src/                 Frontend (TypeScript + Vite)
  detect.ts          Sprog-detektion (score + validering med parser)
  format.ts          Formatering (Prettier, sql-formatter, xml-formatter)
  render.ts          Farvelægning (highlight.js) og linjeopdeling
  search.ts          Søgning
  main.ts            UI
  backend.ts         Kald til Rust-delen (virker også uden Tauri i browser)
src-tauri/           Rust: tray, global genvej, single-instance, filer, indstillinger
tests/               Vitest-tests
```

Indstillingerne gemmes i `%APPDATA%\io.github.docview\settings.json` på Windows og `~/.config/io.github.docview/settings.json` på Linux.
