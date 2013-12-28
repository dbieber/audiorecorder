(function () {

var autoEcho = true;
var Context = window["webkitAudioContext"] || window["mozAudioContext"] || window["AudioContext"];
var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
var buffer = [];

function startCapture() {
  var supported = typeof(Context) !== "undefined";
  supported &= !!(new Context()).createMediaElementSource;
  supported &= !!getUserMedia;

  if (supported) {
    gUM_startCapture();
    return;
  }

  flash_startCapture();
}

function getBuffer() {
    return buffer;
}

function clearBuffer() {
    buffer = [];
}

function playBuffer(buffer) {
    var sink = new XAudioServer(1, 8000, 320, 512, function (samplesRequested) {}, 0);
    for (var i = 0; i < buffer.length; i++) {
        var encoded = buffer[i];
        if (!!encoded) {
            decoded = codec.decode(encoded);
            sink.writeAudio(decoded);
        }
    }
}

function gUM_startCapture() {
    var codec = new Speex({ quality: 6 });

    function onmicaudio (samples) {
        var encoded = codec.encode(samples), decoded;
        // console.log("maybeWritingAudio");
        if (!!encoded) {
            buffer.push(_.extend([], encoded));
            if (autoEcho) {
                decoded = codec.decode(encoded);
                console.log("writing 2 sink ");
                // console.log("writing to sink " + samples.length + " > " + encoded.length + " > " + decoded.length);
                sink.writeAudio(decoded);
            }
        }
    }

    var samplesPerCallback = 1024;
    var maxBuffer = 512 * 8;
    var resampler = new Resampler(44100, 8000, 1, samplesPerCallback);
    var sink = new XAudioServer(1, 8000, 320, maxBuffer, function (samplesRequested) {}, 0);

    function callback (_fn) {
        var fn = _fn;
        return function (stream) {
            var audioContext = new Context();

            // Create an AudioNode from the stream.
            var mic = audioContext.createMediaStreamSource( stream );
            var processor = audioContext.createScriptProcessor( samplesPerCallback, 1, 1 );
            var refillBuffer = new Int16Array(190);

            processor.onaudioprocess = function (event) {
                var inputBuffer = event.inputBuffer.getChannelData(0);
                var samples = resampler.resampler(inputBuffer);

                for (var i = 0; i < samples.length; ++i) {
                    refillBuffer[i] = Math.ceil(samples[i] * 32768);
                }

                fn (refillBuffer);
            }

            mic.connect(processor);
            processor.connect(audioContext.destination);
        }
    }
    getUserMedia.call(navigator, {audio:true}, callback(onmicaudio), function(){} );
}

function flash_startCapture() {
    // quality = 2; nb = 15
    // quality = 4; nb = 20
    // quality = 6; nb = 28
    // quality = 8; nb = 38
    var codec = new Speex({ quality: 6 });
    var sink = new Audio();
    var buffer_size = 2304;

    sink["mozSetup"] && sink.mozSetup(1, 8000);

    function onRecordingComplete() {

    }

    function onCaptureError (err) {
        console.error(err);
    }

    function onSamplesDec (samples) {
        var wavData = atob(samples);
        var data = new Int16Array(new ArrayBuffer(wavData.length - 44))
        var encoded, decoded;

        if (data.length > buffer_size) {
            // too many samples
            return;
        }

        for (var i=44, j=-1; ++j < data.length; i+=2) {
            data[j] = Binary.toInt16(wavData.substr(i, 2));
        }

        encoded = codec.encode(data);
        buffer = _.extend(buffer, encoded);

        if (autoEcho && !!encoded){
            decoded = codec.decode(encoded);
            sink["mozWriteAudio"] && sink.mozWriteAudio(decoded);
            !sink["mozWriteAudio"] && Speex.play(decoded);
        }
    }

    navigator.device.captureAudio(onRecordingComplete, onCaptureError, {
      codec: "Speex",
      raw: true,
      onsamples: onSamplesDec
    });
}

window.autoEcho = autoEcho;
window.startCapture = startCapture;
window.getBuffer = getBuffer;
window.clearBuffer = clearBuffer;
window.playBuffer = playBuffer;

})();

