// Main code for audiorecorder's web worker
this.onmessage = function(e) {
  switch(e.data.command) {
    case 'put':
      put(e.data.buffer);
      break;
    case 'get':
      break;
    case 'clear':
      break;
  }
}
