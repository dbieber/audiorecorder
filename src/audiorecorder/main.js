// AudioRecorder is a cross platform utility for recording and playing audio
// in all major browsers.

// TODO(Bieber): Make it work in Safari by falling back to Flash.
var AudioRecorder = {
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
        if (AudioRecorder.isRecording()) return;
        AudioRecorder.middleware.record();
    },

    stopRecording: function(cb) {
        // Stops recording and passes the newly created clip object to the
        // callback function cb
        if (!AudioRecorder.isRecording()) return;
        AudioRecorder.middleware.stopRecording(cb);
    },

    clear: function() {
        // Clears the current clip back to empty
        AudioRecorder.middleware.clear();
    },

    playClip: function(clip, inHowLong, offset) {
        // Plays clip starting from the appropriate position at the
        // appropriate time
        AudioRecorder.middleware.playClip(clip, inHowLong, offset);
    },

    stopPlaying: function() {
        // Stops all playing clips
        AudioRecorder.middleware.stopPlaying();
    },

    isRecording: function() {
        // Returns True if currently recording, False otherwise
        return AudioRecorder.middleware.isRecording();
    }
};
