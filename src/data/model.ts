import { TeamRegistry } from './classify';
import { SOURCES, sheetKey, type Dataset } from './load';
import { parseGames, parseRoundTeams, parseStandings } from './parse';
import type { Game, RoundResult, Section, SectionRound, Sex, Team } from './types';

export interface Model {
	season: string;
	rounds: number[];
	teams: Team[];
	games: Game[];
	sections: Section[];
	resultsByTeam: Map<number, RoundResult[]>;
	teamById: Map<number, Team>;
}

export function leagueNo(raw: string): number {
	const match = /(\d+)/.exec(raw);
	return match ? Number(match[1]) : 0;
}

export function sectionLabel(leagueNoValue: number, division: string | null): string {
	return `${leagueNoValue}.${division ?? ''}`;
}

function sortResults(results: RoundResult[]): RoundResult[] {
	return [...results].sort((a, b) => a.round - b.round);
}

interface SectionBuilder {
	sex: Sex;
	leagueNo: number;
	division: string | null;
	rounds: Map<number, { date: string; teams: Team[] }>;
}

function pointsUpTo(
	resultsByTeam: Map<number, RoundResult[]>,
	teamId: number,
	round: number
): number | null {
	const results = resultsByTeam.get(teamId);
	if (!results) return null;
	for (let i = results.length - 1; i >= 0; i--) {
		if (results[i].round <= round && results[i].points !== null) return results[i].points;
	}
	return null;
}

function orderTeams(
	teams: Team[],
	round: number,
	resultsByTeam: Map<number, RoundResult[]>
): Team[] {
	return teams
		.map((team, index) => ({
			team,
			index,
			points: pointsUpTo(resultsByTeam, team.id, round)
		}))
		.sort((a, b) => {
			const pa = a.points ?? -Infinity;
			const pb = b.points ?? -Infinity;
			if (pb !== pa) return pb - pa;
			return a.index - b.index;
		})
		.map((entry) => entry.team);
}

export function buildModel(dataset: Dataset): Model {
	const registry = new TeamRegistry();
	const resultsByTeam = new Map<number, Map<number, RoundResult>>();

	// 1. Master standings -> canonical teams + per-round league/points.
	for (const source of SOURCES.standings) {
		const csv = dataset.sheets[sheetKey(source.id, source.sheet)] ?? '';
		for (const row of parseStandings(csv)) {
			const team = registry.register(source.sex, row.name);
			let byRound = resultsByTeam.get(team.id);
			if (!byRound) {
				byRound = new Map();
				resultsByTeam.set(team.id, byRound);
			}
			for (const result of row.results) {
				byRound.set(result.round, {
					round: result.round,
					league: result.league,
					leagueNo: leagueNo(result.league),
					points: result.points,
					position: null
				});
			}
		}
	}

	// 2. Positions: rank teams by points inside each (sex, round, league).
	const rankingBuckets = new Map<string, RoundResult[]>();
	for (const [teamId, byRound] of resultsByTeam) {
		const team = registry.teamById(teamId);
		if (!team) continue;
		for (const result of byRound.values()) {
			const key = `${team.sex}|${result.round}|${result.league}`;
			const bucket = rankingBuckets.get(key) ?? [];
			bucket.push(result);
			rankingBuckets.set(key, bucket);
		}
	}
	for (const bucket of rankingBuckets.values()) {
		bucket.sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity));
		bucket.forEach((result, index) => {
			result.position = index + 1;
		});
	}

	const sortedResults = new Map<number, RoundResult[]>();
	for (const [teamId, byRound] of resultsByTeam) {
		sortedResults.set(teamId, sortResults([...byRound.values()]));
	}

	// 3. Games from every league round sheet.
	const games: Game[] = [];
	for (const league of SOURCES.leagues) {
		for (const round of league.rounds) {
			const csv = dataset.sheets[sheetKey(league.id, round.sheet)] ?? '';
			for (const raw of parseGames(csv)) {
				const team1 = registry.resolve(league.sex, raw.team1);
				const team2 = registry.resolve(league.sex, raw.team2);
				if (team1.id === team2.id) continue;
				const winner = raw.sets[0] > raw.sets[1] ? team1 : team2;
				games.push({
					sex: league.sex,
					league: sectionLabel(Number(league.league), round.division),
					division: round.division,
					round: round.round,
					date: round.date,
					sourceId: league.id,
					team1,
					team2,
					winner,
					sets: raw.sets,
					score: raw.score,
					phase: raw.phase,
					phaseKind: raw.phaseKind
				});
			}
		}
	}

	// 4. Sections: one per (sex, league, division). Each round lists the teams
	//    scheduled in that section, ordered by that round's points.
	const builders = new Map<string, SectionBuilder>();
	for (const league of SOURCES.leagues) {
		const leagueNoValue = Number(league.league);
		for (const round of league.rounds) {
			const csv = dataset.sheets[sheetKey(league.id, round.sheet)] ?? '';
			const teams = parseRoundTeams(csv).map((name) => registry.resolve(league.sex, name));
			const key = `${league.sex}|${leagueNoValue}|${round.division ?? ''}`;
			let builder = builders.get(key);
			if (!builder) {
				builder = {
					sex: league.sex,
					leagueNo: leagueNoValue,
					division: round.division,
					rounds: new Map()
				};
				builders.set(key, builder);
			}
			const existing = builder.rounds.get(round.round);
			if (existing) {
				// Multiple sheets can contribute to the same section/round (a
				// league-1 round holds both scheduling groups); merge them.
				const merged = [...existing.teams];
				for (const team of teams) {
					if (!merged.some((candidate) => candidate.id === team.id)) merged.push(team);
				}
				existing.teams = merged;
			} else {
				builder.rounds.set(round.round, { date: round.date, teams });
			}
		}
	}

	const maxRound = Math.max(7, ...games.map((game) => game.round));
	const rounds = Array.from({ length: maxRound }, (_, index) => index + 1);

	const sections: Section[] = [...builders.values()].map((builder) => {
		const sectionRounds: SectionRound[] = rounds.map((round) => {
			const entry = builder.rounds.get(round);
			return {
				round,
				date: entry?.date ?? '',
				teams: orderTeams(entry?.teams ?? [], round, sortedResults)
			};
		});
		const rowCount = Math.max(1, ...sectionRounds.map((entry) => entry.teams.length));
		return {
			sex: builder.sex,
			leagueNo: builder.leagueNo,
			division: builder.division,
			label: sectionLabel(builder.leagueNo, builder.division),
			rounds: sectionRounds,
			rowCount
		};
	});

	sections.sort((a, b) => {
		if (a.sex !== b.sex) return a.sex === 'm' ? -1 : 1;
		if (a.leagueNo !== b.leagueNo) return a.leagueNo - b.leagueNo;
		return (a.division ?? '').localeCompare(b.division ?? '');
	});

	const teams = [...registry.all()];

	return {
		season: SOURCES.season,
		rounds,
		teams,
		games,
		sections,
		resultsByTeam: sortedResults,
		teamById: new Map(teams.map((team) => [team.id, team]))
	};
}
