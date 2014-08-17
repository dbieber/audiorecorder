// AudioRecorder is a cross platform utility for recording and playing audio
// in all major browsers.

// TODO(Bieber): Make it work in Safari by falling back to Flash.
var AudioRecorder = {
    clip: undefined,
    middleware: undefined, // HTML5 or Flash audio

    init: function(config) {
        // Initializes the AudioRecorder
        window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

        var html5audio = !!window.AudioContext && !!navigator.getUserMedia;
        if (html5audio) {
            AudioRecorder.middleware = Html5Audio;
        } else {
            AudioRecorder.middleware = FlashAudio;
        }
        AudioRecorder.middleware.init(config);
    },

    record: function() {
        // Starts recording to the current clip
        if (AudioRecorder.isRecording()) return true;

        // If we can't record on the current clip, make a new one
        if (AudioRecorder.clip === undefined || AudioRecorder.clip.finalized) {
            AudioRecorder.newClip();
        }

        return AudioRecorder.middleware.record();
    },

    stopRecording: function(cb) {
        // Stops recording and passes the newly created clip object to the
        // callback function cb
        if (!AudioRecorder.isRecording()) return true;
        return AudioRecorder.middleware.stopRecording(cb);
    },

    newClip: function() {
        // Creates a new empty clip as the current clip
        if (AudioRecorder.isRecording()) {
            console.warn("Cannot create a new clip while recording");
            return false;
        }
        AudioRecorder.clip = Clip.create();
        return true;
    },

    getClip: function() {
        // Returns the current clips
        return AudioRecorder.clip;
    },

    setClip: function(clip) {
        // Sets the current clip
        if (AudioRecorder.isRecording()) {
            console.warn("Cannot set the clip while recording");
            return false;
        }
        AudioRecorder.clip = clip;
    },

    clear: function() {
        // Clears the current clip back to empty
        AudioRecorder.middleware.clear();
        return true;
    },

    playClip: function(clip, inHowLong, offset) {
        // Plays clip starting from the appropriate position at the
        // appropriate time
        if (inHowLong === undefined) {
            inHowLong = 0;
        }
        if (offset === undefined) {
            offset = 0;
        }
        AudioRecorder.middleware.playClip(clip, inHowLong, offset);
        return true;
    },

    stopPlaying: function() {
        // Stops all playing clips
        AudioRecorder.middleware.stopPlaying();
        return true;
    },

    isRecording: function() {
        // Returns True if currently recording, False otherwise
        return AudioRecorder.middleware.isRecording();
    }
};
