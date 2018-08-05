/** barConst.js -- barcode-related constants */

/** helper to generate all lookup strings from just odd */
function allStrings(odd) {
  // from lookup table here: https://en.wikipedia.org/wiki/EAN_barcode#EAN-13_encoding
  const even = odd.split('').map(char => char == '0' ? '1' : char == '1' ? '0' : '?').join('');
  return [
    odd,
    even.split('').reverse().join(''),
    even,
  ];
}

/** turn an odd string into an even right-half string */
function oddToRight(odd) {
  return odd
    .split('')
    .map(char => char == '0' ? '1' : char == '1' ? '0' : '?')
    .join('');
}

/** turn an even right string into an even left-half string */
function reverseString(string) {
  return string.split('').reverse().join('');
}

export const ODD_STRINGS = new Map([
  ['0001101', 0],
  ['0011001', 1],
  ['0010011', 2],
  ['0111101', 3],
  ['0100011', 4],
  ['0110001', 5],
  ['0101111', 6],
  ['0111011', 7],
  ['0110111', 8],
  ['0001011', 9],
]);
if (ODD_STRINGS.size != 10) {
  throw new Error("size != 10");
}

export const RIGHT_STRINGS = new Map(Array.from(ODD_STRINGS.entries()).map(
  ([string, digit]) => [oddToRight(string), digit]
));

export const LEFT_EVEN_STRINGS = new Map(Array.from(RIGHT_STRINGS.entries()).map(
  ([string, digit]) => [reverseString(string), digit]
));

/** use this to find secret first digit from parity of left 6 digits */
export const ODD_EVEN_PREFIX = new Map([
  ['111111', 0], // OOOOOO
  ['110100', 1], // OOEOEE
  ['110010', 2], // OOEEOE
  ['110001', 3], // OOEEEO
  ['101100', 4], // OEOOEE
  ['100110', 5], // OEEOOE
  ['100011', 6], // OEEEOO
  ['101010', 7], // OEOEOE
  ['101001', 8], // OEOEEO
  ['100101', 9], // OEEOEO
]);
