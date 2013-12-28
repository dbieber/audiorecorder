// Main code for audiorecorder's web worker
this.onmessage = function(e) {
  switch(e.data.command) {
    case 'put':
      Recorder.put(e.data.buffer);
      break;
    case 'get':
      var clip = Recorder.getClip();

      break;
    case 'clear':
      Recorder.clear();
      break;
  }
};

var Recorder = {
    clip: undefined,
    codec: undefined,

    init: function() {
        Recorder.codec = new Speex({quality: 6});
        Recorder.clip = Clip.create();
    },

    put: function(buffer) {

    },

    getClip: function() {

    },

    clear: function() {
        Recorder.clip = Clip.create();
    }
};

Recorder.init();
