var Codec = {
    speex: new Speex({
        quality: 8,
        mode: 1,
        bits_size: 70
    }),

    encode: function(buffer, copy) {
        // To preserve length, encode a multiple of 320 samples.
        var datalen = buffer.length;
        var shorts = new Int16Array(datalen);
        for(var i = 0; i < datalen; i++) {
            shorts[i] = Math.floor(Math.min(1.0, Math.max(-1.0, buffer[i])) * 32767);
        }
        var encoded_buffer = Codec.speex.encode(shorts, true);
        if (!copy) return encoded_buffer;

        // Return a copy of the buffer
        var encoded = [[],[]];
        Array.prototype.push(encoded[0], encoded_buffer[0]);
        Array.prototype.push(encoded[1], encoded_buffer[1]);
        return encoded;
    },

    decode: function(buffer, copy) {
        var decoded_buffer = Codec.speex.decode(buffer);
        if (!copy) return decoded_buffer;

        // Return a copy of the buffer
        var decoded = [];
        Array.prototype.push(decoded, decoded_buffer);
        return decoded;
    }
};
