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

    createFromWaveFile: function(file) {

    },

    createFromSpeexFile: function(file) {

    },

    asWaveFile: function(clip, callback) {
        // TODO(Bieber): Make this work
        var samples = clip.samples;
        var sampleRate = clip.sampleRate;

        var buffer = new ArrayBuffer(44 + samples.length * 2);
        var view = new DataView(buffer);

        function floatTo16BitPCM(view, offset, input) {
            for (var i = 0; i < input.length; i++, offset += 2) {
                var s = Math.max(-1, Math.min(1, input[i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        }

        function writeString(view, offset, string) {
            for (var i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 44 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);
        floatTo16BitPCM(view, 44, samples);

        var audioBlob = new Blob([view], {
            type: 'wav'
        });

        return (window.URL || window.webkitURL).createObjectURL(audioBlob);
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
