// Main code for audiorecorder's web worker
this.onmessage = function(e) {
    switch(e.data.command) {
        case 'put':
        Recorder.put(e.data.buffer);
        this.postMessage({
            'command': 'print',
            'message': 'put done'
        });
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
        Clip.addSamples(Recorder.clip, buffer);
    },

    getClip: function() {
        return Recorder.clip;
    },

    clear: function() {
        Recorder.clip = Clip.create();
    }
};

