import classify from './classify';

export type Table = string[][];
export type Meta = { round: number; league: string; sex: string; rank?: number };
export type Team = { name: string, id: number }
export type Game = { meta: Meta, team1: Team, team2: Team, winner: Team, score: string }

export class Round {
    meta: Meta;
    standings: Team[] = [];
    games: Game[] = [];
    constructor(name: string, data: string) {
        this.meta = extractMeta(name);
        const table = parseCsv(data)
        this.standings = getStandings(table);
        this.games = extractGames(table).map((game) => ({...game, meta: this.meta}));
    }

}

function parseCsv(txt: string): Table {
    return txt.split('\r\n').map((line) => line.split(','));
}

function findHeader(data: Table, header: string) {
    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
            if (data[i][j] == header) {
                return [i, j];
            }
        }
    }
    return [null, null];
}

function extractGames(data: Table) {
    const score = (sets1: string[], sets2: string[]): [number, number] => {
        const result: [number, number] = [0, 0];
        for (let i = 0, j=0; i < sets1.length && j < sets2.length; i++, j++) {
            if (sets1[i].length == 0) {
                j--;
                continue;
            }
            if (sets2[j].length == 0) {
                i--;
                continue;
            }
            result[+sets1[i] < +sets2[j]?1:0]++;
        }
        return result;
    }

    const result = [];
    // Columns:
    const team1 = 5;
    const team2 = 12;
    const sets1 = 6;
    const sets2 = 7;
    for (let row = 6; row < data.length; row++) {
        if (!data[row][team1].includes('/') || !data[row][team2].includes('/')) {
            continue;
        }
        const [w1, w2] = score([data[row][sets1], data[row][sets1+2], data[row][sets1+4]], [data[row][sets2], data[row][sets2+2], data[row][sets2+4]]);
        const t1 = {name: data[row][team1], id: classify(data[row][team1])};
        const t2 = {name: data[row][team2], id: classify(data[row][team2])};
        if (w1 == 0 && w2 == 0) {
            continue;
        }
        result.push({
            team1: t1,
            team2: t2,
            winner: w1 > w2 ? t1 : t2,
            score: `${w1}:${w2}`
        })
    }
    return result;
}

function extractStandings(data: Table, row: number, col: number) {
    const result = [];
    col++;
    for (let i = row + 1; i < data.length && i < row + 9; i++) {
        const name = data[i][col];
        if (name.length < 3) {
            result.push({name: '', id: NaN});
            continue;
        }
        result.push({name, id: classify(name)});
    }
    while (result.length && !result.at(-1)?.id) {
        result.pop();
    }
    return result;
}

export function getStandings(data: Table): Team[] {
    for (const [header, colOffset] of [['KONČNA RAZVRSTITEV', 0], ['RAZVRSTITEV', -1], ['K O N Č N A    R A Z V R S T I T E V', -1]] as [string, number][]) {
        const [row, col] = findHeader(data, header);
        if (row === null || col === null) {
            continue;
        }
        const result = extractStandings(data, row, col+colOffset);
        if (result.length > 0) return result;
    }
    return [];
}

function extractMeta(name: string) {
    const [sex, _l, league, _r, round] = name.split('_');
    return { sex, league, round: +round };
}

export function transposeToRows(rounds: Round[]): [Meta, Team[][]][] {
    const transpose = <T>(matrix: T[][]): T[][] => {
        const rows = matrix.length;
        const cols = matrix.reduce((maxLen, row) => Math.max(maxLen, row.length), 0);
        const result = Array.from({ length: cols }, () => Array(rows).fill({name: '', id: NaN}));
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < matrix[i].length; j++) {
                result[j][i] = matrix[i][j];
            }
        }
        return result;
    };
    const result: [Meta, Team[][]][] = [];
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
    const listOfLinks = await (await fetch('links_2024_25.txt')).text();
    const pairs = listOfLinks.split('\n').map((line) => line.split(' '));
    const result = await Promise.all(
        pairs.map(async ([name, link]): Promise<[string, string]> => {
            let response = await fetch(link);
            if (response.status >= 400) {
                console.error(`Failed to fetch ${name} using ${link}`);
                return [name, ''];
            }
            let text = await response.text();
            return [name, text];
        })
    );
    result.sort();
    return {age: +new Date(), data: result};
}