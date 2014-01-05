// The HTML5 Audio middleware that does the recording in modern browsers
var Html5Audio = {
    DEFAULT_WORKER_PATH: 'worker.js',
    worker: undefined,

    audioContext: undefined,
    playingSources: [],

    ready: false,
    recording: false,

    init: function(config) {
        Html5Audio.audioContext = new AudioContext();
        navigator.getUserMedia({audio: true}, Html5Audio._useStream, function(err){});

        var worker_path = (config && config.worker_path) || Html5Audio.DEFAULT_WORKER_PATH;
        try {
            Html5Audio.worker = new Worker(worker_path);
            Html5Audio.worker.onmessage = Html5Audio._handleMessage;
        } catch(error) {
            console.error(error);
        }
    },

    // Called by init with a MediaStream object
    _useStream: function(stream) {
        var mediaStreamSource = Html5Audio.audioContext.createMediaStreamSource(stream);
        var context = mediaStreamSource.context;

        var bufferLen = 4*4096;
        var numChannelsIn = 1;
        var numChannelsOut = 1;
        var node = context.createScriptProcessor(bufferLen, numChannelsIn, numChannelsOut);
        node.onaudioprocess = Html5Audio._handleAudio;

        mediaStreamSource.connect(node);
        node.connect(context.destination);

        Html5Audio.ready = true;
    },

    _handleAudio: function(event) {
        var buffer = event.inputBuffer.getChannelData(0);
        if (Html5Audio.recording) {
            Html5Audio.worker.postMessage({
                command: 'put',
                buffer: buffer
            });
        }
    },

    _handleMessage: function(event) {
        switch(event.data.command) {
            case 'get':
            var clip = event.data.clip;
            console.log(clip);
            Html5Audio.cb(clip);
            break;

            case 'print':
            console.log(event.data.message);
        }
    },

    record: function() {
        Html5Audio.recording = true;
    },

    stopRecording: function(cb) {
        if (Html5Audio.recording) {
            Html5Audio.cb = cb; // TODO(Bieber): Be more robust.
            Html5Audio.recording = false;
            Html5Audio.worker.postMessage({
                command: 'get'
            });
            Html5Audio.clear();
        }
    },

    clear: function() {
        Html5Audio.worker.postMessage({
            command: 'clear'
        });
    },

    playClip: function(clip, inHowLong, offset) {
        var when = Html5Audio.audioContext.currentTime + inHowLong;
        var samples = clip.samples;

        var newBuffer = Html5Audio.audioContext.createBuffer(1, samples.length, clip.sampleRate);
        newBuffer.getChannelData(0).set(samples);

        var newSource = Html5Audio.audioContext.createBufferSource();
        newSource.buffer = newBuffer;

        newSource.connect(Html5Audio.audioContext.destination);
        newSource.start(when, offset);

        Html5Audio.playingSources.push(newSource);
    },

    stopPlaying: function() {
        // Stops playing all playing sources.
        // TODO(Bieber): Make sure things are removed from playingSources when they finish naturally
        for (var i = 0; i < Html5Audio.playingSources.length; i++) {
          var source = Html5Audio.playingSources[i];
          source.stop(0);
          delete source;
        }
        Html5Audio.playingSources = [];
    },

    isRecording: function() {
        return Html5Audio.ready && Html5Audio.recording;
    }
};
