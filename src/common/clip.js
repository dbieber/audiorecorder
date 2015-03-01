// Defines the Clip API
var Clip = {
    create: function() {
        return {
            samples: [],
            sampleRate: 44100, // TODO(Bieber): Use actual sample rate
            speex: [],
            startTime: undefined,
            finalized: false
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

    // WARNING: Leaves speex out of date.
    addSamples: function(clip, data) {
        Array.prototype.push.apply(clip.samples, data);
    },

    // WARNING: Leaves samples out of date.
    addSpeex: function(clip, data) {
        var tmp = new Uint8Array(clip.speex.byteLength + data.byteLength); 
    	tmp.set(new Uint8Array(clip.sppex), 0); 
    	tmp.set(new Uint8Array(data), clip.speex.byteLength); 
    	clip.speex = tmp;
    },

    // WARNING: Potentially slow.
    computeSamples: function(clip) {
        // Decodes speex data to get playable samples
        // TODO(Bieber): Make a copy
        clip.samples = Codec.decode(clip.speex);
    },

    // WARNING: Potentially slow.
    computeSpeex: function(clip) {
        // Encodes samples to get smaller speex data
        // TODO(Bieber): Make a copy
        clip.speex = Codec.encode(clip.samples);
    },

    getStartTime: function(clip) {
        return clip.startTime;
    },

    getEndTime: function(clip) {
        return clip.startTime + Clip.getLength(clip);
    },

    // Returns clip length in milliseconds.
    getLength: function(clip) {
        return 1000 * clip.samples.length / clip.sampleRate;
    },

    finalize: function(clip) {
        clip.finalized = true;
    }
};
