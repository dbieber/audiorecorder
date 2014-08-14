var Codec = {
    speex: new Speex({quality: 4}),

    // TODO(Bieber): See if you need to make a copy before returning the buffer
    encode: function(buffer) {
        // To preserve length, encode a multiple of 320 samples.
        var datalen = buffer.length;
        var shorts = new Int16Array(datalen);
        for(var i = 0; i < datalen; i++) {
            shorts[i] = Math.floor(Math.min(1.0, Math.max(-1.0, buffer[i])) * 32767);
        }
        var encoded = Codec.speex.encode(shorts, true);
        return encoded[0];
    },

    decode: function(buffer) {
        return Codec.speex.decode(buffer);
    }
};

var FileHandler = {
    speexFile: function(data) {
        var sampleRate = 44100;
        var isNarrowband = sampleRate < 16000;
        var oggdata = new Ogg(null, {file: true});

        var spxcodec = new Speex({
            quality: 8,
            mode: isNarrowband ? 0 : 1,
            bits_size: isNarrowband ? 15 : 70
        });

        var datalen = data.length;
        var shorts = new Int16Array(datalen);
        for(var i = 0; i < datalen; i++) {
            shorts[i] = Math.floor(Math.min(1.0, Math.max(-1.0, data[i])) * 32767);
        }
        spxdata = spxcodec.encode(shorts, true);

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

        var result = oggdata.mux([spxhdr, spxcmt, spxdata]);
        return result;
    }
};
