var Codec = {
    speex: new Speex({quality: 4}),

    // TODO(Bieber): See if you need to make a copy before returning the buffer
    encode: function(buffer) {
        // To preserve length, encode a multiple of 160 samples.
        var datalen = buffer.length;
        var shorts = new Int16Array(datalen);
        for(var i = 0; i < datalen; i++) {
            shorts[i] = Math.floor(Math.min(1.0, Math.max(-1.0, buffer[i])) * 32767);
        }
        return Codec.speex.encode(shorts, true);
    },

    decode: function(buffer) {
        return Codec.speex.decode(buffer);
    }
};
