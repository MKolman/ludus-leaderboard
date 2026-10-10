export const PALETTE = [
	'#600f3f',
	'#cc1e47',
	'#e66a25',
	'#f9a71a',
	'#2b7a78',
	'#3aafa9',
	'#6a4c93',
	'#1982c4'
];

export function colorIndex(id: number, selected: number[]): number {
	const index = selected.indexOf(id);
	return index === -1 ? -1 : index % PALETTE.length;
}

export function colorFor(id: number, selected: number[]): string | undefined {
	const index = colorIndex(id, selected);
	return index === -1 ? undefined : PALETTE[index];
}
