/** otsu.js -- otsu's method for thresholding an image -- and other edge detection */

import * as util from './util';

export function otsu(line) {
  const histo_ = util.histo(line, 30);
  const variance = util.histoVariance(histo_);
  const intra = new Float32Array(variance.length);
  let weightLeft = 0, weightRight = 1.0;
  let varianceLeft = 0, varianceRight = util.sum(variance);
  const score = new Float32Array(variance.length);
  for (let i=0; i<variance.length; i++) {
    // todo: should bin 0 be 0 or the first calculation? meh.
    const weightDelta = histo_.bins[i] / histo_.n;
    weightLeft += weightDelta;
    weightRight -= weightDelta;
    varianceLeft += variance[i];
    varianceRight += variance[i];
    score[i] = weightLeft * varianceLeft + weightRight * varianceRight;
  }
  const indexMax = util.imax(score);
  const binSize = (histo_.max - histo_.min) / histo_.nbins;
  const thresh = histo_.min + binSize * (indexMax + 0.5);
  return {score, thresh};
}

class RollingSum {
  constructor(width) {
    this.slots = new Uint8Array(width);
    this.pointer = 0;
    this.length = 0;
    this.sum = 0;
  }

  push(x) {
    if (this.length >= this.slots.length)
      this.sum -= this.slots[this.pointer];
    else
      this.length += 1;
    this.sum += x;
    this.slots[this.pointer] = x;
    this.pointer = (this.pointer + 1) % this.slots.length;
  }

  mean() {
    return this.sum / this.length;
  }
}

/** return array of same width width centered average of width pixels */
export function smooth(line, width) {
  // todo: ideally center this
  const ret = new Uint8Array(line.length);
  const roll = new RollingSum(width);
  // initialize the MA:
  for (let i=0; i<line.length && i<width; i++)
    roll.push(line[i]);
  // generate the MA:
  for (let i=0; i<line.length; i++) {
    roll.push(line[i]);
    ret[i] = roll.mean();
  }
  return ret;
}

/** return array of 0/1 */
export function smoothThresh(line, width, factor) {
  const thresh = smooth(line, width);
  const ret = new Uint8Array(line.length);
  for (let i=0; i<line.length; i++) {
    ret[i] = line[i] > thresh[i] * factor;
  }
  return ret;
}
