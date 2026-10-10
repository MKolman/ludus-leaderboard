// Generates src/data/sources.json by enumerating the tabs inside each public
// Google spreadsheet in the "1. REZULTATI" Drive folder.
//
// The app itself is frontend-only and fetches the CSV data at runtime; this
// script only needs to be re-run when the season / spreadsheet structure changes.
//
// Usage: npm run sources

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'sources.json');

const SEASON = '2026/27';

// Spreadsheet IDs discovered from the public Drive folders.
const SPREADSHEETS = [
	// --- MOŠKI (folder 1Xf4ulrAAZTjy0Y_agC2qfMPBASv-BtDC) ---
	{ id: '1QQPWH7mWrXT3Ps5hj54lgqTwiOK2XcDL6GjuTlIysSk', sex: 'm', kind: 'league', league: '1' },
	{ id: '1sme5933ryXPOz0WtMZi9EerWJIfTpMeGTkVLIihL97k', sex: 'm', kind: 'league', league: '2' },
	{ id: '1MkmzV9qkxEVx2uX-zlMdLhQSYCcST2YdOlTVieNriXE', sex: 'm', kind: 'league', league: '3' },
	{ id: '1i9ZybmQahRQLGwn8k07fx83JyQT46dR684n9318zXgI', sex: 'm', kind: 'league', league: '4' },
	{ id: '1Zm8WaBjK1eB6csZhS1A5hbrHM8ichMj0YpmKU-qe-SE', sex: 'm', kind: 'league', league: '5' },
	{ id: '1Xl62gC_dKISsLtHoEtLr2L_kwp-AwnwdvZNY9cA5reQ', sex: 'm', kind: 'league', league: '6' },
	{ id: '1v0C5us-vuKN5r4T26d4WTtH1rzAYjDYOatoxnEpQ1RU', sex: 'm', kind: 'standings' },
	// --- ŽENSKE (folder 1zG1GJqPkwAAu9ovxvpyviPjEstsqwiPk) ---
	{ id: '11otSPyAOsuVbLgpsEnytrbq1ee6822nPFsUHZK1X9mo', sex: 'z', kind: 'league', league: '1' },
	{ id: '1w6_Jq_6EOS7XT6hn4GFFvT0EHHJBJumJ10DWJmmr_to', sex: 'z', kind: 'league', league: '2' },
	{ id: '1lTxytVBmor4WI23Vga2XZXprPGS1V9c3KcaS0a_eXO8', sex: 'z', kind: 'league', league: '3' },
	{ id: '1JHwW77pme48E70W3kJz6TxIJIsb05ddLmDBd0jJc8Uc', sex: 'z', kind: 'standings' }
];

async function sheetsOf(id) {
	const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to download ${id}: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());

	const dir = mkdtempSync(join(tmpdir(), 'ludus-'));
	const file = join(dir, 'book.xlsx');
	writeFileSync(file, buf);
	try {
		const xml = execFileSync('unzip', ['-p', file, 'xl/workbook.xml'], {
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024
		});
		return [...xml.matchAll(/<sheet\b[^>]*?\/>/g)].map((m) => {
			const tag = m[0];
			const name = /\bname="([^"]*)"/.exec(tag)?.[1] ?? '';
			const state = /\bstate="([^"]*)"/.exec(tag)?.[1] ?? 'visible';
			return { name, state };
		});
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function parseRound(name) {
	// "1. KROG (3. 10.)" or "2.A - 1. KROG (4. 10.)" / "2.B - 2.KROG (8. 11.)"
	const withDivision = /^\s*\d+\.\s*([AB])\s*-\s*(\d+)\.\s*KROG\s*\(([^)]*)\)/i.exec(name);
	const plain = /^\s*(\d+)\.\s*KROG\s*\(([^)]*)\)/i.exec(name);
	if (withDivision) {
		return {
			round: Number(withDivision[2]),
			division: withDivision[1].toUpperCase(),
			sheet: name,
			date: withDivision[3].trim()
		};
	}
	if (plain) {
		return {
			round: Number(plain[1]),
			division: null,
			sheet: name,
			date: plain[2].trim()
		};
	}
	return null;
}

const standings = [];
const leagues = [];

for (const ss of SPREADSHEETS) {
	const sheets = await sheetsOf(ss.id);
	const visible = sheets.filter((s) => s.state === 'visible');
	console.log(
		`${ss.sex} ${ss.kind} ${ss.league ?? ''} -> ${visible.map((s) => s.name).join(' | ')}`
	);

	if (ss.kind === 'standings') {
		const sheet = visible[0]?.name;
		if (!sheet) throw new Error(`No visible sheet in standings ${ss.id}`);
		standings.push({ sex: ss.sex, id: ss.id, sheet });
	} else {
		const rounds = visible
			.map((s) => parseRound(s.name))
			.filter((r) => r !== null)
			.sort((a, b) => a.round - b.round);
		leagues.push({ sex: ss.sex, league: ss.league, id: ss.id, rounds });
	}
}

const out = { season: SEASON, standings, leagues };
writeFileSync(OUT, JSON.stringify(out, null, '\t') + '\n');
console.log(`\nWrote ${OUT}`);
