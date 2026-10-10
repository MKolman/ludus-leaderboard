export type Sex = 'm' | 'z';

export interface SourceRound {
	round: number;
	division: string | null;
	sheet: string;
	date: string;
}

export interface LeagueSource {
	sex: Sex;
	league: string;
	id: string;
	rounds: SourceRound[];
}

export interface StandingsSource {
	sex: Sex;
	id: string;
	sheet: string;
}

export interface Sources {
	season: string;
	standings: StandingsSource[];
	leagues: LeagueSource[];
}

export interface Team {
	id: number;
	name: string;
	sex: Sex;
}

export interface RoundResult {
	round: number;
	league: string;
	leagueNo: number;
	points: number | null;
	position: number | null;
}

export type GamePhaseKind = 'group' | 'promotion' | 'relegation' | 'placement' | 'other';

export interface Game {
	sex: Sex;
	league: string;
	division: string | null;
	round: number;
	date: string;
	sourceId: string;
	team1: Team;
	team2: Team;
	winner: Team;
	sets: [number, number];
	score: string;
	phase: string;
	phaseKind: GamePhaseKind;
}

export interface SectionRound {
	round: number;
	date: string;
	teams: Team[];
}

export interface Section {
	sex: Sex;
	leagueNo: number;
	division: string | null;
	label: string;
	rounds: SectionRound[];
	rowCount: number;
}
