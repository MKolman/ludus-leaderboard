<script lang="ts">
	import { onMount } from 'svelte';

	type Table = string[][];
	type Meta = { round: number; league: string; sex: string; rank?: number };
	let hoverHighlight = '';
	let highlights: string[] = [];
	$: cleanHighlights = highlights.map(cleanHighlight);
	let dataAge = '1707129537787';
	let loading = false;
	$: formattedDataAge = new Date(+dataAge).toLocaleString('sl-SI', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: 'numeric'
	});

	let rawData: [string, string][] = [];
	let ranks: [string, string[], Meta][];
	let rows: [Meta, Table][];
	$: ranks = rawData.map(([name, txt]) => [name, getRank(parseCsv(txt)), extractMeta(name)]);
	$: rows = transposeToRows(ranks);

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
		let age = localStorage.getItem('dataAge');
		let data = localStorage.getItem('data');
		if (age == null || data == null) {
			age = '1707129537787';
			data = await (await fetch('data.json')).text();
			localStorage.setItem('data', data);
			localStorage.setItem('dataAge', age);
		}
		dataAge = age;
		rawData = JSON.parse(data);
		rawData.sort();
	}

	async function reloadData() {
		loading = true;
		for (let tbody of document.querySelectorAll('tbody')) {
			tbody.remove();
		}
		const list_of_links = await (await fetch('links.txt')).text();
		const pairs = list_of_links.split('\n').map((line) => line.split(' '));
		const result = await Promise.all(
			pairs.map(async ([name, link]): Promise<[string, string]> => {
				let response = await fetch(link);
				if (response.status >= 400) {
					console.log(`Failed to fetch ${name} using ${link}`);
					return [name, ''];
				}
				let text = await response.text();
				return [name, text];
			})
		);
		rawData = result;
		dataAge = (+Date.now()).toString();
		localStorage.setItem('data', JSON.stringify(result));
		localStorage.setItem('dataAge', dataAge);
		loading = false;
	}

	function parseCsv(txt: string) {
		return txt.split('\r\n').map((line) => line.split(','));
	}

	function findFinalRank(data: Table) {
		const rank = 'KONČNA RAZVRSTITEV';
		for (let i = 0; i < data.length; i++) {
			for (let j = 0; j < data[i].length; j++) {
				if (data[i][j] == rank) {
					return [i, j];
				}
			}
		}
		return [null, null];
	}

	function extractFinalRank(data: Table, row: number, col: number) {
		const result = [];
		col++;
		for (let i = row + 1; i < data.length; i++) {
			if (data[i][col] == '') {
				break;
			}
			result.push(data[i][col]);
		}
		return result;
	}

	function getRank(data: Table): string[] {
		const [row, col] = findFinalRank(data);
		if (row == null || col == null) {
			return [];
		}
		return extractFinalRank(data, row, col);
	}

	function extractMeta(name: string) {
		const [sex, _l, league, _r, round] = name.split('_');
		return { sex, league, round: +round };
	}

	function transposeToRows(data: [string, string[], Meta][]): [Meta, Table][] {
		const transpose = (matrix: Table): Table => {
			const rows = matrix.length;
			const cols = matrix.reduce((maxLen, row) => Math.max(maxLen, row.length), 0);
			const result = Array.from({ length: cols }, () => Array(rows).fill(''));
			for (let i = 0; i < rows; i++) {
				for (let j = 0; j < matrix[i].length; j++) {
					result[j][i] = matrix[i][j];
				}
			}
			return result;
		};
		const result: [Meta, Table][] = [];
		let prevMeta: Meta = { round: 0, league: '', sex: '' };
		let group = [];
		let rank = 1;
		for (let [name, ranks, meta] of data) {
			if (prevMeta.round > meta.round) {
				prevMeta.rank = rank;
				if (prevMeta.league.endsWith('b')) {
					prevMeta.rank -= result[result.length - 1][1]?.length;
				}
				const rows = transpose(group);
				group = [];
				rank += rows.length;
				result.push([prevMeta, rows]);
			}
			if (prevMeta.sex != meta.sex) {
				rank = 1;
			}
			group.push(ranks);
			prevMeta = meta;
		}
		result.push([prevMeta, transpose(group)]);
		return result;
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
	td.highlight {
		font-weight: bold;
		color: white;
		&.highlight-0 {
			background-color: #600f3f;
		}
		&.highlight-1 {
			background-color: #cc1e47;
		}
		&.highlight-2 {
			background-color: #e66a25;
		}
		&.highlight-3 {
			background-color: #f9a71a;
		}
	}
	td.hover-highlight {
		background-color: #f0f0f0;
		font-weight: bold;
		&.highlight-0 {
			color: #600f3f;
		}
		&.highlight-1 {
			color: #cc1e47;
		}
		&.highlight-2 {
			color: #e66a25;
		}
		&.highlight-3 {
			color: #f9a71a;
		}
	}
</style>
