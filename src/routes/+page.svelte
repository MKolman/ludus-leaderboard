<script lang="ts">
	import { onMount } from 'svelte';
	import * as ludus from '$lib/ludus';

	let hoverHighlight = '';
	let highlights: string[] = [];
	$: cleanHighlights = highlights.map(cleanHighlight);
	let dataAge = 1707129537787;
	let loading = false;
	$: formattedDataAge = new Date(dataAge).toLocaleString('sl-SI', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: 'numeric'
	});

	let rawData: [string, string][] = [];
	let ranks: [string, string[], ludus.Meta][];
	let rows: [ludus.Meta, ludus.Table][];
	$: ranks = rawData.map(([name, txt]) => [
		name,
		ludus.getRank(ludus.parseCsv(txt)),
		ludus.extractMeta(name)
	]);
	$: rows = ludus.transposeToRows(ranks);

	function highlightClass(txt: string, cleanSearches: string[], hoverHighlight: string) {
		const cleanTxt = cleanHighlight(txt);
		for (let [i, s] of cleanSearches.entries()) {
			if (s != '' && cleanTxt.includes(s)) {
				return `highlight highlight-${i % 4}`;
			}
		}
		if (hoverHighlight != '' && cleanTxt.includes(cleanHighlight(hoverHighlight))) {
			return `hover-highlight highlight-${cleanSearches.length % 4}`;
		}
		return '';
	}

	function cleanHighlight(txt: string) {
		return txt.toLowerCase().replace(/ /g, '');
	}

	function toggleHighlight(txt: string) {
		const cleanTxt = cleanHighlight(txt);
		const index = cleanHighlights.findIndex((s) => cleanTxt.includes(s));
		if (index == -1) {
			highlights = [...highlights, txt];
		} else {
			highlights.splice(index, 1);
			highlights = highlights;
		}
	}

	async function fetchRawData() {
		let { data, age } = ludus.loadFromLocalStorage();
		if (age == null || data == null) {
			({ data, age } = await ludus.loadFromServer());
			ludus.saveToLocalStorage(data, age);
		}
		dataAge = age;
		rawData = data;
		rawData.sort();
	}

	async function reloadData() {
		loading = true;
		rawData = [];
		({ data: rawData, age: dataAge } = await ludus.loadFromSource());
		ludus.saveToLocalStorage(rawData, dataAge);
		loading = false;
	}

	onMount(fetchRawData);
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
<table id="leaderboard" on:mouseleave={() => (hoverHighlight = '')}>
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
			<th>7. krog</th>
		</tr>
	</thead>
	{#each rows as [meta, ranks]}
		<tbody>
			{#each ranks as row, i}
				<tr>
					{#if i === 0}
						<th class="league" rowSpan={ranks.length}>
							{meta.sex == 'm' ? 'Moški' : 'Ženske'}
							{meta.league}
						</th>
					{/if}
					<th>{(meta.rank || 1) + i}</th>
					{#each row as cell}
						<td
							on:mouseenter={() => (hoverHighlight = cell)}
							on:click={() => toggleHighlight(cell)}
							class={highlightClass(cell, cleanHighlights, hoverHighlight)}
						>
							{cell}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	{/each}
</table>

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
</style>
