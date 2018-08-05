#!/usr/bin/env python
"laser.py -- scan any barcode along centerline of image"

import glob, numpy, collections
from skimage import io, color, filters

def split(line, n):
  groupsize = line.shape[0] / n
  return [
    line[i*groupsize:(i+1)*groupsize]
    for i in range(n)
  ]

def is_barcode(ratio):
  "totally arbitrary thing for finding barcode"
  return ratio > 0.2 and ratio < 0.95

def is_white(ratio):
  return ratio >= 0.99

def find_run(ratios):
  "find run of 1 white, 15-25 bar, 1 white"
  run_start = None
  run = []
  for i, ratio in enumerate(ratios):
    if run_start is None:
      if is_white(ratio):
        run_start = i
    else:
      is_bar = is_barcode(ratio)
      if is_white(ratio) and len(run) >= 15 and len(run) <= 25:
        return run_start, run
      elif is_white(ratio):
        run_start = i
        run = []
      elif is_bar:
        run.append(ratio)
      else:
        run_start = None
        run = []

def get_groups(sections):
  groups = (3,) + (4,) * 6 + (5,) + (4,) * 6 + (3,)
  output = []
  i = 0
  for expected_len in groups:
    output.append([width for _, width in sections[i:i+expected_len]])
    i += expected_len
  assert len(output) == len(groups) \
    and all(len(iout) == expected for iout, expected in zip(output, groups))
  return output

def all_strings(odd):
  "helper to generate all lookup strings from just odd"
  # from lookup table here: https://en.wikipedia.org/wiki/EAN_barcode#EAN-13_encoding
  flip = {'0':'1', '1':'0'}
  even = ''.join(flip[char] for char in odd)
  return (
    odd,
    ''.join(reversed(even)),
    even,
  )

ODD_STRINGS = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
]
assert len(ODD_STRINGS) == 10

DIGIT_TO_STRINGS = [
  (i, all_strings(odd))
  for i, odd in enumerate(ODD_STRINGS)
]

# use this to find missing first digit from parity of left 6
ODD_EVEN_PREFIX = {
  '111111': 0, # OOOOOO
  '110100': 1, # OOEOEE
  '110010': 2, # OOEEOE
  '110001': 3, # OOEEEO
  '101100': 4, # OEOOEE
  '100110': 5, # OEEOOE
  '100011': 6, # OEEEOO
  '101010': 7, # OEOEOE
  '101001': 8, # OEOEEO
  '100101': 9, # OEEOEO
}

ODD_SET = set(ODD_STRINGS)

DIGIT_LOOKUP = {
  string: digit
  for digit, strings in DIGIT_TO_STRINGS
  for string in strings
}

assert len(DIGIT_LOOKUP) == len(DIGIT_TO_STRINGS) * 3, "ambiguous lookup string"

def decode_digit(bar, lengths, is_left=True):
  bits = (0,1,0,1) if is_left else (1,0,1,0)
  tot = sum(lengths)
  assert round(tot / bar) == 7, "failed first bar check"
  mybar = tot / 7.
  logical_widths = [int(round(len_ / mybar)) for len_ in lengths]
  assert sum(logical_widths) == 7, "failed second bar check"
  binary = sum(
    ([digit]*width for digit, width in zip(bits, logical_widths)),
    []
  )
  string = ''.join(map(str, binary))
  return DIGIT_LOOKUP[string], (string in ODD_SET)

def decode(line, nblocks, run_start, run):
  blocksize = len(line) / nblocks
  base = run_start * blocksize
  extract = line[base:(run_start + len(run) + 1)*blocksize]
  black = numpy.where(extract == 0)[0]
  exact = extract[black[0] : black[-1]+1]
  del extract
  assert exact[0] == 0 and exact[-1] == 0
  sections = []
  # todo: itertools.groupby
  for x in exact:
    if not sections or sections[-1][0] != x:
      sections.append([x, 1])
    else:
      sections[-1][1] += 1
  groups = get_groups(sections)
  bar = numpy.mean(groups[0] + groups[7] + groups[-1])
  left = [decode_digit(bar, x) for x in groups[1:7]]
  right = [decode_digit(bar, x, False) for x in groups[8:14]]
  odds = zip(*left)[1]
  digit1 = ODD_EVEN_PREFIX[''.join(str(int(x)) for x in odds)]
  final_digits = [digit1], zip(*left)[0], zip(*right)[0]
  print('-'.join(''.join(map(str, grp)) for grp in final_digits))
  return slice(base + black[0], base + black[-1]+1)

def main():
  for path in glob.glob('test-images/flat/*.jpg'):
    print('========', path)
    img = color.rgb2gray(io.imread(path))
    height = img.shape[0]
    # note: averaging over 5 pixels because why not
    line = img[height/2 - 2 : height/2 + 2, :].mean(axis=0)
    thresh = filters.threshold_otsu(line)
    nblocks = 40
    ratios = [float(sum(block > thresh)) / len(block) for block in split(line, nblocks)]
    run = find_run(ratios)
    if run:
      try: slice_ = decode(line > thresh, nblocks, *run)
      except Exception as err:
        slice_ = slice(0, -1)
        print('err', err)
      threshed = img > thresh
      for i in range(-8, -3) + range(3, 8):
        if i != 0:
          threshed[height / 2 + i, :] = 0
      io.imshow(threshed[:,slice_])
      io.show()

if __name__ == '__main__': main()
