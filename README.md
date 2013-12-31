AudioRecorder
=============

AudioRecorder [seeks to be] a cross platform javascript utility for recording and playing audio in all major browsers.
The clips that AudioRecorder produces contain both raw wave audio data and speex encoded data.
Included with AudioRecorder is a utility for encoding raw samples to speex (`Codec.encode(samples)`) and decoding from speex (`Codec.decode(speex)`). If you are uploading audio data to a server, upload only the speex data and reconstruct the samples client side later for playback.

To use AudioRecorder:
------------

1. Include the script *build/release/audiorecorder.js*

  That will look something like: `<script type="text/javscript" src="audiorecorder.min.js"></script>`

  This creates the `AudioRecorder` object for you but does not initialize it. It also creates the `Clip` object.

2. Call `AudioRecorder.init(config);`

  Config is an object like this: `var config = {
                'worker_path': 'worker.min.js'
            };`

  This will request the user's permission to access their microphone.

3. You can now use the entire *AudioRecorder* and *Clip* APIs. Hooray!

AudioRecorder API
------------

#### The best documentation is the code itself. Have a look at [src/audiorecorder/main.js](src/audiorecorder/main.js)?

##### You will also find that [examples/recorder.html](dbieber.github.io/audiorecorder/examples/recorder.html) ([src](examples/recorder.html)) does a very nice job of demonstrating the API.

>AudioRecorder.init(config);

Initializes the AudioRecorder.

`config` is an object like this: `var config = {
                'worker_path': 'worker.min.js'
            };`

>AudioRecorder.record();

Starts recording to the current clip.

>AudioRecorder.stopRecording(cb);

Stops recording and passes the newly created Clip object to the callback function `cb`

I'll say that again for emphasis. *This* is where Clip objects come from. *This* is how you get inputs for the Clip API.

>AudioRecorder.clear();

Clears the current clip back to empty

>AudioRecorder.playClip(clip, inHowLong, offset);

Plays `clip` starting from the appropriate position at the appropriate time. `clip` is a Clip object. `inHowLong` and `offset` are in milliseconds.

>AudioRecorder.stopPlaying();

Stops all currently playing clips.

>AudioRecorder.isRecording();

Returns True if currently recording, False otherwise

Clip API
------------

#### The best documentation is the code itself. Have a look at [src/clip.js](src/clip.js)?

>clip.samples

An array of samples representing the audio signal

>clip.speex

The speex encoding of the audio signal. If you have to save something server side, save this.

##### The following methods and more are provided by the `Clip` object. Long running methods like *createFromSpeex* should not be called directly since they will cause the browser to hang while they run. Instead they should be called only in a web worker, for instance by the AudioRecorder API.

>Clip.create()

Creates a new empty clip object

>Clip.createFromSamples(samples)

Creates a new clip object from the provided samples

>Clip.createFromSamples(speex)

Creates a new clip object from the provided speex encoded data

>Clip.getLength(clip)

Returns the length of `clip`

#####And more! Take a look at src/clip.js for the full API.

Codec API
------------

>Codec.encode(samples)

Returns a buffer containing the speex data representing the audio signal

>Codec.decode(speex)

Returns a buffer containing the PCM data representing the audio signal

Thanks
------------

AudioRecorder builds on an [emscripten](https://github.com/kripken/emscripten) compiled speex codec [jpemartins/speex.js](https://github.com/jpemartins/speex.js/) and takes many lessons from [mattdiamond/Recorderjs](https://github.com/mattdiamond/Recorderjs) and [jwagener/recorder.js](https://github.com/jwagener/recorder.js/). I am developing AudioRecorder primarily as part of [Teach Everyone](http://teacheveryone.org), but am open sourcing it separately in the hope that it is more generally useful.
