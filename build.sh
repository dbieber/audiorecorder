#!/bin/bash
mkdir -p build/temp build/release
javascript-packager --jsFile src/speex/speex.config --path src/speex --destDir build/temp --destFile speex
javascript-packager --jsFile src/worker/worker.config --path src/worker --destDir build/temp --destFile worker
javascript-packager --jsFile src/audiorecorder/audiorecorder.config --path src/audiorecorder --destDir build/temp --destFile audiorecorder
cp -v build/temp/audiorecorder.min.js build/release
cp -v build/temp/worker.min.js build/release
cp -v build/temp/audiorecorder.js build/release
cp -v build/temp/worker.js build/release
rm -rf build/temp
