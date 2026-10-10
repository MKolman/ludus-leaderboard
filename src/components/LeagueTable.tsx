import type { Model } from '../data/model';
import type { Section, Sex, Team } from '../data/types';
import { colorIndex } from '../theme';

interface Props {
	model: Model;
	sex: Sex;
	selected: number[];
	hovered: number | null;
	onToggle: (id: number) => void;
	onHover: (id: number | null) => void;
}

export function LeagueTable({ model, sex, selected, hovered, onToggle, onHover }: Props) {
	const sections = model.sections.filter(
		(section) => section.sex === sex && section.rounds.some((round) => round.teams.length > 0)
	);

	return (
		<div className="table-wrap">
			<table className="leaderboard">
				<thead>
					<tr>
						<th className="rank">#</th>
						{model.rounds.map((round) => (
							<th key={round} className="round">
								{round}. krog
							</th>
						))}
					</tr>
				</thead>
				{sections.map((section) => (
					<SectionBody
						key={`${section.sex}-${section.leagueNo}-${section.division ?? ''}`}
						section={section}
						selected={selected}
						hovered={hovered}
						onToggle={onToggle}
						onHover={onHover}
					/>
				))}
			</table>
		</div>
	);
}

interface SectionProps {
	section: Section;
	selected: number[];
	hovered: number | null;
	onToggle: (id: number) => void;
	onHover: (id: number | null) => void;
}

function SectionBody({ section, selected, hovered, onToggle, onHover }: SectionProps) {
	return (
		<tbody>
			<tr className={`section-head ${section.sex}`}>
				<th className="section-name">{section.label}</th>
				{section.rounds.map((round) => (
					<th key={round.round} className="round-date">
						{round.date || '–'}
					</th>
				))}
			</tr>
			{Array.from({ length: section.rowCount }, (_, rowIndex) => (
				<tr key={rowIndex}>
					<td className="rank">{rowIndex + 1}</td>
					{section.rounds.map((round) => (
						<TeamCell
							key={round.round}
							team={round.teams[rowIndex]}
							selected={selected}
							hovered={hovered}
							onToggle={onToggle}
							onHover={onHover}
						/>
					))}
				</tr>
			))}
		</tbody>
	);
}

interface CellProps {
	team: Team | undefined;
	selected: number[];
	hovered: number | null;
	onToggle: (id: number) => void;
	onHover: (id: number | null) => void;
}

function TeamCell({ team, selected, hovered, onToggle, onHover }: CellProps) {
	if (!team) return <td className="cell empty" />;

	const index = colorIndex(team.id, selected);
	const isSelected = index !== -1;
	const isHovered = hovered === team.id;

	const className = ['cell', 'filled', isSelected ? 'selected' : '', isHovered ? 'hovered' : '']
		.filter(Boolean)
		.join(' ');

	return (
		<td
			className={className}
			style={
				isSelected
					? ({ '--cell-color': `var(--palette-${index})` } as React.CSSProperties)
					: undefined
			}
			onMouseEnter={() => onHover(team.id)}
			onMouseLeave={() => onHover(null)}
		>
			<button type="button" className="cell-button" onClick={() => onToggle(team.id)}>
				{team.name}
			</button>
		</td>
	);
}
