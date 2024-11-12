import classify from './classify';

export type Table = string[][];
export type Meta = { round: number; league: string; sex: string; url: string; date: string; rank?: number };
export type Team = { name: string; id: number; ranked?: boolean }
export type Game = { meta: Meta, team1: Team, team2: Team, winner: Team, score: string }
export type CsvExport = { name: string, data: string, url: string, date: string };

export class Round {
    meta: Meta;
    standings: Team[] = [];
    games: Game[] = [];
    constructor(name: string, data: string, url: string, date: string) {
        this.meta = extractMeta(name, url, date);
        const table = parseCsv(data)
        this.standings = getStandings(table);
        if (this.standings.every((team) => isNaN(team.id))) {
            this.standings = extractTeams(table);
        }
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

function extractTeams(data: Table): Team[] {
    const result = [];
    const included = new Set();
    for (let row = 6; row < data.length && row < 20; row++) {
        for (const col of [5, 12]) {
            if (data[row][col].length < 3) {
                continue;
            }
            const id = classify(data[row][col]);
            if (included.has(id)) {
                continue;
            }
            included.add(id);
            result.push({name: data[row][col], id});
        }
    }
    return result;
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
        result.push({name, id: classify(name), ranked: true});
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

function extractMeta(name: string, url: string, date: string): Meta {
    const [sex, _l, league, _r, round] = name.split('_');
    return { sex, league, round: +round, url, date };
}

export function transposeToRows(rounds: Round[]): [Meta[], Team[][]][] {
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
    const result: [Meta[], Team[][]][] = [];
    let prevMetas: Meta[] = [];
    let group = [];
    let rank = 1;
    for (let {meta, standings} of rounds) {
        if (prevMetas.length > 0 && prevMetas[prevMetas.length - 1].round > meta.round) {
            if (prevMetas[0].league.endsWith('b')) {
                prevMetas[0].rank = (prevMetas[0].rank || 0) - result[result.length - 1][1]?.length;
            }
            if (prevMetas[0].sex != meta.sex) {
                rank = 1;
            }
            const rows = transpose(group);
            rank += rows.length;
            result.push([prevMetas, rows]);
            group = [];
            prevMetas = [];
        }
        meta.rank = rank;
        group.push(standings);
        prevMetas.push(meta);
    }
    result.push([prevMetas, transpose(group)]);
    return result;
}

export function loadFromLocalStorage(): {age: number|null, data: CsvExport[]|null} {
    const result =  {age: JSON.parse(localStorage.getItem('dataAge') || 'null'), data: JSON.parse(localStorage.getItem('data') || 'null')};
    if (result.data && !result.data[0].name) {
        return {age: null, data: null};
    }
    return result;
}

export function saveToLocalStorage(data: CsvExport[], age?: string|number) {
    if (!age) {
        age = (+new Date());
    }
    data.sort((a, b) => a.name < b.name ? -1 : 1);
    localStorage.setItem('data', JSON.stringify(data));
    localStorage.setItem('dataAge', age.toString());
}

export async function loadFromServer(): Promise<{age: number, data: CsvExport[]}> {
    const data = await (await fetch('data.json')).json() as CsvExport[];
    return {age: 1731450605191, data: data.sort((a, b) => a.name < b.name ? -1 : 1)};
}

function exportUrlToView(url: string): string {
    // before: https://docs.google.com/spreadsheets/d/1krUfXLuar3mC5kginLAvi52eqQBRN2UJ/export?format=csv&gid=1637852195
    // after:  https://docs.google.com/spreadsheets/d/1krUfXLuar3mC5kginLAvi52eqQBRN2UJ/view?format=csv&gid=1637852195
    return url.replace('/export?format=csv&', '/view?');

}

function dateFromHeaders(headers: Headers): string {
    // attachment; filename="2.ALIGA-5.krogmoki15.2..csv"; filename*=UTF-8''2.A%20LIGA%20-%205.%20krog%20mo%C5%A1ki%20%2815.%202.%29.csv
    const cd = headers.get('content-disposition');
    const encFilename = cd?.split("filename*=UTF-8''")[1] || '((??))'
    const filename = decodeURIComponent(encFilename)
    return filename.slice(filename.indexOf('(')+1, filename.lastIndexOf(')'));
}

export async function loadFromSource(): Promise<{age: number, data: CsvExport[]}> {
    const listOfLinks = await (await fetch('links_2024_25.txt')).text();
    const pairs = listOfLinks.split('\n').map((line) => line.split(' '));
    const result = await Promise.all(
        pairs.map(async ([name, link]): Promise<CsvExport> => {
            const response = await fetch(link);
            const date = dateFromHeaders(response.headers);
            if (response.status >= 400) {
                console.error(`Failed to fetch ${name} using ${link}`);
                return {name, data: '', url: exportUrlToView(link), date};
            }
            let data = await response.text();
            return {name, data, url: exportUrlToView(link), date};
        })
    );
    result.sort((a, b) => a.name < b.name ? -1 : 1);
    return {age: +new Date(), data: result};
}