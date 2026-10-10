import { sheetViewUrl } from '../data/load';
import type { Model } from '../data/model';
import { gamesForTeam, pairGames } from '../data/selectors';
import type { Game } from '../data/types';
import { colorFor } from '../theme';

interface Props {
	model: Model;
	selected: number[];
	onToggle: (id: number) => void;
}

function GameLine({ game, perspective }: { game: Game; perspective: number }) {
	const won = game.winner.id === perspective;
	const opponent = game.team1.id === perspective ? game.team2 : game.team1;
	return (
		<li className={won ? 'win' : 'loss'}>
			<span className={`result ${won ? 'win' : 'loss'}`}>{won ? 'Z' : 'P'}</span>
			<span className="opponent">proti {opponent.name}</span>
			<span className="score">{game.score}</span>
			{game.phase && <span className={`phase phase-${game.phaseKind}`}>{game.phase}</span>}
			<span className="game-meta">
				{game.league} · {game.round}. krog · {game.date}
			</span>
			<a
				className="sheet-link"
				href={sheetViewUrl(game.sourceId)}
				target="_blank"
				rel="noreferrer"
				title="Google Sheets"
			>
				↗
			</a>
		</li>
	);
}

function PairSection({
	model,
	a,
	b,
	onToggle
}: {
	model: Model;
	a: number;
	b: number;
	onToggle: (id: number) => void;
}) {
	const [pair] = pairGames(model, [a, b]);
	const colorA = colorFor(a, [a, b]);
	const colorB = colorFor(b, [a, b]);
	return (
		<div className="pair">
			<h3>
				<button type="button" onClick={() => onToggle(a)} style={{ color: colorA }}>
					{pair.team1.name}
				</button>
				<span className="vs">vs</span>
				<button type="button" onClick={() => onToggle(b)} style={{ color: colorB }}>
					{pair.team2.name}
				</button>
				<span className="pair-count">({pair.games.length})</span>
			</h3>
			{pair.games.length === 0 ? (
				<p className="no-games">Ni odigranih iger.</p>
			) : (
				<>
					<p className="record">
						{pair.team1.name} {pair.wins1} : {pair.wins2} {pair.team2.name}
					</p>
					<ol className="games">
						{pair.games.map((game, index) => (
							<GameLine key={index} game={game} perspective={a} />
						))}
					</ol>
				</>
			)}
		</div>
	);
}

export function GamesPanel({ model, selected, onToggle }: Props) {
	if (selected.length === 0) {
		return (
			<section className="games-panel">
				<h2>Tekme</h2>
				<p className="hint">Izberi ekipo v tabeli, da vidiš njene tekme.</p>
			</section>
		);
	}

	if (selected.length === 1) {
		const id = selected[0];
		const team = model.teamById.get(id);
		const games = gamesForTeam(model, id);
		const wins = games.filter((game) => game.winner.id === id).length;
		return (
			<section className="games-panel">
				<h2 style={{ color: colorFor(id, selected) }}>
					{team?.name} — vse tekme ({games.length})
				</h2>
				{games.length === 0 ? (
					<p className="no-games">Ni odigranih iger.</p>
				) : (
					<>
						<p className="record">
							{wins} zmag, {games.length - wins} porazov
						</p>
						<ol className="games">
							{games.map((game, index) => (
								<GameLine key={index} game={game} perspective={id} />
							))}
						</ol>
					</>
				)}
			</section>
		);
	}

	return (
		<section className="games-panel">
			<h2>Medsebojni izidi</h2>
			{selected.flatMap((a, i) =>
				selected
					.slice(i + 1)
					.map((b) => (
						<PairSection key={`${a}-${b}`} model={model} a={a} b={b} onToggle={onToggle} />
					))
			)}
		</section>
	);
}
