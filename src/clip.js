// Defines the Clip API
var Clip = {
    create: function() {
        return {
            samples: [],
            sampleRate: undefined,
            speex: [],
            startTime: undefined,
        };
    },

    createFromSamples: function(samples) {
        var clip = Clip.create();
        Clip.setSamples(clip, samples);
        clip.sampleRate = 44100;
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

    setSamplesAt: function(clip, data, time) {
        var sampleRate = clip.sampleRate;
        var sampleIndex = (time - clip.startTime) / sampleRate;
        // TODO(Bieber): webworker this
        for (var i = 0; i < data.length; i++) {
            clip.samples[i] = data[i];
        }
        Clip.computeSpeex(clip);
    },

    setSpeex: function(clip, data) {
        clip.speex = data;
        Clip.computeSamples(clip);
    },

    setSpeexAt: function(clip, data, time) {
        var speexRate = 256;
        var sampleIndex = (time - clip.startTime) / speexRate;
        // TODO(Bieber): webworker this
        for (var i = 0; i < data.length; i++) {
            clip.samples[i] = data[i];
        }
        Clip.computeSamples(clip);
    },

    computeSamples: function(clip) {
        // Decodes speex data [TODO(Bieber): in a webworker] to get playable samples
        clip.samples = decode(clip.speex);
        clip.sampleRate = 44100;
    },

    computeSpeex: function(clip) {
        // Encodes samples [TODO(Bieber): in a webworker] to get smaller speex data
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
