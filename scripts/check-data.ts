import { buildModel } from '../src/data/model';
import { fetchDataset } from '../src/data/load';

const dataset = await fetchDataset();
const model = buildModel(dataset);

console.log('season', model.season);
console.log('teams', model.teams.length);
console.log('games', model.games.length);
console.log('sections:');
for (const section of model.sections) {
	const teamCount = new Set(section.rounds.flatMap((round) => round.teams.map((team) => team.id)))
		.size;
	const perRound = section.rounds.map((round) => `${round.round}:${round.teams.length}`).join(' ');
	console.log(`  ${section.sex} ${section.label} — ${teamCount} teams [${perRound}]`);
}

console.log('\nfirst section detail:');
const first = model.sections[0];
if (first) {
	for (const round of first.rounds) {
		console.log(
			`  r${round.round} (${round.date}):`,
			round.teams.map((team) => team.name).join(', ')
		);
	}
}

console.log('\nsample games:');
for (const game of model.games.slice(0, 5)) {
	console.log(
		`  [${game.league} r${game.round}] ${game.team1.name} ${game.score} ${game.team2.name} -> ${game.winner.name}`
	);
}

const inSection = new Set(
	model.sections.flatMap((section) =>
		section.rounds.flatMap((round) => round.teams.map((t) => t.id))
	)
);
const missing = model.teams.filter((team) => !inSection.has(team.id));
console.log(`\nteams not in any section: ${missing.length}`);
for (const team of missing.slice(0, 30)) console.log('  ', team.sex, team.name);
