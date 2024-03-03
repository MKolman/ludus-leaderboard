function clean(txt: string) {
    return txt.toLowerCase().replace(/[ *]/g, '').split('/').sort().join('/');
}

function distance(a: string, b: string, i?: number, j?: number, memo?: Map<number, number>): number {
    i = i || 0;
    j = j || 0;
    if (i === a.length || j === b.length) {
        return a.length + b.length - i - j;
    }
    if (memo === undefined) {
        memo = new Map();
    }
    const memoKey = i * 1000 + j;
    const val = memo.get(memoKey);
    if (val !== undefined) {
        return val;
    }
    if (a[i] == b[j]) {
        const val = distance(a, b, i + 1, j + 1, memo);
        memo.set(memoKey, val);
        return val
    }
    const result = 1 + Math.min(
        distance(a, b, i + 1, j, memo),
        distance(a, b, i, j + 1, memo),
        distance(a, b, i + 1, j + 1, memo),
    );
    memo.set(memoKey, result);
    return result;

}

class Classifier {
    #store: Map<string, number>;
    #nextId: number = 1;
    constructor() {
        this.#store = new Map();
    }

    getClass(txt: string): number {
        const key = clean(txt);
        const id = this.#store.get(key) || this.#fuzzyFind(key);
        if (id !== undefined) {
            this.#store.set(key, id);
            return id;
        }
        this.#store.set(key, this.#nextId);
        return this.#nextId++;
    }

    #fuzzyFind(txt: string) {
        let result = undefined;
        let bestDist = 3;
        for (const [key, id] of this.#store) {
            const dist = distance(key, txt);
            if (dist < bestDist) {
                result = id;
                bestDist = dist;
            }
        }
        return result;
    }
}

const classifier = new Classifier();
export default classifier.getClass.bind(classifier);
