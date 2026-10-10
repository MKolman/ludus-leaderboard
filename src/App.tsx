import { useCallback, useEffect, useMemo, useState } from 'react';
import { GamesPanel } from './components/GamesPanel';
import { LeagueTable } from './components/LeagueTable';
import { RankChart } from './components/RankChart';
import { loadDataset, readCache, type Dataset } from './data/load';
import { buildModel } from './data/model';

type Tab = 'm' | 'z' | 'details';

function formatAge(age: number): string {
	return new Date(age).toLocaleString('sl-SI', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export default function App() {
	const [dataset, setDataset] = useState<Dataset | null>(() => readCache());
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selected, setSelected] = useState<number[]>([]);
	const [hovered, setHovered] = useState<number | null>(null);
	const [tab, setTab] = useState<Tab>('m');
	const [lastTableTab, setLastTableTab] = useState<'m' | 'z'>('m');

	const model = useMemo(() => (dataset ? buildModel(dataset) : null), [dataset]);

	const refresh = useCallback(async (force: boolean) => {
		setLoading(true);
		setError(null);
		try {
			setDataset(await loadDataset(force));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh(false);
	}, [refresh]);

	const toggle = useCallback((id: number) => {
		setSelected((previous) =>
			previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]
		);
	}, []);

	const clear = useCallback(() => setSelected([]), []);

	const detailsDisabled = selected.length === 0;

	useEffect(() => {
		if (tab === 'details' && detailsDisabled) setTab(lastTableTab);
	}, [tab, detailsDisabled, lastTableTab]);

	const selectTab = (next: Tab) => {
		if (next === 'details' && detailsDisabled) return;
		if (next === 'm' || next === 'z') setLastTableTab(next);
		setTab(next);
	};

	return (
		<div className="app">
			<header className="app-header">
				<div>
					<h1>Ludus beach liga razvrstitev</h1>
					{model && <p className="season">Sezona {model.season}</p>}
				</div>
				<div className="meta">
					{dataset && <span>Podatki so iz {formatAge(dataset.age)}</span>}
					<button type="button" onClick={() => void refresh(true)} disabled={loading}>
						{loading ? 'Nalagam …' : '↻ Osveži'}
					</button>
				</div>
			</header>

			{error && <p className="error">Napaka pri nalaganju: {error}</p>}
			{!model && loading && <p className="loading">Nalagam podatke …</p>}

			{model && (
				<>
					<nav className="tabs" role="tablist">
						<button
							type="button"
							role="tab"
							aria-selected={tab === 'm'}
							className={tab === 'm' ? 'active' : ''}
							onClick={() => selectTab('m')}
						>
							Moški
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={tab === 'z'}
							className={tab === 'z' ? 'active' : ''}
							onClick={() => selectTab('z')}
						>
							Ženske
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={tab === 'details'}
							className={tab === 'details' ? 'active' : ''}
							disabled={detailsDisabled}
							title={detailsDisabled ? 'Izberi vsaj eno ekipo' : undefined}
							onClick={() => selectTab('details')}
						>
							Graf in tekme{selected.length > 0 ? ` (${selected.length})` : ''}
						</button>
					</nav>

					<section className="controls">
						<p>
							Klikni ekipo za izbiro. Izberi eno ekipo za vse njene tekme, dve ali več pa za
							medsebojne izide vsakega para.
						</p>
						{selected.length > 0 && (
							<button type="button" className="clear" onClick={clear}>
								Počisti izbor ({selected.length})
							</button>
						)}
					</section>

					{tab === 'details' ? (
						<>
							<RankChart model={model} selected={selected} />
							<GamesPanel model={model} selected={selected} onToggle={toggle} />
						</>
					) : (
						<LeagueTable
							model={model}
							sex={tab}
							selected={selected}
							hovered={hovered}
							onToggle={toggle}
							onHover={setHovered}
						/>
					)}
				</>
			)}

			<footer>
				<p>
					Naredil <a href="https://www.kolman.si">Maks Kolman</a>. Koda na voljo na{' '}
					<a href="https://github.com/MKolman/ludus-leaderboard">GitHubu</a>.
				</p>
			</footer>
		</div>
	);
}
