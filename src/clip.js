// Defines the Clip API
var Clip = {
    create: function() {
        return {
            samples: [],
            sampleRate: 44100, // TODO(Bieber): Use actual sample rate
            speex: [],
            startTime: undefined,
        };
    },

    createFromSamples: function(samples) {
        var clip = Clip.create();
        Clip.setSamples(clip, samples);
        return clip;
    },

    createFromSpeex: function(speex) {
        var clip = Clip.create();
        Clip.setSpeex(clip, speex);
        return clip;
    },

    setStartTime: function(clip, time) {
        clip.startTime = time;
    },

    setSamples: function(clip, data) {
        clip.samples = data;
        Clip.computeSpeex(clip);
    },

    setSpeex: function(clip, data) {
        clip.speex = data;
        Clip.computeSamples(clip);
    },

    addSamples: function(clip, data) {
        for (var i = 0; i < data.length; i++) {
            clip.samples.push(data[i]);
        }
        // Note: Leaves speex out of date.
    },

    computeSamples: function(clip) {
        // Decodes speex data to get playable samples
        // TODO(Bieber): Make a copy
        clip.samples = decode(clip.speex);
    },

    computeSpeex: function(clip) {
        // Encodes samples to get smaller speex data
        // TODO(Bieber): Make a copy
        clip.speex = encode(clip.samples);
    },

    getStartTime: function(clip) {
        return clip.startTime;
    },

    getEndTime: function(clip) {
        return clip.startTime + Clip.getLength(clip);
    },

    getLength: function(clip) {
        return 1000 * clip.samples[0].length / clip.sampleRate;
    }
};
