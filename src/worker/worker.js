// Main code for audiorecorder's web worker

// To debug from this web worker, console.log by sending the following message
// this.postMessage({
//     'command': 'print',
//     'message': 'Your message here'
// });

this.onmessage = function(e) {
    switch(e.data.command) {
        case 'put':
        Recorder.put(e.data.buffer);
        break;

        case 'get':
        var clip = Recorder.getClip();
        this.postMessage({
            'command': 'get',
            'clip': clip
        });
        break;

        case 'clear':
        Recorder.clear();
        break;
    }
};

var Recorder = {
    clip: Clip.create(),

    put: function(buffer) {
        Clip._addSamples(Recorder.clip, buffer);
    },

    getClip: function() {
        Clip.computeSpeex(Recorder.clip);
        return Recorder.clip;
    },

    clear: function() {
        Recorder.clip = Clip.create();
    }
};

