import sourcesJson from './sources.json';
import type { Sources } from './types';

export const SOURCES = sourcesJson as Sources;

const CACHE_KEY = 'ludus:cache:v1';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export interface Dataset {
	age: number;
	sheets: Record<string, string>;
}

export function sheetKey(id: string, sheet: string): string {
	return `${id}::${sheet}`;
}

export function sheetCsvUrl(id: string, sheet: string): string {
	return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
		sheet
	)}`;
}

export function sheetViewUrl(id: string): string {
	return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

interface SourceRef {
	id: string;
	sheet: string;
}

function allSourceRefs(): SourceRef[] {
	const refs: SourceRef[] = [];
	for (const s of SOURCES.standings) refs.push({ id: s.id, sheet: s.sheet });
	for (const league of SOURCES.leagues) {
		for (const round of league.rounds) refs.push({ id: league.id, sheet: round.sheet });
	}
	return refs;
}

async function fetchWithConcurrency(refs: SourceRef[], limit = 8): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	let index = 0;
	const workers = Array.from({ length: Math.min(limit, refs.length) }, async () => {
		while (index < refs.length) {
			const current = refs[index++];
			const key = sheetKey(current.id, current.sheet);
			try {
				const response = await fetch(sheetCsvUrl(current.id, current.sheet));
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				result[key] = await response.text();
			} catch (error) {
				console.error(`Failed to load ${current.sheet}`, error);
				result[key] = '';
			}
		}
	});
	await Promise.all(workers);
	return result;
}

export function readCache(): Dataset | null {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Dataset;
		if (!parsed || typeof parsed.age !== 'number' || !parsed.sheets) return null;
		return parsed;
	} catch {
		return null;
	}
}

function writeCache(dataset: Dataset): void {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(dataset));
	} catch (error) {
		console.error('Failed to cache dataset', error);
	}
}

export function isFresh(dataset: Dataset): boolean {
	return Date.now() - dataset.age < MAX_AGE;
}

export async function fetchDataset(): Promise<Dataset> {
	const sheets = await fetchWithConcurrency(allSourceRefs());
	const dataset: Dataset = { age: Date.now(), sheets };
	writeCache(dataset);
	return dataset;
}

export async function loadDataset(force = false): Promise<Dataset> {
	if (!force) {
		const cached = readCache();
		if (cached && isFresh(cached)) return cached;
	}
	return fetchDataset();
}
