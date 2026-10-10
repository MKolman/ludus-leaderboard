import type { Sex, Team } from './types';

// Team names are inconsistent between the master standings sheet and the round
// sheets (extra spaces, '*' markers, substitutes written as "A / B = C").
// Normalising them lets us recognise the same pair everywhere.

export function normalizeTeamName(raw: string): string {
	const base = raw.split('=')[0] ?? raw;
	const parts = base
		.toLowerCase()
		.split('/')
		.map((part) => part.replace(/[^a-z0-9čšžćđ]/gi, ''))
		.filter(Boolean);
	return parts.sort().join('/');
}

function editDistance(a: string, b: string): number {
	const memo = new Map<number, number>();
	const walk = (i: number, j: number): number => {
		if (i === a.length || j === b.length) return a.length + b.length - i - j;
		const key = i * 1000 + j;
		const cached = memo.get(key);
		if (cached !== undefined) return cached;
		let result: number;
		if (a[i] === b[j]) {
			result = walk(i + 1, j + 1);
		} else {
			result = 1 + Math.min(walk(i + 1, j), walk(i, j + 1), walk(i + 1, j + 1));
		}
		memo.set(key, result);
		return result;
	};
	return walk(0, 0);
}

const FUZZY_THRESHOLD = 3;

export class TeamRegistry {
	private bySex = new Map<Sex, Map<string, Team>>();
	private byId = new Map<number, Team>();
	private nextId = 1;

	register(sex: Sex, name: string): Team {
		const key = normalizeTeamName(name);
		const bucket = this.bySex.get(sex) ?? new Map<string, Team>();
		this.bySex.set(sex, bucket);
		const existing = bucket.get(key);
		if (existing) return existing;
		const team: Team = { id: this.nextId++, name: name.trim(), sex };
		bucket.set(key, team);
		this.byId.set(team.id, team);
		return team;
	}

	teamById(id: number): Team | undefined {
		return this.byId.get(id);
	}

	all(): Team[] {
		return [...this.byId.values()];
	}

	match(sex: Sex, name: string): Team | undefined {
		const key = normalizeTeamName(name);
		const bucket = this.bySex.get(sex);
		if (!bucket) return undefined;
		const exact = bucket.get(key);
		if (exact) return exact;

		let best: Team | undefined;
		let bestDist = FUZZY_THRESHOLD;
		for (const [candidateKey, team] of bucket) {
			const dist = editDistance(candidateKey, key);
			if (dist < bestDist) {
				best = team;
				bestDist = dist;
			}
		}
		return best;
	}

	// Used for game teams that are not part of any league table.
	resolve(sex: Sex, name: string): Team {
		return this.match(sex, name) ?? this.register(sex, name);
	}
}
