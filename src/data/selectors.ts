import type { Game, Team } from './types';
import type { Model } from './model';

export interface PairGames {
	team1: Team;
	team2: Team;
	games: Game[];
	wins1: number;
	wins2: number;
}

export function gamesForTeam(model: Model, id: number): Game[] {
	return model.games
		.filter((game) => game.team1.id === id || game.team2.id === id)
		.sort((a, b) => a.round - b.round);
}

export function pairGames(model: Model, ids: number[]): PairGames[] {
	const result: PairGames[] = [];
	for (let i = 0; i < ids.length; i++) {
		for (let j = i + 1; j < ids.length; j++) {
			const a = ids[i];
			const b = ids[j];
			const games = model.games
				.filter(
					(game) =>
						(game.team1.id === a && game.team2.id === b) ||
						(game.team1.id === b && game.team2.id === a)
				)
				.sort((x, y) => x.round - y.round);
			const wins1 = games.filter((game) => game.winner.id === a).length;
			result.push({
				team1: model.teamById.get(a)!,
				team2: model.teamById.get(b)!,
				games,
				wins1,
				wins2: games.length - wins1
			});
		}
	}
	return result;
}
