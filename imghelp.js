/** imghelp.js -- image manipulation helpers */

/** takes an ImageData. returns something similar but with single byte pixels instead of rgba */
export function grayout(data) {
  const target = new Uint8ClampedArray(data.data.length / 4);
  for (let i=0; i<target.length; i++) {
    target[i] = (data.data[4*i] + data.data[4*i+1] + data.data[4*i+2]) / 3;
  }
  return {data:target, width:data.width, height:data.height};
}

/** crazy helper to take an N-line image and average it to one */
export function collapseLines(grayData) {
  const width = grayData.width, height = grayData.height, source = grayData.data;
  const target = new Uint8ClampedArray(width);
  for (let i=0; i<width; i++) {
    let temp = 0;
    for (let j=0; j<height; j++) {
      temp += source[j*width + i];
    }
    target[i] = temp / height;
  }
  return target;
}
