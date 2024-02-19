export type Table = string[][];
export type Meta = { round: number; league: string; sex: string; rank?: number };

type Game = { team1: string, team2: string, winner: string, score: string }

export class Round {
    meta: Meta;
    standings: string[] = [];
    games: Game[] = [];
    constructor(name: string, data: string) {
        this.meta = extractMeta(name);
        this.standings = getRank(parseCsv(data));
    }

}

function parseCsv(txt: string): Table {
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

export function getRank(data: Table): string[] {
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

export function transposeToRows(rounds: Round[]): [Meta, Table][] {
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
    for (let {meta, standings} of rounds) {
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
        group.push(standings);
        prevMeta = meta;
    }
    result.push([prevMeta, transpose(group)]);
    return result;
}

export function loadFromLocalStorage(): {age: number|null, data: [string, string][]|null} {
    return {age: JSON.parse(localStorage.getItem('dataAge') || 'null'), data: JSON.parse(localStorage.getItem('data') || 'null')};
}

export function saveToLocalStorage(data: [string, string][], age?: string|number) {
    if (!age) {
        age = (+new Date());
    }
    data.sort();
    localStorage.setItem('data', JSON.stringify(data));
    localStorage.setItem('dataAge', age.toString());
}

export async function loadFromServer(): Promise<{age: number, data: [string, string][]}> {
    const data = await (await fetch('data.json')).json() as [string, string][];
    return {age: 1707129537787, data: data.sort()};
}

export async function loadFromSource(): Promise<{age: number, data: [string, string][]}> {
    const listOfLinks = await (await fetch('links.txt')).text();
    const pairs = listOfLinks.split('\n').map((line) => line.split(' '));
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
    result.sort();
    return {age: +new Date(), data: result};
}