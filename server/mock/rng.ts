export interface Rng {
  next: () => number;
  int: (min: number, max: number) => number;
  float: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
  pick: <Item>(items: readonly Item[]) => Item;
  shuffle: <Item>(items: readonly Item[]) => Item[];
  normal: (mean: number, deviation: number) => number;
  poisson: (lambda: number) => number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const float = (min: number, max: number) => next() * (max - min) + min;
  const chance = (probability: number) => next() < probability;

  const pick = <Item>(items: readonly Item[]): Item => {
    const item = items[Math.floor(next() * items.length)];
    if (item === undefined) throw new Error("Cannot pick from an empty list");
    return item;
  };

  const shuffle = <Item>(items: readonly Item[]): Item[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(next() * (index + 1));
      const current = copy[index] as Item;
      copy[index] = copy[swapIndex] as Item;
      copy[swapIndex] = current;
    }
    return copy;
  };

  const normal = (mean: number, deviation: number) => {
    const u = Math.max(next(), 1e-9);
    const v = next();
    return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const poisson = (lambda: number) => {
    const limit = Math.exp(-lambda);
    let count = 0;
    let product = next();
    while (product > limit) {
      count += 1;
      product *= next();
    }
    return count;
  };

  return { next, int, float, chance, pick, shuffle, normal, poisson };
}
