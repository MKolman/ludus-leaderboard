import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import type { Model } from '../data/model';
import { PALETTE } from '../theme';

interface Props {
	model: Model;
	selected: number[];
}

type Mode = 'position' | 'points';

export function RankChart({ model, selected }: Props) {
	const [mode, setMode] = useState<Mode>('position');

	if (selected.length === 0) {
		return (
			<section className="chart-panel">
				<h2>Graf</h2>
				<p className="hint">Izberi ekipe, da vidiš njihov napredek skozi kroge.</p>
			</section>
		);
	}

	const datasets = selected.map((id, index) => {
		const team = model.teamById.get(id);
		const results = model.resultsByTeam.get(id) ?? [];
		const color = PALETTE[index % PALETTE.length];
		return {
			label: team?.name ?? String(id),
			data: model.rounds.map((round) => {
				const result = results.find((entry) => entry.round === round);
				if (!result) return null;
				return mode === 'position' ? result.position : result.points;
			}),
			borderColor: color,
			backgroundColor: color,
			spanGaps: true,
			tension: 0.2,
			pointRadius: 5
		};
	});

	return (
		<section className="chart-panel">
			<div className="chart-head">
				<h2>Graf</h2>
				<div className="mode-switch">
					<button
						type="button"
						className={mode === 'position' ? 'active' : ''}
						onClick={() => setMode('position')}
					>
						Mesto
					</button>
					<button
						type="button"
						className={mode === 'points' ? 'active' : ''}
						onClick={() => setMode('points')}
					>
						Točke
					</button>
				</div>
			</div>
			<div className="chart-wrap">
				<Line
					data={{ labels: model.rounds.map((round) => `${round}. krog`), datasets }}
					options={{
						animation: false,
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							tooltip: {
								callbacks: {
									label: (context) => {
										const value = context.parsed.y;
										if (value === null) return `${context.dataset.label}: –`;
										return mode === 'position'
											? `${context.dataset.label}: ${value}. mesto`
											: `${context.dataset.label}: ${value} točk`;
									}
								}
							}
						},
						scales: {
							y: {
								reverse: mode === 'position',
								beginAtZero: mode === 'points',
								ticks: { precision: 0 }
							}
						}
					}}
				/>
			</div>
		</section>
	);
}
