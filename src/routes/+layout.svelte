<script>
	import './styles.css';
</script>

<slot />
<footer>
	<p>
		Naredil <a href="https://www.kolman.si">Maks Kolman</a>. Koda na voljo na
		<a href="https://github.com/MKolman/ludus-leaderboard">GitHubu</a>.
		<br />
		<button on:click={() => navigator.clipboard.writeText(localStorage.getItem('data') || '')}
			>Raw</button
		>
	</p>
</footer>
