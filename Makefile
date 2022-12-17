MXMLC = "mxmlc"

all: build/release

build/release: build build/temp/speex.js build/temp/worker.js build/temp/audiorecorder.js
	cp -v build/temp/audiorecorder.min.js build/release
	cp -v build/temp/worker.min.js build/release
	cp -v build/temp/audiorecorder.js build/release
	cp -v build/temp/worker.js build/release
	rm -rf build/temp/

build:
	mkdir -p build/temp build/release

build/temp/speex.js:
	javascript-packager --jsFile src/speex/speex.config --path src/speex --destDir build/temp --destFile speex

build/temp/worker.js: build/temp/speex.js src/common/clip.js src/worker/worker.js
	javascript-packager --jsFile src/worker/worker.config --path src/worker --destDir build/temp --destFile worker

build/temp/audiorecorder.js: build/temp/speex.js src/common/clip.js src/html5audio.js src/flashaudio.js src/main.js
	javascript-packager --jsFile src/audiorecorder/audiorecorder.config --path src/audiorecorder --destDir build/temp --destFile audiorecorder

swf:
	$(MXMLC) -debug=false -static-link-runtime-shared-libraries=true -optimize=true -o recorder.swf -file-specs flash/FlashRecorder.as

clean:
	rm recorder.swf
