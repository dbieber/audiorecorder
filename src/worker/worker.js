// Main code for audiorecorder's web worker

// To debug from this web worker, console.log by sending the following message
// _this.postMessage({
//     'command': 'print',
//     'message': 'Your message here'
// });

var _this = this;
_this.onmessage = function(e) {
    switch(e.data.command) {
        case 'put':
        Encoder.put(e.data.buffer);
        break;

        case 'finalize':
        Encoder.finalize();
        break;

        case 'clear':
        Encoder.clear();
        break;
    }
};

var Encoder = {
    FRAME_SIZE: 320,

    samples: [],

    put: function(buffer) {
        Array.prototype.push.apply(Encoder.samples, buffer);
    },

    process: function() {
        var amountTotal = Encoder.samples.length;
        var amountToProcess = amountTotal - amountTotal % Encoder.FRAME_SIZE;
        var toProcess = Encoder.samples.splice(0, amountToProcess);

        if (toProcess.length > 0) {
            var encoded = Codec.encode(toProcess);
            _this.postMessage({
                'command': 'speex',
                'data': encoded
            });
        }
    },

    finalize: function() {
        while (Encoder.samples.length % Encoder.FRAME_SIZE !== 0) {
            Encoder.samples.push(0);  // pad with silence
        }
        Encoder.process();
        _this.postMessage({
            'command': 'finalized'
        });
    },

    clear: function() {
        Encoder.samples = [];
        _this.postMessage({
            'command': 'cleared'
        });
    }
};

setInterval(Encoder.process, 200);
