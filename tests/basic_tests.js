function test_init() {
    var config = {worker_path: "../build/release/worker.js"};
    AudioRecorder.init(config);

    assert(AudioRecorder.middleware != undefined);
}

function test_20_seconds() {
    var config = {worker_path: "../build/release/worker.js"};
    AudioRecorder.init(config);


}
