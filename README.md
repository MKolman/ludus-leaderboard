# Ludus beach liga razvrstitev

Frontend-only React app that reads the Ludus beach volleyball league data from
public Google Sheets, parses it in the browser and visualises it.

- **Teams table** – one section per league (and per A/B division), one column per
  round. Each cell names the team occupying that position, so a team that moves
  between leagues appears in different sections/rows across the season. Section
  headers include the date each round is played.
- **Team selection** – click teams to select them. One team shows all of its
  games; two or more show the head-to-head record for every pair.
- **Chart** – position (or points) of the selected teams across rounds.

Data is fetched live from Google Sheets on load and cached in `localStorage` for
a week. Use the **↻ Osveži** button to force a refresh.

## Data source

The spreadsheets live in the public Google Drive folder **1. REZULTATI**
(`1ECL_oZlCaI29wW8ZF8pde-ZdEDNFkeiu`), split into `MOŠKI` and `ŽENSKE`
subfolders. Each league has one spreadsheet with a tab per round; a `LESTVICA`
spreadsheet holds the master team/league/points table.

`src/data/sources.json` is a generated manifest listing every spreadsheet and
its tabs. Regenerate it when the season or spreadsheet structure changes:

```bash
npm run sources
```

Verify the whole pipeline (downloads the sheets and parses them) with:

```bash
npm run check-data
```

## Development

```bash
npm install
npm run dev
```

## Build & deploy

```bash
npm run build      # static output in dist/
npm run deploy     # build + publish to gh-pages
```

## Lint & typecheck

```bash
npm run lint
npm run typecheck
```
