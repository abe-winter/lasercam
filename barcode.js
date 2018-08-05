/** barcode.js -- read an EAN barcode from a line of an image */

import * as util from './util';
import * as otsu from './otsu';
import * as barConst from './barConst';

/** totally arbitrary thing for finding barcode */
function isBarcode(ratio) {
  return ratio > 0.2 && ratio < 0.95;
}

function isWhite(ratio) {
  return ratio >= 0.99;
}

/** Find run of 1 white, 15-25 mixed, 1 white.
todo: this needs optimization w/ bigger data.
@deprecated delete this is not used in a while.
*/
function findRun(ratios) {
  let runStart, run = [];
  const minSize = ratios.length * 0.2;
  const maxSize = ratios.length * 0.6;
  for (let i=0; i<ratios.length; i++) {
    const ratio = ratios[i];
    if (runStart == null) {
      if (isWhite(ratio))
        runStart = i;
    } else {
      const isBar = isBarcode(ratio);
      if (isWhite(ratio) && run.length >= minSize && run.length <= maxSize)
        return {runStart, run};
      else if (isWhite(ratio)) {
        runStart = i;
        run = [];
      } else if (isBar) {
        run.push(ratio);
      } else {
        runStart = null;
        run = [];
      }
    }
  }
}

/** run as in run-length-encoding */
class Run {
  constructor(index, color) {
    this.index = index;
    this.color = color;
    this.n = 1;
  }
}

function runsInBound(runs, a, b, min, max) {
  for (let i=a; i<b; i++) {
    if (runs.get(i).n < min || runs.get(i).n > max)
      return false;
  }
  return true;
}

/** variance / mean. helper for preamble */
function barError(runs) {
  const values = [runs.get(1), runs.get(2), runs.get(3)].map(run => run.n);
  const mean = util.sum(values) / values.length;
  const variance = util.sum(values.map(x => (x-mean)*(x-mean)));
  return variance / mean;
}

/** Takes line that's been otsu'd.
Return first black pixel of barcode preamble. */
function findPreamble(line) {
  // this is looking for:
  // - (black white black white)
  // - with band-width 2-5 pixels (yeah arbitrary)
  // - with consistency of max(0.25 * band, 1 pixel) >> nope not checking this yet
  const MIN=1, MAX=10;
  const runs = new util.CircularBuffer(5);
  for (let i=0; i<line.length; i++) {
    if (runs.length && runs.last().color == line[i])
      runs.last().n += 1;
    else
      runs.push(new Run(i, line[i]), true);
    if (runs.length == 5
      && runs.get(0).color == 1
      && runsInBound(runs, 1, 4, MIN, MAX)
      && barError(runs) < 2
    ) {
      return runs.get(1).index;
    }
  }
}

function firstAndLast(array, predicate) {
  let first, last;
  for (let i=0; i<array.length; i++) {
    const yes = predicate(array[i]);
    if (yes) {
      if (first == null)
        first = i;
      last = i;
    }
  }
  return {first, last};
}

const EAN_GROUPS = [3, 4, 4, 4, 4, 4, 4, 5, 4, 4, 4, 4, 4, 4, 3];

/** read up the logical arrangement of EAN */
function getGroups(sections) {
  const output = new Array(EAN_GROUPS.length);
  let j = 0;
  for (const [i, expected_len] of EAN_GROUPS.entries()) {
    output[i] = sections
      .slice(j, j + expected_len)
      .map(section => section.pixels);
    j += expected_len;
  }
  return output;
}

/** return the more and less likely rounding targets */
function roundTwice(float) {
  const likely = Math.round(float);
  if (Math.abs(float - likely) < 0.25)
    return [likely];
  return [
    likely,
    likely > float ? Math.floor(float) : Math.ceil(float),
  ];
}

/** make a string for lookup in the table */
function widthsToString(widths, isLeft) {
  const bits = isLeft ? [0,1,0,1] : [1,0,1,0];
  const binary = [].concat.apply([],
    Array.from(widths.entries())
      .map(([i, width]) => new Array(width).fill(bits[i]))
  );
  return binary.join('');
}

/** Take the raw pixel widths and estimated bar width.
Return most likely hidden value (i.e. a string for digit lookup).
This is a job for markov / viterbi but it's only 2**4, brute force ftw.
todo: if 0-length holes are a thing, rework to handle them.
todo: return all options and permute based on checksum
*/
function likelyDigits(rawWidths, myBar, isLeft) {
  let perm = util.permute(rawWidths.map(x => roundTwice(x / myBar)));
  perm = perm.filter(row => util.sum(row) == 7);
  let strings = perm.map(string => widthsToString(string, isLeft));
  return strings.map(string => {
    if (isLeft) {
      if (barConst.ODD_STRINGS.has(string))
        return {digit: barConst.ODD_STRINGS.get(string), odd: true};
      else if (barConst.LEFT_EVEN_STRINGS.has(string))
        return {digit: barConst.LEFT_EVEN_STRINGS.get(string), odd: false};
      else
        return null;
    } else {
      return barConst.RIGHT_STRINGS.has(string) ? {digit: barConst.RIGHT_STRINGS.get(string), odd: false} : null;
    }
  }).filter(x => x);
}

function decodeDigit(bar, lengths, isLeft) {
  const tot = util.sum(lengths);
  if (Math.round(tot / bar) != 7)
    return [];
    // throw new Error(`bar1: ${tot}, ${bar}`);
  const myBar = tot / 7;
  return likelyDigits(lengths, myBar, isLeft);
}

/** return bool where true means the checksum passed */
function checkDigit(digits) {
  let sum = 0;
  for (const [i, x] of digits.slice(0, -1).entries()) {
    sum += i % 2 == 0 ? x : 3 * x;
  }
  const check = (10 - (sum % 10)) % 10;
  return check == digits[digits.length - 1];
}

/** trim down detected barcode area and decode it */
function decode(line, pixel0, options) {
  const inner = line.slice(pixel0);
  if (inner[0] != 0)
    return {error: "bad-clip"};
  const sections = [];
  // note: sections is same as Run class; reuse
  const maxSections = util.sum(EAN_GROUPS);
  for (const x of inner) {
    if (!sections.length || sections[sections.length - 1].x != x)
      sections.push({x, pixels:1});
    else
      sections[sections.length - 1].pixels += 1;
    if (sections.length > maxSections) // note: (strict >) because we need len of last
      break;
  }
  const groups = getGroups(sections);
  const normGroups = [].concat(groups[0], groups[7], groups[groups.length - 1]);
  const barSize = util.sum(normGroups) / normGroups.length;
  const digits = [].concat(
    groups.slice(1, 7).map(group => decodeDigit(barSize, group, true)),
    groups.slice(8, 14).map(group => decodeDigit(barSize, group, false)),
  );
  if (digits.some(arr => arr.length == 0))
    return {error: "missing digits", details: digits.map(arr => arr.length)};
  const possible = util.permute(digits);
  const parityPossible = [];
  for (const perm of possible) {
    const odds = perm.slice(0, 6).map(({odd}) => Number(odd));
    const digit1 = barConst.ODD_EVEN_PREFIX.get(odds.join(''));
    if (digit1 != null) {
      parityPossible.push([digit1].concat(perm.map(({digit}) => digit)));
    }
  }
  if (parityPossible.length == 0)
    return {error: "parity"};
  const checkPossible = parityPossible.filter(row => checkDigit(row));
  if (checkPossible.length == 0)
    return {error: "check"};
  let final;
  if (options.likelyCountryCode != null) {
    const matchingCountry = checkPossible.filter(row => row[0] == options.likelyCountryCode);
    final = matchingCountry.length ? matchingCountry[0] : checkPossible[0];
  } else
    final = checkPossible[0];
  return {
    decoded: [final.slice(0,1).join(''), final.slice(1,7).join(''), final.slice(7).join('')].join('-')
  }
}

/** Entrypoint for barcode reading.
Pass a Uint8Array, @returns a string or throws. */
export function lineToBarcode(line, options) {
  options = options || {};
  const line2 = otsu.smoothThresh(line, 100, 0.9);
  const pixel0 = findPreamble(line2);
  if (pixel0 == null)
    return {error: "no-preamble"};
  else
    return decode(line2, pixel0, options);
}
