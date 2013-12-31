var Codec = {
    speex: new Speex({quality: 6}),

    // TODO(Bieber): See if you need to make a copy before returning the buffer
    encode: function(buffer) {
        var datalen = buffer.length;
        var shorts = new Int16Array(datalen);
        for(var i=0; i<datalen; i++) {
            shorts[i] = Math.floor(Math.min(1.0, Math.max(-1.0, buffer[i])) * 32767);
        }
        return Codec.speex.encode(shorts, true);
    },

    decode: function(buffer) {
        return Codec.speex.decode(buffer);
    }
};
