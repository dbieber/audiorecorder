// Defines the Clip API
var Clip = {
    create: function() {
        return {
            samples: [],
            sampleRate: 44100, // TODO(Bieber): Use actual sample rate
            speex: [[],[]], // samples, frame sizes
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

    createFromWaveFile: function(wav) {

    },

    createFromSpeexFile: function(spx) {

    },

    asWaveFile: function(clip) {

    },

    asSpeexFile: function(clip) {
        var sampleRate = clip.sampleRate;
        var isNarrowband = sampleRate < 16000;
        var oggdata = new Ogg(null, {file: true});

        var spxhdr = new SpeexHeader({
            bitrate: -1,
            extra_headers: 0,
            frame_size: isNarrowband ? 160 : 320,
            frames_per_packet: 1,
            header_size: 80,
            mode: isNarrowband ? 0 : 1,
            mode_bitstream_version: 4,
            nb_channels: 1,
            rate: sampleRate,
            reserved1: 0,
            reserved2: 0,
            speex_string: "Speex   ",
            speex_version_id: 1,
            speex_version_string: "1.2rc1\0\0\0\0\0\0\0\0\0\0\0\0\0\0",
            vbr: 0
        });

        var comment = "Encoded with speex.js";
        var spxcmt = new SpeexComment({
            vendor_string: comment,
            vendor_length: comment.length
        });

        var spxdata = clip.speex;

        var result = oggdata.mux([spxhdr, spxcmt, spxdata]);
        return result;
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
        Array.prototype.push.apply(clip.speex[0], data[0]);
        Array.prototype.push.apply(clip.speex[1], data[1]);
    },

    // WARNING: Potentially slow.
    computeSamples: function(clip) {
        // Decodes speex data to get playable samples
        // TODO(Bieber): Make a copy
        // TODO(Bieber): Move to background thread
        clip.samples = Codec.decode(clip.speex[0]);
    },

    // WARNING: Potentially slow.
    computeSpeex: function(clip) {
        // Encodes samples to get smaller speex data
        // TODO(Bieber): Make a copy
        // TODO(Bieber): Move to background thread
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
