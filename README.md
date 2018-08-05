# lasercam

This is a JS library for scanning barcodes, intented for grabbing barcodes from the webcam inside a browser.

I wrote this a while ago for a project and am open sourcing it in case it's useful to others.

IIRC this takes like 10ms to scan a barcode on my laptop and is performant on mobile.

## files

* index.htm: demo that will use the webcam on your laptop. I think you need to run `npm run build` first. Also need to start chrome in a weird way to get webcam access on localost; the HTML has instructions.
* index.js: JS entrypoint
* laser.py: python version of this codebase, not as current

## todo

* docs
* sample images for testing
