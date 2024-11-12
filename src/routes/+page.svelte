<script lang="ts">
	import { onMount } from 'svelte';
	import * as ludus from '$lib/ludus';
	// import { chart } from '$lib/chart';
	import 'chart.js/auto';
	import { Line } from 'svelte-chartjs';

	const leaguePadding = 10;
	const highlightColors = ['#600f3f', '#cc1e47', '#e66a25', '#f9a71a'];
	let hoverHighlight: ludus.Team = { name: '', id: NaN };
	let highlights: ludus.Team[] = [];
	let dataAge = 1731450605191;
	let loading = false;
	$: formattedDataAge = new Date(dataAge).toLocaleString('sl-SI', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: 'numeric'
	});

	let rawData: ludus.CsvExport[] = [];
	let rounds: ludus.Round[];
	let rows: [ludus.Meta[], ludus.Team[][]][];
	$: rounds = rawData.map(({name, data, url, date}) => new ludus.Round(name, data, url, date));
	$: rows = ludus.transposeToRows(rounds);
	let highlightedRanks: { team: ludus.Team; standings: { meta: ludus.Meta; standing: number }[] }[];
	$: highlightedRanks = highlights.map((team) => {
		const teamStandings = rounds
			.map((round) => ({
				meta: round.meta,
				standing: round.standings.findIndex((t) => t.id == team.id)
			}))
			.filter(({ standing }) => standing != -1)
			.sort((a, b) => a.meta.round - b.meta.round);

		return { team, standings: teamStandings };
	});
	$: pairGames = highlights.flatMap((team1, idx) =>
		highlights.slice(idx + 1).map((team2) => {
			const teams = [team1.id, team2.id];
			const games = rounds.flatMap((round) =>
				round.games.filter((game) => teams.includes(game.team1.id) && teams.includes(game.team2.id))
			);
			const win1 = games.filter((game) => game.winner.id == team1.id).length;
			games.sort((a, b) => a.meta.round - b.meta.round);
			return { team1, team2, games, win1, win2: games.length - win1 };
		})
	);

	function highlightClass(team: ludus.Team, highlighted: ludus.Team[], hover: ludus.Team) {
		const idx = highlighted.findIndex((t) => t.id === team.id);
		if (idx != -1) {
			return `highlight highlight-${idx % 4}`;
		}
		if (hover.id == team.id) {
			return `hover-highlight highlight-${highlighted.length % 4}`;
		}
		return '';
	}

	function toggleHighlight(team: ludus.Team) {
		const idx = highlights.findIndex((t) => t.id == team.id);
		if (idx == -1) {
			highlights = [...highlights, team];
		} else {
			highlights.splice(idx, 1);
			highlights = highlights;
		}
	}

	async function fetchRawData() {
		let { data, age } = ludus.loadFromLocalStorage();
		if (age == null || data == null || age < 1731450605191) {
			({ data, age } = await ludus.loadFromServer());
			ludus.saveToLocalStorage(data, age);
		}
		dataAge = age;
		rawData = data;
	}

	async function reloadData() {
		loading = true;
		rawData = [];
		({ data: rawData, age: dataAge } = await ludus.loadFromSource());
		ludus.saveToLocalStorage(rawData, dataAge);
		loading = false;
	}

	onMount(fetchRawData);
	let steppedGraph = false;
	$: rankDataset = {
		labels: ['1. krog', '2. krog', '3. krog', '4. krog', '5. krog', '6. krog'],
		datasets: highlightedRanks.map(({ team, standings }, i) => ({
			label: team.name,
			data: serializeRankForTeam(standings),
			stepped: steppedGraph ? ('middle' as 'middle') : false,
			borderColor: highlightColors[i % highlightColors.length],
			parent: { standings }
		}))
	};

	function serializeRankForTeam(ranks: { meta: ludus.Meta; standing: number }[]) {
		const result = new Array(7).fill(null);
		ranks.forEach(({ meta, standing }) => {
			result[meta.round - 1] = standing + (+meta.league[0] - 1) * leaguePadding;
		});
		return result;
	}
	const chartOptions = {
		animation: false as false,
		plugins: {
			tooltip: {
				callbacks: {
					label: (context: { parsed: { y: number } }) => {
						const v = context.parsed.y;
						return `${Math.floor(v / leaguePadding) + 1}. liga, ${(v % leaguePadding) + 1}. mesto`;
					}
				}
			}
		},
		elements: {
			point: {
				radius: 5
			}
		},
		responsive: true,
		scales: {
			y: {
				ticks: {
					stepSize: leaguePadding,
					callback: (value: string | number) => {
						value = +value;
						if (value % leaguePadding == 0) return `${value / leaguePadding + 1}. liga`;
						return null;
					}
				},
				reverse: true
			}
		}
	};
</script>

<svelte:head>
	<title>Ludus Beach Liga Razvrstitev</title>
	<meta name="description" content="Podrobnosti o poteku Ludus beach lige." />
</svelte:head>

<h1>Ludus beach liga razvrstitev</h1>
<i
	>Podatki so iz <span>{formattedDataAge}</span>
	<button on:click={reloadData} disabled={loading}>↻</button></i
>
<table id="leaderboard" on:mouseleave={() => (hoverHighlight = { name: '', id: -1 })}>
	<thead>
		<tr>
			<th></th>
			<th>#</th>
			<th>1. krog</th>
			<th>2. krog</th>
			<th>3. krog</th>
			<th>4. krog</th>
			<th>5. krog</th>
			<th>6. krog</th>
		</tr>
	</thead>
	{#each rows as [metas, ranks]}
		<tbody>
			<tr>
				<td></td>
				<td></td>
				{#each metas as meta}
					<td>{meta.date} <a href={meta.url} target="_blank">🗎</a></td>
				{/each}
			</tr>
			{#each ranks as row, i}
				<tr>
					{#if i === 0}
						<th class="league" rowSpan={ranks.length}>
							{metas[0].sex == 'm' ? 'Moški' : 'Ženske'}
							{metas[0].league}
						</th>
					{/if}
					<th>{(metas[0].rank || 1) + i}</th>
					{#each row as cell}
						<td
							on:mouseenter={() => (hoverHighlight = cell)}
							on:click={() => toggleHighlight(cell)}
							class={highlightClass(cell, highlights, hoverHighlight)}
							class:future={!cell.ranked}
						>
							{cell.name}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	{/each}
</table>

<label><input type="checkbox" bind:checked={steppedGraph} />Stopnicast graf (test)</label>
<div class="graph">
	<Line data={rankDataset} width={500} height={500} options={chartOptions} />
</div>

{#each pairGames as { team1, team2, games, win1, win2 }}
	<h2>{team1.name} vs {team2.name} ({games.length})</h2>
	{#if games.length == 0}
		<p>Ni iger.</p>
	{:else}
		<p>{team1.name} je zmagal {win1}x, {team2.name} pa {win2}x.</p>
		<ol>
			{#each games as game}
				<li>
					{game.score} za {game.winner.name} (liga {game.meta.league}, krog {game.meta.round})
				</li>
			{/each}
		</ol>
	{/if}
{/each}

<style>
	.highlight-0 {
		--highlight-color: #600f3f;
	}
	.highlight-1 {
		--highlight-color: #cc1e47;
	}
	.highlight-2 {
		--highlight-color: #e66a25;
	}
	.highlight-3 {
		--highlight-color: #f9a71a;
	}
	.future {
		color: #888;
		font-style: italic;
	}
	td.highlight {
		-webkit-text-stroke: 1px white;
		color: white;
		background-color: var(--highlight-color);
	}
	td.hover-highlight {
		background-color: #f0f0f0;
		-webkit-text-stroke: 1px var(--highlight-color);
		color: var(--highlight-color);
	}
	.graph {
		aspect-ratio: 1;
		max-width: min(100vw, 800px);
	}
</style>
