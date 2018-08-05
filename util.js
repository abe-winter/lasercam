/** util.js -- misc numeric functions */

/** return {bins, min, max, nbins}. empty array will break. */
export function histo(array, nbins) {
  let min = array[0], max = array[0], total = 0;
  for (const x of array) {
    if (x < min)
      min = x;
    else if (x > max)
      max = x;
    total += x;
  }
  // todo: assert length of array fits in Uint16
  var bins = new Uint16Array(nbins);
  const range = max - min;
  for (const x of array) {
    const ibin = Math.floor((x - min) / range * nbins);
    bins[ibin] += 1;
  }
  return {min, max, bins, nbins, n: array.length, mean: total / array.length};
}

/** return float array with len = histo bins indicating variance contrib from each bin */
export function histoVariance(histo) {
  const ret = new Float32Array(histo.nbins);
  const binSize = (histo.max - histo.min) / histo.nbins;
  for (let i=0; i<ret.length; i++) {
    const midpoint = histo.min + (i + 0.5) * binSize;
    // ugh; uglify doesn't support exponentiation
    const delta = midpoint - histo.mean;
    ret[i] = histo.bins[i] * delta * delta;
  }
  return ret;
}

export function sum(array) {
  let tot = 0;
  for (const x of array)
    tot += x;
  return tot;
}

/** index of maximum */
export function imax(array) {
  let index = 0, max = array[0];
  for (let i=0; i<array.length; i++) {
    if (array[i] > max) {
      max = array[i];
      index = i;
    }
  }
  return index;
}

/** return nbins slices from line */
export function split(line, nbins) {
  const groupsize = line.length / nbins;
  const ret = new Array(nbins);
  for (let i=0; i<nbins; i++) {
    ret[i] = line.slice(i * groupsize, (i+1) * groupsize);
  }
  return ret;
}

/** return array of 0/1 */
export function threshold(line, thresh) {
  const ret = new Uint8Array(line.length);
  for (let i=0; i<line.length; i++) {
    ret[i] = line[i] > thresh;
  }
  return ret;
}

/** Given [[a,b], [c,d]], return [[a,c], [a,d], [b,c], [b,d]].
Least efficent implementation I can think of (builds arrays from the front). */
export function permute(tuples) {
  switch (tuples.length) {
  case 0:
    return [];
  case 1:
    return tuples[0].map(x => [x]);
  default: {
    const tails = permute(tuples.slice(1));

    const ret = [];
    for (const x of tuples[0]) {
      for (const tail of tails) {
        ret.push([].concat.apply([x], tail));
      }
    }
    return ret;
  }
  }
}

export class CircularBuffer {
  constructor(n) {
    this.n = n;
    this.pointer = 0;
    this.length = 0;
    this.values = new Array(n);
  }

  /** evict is a boolean */
  push(x, evict) {
    if (this.length >= this.n) {
      if (evict)
        this.popleft();
      else
        throw new Error("no space");
    }
    this.values[(this.pointer + this.length) % this.n] = x;
    this.length += 1;
  }

  incrementPointer() {
    this.pointer = (this.pointer + 1) % this.n;
  }

  popleft() {
    if (this.length > 0) {
      delete this.values[this.pointer];
      this.incrementPointer();
      this.length -= 1;
    }
  }

  get(index) {
    if (index >= this.length || index < 0)
      throw new Error("out of bounds");
    return this.values[(this.pointer + index) % this.n];
  }

  last() {
    if (this.length == 0)
      throw new Error("empty");
    return this.values[(this.pointer + this.length - 1) % this.n];
  }
}
