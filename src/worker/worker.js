// Main code for audiorecorder's web worker

// To debug from this web worker, console.log by sending the following message
// self.postMessage({
//     'command': 'print',
//     'message': 'Your message here'
// });

var self = this;
self.onmessage = function(e) {
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
    samples: [],

    put: function(buffer) {
        Array.prototype.push.apply(Encoder.samples, buffer);
    },

    process: function() {
        // TODO(Bieber): Consider switching samples and remaining for perf.
        var amountTotal = Encoder.samples.length;
        var amountRemaining = amountTotal % 160;
        var toProcess = Encoder.samples.splice(amountRemaining);

        if (toProcess.length > 0) {
            var encoded = Codec.encode(toProcess);
            self.postMessage({
                'command': 'speex',
                'data': encoded
            });
        }
    },

    finalize: function() {
        while (Encoder.samples.length % 160 !== 0) {
            Encoder.samples.push(0);  // pad with silence
        }
        Encoder.process();
        self.postMessage({
            'command': 'done'
        });
    },

    clear: function() {
        Encoder.samples = [];
    }
};

setInterval(Encoder.process, 200);
