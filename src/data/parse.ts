import { parseCsv } from './csv';
import type { GamePhaseKind } from './types';

export interface RawStandingRow {
	name: string;
	results: { round: number; league: string; points: number | null }[];
}

function toNumber(raw: string | undefined): number | null {
	if (raw === undefined) return null;
	const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
	if (cleaned === '') return null;
	const value = Number(cleaned);
	return Number.isFinite(value) ? value : null;
}

// The LESTVICA sheet is the master table:
// TEAM NAME | ROUND 1 LEAGUE | ROUND 1 POINTS | ... | FINAL POINTS
export function parseStandings(csv: string): RawStandingRow[] {
	const rows = parseCsv(csv);
	if (rows.length === 0) return [];
	const header = rows[0].map((cell) => cell.trim());
	const teamCol = header.indexOf('TEAM NAME');
	if (teamCol === -1) return [];

	const columns = new Map<number, { league: number; points: number }>();
	for (const [i, cell] of header.entries()) {
		const match = /^ROUND\s+(\d+)\s+(LEAGUE|POINTS)$/i.exec(cell);
		if (!match) continue;
		const round = Number(match[1]);
		const entry = columns.get(round) ?? { league: -1, points: -1 };
		if (match[2].toUpperCase() === 'LEAGUE') entry.league = i;
		else entry.points = i;
		columns.set(round, entry);
	}

	const result: RawStandingRow[] = [];
	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		const name = row[teamCol]?.trim();
		if (!name) continue;
		const results: RawStandingRow['results'] = [];
		for (const [round, cols] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
			const league = cols.league >= 0 ? row[cols.league]?.trim() : '';
			if (!league) continue;
			results.push({
				round,
				league,
				points: cols.points >= 0 ? toNumber(row[cols.points]) : null
			});
		}
		result.push({ name, results });
	}
	return result;
}

export interface RawGame {
	team1: string;
	team2: string;
	sets: [number, number];
	score: string;
	phase: string;
	phaseKind: GamePhaseKind;
}

function readSets(
	row: string[],
	team1Col: number,
	team2Col: number,
	placement: boolean
): [number, number] {
	// Group/knockout games interleave the two teams' sets (6/7, 8/9, 10/11).
	// Placement ("za N. mesto") games put team 1's sets first (6/7/8) and
	// team 2's after (9/10/11); they are typically a single set.
	const pairs: [number, number][] = placement
		? [
				[team1Col + 1, team2Col - 3],
				[team1Col + 2, team2Col - 2],
				[team1Col + 3, team2Col - 1]
			]
		: [
				[team1Col + 1, team1Col + 2],
				[team1Col + 3, team1Col + 4],
				[team1Col + 5, team1Col + 6]
			];

	const won: [number, number] = [0, 0];
	for (const [colA, colB] of pairs) {
		const a = toNumber(row[colA]);
		const b = toNumber(row[colB]);
		if (a === null || b === null) continue;
		if (a > b) won[0]++;
		else if (b > a) won[1]++;
	}
	return won;
}

// A round sheet is split into blocks identified by a label in column 2:
//   - "SKUPINA A" / "SKUPINA B"            -> group stage
//   - "TEKME ZA OBSTANEK / NAPREDOVANJE"   -> advancement / relegation playoffs
//   - "SET ZA MESTA"                       -> placement (sorting) games
// The "TEKMA" column (column 4) tells the exact pairing, e.g. "(A1):(B2)" or
// "za 3.".
const BLOCK_RE = /SKUPINA|OBSTANEK|NAPREDOVANJE|ZMAGO|MESTA|RAZVRSTITEV/i;
const GROUP_RE = /SKUPINA\s*([AB])/i;
const KNOCKOUT_RE = /OBSTANEK|NAPREDOVANJE|ZMAGO/i;

function classifyPhase(block: string, tekma: string): { label: string; kind: GamePhaseKind } {
	const placement = /^za\s*(\d+)/i.exec(tekma);
	if (placement) return { label: `Za ${placement[1]}. mesto`, kind: 'placement' };

	const group = GROUP_RE.exec(block);
	if (group) return { label: `Skupinski del ${group[1].toUpperCase()}`, kind: 'group' };

	if (KNOCKOUT_RE.test(block)) {
		if (/obstanek/i.test(tekma)) return { label: 'Za delegacijo', kind: 'relegation' };
		// Pairings such as "(A1):(B2)" (top two -> advancement) vs
		// "(A3):(B4)" (bottom two -> relegation).
		const positions = [...tekma.matchAll(/[AB]\s*(\d)/gi)].map((match) => Number(match[1]));
		const advancing = positions.length >= 2 && Math.max(...positions) <= 2;
		return advancing
			? { label: 'Za napredovanje', kind: 'promotion' }
			: { label: 'Za delegacijo', kind: 'relegation' };
	}

	return { label: '', kind: 'other' };
}

// Each round sheet contains one or more blocks of games. A game row has both
// team names containing "/" and the set scores in the columns between them.
export function parseGames(csv: string): RawGame[] {
	const rows = parseCsv(csv);

	let team1Col = -1;
	let team2Col = -1;
	for (const row of rows) {
		const i1 = row.indexOf('EKIPA 1');
		const i2 = row.indexOf('EKIPA 2');
		if (i1 !== -1 && i2 !== -1) {
			team1Col = i1;
			team2Col = i2;
			break;
		}
	}
	if (team1Col === -1) return [];

	let block = '';
	const games: RawGame[] = [];
	for (const row of rows) {
		const blockLabel = row[2]?.trim() ?? '';
		if (blockLabel && BLOCK_RE.test(blockLabel)) block = blockLabel;

		const team1 = row[team1Col]?.trim();
		const team2 = row[team2Col]?.trim();
		if (!team1 || !team2) continue;
		if (!team1.includes('/') || !team2.includes('/')) continue;
		const { label, kind } = classifyPhase(block, row[4]?.trim() ?? '');
		const won = readSets(row, team1Col, team2Col, kind === 'placement');
		if (won[0] + won[1] === 0) continue;
		games.push({
			team1,
			team2,
			sets: won,
			score: `${won[0]}:${won[1]}`,
			phase: label,
			phaseKind: kind
		});
	}
	return games;
}

// The teams scheduled in a round sheet, in schedule order. Works even before any
// game has been played, which is how we know a team's division early in the
// season. Placeholders such as "4A", "B2" or "(A1):(B2)" never contain "/", so
// real team names are the ones with a slash.
export function parseRoundTeams(csv: string): string[] {
	const rows = parseCsv(csv);

	let headerRow = -1;
	let team1Col = -1;
	let team2Col = -1;
	for (let r = 0; r < rows.length; r++) {
		const i1 = rows[r].indexOf('EKIPA 1');
		const i2 = rows[r].indexOf('EKIPA 2');
		if (i1 !== -1 && i2 !== -1) {
			headerRow = r;
			team1Col = i1;
			team2Col = i2;
			break;
		}
	}
	if (headerRow === -1) return [];

	const seen = new Set<string>();
	const result: string[] = [];
	for (let r = headerRow + 1; r < rows.length; r++) {
		for (const col of [team1Col, team2Col]) {
			const name = rows[r][col]?.trim();
			if (!name || !name.includes('/') || seen.has(name)) continue;
			seen.add(name);
			result.push(name);
		}
	}
	return result;
}
