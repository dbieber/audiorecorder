var codec = new Speex({quality: 6});

var encode = function(buffer) {
    var datalen = buffer.length;
    var shorts = new Int16Array(datalen);
    for(var i=0; i<datalen; i++) {
      shorts[i] = Math.floor(Math.min(1.0, Math.max(-1.0, buffer[i])) * 32767);
    }

    return codec.encode(shorts, true);
}

var decode = function(buffer) {
    return codec.decode(buffer);
}
