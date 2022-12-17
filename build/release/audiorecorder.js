//JavaScript Audio Resampler (c) 2011 - Grant Galitz
function Resampler(fromSampleRate, toSampleRate, channels, outputBufferSize, noReturn) {
	this.fromSampleRate = fromSampleRate;
	this.toSampleRate = toSampleRate;
	this.channels = channels | 0;
	this.outputBufferSize = outputBufferSize;
	this.noReturn = !!noReturn;
	this.initialize();
}
Resampler.prototype.initialize = function () {
	//Perform some checks:
	if (this.fromSampleRate > 0 && this.toSampleRate > 0 && this.channels > 0) {
		if (this.fromSampleRate == this.toSampleRate) {
			//Setup a resampler bypass:
			this.resampler = this.bypassResampler;		//Resampler just returns what was passed through.
			this.ratioWeight = 1;
		}
		else {
			//Setup the interpolation resampler:
			this.compileInterpolationFunction();
			this.resampler = this.interpolate;			//Resampler is a custom quality interpolation algorithm.
			this.ratioWeight = this.fromSampleRate / this.toSampleRate;
			this.tailExists = false;
			this.lastWeight = 0;
			this.initializeBuffers();
		}
	}
	else {
		throw(new Error("Invalid settings specified for the resampler."));
	}
}
Resampler.prototype.compileInterpolationFunction = function () {
	var toCompile = "var bufferLength = Math.min(buffer.length, this.outputBufferSize);\
	if ((bufferLength % " + this.channels + ") == 0) {\
		if (bufferLength > 0) {\
			var ratioWeight = this.ratioWeight;\
			var weight = 0;";
	for (var channel = 0; channel < this.channels; ++channel) {
		toCompile += "var output" + channel + " = 0;"
	}
	toCompile += "var actualPosition = 0;\
			var amountToNext = 0;\
			var alreadyProcessedTail = !this.tailExists;\
			this.tailExists = false;\
			var outputBuffer = this.outputBuffer;\
			var outputOffset = 0;\
			var currentPosition = 0;\
			do {\
				if (alreadyProcessedTail) {\
					weight = ratioWeight;";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "output" + channel + " = 0;"
	}
	toCompile += "}\
				else {\
					weight = this.lastWeight;";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "output" + channel + " = this.lastOutput[" + channel + "];"
	}
	toCompile += "alreadyProcessedTail = true;\
				}\
				while (weight > 0 && actualPosition < bufferLength) {\
					amountToNext = 1 + actualPosition - currentPosition;\
					if (weight >= amountToNext) {";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "output" + channel + " += buffer[actualPosition++] * amountToNext;"
	}
	toCompile += "currentPosition = actualPosition;\
						weight -= amountToNext;\
					}\
					else {";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "output" + channel + " += buffer[actualPosition" + ((channel > 0) ? (" + " + channel) : "") + "] * weight;"
	}
	toCompile += "currentPosition += weight;\
						weight = 0;\
						break;\
					}\
				}\
				if (weight == 0) {";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "outputBuffer[outputOffset++] = output" + channel + " / ratioWeight;"
	}
	toCompile += "}\
				else {\
					this.lastWeight = weight;";
	for (channel = 0; channel < this.channels; ++channel) {
		toCompile += "this.lastOutput[" + channel + "] = output" + channel + ";"
	}
	toCompile += "this.tailExists = true;\
					break;\
				}\
			} while (actualPosition < bufferLength);\
			return this.bufferSlice(outputOffset);\
		}\
		else {\
			return (this.noReturn) ? 0 : [];\
		}\
	}\
	else {\
		throw(new Error(\"Buffer was of incorrect sample length.\"));\
	}";
	this.interpolate = Function("buffer", toCompile);
}
Resampler.prototype.bypassResampler = function (buffer) {
	if (this.noReturn) {
		//Set the buffer passed as our own, as we don't need to resample it:
		this.outputBuffer = buffer;
		return buffer.length;
	}
	else {
		//Just return the buffer passsed:
		return buffer;
	}
}
Resampler.prototype.bufferSlice = function (sliceAmount) {
	if (this.noReturn) {
		//If we're going to access the properties directly from this object:
		return sliceAmount;
	}
	else {
		//Typed array and normal array buffer section referencing:
		try {
			return this.outputBuffer.subarray(0, sliceAmount);
		}
		catch (error) {
			try {
				//Regular array pass:
				this.outputBuffer.length = sliceAmount;
				return this.outputBuffer;
			}
			catch (error) {
				//Nightly Firefox 4 used to have the subarray function named as slice:
				return this.outputBuffer.slice(0, sliceAmount);
			}
		}
	}
}
Resampler.prototype.initializeBuffers = function (generateTailCache) {
	//Initialize the internal buffer:
	try {
		this.outputBuffer = new Float32Array(this.outputBufferSize);
		this.lastOutput = new Float32Array(this.channels);
	}
	catch (error) {
		this.outputBuffer = [];
		this.lastOutput = [];
	}
}/*Initialize here first:
	Example:
		Stereo audio with a sample rate of 70 khz, a minimum buffer of 15000 samples total, a maximum buffer of 25000 samples total and a neutral amplitude value of -1.
			var parentObj = this;
			this.audioHandle = new XAudioServer(2, 70000, 15000, 25000, function (sampleCount) {
				return parentObj.audioUnderRun(sampleCount);
			}, -1);

	The callback is passed the number of samples requested, while it can return any number of samples it wants back.
*/
function XAudioServer(channels, sampleRate, minBufferSize, maxBufferSize, underRunCallback, defaultValue) {
	this.audioChannels = (channels == 2) ? 2 : 1;
	webAudioMono = (this.audioChannels == 1);
	XAudioJSSampleRate = (sampleRate > 0 && sampleRate <= 0xFFFFFF) ? sampleRate : 44100;
	webAudioMinBufferSize = (minBufferSize >= (samplesPerCallback << 1) && minBufferSize < maxBufferSize) ? (minBufferSize & ((webAudioMono) ? 0xFFFFFFFF : 0xFFFFFFFE)) : (samplesPerCallback << 1);
	webAudioMaxBufferSize = (Math.floor(maxBufferSize) > webAudioMinBufferSize + this.audioChannels) ? (maxBufferSize & ((webAudioMono) ? 0xFFFFFFFF : 0xFFFFFFFE)) : (minBufferSize << 1);
	this.underRunCallback = (typeof underRunCallback == "function") ? underRunCallback : function () {};
	defaultNeutralValue = (defaultValue >= -1 && defaultValue <= 1 && defaultValue != 0) ? defaultValue : 0;
	this.audioType = -1;
	this.mozAudioTail = [];
	this.audioHandleMoz = null;
	this.audioHandleFlash = null;
	this.flashInitialized = false;
	this.mozAudioFound = false;
	this.initializeAudio();
}
XAudioServer.prototype.MOZWriteAudio = function (buffer) {
	//mozAudio:
	this.MOZWriteAudioNoCallback(buffer);
	this.MOZExecuteCallback();
}
XAudioServer.prototype.MOZWriteAudioNoCallback = function (buffer) {
	//mozAudio:
	this.writeMozAudio(buffer);
}
XAudioServer.prototype.callbackBasedWriteAudio = function (buffer) {
	//Callback-centered audio APIs:
	this.callbackBasedWriteAudioNoCallback(buffer);
	this.callbackBasedExecuteCallback();
}
XAudioServer.prototype.callbackBasedWriteAudioNoCallback = function (buffer) {
	//Callback-centered audio APIs:
	if (!buffer) {
		return;
	}

	var length = buffer.length;
	for (var bufferCounter = 0; bufferCounter < length && audioBufferSize < webAudioMaxBufferSize;) {
		audioContextSampleBuffer[audioBufferSize++] = buffer[bufferCounter++];
	}
}
/*Pass your samples into here!
Pack your samples as a one-dimenional array
With the channel samplea packed uniformly.
examples:
    mono - [left, left, left, left]
    stereo - [left, right, left, right, left, right, left, right]
*/
XAudioServer.prototype.writeAudio = function (buffer) {
	if (this.audioType == 0) {
		this.MOZWriteAudio(buffer);
	}
	else if (this.audioType == 1) {
		this.callbackBasedWriteAudio(buffer);
	}
	else if (this.audioType == 2) {
		if (this.checkFlashInit() || launchedContext) {
			this.callbackBasedWriteAudio(buffer);
		}
		else if (this.mozAudioFound) {
			this.MOZWriteAudio(buffer);
		}
	}
}
/*Pass your samples into here if you don't want automatic callback calling:
Pack your samples as a one-dimenional array
With the channel samplea packed uniformly.
examples:
    mono - [left, left, left, left]
    stereo - [left, right, left, right, left, right, left, right]
Useful in preventing infinite recursion issues with calling writeAudio inside your callback.
*/
XAudioServer.prototype.writeAudioNoCallback = function (buffer) {
	if (this.audioType == 0) {
		this.MOZWriteAudioNoCallback(buffer);
	}
	else if (this.audioType == 1) {
		this.callbackBasedWriteAudioNoCallback(buffer);
	}
	else if (this.audioType == 2) {
		if (this.checkFlashInit() || launchedContext) {
			this.callbackBasedWriteAudioNoCallback(buffer);
		}
		else if (this.mozAudioFound) {
			this.MOZWriteAudioNoCallback(buffer);
		}
	}
}
//Developer can use this to see how many samples to write (example: minimum buffer allotment minus remaining samples left returned from this function to make sure maximum buffering is done...)
//If -1 is returned, then that means metric could not be done.
XAudioServer.prototype.remainingBuffer = function () {
	if (this.audioType == 0) {
		//mozAudio:
		return this.samplesAlreadyWritten - this.audioHandleMoz.mozCurrentSampleOffset();
	}
	else if (this.audioType == 1) {
		//WebKit Audio:
		return (((resampledSamplesLeft() * resampleControl.ratioWeight) >> (this.audioChannels - 1)) << (this.audioChannels - 1)) + audioBufferSize;
	}
	else if (this.audioType == 2) {
		if (this.checkFlashInit() || launchedContext) {
			//Webkit Audio / Flash Plugin Audio:
			return (((resampledSamplesLeft() * resampleControl.ratioWeight) >> (this.audioChannels - 1)) << (this.audioChannels - 1)) + audioBufferSize;
		}
		else if (this.mozAudioFound) {
			//mozAudio:
			return this.samplesAlreadyWritten - this.audioHandleMoz.mozCurrentSampleOffset();
		}
	}
	//Default return:
	return 0;
}
XAudioServer.prototype.MOZExecuteCallback = function () {
	//mozAudio:
	var samplesRequested = webAudioMinBufferSize - this.remainingBuffer();
	if (samplesRequested > 0) {
		this.writeMozAudio(this.underRunCallback(samplesRequested));
	}
}
XAudioServer.prototype.callbackBasedExecuteCallback = function () {
	//WebKit /Flash Audio:
	var samplesRequested = webAudioMinBufferSize - this.remainingBuffer();
	if (samplesRequested > 0) {
		this.callbackBasedWriteAudioNoCallback(this.underRunCallback(samplesRequested));
	}
}
//If you just want your callback called for any possible refill (Execution of callback is still conditional):
XAudioServer.prototype.executeCallback = function () {
	if (this.audioType == 0) {
		this.MOZExecuteCallback();
	}
	else if (this.audioType == 1) {
		this.callbackBasedExecuteCallback();
	}
	else if (this.audioType == 2) {
		if (this.checkFlashInit() || launchedContext) {
			this.callbackBasedExecuteCallback();
		}
		else if (this.mozAudioFound) {
			this.MOZExecuteCallback();
		}
	}
}
//DO NOT CALL THIS, the lib calls this internally!
XAudioServer.prototype.initializeAudio = function () {
	try {
		this.preInitializeMozAudio();
		if (navigator.platform == "Linux i686") {
			//Block out mozaudio usage for Linux Firefox due to moz bugs:
			throw(new Error(""));
		}
		this.initializeMozAudio();
	}
	catch (error) {
		try {
			this.initializeWebAudio();
		}
		catch (error) {
			try {
				this.initializeFlashAudio();
			}
			catch (error) {
				throw(new Error("Browser does not support real time audio output."));
			}
		}
	}
}
XAudioServer.prototype.preInitializeMozAudio = function () {
	//mozAudio - Synchronous Audio API
	this.audioHandleMoz = new Audio();
	this.audioHandleMoz.mozSetup(this.audioChannels, XAudioJSSampleRate);
	this.samplesAlreadyWritten = 0;
	var emptySampleFrame = (this.audioChannels == 2) ? [0, 0] : [0];
	var prebufferAmount = 0;
	if (navigator.platform != "MacIntel" && navigator.platform != "MacPPC") {	//Mac OS X doesn't experience this moz-bug!
		while (this.audioHandleMoz.mozCurrentSampleOffset() == 0) {
			//Mozilla Audio Bugginess Workaround (Firefox freaks out if we don't give it a prebuffer under certain OSes):
			prebufferAmount += this.audioHandleMoz.mozWriteAudio(emptySampleFrame);
		}
		var samplesToDoubleBuffer = prebufferAmount / this.audioChannels;
		//Double the prebuffering for windows:
		for (var index = 0; index < samplesToDoubleBuffer; index++) {
			this.samplesAlreadyWritten += this.audioHandleMoz.mozWriteAudio(emptySampleFrame);
		}
	}
	this.samplesAlreadyWritten += prebufferAmount;
	webAudioMinBufferSize += this.samplesAlreadyWritten;
	this.mozAudioFound = true;
}
XAudioServer.prototype.initializeMozAudio = function () {
	//Fill in our own buffering up to the minimum specified:
	this.writeMozAudio(getFloat32(webAudioMinBufferSize));
	this.audioType = 0;
}
XAudioServer.prototype.initializeWebAudio = function () {
	if (launchedContext) {
		resetCallbackAPIAudioBuffer(webAudioActualSampleRate, samplesPerCallback);
		this.audioType = 1;
	}
	else {
		throw(new Error(""));
	}
}
XAudioServer.prototype.initializeFlashAudio = function () {
	var existingFlashload = document.getElementById("XAudioJS");
	if (existingFlashload == null) {
		var thisObj = this;
		var mainContainerNode = document.createElement("div");
		mainContainerNode.setAttribute("style", "position: fixed; bottom: 0px; right: 0px; margin: 0px; padding: 0px; border: none; width: 8px; height: 8px; overflow: hidden; z-index: -1000; ");
		var containerNode = document.createElement("div");
		containerNode.setAttribute("style", "position: static; border: none; width: 0px; height: 0px; visibility: hidden; margin: 8px; padding: 0px;");
		containerNode.setAttribute("id", "XAudioJS");
		mainContainerNode.appendChild(containerNode);
		document.getElementsByTagName("body")[0].appendChild(mainContainerNode);
		swfobject.embedSWF(
			"XAudioJS.swf",
			"XAudioJS",
			"8",
			"8",
			"9.0.0",
			"",
			{},
			{"allowscriptaccess":"always"},
			{"style":"position: static; visibility: hidden; margin: 8px; padding: 0px; border: none"},
			function (event) {
				if (event.success) {
					thisObj.audioHandleFlash = event.ref;
				}
				else {
					thisObj.audioType = 1;
				}
			}
		);
	}
	else {
		this.audioHandleFlash = existingFlashload;
	}
	this.audioType = 2;
}
//Moz Audio Buffer Writing Handler:
XAudioServer.prototype.writeMozAudio = function (buffer) {
	if (!buffer) {
		return;
	}

	var length = this.mozAudioTail.length;
	if (length > 0) {
		var samplesAccepted = this.audioHandleMoz.mozWriteAudio(this.mozAudioTail);
		this.samplesAlreadyWritten += samplesAccepted;
		this.mozAudioTail.splice(0, samplesAccepted);
	}

	length = Math.min(buffer.length, webAudioMaxBufferSize - this.samplesAlreadyWritten + this.audioHandleMoz.mozCurrentSampleOffset());
	var samplesAccepted = this.audioHandleMoz.mozWriteAudio(buffer);
	this.samplesAlreadyWritten += samplesAccepted;
	for (var index = 0; length > samplesAccepted; --length) {
		//Moz Audio wants us saving the tail:
		this.mozAudioTail.push(buffer[index++]);
	}
}
//Checks to see if the NPAPI Adobe Flash bridge is ready yet:
XAudioServer.prototype.checkFlashInit = function () {
	if (!this.flashInitialized && this.audioHandleFlash && this.audioHandleFlash.initialize) {
		this.flashInitialized = true;
		this.audioHandleFlash.initialize(this.audioChannels, defaultNeutralValue);
		resetCallbackAPIAudioBuffer(44100, samplesPerCallback);
	}
	return this.flashInitialized;
}
/////////END LIB
function getFloat32(size) {
	try {
		var newBuffer = new Float32Array(size);
	}
	catch (error) {
		var newBuffer = new Array(size);
	}
	for (var audioSampleIndice = 0; audioSampleIndice < size; ++audioSampleIndice) {
		//Create a gradual neutral position shift here to make sure we don't cause annoying clicking noises
		//when the developer set neutral position is not 0.
		newBuffer[audioSampleIndice] = defaultNeutralValue * (audioSampleIndice / size);
	}
	return newBuffer;
}
function getFloat32Flat(size) {
	try {
		var newBuffer = new Float32Array(size);
	}
	catch (error) {
		var newBuffer = new Array(size);
		var audioSampleIndice = 0;
		do {
			newBuffer[audioSampleIndice] = 0;
		} while (++audioSampleIndice < size);
	}
	return newBuffer;
}
//Flash NPAPI Event Handler:
var samplesPerCallback = 2048;			//Has to be between 2048 and 4096 (If over, then samples are ignored, if under then silence is added).
var outputConvert = null;
function audioOutputFlashEvent() {		//The callback that flash calls...
	resampleRefill();
	return outputConvert();
}
function generateFlashStereoString() {	//Convert the arrays to one long string for speed.
	var copyBinaryStringLeft = "";
	var copyBinaryStringRight = "";
	for (var index = 0; index < samplesPerCallback && resampleBufferStart != resampleBufferEnd; ++index) {
		//Sanitize the buffer:
		copyBinaryStringLeft += String.fromCharCode(((Math.min(Math.max(resampled[resampleBufferStart++] + 1, 0), 2) * 0x3FFF) | 0) + 0x3000);
		copyBinaryStringRight += String.fromCharCode(((Math.min(Math.max(resampled[resampleBufferStart++] + 1, 0), 2) * 0x3FFF) | 0) + 0x3000);
		if (resampleBufferStart == resampleBufferSize) {
			resampleBufferStart = 0;
		}
	}
	return copyBinaryStringLeft + copyBinaryStringRight;
}
function generateFlashMonoString() {	//Convert the array to one long string for speed.
	var copyBinaryString = "";
	for (var index = 0; index < samplesPerCallback && resampleBufferStart != resampleBufferEnd; ++index) {
		//Sanitize the buffer:
		copyBinaryString += String.fromCharCode(((Math.min(Math.max(resampled[resampleBufferStart++] + 1, 0), 2) * 0x3FFF) | 0) + 0x3000);
		if (resampleBufferStart == resampleBufferSize) {
			resampleBufferStart = 0;
		}
	}
	return copyBinaryString;
}
//Audio API Event Handler:
var audioContextHandle = null;
var audioNode = null;
var audioSource = null;
var launchedContext = false;
var audioContextSampleBuffer = [];
var resampled = [];
var webAudioMinBufferSize = 15000;
var webAudioMaxBufferSize = 25000;
var webAudioActualSampleRate = 44100;
var XAudioJSSampleRate = 0;
var webAudioMono = false;
var defaultNeutralValue = 0;
var resampleControl = null;
var audioBufferSize = 0;
var resampleBufferStart = 0;
var resampleBufferEnd = 0;
var resampleBufferSize = 2;
function audioOutputEvent(event) {		//Web Audio API callback...
	var index = 0;
	var buffer1 = event.outputBuffer.getChannelData(0);
	var buffer2 = event.outputBuffer.getChannelData(1);
	resampleRefill();
	if (!webAudioMono) {
		//STEREO:
		while (index < samplesPerCallback && resampleBufferStart != resampleBufferEnd) {
			buffer1[index] = resampled[resampleBufferStart++];
			buffer2[index++] = resampled[resampleBufferStart++];
			if (resampleBufferStart == resampleBufferSize) {
				resampleBufferStart = 0;
			}
		}
	}
	else {
		//MONO:
		while (index < samplesPerCallback && resampleBufferStart != resampleBufferEnd) {
			buffer2[index] = buffer1[index] = resampled[resampleBufferStart++];
			++index;
			if (resampleBufferStart == resampleBufferSize) {
				resampleBufferStart = 0;
			}
		}
	}
	//Pad with silence if we're underrunning:
	while (index < samplesPerCallback) {
		buffer2[index] = buffer1[index] = defaultNeutralValue;
		++index;
	}
}
function resampleRefill() {
	if (audioBufferSize > 0) {
		//Resample a chunk of audio:
		var resampleLength = resampleControl.resampler(getBufferSamples());
		var resampledResult = resampleControl.outputBuffer;
		for (var index2 = 0; index2 < resampleLength; ++index2) {
			resampled[resampleBufferEnd++] = resampledResult[index2];
			if (resampleBufferEnd == resampleBufferSize) {
				resampleBufferEnd = 0;
			}
			if (resampleBufferStart == resampleBufferEnd) {
				++resampleBufferStart;
				if (resampleBufferStart == resampleBufferSize) {
					resampleBufferStart = 0;
				}
			}
		}
		audioBufferSize = 0;
	}
}
function resampledSamplesLeft() {
	return ((resampleBufferStart <= resampleBufferEnd) ? 0 : resampleBufferSize) + resampleBufferEnd - resampleBufferStart;
}
function getBufferSamples() {
	//Typed array and normal array buffer section referencing:
	try {
		return audioContextSampleBuffer.subarray(0, audioBufferSize);
	}
	catch (error) {
		try {
			//Regular array pass:
			audioContextSampleBuffer.length = audioBufferSize;
			return audioContextSampleBuffer;
		}
		catch (error) {
			//Nightly Firefox 4 used to have the subarray function named as slice:
			return audioContextSampleBuffer.slice(0, audioBufferSize);
		}
	}
}
//Initialize WebKit Audio /Flash Audio Buffer:
function resetCallbackAPIAudioBuffer(APISampleRate, bufferAlloc) {
	audioContextSampleBuffer = getFloat32(webAudioMaxBufferSize);
	audioBufferSize = webAudioMaxBufferSize;
	resampleBufferStart = 0;
	resampleBufferEnd = 0;
	resampleBufferSize = Math.max(webAudioMaxBufferSize * Math.ceil(XAudioJSSampleRate / APISampleRate), samplesPerCallback) << 1;
	if (webAudioMono) {
		//MONO Handling:
		resampled = getFloat32Flat(resampleBufferSize);
		resampleControl = new Resampler(XAudioJSSampleRate, APISampleRate, 1, resampleBufferSize, true);
		outputConvert = generateFlashMonoString;
	}
	else {
		//STEREO Handling:
		resampleBufferSize  <<= 1;
		resampled = getFloat32Flat(resampleBufferSize);
		resampleControl = new Resampler(XAudioJSSampleRate, APISampleRate, 2, resampleBufferSize, true);
		outputConvert = generateFlashStereoString;
	}
}
//Initialize WebKit Audio:
(function () {
	if (!launchedContext) {
		try {
			audioContextHandle = new AudioContext();							//Create a system audio context.
		}
		catch (error) {
			try {
				audioContextHandle = new webkitAudioContext();								//Create a system audio context.
			}
			catch (error) {
				return;
			}
		}
		try {
			audioSource = audioContextHandle.createBufferSource();						//We need to create a false input to get the chain started.
			audioSource.loop = false;	//Keep this alive forever (Event handler will know when to ouput.)
			XAudioJSSampleRate = webAudioActualSampleRate = audioContextHandle.sampleRate;
			audioSource.buffer = audioContextHandle.createBuffer(1, 1, webAudioActualSampleRate);	//Create a zero'd input buffer for the input to be valid.
			audioNode = audioContextHandle.createJavaScriptNode(samplesPerCallback, 1, 2);			//Create 2 outputs and ignore the input buffer (Just copy buffer 1 over if mono)
			audioNode.onaudioprocess = audioOutputEvent;								//Connect the audio processing event to a handling function so we can manipulate output
			audioSource.connect(audioNode);												//Send and chain the input to the audio manipulation.
			audioNode.connect(audioContextHandle.destination);							//Send and chain the output of the audio manipulation to the system audio output.
			audioSource.noteOn(0);														//Start the loop!
		}
		catch (error) {
			return;
		}
		launchedContext = true;
	}
})();
(function(b,c){var j=String.fromCharCode,h=true,d=false;function e(k,l){return l?j(k&255)+e(k>>8,l-1):""}function g(k,l){return l?g(k>>8,l-1)+j(255-k&255):""}function i(k,l,m){return m?g(k,l):e(k,l)}function a(r,q){var k=r.length,p=k-1,s=0,o=c.pow,m;if(q){for(m=0;m<k;m++){s+=(255-r.charCodeAt(m))*o(256,p-m)}}else{for(m=0;m<k;m++){s+=r.charCodeAt(m)*o(256,m)}}return s}function f(n,t,o,w){var s=c.pow,r=c.floor,l=f.convertFromBinary,u=f.convertToBinary,k=n/8,q=s(2,n),v=q/2,x=v-1,p=1/v,m=1/x;return w?o?t?function(y,z){y=r(y<0?y*v+q:y*x);return u(y,k,z)}:function(y,z){return u(r(y*x),k,z)}:t?function(y,z){return u(y<0?y+q:y,k,z)}:function(y,z){return u(y,k,z)}:o?t?function(A,z){var y=l(A,z);return y>x?(y-q)*p:y*m}:function(z,y){return l(z,y)*m}:t?function(A,z){var y=l(A,z);return y>x?y-q:y}:function(z,y){return l(z,y)}}f.convertToBinary=i;f.convertFromBinary=a;f.fromQ32=f(32,h,h,h);f.toQ32=f(32,h,h,d);f.fromQ24=f(24,h,h,h);f.toQ24=f(24,h,h,d);f.fromQ16=f(16,h,h,h);f.toQ16=f(16,h,h,d);f.fromQ8=f(8,h,h,h);f.toQ8=f(8,h,h,d);f.fromInt32=f(32,h,d,h);f.toInt32=f(32,h,d,d);f.fromInt16=f(16,h,d,h);f.toInt16=f(16,h,d,d);f.fromInt8=f(8,h,d,h);f.toInt8=f(8,h,d,d);f.fromUint32=f(32,d,d,h);f.toUint32=f(32,d,d,d);f.fromUint16=f(16,d,d,h);f.toUint16=f(16,d,d,d);f.fromUint8=f(8,d,d,h);f.toUint8=f(8,d,d,d);b.Binary=f}(this,Math));(function(e,f){function g(h){this.data=h}var d=g.prototype={read:function(i){var h=this,j=h.data.substr(0,i);h.skip(i);return j},skip:function(i){var h=this,j=h.data=h.data.substr(i);h.pointer+=i;return j.length},readBuffer:function(j,n,p){var k=this,o="read"+p+n,q=n/8,h=j.length,m=0;while(k.data&&m<h){j[m++]=k[o]()}return m}},c,b;function a(k,i,j){var h=i/8;d["read"+k+i]=function(l){return j(this.read(h),l)}}for(c in f){b=/to([a-z]+)([0-9]+)/i.exec(c);b&&a(b[1],b[2],f[c])}e.Stream=g;g.newType=a}(this,this.Binary));this.PCMData=(function(a,b){function c(d){return(typeof d==="string"?c.decode:c.encode)(d)}c.decodeFrame=function(g,f,d){if(f===8){var e=new (window.Uint8Array||Array)(d.length);(new b(g)).readBuffer(e,8,"Uint");for(f=0;f<d.length;f++){d[f]=(e[f]-127.5)*127.5}}else{(new b(g)).readBuffer(d,f,"Q")}return d};c.encodeFrame=function(j,g){var e=a[(g===8?"fromUint":"fromQ")+g],d=j.length,h="",f;if(g===8){for(f=0;f<d;f++){h+=e(j[f]*127.5+127.5)}}else{for(f=0;f<d;f++){h+=e(j[f])}}return h};c.decode=function(D,C){var g=new b(D),n=g.read(4),v=g.readUint32();g=new b(g.read(v));var k=g.read(4),m=g.read(4),t=g.readUint32(),d=new b(g.read(t)),f=d.readUint16(),y=d.readUint16(),B=d.readUint32(),h=d.readUint32(),A=d.readUint16(),z=A/y,l=d.readUint16(),e,p,r,w,u,j,x,s={},o={channelCount:y,bytesPerSample:A/y,sampleRate:h/A,chunks:s,data:u};function q(){e=g.read(4);p=g.readUint32();w=g.read(p);j=s[e]=s[e]||[];if(e==="data"){r=~~(p/z);u=o.data=new (typeof Float32Array!=="undefined"?Float32Array:Array)(r);c.decodeFrame(w,z*8,u)}else{j.push(w)}C&&(g.data?setTimeout(q,1):C(o))}if(C){g.data?q():C(o)}else{while(g.data){q()}}return o};c.encode=function(x,v){var r=a.fromUint32,y=a.fromUint16,o=x.data,d=x.sampleRate,h=x.channelCount||1,t=x.bytesPerSample||1,j=t*8,f=h*t,u=d*f,g=o.length,e=g*t,m=Math.pow(2,j-1)-1,l=[],k="",w,s,p,q;l.push("fmt "+r(16)+y(1)+y(h)+r(d)+r(u)+y(f)+y(j));l.push("data"+r(e)+c.encodeFrame(o,j));q=x.chunks;if(q){for(s in q){if(q.hasOwnProperty(s)){w=q[s];for(p=0;p<w.length;p++){k=w[p];l.push(s+r(k.length)+k)}}}}l=l.join("");l="RIFF"+r(l.length)+"WAVE"+l;v&&setTimeout(function(){v(l)},1);return l};return c}(this.Binary,this.Stream));DataView.prototype.getInt64 = function (byteOffset, litteEndian) {
    return (this.getInt32(byteOffset, litteEndian) << 32) |
        this.getInt32(byteOffset + 4, litteEndian);
}

// TODO - fix me
DataView.prototype.setInt64 = function (byteOffset, value, litteEndian) {
    return (this.setInt32(byteOffset, value >> 32, litteEndian));
}

DataView.prototype.getUint64 = function (byteOffset, litteEndian) {
    return (this.getUint32(byteOffset, litteEndian) << 32) |
        this.getUint32(byteOffset + 4, litteEndian);
}

// TODO - fix me
DataView.prototype.setUint64 = function (byteOffset, value, litteEndian) {
    return (this.setUint32(byteOffset, value >> 32, litteEndian));
}

Array.prototype.chunk = function(chunkSize) {
    var array=this;
    return [].concat.apply([],
        array.map(function(elem,i) {
            return i%chunkSize ? [] : [array.slice(i,i+chunkSize)];
        })
    );
}

function BitString(expr, options) {
    this.expr = expr;
    this.options = options || {};
    this.types = [];
    this.cache = {};
    this.byteLength = 0;
    (this.options.compile || true) && this.compile();
}

BitString.UNPACK_OP = 0;
BitString.PACK_OP = 1;
BitString.SPECIFIER_SEPARATOR = "-";
BitString.ATTR_SEPARATOR = ":";
BitString.SPECIFIER_DELIMITER = "/";
BitString.SEGMENT_DELIMITER = ",";

BitString.util = {
    dvdup: function (buffer, newSize) {
        var oldbuf = new Uint8Array(buffer);
        var newbuf = new Uint8Array(new ArrayBuffer(newSize));
        for(var i = 0, l = oldbuf.length; i<l; ++i) {
            newbuf[i] = oldbuf[i];
        }

        return new DataView(newbuf.buffer);
    }
  , str2dv: function (str) {
        var buf = new ArrayBuffer(str.length); // 2 bytes for each char
        var bufView = new Uint8Array(buf);
        for (var i=0, strLen=str.length; i<strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }

        return new DataView(buf);
    }
}

BitString.prototype.compile = function () {
    var segs = this.expr.split(BitString.SEGMENT_DELIMITER);
    for (var i = 0, len = segs.length; i < len; ++i) {
        var tks, attrs, specs, specs_attrs, t;
        tks = segs[i].split(BitString.SPECIFIER_DELIMITER);
        specs = tks[1] || "";
        attrs = tks[0].split(BitString.ATTR_SEPARATOR);
        specs_attrs = specs.split(BitString.SPECIFIER_SEPARATOR) || [];

        t = {
           spec: attrs[1]
         , size: parseInt(attrs[1] != "_" ? attrs[1] : 0)
         , value: attrs[0]
         , unit: this.unit(specs)
         , ref: false
         , sign: "Uint"
        };

        if (specs_attrs.indexOf("signed") >= 0 ||
            specs_attrs.indexOf("int") >= 0) {
            t.sign = "Int";
        }

        if (specs_attrs.indexOf("int") >= 0) {
            t.size = 4;
            t.unit = 0;
        }

        if (isNaN(t.size) && this.cache[t.spec] == 0) {
            t.ref = true;
        }

        this.byteLength += (t.size || 0);

        this.types.push(t);
        this.cache[t.value] = 0;
    }
}

BitString.prototype.unit = function (specifiers) {
    var att = specifiers.split(BitString.ATTR_SEPARATOR)
      , has_attr = att.length == 2;

    s = has_attr ? parseInt(att[1]) : att[0];
    return !has_attr ? (s == "char" ? 1 :
            (s == "int" ? 4 :
            (s == "double" ? 8 :
                0))) : s;
}
BitString.prototype.__op = function (str, mode) {
    var view, o, util = BitString.util;

    if (mode == BitString.UNPACK_OP) {
        view = util.str2dv(str);
        o = {};
    } else {
        view = new DataView(new ArrayBuffer(this.byteLength));
        o = str;
    }

    var ofs = 0
      , t = this.types
      , le = !this.options.bigEndian;

    for (var i=0, len=t.length; i<len; ++i) {
        var l = t[i].size
          , v = t[i].value
          , u = t[i].unit
          , ref = t[i].ref
          , s = t[i].sign
          , j = 0, iter = u*l || 1, inc = (u ? u : l)
          , val = o[v], vop = null;

        if (ref) {
            t[i].size = o[t[i].spec];
            l = t[i].size;
            iter = u*l;
            if (mode)
                view = util.dvdup(view.buffer,
                    view.buffer.byteLength + iter);
        }

        if (l) {
            vop = (!mode ? "get" : "set") + s + inc*8;
        }

        do {
            if (!mode) {
                val = (vop ? view[vop](ofs, le) : str.substr(ofs));
                if (u)
                    (o[v] = o[v] || []).push(val);
                else
                    (o[v] = val);
            } else if (l) {
                view[vop](ofs, !u ? o[v] : o[v][j], le);
            }

            ofs += inc;
            --iter;
            ++j;
        } while (iter);

        this.cache[v] = val;
    }
    return (!mode ? o :
        String.fromCharCode.apply(null,
            new Uint8Array(view.buffer)));
}

BitString.prototype.unpack = function (str) {
    return this.__op(str, BitString.UNPACK_OP);
}

BitString.prototype.pack = function (values) {
    return this.__op(values, BitString.PACK_OP);
}
var Module;Module||(Module=eval("(function() { try { return Module || {} } catch(e) { return {} } })()"));var moduleOverrides={},key;for(key in Module)Module.hasOwnProperty(key)&&(moduleOverrides[key]=Module[key]);var ENVIRONMENT_IS_NODE="object"===typeof process&&"function"===typeof require,ENVIRONMENT_IS_WEB="object"===typeof window,ENVIRONMENT_IS_WORKER="function"===typeof importScripts,ENVIRONMENT_IS_SHELL=!ENVIRONMENT_IS_WEB&&!ENVIRONMENT_IS_NODE&&!ENVIRONMENT_IS_WORKER;
if(ENVIRONMENT_IS_NODE){Module.print=function(a){process.stdout.write(a+"\n")};Module.printErr=function(a){process.stderr.write(a+"\n")};var nodeFS=require("fs"),nodePath=require("path");Module.read=function(a,c){a=nodePath.normalize(a);var d=nodeFS.readFileSync(a);d||a==nodePath.resolve(a)||(a=path.join(__dirname,"..","src",a),d=nodeFS.readFileSync(a));d&&!c&&(d=d.toString());return d};Module.readBinary=function(a){return Module.read(a,!0)};Module.load=function(a){globalEval(read(a))};Module.arguments=
process.argv.slice(2);module.exports=Module}else if(ENVIRONMENT_IS_SHELL)Module.print=print,"undefined"!=typeof printErr&&(Module.printErr=printErr),Module.read="undefined"!=typeof read?read:function(){throw"no read() available (jsc?)";},Module.readBinary=function(a){return read(a,"binary")},"undefined"!=typeof scriptArgs?Module.arguments=scriptArgs:"undefined"!=typeof arguments&&(Module.arguments=arguments),this.Module=Module,eval("if (typeof gc === 'function' && gc.toString().indexOf('[native code]') > 0) var gc = undefined");
else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){Module.read=function(a){var c=new XMLHttpRequest;c.open("GET",a,!1);c.send(null);return c.responseText};"undefined"!=typeof arguments&&(Module.arguments=arguments);if("undefined"!==typeof console)Module.print=function(a){console.log(a)},Module.printErr=function(a){console.log(a)};else{var TRY_USE_DUMP=!1;Module.print=TRY_USE_DUMP&&"undefined"!==typeof dump?function(a){dump(a)}:function(a){}}ENVIRONMENT_IS_WEB?this.Module=Module:Module.load=importScripts}else throw"Unknown runtime environment. Where are we?";
function globalEval(a){eval.call(null,a)}"undefined"==!Module.load&&Module.read&&(Module.load=function(a){globalEval(Module.read(a))});Module.print||(Module.print=function(){});Module.printErr||(Module.printErr=Module.print);Module.arguments||(Module.arguments=[]);Module.print=Module.print;Module.printErr=Module.printErr;Module.preRun=[];Module.postRun=[];for(key in moduleOverrides)moduleOverrides.hasOwnProperty(key)&&(Module[key]=moduleOverrides[key]);
var Runtime={stackSave:function(){return STACKTOP},stackRestore:function(a){STACKTOP=a},forceAlign:function(a,c){c=c||4;return 1==c?a:isNumber(a)&&isNumber(c)?Math.ceil(a/c)*c:isNumber(c)&&isPowerOfTwo(c)?"((("+a+")+"+(c-1)+")&"+-c+")":"Math.ceil(("+a+")/"+c+")*"+c},isNumberType:function(a){return a in Runtime.INT_TYPES||a in Runtime.FLOAT_TYPES},isPointerType:function(a){return"*"==a[a.length-1]},isStructType:function(a){return isPointerType(a)?!1:isArrayType(a)||/<?{ ?[^}]* ?}>?/.test(a)?!0:"%"==
a[0]},INT_TYPES:{i1:0,i8:0,i16:0,i32:0,i64:0},FLOAT_TYPES:{"float":0,"double":0},or64:function(a,c){var d=a|0|c|0,g=4294967296*(Math.round(a/4294967296)|Math.round(c/4294967296));return d+g},and64:function(a,c){var d=(a|0)&(c|0),g=4294967296*(Math.round(a/4294967296)&Math.round(c/4294967296));return d+g},xor64:function(a,c){var d=(a|0)^(c|0),g=4294967296*(Math.round(a/4294967296)^Math.round(c/4294967296));return d+g},getNativeTypeSize:function(a){switch(a){case "i1":case "i8":return 1;case "i16":return 2;
case "i32":return 4;case "i64":return 8;case "float":return 4;case "double":return 8;default:return"*"===a[a.length-1]?Runtime.QUANTUM_SIZE:"i"===a[0]?(a=parseInt(a.substr(1)),assert(0===a%8),a/8):0}},getNativeFieldSize:function(a){return Math.max(Runtime.getNativeTypeSize(a),Runtime.QUANTUM_SIZE)},dedup:function(a,c){var d={};return c?a.filter(function(a){return d[a[c]]?!1:d[a[c]]=!0}):a.filter(function(a){return d[a]?!1:d[a]=!0})},set:function(){for(var a="object"===typeof arguments[0]?arguments[0]:
arguments,c={},d=0;d<a.length;d++)c[a[d]]=0;return c},STACK_ALIGN:8,getAlignSize:function(a,c,d){return"i64"==a||"double"==a||d?8:a?Math.min(c||(a?Runtime.getNativeFieldSize(a):0),Runtime.QUANTUM_SIZE):Math.min(c,8)},calculateStructAlignment:function(a){a.flatSize=0;a.alignSize=0;var c=[],d=-1,g=0;a.flatIndexes=a.fields.map(function(h){g++;var l,p;Runtime.isNumberType(h)||Runtime.isPointerType(h)?(l=Runtime.getNativeTypeSize(h),p=Runtime.getAlignSize(h,l)):Runtime.isStructType(h)?"0"===h[1]?(l=0,
p=Types.types[h]?Runtime.getAlignSize(null,Types.types[h].alignSize):a.alignSize||QUANTUM_SIZE):(l=Types.types[h].flatSize,p=Runtime.getAlignSize(null,Types.types[h].alignSize)):"b"==h[0]?(l=h.substr(1)|0,p=1):"<"===h[0]?l=p=Types.types[h].flatSize:"i"===h[0]?(l=p=parseInt(h.substr(1))/8,assert(0===l%1,"cannot handle non-byte-size field "+h)):assert(!1,"invalid type for calculateStructAlignment");a.packed&&(p=1);a.alignSize=Math.max(a.alignSize,p);h=Runtime.alignMemory(a.flatSize,p);a.flatSize=h+
l;0<=d&&c.push(h-d);return d=h});"["===a.name_[0]&&(a.flatSize=parseInt(a.name_.substr(1))*a.flatSize/2);a.flatSize=Runtime.alignMemory(a.flatSize,a.alignSize);0==c.length?a.flatFactor=a.flatSize:1==Runtime.dedup(c).length&&(a.flatFactor=c[0]);a.needsFlattening=1!=a.flatFactor;return a.flatIndexes},generateStructInfo:function(a,c,d){var g,h;if(c){d=d||0;g=("undefined"===typeof Types?Runtime.typeInfo:Types.types)[c];if(!g)return null;if(g.fields.length!=a.length)return printErr("Number of named fields must match the type for "+
c+": possibly duplicate struct names. Cannot return structInfo"),null;h=g.flatIndexes}else g={fields:a.map(function(a){return a[0]}),name_:""},h=Runtime.calculateStructAlignment(g);var l={__size__:g.flatSize};c?a.forEach(function(a,c){if("string"===typeof a)l[a]=h[c]+d;else{var w,P;for(P in a)w=P;l[w]=Runtime.generateStructInfo(a[w],g.fields[c],h[c])}}):a.forEach(function(a,c){l[a[1]]=h[c]});return l},dynCall:function(a,c,d){return d&&d.length?(d.splice||(d=Array.prototype.slice.call(d)),d.splice(0,
0,c),Module["dynCall_"+a].apply(null,d)):Module["dynCall_"+a].call(null,c)},functionPointers:[],addFunction:function(a){for(var c=0;c<Runtime.functionPointers.length;c++)if(!Runtime.functionPointers[c])return Runtime.functionPointers[c]=a,2*(1+c);throw"Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";},removeFunction:function(a){Runtime.functionPointers[(a-2)/2]=null},getAsmConst:function(a,c){Runtime.asmConstCache||(Runtime.asmConstCache={});var d=Runtime.asmConstCache[a];
if(d)return d;for(var d=[],g=0;g<c;g++)d.push(String.fromCharCode(36)+g);return Runtime.asmConstCache[a]=eval("(function("+d.join(",")+"){ "+Pointer_stringify(a)+" })")},warnOnce:function(a){Runtime.warnOnce.shown||(Runtime.warnOnce.shown={});Runtime.warnOnce.shown[a]||(Runtime.warnOnce.shown[a]=1,Module.printErr(a))},funcWrappers:{},getFuncWrapper:function(a,c){assert(c);Runtime.funcWrappers[a]||(Runtime.funcWrappers[a]=function(){return Runtime.dynCall(c,a,arguments)});return Runtime.funcWrappers[a]},
UTF8Processor:function(){var a=[],c=0;this.processCChar=function(d){d&=255;if(0==a.length){if(0==(d&128))return String.fromCharCode(d);a.push(d);c=192==(d&224)?1:224==(d&240)?2:3;return""}if(c&&(a.push(d),c--,0<c))return"";d=a[0];var g=a[1],h=a[2],l=a[3];2==a.length?d=String.fromCharCode((d&31)<<6|g&63):3==a.length?d=String.fromCharCode((d&15)<<12|(g&63)<<6|h&63):(d=(d&7)<<18|(g&63)<<12|(h&63)<<6|l&63,d=String.fromCharCode(Math.floor((d-65536)/1024)+55296,(d-65536)%1024+56320));a.length=0;return d};
this.processJSString=function(a){a=unescape(encodeURIComponent(a));for(var c=[],h=0;h<a.length;h++)c.push(a.charCodeAt(h));return c}},stackAlloc:function(a){var c=STACKTOP;STACKTOP=STACKTOP+a|0;STACKTOP=STACKTOP+7&-8;return c},staticAlloc:function(a){var c=STATICTOP;STATICTOP=STATICTOP+a|0;STATICTOP=STATICTOP+7&-8;return c},dynamicAlloc:function(a){var c=DYNAMICTOP;DYNAMICTOP=DYNAMICTOP+a|0;DYNAMICTOP=DYNAMICTOP+7&-8;DYNAMICTOP>=TOTAL_MEMORY&&enlargeMemory();return c},alignMemory:function(a,c){return Math.ceil(a/
(c?c:8))*(c?c:8)},makeBigInt:function(a,c,d){return d?+(a>>>0)+4294967296*+(c>>>0):+(a>>>0)+4294967296*+(c|0)},GLOBAL_BASE:8,QUANTUM_SIZE:4,__dummy__:0},__THREW__=0,ABORT=!1,EXITSTATUS=0,undef=0,tempValue,tempInt,tempBigInt,tempInt2,tempBigInt2,tempPair,tempBigIntI,tempBigIntR,tempBigIntS,tempBigIntP,tempBigIntD,tempDouble,tempFloat,tempI64,tempI64b,tempRet0,tempRet1,tempRet2,tempRet3,tempRet4,tempRet5,tempRet6,tempRet7,tempRet8,tempRet9;function assert(a,c){a||abort("Assertion failed: "+c)}
var globalScope=this;function ccall(a,c,d,g){return ccallFunc(getCFunc(a),c,d,g)}Module.ccall=ccall;function getCFunc(a){try{var c=Module["_"+a];c||(c=eval("_"+a))}catch(d){}assert(c,"Cannot call unknown function "+a+" (perhaps LLVM optimizations or closure removed it?)");return c}
function ccallFunc(a,c,d,g){function h(a,c){if("string"==c){if(null===a||void 0===a||0===a)return 0;a=intArrayFromString(a);c="array"}if("array"==c){l||(l=Runtime.stackSave());var d=Runtime.stackAlloc(a.length);writeArrayToMemory(a,d);return d}return a}var l=0,p=0;g=g?g.map(function(a){return h(a,d[p++])}):[];a=function(a,c){if("string"==c)return Pointer_stringify(a);assert("array"!=c);return a}(a.apply(null,g),c);l&&Runtime.stackRestore(l);return a}
function cwrap(a,c,d){var g=getCFunc(a);return function(){return ccallFunc(g,c,d,Array.prototype.slice.call(arguments))}}Module.cwrap=cwrap;
function setValue(a,c,d,g){d=d||"i8";"*"===d.charAt(d.length-1)&&(d="i32");switch(d){case "i1":HEAP8[a]=c;break;case "i8":HEAP8[a]=c;break;case "i16":HEAP16[a>>1]=c;break;case "i32":HEAP32[a>>2]=c;break;case "i64":tempI64=[c>>>0,(tempDouble=c,1<=+Math_abs(tempDouble)?0<tempDouble?(Math_min(+Math_floor(tempDouble/4294967296),4294967295)|0)>>>0:~~+Math_ceil((tempDouble-+(~~tempDouble>>>0))/4294967296)>>>0:0)];HEAP32[a>>2]=tempI64[0];HEAP32[a+4>>2]=tempI64[1];break;case "float":HEAPF32[a>>2]=c;break;
case "double":HEAPF64[a>>3]=c;break;default:abort("invalid type for setValue: "+d)}}Module.setValue=setValue;function getValue(a,c,d){c=c||"i8";"*"===c.charAt(c.length-1)&&(c="i32");switch(c){case "i1":return HEAP8[a];case "i8":return HEAP8[a];case "i16":return HEAP16[a>>1];case "i32":return HEAP32[a>>2];case "i64":return HEAP32[a>>2];case "float":return HEAPF32[a>>2];case "double":return HEAPF64[a>>3];default:abort("invalid type for setValue: "+c)}return null}Module.getValue=getValue;
var ALLOC_NORMAL=0,ALLOC_STACK=1,ALLOC_STATIC=2,ALLOC_DYNAMIC=3,ALLOC_NONE=4;Module.ALLOC_NORMAL=ALLOC_NORMAL;Module.ALLOC_STACK=ALLOC_STACK;Module.ALLOC_STATIC=ALLOC_STATIC;Module.ALLOC_DYNAMIC=ALLOC_DYNAMIC;Module.ALLOC_NONE=ALLOC_NONE;
function allocate(a,c,d,g){var h,l;"number"===typeof a?(h=!0,l=a):(h=!1,l=a.length);var p="string"===typeof c?c:null;d=d==ALLOC_NONE?g:[_malloc,Runtime.stackAlloc,Runtime.staticAlloc,Runtime.dynamicAlloc][void 0===d?ALLOC_STATIC:d](Math.max(l,p?1:c.length));if(h){g=d;assert(0==(d&3));for(a=d+(l&-4);g<a;g+=4)HEAP32[g>>2]=0;for(a=d+l;g<a;)HEAP8[g++|0]=0;return d}if("i8"===p)return a.subarray||a.slice?HEAPU8.set(a,d):HEAPU8.set(new Uint8Array(a),d),d;g=0;for(var x,w;g<l;){var P=a[g];"function"===typeof P&&
(P=Runtime.getFunctionIndex(P));h=p||c[g];0===h?g++:("i64"==h&&(h="i32"),setValue(d+g,P,h),w!==h&&(x=Runtime.getNativeTypeSize(h),w=h),g+=x)}return d}Module.allocate=allocate;
function Pointer_stringify(a,c){for(var d=!1,g,h=0;;){g=HEAPU8[a+h|0];if(128<=g)d=!0;else if(0==g&&!c)break;h++;if(c&&h==c)break}c||(c=h);var l="";if(!d){for(;0<c;)g=String.fromCharCode.apply(String,HEAPU8.subarray(a,a+Math.min(c,1024))),l=l?l+g:g,a+=1024,c-=1024;return l}d=new Runtime.UTF8Processor;for(h=0;h<c;h++)g=HEAPU8[a+h|0],l+=d.processCChar(g);return l}Module.Pointer_stringify=Pointer_stringify;
function UTF16ToString(a){for(var c=0,d="";;){var g=HEAP16[a+2*c>>1];if(0==g)return d;++c;d+=String.fromCharCode(g)}}Module.UTF16ToString=UTF16ToString;function stringToUTF16(a,c){for(var d=0;d<a.length;++d){var g=a.charCodeAt(d);HEAP16[c+2*d>>1]=g}HEAP16[c+2*a.length>>1]=0}Module.stringToUTF16=stringToUTF16;function UTF32ToString(a){for(var c=0,d="";;){var g=HEAP32[a+4*c>>2];if(0==g)return d;++c;65536<=g?(g-=65536,d+=String.fromCharCode(55296|g>>10,56320|g&1023)):d+=String.fromCharCode(g)}}
Module.UTF32ToString=UTF32ToString;function stringToUTF32(a,c){for(var d=0,g=0;g<a.length;++g){var h=a.charCodeAt(g);if(55296<=h&&57343>=h)var l=a.charCodeAt(++g),h=65536+((h&1023)<<10)|l&1023;HEAP32[c+4*d>>2]=h;++d}HEAP32[c+4*d>>2]=0}Module.stringToUTF32=stringToUTF32;
function demangle(a){try{"number"===typeof a&&(a=Pointer_stringify(a));if("_"!==a[0]||"_"!==a[1]||"Z"!==a[2])return a;switch(a[3]){case "n":return"operator new()";case "d":return"operator delete()"}var c=3,d={v:"void",b:"bool",c:"char",s:"short",i:"int",l:"long",f:"float",d:"double",w:"wchar_t",a:"signed char",h:"unsigned char",t:"unsigned short",j:"unsigned int",m:"unsigned long",x:"long long",y:"unsigned long long",z:"..."},g=[],h=!0,l=function(p,w,P){w=w||Infinity;var N="",R=[],I;if("N"===a[c]){c++;
"K"===a[c]&&c++;for(I=[];"E"!==a[c];)if("S"===a[c]){c++;var fa=a.indexOf("_",c),pa=a.substring(c,fa)||0;I.push(g[pa]||"?");c=fa+1}else if("C"===a[c])I.push(I[I.length-1]),c+=2;else{fa=parseInt(a.substr(c));pa=fa.toString().length;if(!fa||!pa){c--;break}var va=a.substr(c+pa,fa);I.push(va);g.push(va);c+=pa+fa}c++;I=I.join("::");w--;if(0===w)return p?[I]:I}else if(("K"===a[c]||h&&"L"===a[c])&&c++,fa=parseInt(a.substr(c)))pa=fa.toString().length,I=a.substr(c+pa,fa),c+=pa+fa;h=!1;"I"===a[c]?(c++,fa=l(!0),
pa=l(!0,1,!0),N+=pa[0]+" "+I+"<"+fa.join(", ")+">"):N=I;a:for(;c<a.length&&0<w--;)if(I=a[c++],I in d)R.push(d[I]);else switch(I){case "P":R.push(l(!0,1,!0)[0]+"*");break;case "R":R.push(l(!0,1,!0)[0]+"&");break;case "L":c++;fa=a.indexOf("E",c)-c;R.push(a.substr(c,fa));c+=fa+2;break;case "A":fa=parseInt(a.substr(c));c+=fa.toString().length;if("_"!==a[c])throw"?";c++;R.push(l(!0,1,!0)[0]+" ["+fa+"]");break;case "E":break a;default:N+="?"+I;break a}P||1!==R.length||"void"!==R[0]||(R=[]);return p?R:N+
("("+R.join(", ")+")")};return l()}catch(p){return a}}function demangleAll(a){return a.replace(/__Z[\w\d_]+/g,function(a){var d=demangle(a);return a===d?a:a+" ["+d+"]"})}function stackTrace(){var a=Error().stack;return a?demangleAll(a):"(no stack trace available)"}var PAGE_SIZE=4096;function alignMemoryPage(a){return a+4095&-4096}
var HEAP,HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64,STATIC_BASE=0,STATICTOP=0,staticSealed=!1,STACK_BASE=0,STACKTOP=0,STACK_MAX=0,DYNAMIC_BASE=0,DYNAMICTOP=0;function enlargeMemory(){abort("Cannot enlarge memory arrays in asm.js. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value "+TOTAL_MEMORY+", or (2) set Module.TOTAL_MEMORY before the program runs.")}
var TOTAL_STACK=Module.TOTAL_STACK||5242880,TOTAL_MEMORY=Module.TOTAL_MEMORY||16777216,FAST_MEMORY=Module.FAST_MEMORY||2097152;assert("undefined"!==typeof Int32Array&&"undefined"!==typeof Float64Array&&!!(new Int32Array(1)).subarray&&!!(new Int32Array(1)).set,"Cannot fallback to non-typed array case: Code is too specialized");var buffer=new ArrayBuffer(TOTAL_MEMORY);HEAP8=new Int8Array(buffer);HEAP16=new Int16Array(buffer);HEAP32=new Int32Array(buffer);HEAPU8=new Uint8Array(buffer);HEAPU16=new Uint16Array(buffer);
HEAPU32=new Uint32Array(buffer);HEAPF32=new Float32Array(buffer);HEAPF64=new Float64Array(buffer);HEAP32[0]=255;assert(255===HEAPU8[0]&&0===HEAPU8[3],"Typed arrays 2 must be run on a little-endian system");Module.HEAP=HEAP;Module.HEAP8=HEAP8;Module.HEAP16=HEAP16;Module.HEAP32=HEAP32;Module.HEAPU8=HEAPU8;Module.HEAPU16=HEAPU16;Module.HEAPU32=HEAPU32;Module.HEAPF32=HEAPF32;Module.HEAPF64=HEAPF64;
function callRuntimeCallbacks(a){for(;0<a.length;){var c=a.shift();if("function"==typeof c)c();else{var d=c.func;"number"===typeof d?void 0===c.arg?Runtime.dynCall("v",d):Runtime.dynCall("vi",d,[c.arg]):d(void 0===c.arg?null:c.arg)}}}var __ATPRERUN__=[],__ATINIT__=[],__ATMAIN__=[],__ATEXIT__=[],__ATPOSTRUN__=[],runtimeInitialized=!1;
function preRun(){if(Module.preRun)for("function"==typeof Module.preRun&&(Module.preRun=[Module.preRun]);Module.preRun.length;)addOnPreRun(Module.preRun.shift());callRuntimeCallbacks(__ATPRERUN__)}function ensureInitRuntime(){runtimeInitialized||(runtimeInitialized=!0,callRuntimeCallbacks(__ATINIT__))}function preMain(){callRuntimeCallbacks(__ATMAIN__)}function exitRuntime(){callRuntimeCallbacks(__ATEXIT__)}
function postRun(){if(Module.postRun)for("function"==typeof Module.postRun&&(Module.postRun=[Module.postRun]);Module.postRun.length;)addOnPostRun(Module.postRun.shift());callRuntimeCallbacks(__ATPOSTRUN__)}function addOnPreRun(a){__ATPRERUN__.unshift(a)}Module.addOnPreRun=Module.addOnPreRun=addOnPreRun;function addOnInit(a){__ATINIT__.unshift(a)}Module.addOnInit=Module.addOnInit=addOnInit;function addOnPreMain(a){__ATMAIN__.unshift(a)}Module.addOnPreMain=Module.addOnPreMain=addOnPreMain;
function addOnExit(a){__ATEXIT__.unshift(a)}Module.addOnExit=Module.addOnExit=addOnExit;function addOnPostRun(a){__ATPOSTRUN__.unshift(a)}Module.addOnPostRun=Module.addOnPostRun=addOnPostRun;function intArrayFromString(a,c,d){a=(new Runtime.UTF8Processor).processJSString(a);d&&(a.length=d);c||a.push(0);return a}Module.intArrayFromString=intArrayFromString;function intArrayToString(a){for(var c=[],d=0;d<a.length;d++){var g=a[d];255<g&&(g&=255);c.push(String.fromCharCode(g))}return c.join("")}
Module.intArrayToString=intArrayToString;function writeStringToMemory(a,c,d){a=intArrayFromString(a,d);for(d=0;d<a.length;)HEAP8[c+d|0]=a[d],d+=1}Module.writeStringToMemory=writeStringToMemory;function writeArrayToMemory(a,c){for(var d=0;d<a.length;d++)HEAP8[c+d|0]=a[d]}Module.writeArrayToMemory=writeArrayToMemory;function writeAsciiToMemory(a,c,d){for(var g=0;g<a.length;g++)HEAP8[c+g|0]=a.charCodeAt(g);d||(HEAP8[c+a.length|0]=0)}Module.writeAsciiToMemory=writeAsciiToMemory;
function unSign(a,c,d,g){return 0<=a?a:32>=c?2*Math.abs(1<<c-1)+a:Math.pow(2,c)+a}function reSign(a,c,d,g){if(0>=a)return a;d=32>=c?Math.abs(1<<c-1):Math.pow(2,c-1);a>=d&&(32>=c||a>d)&&(a=-2*d+a);return a}Math.imul||(Math.imul=function(a,c){var d=a&65535,g=c&65535;return d*g+((a>>>16)*g+d*(c>>>16)<<16)|0});Math.imul=Math.imul;
var Math_abs=Math.abs,Math_cos=Math.cos,Math_sin=Math.sin,Math_tan=Math.tan,Math_acos=Math.acos,Math_asin=Math.asin,Math_atan=Math.atan,Math_atan2=Math.atan2,Math_exp=Math.exp,Math_log=Math.log,Math_sqrt=Math.sqrt,Math_ceil=Math.ceil,Math_floor=Math.floor,Math_pow=Math.pow,Math_imul=Math.imul,Math_fround=Math.fround,Math_min=Math.min,runDependencies=0,runDependencyWatcher=null,dependenciesFulfilled=null;
function addRunDependency(a){runDependencies++;Module.monitorRunDependencies&&Module.monitorRunDependencies(runDependencies)}Module.addRunDependency=addRunDependency;function removeRunDependency(a){runDependencies--;Module.monitorRunDependencies&&Module.monitorRunDependencies(runDependencies);0==runDependencies&&(null!==runDependencyWatcher&&(clearInterval(runDependencyWatcher),runDependencyWatcher=null),dependenciesFulfilled&&(a=dependenciesFulfilled,dependenciesFulfilled=null,a()))}
Module.removeRunDependency=removeRunDependency;Module.preloadedImages={};Module.preloadedAudios={};var memoryInitializer=null,STATIC_BASE=8,STATICTOP=STATIC_BASE+14688;__ATINIT__.push({func:function(){runPostSets()}});var _stderr;_stderr=_stderr=allocate([0,0,0,0,0,0,0,0],"i8",ALLOC_STATIC);
allocate([0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,120,4,0,0,0,0,128,191,96,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,120,4,0,0,0,0,128,191,192,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,96,4,0,0,0,0,128,191,112,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,191,36,0,0,0,0,0,0,0,36,0,0,0,
112,0,0,0,192,0,0,0,96,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,154,153,121,64,0,0,32,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,64,0,0,32,64,0,0,0,64,154,153,153,63,0,0,0,63,0,0,0,0,0,0,0,191,51,51,51,191,
205,204,76,191,102,102,102,191,0,0,128,191,0,0,32,65,0,0,208,64,102,102,166,64,0,0,144,64,154,153,121,64,0,0,96,64,0,0,64,64,0,0,32,64,51,51,19,64,102,102,230,63,0,0,128,63,0,0,48,65,205,204,12,65,0,0,240,64,0,0,208,64,0,0,160,64,154,153,121,64,154,153,121,64,154,153,121,64,0,0,96,64,0,0,64,64,0,0,128,63,0,0,48,65,0,0,48,65,102,102,30,65,0,0,8,65,0,0,224,64,0,0,192,64,0,0,144,64,0,0,128,64,0,0,128,64,0,0,128,64,0,0,0,64,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,24,65,0,0,8,65,0,0,0,65,0,0,224,64,
0,0,192,64,0,0,160,64,0,0,64,64,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,24,65,0,0,8,65,0,0,224,64,0,0,192,64,0,0,160,64,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,205,204,28,65,0,0,24,65,0,0,240,64,0,0,224,64,0,0,144,64,205,204,108,64,0,0,64,64,0,0,32,64,0,0,0,64,102,102,230,63,0,0,192,63,0,0,128,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,
191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,128,191,0,0,48,65,0,0,48,65,0,0,24,65,0,0,8,65,0,0,240,64,0,0,192,64,0,0,160,64,154,153,121,64,0,0,64,64,0,0,0,64,0,0,128,63,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,24,65,51,51,11,65,154,153,249,64,0,0,224,64,0,0,208,64,0,0,128,64,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,0,0,48,65,205,204,28,65,0,0,240,64,0,0,176,64,
0,0,0,0,5,0,0,0,8,0,0,0,96,32,0,0,8,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,4,0,0,0,32,41,0,0,4,0,0,0,0,0,0,0,0,0,0,0,20,0,0,0,2,0,0,0,96,37,0,0,5,0,0,0,0,0,0,0,0,0,0,0,8,0,0,0,5,0,0,0,32,27,0,0,7,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,4,0,0,0,224,39,0,0,5,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,8,0,0,0,32,31,0,0,6,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,4,0,0,0,80,21,0,0,5,0,0,0,0,0,0,0,0,0,0,0,8,0,0,0,5,0,0,0,80,17,0,0,7,0,0,0,1,0,0,0,0,0,0,0,160,5,0,0,16,0,0,0,248,54,0,0,1,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,6,0,0,0,20,
0,0,0,18,0,0,0,8,0,0,0,0,0,0,0,72,6,0,0,16,0,0,0,72,53,0,0,2,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,6,0,0,0,4,0,0,0,6,0,0,0,20,0,0,0,18,0,0,0,8,0,0,0,0,0,0,0,176,8,0,0,2,0,0,0,152,49,0,0,0,0,0,0,4,0,0,0,8,0,0,0,8,0,0,0,12,0,0,0,2,0,0,0,2,0,0,0,4,0,0,0,10,0,0,0,14,0,0,0,0,0,0,0,0,5,0,0,144,4,0,0,200,4,0,0,0,0,0,0,34,55,67,188,212,125,64,61,171,7,28,190,47,54,29,63,47,54,29,63,171,7,28,190,212,125,64,61,132,15,5,189,155,20,176,61,167,51,81,190,167,202,118,63,64,166,85,62,81,113,247,188,34,142,208,187,34,142,
208,187,81,113,247,188,64,166,85,62,167,202,118,63,167,51,81,190,155,20,176,61,132,15,5,189,0,0,0,0,0,5,0,0,160,0,0,0,40,0,0,0,8,0,0,0,102,102,102,63,154,153,25,63,23,183,81,57,102,102,102,63,0,0,0,0,176,0,0,0,120,0,0,0,64,0,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,1,0,0,0,8,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,5,0,0,0,6,0,0,0,6,0,0,0,7,0,0,0,7,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,3,0,0,0,3,0,0,0,4,0,0,0,240,2,0,0,5,0,0,0,0,0,0,0,144,4,0,0,64,1,0,0,80,0,0,0,8,
0,0,0,102,102,102,63,154,153,25,63,23,183,81,57,51,51,51,63,0,0,0,0,176,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,8,1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,6,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,0,4,0,0,0,0,0,63,79,0,0,0,255,255,255,255,0,0,0,0,3,0,0,0,1,0,0,0,6,0,0,0,2,0,
0,0,4,0,0,0,4,0,0,0,80,9,0,0,2,0,0,0,2,0,0,0,72,4,0,0,205,204,204,61,236,1,0,0,255,255,255,255,0,0,0,0,3,0,0,0,0,0,0,0,6,0,0,0,2,0,0,0,4,0,0,0,4,0,0,0,80,9,0,0,2,0,0,0,2,0,0,0,208,3,0,0,205,204,76,62,108,1,0,0,255,255,255,255,0,0,0,0,3,0,0,0,0,0,0,0,6,0,0,0,2,0,0,0,4,0,0,0,4,0,0,0,80,9,0,0,2,0,0,0,2,0,0,0,72,4,0,0,154,153,153,62,44,1,0,0,255,255,255,255,0,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,6,0,0,0,4,0,0,0,4,0,0,0,96,9,0,0,2,0,0,0,2,0,0,0,24,4,0,0,102,102,230,62,220,0,0,0,255,255,255,255,0,0,0,0,1,0,0,
0,0,0,0,0,2,0,0,0,6,0,0,0,4,0,0,0,4,0,0,0,112,9,0,0,2,0,0,0,2,0,0,0,48,4,0,0,205,204,12,63,160,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,6,0,0,0,4,0,0,0,4,0,0,0,64,9,0,0,2,0,0,0,2,0,0,0,232,3,0,0,154,153,25,63,119,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,6,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,128,191,43,0,0,0,160,0,0,0,40,0,0,0,10,0,0,0,17,0,0,0,144,0,0,0,102,102,102,63,154,153,25,63,23,183,81,57,0,0,0,0,120,8,0,0,64,8,0,0,8,8,0,0,208,7,0,0,152,7,0,0,96,7,0,0,40,7,0,
0,240,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,1,0,0,0,8,0,0,0,2,0,0,0,3,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,5,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,208,25,0,0,5,0,0,0,0,0,0,0,0,0,0,0,208,23,0,0,7,0,0,0,7,0,0,0,0,0,0,0,208,25,0,0,5,0,0,0,7,0,0,0,0,0,0,0,208,25,0,0,5,0,0,0,7,0,0,0,0,0,0,0,10,215,163,61,225,41,164,61,87,33,165,61,123,190,166,61,63,0,169,61,29,230,171,61,21,112,175,61,161,157,179,61,47,109,184,61,190,222,189,61,187,240,195,61,161,162,202,61,220,242,209,61,97,224,217,61,
156,105,226,61,252,140,235,61,115,73,245,61,233,156,255,61,162,66,5,62,122,0,11,62,238,6,17,62,55,85,23,62,192,233,29,62,126,195,36,62,101,225,43,62,36,66,51,62,176,228,58,62,50,199,66,62,159,232,74,62,166,71,83,62,113,226,91,62,179,183,100,62,214,197,109,62,74,11,119,62,61,67,128,62,202,26,133,62,128,11,138,62,119,20,143,62,227,52,148,62,219,107,153,62,82,184,158,62,126,25,164,62,84,142,169,62,9,22,175,62,113,175,180,62,192,89,186,62,203,19,192,62,165,220,197,62,66,179,203,62,183,150,209,62,215,
133,215,62,183,127,221,62,73,131,227,62,96,143,233,62,240,162,239,62,14,189,245,62,140,220,251,62,46,0,1,63,169,19,4,63,82,40,7,63,113,61,10,63,143,82,13,63,56,103,16,63,179,122,19,63,156,140,22,63,90,156,25,63,105,169,28,63,49,179,31,63,61,185,34,63,6,187,37,63,246,183,40,63,134,175,43,63,64,161,46,63,143,140,49,63,252,112,52,63,1,78,55,63,41,35,58,63,221,239,60,63,183,179,63,63,34,110,66,63,184,30,69,63,244,196,71,63,112,96,74,63,166,240,76,63,33,117,79,63,124,237,81,63,67,89,84,63,15,184,86,63,
108,9,89,63,245,76,91,63,69,130,93,63,248,168,95,63,186,192,97,63,21,201,99,63,181,193,101,63,88,170,103,63,136,130,105,63,2,74,107,63,113,0,109,63,148,165,110,63,38,57,112,63,195,186,113,63,57,42,115,63,68,135,116,63,179,209,117,63,66,9,119,63,174,45,120,63,213,62,121,63,134,60,122,63,141,38,123,63,202,252,123,63,10,191,124,63,59,109,125,63,45,7,126,63,223,140,126,63,30,254,126,63,217,90,127,63,18,163,127,63,182,214,127,63,165,245,127,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,
128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,0,0,128,63,
223,166,127,63,225,155,126,63,156,223,124,63,113,115,122,63,20,89,119,63,192,146,115,63,54,35,111,63,153,13,106,63,151,85,100,63,113,255,93,63,191,15,87,63,139,139,79,63,121,120,71,63,110,220,62,63,249,189,53,63,251,35,44,63,253,21,34,63,237,155,23,63,115,190,12,63,219,134,1,63,71,255,235,62,236,104,212,62,77,102,188,62,5,26,164,62,11,180,139,62,143,251,102,62,123,247,55,62,80,140,12,62,100,4,212,61,0,0,128,63,225,69,127,63,202,26,125,63,144,136,121,63,69,158,116,63,59,112,110,63,80,25,103,63,2,183,
94,63,102,107,85,63,222,89,75,63,21,169,64,63,0,0,0,0,206,223,116,63,34,224,244,191,206,223,116,63,218,230,118,63,151,226,246,191,218,230,118,63,99,156,119,63,15,156,247,191,99,156,119,63,253,135,124,63,186,131,252,191,253,135,124,63,174,71,97,63,174,71,225,191,174,71,97,63,0,0,0,0,0,0,128,63,52,162,244,191,33,60,106,63,0,0,128,63,94,162,246,191,3,67,110,63,0,0,128,63,255,120,247,191,229,126,111,63,0,0,128,63,4,115,252,191,128,43,121,63,0,0,128,63,41,92,175,191,186,73,204,62,0,0,0,0,220,194,6,247,
246,242,200,23,1,230,23,208,239,12,8,249,23,29,220,228,250,227,239,251,40,23,10,10,210,243,36,6,4,226,227,62,32,224,255,22,242,1,252,234,211,2,54,4,226,199,197,244,27,253,225,8,247,5,10,242,32,66,19,9,2,231,219,23,241,18,218,225,5,247,235,15,0,22,62,30,15,244,242,210,77,21,33,3,34,29,237,50,2,11,9,218,244,219,62,1,241,54,32,6,2,232,20,35,235,2,19,24,243,55,4,9,39,237,30,255,235,73,54,33,8,18,3,15,6,237,209,6,253,208,206,1,26,20,8,233,206,65,242,201,239,225,219,228,53,255,239,203,1,57,11,248,231,226,
219,64,5,204,211,15,23,31,15,14,231,24,33,254,212,200,238,6,235,213,4,244,17,219,20,246,34,15,2,15,55,21,245,225,250,46,25,16,247,231,248,194,28,17,20,224,227,26,30,25,237,2,240,239,26,205,2,50,42,19,190,23,29,254,3,19,237,219,32,15,6,30,222,13,11,251,40,31,10,214,4,247,26,247,186,17,254,233,20,234,201,51,232,225,22,234,15,243,3,246,228,240,56,4,193,11,238,241,238,218,221,16,249,34,255,235,207,209,9,219,7,8,69,55,20,6,223,211,246,247,6,247,12,71,15,253,214,249,232,32,221,254,214,239,251,0,254,223,
202,13,244,222,47,23,19,55,7,248,74,31,14,16,233,230,19,12,238,207,228,225,236,2,242,236,209,78,40,13,233,245,21,250,18,1,47,5,38,35,32,46,22,8,13,16,242,18,51,19,40,39,11,230,255,239,47,2,203,241,31,234,38,21,241,240,5,223,53,15,218,86,11,253,232,49,13,252,245,238,28,20,244,229,230,35,231,221,253,236,195,30,10,201,244,234,204,202,242,19,224,244,45,15,248,208,247,11,224,8,240,222,243,51,18,38,254,224,239,22,254,238,228,186,59,27,228,237,246,236,247,247,248,235,21,248,35,254,45,253,247,12,0,30,7,217,
43,27,218,165,30,26,19,201,252,63,14,239,13,9,13,2,7,4,6,61,72,255,239,29,255,234,239,8,228,219,63,44,41,3,2,14,9,250,75,248,249,244,241,244,13,9,252,30,234,191,15,0,211,4,252,1,5,22,11,23,39,12,242,236,227,195,189,180,224,185,189,68,77,46,34,5,243,208,210,184,175,172,196,198,216,228,82,93,68,45,29,3,237,209,228,213,221,226,248,243,217,165,165,133,160,10,10,250,238,201,196,165,200,220,229,240,208,181,40,28,246,228,35,9,37,19,1,236,225,215,238,231,221,188,176,45,27,255,47,13,0,227,221,199,206,177,
183,218,237,5,35,14,246,233,16,248,5,232,216,194,233,229,234,240,238,210,184,179,43,21,33,1,176,186,186,192,200,204,217,223,225,218,237,237,241,32,33,254,7,241,241,232,233,223,215,200,232,199,5,89,64,41,27,5,247,209,196,159,159,132,236,247,212,183,31,29,252,64,48,7,221,199,0,253,230,209,253,250,216,180,177,208,12,81,55,10,9,232,213,183,199,187,16,5,228,203,18,29,20,0,252,245,6,243,23,7,239,221,219,219,226,188,193,6,24,247,242,3,21,243,229,199,207,176,232,215,251,240,251,1,45,25,12,249,3,241,250,240,
241,248,6,243,214,175,176,169,14,1,246,253,213,187,210,232,228,227,36,6,213,200,244,12,54,79,43,9,54,22,2,8,244,213,210,204,218,187,167,251,75,38,33,5,243,203,194,169,167,143,157,201,222,219,62,55,33,16,21,254,239,210,227,218,218,208,217,214,220,181,184,168,208,226,21,2,241,199,192,158,172,180,25,1,210,176,244,18,249,3,34,6,38,31,23,4,255,20,14,241,213,178,165,232,14,253,54,16,0,229,228,212,200,173,164,167,253,34,56,41,36,22,20,248,249,221,214,194,207,3,12,246,206,169,160,190,92,70,38,9,186,185,194,
214,217,213,245,249,206,177,198,206,225,32,31,250,252,231,7,239,218,186,198,229,213,173,228,59,36,20,31,2,229,185,176,147,158,181,223,224,225,254,33,15,250,43,33,251,0,234,246,229,222,207,245,236,215,165,156,135,217,57,41,10,237,206,218,197,196,186,238,236,248,225,248,241,1,242,230,231,33,21,32,17,1,237,237,230,198,175,221,234,45,30,11,245,3,230,208,169,189,173,198,3,255,230,236,44,10,25,39,5,247,221,229,218,7,10,4,247,214,171,154,129,52,44,28,10,209,195,216,217,239,255,246,223,214,182,208,21,252,
70,52,10,232,21,236,5,251,249,14,246,2,229,16,236,0,224,26,19,8,245,215,31,28,229,224,34,42,34,239,22,246,13,227,18,244,230,232,11,22,5,251,251,54,188,213,57,231,24,4,4,26,248,244,239,54,30,211,1,10,241,18,215,11,68,189,37,240,232,240,38,234,6,227,30,66,229,5,7,240,13,2,244,249,253,236,36,4,228,9,3,32,48,26,39,3,0,7,235,243,5,174,249,73,236,34,247,251,1,255,10,251,246,255,9,1,247,10,0,242,11,255,254,255,11,20,96,175,234,244,247,198,9,24,226,26,221,27,244,13,238,56,197,15,249,23,241,255,6,231,14,234,
236,47,245,16,2,38,233,237,226,247,40,245,5,4,250,8,26,235,245,127,4,1,6,247,2,249,254,253,7,251,10,237,7,150,91,253,9,252,21,248,26,176,8,1,254,246,239,239,229,32,71,6,227,11,233,54,218,29,234,39,87,225,244,236,3,254,254,2,20,0,255,221,27,9,250,244,3,244,250,13,1,14,234,197,241,239,231,13,249,7,3,0,1,249,6,253,61,219,233,233,227,38,225,27,1,248,2,229,23,230,36,222,5,24,232,250,7,3,197,78,194,44,240,1,6,0,17,8,45,0,146,6,14,254,32,179,200,62,253,3,243,4,240,102,241,220,255,9,143,6,23,0,9,9,5,248,
255,242,5,244,121,203,229,248,247,22,243,3,2,253,1,254,185,95,38,237,15,240,251,71,10,2,224,243,251,15,255,254,242,171,30,29,6,3,2,0,0,0,0,0,0,0,0,2,191,200,247,18,18,23,242,254,0,12,227,26,244,1,2,244,192,90,250,4,1,5,251,146,253,225,22,227,9,0,8,216,251,21,251,251,13,10,238,40,1,35,236,30,228,11,250,19,7,14,18,192,9,250,16,51,68,8,16,12,248,0,247,20,234,25,7,252,243,41,221,93,238,202,11,255,1,247,4,190,66,225,20,234,25,233,11,10,9,19,15,11,251,225,246,233,228,250,250,253,252,5,3,228,22,245,214,
25,231,240,41,34,47,250,2,42,237,234,5,217,32,6,221,22,17,226,8,230,245,245,3,244,33,33,219,21,255,6,252,3,0,251,5,12,244,57,27,195,253,20,239,2,0,4,0,254,223,198,81,233,39,246,251,2,6,249,5,4,253,254,243,233,184,107,15,251,0,249,253,250,5,252,15,47,12,225,25,240,8,22,231,194,200,238,14,28,12,2,245,74,190,41,236,249,16,236,16,248,0,240,4,237,92,12,197,242,217,49,231,240,23,229,19,253,223,19,85,227,6,249,246,16,249,244,1,250,2,4,254,64,10,231,41,254,225,15,0,110,50,69,35,28,19,246,2,213,207,200,241,
240,10,3,12,255,248,1,26,244,255,7,245,229,41,25,1,245,238,22,249,255,209,248,23,253,239,249,18,131,59,251,3,18,1,2,3,27,221,65,203,50,210,37,235,228,7,14,219,251,251,12,5,248,78,237,21,250,240,8,249,5,2,7,2,10,250,12,196,44,11,220,224,31,0,2,254,2,1,253,7,246,17,235,10,6,254,19,254,59,218,170,38,8,215,226,211,223,7,15,28,29,249,24,216,7,7,5,254,9,24,233,238,6,227,30,2,28,49,245,210,10,43,243,247,255,253,249,249,239,250,97,223,235,3,5,1,12,213,248,28,7,213,249,17,236,19,255,2,243,9,54,34,9,228,245,
247,239,110,197,44,230,0,3,244,209,73,222,213,38,223,16,251,210,252,250,254,231,19,227,28,243,5,14,27,216,213,4,32,243,254,221,252,112,214,9,244,37,228,17,14,237,35,217,23,3,242,255,199,251,94,247,3,217,5,30,246,224,42,243,242,159,193,30,247,1,249,12,5,20,17,247,220,226,25,47,247,241,12,234,98,248,206,15,229,21,240,245,2,12,246,10,253,33,36,160,0,239,31,247,9,3,236,13,245,8,252,10,246,9,1,112,186,229,5,235,2,199,253,227,10,19,235,21,246,190,253,91,221,30,244,0,249,59,228,26,2,14,238,1,1,11,17,20,
202,197,27,4,29,32,5,19,12,252,1,7,246,5,254,10,0,23,251,28,152,46,11,16,3,29,1,248,242,1,7,206,88,194,26,8,239,242,50,0,32,244,253,229,18,248,251,8,3,236,245,37,244,9,33,46,155,255,252,1,6,255,28,214,241,16,5,255,254,201,85,38,247,252,11,254,247,250,3,236,246,179,89,24,253,152,199,230,225,236,250,247,14,20,233,46,241,225,28,1,241,254,6,254,31,45,180,23,231,253,254,255,0,252,5,35,216,247,13,212,5,229,255,249,6,245,7,248,7,19,242,15,252,9,246,10,248,10,247,255,1,0,0,2,5,238,22,203,50,1,233,50,220,
15,3,243,14,246,6,1,5,253,4,254,5,224,25,5,254,255,252,1,11,227,26,250,241,30,238,0,15,239,40,215,3,9,254,254,3,253,255,251,2,21,250,240,235,23,2,60,15,16,240,247,14,9,255,7,247,0,1,1,0,255,250,17,228,54,211,255,1,255,250,250,2,11,26,227,254,46,235,34,12,233,32,233,16,246,3,66,19,236,24,7,11,253,0,253,255,206,210,2,238,253,4,255,254,3,253,237,41,220,9,11,232,21,240,9,253,231,253,10,18,247,254,251,255,251,6,252,253,2,230,21,237,35,241,7,243,17,237,39,213,48,225,16,247,7,254,251,3,252,9,237,27,201,
63,221,10,26,212,254,9,4,1,250,8,247,5,248,255,253,240,45,214,5,15,240,10,0,0,0,0,0,0,0,0,0,0,240,24,201,47,218,27,237,7,253,1,16,27,20,237,18,5,249,1,251,2,250,8,234,0,253,253,8,255,7,248,1,253,5,0,17,208,58,204,29,249,254,3,246,6,230,58,225,1,250,3,93,227,39,3,17,5,6,255,255,255,27,13,10,19,249,222,12,10,252,9,180,9,8,228,254,245,2,255,3,1,173,38,217,4,240,250,254,251,5,254,201,213,22,56,65,158,235,184,16,166,231,184,119,74,146,57,58,2,113,57,175,17,28,186,232,119,200,185,171,49,149,58,1,41,11,
58,133,42,2,187,236,172,35,186,2,17,84,59,176,141,22,58,0,124,163,187,40,132,135,185,79,104,241,59,26,178,254,185,23,37,44,188,13,88,248,58,129,27,111,60,184,89,141,187,222,96,163,188,140,200,7,60,205,127,222,60,17,94,115,188,154,54,26,189,97,167,216,60,35,13,99,61,14,182,80,189,160,70,200,189,209,141,13,62,250,145,235,62,250,145,235,62,209,141,13,62,160,70,200,189,14,182,80,189,35,13,99,61,97,167,216,60,154,54,26,189,17,94,115,188,205,127,222,60,140,200,7,60,222,96,163,188,184,89,141,187,129,27,
111,60,13,88,248,58,23,37,44,188,26,178,254,185,79,104,241,59,40,132,135,185,0,124,163,187,176,141,22,58,2,17,84,59,236,172,35,186,133,42,2,187,1,41,11,58,171,49,149,58,232,119,200,185,175,17,28,186,58,2,113,57,119,74,146,57,16,166,231,184,65,158,235,184,201,213,22,56,132,211,122,63,222,84,164,63,80,83,215,63,153,18,13,64,190,217,56,64,143,54,114,64,33,176,158,64,141,238,207,64,126,58,8,65,178,128,50,65,54,229,105,65,29,61,153,65,166,202,200,65,234,140,3,66,125,95,44,66,16,221,97,66,224,224,224,0,
228,189,251,33,214,250,224,18,199,246,202,35,240,27,215,42,19,237,216,36,211,24,235,40,248,242,238,28,1,14,198,53,238,168,217,39,218,21,238,37,237,20,213,38,10,17,208,54,204,198,243,33,212,255,245,32,244,245,222,22,14,0,210,46,219,221,222,5,231,44,226,43,6,252,193,49,225,43,215,43,233,30,213,41,213,26,242,44,223,1,243,27,243,18,219,37,210,183,211,34,220,24,231,34,220,245,236,19,231,12,238,33,220,187,197,34,211,6,8,46,234,242,232,18,255,13,212,44,217,208,230,15,224,31,219,34,223,15,210,31,232,30,220,
37,215,31,233,41,206,22,252,50,234,2,235,28,239,30,222,40,249,196,228,29,218,42,228,42,212,245,21,43,240,8,212,34,217,201,213,21,245,221,26,41,247,0,222,29,248,121,175,113,7,240,234,33,219,33,225,36,229,249,220,17,222,70,199,65,219,245,208,21,216,17,255,44,223,6,250,33,247,0,236,34,235,69,223,57,227,33,225,35,201,12,255,49,223,27,234,35,206,223,209,17,206,54,51,94,255,251,212,35,252,22,216,45,217,190,231,24,223,1,230,20,232,233,231,12,245,21,211,44,231,211,237,17,213,105,240,82,5,235,1,41,240,11,
223,30,243,157,252,57,219,33,241,44,231,37,193,54,220,24,225,31,203,200,218,26,215,252,4,37,223,13,226,24,49,52,162,114,251,226,241,23,1,38,216,56,233,12,220,29,239,40,209,51,219,215,217,11,207,34,0,58,238,249,252,34,240,17,229,35,30,5,194,65,4,48,188,76,213,11,245,38,238,19,241,41,233,194,217,23,214,10,254,41,235,243,243,25,247,13,209,42,233,194,232,24,212,60,235,58,238,253,204,32,234,22,220,34,181,57,16,90,237,3,10,45,227,23,218,32,251,194,205,38,205,40,238,53,214,13,232,32,222,14,236,30,200,181,
230,37,230,32,15,59,230,17,227,29,249,28,204,53,244,226,5,30,251,208,251,35,2,2,213,40,21,16,16,75,231,211,224,10,213,18,246,42,9,0,255,52,255,7,226,36,19,208,252,48,228,25,227,32,234,0,225,22,224,17,246,36,192,215,194,36,204,15,16,58,226,234,224,6,249,9,218,36,224,224,224,0,225,198,240,22,215,232,213,14,200,234,201,29,243,33,215,47,252,217,247,29,215,15,244,38,248,241,244,31,1,2,212,40,234,190,214,27,218,28,233,38,235,14,219,31,0,21,206,52,203,185,229,33,219,255,237,25,237,251,228,22,6,65,212,74,
223,208,223,9,216,57,242,58,239,4,211,32,225,38,223,36,233,28,216,39,213,29,244,46,222,13,233,28,240,15,229,34,242,174,241,43,225,25,224,29,235,5,251,38,209,193,205,33,210,12,3,47,228,239,227,11,246,14,216,38,87,38,156,62,44,241,176,62,27,129,200,62,51,51,227,62,120,185,0,63,194,221,17,63,82,73,37,63,115,75,59,63,79,59,84,63,212,125,112,63,137,65,136,63,19,102,154,63,241,244,174,63,100,64,198,63,206,165,224,63,92,143,254,63,42,58,16,64,47,110,35,64,232,48,57,64,85,217,81,64,67,202,109,64,203,185,
134,64,17,170,152,64,202,253,172,64,79,6,196,64,8,32,222,64,104,179,251,64,113,155,14,65,85,152,33,65,120,28,55,65,254,125,79,65,153,30,107,65,119,17,230,61,227,170,114,62,253,22,189,62,128,238,251,62,77,49,35,63,22,49,84,63,17,255,144,63,0,0,0,0,115,99,122,61,154,120,39,62,116,238,158,62,167,63,219,62,156,78,14,63,253,19,56,63,64,78,112,63,2,215,169,63,76,195,96,63,0,0,0,0,144,102,52,63,4,144,134,63,242,9,13,224,2,246,31,246,248,248,6,252,255,10,192,23,6,20,13,6,8,234,16,34,7,42,207,228,5,26,4,241,
41,34,41,32,33,24,23,14,8,40,34,4,232,215,237,241,13,243,33,202,24,27,212,33,27,241,241,24,237,14,220,14,247,24,244,252,37,251,16,222,5,10,33,241,202,240,12,25,12,1,2,0,3,255,252,252,11,2,200,54,27,236,13,250,210,215,223,245,251,7,12,14,242,251,8,20,6,3,4,248,251,214,11,8,242,25,254,2,13,11,234,39,247,9,5,211,247,7,247,12,249,34,239,154,7,2,214,18,35,247,222,11,251,254,3,22,46,204,231,247,162,8,11,251,251,251,4,249,221,249,54,5,224,3,24,247,234,8,65,37,255,244,233,250,247,228,55,223,14,253,2,18,196,
41,239,8,240,17,245,0,245,29,228,37,9,203,33,242,247,7,231,249,245,26,224,248,24,235,22,237,19,246,29,242,0,0,0,0,0,0,0,0,251,204,10,41,6,226,252,16,32,22,229,234,32,253,228,253,3,221,6,17,23,21,8,2,4,211,239,14,23,252,225,245,253,14,1,19,245,2,61,248,9,244,7,246,12,253,232,99,208,23,50,219,251,233,0,8,242,35,192,251,46,231,13,255,207,237,241,9,34,50,25,11,250,247,240,236,224,223,224,229,10,248,12,241,56,242,224,33,3,247,1,65,247,247,246,254,250,233,9,17,3,228,13,224,4,254,246,4,240,76,12,204,6,13,
33,250,4,242,247,253,1,241,240,28,1,241,11,16,9,4,235,219,216,250,22,12,241,233,242,239,240,247,246,247,13,217,41,5,247,16,218,25,46,209,4,49,242,17,254,6,18,5,250,223,234,44,50,254,1,3,250,7,7,253,235,38,238,34,242,215,60,243,6,16,232,35,19,243,220,24,3,239,242,246,36,44,212,227,253,3,202,248,12,55,26,4,254,251,2,245,22,233,2,22,1,231,217,66,207,21,248,254,10,242,196,25,6,10,27,231,16,5,254,247,26,243,236,58,254,7,52,247,2,5,252,241,23,255,218,23,8,27,250,0,229,249,39,246,242,26,11,211,244,9,251,
34,4,221,10,43,234,245,56,249,20,1,10,1,230,9,94,11,229,242,243,1,245,0,14,251,250,246,252,241,248,215,21,251,1,228,248,22,247,33,233,252,252,244,39,4,249,3,196,80,8,239,2,250,12,251,1,9,15,27,31,30,27,23,61,47,26,10,251,248,244,243,5,238,25,241,252,241,245,12,254,254,240,254,250,24,12,11,252,9,1,247,14,211,57,12,20,221,26,11,192,32,246,246,42,252,247,240,32,24,7,10,52,245,199,29,0,8,0,250,17,239,200,216,7,20,18,12,250,16,5,7,255,9,1,10,29,12,16,13,254,23,7,9,253,252,251,18,192,13,55,231,9,247,24,
14,231,15,245,216,226,37,1,237,22,251,225,13,254,0,7,252,16,189,12,66,220,24,248,18,241,233,19,0,211,249,4,3,243,13,35,5,13,33,10,27,23,0,249,245,43,182,36,244,2,5,248,6,223,11,240,242,251,249,253,17,222,27,240,11,247,15,33,225,8,240,7,250,249,63,201,239,11,255,20,210,34,226,6,9,19,28,247,5,232,248,233,254,31,237,240,251,241,238,0,26,18,37,251,241,254,17,5,229,21,223,44,12,229,247,17,11,25,235,225,249,13,33,248,231,249,7,246,4,250,247,48,174,233,248,6,11,233,3,253,49,227,25,31,4,14,16,9,252,238,10,
230,3,5,212,247,9,209,201,15,9,28,1,4,253,46,6,250,218,227,225,241,250,3,0,14,250,8,202,206,33,251,1,242,33,208,26,252,251,253,251,253,251,228,234,77,55,255,2,10,10,247,242,190,207,11,220,250,236,10,246,16,12,4,255,240,45,212,206,31,254,25,42,23,224,234,0,11,20,216,221,216,220,224,230,235,243,52,234,6,232,236,17,251,248,36,231,245,21,230,6,34,248,7,20,253,5,231,248,18,251,247,252,1,247,20,20,39,48,232,9,5,191,22,29,4,3,213,245,32,250,9,19,229,246,209,242,24,10,249,220,249,255,252,251,251,16,53,25,
230,227,252,244,45,198,222,33,251,2,255,27,208,31,241,22,251,4,7,7,231,253,11,234,16,244,8,253,7,245,45,14,183,237,56,210,24,236,28,244,254,255,220,253,223,19,250,7,2,241,5,225,211,8,35,13,20,0,247,48,243,213,253,243,2,251,72,188,229,2,1,254,249,5,36,33,216,244,252,251,23,19,1,5,241,49,190,208,252,50,212,7,37,16,238,25,230,230,241,19,19,229,209,28,57,5,239,224,215,68,21,254,64,56,8,240,243,230,247,240,11,6,217,25,237,22,225,20,211,55,213,10,240,47,216,40,236,205,3,239,242,241,232,53,236,210,46,27,
188,32,3,238,251,9,225,16,247,246,255,233,48,95,47,25,215,224,253,15,231,201,36,41,229,20,5,13,14,234,5,2,233,18,46,241,17,238,222,251,248,27,201,73,16,2,255,239,40,178,33,0,2,19,4,53,240,241,240,228,253,243,49,8,249,227,27,243,32,20,32,195,16,14,41,44,40,24,20,7,4,48,196,179,17,250,208,65,241,32,226,185,246,253,250,10,254,249,227,200,67,226,7,251,86,250,246,0,5,225,60,34,218,253,24,10,254,30,23,24,215,12,70,213,15,239,6,13,16,243,8,30,241,248,5,23,222,158,252,243,13,208,225,70,12,31,25,24,232,26,
249,33,240,8,5,245,242,248,191,13,10,254,247,0,253,188,5,35,7,0,225,255,239,247,247,16,219,238,255,69,208,228,22,235,245,5,49,55,23,170,220,16,2,13,63,205,30,245,13,24,238,250,14,237,1,41,9,251,27,220,212,222,219,235,230,31,217,15,43,5,248,29,20,248,236,204,228,255,13,26,222,246,247,27,248,8,27,190,4,12,234,49,10,179,32,238,3,218,12,253,255,2,2,0,248,219,5,213,5,73,61,39,12,253,195,224,2,42,30,253,17,229,9,34,20,255,251,2,23,249,210,26,53,209,20,254,223,167,205,192,27,11,15,222,251,200,25,247,255,
227,1,40,67,233,240,16,33,19,7,14,85,22,246,246,244,249,255,52,89,29,11,236,219,210,241,17,232,228,24,2,1,0,23,155,23,14,255,233,238,9,5,243,38,1,228,228,4,27,51,230,34,216,35,47,54,38,202,230,250,42,231,13,226,220,18,41,252,223,23,224,249,252,51,253,17,204,56,209,36,254,235,36,10,8,223,31,19,9,251,216,10,247,235,19,18,178,238,251,0,230,220,209,205,212,18,40,27,254,29,49,230,2,32,202,30,183,54,3,251,36,22,53,10,255,172,203,227,251,3,212,53,205,4,22,71,221,255,33,251,229,249,36,17,233,217,16,247,201,
241,236,39,221,6,217,242,18,48,192,239,241,9,39,81,37,188,37,47,235,250,152,13,6,9,254,35,8,233,18,42,45,21,33,251,207,9,250,213,200,39,2,240,231,87,1,253,247,17,231,245,247,255,10,2,242,242,4,255,246,28,233,40,224,26,247,26,4,229,233,3,42,196,1,49,253,27,10,204,216,254,18,45,233,17,212,3,253,17,210,52,216,209,25,75,31,207,53,30,226,224,220,38,250,241,240,54,229,208,3,38,227,224,234,242,252,233,243,32,217,9,8,211,243,34,240,49,40,32,31,28,23,23,32,47,59,188,8,62,44,25,242,232,191,240,36,67,231,218,
235,4,223,254,42,5,193,40,11,26,214,233,195,79,225,23,236,10,224,53,231,220,10,230,251,3,0,185,5,246,219,1,232,21,202,239,1,227,231,241,229,32,68,45,240,219,238,251,1,0,179,71,250,3,236,71,189,29,221,10,226,19,4,16,17,5,0,242,19,2,28,26,59,3,2,24,39,55,206,211,238,239,33,221,14,255,1,8,87,221,227,0,229,13,249,23,243,37,216,50,221,14,19,249,242,49,54,251,22,254,227,248,229,38,13,27,48,12,215,235,241,28,7,240,232,237,236,11,236,9,2,13,23,236,11,27,229,71,187,8,2,250,22,12,16,16,9,240,248,239,1,25,1,
40,219,223,66,94,53,4,234,231,215,214,25,35,240,241,57,31,227,224,21,16,196,45,15,255,7,57,230,209,227,11,8,15,19,151,248,54,27,10,239,6,244,255,246,4,0,23,246,31,13,11,10,12,192,23,253,248,237,16,52,24,216,16,10,40,5,9,0,243,249,235,248,250,249,235,59,16,203,18,196,11,209,14,238,25,243,232,4,217,16,228,54,26,189,30,27,236,204,20,244,55,12,18,240,39,242,250,230,56,168,201,12,25,26,219,6,75,0,222,175,54,226,1,249,49,233,242,21,10,194,198,199,209,222,15,252,34,178,31,25,245,7,50,246,42,193,14,220,252,
57,55,57,53,42,214,255,15,40,37,15,25,245,6,1,31,254,250,255,249,192,34,28,30,255,3,21,0,168,244,200,25,228,40,8,228,242,9,12,2,250,239,22,49,250,230,14,28,236,4,244,50,35,40,13,218,198,227,17,30,22,60,26,202,217,244,58,228,193,10,235,248,244,26,194,6,246,245,234,250,249,4,1,18,2,186,11,14,4,13,19,232,222,24,67,17,51,235,13,23,54,226,48,1,243,80,26,240,254,13,252,6,226,29,232,73,198,30,229,20,254,235,41,45,30,229,253,251,238,236,207,253,221,10,42,237,189,203,245,9,13,241,223,205,226,15,7,25,226,4,
28,234,222,54,227,39,210,20,16,34,252,47,75,1,212,201,232,7,255,9,214,50,248,220,41,68,0,252,246,233,241,206,64,36,247,229,12,25,218,209,219,32,207,51,220,2,252,69,230,19,7,45,67,46,13,193,46,15,209,4,215,13,250,5,235,37,26,201,249,33,255,228,10,239,192,242,0,220,239,93,253,247,190,44,235,3,244,38,250,243,244,19,13,43,213,246,244,6,251,9,207,32,251,2,4,5,15,240,10,235,8,194,248,64,8,79,255,190,207,238,5,40,251,226,211,1,250,21,224,93,238,226,235,32,21,238,22,8,5,215,202,80,22,246,249,248,233,192,
66,56,242,226,215,210,242,227,219,27,242,42,254,247,227,34,14,33,242,22,4,10,26,26,28,32,23,184,224,3,0,242,35,214,178,224,6,29,238,211,251,7,223,211,253,234,222,8,248,4,205,231,247,59,178,21,251,231,208,66,241,239,232,207,243,25,233,192,250,40,232,237,245,57,223,248,1,10,204,202,28,39,49,34,245,195,215,213,10,15,241,51,30,15,205,32,222,254,222,14,18,16,1,1,253,253,1,1,238,6,16,48,12,251,214,7,36,48,7,236,246,7,12,2,54,39,218,37,54,4,245,248,210,246,5,246,222,46,244,29,219,39,36,245,24,56,17,14,20,
25,0,231,228,55,249,251,27,3,9,230,248,6,232,246,226,225,222,18,4,22,21,40,255,227,219,248,235,92,227,11,253,11,73,23,22,7,4,212,247,245,21,243,11,9,178,255,47,114,244,219,237,251,245,234,19,12,226,7,38,45,235,248,247,55,211,56,235,7,17,46,199,169,250,27,31,31,7,200,244,46,21,251,244,36,3,3,235,43,19,12,249,9,242,0,247,223,165,7,26,3,245,64,83,225,210,25,2,9,5,2,2,255,20,239,10,251,229,248,20,8,237,16,235,243,225,5,5,42,24,9,34,236,28,195,22,11,217,64,236,255,226,247,236,24,231,232,227,22,196,6,251,
41,247,169,14,34,15,199,52,69,15,253,154,58,16,3,6,60,181,224,26,7,199,229,224,232,235,227,240,62,210,31,30,229,241,7,15,12,32,25,46,36,33,9,14,253,6,1,248,0,246,251,249,249,249,251,251,31,229,24,224,252,10,245,21,253,19,23,247,22,24,246,255,246,243,249,245,42,223,31,19,248,0,246,240,1,235,239,10,248,14,8,4,11,254,5,254,223,11,240,33,11,252,9,252,11,2,6,251,8,251,11,252,250,26,220,240,0,4,254,248,12,6,255,34,210,234,9,9,21,9,5,190,251,26,2,10,13,2,19,9,12,175,3,13,13,0,242,22,221,6,249,252,6,250,
10,250,225,38,223,0,246,245,5,244,12,239,5,0,250,13,247,10,8,25,33,2,244,8,250,10,254,21,7,17,43,5,11,249,247,236,220,236,233,252,252,253,27,247,247,207,217,218,245,247,6,5,23,25,5,3,3,4,1,2,253,255,87,39,17,235,247,237,247,241,243,242,239,245,246,245,248,250,255,253,253,255,202,222,229,248,245,252,251,0,0,4,8,6,9,7,9,7,6,5,5,5,48,10,19,246,12,255,9,253,2,5,253,2,254,254,0,254,230,6,9,249,240,247,2,7,7,251,213,11,22,245,247,34,37,241,243,250,1,255,1,1,192,56,52,245,229,5,4,3,1,2,1,3,255,252,252,246,
249,252,252,2,255,249,249,244,246,241,247,251,251,245,240,243,6,16,4,243,240,246,252,2,209,243,25,47,19,242,236,248,239,0,253,243,1,6,239,242,15,1,10,6,232,0,246,19,187,248,14,49,17,251,33,227,3,252,0,2,248,5,250,2,120,200,244,209,23,247,6,251,1,2,251,1,246,4,255,255,4,255,0,253,30,204,189,30,22,11,255,252,3,0,7,2,0,1,246,252,248,243,5,1,1,255,5,13,247,253,246,194,22,48,252,250,2,3,5,1,1,4,1,13,3,236,10,247,13,254,252,9,236,44,255,20,224,189,19,0,28,11,8,2,245,15,237,203,31,2,34,10,6,252,198,8,10,
13,14,1,12,2,0,0,128,37,248,44,247,26,253,18,2,6,11,255,9,1,5,3,0,1,1,2,12,3,254,253,7,25,9,18,250,219,3,248,240,3,246,249,17,222,212,11,17,241,253,240,255,243,11,210,191,254,8,13,2,4,4,5,15,5,9,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,247,19,244,12,228,38,29,255,12,2,5,23,246,3,4,241,21,252,3,3,6,17,247,252,248,236,26,5,246,6,1,237,18,241,244,47,250,254,249,247,255,239,254,254,242,30,242,2,249,252,255,244,11,231,16,253,244,11,249,7,239,1,19,228,31,249,246,7,246,3,12,5,240,6,24,41,227,202,0,1,7,
255,5,250,13,10,252,248,8,247,229,203,218,255,10,19,17,16,12,12,0,3,249,252,13,12,225,242,6,251,3,5,17,43,50,25,10,1,250,254,7,17,17,27,25,22,12,4,253,0,28,220,39,232,241,3,247,15,251,10,31,228,11,31,235,9,245,245,254,249,231,14,234,31,4,242,19,244,14,251].concat([4,249,4,251,9,0,254,42,209,240,1,8,0,9,23,199,0,28,245,6,225,55,211,3,251,4,2,254,4,249,253,6,254,7,253,12,5,8,54,246,8,249,248,232,231,229,242,251,8,5,44,23,5,247,245,245,243,247,244,248,227,248,234,6,241,3,244,255,251,253,34,255,29,240,
17,252,12,2,1,4,254,252,2,255,11,253,204,28,30,247,224,25,44,236,232,4,6,255,0,0,0,0,0,0,0,0,0,0,0,0,231,246,22,29,13,243,234,243,252,0,252,240,10,15,220,232,28,25,255,253,66,223,245,241,6,0,3,4,254,5,24,236,209,29,19,254,252,255,0,255,254,3,1,8,245,5,5,199,28,28,0,240,4,252,12,250,255,2,236,61,247,24,234,214,29,6,17,8,4,2,191,15,8,10,5,6,5,3,2,254,253,5,247,4,251,23,13,23,253,193,3,251,252,250,0,253,23,220,210,9,5,5,8,4,9,251,1,253,10,1,250,10,245,24,209,31,22,244,14,246,6,11,249,249,7,225,51,244,
250,7,6,239,9,245,236,52,237,3,250,250,248,251,23,215,37,1,235,10,242,8,7,5,241,241,23,39,230,223,7,2,224,226,235,248,4,12,17,15,14,11,22,39,14,44,11,35,254,23,252,6,46,228,13,229,233,12,4,20,251,9,37,238,233,23,0,9,250,236,4,255,239,251,252,17,0,1,9,254,1,2,2,244,8,231,39,15,9,16,201,245,9,11,5,10,254,196,8,13,250,11,240,27,209,244,11,1,16,249,9,253,227,9,242,25,237,34,36,12,40,246,253,232,242,219,235,221,254,220,3,250,67,28,6,239,253,244,240,241,239,249,197,220,243,1,7,1,2,10,2,11,13,10,8,254,7,
3,5,4,2,2,253,248,4,251,6,7,214,15,35,254,210,38,28,236,247,1,7,253,0,254,0,0,0,0,0,0,0,0,0,0,241,228,52,32,5,251,239,236,246,255,215,163,144,62,162,69,182,62,203,161,229,62,0,0,0,0,0,0,128,62,174,71,161,62,150,67,203,62,0,0,0,63,250,53,235,232,4,26,17,252,219,25,17,220,243,31,3,250,27,15,246,31,28,26,246,246,216,16,249,15,13,41,247,0,252,50,250,249,14,38,22,0,208,2,1,243,237,32,253,196,11,239,255,232,222,255,35,251,229,28,44,13,25,15,42,245,15,51,35,220,20,8,252,244,227,19,209,49,241,252,16,227,
217,14,226,4,25,247,251,205,242,253,216,224,38,5,247,248,252,255,234,71,253,14,26,238,234,24,215,231,232,6,23,19,246,39,230,229,65,45,2,249,230,248,22,244,16,15,16,221,251,33,235,248,0,23,33,34,6,21,36,6,249,234,8,219,242,31,38,11,252,253,217,224,248,32,233,250,244,16,20,228,252,23,13,204,255,22,6,223,216,250,4,194,13,5,230,35,39,11,2,57,245,9,236,228,223,52,251,250,254,22,242,240,208,35,1,198,20,13,33,255,182,56,238,234,225,12,6,242,4,254,247,209,10,253,29,239,251,61,14,47,244,2,72,217,239,92,64,
203,205,241,226,218,215,227,228,27,9,36,9,221,214,81,235,20,25,240,251,239,221,21,15,228,48,2,254,9,237,29,216,30,238,238,18,240,199,15,236,244,241,219,241,33,217,21,234,243,35,11,13,218,193,29,23,229,32,18,3,230,42,33,192,190,239,16,56,2,36,3,31,21,215,217,8,199,14,37,254,19,220,237,233,227,240,1,253,248,246,31,64,191,222,204,241,45,2,23,21,52,24,223,247,255,9,212,215,243,239,44,22,239,250,252,255,22,38,26,16,2,50,27,221,222,247,215,6,0,240,222,51,8,242,225,207,15,223,45,49,33,245,219,194,202,45,
11,251,184,11,255,244,245,24,27,245,213,46,43,33,244,247,255,1,252,233,199,185,11,8,16,17,248,236,225,215,53,48,240,3,65,232,248,233,224,219,224,207,246,239,6,38,5,247,239,210,8,52,3,6,45,40,39,249,250,222,182,31,8,1,240,43,68,245,237,225,4,6,0,250,239,240,218,240,226,2,9,217,240,255,43,246,48,3,3,240,225,253,62,68,43,13,3,246,8,20,200,12,12,254,238,22,241,216,220,1,7,41,0,1,46,250,194,252,244,254,245,173,243,254,91,33,246,0,4,245,240,79,32,37,14,9,51,235,228,200,222,0,21,9,230,11,28,214,202,233,
254,241,31,30,8,217,190,217,220,31,228,216,210,35,40,22,24,33,48,23,222,14,40,32,17,27,253,25,26,243,195,239,11,4,31,60,250,230,215,192,13,16,230,54,31,245,233,247,245,222,185,235,222,221,55,50,29,234,229,206,218,57,33,42,57,48,26,11,0,207,225,26,252,242,5,78,37,17,0,207,244,233,26,14,2,2,213,239,244,10,248,252,8,18,12,250,20,244,250,243,231,34,15,40,49,7,8,13,20,20,237,234,254,248,2,51,205,11,47,16,247,210,224,26,192,34,251,38,249,47,20,2,183,157,253,211,20,70,204,15,250,249,174,31,21,47,51,39,253,
9,0,215,249,241,202,2,0,27,225,9,211,234,218,232,232,8,223,23,5,50,220,239,238,205,254,13,19,43,12,241,244,61,38,38,7,13,0,6,255,3,62,9,27,22,223,38,221,247,30,213,247,224,255,4,252,1,251,245,248,38,31,11,246,214,235,219,1,43,15,243,221,237,238,15,23,230,59,1,235,53,8,215,206,242,228,4,21,25,228,216,5,216,215,4,51,223,248,248,1,17,196,12,25,215,17,34,43,19,45,7,219,24,241,56,254,35,246,48,4,209,254,5,251,202,5,253,223,246,30,254,212,232,218,9,247,42,4,6,200,44,240,9,216,230,18,236,10,28,215,235,252,
13,238,32,226,253,37,15,22,28,50,216,3,227,192,7,51,237,245,17,229,216,192,24,244,249,229,3,37,48,255,2,247,218,222,46,1,27,250,19,243,26,10,34,20,25,40,50,250,249,30,9,232,0,233,71,195,22,58,222,252,2,207,223,25,30,248,250,240,77,2,38,248,221,250,226,56,78,31,33,236,13,217,20,22,4,21,248,4,250,10,173,215,9,231,213,15,249,244,222,217,219,223,19,30,16,223,42,231,25,188,44,241,245,252,23,50,14,4,217,213,20,226,60,9,236,7,16,19,223,37,29,16,221,7,38,229,230,248,29,21,4,19,217,33,249,220,56,54,48,40,
29,252,232,214,190,213,196,19,254,37,41,246,219,196,192,18,234,77,73,40,25,4,19,237,190,254,11,5,21,14,26,231,170,252,18,1,26,219,10,37,255,24,244,197,245,20,250,34,240,240,42,19,228,205,53,32,4,10,62,21,244,222,27,4,208,208,206,207,31,249,235,214,231,252,213,234,59,2,27,12,247,250,240,248,224,198,240,227,251,41,23,226,223,210,243,246,218,52,52,1,239,247,10,26,231,250,33,236,53,55,25,224,251,214,23,21,66,5,228,20,9,75,29,249,214,217,15,3,233,21,6,11,1,227,14,63,10,54,26,232,205,207,7,233,205,15,190,
1,60,25,10,0,226,252,241,17,19,59,40,4,251,33,6,234,198,186,251,23,250,60,44,227,240,209,227,52,237,50,28,16,35,31,36,0,235,6,21,27,22,42,7,190,216,248,7,19,46,0,252,60,36,45,249,227,250,224,217,2,6,247,33,20,205,222,18,250,19,6,11,5,237,227,254,42,245,211,235,201,57,37,2,242,189,240,229,218,69,48,19,2,239,20,236,240,222,239,231,195,10,73,45,16,216,192,239,227,234,56,17,217,8,245,8,231,238,243,237,8,54,57,36,239,230,252,6,235,40,42,252,20,31,53,10,222,203,31,239,35,0,15,250,236,193,183,22,25,29,17,
8,227,217,187,18,15,241,251,30,19,38,34,40,32,46,43,58,43,5,238,231,216,223,201,204,20,34,28,236,193,159,164,61,53,47,49,53,75,242,203,179,177,0,253,251,19,22,26,247,203,201,66,90,72,85,68,74,52,252,215,198,225,238,225,27,32,30,18,24,3,8,5,244,253,26,28,74,63,254,217,189,179,150,182,59,59,73,65,44,40,71,72,82,83,98,88,89,60,250,225,209,208,243,217,247,7,2,79,255,217,196,239,87,81,65,50,45,19,235,189,165,169,215,206,7,18,39,74,10,225,228,39,24,13,23,5,56,45,29,10,251,243,245,221,238,248,246,248,231,
185,179,235,2,16,50,63,87,87,5,224,216,205,188,0,12,6,54,34,5,244,32,52,68,64,69,59,65,45,14,240,225,216,191,189,41,49,47,37,245,204,181,172,252,57,48,42,42,33,245,205,188,250,13,0,8,248,26,32,233,203,0,36,56,76,97,105,111,97,255,228,217,216,213,202,212,216,238,35,16,236,237,228,214,29,47,38,74,45,3,227,208,194,176,152,223,56,59,59,10,17,46,72,84,101,117,123,123,106,249,223,207,205,186,189,229,225,70,67,240,194,171,236,82,71,86,80,85,74,237,198,181,211,227,223,238,231,45,57,244,214,251,12,28,36,52,
64,81,82,13,247,229,228,22,3,2,22,26,6,250,212,205,2,15,10,48,43,49,34,237,194,172,167,154,232,8,17,61,68,39,24,23,19,16,251,12,15,27,15,248,212,207,196,238,224,228,52,54,62,248,208,179,186,66,101,83,63,61,37,244,206,181,192,33,17,13,25,15,77,1,214,227,72,64,46,49,31,61,44,248,209,202,210,226,19,20,255,240,0,16,244,238,247,230,229,246,234,53,45,246,209,181,174,151,147,8,25,49,77,50,65,114,117,124,118,115,96,90,61,247,211,193,196,181,199,8,11,20,29,0,221,207,213,40,47,35,40,55,38,232,180,153,144,229,
3,23,34,52,75,8,227,213,12,63,38,35,29,24,8,25,11,1,241,238,213,249,37,40,21,236,200,237,237,252,254,11,29,51,63,254,212,194,181,167,30,57,51,74,51,50,46,68,64,65,52,63,55,65,43,18,247,230,221,201,187,3,6,8,17,241,195,170,159,1,86,93,74,78,67,255,218,190,208,48,39,29,25,17,255,13,13,29,39,50,51,69,82,97,98,254,220,210,229,240,226,243,252,249,252,25,251,245,250,231,235,33,12,31,29,248,218,204,193,188,167,223,255,10,74,254,241,59,91,105,105,101,87,84,62,249,223,206,221,202,209,25,17,82,81,243,200,173,
21,58,31,42,25,72,65,232,190,165,200,9,254,21,10,69,75,2,232,11,22,25,28,38,34,48,33,7,227,230,17,15,255,14,0,254,0,250,215,189,6,254,247,19,2,85,74,234,189,172,185,206,3,11,247,2,62,0,0,128,63,25,4,118,63,172,28,90,63,33,176,50,63,121,233,6,63,127,106,188,62,33,176,114,62,78,98,16,62,45,178,157,61,119,190,31,61,119,97,114,110,105,110,103,58,32,37,115,32,37,100,10,0,110,97,114,114,111,119,98,97,110,100,0,0,0,0,0,0,85,110,107,110,111,119,110,32,110,98,95,99,116,108,32,114,101,113,117,101,115,116,58,
32,0,0,0,0,0,0,0,0,110,111,116,105,102,105,99,97,116,105,111,110,58,32,37,115,10,0,0,0,0,0,0,0,85,110,107,110,111,119,110,32,110,98,95,109,111,100,101,95,113,117,101,114,121,32,114,101,113,117,101,115,116,58,32,0,97,115,115,101,114,116,105,111,110,32,102,97,105,108,101,100,58,32,83,85,66,77,79,68,69,40,105,110,110,111,118,97,116,105,111,110,95,117,110,113,117,97,110,116,41,0,0,0,119,97,114,110,105,110,103,58,32,37,115,10,0,0,0,0,119,97,114,110,105,110,103,58,32,37,115,10,0,0,0,0,97,115,115,101,114,
116,105,111,110,32,102,97,105,108,101,100,58,32,83,85,66,77,79,68,69,40,108,116,112,95,117,110,113,117,97,110,116,41,0,0,110,111,116,105,102,105,99,97,116,105,111,110,58,32,37,115,10,0,0,0,0,0,0,0,68,111,32,110,111,116,32,111,119,110,32,105,110,112,117,116,32,98,117,102,102,101,114,58,32,110,111,116,32,112,97,99,107,105,110,103,0,0,0,0,73,110,118,97,108,105,100,32,109,111,100,101,32,101,110,99,111,117,110,116,101,114,101,100,46,32,84,104,101,32,115,116,114,101,97,109,32,105,115,32,99,111,114,114,
117,112,116,101,100,46,0,0,0,0,0,0,77,111,114,101,32,116,104,97,110,32,116,119,111,32,119,105,100,101,98,97,110,100,32,108,97,121,101,114,115,32,102,111,117,110,100,46,32,84,104,101,32,115,116,114,101,97,109,32,105,115,32,99,111,114,114,117,112,116,101,100,46,0,0,0,73,110,118,97,108,105,100,32,109,111,100,101,32,115,112,101,99,105,102,105,101,100,32,105,110,32,83,112,101,101,120,32,104,101,97,100,101,114,0,0,67,111,117,108,100,32,110,111,116,32,114,101,115,105,122,101,32,105,110,112,117,116,32,98,
117,102,102,101,114,58,32,110,111,116,32,112,97,99,107,105,110,103,0,0,0,0,0,0,119,97,114,110,105,110,103,58,32,37,115,32,37,100,10,0,73,110,118,97,108,105,100,32,109,111,100,101,32,101,110,99,111,117,110,116,101,114,101,100,46,32,84,104,101,32,115,116,114,101,97,109,32,105,115,32,99,111,114,114,117,112,116,101,100,46,0,0,0,0,0,0,83,112,101,101,120,32,104,101,97,100,101,114,32,116,111,111,32,115,109,97,108,108,0,0,66,117,102,102,101,114,32,116,111,111,32,115,109,97,108,108,32,116,111,32,112,97,99,
107,32,98,105,116,115,0,0,0,85,110,107,110,111,119,110,32,119,98,95,109,111,100,101,95,113,117,101,114,121,32,114,101,113,117,101,115,116,58,32,0,110,111,116,105,102,105,99,97,116,105,111,110,58,32,37,115,10,0,0,0,0,0,0,0,97,115,115,101,114,116,105,111,110,32,102,97,105,108,101,100,58,32,83,85,66,77,79,68,69,40,105,110,110,111,118,97,116,105,111,110,95,113,117,97,110,116,41,0,0,0,0,0,119,97,114,110,105,110,103,58,32,37,115,32,37,100,10,0,84,104,105,115,32,100,111,101,115,110,39,116,32,108,111,111,
107,32,108,105,107,101,32,97,32,83,112,101,101,120,32,102,105,108,101,0,0,0,0,0,67,111,117,108,100,32,110,111,116,32,114,101,115,105,122,101,32,105,110,112,117,116,32,98,117,102,102,101,114,58,32,116,114,117,110,99,97,116,105,110,103,32,111,118,101,114,115,105,122,101,32,105,110,112,117,116,0,0,0,0,0,0,0,0,49,46,50,114,99,49,0,0,119,97,114,110,105,110,103,58,32,37,115,32,37,100,10,0,97,115,115,101,114,116,105,111,110,32,102,97,105,108,101,100,58,32,83,85,66,77,79,68,69,40,108,116,112,95,113,117,97,
110,116,41,0,0,0,0,105,110,32,117,115,101,32,98,121,116,101,115,32,32,32,32,32,61,32,37,49,48,108,117,10,0,0,0,0,0,0,0,117,108,116,114,97,45,119,105,100,101,98,97,110,100,32,40,115,117,98,45,98,97,110,100,32,67,69,76,80,41,0,0,84,104,105,115,32,109,111,100,101,32,105,115,32,109,101,97,110,116,32,116,111,32,98,101,32,117,115,101,100,32,97,108,111,110,101,0,0,0,0,0,68,111,32,110,111,116,32,111,119,110,32,105,110,112,117,116,32,98,117,102,102,101,114,58,32,116,114,117,110,99,97,116,105,110,103,32,111,
118,101,114,115,105,122,101,32,105,110,112,117,116,0,0,0,0,0,0,85,110,107,110,111,119,110,32,110,98,95,99,116,108,32,114,101,113,117,101,115,116,58,32,0,0,0,0,0,0,0,0,97,115,115,101,114,116,105,111,110,32,102,97,105,108,101,100,58,32,115,116,45,62,119,105,110,100,111,119,83,105,122,101,45,115,116,45,62,102,114,97,109,101,83,105,122,101,32,61,61,32,115,116,45,62,115,117,98,102,114,97,109,101,83,105,122,101,0,0,0,0,0,0,109,97,120,32,115,121,115,116,101,109,32,98,121,116,101,115,32,61,32,37,49,48,108,
117,10,0,0,0,0,0,0,0,110,98,95,99,101,108,112,46,99,0,0,0,0,0,0,0,115,121,115,116,101,109,32,98,121,116,101,115,32,32,32,32,32,61,32,37,49,48,108,117,10,0,0,0,0,0,0,0,85,110,107,110,111,119,110,32,119,98,95,109,111,100,101,95,113,117,101,114,121,32,114,101,113,117,101,115,116,58,32,0,70,97,116,97,108,32,40,105,110,116,101,114,110,97,108,41,32,101,114,114,111,114,32,105,110,32,37,115,44,32,108,105,110,101,32,37,100,58,32,37,115,10,0,0,0,0,0,0,110,111,116,105,102,105,99,97,116,105,111,110,58,32,37,
115,10,0,0,0,0,0,0,0,83,112,101,101,120,32,32,32,0,0,0,0,0,0,0,0,119,105,100,101,98,97,110,100,32,40,115,117,98,45,98,97,110,100,32,67,69,76,80,41,0,0,0,0,0,0,0,0,67,111,117,108,100,32,110,111,116,32,114,101,115,105,122,101,32,105,110,112,117,116,32,98,117,102,102,101,114,58,32,116,114,117,110,99,97,116,105,110,103,32,105,110,112,117,116,0,80,97,99,107,101,116,32,105,115,32,108,97,114,103,101,114,32,116,104,97,110,32,97,108,108,111,99,97,116,101,100,32,98,117,102,102,101,114,0,0]),"i8",ALLOC_NONE,
Runtime.GLOBAL_BASE);var tempDoublePtr=Runtime.alignMemory(allocate(12,"i8",ALLOC_STATIC),8);assert(0==tempDoublePtr%8);function copyTempFloat(a){HEAP8[tempDoublePtr]=HEAP8[a];HEAP8[tempDoublePtr+1]=HEAP8[a+1];HEAP8[tempDoublePtr+2]=HEAP8[a+2];HEAP8[tempDoublePtr+3]=HEAP8[a+3]}
function copyTempDouble(a){HEAP8[tempDoublePtr]=HEAP8[a];HEAP8[tempDoublePtr+1]=HEAP8[a+1];HEAP8[tempDoublePtr+2]=HEAP8[a+2];HEAP8[tempDoublePtr+3]=HEAP8[a+3];HEAP8[tempDoublePtr+4]=HEAP8[a+4];HEAP8[tempDoublePtr+5]=HEAP8[a+5];HEAP8[tempDoublePtr+6]=HEAP8[a+6];HEAP8[tempDoublePtr+7]=HEAP8[a+7]}Module._memcpy=_memcpy;
var _llvm_memmove_p0i8_p0i8_i32=Module._memmove=_memmove,ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,
EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,
ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86},ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",
3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",
26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",
46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",
67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",
83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",
101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",
125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"},___errno_state=0;function ___setErrNo(a){return HEAP32[___errno_state>>2]=a}
var PATH={splitPath:function(a){return/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(a).slice(1)},normalizeArray:function(a,c){for(var d=0,g=a.length-1;0<=g;g--){var h=a[g];"."===h?a.splice(g,1):".."===h?(a.splice(g,1),d++):d&&(a.splice(g,1),d--)}if(c)for(;d--;d)a.unshift("..");return a},normalize:function(a){var c="/"===a.charAt(0),d="/"===a.substr(-1);(a=PATH.normalizeArray(a.split("/").filter(function(a){return!!a}),!c).join("/"))||c||(a=".");a&&d&&(a+="/");return(c?"/":"")+
a},dirname:function(a){var c=PATH.splitPath(a);a=c[0];c=c[1];if(!a&&!c)return".";c&&(c=c.substr(0,c.length-1));return a+c},basename:function(a){if("/"===a)return"/";var c=a.lastIndexOf("/");return-1===c?a:a.substr(c+1)},extname:function(a){return PATH.splitPath(a)[3]},join:function(){var a=Array.prototype.slice.call(arguments,0);return PATH.normalize(a.join("/"))},join2:function(a,c){return PATH.normalize(a+"/"+c)},resolve:function(){for(var a="",c=!1,d=arguments.length-1;-1<=d&&!c;d--){var g=0<=
d?arguments[d]:FS.cwd();if("string"!==typeof g)throw new TypeError("Arguments to path.resolve must be strings");g&&(a=g+"/"+a,c="/"===g.charAt(0))}a=PATH.normalizeArray(a.split("/").filter(function(a){return!!a}),!c).join("/");return(c?"/":"")+a||"."},relative:function(a,c){function d(a){for(var c=0;c<a.length&&""===a[c];c++);for(var d=a.length-1;0<=d&&""===a[d];d--);return c>d?[]:a.slice(c,d-c+1)}a=PATH.resolve(a).substr(1);c=PATH.resolve(c).substr(1);for(var g=d(a.split("/")),h=d(c.split("/")),
l=Math.min(g.length,h.length),p=l,x=0;x<l;x++)if(g[x]!==h[x]){p=x;break}l=[];for(x=p;x<g.length;x++)l.push("..");l=l.concat(h.slice(p));return l.join("/")}},TTY={ttys:[],init:function(){},shutdown:function(){},register:function(a,c){TTY.ttys[a]={input:[],output:[],ops:c};FS.registerDevice(a,TTY.stream_ops)},stream_ops:{open:function(a){var c=TTY.ttys[a.node.rdev];if(!c)throw new FS.ErrnoError(ERRNO_CODES.ENODEV);a.tty=c;a.seekable=!1},close:function(a){a.tty.output.length&&a.tty.ops.put_char(a.tty,
10)},read:function(a,c,d,g,h){if(!a.tty||!a.tty.ops.get_char)throw new FS.ErrnoError(ERRNO_CODES.ENXIO);for(var l=h=0;l<g;l++){var p;try{p=a.tty.ops.get_char(a.tty)}catch(x){throw new FS.ErrnoError(ERRNO_CODES.EIO);}if(void 0===p&&0===h)throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);if(null===p||void 0===p)break;h++;c[d+l]=p}h&&(a.node.timestamp=Date.now());return h},write:function(a,c,d,g,h){if(!a.tty||!a.tty.ops.put_char)throw new FS.ErrnoError(ERRNO_CODES.ENXIO);for(h=0;h<g;h++)try{a.tty.ops.put_char(a.tty,
c[d+h])}catch(l){throw new FS.ErrnoError(ERRNO_CODES.EIO);}g&&(a.node.timestamp=Date.now());return h}},default_tty_ops:{get_char:function(a){if(!a.input.length){var c=null;if(ENVIRONMENT_IS_NODE){if(c=process.stdin.read(),!c){if(process.stdin._readableState&&process.stdin._readableState.ended)return null;return}}else"undefined"!=typeof window&&"function"==typeof window.prompt?(c=window.prompt("Input: "),null!==c&&(c+="\n")):"function"==typeof readline&&(c=readline(),null!==c&&(c+="\n"));if(!c)return null;
a.input=intArrayFromString(c,!0)}return a.input.shift()},put_char:function(a,c){null===c||10===c?(Module.print(a.output.join("")),a.output=[]):a.output.push(TTY.utf8.processCChar(c))}},default_tty1_ops:{put_char:function(a,c){null===c||10===c?(Module.printErr(a.output.join("")),a.output=[]):a.output.push(TTY.utf8.processCChar(c))}}},MEMFS={ops_table:null,CONTENT_OWNING:1,CONTENT_FLEXIBLE:2,CONTENT_FIXED:3,mount:function(a){return MEMFS.createNode(null,"/",16895,0)},createNode:function(a,c,d,g){if(FS.isBlkdev(d)||
FS.isFIFO(d))throw new FS.ErrnoError(ERRNO_CODES.EPERM);MEMFS.ops_table||(MEMFS.ops_table={dir:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,lookup:MEMFS.node_ops.lookup,mknod:MEMFS.node_ops.mknod,mknod:MEMFS.node_ops.mknod,rename:MEMFS.node_ops.rename,unlink:MEMFS.node_ops.unlink,rmdir:MEMFS.node_ops.rmdir,readdir:MEMFS.node_ops.readdir,symlink:MEMFS.node_ops.symlink},stream:{llseek:MEMFS.stream_ops.llseek}},file:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},
stream:{llseek:MEMFS.stream_ops.llseek,read:MEMFS.stream_ops.read,write:MEMFS.stream_ops.write,allocate:MEMFS.stream_ops.allocate,mmap:MEMFS.stream_ops.mmap}},link:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,readlink:MEMFS.node_ops.readlink},stream:{}},chrdev:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:FS.chrdev_stream_ops}});d=FS.createNode(a,c,d,g);FS.isDir(d.mode)?(d.node_ops=MEMFS.ops_table.dir.node,d.stream_ops=MEMFS.ops_table.dir.stream,
d.contents={}):FS.isFile(d.mode)?(d.node_ops=MEMFS.ops_table.file.node,d.stream_ops=MEMFS.ops_table.file.stream,d.contents=[],d.contentMode=MEMFS.CONTENT_FLEXIBLE):FS.isLink(d.mode)?(d.node_ops=MEMFS.ops_table.link.node,d.stream_ops=MEMFS.ops_table.link.stream):FS.isChrdev(d.mode)&&(d.node_ops=MEMFS.ops_table.chrdev.node,d.stream_ops=MEMFS.ops_table.chrdev.stream);d.timestamp=Date.now();a&&(a.contents[c]=d);return d},ensureFlexible:function(a){a.contentMode!==MEMFS.CONTENT_FLEXIBLE&&(a.contents=Array.prototype.slice.call(a.contents),
a.contentMode=MEMFS.CONTENT_FLEXIBLE)},node_ops:{getattr:function(a){var c={};c.dev=FS.isChrdev(a.mode)?a.id:1;c.ino=a.id;c.mode=a.mode;c.nlink=1;c.uid=0;c.gid=0;c.rdev=a.rdev;FS.isDir(a.mode)?c.size=4096:FS.isFile(a.mode)?c.size=a.contents.length:FS.isLink(a.mode)?c.size=a.link.length:c.size=0;c.atime=new Date(a.timestamp);c.mtime=new Date(a.timestamp);c.ctime=new Date(a.timestamp);c.blksize=4096;c.blocks=Math.ceil(c.size/c.blksize);return c},setattr:function(a,c){void 0!==c.mode&&(a.mode=c.mode);
void 0!==c.timestamp&&(a.timestamp=c.timestamp);if(void 0!==c.size){MEMFS.ensureFlexible(a);var d=a.contents;if(c.size<d.length)d.length=c.size;else for(;c.size>d.length;)d.push(0)}},lookup:function(a,c){throw FS.genericErrors[ERRNO_CODES.ENOENT];},mknod:function(a,c,d,g){return MEMFS.createNode(a,c,d,g)},rename:function(a,c,d){if(FS.isDir(a.mode)){var g;try{g=FS.lookupNode(c,d)}catch(h){}if(g)for(var l in g.contents)throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);}delete a.parent.contents[a.name];
a.name=d;c.contents[d]=a;a.parent=c},unlink:function(a,c){delete a.contents[c]},rmdir:function(a,c){var d=FS.lookupNode(a,c),g;for(g in d.contents)throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);delete a.contents[c]},readdir:function(a){var c=[".",".."],d;for(d in a.contents)a.contents.hasOwnProperty(d)&&c.push(d);return c},symlink:function(a,c,d){a=MEMFS.createNode(a,c,41471,0);a.link=d;return a},readlink:function(a){if(!FS.isLink(a.mode))throw new FS.ErrnoError(ERRNO_CODES.EINVAL);return a.link}},
stream_ops:{read:function(a,c,d,g,h){a=a.node.contents;if(h>=a.length)return 0;g=Math.min(a.length-h,g);assert(0<=g);if(8<g&&a.subarray)c.set(a.subarray(h,h+g),d);else for(var l=0;l<g;l++)c[d+l]=a[h+l];return g},write:function(a,c,d,g,h,l){var p=a.node;p.timestamp=Date.now();a=p.contents;if(g&&0===a.length&&0===h&&c.subarray)return l&&0===d?(p.contents=c,p.contentMode=c.buffer===HEAP8.buffer?MEMFS.CONTENT_OWNING:MEMFS.CONTENT_FIXED):(p.contents=new Uint8Array(c.subarray(d,d+g)),p.contentMode=MEMFS.CONTENT_FIXED),
g;MEMFS.ensureFlexible(p);for(a=p.contents;a.length<h;)a.push(0);for(l=0;l<g;l++)a[h+l]=c[d+l];return g},llseek:function(a,c,d){1===d?c+=a.position:2===d&&FS.isFile(a.node.mode)&&(c+=a.node.contents.length);if(0>c)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);a.ungotten=[];return a.position=c},allocate:function(a,c,d){MEMFS.ensureFlexible(a.node);a=a.node.contents;for(c+=d;c>a.length;)a.push(0)},mmap:function(a,c,d,g,h,l,p){if(!FS.isFile(a.node.mode))throw new FS.ErrnoError(ERRNO_CODES.ENODEV);a=a.node.contents;
if(p&2||a.buffer!==c&&a.buffer!==c.buffer){if(0<h||h+g<a.length)a=a.subarray?a.subarray(h,h+g):Array.prototype.slice.call(a,h,h+g);h=!0;g=_malloc(g);if(!g)throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);c.set(a,g)}else h=!1,g=a.byteOffset;return{ptr:g,allocated:h}}}},IDBFS={dbs:{},indexedDB:function(){return window.indexedDB||window.mozIndexedDB||window.webkitIndexedDB||window.msIndexedDB},DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",mount:function(a){return MEMFS.mount.apply(null,arguments)},syncfs:function(a,
c,d){IDBFS.getLocalSet(a,function(g,h){if(g)return d(g);IDBFS.getRemoteSet(a,function(a,g){if(a)return d(a);IDBFS.reconcile(c?g:h,c?h:g,d)})})},reconcile:function(a,c,d){function g(a){if(a)return d(a);if(++N>=h)return d(null)}var h=0,l={},p;for(p in a.files)if(a.files.hasOwnProperty(p)){var x=a.files[p],w=c.files[p];if(!w||x.timestamp>w.timestamp)l[p]=x,h++}var P={};for(p in c.files)c.files.hasOwnProperty(p)&&(x=c.files[p],w=a.files[p],w||(P[p]=x,h++));if(!h)return d(null);var N=0;a=("remote"===a.type?
a.db:c.db).transaction([IDBFS.DB_STORE_NAME],"readwrite");a.onerror=function(){d(this.error)};a=a.objectStore(IDBFS.DB_STORE_NAME);for(var R in l)if(l.hasOwnProperty(R))if(p=l[R],"local"===c.type)try{if(FS.isDir(p.mode))FS.mkdir(R,p.mode);else if(FS.isFile(p.mode)){var I=FS.open(R,"w+",438);FS.write(I,p.contents,0,p.contents.length,0,!0);FS.close(I)}g(null)}catch(fa){return g(fa)}else p=a.put(p,R),p.onsuccess=function(){g(null)},p.onerror=function(){g(this.error)};for(R in P)if(P.hasOwnProperty(R))if(p=
P[R],"local"===c.type)try{FS.isDir(p.mode)?FS.rmdir(R):FS.isFile(p.mode)&&FS.unlink(R),g(null)}catch(pa){return g(pa)}else p=a.delete(R),p.onsuccess=function(){g(null)},p.onerror=function(){g(this.error)}},getLocalSet:function(a,c){function d(a){return"."!==a&&".."!==a}function g(a){return function(c){return PATH.join2(a,c)}}for(var h={},l=FS.readdir(a.mountpoint).filter(d).map(g(a.mountpoint));l.length;){var p=l.pop(),x,w;try{w=FS.lookupPath(p).node,x=FS.stat(p)}catch(P){return c(P)}if(FS.isDir(x.mode))l.push.apply(l,
FS.readdir(p).filter(d).map(g(p))),h[p]={mode:x.mode,timestamp:x.mtime};else if(FS.isFile(x.mode))h[p]={contents:w.contents,mode:x.mode,timestamp:x.mtime};else return c(Error("node type not supported"))}return c(null,{type:"local",files:h})},getDB:function(a,c){var d=IDBFS.dbs[a];if(d)return c(null,d);var g;try{g=IDBFS.indexedDB().open(a,IDBFS.DB_VERSION)}catch(h){return onerror(h)}g.onupgradeneeded=function(){d=g.result;d.createObjectStore(IDBFS.DB_STORE_NAME)};g.onsuccess=function(){d=g.result;
IDBFS.dbs[a]=d;c(null,d)};g.onerror=function(){c(this.error)}},getRemoteSet:function(a,c){var d={};IDBFS.getDB(a.mountpoint,function(a,h){if(a)return c(a);var l=h.transaction([IDBFS.DB_STORE_NAME],"readonly");l.onerror=function(){c(this.error)};l.objectStore(IDBFS.DB_STORE_NAME).openCursor().onsuccess=function(a){a=a.target.result;if(!a)return c(null,{type:"remote",db:h,files:d});d[a.key]=a.value;a.continue()}})}},NODEFS={isWindows:!1,staticInit:function(){NODEFS.isWindows=!!process.platform.match(/^win/)},
mount:function(a){assert(ENVIRONMENT_IS_NODE);return NODEFS.createNode(null,"/",NODEFS.getMode(a.opts.root),0)},createNode:function(a,c,d,g){if(!FS.isDir(d)&&!FS.isFile(d)&&!FS.isLink(d))throw new FS.ErrnoError(ERRNO_CODES.EINVAL);a=FS.createNode(a,c,d);a.node_ops=NODEFS.node_ops;a.stream_ops=NODEFS.stream_ops;return a},getMode:function(a){var c;try{c=fs.lstatSync(a),NODEFS.isWindows&&(c.mode|=(c.mode&146)>>1)}catch(d){if(!d.code)throw d;throw new FS.ErrnoError(ERRNO_CODES[d.code]);}return c.mode},
realPath:function(a){for(var c=[];a.parent!==a;)c.push(a.name),a=a.parent;c.push(a.mount.opts.root);c.reverse();return PATH.join.apply(null,c)},flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:function(a){return a in NODEFS.flagsToPermissionStringMap?NODEFS.flagsToPermissionStringMap[a]:
a},node_ops:{getattr:function(a){a=NODEFS.realPath(a);var c;try{c=fs.lstatSync(a)}catch(d){if(!d.code)throw d;throw new FS.ErrnoError(ERRNO_CODES[d.code]);}NODEFS.isWindows&&!c.blksize&&(c.blksize=4096);NODEFS.isWindows&&!c.blocks&&(c.blocks=(c.size+c.blksize-1)/c.blksize|0);return{dev:c.dev,ino:c.ino,mode:c.mode,nlink:c.nlink,uid:c.uid,gid:c.gid,rdev:c.rdev,size:c.size,atime:c.atime,mtime:c.mtime,ctime:c.ctime,blksize:c.blksize,blocks:c.blocks}},setattr:function(a,c){var d=NODEFS.realPath(a);try{void 0!==
c.mode&&(fs.chmodSync(d,c.mode),a.mode=c.mode);if(void 0!==c.timestamp){var g=new Date(c.timestamp);fs.utimesSync(d,g,g)}void 0!==c.size&&fs.truncateSync(d,c.size)}catch(h){if(!h.code)throw h;throw new FS.ErrnoError(ERRNO_CODES[h.code]);}},lookup:function(a,c){var d=PATH.join2(NODEFS.realPath(a),c),d=NODEFS.getMode(d);return NODEFS.createNode(a,c,d)},mknod:function(a,c,d,g){a=NODEFS.createNode(a,c,d,g);c=NODEFS.realPath(a);try{FS.isDir(a.mode)?fs.mkdirSync(c,a.mode):fs.writeFileSync(c,"",{mode:a.mode})}catch(h){if(!h.code)throw h;
throw new FS.ErrnoError(ERRNO_CODES[h.code]);}return a},rename:function(a,c,d){a=NODEFS.realPath(a);c=PATH.join2(NODEFS.realPath(c),d);try{fs.renameSync(a,c)}catch(g){if(!g.code)throw g;throw new FS.ErrnoError(ERRNO_CODES[g.code]);}},unlink:function(a,c){var d=PATH.join2(NODEFS.realPath(a),c);try{fs.unlinkSync(d)}catch(g){if(!g.code)throw g;throw new FS.ErrnoError(ERRNO_CODES[g.code]);}},rmdir:function(a,c){var d=PATH.join2(NODEFS.realPath(a),c);try{fs.rmdirSync(d)}catch(g){if(!g.code)throw g;throw new FS.ErrnoError(ERRNO_CODES[g.code]);
}},readdir:function(a){a=NODEFS.realPath(a);try{return fs.readdirSync(a)}catch(c){if(!c.code)throw c;throw new FS.ErrnoError(ERRNO_CODES[c.code]);}},symlink:function(a,c,d){a=PATH.join2(NODEFS.realPath(a),c);try{fs.symlinkSync(d,a)}catch(g){if(!g.code)throw g;throw new FS.ErrnoError(ERRNO_CODES[g.code]);}},readlink:function(a){a=NODEFS.realPath(a);try{return fs.readlinkSync(a)}catch(c){if(!c.code)throw c;throw new FS.ErrnoError(ERRNO_CODES[c.code]);}}},stream_ops:{open:function(a){var c=NODEFS.realPath(a.node);
try{FS.isFile(a.node.mode)&&(a.nfd=fs.openSync(c,NODEFS.flagsToPermissionString(a.flags)))}catch(d){if(!d.code)throw d;throw new FS.ErrnoError(ERRNO_CODES[d.code]);}},close:function(a){try{FS.isFile(a.node.mode)&&a.nfd&&fs.closeSync(a.nfd)}catch(c){if(!c.code)throw c;throw new FS.ErrnoError(ERRNO_CODES[c.code]);}},read:function(a,c,d,g,h){var l=new Buffer(g),p;try{p=fs.readSync(a.nfd,l,0,g,h)}catch(x){throw new FS.ErrnoError(ERRNO_CODES[x.code]);}if(0<p)for(a=0;a<p;a++)c[d+a]=l[a];return p},write:function(a,
c,d,g,h){c=new Buffer(c.subarray(d,d+g));var l;try{l=fs.writeSync(a.nfd,c,0,g,h)}catch(p){throw new FS.ErrnoError(ERRNO_CODES[p.code]);}return l},llseek:function(a,c,d){if(1===d)c+=a.position;else if(2===d&&FS.isFile(a.node.mode))try{var g=fs.fstatSync(a.nfd);c+=g.size}catch(h){throw new FS.ErrnoError(ERRNO_CODES[h.code]);}if(0>c)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);return a.position=c}}},_stdin=allocate(1,"i32*",ALLOC_STATIC),_stdout=allocate(1,"i32*",ALLOC_STATIC);
_stderr=allocate(1,"i32*",ALLOC_STATIC);function _fflush(a){}
var FS={root:null,mounts:[],devices:[null],streams:[null],nextInode:1,nameTable:null,currentPath:"/",initialized:!1,ignorePermissions:!0,ErrnoError:null,genericErrors:{},handleFSError:function(a){if(!(a instanceof FS.ErrnoError))throw a+" : "+stackTrace();return ___setErrNo(a.errno)},lookupPath:function(a,c){a=PATH.resolve(FS.cwd(),a);c=c||{recurse_count:0};if(8<c.recurse_count)throw new FS.ErrnoError(ERRNO_CODES.ELOOP);for(var d=PATH.normalizeArray(a.split("/").filter(function(a){return!!a}),!1),
g=FS.root,h="/",l=0;l<d.length;l++){var p=l===d.length-1;if(p&&c.parent)break;g=FS.lookupNode(g,d[l]);h=PATH.join2(h,d[l]);FS.isMountpoint(g)&&(g=g.mount.root);if(!p||c.follow)for(p=0;FS.isLink(g.mode);)if(g=FS.readlink(h),h=PATH.resolve(PATH.dirname(h),g),g=FS.lookupPath(h,{recurse_count:c.recurse_count}).node,40<p++)throw new FS.ErrnoError(ERRNO_CODES.ELOOP);}return{path:h,node:g}},getPath:function(a){for(var c;;){if(FS.isRoot(a))return a=a.mount.mountpoint,c?"/"!==a[a.length-1]?a+"/"+c:a+c:a;c=
c?a.name+"/"+c:a.name;a=a.parent}},hashName:function(a,c){for(var d=0,g=0;g<c.length;g++)d=(d<<5)-d+c.charCodeAt(g)|0;return(a+d>>>0)%FS.nameTable.length},hashAddNode:function(a){var c=FS.hashName(a.parent.id,a.name);a.name_next=FS.nameTable[c];FS.nameTable[c]=a},hashRemoveNode:function(a){var c=FS.hashName(a.parent.id,a.name);if(FS.nameTable[c]===a)FS.nameTable[c]=a.name_next;else for(c=FS.nameTable[c];c;){if(c.name_next===a){c.name_next=a.name_next;break}c=c.name_next}},lookupNode:function(a,c){var d=
FS.mayLookup(a);if(d)throw new FS.ErrnoError(d);d=FS.hashName(a.id,c);for(d=FS.nameTable[d];d;d=d.name_next){var g=d.name;if(d.parent.id===a.id&&g===c)return d}return FS.lookup(a,c)},createNode:function(a,c,d,g){FS.FSNode||(FS.FSNode=function(a,c,d,g){this.id=FS.nextInode++;this.name=c;this.mode=d;this.node_ops={};this.stream_ops={};this.rdev=g;this.mount=this.parent=null;a||(a=this);this.parent=a;this.mount=a.mount;FS.hashAddNode(this)},FS.FSNode.prototype={},Object.defineProperties(FS.FSNode.prototype,
{read:{get:function(){return 365===(this.mode&365)},set:function(a){a?this.mode|=365:this.mode&=-366}},write:{get:function(){return 146===(this.mode&146)},set:function(a){a?this.mode|=146:this.mode&=-147}},isFolder:{get:function(){return FS.isDir(this.mode)}},isDevice:{get:function(){return FS.isChrdev(this.mode)}}}));return new FS.FSNode(a,c,d,g)},destroyNode:function(a){FS.hashRemoveNode(a)},isRoot:function(a){return a===a.parent},isMountpoint:function(a){return a.mounted},isFile:function(a){return 32768===
(a&61440)},isDir:function(a){return 16384===(a&61440)},isLink:function(a){return 40960===(a&61440)},isChrdev:function(a){return 8192===(a&61440)},isBlkdev:function(a){return 24576===(a&61440)},isFIFO:function(a){return 4096===(a&61440)},isSocket:function(a){return 49152===(a&49152)},flagModes:{r:0,rs:1052672,"r+":2,w:577,wx:705,xw:705,"w+":578,"wx+":706,"xw+":706,a:1089,ax:1217,xa:1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:function(a){var c=FS.flagModes[a];if("undefined"===typeof c)throw Error("Unknown file open mode: "+
a);return c},flagsToPermissionString:function(a){var c=["r","w","rw"][a&2097155];a&512&&(c+="w");return c},nodePermissions:function(a,c){if(FS.ignorePermissions)return 0;if(-1===c.indexOf("r")||a.mode&292){if(-1!==c.indexOf("w")&&!(a.mode&146)||-1!==c.indexOf("x")&&!(a.mode&73))return ERRNO_CODES.EACCES}else return ERRNO_CODES.EACCES;return 0},mayLookup:function(a){return FS.nodePermissions(a,"x")},mayCreate:function(a,c){try{return FS.lookupNode(a,c),ERRNO_CODES.EEXIST}catch(d){}return FS.nodePermissions(a,
"wx")},mayDelete:function(a,c,d){var g;try{g=FS.lookupNode(a,c)}catch(h){return h.errno}if(a=FS.nodePermissions(a,"wx"))return a;if(d){if(!FS.isDir(g.mode))return ERRNO_CODES.ENOTDIR;if(FS.isRoot(g)||FS.getPath(g)===FS.cwd())return ERRNO_CODES.EBUSY}else if(FS.isDir(g.mode))return ERRNO_CODES.EISDIR;return 0},mayOpen:function(a,c){return a?FS.isLink(a.mode)?ERRNO_CODES.ELOOP:FS.isDir(a.mode)&&(0!==(c&2097155)||c&512)?ERRNO_CODES.EISDIR:FS.nodePermissions(a,FS.flagsToPermissionString(c)):ERRNO_CODES.ENOENT},
MAX_OPEN_FDS:4096,nextfd:function(a,c){c=c||FS.MAX_OPEN_FDS;for(var d=a||1;d<=c;d++)if(!FS.streams[d])return d;throw new FS.ErrnoError(ERRNO_CODES.EMFILE);},getStream:function(a){return FS.streams[a]},createStream:function(a,c,d){FS.FSStream||(FS.FSStream=function(){},FS.FSStream.prototype={},Object.defineProperties(FS.FSStream.prototype,{object:{get:function(){return this.node},set:function(a){this.node=a}},isRead:{get:function(){return 1!==(this.flags&2097155)}},isWrite:{get:function(){return 0!==
(this.flags&2097155)}},isAppend:{get:function(){return this.flags&1024}}}));if(a.__proto__)a.__proto__=FS.FSStream.prototype;else{var g=new FS.FSStream,h;for(h in a)g[h]=a[h];a=g}c=FS.nextfd(c,d);a.fd=c;return FS.streams[c]=a},closeStream:function(a){FS.streams[a]=null},chrdev_stream_ops:{open:function(a){var c=FS.getDevice(a.node.rdev);a.stream_ops=c.stream_ops;a.stream_ops.open&&a.stream_ops.open(a)},llseek:function(){throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);}},major:function(a){return a>>8},
minor:function(a){return a&255},makedev:function(a,c){return a<<8|c},registerDevice:function(a,c){FS.devices[a]={stream_ops:c}},getDevice:function(a){return FS.devices[a]},syncfs:function(a,c){function d(a){if(a)return c(a);++g>=h&&c(null)}"function"===typeof a&&(c=a,a=!1);for(var g=0,h=FS.mounts.length,l=0;l<FS.mounts.length;l++){var p=FS.mounts[l];p.type.syncfs?p.type.syncfs(p,a,d):d(null)}},mount:function(a,c,d){var g;d&&(g=FS.lookupPath(d,{follow:!1}),d=g.path);c={type:a,opts:c,mountpoint:d,root:null};
a=a.mount(c);a.mount=c;c.root=a;g&&(g.node.mount=c,g.node.mounted=!0,"/"===d&&(FS.root=c.root));FS.mounts.push(c);return a},lookup:function(a,c){return a.node_ops.lookup(a,c)},mknod:function(a,c,d){var g=FS.lookupPath(a,{parent:!0}).node;a=PATH.basename(a);var h=FS.mayCreate(g,a);if(h)throw new FS.ErrnoError(h);if(!g.node_ops.mknod)throw new FS.ErrnoError(ERRNO_CODES.EPERM);return g.node_ops.mknod(g,a,c,d)},create:function(a,c){c=(void 0!==c?c:438)&4095;c|=32768;return FS.mknod(a,c,0)},mkdir:function(a,
c){c=(void 0!==c?c:511)&1023;c|=16384;return FS.mknod(a,c,0)},mkdev:function(a,c,d){"undefined"===typeof d&&(d=c,c=438);return FS.mknod(a,c|8192,d)},symlink:function(a,c){var d=FS.lookupPath(c,{parent:!0}).node,g=PATH.basename(c),h=FS.mayCreate(d,g);if(h)throw new FS.ErrnoError(h);if(!d.node_ops.symlink)throw new FS.ErrnoError(ERRNO_CODES.EPERM);return d.node_ops.symlink(d,g,a)},rename:function(a,c){var d=PATH.dirname(a),g=PATH.dirname(c),h=PATH.basename(a),l=PATH.basename(c),p,x,w;try{p=FS.lookupPath(a,
{parent:!0}),x=p.node,p=FS.lookupPath(c,{parent:!0}),w=p.node}catch(P){throw new FS.ErrnoError(ERRNO_CODES.EBUSY);}if(x.mount!==w.mount)throw new FS.ErrnoError(ERRNO_CODES.EXDEV);p=FS.lookupNode(x,h);g=PATH.relative(a,g);if("."!==g.charAt(0))throw new FS.ErrnoError(ERRNO_CODES.EINVAL);g=PATH.relative(c,d);if("."!==g.charAt(0))throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);var N;try{N=FS.lookupNode(w,l)}catch(R){}if(p!==N){d=FS.isDir(p.mode);if(h=FS.mayDelete(x,h,d))throw new FS.ErrnoError(h);if(h=
N?FS.mayDelete(w,l,d):FS.mayCreate(w,l))throw new FS.ErrnoError(h);if(!x.node_ops.rename)throw new FS.ErrnoError(ERRNO_CODES.EPERM);if(FS.isMountpoint(p)||N&&FS.isMountpoint(N))throw new FS.ErrnoError(ERRNO_CODES.EBUSY);if(w!==x&&(h=FS.nodePermissions(x,"w")))throw new FS.ErrnoError(h);FS.hashRemoveNode(p);try{x.node_ops.rename(p,w,l)}catch(I){throw I;}finally{FS.hashAddNode(p)}}},rmdir:function(a){var c=FS.lookupPath(a,{parent:!0}).node;a=PATH.basename(a);var d=FS.lookupNode(c,a),g=FS.mayDelete(c,
a,!0);if(g)throw new FS.ErrnoError(g);if(!c.node_ops.rmdir)throw new FS.ErrnoError(ERRNO_CODES.EPERM);if(FS.isMountpoint(d))throw new FS.ErrnoError(ERRNO_CODES.EBUSY);c.node_ops.rmdir(c,a);FS.destroyNode(d)},readdir:function(a){a=FS.lookupPath(a,{follow:!0}).node;if(!a.node_ops.readdir)throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);return a.node_ops.readdir(a)},unlink:function(a){var c=FS.lookupPath(a,{parent:!0}).node;a=PATH.basename(a);var d=FS.lookupNode(c,a),g=FS.mayDelete(c,a,!1);if(g)throw g===
ERRNO_CODES.EISDIR&&(g=ERRNO_CODES.EPERM),new FS.ErrnoError(g);if(!c.node_ops.unlink)throw new FS.ErrnoError(ERRNO_CODES.EPERM);if(FS.isMountpoint(d))throw new FS.ErrnoError(ERRNO_CODES.EBUSY);c.node_ops.unlink(c,a);FS.destroyNode(d)},readlink:function(a){a=FS.lookupPath(a,{follow:!1}).node;if(!a.node_ops.readlink)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);return a.node_ops.readlink(a)},stat:function(a,c){var d=FS.lookupPath(a,{follow:!c}).node;if(!d.node_ops.getattr)throw new FS.ErrnoError(ERRNO_CODES.EPERM);
return d.node_ops.getattr(d)},lstat:function(a){return FS.stat(a,!0)},chmod:function(a,c,d){a="string"===typeof a?FS.lookupPath(a,{follow:!d}).node:a;if(!a.node_ops.setattr)throw new FS.ErrnoError(ERRNO_CODES.EPERM);a.node_ops.setattr(a,{mode:c&4095|a.mode&-4096,timestamp:Date.now()})},lchmod:function(a,c){FS.chmod(a,c,!0)},fchmod:function(a,c){var d=FS.getStream(a);if(!d)throw new FS.ErrnoError(ERRNO_CODES.EBADF);FS.chmod(d.node,c)},chown:function(a,c,d,g){a="string"===typeof a?FS.lookupPath(a,{follow:!g}).node:
a;if(!a.node_ops.setattr)throw new FS.ErrnoError(ERRNO_CODES.EPERM);a.node_ops.setattr(a,{timestamp:Date.now()})},lchown:function(a,c,d){FS.chown(a,c,d,!0)},fchown:function(a,c,d){a=FS.getStream(a);if(!a)throw new FS.ErrnoError(ERRNO_CODES.EBADF);FS.chown(a.node,c,d)},truncate:function(a,c){if(0>c)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);var d;d="string"===typeof a?FS.lookupPath(a,{follow:!0}).node:a;if(!d.node_ops.setattr)throw new FS.ErrnoError(ERRNO_CODES.EPERM);if(FS.isDir(d.mode))throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
if(!FS.isFile(d.mode))throw new FS.ErrnoError(ERRNO_CODES.EINVAL);var g=FS.nodePermissions(d,"w");if(g)throw new FS.ErrnoError(g);d.node_ops.setattr(d,{size:c,timestamp:Date.now()})},ftruncate:function(a,c){var d=FS.getStream(a);if(!d)throw new FS.ErrnoError(ERRNO_CODES.EBADF);if(0===(d.flags&2097155))throw new FS.ErrnoError(ERRNO_CODES.EINVAL);FS.truncate(d.node,c)},utime:function(a,c,d){a=FS.lookupPath(a,{follow:!0}).node;a.node_ops.setattr(a,{timestamp:Math.max(c,d)})},open:function(a,c,d,g,h){c=
"string"===typeof c?FS.modeStringToFlags(c):c;d=c&64?("undefined"===typeof d?438:d)&4095|32768:0;var l;if("object"===typeof a)l=a;else{a=PATH.normalize(a);try{l=FS.lookupPath(a,{follow:!(c&131072)}).node}catch(p){}}if(c&64)if(l){if(c&128)throw new FS.ErrnoError(ERRNO_CODES.EEXIST);}else l=FS.mknod(a,d,0);if(!l)throw new FS.ErrnoError(ERRNO_CODES.ENOENT);FS.isChrdev(l.mode)&&(c&=-513);if(d=FS.mayOpen(l,c))throw new FS.ErrnoError(d);c&512&&FS.truncate(l,0);c&=-641;g=FS.createStream({node:l,path:FS.getPath(l),
flags:c,seekable:!0,position:0,stream_ops:l.stream_ops,ungotten:[],error:!1},g,h);g.stream_ops.open&&g.stream_ops.open(g);!Module.logReadFiles||c&1||(FS.readFiles||(FS.readFiles={}),a in FS.readFiles||(FS.readFiles[a]=1,Module.printErr("read file: "+a)));return g},close:function(a){try{a.stream_ops.close&&a.stream_ops.close(a)}catch(c){throw c;}finally{FS.closeStream(a.fd)}},llseek:function(a,c,d){if(!a.seekable||!a.stream_ops.llseek)throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);return a.stream_ops.llseek(a,
c,d)},read:function(a,c,d,g,h){if(0>g||0>h)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);if(1===(a.flags&2097155))throw new FS.ErrnoError(ERRNO_CODES.EBADF);if(FS.isDir(a.node.mode))throw new FS.ErrnoError(ERRNO_CODES.EISDIR);if(!a.stream_ops.read)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);var l=!0;if("undefined"===typeof h)h=a.position,l=!1;else if(!a.seekable)throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);c=a.stream_ops.read(a,c,d,g,h);l||(a.position+=c);return c},write:function(a,c,d,g,h,l){if(0>g||
0>h)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);if(0===(a.flags&2097155))throw new FS.ErrnoError(ERRNO_CODES.EBADF);if(FS.isDir(a.node.mode))throw new FS.ErrnoError(ERRNO_CODES.EISDIR);if(!a.stream_ops.write)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);var p=!0;if("undefined"===typeof h)h=a.position,p=!1;else if(!a.seekable)throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);a.flags&1024&&FS.llseek(a,0,2);c=a.stream_ops.write(a,c,d,g,h,l);p||(a.position+=c);return c},allocate:function(a,c,d){if(0>c||0>=d)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
if(0===(a.flags&2097155))throw new FS.ErrnoError(ERRNO_CODES.EBADF);if(!FS.isFile(a.node.mode)&&!FS.isDir(node.mode))throw new FS.ErrnoError(ERRNO_CODES.ENODEV);if(!a.stream_ops.allocate)throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);a.stream_ops.allocate(a,c,d)},mmap:function(a,c,d,g,h,l,p){if(1===(a.flags&2097155))throw new FS.ErrnoError(ERRNO_CODES.EACCES);if(!a.stream_ops.mmap)throw new FS.errnoError(ERRNO_CODES.ENODEV);return a.stream_ops.mmap(a,c,d,g,h,l,p)},ioctl:function(a,c,d){if(!a.stream_ops.ioctl)throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
return a.stream_ops.ioctl(a,c,d)},readFile:function(a,c){c=c||{};c.flags=c.flags||"r";c.encoding=c.encoding||"binary";var d,g=FS.open(a,c.flags),h=FS.stat(a).size,l=new Uint8Array(h);FS.read(g,l,0,h,0);if("utf8"===c.encoding){d="";for(var p=new Runtime.UTF8Processor,x=0;x<h;x++)d+=p.processCChar(l[x])}else if("binary"===c.encoding)d=l;else throw Error('Invalid encoding type "'+c.encoding+'"');FS.close(g);return d},writeFile:function(a,c,d){d=d||{};d.flags=d.flags||"w";d.encoding=d.encoding||"utf8";
a=FS.open(a,d.flags,d.mode);if("utf8"===d.encoding)d=new Runtime.UTF8Processor,c=new Uint8Array(d.processJSString(c)),FS.write(a,c,0,c.length,0);else if("binary"===d.encoding)FS.write(a,c,0,c.length,0);else throw Error('Invalid encoding type "'+d.encoding+'"');FS.close(a)},cwd:function(){return FS.currentPath},chdir:function(a){a=FS.lookupPath(a,{follow:!0});if(!FS.isDir(a.node.mode))throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);var c=FS.nodePermissions(a.node,"x");if(c)throw new FS.ErrnoError(c);
FS.currentPath=a.path},createDefaultDirectories:function(){FS.mkdir("/tmp")},createDefaultDevices:function(){FS.mkdir("/dev");FS.registerDevice(FS.makedev(1,3),{read:function(){return 0},write:function(){return 0}});FS.mkdev("/dev/null",FS.makedev(1,3));TTY.register(FS.makedev(5,0),TTY.default_tty_ops);TTY.register(FS.makedev(6,0),TTY.default_tty1_ops);FS.mkdev("/dev/tty",FS.makedev(5,0));FS.mkdev("/dev/tty1",FS.makedev(6,0));FS.mkdir("/dev/shm");FS.mkdir("/dev/shm/tmp")},createStandardStreams:function(){Module.stdin?
FS.createDevice("/dev","stdin",Module.stdin):FS.symlink("/dev/tty","/dev/stdin");Module.stdout?FS.createDevice("/dev","stdout",null,Module.stdout):FS.symlink("/dev/tty","/dev/stdout");Module.stderr?FS.createDevice("/dev","stderr",null,Module.stderr):FS.symlink("/dev/tty1","/dev/stderr");var a=FS.open("/dev/stdin","r");HEAP32[_stdin>>2]=a.fd;assert(1===a.fd,"invalid handle for stdin ("+a.fd+")");a=FS.open("/dev/stdout","w");HEAP32[_stdout>>2]=a.fd;assert(2===a.fd,"invalid handle for stdout ("+a.fd+
")");a=FS.open("/dev/stderr","w");HEAP32[_stderr>>2]=a.fd;assert(3===a.fd,"invalid handle for stderr ("+a.fd+")")},ensureErrnoError:function(){FS.ErrnoError||(FS.ErrnoError=function(a){this.errno=a;for(var c in ERRNO_CODES)if(ERRNO_CODES[c]===a){this.code=c;break}this.message=ERRNO_MESSAGES[a];this.stack=stackTrace()},FS.ErrnoError.prototype=Error(),FS.ErrnoError.prototype.constructor=FS.ErrnoError,[ERRNO_CODES.ENOENT].forEach(function(a){FS.genericErrors[a]=new FS.ErrnoError(a);FS.genericErrors[a].stack=
"<generic error, no stack>"}))},staticInit:function(){FS.ensureErrnoError();FS.nameTable=Array(4096);FS.root=FS.createNode(null,"/",16895,0);FS.mount(MEMFS,{},"/");FS.createDefaultDirectories();FS.createDefaultDevices()},init:function(a,c,d){assert(!FS.init.initialized,"FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");FS.init.initialized=!0;FS.ensureErrnoError();Module.stdin=
a||Module.stdin;Module.stdout=c||Module.stdout;Module.stderr=d||Module.stderr;FS.createStandardStreams()},quit:function(){FS.init.initialized=!1;for(var a=0;a<FS.streams.length;a++){var c=FS.streams[a];c&&FS.close(c)}},getMode:function(a,c){var d=0;a&&(d|=365);c&&(d|=146);return d},joinPath:function(a,c){var d=PATH.join.apply(null,a);c&&"/"==d[0]&&(d=d.substr(1));return d},absolutePath:function(a,c){return PATH.resolve(c,a)},standardizePath:function(a){return PATH.normalize(a)},findObject:function(a,
c){var d=FS.analyzePath(a,c);if(d.exists)return d.object;___setErrNo(d.error);return null},analyzePath:function(a,c){try{var d=FS.lookupPath(a,{follow:!c});a=d.path}catch(g){}var h={isRoot:!1,exists:!1,error:0,name:null,path:null,object:null,parentExists:!1,parentPath:null,parentObject:null};try{d=FS.lookupPath(a,{parent:!0}),h.parentExists=!0,h.parentPath=d.path,h.parentObject=d.node,h.name=PATH.basename(a),d=FS.lookupPath(a,{follow:!c}),h.exists=!0,h.path=d.path,h.object=d.node,h.name=d.node.name,
h.isRoot="/"===d.path}catch(l){h.error=l.errno}return h},createFolder:function(a,c,d,g){a=PATH.join2("string"===typeof a?a:FS.getPath(a),c);d=FS.getMode(d,g);return FS.mkdir(a,d)},createPath:function(a,c,d,g){a="string"===typeof a?a:FS.getPath(a);for(c=c.split("/").reverse();c.length;)if(d=c.pop()){var h=PATH.join2(a,d);try{FS.mkdir(h)}catch(l){}a=h}return h},createFile:function(a,c,d,g,h){a=PATH.join2("string"===typeof a?a:FS.getPath(a),c);g=FS.getMode(g,h);return FS.create(a,g)},createDataFile:function(a,
c,d,g,h,l){a=c?PATH.join2("string"===typeof a?a:FS.getPath(a),c):a;g=FS.getMode(g,h);h=FS.create(a,g);if(d){if("string"===typeof d){a=Array(d.length);c=0;for(var p=d.length;c<p;++c)a[c]=d.charCodeAt(c);d=a}FS.chmod(h,g|146);a=FS.open(h,"w");FS.write(a,d,0,d.length,0,l);FS.close(a);FS.chmod(h,g)}return h},createDevice:function(a,c,d,g){a=PATH.join2("string"===typeof a?a:FS.getPath(a),c);c=FS.getMode(!!d,!!g);FS.createDevice.major||(FS.createDevice.major=64);var h=FS.makedev(FS.createDevice.major++,
0);FS.registerDevice(h,{open:function(a){a.seekable=!1},close:function(a){g&&g.buffer&&g.buffer.length&&g(10)},read:function(a,c,g,h,P){for(var N=P=0;N<h;N++){var R;try{R=d()}catch(I){throw new FS.ErrnoError(ERRNO_CODES.EIO);}if(void 0===R&&0===P)throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);if(null===R||void 0===R)break;P++;c[g+N]=R}P&&(a.node.timestamp=Date.now());return P},write:function(a,c,d,h,P){for(P=0;P<h;P++)try{g(c[d+P])}catch(N){throw new FS.ErrnoError(ERRNO_CODES.EIO);}h&&(a.node.timestamp=
Date.now());return P}});return FS.mkdev(a,c,h)},createLink:function(a,c,d,g,h){a=PATH.join2("string"===typeof a?a:FS.getPath(a),c);return FS.symlink(d,a)},forceLoadFile:function(a){if(a.isDevice||a.isFolder||a.link||a.contents)return!0;var c=!0;if("undefined"!==typeof XMLHttpRequest)throw Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");if(Module.read)try{a.contents=
intArrayFromString(Module.read(a.url),!0)}catch(d){c=!1}else throw Error("Cannot load without read() or XMLHttpRequest.");c||___setErrNo(ERRNO_CODES.EIO);return c},createLazyFile:function(a,c,d,g,h){if("undefined"!==typeof XMLHttpRequest){if(!ENVIRONMENT_IS_WORKER)throw"Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";var l=function(){this.lengthKnown=!1;this.chunks=[]};l.prototype.get=function(a){if(!(a>this.length-1||0>a)){var c=
a%this.chunkSize;return this.getter(Math.floor(a/this.chunkSize))[c]}};l.prototype.setDataGetter=function(a){this.getter=a};l.prototype.cacheLength=function(){var a=new XMLHttpRequest;a.open("HEAD",d,!1);a.send(null);if(!(200<=a.status&&300>a.status||304===a.status))throw Error("Couldn't load "+d+". Status: "+a.status);var c=Number(a.getResponseHeader("Content-length")),g,h=1048576;(g=a.getResponseHeader("Accept-Ranges"))&&"bytes"===g||(h=c);var l=this;l.setDataGetter(function(a){var g=a*h,p=(a+1)*
h-1,p=Math.min(p,c-1);if("undefined"===typeof l.chunks[a]){var x=l.chunks;if(g>p)throw Error("invalid range ("+g+", "+p+") or no bytes requested!");if(p>c-1)throw Error("only "+c+" bytes available! programmer error!");var w=new XMLHttpRequest;w.open("GET",d,!1);c!==h&&w.setRequestHeader("Range","bytes="+g+"-"+p);"undefined"!=typeof Uint8Array&&(w.responseType="arraybuffer");w.overrideMimeType&&w.overrideMimeType("text/plain; charset=x-user-defined");w.send(null);if(!(200<=w.status&&300>w.status||
304===w.status))throw Error("Couldn't load "+d+". Status: "+w.status);g=void 0!==w.response?new Uint8Array(w.response||[]):intArrayFromString(w.responseText||"",!0);x[a]=g}if("undefined"===typeof l.chunks[a])throw Error("doXHR failed!");return l.chunks[a]});this._length=c;this._chunkSize=h;this.lengthKnown=!0};l=new l;Object.defineProperty(l,"length",{get:function(){this.lengthKnown||this.cacheLength();return this._length}});Object.defineProperty(l,"chunkSize",{get:function(){this.lengthKnown||this.cacheLength();
return this._chunkSize}});l={isDevice:!1,contents:l}}else l={isDevice:!1,url:d};var p=FS.createFile(a,c,l,g,h);l.contents?p.contents=l.contents:l.url&&(p.contents=null,p.url=l.url);var x={};Object.keys(p.stream_ops).forEach(function(a){var c=p.stream_ops[a];x[a]=function(){if(!FS.forceLoadFile(p))throw new FS.ErrnoError(ERRNO_CODES.EIO);return c.apply(null,arguments)}});x.read=function(a,c,d,g,h){if(!FS.forceLoadFile(p))throw new FS.ErrnoError(ERRNO_CODES.EIO);a=a.node.contents;if(h>=a.length)return 0;
g=Math.min(a.length-h,g);assert(0<=g);if(a.slice)for(var l=0;l<g;l++)c[d+l]=a[h+l];else for(l=0;l<g;l++)c[d+l]=a.get(h+l);return g};p.stream_ops=x;return p},createPreloadedFile:function(a,c,d,g,h,l,p,x,w){function P(d){function P(d){x||FS.createDataFile(a,c,d,g,h,w);l&&l();removeRunDependency("cp "+N)}var fa=!1;Module.preloadPlugins.forEach(function(a){!fa&&a.canHandle(N)&&(a.handle(d,N,P,function(){p&&p();removeRunDependency("cp "+N)}),fa=!0)});fa||P(d)}Browser.init();var N=c?PATH.resolve(PATH.join2(a,
c)):a;addRunDependency("cp "+N);"string"==typeof d?Browser.asyncLoad(d,function(a){P(a)},p):P(d)},indexedDB:function(){return window.indexedDB||window.mozIndexedDB||window.webkitIndexedDB||window.msIndexedDB},DB_NAME:function(){return"EM_FS_"+window.location.pathname},DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function(a,c,d){c=c||function(){};d=d||function(){};var g=FS.indexedDB();try{var h=g.open(FS.DB_NAME(),FS.DB_VERSION)}catch(l){return d(l)}h.onupgradeneeded=function(){console.log("creating db");
h.result.createObjectStore(FS.DB_STORE_NAME)};h.onsuccess=function(){var g=h.result.transaction([FS.DB_STORE_NAME],"readwrite"),l=g.objectStore(FS.DB_STORE_NAME),w=0,P=0,N=a.length;a.forEach(function(a){a=l.put(FS.analyzePath(a).object.contents,a);a.onsuccess=function(){w++;w+P==N&&(0==P?c():d())};a.onerror=function(){P++;w+P==N&&(0==P?c():d())}});g.onerror=d};h.onerror=d},loadFilesFromDB:function(a,c,d){c=c||function(){};d=d||function(){};var g=FS.indexedDB();try{var h=g.open(FS.DB_NAME(),FS.DB_VERSION)}catch(l){return d(l)}h.onupgradeneeded=
d;h.onsuccess=function(){var g=h.result;try{var l=g.transaction([FS.DB_STORE_NAME],"readonly")}catch(w){d(w);return}var P=l.objectStore(FS.DB_STORE_NAME),N=0,R=0,I=a.length;a.forEach(function(a){var g=P.get(a);g.onsuccess=function(){FS.analyzePath(a).exists&&FS.unlink(a);FS.createDataFile(PATH.dirname(a),PATH.basename(a),g.result,!0,!0,!0);N++;N+R==I&&(0==R?c():d())};g.onerror=function(){R++;N+R==I&&(0==R?c():d())}});l.onerror=d};h.onerror=d}},SOCKFS={mount:function(a){return FS.createNode(null,"/",
16895,0)},createSocket:function(a,c,d){d&&assert(1==c==(6==d));a={family:a,type:c,protocol:d,server:null,peers:{},pending:[],recv_queue:[],sock_ops:SOCKFS.websocket_sock_ops};c=SOCKFS.nextname();d=FS.createNode(SOCKFS.root,c,49152,0);d.sock=a;c=FS.createStream({path:c,node:d,flags:FS.modeStringToFlags("r+"),seekable:!1,stream_ops:SOCKFS.stream_ops});a.stream=c;return a},getSocket:function(a){return(a=FS.getStream(a))&&FS.isSocket(a.node.mode)?a.node.sock:null},stream_ops:{poll:function(a){a=a.node.sock;
return a.sock_ops.poll(a)},ioctl:function(a,c,d){a=a.node.sock;return a.sock_ops.ioctl(a,c,d)},read:function(a,c,d,g,h){a=a.node.sock;g=a.sock_ops.recvmsg(a,g);if(!g)return 0;c.set(g.buffer,d);return g.buffer.length},write:function(a,c,d,g,h){a=a.node.sock;return a.sock_ops.sendmsg(a,c,d,g)},close:function(a){a=a.node.sock;a.sock_ops.close(a)}},nextname:function(){SOCKFS.nextname.current||(SOCKFS.nextname.current=0);return"socket["+SOCKFS.nextname.current++ +"]"},websocket_sock_ops:{createPeer:function(a,
c,d){var g;"object"===typeof c&&(g=c,d=c=null);if(g)if(g._socket)c=g._socket.remoteAddress,d=g._socket.remotePort;else{d=/ws[s]?:\/\/([^:]+):(\d+)/.exec(g.url);if(!d)throw Error("WebSocket URL must be in the format ws(s)://address:port");c=d[1];d=parseInt(d[2],10)}else try{var h="ws://"+c+":"+d,l=ENVIRONMENT_IS_NODE?{headers:{"websocket-protocol":["binary"]}}:["binary"];g=new (ENVIRONMENT_IS_NODE?require("ws"):window.WebSocket)(h,l);g.binaryType="arraybuffer"}catch(p){throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH);
}c={addr:c,port:d,socket:g,dgram_send_queue:[]};SOCKFS.websocket_sock_ops.addPeer(a,c);SOCKFS.websocket_sock_ops.handlePeerEvents(a,c);2===a.type&&"undefined"!==typeof a.sport&&c.dgram_send_queue.push(new Uint8Array([255,255,255,255,112,111,114,116,(a.sport&65280)>>8,a.sport&255]));return c},getPeer:function(a,c,d){return a.peers[c+":"+d]},addPeer:function(a,c){a.peers[c.addr+":"+c.port]=c},removePeer:function(a,c){delete a.peers[c.addr+":"+c.port]},handlePeerEvents:function(a,c){function d(d){assert("string"!==
typeof d&&void 0!==d.byteLength);d=new Uint8Array(d);var h=g;g=!1;h&&10===d.length&&255===d[0]&&255===d[1]&&255===d[2]&&255===d[3]&&112===d[4]&&111===d[5]&&114===d[6]&&116===d[7]?(d=d[8]<<8|d[9],SOCKFS.websocket_sock_ops.removePeer(a,c),c.port=d,SOCKFS.websocket_sock_ops.addPeer(a,c)):a.recv_queue.push({addr:c.addr,port:c.port,data:d})}var g=!0,h=function(){try{for(var a=c.dgram_send_queue.shift();a;)c.socket.send(a),a=c.dgram_send_queue.shift()}catch(d){c.socket.close()}};ENVIRONMENT_IS_NODE?(c.socket.on("open",
h),c.socket.on("message",function(a,c){c.binary&&d((new Uint8Array(a)).buffer)}),c.socket.on("error",function(){})):(c.socket.onopen=h,c.socket.onmessage=function(a){d(a.data)})},poll:function(a){if(1===a.type&&a.server)return a.pending.length?65:0;var c=0,d=1===a.type?SOCKFS.websocket_sock_ops.getPeer(a,a.daddr,a.dport):null;if(a.recv_queue.length||!d||d&&d.socket.readyState===d.socket.CLOSING||d&&d.socket.readyState===d.socket.CLOSED)c|=65;if(!d||d&&d.socket.readyState===d.socket.OPEN)c|=4;if(d&&
d.socket.readyState===d.socket.CLOSING||d&&d.socket.readyState===d.socket.CLOSED)c|=16;return c},ioctl:function(a,c,d){switch(c){case 21531:return c=0,a.recv_queue.length&&(c=a.recv_queue[0].data.length),HEAP32[d>>2]=c,0;default:return ERRNO_CODES.EINVAL}},close:function(a){if(a.server){try{a.server.close()}catch(c){}a.server=null}for(var d=Object.keys(a.peers),g=0;g<d.length;g++){var h=a.peers[d[g]];try{h.socket.close()}catch(l){}SOCKFS.websocket_sock_ops.removePeer(a,h)}return 0},bind:function(a,
c,d){if("undefined"!==typeof a.saddr||"undefined"!==typeof a.sport)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);a.saddr=c;a.sport=d||_mkport();if(2===a.type){a.server&&(a.server.close(),a.server=null);try{a.sock_ops.listen(a,0)}catch(g){if(!(g instanceof FS.ErrnoError))throw g;if(g.errno!==ERRNO_CODES.EOPNOTSUPP)throw g;}}},connect:function(a,c,d){if(a.server)throw new FS.ErrnoError(ERRNO_CODS.EOPNOTSUPP);if("undefined"!==typeof a.daddr&&"undefined"!==typeof a.dport){var g=SOCKFS.websocket_sock_ops.getPeer(a,
a.daddr,a.dport);if(g){if(g.socket.readyState===g.socket.CONNECTING)throw new FS.ErrnoError(ERRNO_CODES.EALREADY);throw new FS.ErrnoError(ERRNO_CODES.EISCONN);}}c=SOCKFS.websocket_sock_ops.createPeer(a,c,d);a.daddr=c.addr;a.dport=c.port;throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);},listen:function(a,c){if(!ENVIRONMENT_IS_NODE)throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);if(a.server)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);var d=require("ws").Server;a.server=new d({host:a.saddr,port:a.sport});
a.server.on("connection",function(c){if(1===a.type){var d=SOCKFS.createSocket(a.family,a.type,a.protocol);c=SOCKFS.websocket_sock_ops.createPeer(d,c);d.daddr=c.addr;d.dport=c.port;a.pending.push(d)}else SOCKFS.websocket_sock_ops.createPeer(a,c)});a.server.on("closed",function(){a.server=null});a.server.on("error",function(){})},accept:function(a){if(!a.server)throw new FS.ErrnoError(ERRNO_CODES.EINVAL);var c=a.pending.shift();c.stream.flags=a.stream.flags;return c},getname:function(a,c){var d,g;if(c){if(void 0===
a.daddr||void 0===a.dport)throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);d=a.daddr;g=a.dport}else d=a.saddr||0,g=a.sport||0;return{addr:d,port:g}},sendmsg:function(a,c,d,g,h,l){if(2===a.type){if(void 0===h||void 0===l)h=a.daddr,l=a.dport;if(void 0===h||void 0===l)throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ);}else h=a.daddr,l=a.dport;var p=SOCKFS.websocket_sock_ops.getPeer(a,h,l);if(1===a.type){if(!p||p.socket.readyState===p.socket.CLOSING||p.socket.readyState===p.socket.CLOSED)throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
if(p.socket.readyState===p.socket.CONNECTING)throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);}c=c instanceof Array||c instanceof ArrayBuffer?c.slice(d,d+g):c.buffer.slice(c.byteOffset+d,c.byteOffset+d+g);if(2===a.type&&(!p||p.socket.readyState!==p.socket.OPEN))return p&&p.socket.readyState!==p.socket.CLOSING&&p.socket.readyState!==p.socket.CLOSED||(p=SOCKFS.websocket_sock_ops.createPeer(a,h,l)),p.dgram_send_queue.push(c),g;try{return p.socket.send(c),g}catch(x){throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
}},recvmsg:function(a,c){if(1===a.type&&a.server)throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);var d=a.recv_queue.shift();if(!d){if(1===a.type){if(d=SOCKFS.websocket_sock_ops.getPeer(a,a.daddr,a.dport)){if(d.socket.readyState===d.socket.CLOSING||d.socket.readyState===d.socket.CLOSED)return null;throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);}throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);}throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);}var g=d.data.byteLength||d.data.length,h=d.data.byteOffset||0,l=d.data.buffer||
d.data,p=Math.min(c,g),x={buffer:new Uint8Array(l,h,p),addr:d.addr,port:d.port};1===a.type&&p<g&&(d.data=new Uint8Array(l,h+p,g-p),a.recv_queue.unshift(d));return x}}};function _send(a,c,d,g){return SOCKFS.getSocket(a)?_write(a,c,d):(___setErrNo(ERRNO_CODES.EBADF),-1)}function _pwrite(a,c,d,g){a=FS.getStream(a);if(!a)return ___setErrNo(ERRNO_CODES.EBADF),-1;try{return FS.write(a,HEAP8,c,d,g)}catch(h){return FS.handleFSError(h),-1}}
function _write(a,c,d){a=FS.getStream(a);if(!a)return ___setErrNo(ERRNO_CODES.EBADF),-1;try{return FS.write(a,HEAP8,c,d)}catch(g){return FS.handleFSError(g),-1}}function _fwrite(a,c,d,g){d*=c;if(0==d)return 0;a=_write(g,a,d);if(-1==a){if(c=FS.getStream(g))c.error=!0;return 0}return Math.floor(a/c)}Module._strlen=_strlen;function __reallyNegative(a){return 0>a||0===a&&-Infinity===1/a}
function __formatString(a,c){function d(a){var d;"double"===a?d=HEAPF64[c+h>>3]:"i64"==a?(d=[HEAP32[c+h>>2],HEAP32[c+(h+8)>>2]],h+=8):(a="i32",d=HEAP32[c+h>>2]);h+=Math.max(Runtime.getNativeFieldSize(a),Runtime.getAlignSize(a,null,!0));return d}for(var g=a,h=0,l=[],p,x;;){var w=g;p=HEAP8[g];if(0===p)break;x=HEAP8[g+1|0];if(37==p){var P=!1,N=!1,R=!1,I=!1,fa=!1;a:for(;;){switch(x){case 43:P=!0;break;case 45:N=!0;break;case 35:R=!0;break;case 48:if(I)break a;else{I=!0;break}case 32:fa=!0;break;default:break a}g++;
x=HEAP8[g+1|0]}var pa=0;if(42==x)pa=d("i32"),g++,x=HEAP8[g+1|0];else for(;48<=x&&57>=x;)pa=10*pa+(x-48),g++,x=HEAP8[g+1|0];var va=!1;if(46==x){var za=0,va=!0;g++;x=HEAP8[g+1|0];if(42==x)za=d("i32"),g++;else for(;;){x=HEAP8[g+1|0];if(48>x||57<x)break;za=10*za+(x-48);g++}x=HEAP8[g+1|0]}else za=6;var ra;switch(String.fromCharCode(x)){case "h":x=HEAP8[g+2|0];104==x?(g++,ra=1):ra=2;break;case "l":x=HEAP8[g+2|0];108==x?(g++,ra=8):ra=4;break;case "L":case "q":case "j":ra=8;break;case "z":case "t":case "I":ra=
4;break;default:ra=null}ra&&g++;x=HEAP8[g+1|0];switch(String.fromCharCode(x)){case "d":case "i":case "u":case "o":case "x":case "X":case "p":w=100==x||105==x;ra=ra||4;var La=p=d("i"+8*ra),$;8==ra&&(p=Runtime.makeBigInt(p[0],p[1],117==x));if(4>=ra){var Qa=Math.pow(256,ra)-1;p=(w?reSign:unSign)(p&Qa,8*ra)}Qa=Math.abs(p);w="";if(100==x||105==x)$=8==ra&&i64Math?i64Math.stringify(La[0],La[1],null):reSign(p,8*ra,1).toString(10);else if(117==x)$=8==ra&&i64Math?i64Math.stringify(La[0],La[1],!0):unSign(p,
8*ra,1).toString(10),p=Math.abs(p);else if(111==x)$=(R?"0":"")+Qa.toString(8);else if(120==x||88==x){w=R&&0!=p?"0x":"";if(8==ra&&i64Math)if(La[1]){$=(La[1]>>>0).toString(16);for(R=(La[0]>>>0).toString(16);8>R.length;)R="0"+R;$+=R}else $=(La[0]>>>0).toString(16);else if(0>p){p=-p;$=(Qa-1).toString(16);La=[];for(R=0;R<$.length;R++)La.push((15-parseInt($[R],16)).toString(16));for($=La.join("");$.length<2*ra;)$="f"+$}else $=Qa.toString(16);88==x&&(w=w.toUpperCase(),$=$.toUpperCase())}else 112==x&&(0===
Qa?$="(nil)":(w="0x",$=Qa.toString(16)));if(va)for(;$.length<za;)$="0"+$;0<=p&&(P?w="+"+w:fa&&(w=" "+w));"-"==$.charAt(0)&&(w="-"+w,$=$.substr(1));for(;w.length+$.length<pa;)N?$+=" ":I?$="0"+$:w=" "+w;$=w+$;$.split("").forEach(function(a){l.push(a.charCodeAt(0))});break;case "f":case "F":case "e":case "E":case "g":case "G":p=d("double");if(isNaN(p))$="nan",I=!1;else if(isFinite(p)){va=!1;ra=Math.min(za,20);if(103==x||71==x)va=!0,za=za||1,ra=parseInt(p.toExponential(ra).split("e")[1],10),za>ra&&-4<=
ra?(x=(103==x?"f":"F").charCodeAt(0),za-=ra+1):(x=(103==x?"e":"E").charCodeAt(0),za--),ra=Math.min(za,20);if(101==x||69==x)$=p.toExponential(ra),/[eE][-+]\d$/.test($)&&($=$.slice(0,-1)+"0"+$.slice(-1));else if(102==x||70==x)$=p.toFixed(ra),0===p&&__reallyNegative(p)&&($="-"+$);w=$.split("e");if(va&&!R)for(;1<w[0].length&&-1!=w[0].indexOf(".")&&("0"==w[0].slice(-1)||"."==w[0].slice(-1));)w[0]=w[0].slice(0,-1);else for(R&&-1==$.indexOf(".")&&(w[0]+=".");za>ra++;)w[0]+="0";$=w[0]+(1<w.length?"e"+w[1]:
"");69==x&&($=$.toUpperCase());0<=p&&(P?$="+"+$:fa&&($=" "+$))}else $=(0>p?"-":"")+"inf",I=!1;for(;$.length<pa;)$=N?$+" ":!I||"-"!=$[0]&&"+"!=$[0]?(I?"0":" ")+$:$[0]+"0"+$.slice(1);97>x&&($=$.toUpperCase());$.split("").forEach(function(a){l.push(a.charCodeAt(0))});break;case "s":I=(P=d("i8*"))?_strlen(P):6;va&&(I=Math.min(I,za));if(!N)for(;I<pa--;)l.push(32);if(P)for(R=0;R<I;R++)l.push(HEAPU8[P++|0]);else l=l.concat(intArrayFromString("(null)".substr(0,I),!0));if(N)for(;I<pa--;)l.push(32);break;case "c":for(N&&
l.push(d("i8"));0<--pa;)l.push(32);N||l.push(d("i8"));break;case "n":N=d("i32*");HEAP32[N>>2]=l.length;break;case "%":l.push(p);break;default:for(R=w;R<g+2;R++)l.push(HEAP8[R])}g+=2}else l.push(p),g+=1}return l}function _fprintf(a,c,d){d=__formatString(c,d);c=Runtime.stackSave();a=_fwrite(allocate(d,"i8",ALLOC_STACK),1,d.length,a);Runtime.stackRestore(c);return a}
function _llvm_stacksave(){var a=_llvm_stacksave;a.LLVM_SAVEDSTACKS||(a.LLVM_SAVEDSTACKS=[]);a.LLVM_SAVEDSTACKS.push(Runtime.stackSave());return a.LLVM_SAVEDSTACKS.length-1}var _llvm_memcpy_p0i8_p0i8_i32=_memcpy;function _llvm_stackrestore(a){var c=_llvm_stacksave,d=c.LLVM_SAVEDSTACKS[a];c.LLVM_SAVEDSTACKS.splice(a,1);Runtime.stackRestore(d)}var _llvm_memset_p0i8_i32=Module._memset=_memset,_sqrt=Math_sqrt,_sqrtf=Math_sqrt,_acos=Math_acos,_fabsf=Math_abs,_floor=Math_floor,_log=Math_log,_exp=Math_exp;
function __exit(a){Module.exit(a)}function _exit(a){__exit(a)}var _llvm_memset_p0i8_i64=_memset,_floorf=Math_floor;function _fputc(a,c){var d=unSign(a&255);HEAP8[_fputc.ret|0]=d;if(-1==_write(c,_fputc.ret,1)){if(d=FS.getStream(c))d.error=!0;return-1}return d}var _llvm_pow_f64=Math_pow,_fabs=Math_abs;function _abort(){Module.abort()}function ___errno_location(){return ___errno_state}
function _sbrk(a){var c=_sbrk;c.called||(DYNAMICTOP=alignMemoryPage(DYNAMICTOP),c.called=!0,assert(Runtime.dynamicAlloc),c.alloc=Runtime.dynamicAlloc,Runtime.dynamicAlloc=function(){abort("cannot dynamically allocate, sbrk now has control")});var d=DYNAMICTOP;0!=a&&c.alloc(a);return d}
function _sysconf(a){switch(a){case 30:return PAGE_SIZE;case 132:case 133:case 12:case 137:case 138:case 15:case 235:case 16:case 17:case 18:case 19:case 20:case 149:case 13:case 10:case 236:case 153:case 9:case 21:case 22:case 159:case 154:case 14:case 77:case 78:case 139:case 80:case 81:case 79:case 82:case 68:case 67:case 164:case 11:case 29:case 47:case 48:case 95:case 52:case 51:case 46:return 200809;case 27:case 246:case 127:case 128:case 23:case 24:case 160:case 161:case 181:case 182:case 242:case 183:case 184:case 243:case 244:case 245:case 165:case 178:case 179:case 49:case 50:case 168:case 169:case 175:case 170:case 171:case 172:case 97:case 76:case 32:case 173:case 35:return-1;
case 176:case 177:case 7:case 155:case 8:case 157:case 125:case 126:case 92:case 93:case 129:case 130:case 131:case 94:case 91:return 1;case 74:case 60:case 69:case 70:case 4:return 1024;case 31:case 42:case 72:return 32;case 87:case 26:case 33:return 2147483647;case 34:case 1:return 47839;case 38:case 36:return 99;case 43:case 37:return 2048;case 0:return 2097152;case 3:return 65536;case 28:return 32768;case 44:return 32767;case 75:return 16384;case 39:return 1E3;case 89:return 700;case 71:return 256;
case 40:return 255;case 2:return 100;case 180:return 64;case 25:return 20;case 5:return 16;case 6:return 6;case 73:return 4;case 84:return 1}___setErrNo(ERRNO_CODES.EINVAL);return-1}function _time(a){var c=Math.floor(Date.now()/1E3);a&&(HEAP32[a>>2]=c);return c}
var Browser={mainLoop:{scheduler:null,shouldPause:!1,paused:!1,queue:[],pause:function(){Browser.mainLoop.shouldPause=!0},resume:function(){Browser.mainLoop.paused&&(Browser.mainLoop.paused=!1,Browser.mainLoop.scheduler());Browser.mainLoop.shouldPause=!1},updateStatus:function(){if(Module.setStatus){var a=Module.statusMessage||"Please wait...",c=Browser.mainLoop.remainingBlockers,d=Browser.mainLoop.expectedBlockers;c?c<d?Module.setStatus(a+" ("+(d-c)+"/"+d+")"):Module.setStatus(a):Module.setStatus("")}}},
isFullScreen:!1,pointerLock:!1,moduleContextCreatedCallbacks:[],workers:[],init:function(){function a(){Browser.pointerLock=document.pointerLockElement===d||document.mozPointerLockElement===d||document.webkitPointerLockElement===d}Module.preloadPlugins||(Module.preloadPlugins=[]);if(!Browser.initted&&!ENVIRONMENT_IS_WORKER){Browser.initted=!0;try{new Blob,Browser.hasBlobConstructor=!0}catch(c){Browser.hasBlobConstructor=!1,console.log("warning: no blob constructor, cannot create blobs with mimetypes")}Browser.BlobBuilder=
"undefined"!=typeof MozBlobBuilder?MozBlobBuilder:"undefined"!=typeof WebKitBlobBuilder?WebKitBlobBuilder:Browser.hasBlobConstructor?null:console.log("warning: no BlobBuilder");Browser.URLObject="undefined"!=typeof window?window.URL?window.URL:window.webkitURL:void 0;Module.noImageDecoding||"undefined"!==typeof Browser.URLObject||(console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available."),Module.noImageDecoding=!0);Module.preloadPlugins.push({canHandle:function(a){return!Module.noImageDecoding&&
/\.(jpg|jpeg|png|bmp)$/i.test(a)},handle:function(a,c,d,p){var x=null;if(Browser.hasBlobConstructor)try{x=new Blob([a],{type:Browser.getMimetype(c)}),x.size!==a.length&&(x=new Blob([(new Uint8Array(a)).buffer],{type:Browser.getMimetype(c)}))}catch(w){Runtime.warnOnce("Blob constructor present but fails: "+w+"; falling back to blob builder")}x||(x=new Browser.BlobBuilder,x.append((new Uint8Array(a)).buffer),x=x.getBlob());var P=Browser.URLObject.createObjectURL(x),N=new Image;N.onload=function(){assert(N.complete,
"Image "+c+" could not be decoded");var p=document.createElement("canvas");p.width=N.width;p.height=N.height;p.getContext("2d").drawImage(N,0,0);Module.preloadedImages[c]=p;Browser.URLObject.revokeObjectURL(P);d&&d(a)};N.onerror=function(a){console.log("Image "+P+" could not be decoded");p&&p()};N.src=P}});Module.preloadPlugins.push({canHandle:function(a){return!Module.noAudioDecoding&&a.substr(-4)in{".ogg":1,".wav":1,".mp3":1}},handle:function(a,c,d,p){function x(p){P||(P=!0,Module.preloadedAudios[c]=
p,d&&d(a))}function w(){P||(P=!0,Module.preloadedAudios[c]=new Audio,p&&p())}var P=!1;if(Browser.hasBlobConstructor){try{var N=new Blob([a],{type:Browser.getMimetype(c)})}catch(R){return w()}var N=Browser.URLObject.createObjectURL(N),I=new Audio;I.addEventListener("canplaythrough",function(){x(I)},!1);I.onerror=function(d){if(!P){console.log("warning: browser could not fully decode audio "+c+", trying slower base64 approach");d="data:audio/x-"+c.substr(-3)+";base64,";for(var l="",p=0,w=0,N=0;N<a.length;N++)for(p=
p<<8|a[N],w+=8;6<=w;)var R=p>>w-6&63,w=w-6,l=l+"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[R];2==w?(l+="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[(p&3)<<4],l+="=="):4==w&&(l+="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[(p&15)<<2],l+="=");I.src=d+l;x(I)}};I.src=N;Browser.safeSetTimeout(function(){x(I)},1E4)}else return w()}});var d=Module.canvas;d.requestPointerLock=d.requestPointerLock||d.mozRequestPointerLock||d.webkitRequestPointerLock;
d.exitPointerLock=document.exitPointerLock||document.mozExitPointerLock||document.webkitExitPointerLock||function(){};d.exitPointerLock=d.exitPointerLock.bind(document);document.addEventListener("pointerlockchange",a,!1);document.addEventListener("mozpointerlockchange",a,!1);document.addEventListener("webkitpointerlockchange",a,!1);Module.elementPointerLock&&d.addEventListener("click",function(a){!Browser.pointerLock&&d.requestPointerLock&&(d.requestPointerLock(),a.preventDefault())},!1)}},createContext:function(a,
c,d,g){var h;try{if(c){var l={antialias:!1,alpha:!1};if(g)for(var p in g)l[p]=g[p];["experimental-webgl","webgl"].some(function(c){return h=a.getContext(c,l)})}else h=a.getContext("2d");if(!h)throw":(";}catch(x){return Module.print("Could not create canvas - "+x),null}c&&(a.style.backgroundColor="black",a.addEventListener("webglcontextlost",function(a){alert("WebGL context lost. You will need to reload the page.")},!1));d&&(Module.ctx=h,Module.useWebGL=c,Browser.moduleContextCreatedCallbacks.forEach(function(a){a()}),
Browser.init());return h},destroyContext:function(a,c,d){},fullScreenHandlersInstalled:!1,lockPointer:void 0,resizeCanvas:void 0,requestFullScreen:function(a,c){function d(){Browser.isFullScreen=!1;(document.webkitFullScreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.mozFullscreenElement||document.fullScreenElement||document.fullscreenElement)===g?(g.cancelFullScreen=document.cancelFullScreen||document.mozCancelFullScreen||document.webkitCancelFullScreen,g.cancelFullScreen=
g.cancelFullScreen.bind(document),Browser.lockPointer&&g.requestPointerLock(),Browser.isFullScreen=!0,Browser.resizeCanvas&&Browser.setFullScreenCanvasSize()):Browser.resizeCanvas&&Browser.setWindowedCanvasSize();if(Module.onFullScreen)Module.onFullScreen(Browser.isFullScreen)}Browser.lockPointer=a;Browser.resizeCanvas=c;"undefined"===typeof Browser.lockPointer&&(Browser.lockPointer=!0);"undefined"===typeof Browser.resizeCanvas&&(Browser.resizeCanvas=!1);var g=Module.canvas;Browser.fullScreenHandlersInstalled||
(Browser.fullScreenHandlersInstalled=!0,document.addEventListener("fullscreenchange",d,!1),document.addEventListener("mozfullscreenchange",d,!1),document.addEventListener("webkitfullscreenchange",d,!1));g.requestFullScreen=g.requestFullScreen||g.mozRequestFullScreen||(g.webkitRequestFullScreen?function(){g.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT)}:null);g.requestFullScreen()},requestAnimationFrame:function(a){"undefined"===typeof window?setTimeout(a,1E3/60):(window.requestAnimationFrame||
(window.requestAnimationFrame=window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame||window.msRequestAnimationFrame||window.oRequestAnimationFrame||window.setTimeout),window.requestAnimationFrame(a))},safeCallback:function(a){return function(){if(!ABORT)return a.apply(null,arguments)}},safeRequestAnimationFrame:function(a){return Browser.requestAnimationFrame(function(){ABORT||a()})},safeSetTimeout:function(a,c){return setTimeout(function(){ABORT||a()},
c)},safeSetInterval:function(a,c){return setInterval(function(){ABORT||a()},c)},getMimetype:function(a){return{jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",bmp:"image/bmp",ogg:"audio/ogg",wav:"audio/wav",mp3:"audio/mpeg"}[a.substr(a.lastIndexOf(".")+1)]},getUserMedia:function(a){window.getUserMedia||(window.getUserMedia=navigator.getUserMedia||navigator.mozGetUserMedia);window.getUserMedia(a)},getMovementX:function(a){return a.movementX||a.mozMovementX||a.webkitMovementX||0},getMovementY:function(a){return a.movementY||
a.mozMovementY||a.webkitMovementY||0},mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,calculateMouseEvent:function(a){if(Browser.pointerLock)"mousemove"!=a.type&&"mozMovementX"in a?Browser.mouseMovementX=Browser.mouseMovementY=0:(Browser.mouseMovementX=Browser.getMovementX(a),Browser.mouseMovementY=Browser.getMovementY(a)),"undefined"!=typeof SDL?(Browser.mouseX=SDL.mouseX+Browser.mouseMovementX,Browser.mouseY=SDL.mouseY+Browser.mouseMovementY):(Browser.mouseX+=Browser.mouseMovementX,Browser.mouseY+=
Browser.mouseMovementY);else{var c=Module.canvas.getBoundingClientRect(),d;if("touchstart"==a.type||"touchend"==a.type||"touchmove"==a.type)if(a=a.touches.item(0))d=a.pageX-(window.scrollX+c.left),a=a.pageY-(window.scrollY+c.top);else return;else d=a.pageX-(window.scrollX+c.left),a=a.pageY-(window.scrollY+c.top);var g=Module.canvas.height;d*=Module.canvas.width/c.width;a*=g/c.height;Browser.mouseMovementX=d-Browser.mouseX;Browser.mouseMovementY=a-Browser.mouseY;Browser.mouseX=d;Browser.mouseY=a}},
xhrLoad:function(a,c,d){var g=new XMLHttpRequest;g.open("GET",a,!0);g.responseType="arraybuffer";g.onload=function(){200==g.status||0==g.status&&g.response?c(g.response):d()};g.onerror=d;g.send(null)},asyncLoad:function(a,c,d,g){Browser.xhrLoad(a,function(d){assert(d,'Loading data file "'+a+'" failed (no arrayBuffer).');c(new Uint8Array(d));g||removeRunDependency("al "+a)},function(c){if(d)d();else throw'Loading data file "'+a+'" failed.';});g||addRunDependency("al "+a)},resizeListeners:[],updateResizeListeners:function(){var a=
Module.canvas;Browser.resizeListeners.forEach(function(c){c(a.width,a.height)})},setCanvasSize:function(a,c,d){var g=Module.canvas;g.width=a;g.height=c;d||Browser.updateResizeListeners()},windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function(){var a=Module.canvas;this.windowedWidth=a.width;this.windowedHeight=a.height;a.width=screen.width;a.height=screen.height;"undefined"!=typeof SDL&&(a=HEAPU32[SDL.screen+0*Runtime.QUANTUM_SIZE>>2],HEAP32[SDL.screen+0*Runtime.QUANTUM_SIZE>>2]=a|8388608);
Browser.updateResizeListeners()},setWindowedCanvasSize:function(){var a=Module.canvas;a.width=this.windowedWidth;a.height=this.windowedHeight;"undefined"!=typeof SDL&&(a=HEAPU32[SDL.screen+0*Runtime.QUANTUM_SIZE>>2],HEAP32[SDL.screen+0*Runtime.QUANTUM_SIZE>>2]=a&-8388609);Browser.updateResizeListeners()}};FS.staticInit();__ATINIT__.unshift({func:function(){Module.noFSInit||FS.init.initialized||FS.init()}});__ATMAIN__.push({func:function(){FS.ignorePermissions=!1}});__ATEXIT__.push({func:function(){FS.quit()}});
Module.FS_createFolder=FS.createFolder;Module.FS_createPath=FS.createPath;Module.FS_createDataFile=FS.createDataFile;Module.FS_createPreloadedFile=FS.createPreloadedFile;Module.FS_createLazyFile=FS.createLazyFile;Module.FS_createLink=FS.createLink;Module.FS_createDevice=FS.createDevice;___errno_state=Runtime.staticAlloc(4);HEAP32[___errno_state>>2]=0;__ATINIT__.unshift({func:function(){TTY.init()}});__ATEXIT__.push({func:function(){TTY.shutdown()}});TTY.utf8=new Runtime.UTF8Processor;
if(ENVIRONMENT_IS_NODE){var fs=require("fs");NODEFS.staticInit()}__ATINIT__.push({func:function(){SOCKFS.root=FS.mount(SOCKFS,{},null)}});_fputc.ret=allocate([0],"i8",ALLOC_STATIC);Module.requestFullScreen=function(a,c){Browser.requestFullScreen(a,c)};Module.requestAnimationFrame=function(a){Browser.requestAnimationFrame(a)};Module.setCanvasSize=function(a,c,d){Browser.setCanvasSize(a,c,d)};Module.pauseMainLoop=function(){Browser.mainLoop.pause()};Module.resumeMainLoop=function(){Browser.mainLoop.resume()};
Module.getUserMedia=function(){Browser.getUserMedia()};STACK_BASE=STACKTOP=Runtime.alignMemory(STATICTOP);staticSealed=!0;STACK_MAX=STACK_BASE+5242880;DYNAMIC_BASE=DYNAMICTOP=Runtime.alignMemory(STACK_MAX);assert(DYNAMIC_BASE<TOTAL_MEMORY);Math_min=Math.min;function invoke_viiiiiiiiiiiii(a,c,d,g,h,l,p,x,w,P,N,R,I,fa){try{Module.dynCall_viiiiiiiiiiiii(a,c,d,g,h,l,p,x,w,P,N,R,I,fa)}catch(pa){if("number"!==typeof pa&&"longjmp"!==pa)throw pa;asm.setThrew(1,0)}}
function invoke_viiiiii(a,c,d,g,h,l,p){try{Module.dynCall_viiiiii(a,c,d,g,h,l,p)}catch(x){if("number"!==typeof x&&"longjmp"!==x)throw x;asm.setThrew(1,0)}}function invoke_vi(a,c){try{Module.dynCall_vi(a,c)}catch(d){if("number"!==typeof d&&"longjmp"!==d)throw d;asm.setThrew(1,0)}}function invoke_v(a){try{Module.dynCall_v(a)}catch(c){if("number"!==typeof c&&"longjmp"!==c)throw c;asm.setThrew(1,0)}}
function invoke_iiii(a,c,d,g){try{return Module.dynCall_iiii(a,c,d,g)}catch(h){if("number"!==typeof h&&"longjmp"!==h)throw h;asm.setThrew(1,0)}}function invoke_ii(a,c){try{return Module.dynCall_ii(a,c)}catch(d){if("number"!==typeof d&&"longjmp"!==d)throw d;asm.setThrew(1,0)}}function invoke_viii(a,c,d,g){try{Module.dynCall_viii(a,c,d,g)}catch(h){if("number"!==typeof h&&"longjmp"!==h)throw h;asm.setThrew(1,0)}}
function invoke_iiiiiiiiiifiiiiiiiiii(a,c,d,g,h,l,p,x,w,P,N,R,I,fa,pa,va,za,ra,La,$,Qa){try{return Module.dynCall_iiiiiiiiiifiiiiiiiiii(a,c,d,g,h,l,p,x,w,P,N,R,I,fa,pa,va,za,ra,La,$,Qa)}catch($a){if("number"!==typeof $a&&"longjmp"!==$a)throw $a;asm.setThrew(1,0)}}function invoke_viiiifiiiiiiiifi(a,c,d,g,h,l,p,x,w,P,N,R,I,fa,pa,va){try{Module.dynCall_viiiifiiiiiiiifi(a,c,d,g,h,l,p,x,w,P,N,R,I,fa,pa,va)}catch(za){if("number"!==typeof za&&"longjmp"!==za)throw za;asm.setThrew(1,0)}}
function invoke_iii(a,c,d){try{return Module.dynCall_iii(a,c,d)}catch(g){if("number"!==typeof g&&"longjmp"!==g)throw g;asm.setThrew(1,0)}}function invoke_viiii(a,c,d,g,h){try{Module.dynCall_viiii(a,c,d,g,h)}catch(l){if("number"!==typeof l&&"longjmp"!==l)throw l;asm.setThrew(1,0)}}function asmPrintInt(a,c){Module.print("int "+a+","+c)}function asmPrintFloat(a,c){Module.print("float "+a+","+c)}
var asm=function(a,c,d){function g(ma,a,e){ma|=0;a|=0;e|=0;var c=0,E=0,q=0,d=0,k=0,n=0,v=0,r=0,m=0,c=f,E=ma+8|0,q=ma+12|0,d=ma+24|0;if((((b[q>>2]|0)+e>>3)+(b[E>>2]|0)|0)>=(b[d>>2]|0)){k=b[Oa>>2]|0;sa(k|0,12744,(n=f,f=f+8|0,b[n>>2]=13288,n)|0)|0;f=n;if(0==(b[ma+16>>2]|0)){sa(k|0,12864,(n=f,f=f+8|0,b[n>>2]=12944,n)|0)|0;f=n;f=c;return}v=(3*(b[d>>2]|0)|0)+15>>1;r=ma|0;m=Ab(b[r>>2]|0,v)|0;if(0!=(m|0))b[d>>2]=v,b[r>>2]=m;else{sa(k|0,12864,(n=f,f=f+8|0,b[n>>2]=13144,n)|0)|0;f=n;f=c;return}}if(0!=(e|0)){d=
ma|0;n=ma+4|0;ma=e;do ma=ma-1|0,e=(b[d>>2]|0)+(b[E>>2]|0)|0,C[e]=(Rc[e]|0|(a>>>(ma>>>0)&1)<<7-(b[q>>2]|0))&255,e=(b[q>>2]|0)+1|0,b[q>>2]=e,8==(e|0)&&(b[q>>2]=0,e=(b[E>>2]|0)+1|0,b[E>>2]=e,C[(b[d>>2]|0)+e|0]=0),b[n>>2]=(b[n>>2]|0)+1;while(0!=(ma|0))}f=c}function h(ma,a){ma|=0;a|=0;var e=0,c=0,E=0,q=0,f=0,k=0,d=0,v=d=d=c=0,e=ma+8|0,c=b[e>>2]|0,E=ma+12|0,q=b[E>>2]|0,f=ma+20|0;if((q+a+(c<<3)|0)>(b[ma+4>>2]|0))return b[f>>2]=1,0;if(0!=(b[f>>2]|0)|0==(a|0))return 0;f=b[ma>>2]|0;ma=a;a=0;d=c;for(c=q;;)if(q=
(C[f+d|0]|0)>>>((7-c|0)>>>0)&1|a<<1,c=c+1|0,b[E>>2]=c,8==(c|0)?(b[E>>2]=0,d=d+1|0,b[e>>2]=d,v=0):v=c,c=ma-1|0,0==(c|0)){k=q;break}else ma=c,a=q,c=v;return k|0}function l(ma){ma|=0;var a=0,e=0,c=0,a=0,a=b[ma+8>>2]|0,e=b[ma+12>>2]|0,c=ma+20|0;if((e+1+(a<<3)|0)>(b[ma+4>>2]|0))return b[c>>2]=1,0;if(0!=(b[c>>2]|0))return 0;a=(C[(b[ma>>2]|0)+a|0]|0)>>>((7-e|0)>>>0)&1;return a|0}function p(ma,a){ma|=0;var e=0,c=0,E=0,q=0,e=ma+8|0,c=b[e>>2]|0,E=ma+12|0,q=(b[E>>2]|0)+(a|0)|0;a=ma+20|0;(q+(c<<3)|0)<=(b[ma+
4>>2]|0)&&0==(b[a>>2]|0)?(b[e>>2]=(q>>3)+c,b[E>>2]=q&7):b[a>>2]=1}function x(ma){ma|=0;var a=0;if(0!=(b[ma+20>>2]|0))return-1;a=(b[ma+4>>2]|0)-(b[ma+12>>2]|0)-(b[ma+8>>2]<<3)|0;return a|0}function w(ma,a,S,c,E,q,d,k,n,v,r,m,u){ma|=0;a|=0;S|=0;c|=0;E|=0;q|=0;d|=0;k|=0;n|=0;v|=0;r|=0;m|=0;u|=0;var t=0,F=0,H=0,h=0,z=0,B=0,A=0,y=0,l=0,p=0,D=0,G=0,Ra=0,J=0,Pa=0,O=0,ka=0,K=0,L=0,x=0,w=0,M=0,R=0,ca=0,Y=0,U=0,Q=0,T=0,da=0,Sa=0,$=0,ja=0,I=0,pa=0,ea=0,X=0,ba=0,ia=0,W=0,ha=0,Z=0,ga=0,qa=0,oa=0,fa=0,ra=Z=0,V=
ga=0,aa=0,za=fa=0,Aa=0,la=0,ia=0,t=f,F=10<(m|0)?20:m<<1;m=3>(F|0)?1:(F|0)/3|0;if(1==(m|0))P(ma,a,S,c,E,q,d,k,n,v,r,u);else{F=Xa()|0;H=f;f=f+(4*m|0)|0;h=f=f+7&-8;f=f+(4*m|0)|0;z=f=f+7&-8;f=f+(4*m|0)|0;B=f=f+7&-8;f=f+(4*m|0)|0;f=f+7&-8;A=b[E>>2]|0;y=b[E+4>>2]|0;l=E+12|0;p=b[l>>2]|0;D=1<<p;G=b[E+8>>2]|0;Ra=b[E+16>>2]|0;E=f;f=f+(4*(A<<p)|0)|0;p=f=f+7&-8;f=f+(4*D|0)|0;J=f=f+7&-8;f=f+(4*d|0)|0;Pa=f=f+7&-8;f=f+(4*d|0)|0;f=f+7&-8;O=Pa;ka=f;f=f+(4*y|0)|0;f=f+7&-8;K=m<<1;L=ta(K,d)|0;x=f;f=f+(4*L|0)|0;f=f+7&
-8;if(L=0<(m|0)){w=0;do M=w<<1,b[H+(w<<2)>>2]=x+((ta(M,d)|0)<<2),b[h+(w<<2)>>2]=x+((ta(M|1,d)|0)<<2),w=w+1|0;while((w|0)<(m|0))}w=f;f=f+(4*m|0)|0;x=f=f+7&-8;f=f+(4*m|0)|0;M=f=f+7&-8;f=f+(4*m|0)|0;f=f+7&-8;R=M;ca=f;f=f+(4*m|0)|0;f=f+7&-8;Y=ca;U=f;f=f+(4*m|0)|0;f=f+7&-8;Q=U;T=f;f=f+(4*m|0)|0;f=f+7&-8;da=T;Sa=ta(y,K)|0;K=f;f=f+(4*Sa|0)|0;f=f+7&-8;if(L){Sa=0;do $=Sa<<1,b[B+(Sa<<2)>>2]=K+((ta($,y)|0)<<2),b[z+(Sa<<2)>>2]=K+((ta($|1,y)|0)<<2),Sa=Sa+1|0;while((Sa|0)<(m|0));Sa=J;ja=d<<2;Fa(Sa|0,ma|0,ja)|0;
if(L){I=0;do $=b[H+(I<<2)>>2]|0,Fa($|0,Sa|0,ja)|0,I=I+1|0;while((I|0)<(m|0));N(G,n,E,p,D,A);L&&wa(da|0,0,m<<2|0)}else pa=142}else Fa(J|0,ma|0,d<<2)|0,pa=142;142==(pa|0)&&N(G,n,E,p,D,A);pa=0<(y|0);do if(pa){J=0<(A|0);I=0==(Ra|0);K=m-1|0;$=U+(K<<2)|0;Sa=m<<2;ja=h;ea=H;for(X=0;;){if(L){ba=0;do e[U+(ba<<2)>>2]=999999986991104,ba=ba+1|0;while((ba|0)<(m|0));L&&(wa(Y|0,0,Sa|0),wa(R|0,0,Sa|0))}ba=ta(X,A)|0;ia=0==(X|0);for(W=0;!((W|0)>=(m|0));){ha=b[ea+(W<<2)>>2]|0;Z=ha+(ba<<2)|0;if(J){qa=ga=0;do oa=+e[ha+
(qa+ba<<2)>>2],ga+=oa*oa,qa=qa+1|0;while((qa|0)<(A|0));fa=0.5*ga}else fa=0;I?Hb(Z,E,A,D,p,m,w,x,r):Ib(Z,E,A,D,p,m,w,x,r);if(L){oa=+e[T+(W<<2)>>2];qa=0;do{Z=fa+(oa+ +e[x+(qa<<2)>>2]);a:do if(Z<+e[$>>2]){for(ha=0;;){if((ha|0)>=(m|0))break a;ra=U+(ha<<2)|0;if(Z<+e[ra>>2])break;else ha=ha+1|0}if((K|0)>(ha|0))for(ga=K;;)if(V=ga-1|0,e[U+(ga<<2)>>2]=+e[U+(V<<2)>>2],b[M+(ga<<2)>>2]=b[M+(V<<2)>>2],b[ca+(ga<<2)>>2]=b[ca+(V<<2)>>2],(V|0)>(ha|0))ga=V;else{aa=ha;break}else aa=K;e[ra>>2]=Z;b[M+(aa<<2)>>2]=b[w+
(qa<<2)>>2];b[ca+(aa<<2)>>2]=W}while(0);qa=qa+1|0}while((qa|0)<(m|0))}if(ia)break;else W=W+1|0}if(L){W=ta(X+1|0,A)|0;ia=(W|0)<(d|0);ba=d-W|0;qa=0<(ba|0);Z=0;do{if(ia){ha=ja+(Z<<2)|0;ga=b[ca+(Z<<2)>>2]|0;V=W;do e[(b[ha>>2]|0)+(V<<2)>>2]=+e[(b[ea+(ga<<2)>>2]|0)+(V<<2)>>2],V=V+1|0;while((V|0)<(d|0))}if(J){V=ja+(Z<<2)|0;ga=b[M+(Z<<2)>>2]|0;ha=0;do{fa=(ga|0)<(D|0);za=A-ha|0;oa=(fa?0.03125:-0.03125)*+(C[G+((ta(ga-(fa?0:D)|0,A)|0)+ha)|0]|0);fa=b[V>>2]|0;if(qa){Aa=0;do la=fa+(Aa+W<<2)|0,e[la>>2]=+e[la>>2]-
oa*+e[n+(za+Aa<<2)>>2],Aa=Aa+1|0;while((Aa|0)<(ba|0))}ha=ha+1|0}while((ha|0)<(A|0))}ha=b[z+(b[ca+(Z<<2)>>2]<<2)>>2]|0;V=B+(Z<<2)|0;ga=b[V>>2]|0;Aa=0;do b[ga+(Aa<<2)>>2]=b[ha+(Aa<<2)>>2],Aa=Aa+1|0;while((Aa|0)<(y|0));b[(b[V>>2]|0)+(X<<2)>>2]=b[M+(Z<<2)>>2];Z=Z+1|0}while((Z|0)<(m|0));if(L){ia=0;do{Z=b[B+(ia<<2)>>2]|0;ba=b[z+(ia<<2)>>2]|0;W=0;do b[ba+(W<<2)>>2]=b[Z+(W<<2)>>2],W=W+1|0;while((W|0)<(y|0));ia=ia+1|0}while((ia|0)<(m|0));L&&Fa(da|0,Q|0,Sa)|0}}W=X+1|0;if((W|0)<(y|0))Z=ja,ja=ea,X=W,ea=Z;else break}if(pa){ea=
b[B>>2]|0;X=0;do ja=b[ea+(X<<2)>>2]|0,b[ka+(X<<2)>>2]=ja,g(v,ja,(b[l>>2]|0)+Ra|0),X=X+1|0;while((X|0)<(y|0));if(pa){X=0<(A|0);ea=0;do{ja=b[ka+(ea<<2)>>2]|0;oa=(Sa=(ja|0)<(D|0))?0.03125:-0.03125;if(X){J=ta(ja-(Sa?0:D)|0,A)|0;Sa=ta(ea,A)|0;ja=0;do e[Pa+(ja+Sa<<2)>>2]=oa*+(C[G+(ja+J)|0]|0),ja=ja+1|0;while((ja|0)<(A|0))}ea=ea+1|0}while((ea|0)<(y|0))}}}while(0);if(y=0<(d|0)){A=0;do G=k+(A<<2)|0,e[G>>2]=+e[G>>2]+ +e[Pa+(A<<2)>>2],A=A+1|0;while((A|0)<(d|0))}if(0!=(u|0)){u=Xa()|0;A=f;f=f+(4*d|0)|0;f=f+7&
-8;if(y){Fa(A|0,O|0,d<<2)|0;nb(A,a,S,c,A,d,q,r);Pa=0;do O=ma+(Pa<<2)|0,e[O>>2]=+e[O>>2]-+e[A+(Pa<<2)>>2],Pa=Pa+1|0;while((Pa|0)<(d|0))}else nb(A,a,S,c,A,d,q,r);Ya(u|0)}Ya(F|0)}f=t}function P(ma,a,S,c,E,q,d,k,n,v,r,m){ma|=0;a|=0;S|=0;c|=0;E|=0;q|=0;d|=0;k|=0;n|=0;v|=0;r|=0;m|=0;var u=0,t=0,F=0,H=0,h=0,z=0,B=0,A=0,y=0,l=0,p=0,D=0,G=0,Ra=0,J=0,Pa=0,O=0,ka=0,K=0,L=0,x=0,w=0,M=x=x=0,P=0,ca=0,Y=0,U=0,Q=0,T=0,da=0,u=f;f=f+16|0;t=u|0;F=u+8|0;H=b[E>>2]|0;h=b[E+4>>2]|0;z=E+12|0;B=b[z>>2]|0;A=1<<B;y=b[E+8>>
2]|0;l=b[E+16>>2]|0;E=f;f=f+(4*(H<<B)|0)|0;B=f=f+7&-8;f=f+(4*A|0)|0;p=f=f+7&-8;f=f+(4*d|0)|0;D=f=f+7&-8;f=f+(4*d|0)|0;f=f+7&-8;G=D;Fa(p|0,ma|0,d<<2)|0;N(y,n,E,B,A,H);if(0<(h|0))for(Pa=0==(l|0),J=0<(H|0),Ra=0;;){O=ta(Ra,H)|0;ka=p+(O<<2)|0;Pa?Hb(ka,E,H,A,B,1,t,F,r):Ib(ka,E,H,A,B,1,t,F,r);g(v,b[t>>2]|0,(b[z>>2]|0)+l|0);ka=b[t>>2]|0;K=(ka|0)<(A|0);L=ta(ka-(K?0:A)|0,H)|0;do if(K)if(J)for(x=0;;)if(ka=p+(x+O<<2)|0,e[ka>>2]=+e[ka>>2]-+e[E+(x+L<<2)>>2],ka=x+1|0,(ka|0)<(H|0))x=ka;else{w=221;break}else w=225;
else if(J)for(x=0;;)if(ka=p+(x+O<<2)|0,e[ka>>2]=+e[ka>>2]+ +e[E+(x+L<<2)>>2],ka=x+1|0,(ka|0)<(H|0))x=ka;else{w=221;break}else w=225;while(0);do if(221==(w|0))if(w=0,J){x=K?0.03125:-0.03125;ka=0;do e[D+(ka+O<<2)>>2]=x*+(C[y+(ka+L)|0]|0),ka=ka+1|0;while((ka|0)<(H|0));if(J)for(ka=Ra+1|0,M=ta(ka,H)|0,P=d-M|0,ca=0<(P|0),Y=0;;){U=H-Y|0;x=(K?0.03125:-0.03125)*+(C[y+(L+Y)|0]|0);if(ca){Q=0;do T=p+(Q+M<<2)|0,e[T>>2]=+e[T>>2]-x*+e[n+(U+Q<<2)>>2],Q=Q+1|0;while((Q|0)<(P|0))}Q=Y+1|0;if((Q|0)<(H|0))Y=Q;else{da=
ka;break}}else w=225}else w=225;while(0);225==(w|0)&&(w=0,da=Ra+1|0);if((da|0)<(h|0))Ra=da;else break}if(da=0<(d|0)){Ra=0;do h=k+(Ra<<2)|0,e[h>>2]=+e[h>>2]+ +e[D+(Ra<<2)>>2],Ra=Ra+1|0;while((Ra|0)<(d|0))}if(0!=(m|0)){m=Xa()|0;Ra=f;f=f+(4*d|0)|0;f=f+7&-8;if(da){da=Ra;Fa(da|0,G|0,d<<2)|0;nb(Ra,a,S,c,Ra,d,q,r);D=0;do G=ma+(D<<2)|0,e[G>>2]=+e[G>>2]-+e[Ra+(D<<2)>>2],D=D+1|0;while((D|0)<(d|0))}else nb(Ra,a,S,c,Ra,d,q,r);Ya(m|0)}f=u}function N(b,a,S,c,E,q){b|=0;a|=0;S|=0;c|=0;E|=0;q|=0;var d=0,k=0,n=0,v=
0,r=0,m=0,g=0,t=0,g=0,k=d=f;f=f+(4*q|0)|0;f=f+7&-8;if(!(0>=(E|0)))if(0<(q|0)){n=0;do{v=ta(n,q)|0;r=0;do e[k+(r<<2)>>2]=+(C[b+(r+v)|0]|0),r=r+1|0;while((r|0)<(q|0));r=c+(n<<2)|0;m=e[r>>2]=0;do{t=g=0;do t+=+e[k+(g<<2)>>2]*+e[a+(m-g<<2)>>2],g=g+1|0;while((g|0)<=(m|0));g=0.03125*t;e[r>>2]=g*g+ +e[r>>2];e[S+(m+v<<2)>>2]=g;m=m+1|0}while((m|0)<(q|0));n=n+1|0}while((n|0)<(E|0))}else wa(c|0,0,E<<2|0);f=d}function R(ma,a,S,c,E,q){ma|=0;a|=0;c|=0;var d=0,k=0,n=0,v=0,r=0,m=0,g=0,t=0;q=f;E=b[a>>2]|0;S=b[a+4>>
2]|0;d=a+12|0;k=b[a+8>>2]|0;n=f;f=f+(4*S|0)|0;v=f=f+7&-8;f=f+(4*S|0)|0;f=f+7&-8;if(r=0<(S|0)){m=0==(b[a+16>>2]|0);a=0;do b[v+(a<<2)>>2]=m?0:h(c,1)|0,b[n+(a<<2)>>2]=h(c,b[d>>2]|0)|0,a=a+1|0;while((a|0)<(S|0));if(r){r=0<(E|0);a=0;do{g=0==(b[v+(a<<2)>>2]|0)?0.03125:-0.03125;if(r){d=ta(b[n+(a<<2)>>2]|0,E)|0;c=ta(a,E)|0;m=0;do t=ma+(m+c<<2)|0,e[t>>2]=+e[t>>2]+g*+(C[k+(d+m)|0]|0),m=m+1|0;while((m|0)<(E|0))}a=a+1|0}while((a|0)<(S|0))}}f=q}function I(b,a,S,c,E,q,d,k,n,g,r,m,u){b|=0;d|=0;k|=0;m=u=f;f=f+(4*
d|0)|0;f=f+7&-8;Wb(b,a|0,S|0,c|0,m,d,q|0,r|0);if(0<(d|0)){r=0;do q=k+(r<<2)|0,e[q>>2]=+e[m+(r<<2)>>2]+ +e[q>>2],r=r+1|0;while((r|0)<(d|0))}wa(b|0,0,d<<2|0);f=u}function fa(a,c,S,cb,E,q){a|=0;S|=0;q|=0;c=0;if(0<(S|0)){c=0;do E=(ta(b[q>>2]|0,1664525)|0)+1013904223|0,b[q>>2]=E,e[a+(c<<2)>>2]=3.4642*((b[db>>2]=E&8388607|1065353216,+e[db>>2])+-1.5),c=c+1|0;while((c|0)<(S|0))}}function pa(b,a,S,c){b=+b;a|=0;S|=0;c|=0;var E=0,q=0,E=0;if(0<(c|0))for(E=0,q=b;;)if(e[S+(E<<2)>>2]=q*+e[a+(E<<2)>>2],E=E+1|0,(E|
0)<(c|0))q*=b;else break}function va(b,a,S,c){b|=0;a=+a;S=+S;c|=0;var E=0,q=0,f=0;if(0<(c|0)){E=0;do q=b+(E<<2)|0,f=+e[q>>2],f<a|f>S&&(e[q>>2]=f<a?a:f>S?S:0),E=E+1|0;while((E|0)<(c|0))}}function za(b,a,S,c,f){b|=0;a|=0;S|=0;c|=0;f|=0;var q=0,d=0,k=0,n=0,g=0,r=0,m=0,u=0,t=0,q=4<(c|0)?4:c;if(!(0>=(S|0))){d=+e[3280+(12*q|0)>>2];c=f+4|0;k=+e[3284+(12*q|0)>>2];n=-0-+e[3348+(12*q|0)>>2];g=+e[3288+(12*q|0)>>2];r=-0-+e[3352+(12*q|0)>>2];q=0;do m=b+(q<<2)|0,u=+e[m>>2],t=d*u+ +e[f>>2],e[f>>2]=+e[c>>2]+u*k+
t*n,e[c>>2]=g*+e[m>>2]+t*r,e[a+(q<<2)>>2]=t,q=q+1|0;while((q|0)<(S|0))}}function ra(b,a,S,c){b|=0;a|=0;S=+S;c|=0;var f=0;if(0<(c|0)){f=0;do e[a+(f<<2)>>2]=+e[b+(f<<2)>>2]*S,f=f+1|0;while((f|0)<(c|0))}}function La(b,a,S,c){b|=0;a|=0;c|=0;var f=0,q=0,f=1/+S;if(0<(c|0)){q=0;do e[a+(q<<2)>>2]=f*+e[b+(q<<2)>>2],q=q+1|0;while((q|0)<(c|0))}}function $(b,a){b|=0;a|=0;var S=0,c=0,f=0,q=S=c=0;if(0<(a|0))for(c=S=0;;){if(f=+e[b+(S<<2)>>2],c+=f*f,S=S+1|0,!((S|0)<(a|0))){q=c;break}}else q=0;return+ +Wa(q/+(a|0)+
0.1)}function Qa(b,a){b|=0;a|=0;var S=0,c=0,f=0,q=S=c=0;if(0<(a|0))for(c=S=0;;){if(f=+e[b+(S<<2)>>2],c+=f*f,S=S+1|0,!((S|0)<(a|0))){q=c;break}}else q=0;return+ +Wa(q/+(a|0)+0.1)}function $a(b,a,S,c,f,q,d,k){b|=0;a|=0;S|=0;c|=0;f|=0;d|=0;var n=0,g=0,r=0,m=0,u=0;if(!(0>=(f|0)))if(k=(q|0)-1|0,0<(k|0)){n=0;do{r=+e[b+(n<<2)>>2];g=r+ +e[d>>2];m=-0-g;for(q=0;;)if(u=q+1|0,e[d+(q<<2)>>2]=+e[d+(u<<2)>>2]+r*+e[a+(q<<2)>>2]+ +e[S+(q<<2)>>2]*m,(u|0)<(k|0))q=u;else break;e[d+(k<<2)>>2]=r*+e[a+(k<<2)>>2]+ +e[S+
(k<<2)>>2]*m;e[c+(n<<2)>>2]=g;n=n+1|0}while((n|0)<(f|0))}else{q=0;do g=+e[b+(q<<2)>>2],r=g+ +e[d>>2],e[d+(k<<2)>>2]=g*+e[a+(k<<2)>>2]+ +e[S+(k<<2)>>2]*(-0-r),e[c+(q<<2)>>2]=r,q=q+1|0;while((q|0)<(f|0))}}function Za(b,a,S,c,f,q,d){b|=0;a|=0;S|=0;c|=0;q|=0;var k=0,n=0,g=0,r=0;if(!(0>=(c|0)))if(d=(f|0)-1|0,0<(d|0)){k=0;do{n=+e[b+(k<<2)>>2]+ +e[q>>2];g=-0-n;for(f=0;;)if(r=f+1|0,e[q+(f<<2)>>2]=+e[q+(r<<2)>>2]+ +e[a+(f<<2)>>2]*g,(r|0)<(d|0))f=r;else break;e[q+(d<<2)>>2]=+e[a+(d<<2)>>2]*g;e[S+(k<<2)>>2]=
n;k=k+1|0}while((k|0)<(c|0))}else{f=0;do n=+e[b+(f<<2)>>2]+ +e[q>>2],e[q+(d<<2)>>2]=+e[a+(d<<2)>>2]*(-0-n),e[S+(f<<2)>>2]=n,f=f+1|0;while((f|0)<(c|0))}}function Bb(b,a,c,f,d,q,xa){b|=0;a|=0;c|=0;f|=0;q|=0;var k=0,n=0,g=0,r=0;if(!(0>=(f|0)))if(xa=(d|0)-1|0,0<(xa|0)){k=0;do{g=+e[b+(k<<2)>>2];n=g+ +e[q>>2];for(d=0;;)if(r=d+1|0,e[q+(d<<2)>>2]=+e[q+(r<<2)>>2]+g*+e[a+(d<<2)>>2],(r|0)<(xa|0))d=r;else break;e[q+(xa<<2)>>2]=g*+e[a+(xa<<2)>>2];e[c+(k<<2)>>2]=n;k=k+1|0}while((k|0)<(f|0))}else{d=0;do n=+e[b+
(d<<2)>>2],g=n+ +e[q>>2],e[q+(xa<<2)>>2]=n*+e[a+(xa<<2)>>2],e[c+(d<<2)>>2]=g,d=d+1|0;while((d|0)<(f|0))}}function nb(b,a,c,d,E,q,g,k){b|=0;a|=0;c|=0;d|=0;E|=0;q|=0;g|=0;var n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,h=0,z=0,B=0,A=0,h=F=t=u=0,n=k=f;f=f+(4*g|0)|0;f=f+7&-8;v=n;(r=0<(g|0))&&wa(v|0,0,g<<2|0);m=0<(q|0);a:do if(m){u=g-1|0;t=a+(u<<2)|0;F=n+(u<<2)|0;if(0<(u|0))H=0;else for(h=0;;)if(z=+e[b+(h<<2)>>2]+ +e[n>>2],e[F>>2]=+e[t>>2]*(-0-z),e[E+(h<<2)>>2]=z,h=h+1|0,(h|0)>=(q|0))break a;do{z=+e[b+(H<<2)>>2]+
+e[n>>2];B=-0-z;for(h=0;;)if(A=h+1|0,e[n+(h<<2)>>2]=+e[n+(A<<2)>>2]+ +e[a+(h<<2)>>2]*B,(A|0)<(u|0))h=A;else break;e[F>>2]=+e[t>>2]*B;e[E+(H<<2)>>2]=z;H=H+1|0}while((H|0)<(q|0))}while(0);r&&wa(v|0,0,g<<2|0);if(m)if(m=g-1|0,g=c+(m<<2)|0,v=d+(m<<2)|0,r=n+(m<<2)|0,0<(m|0)){u=0;do{H=E+(u<<2)|0;F=+e[H>>2];t=F+ +e[n>>2];h=-0-t;for(a=0;;)if(b=a+1|0,e[n+(a<<2)>>2]=+e[n+(b<<2)>>2]+F*+e[c+(a<<2)>>2]+ +e[d+(a<<2)>>2]*h,(b|0)<(m|0))a=b;else break;e[r>>2]=F*+e[g>>2]+ +e[v>>2]*h;e[H>>2]=t;u=u+1|0}while((u|0)<(q|
0))}else{H=0;do a=E+(H<<2)|0,t=+e[a>>2],F=t+ +e[n>>2],e[r>>2]=t*+e[g>>2]+ +e[v>>2]*(-0-F),e[a>>2]=F,H=H+1|0;while((H|0)<(q|0))}f=k}function Wb(b,a,c,d,E,q,g,k){b|=0;a|=0;c|=0;d|=0;E|=0;q|=0;g|=0;var n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,h=0,z=0,B=0,A=0,y=0,l=0,F=t=u=0,n=k=f;f=f+(4*g|0)|0;f=f+7&-8;v=n;(r=0<(g|0))&&wa(v|0,0,g<<2|0);m=0<(q|0);a:do if(m){u=g-1|0;t=a+(u<<2)|0;F=c+(u<<2)|0;H=n+(u<<2)|0;if(0<(u|0))h=0;else for(z=0;;)if(B=+e[b+(z<<2)>>2],A=B+ +e[n>>2],e[H>>2]=B*+e[t>>2]+ +e[F>>2]*(-0-A),e[E+(z<<
2)>>2]=A,z=z+1|0,(z|0)>=(q|0))break a;do{A=+e[b+(h<<2)>>2];B=A+ +e[n>>2];y=-0-B;for(z=0;;)if(l=z+1|0,e[n+(z<<2)>>2]=+e[n+(l<<2)>>2]+A*+e[a+(z<<2)>>2]+ +e[c+(z<<2)>>2]*y,(l|0)<(u|0))z=l;else break;e[H>>2]=A*+e[t>>2]+ +e[F>>2]*y;e[E+(h<<2)>>2]=B;h=h+1|0}while((h|0)<(q|0))}while(0);r&&wa(v|0,0,g<<2|0);if(m)if(m=g-1|0,g=d+(m<<2)|0,v=n+(m<<2)|0,0<(m|0)){u=0;do{r=E+(u<<2)|0;F=+e[r>>2];t=+e[n>>2];for(h=0;;)if(c=h+1|0,e[n+(h<<2)>>2]=+e[n+(c<<2)>>2]+F*+e[d+(h<<2)>>2],(c|0)<(m|0))h=c;else break;e[v>>2]=F*+e[g>>
2];e[r>>2]=F+t;u=u+1|0}while((u|0)<(q|0))}else{r=0;do h=E+(r<<2)|0,t=+e[h>>2],F=t+ +e[n>>2],e[v>>2]=t*+e[g>>2],e[h>>2]=F,r=r+1|0;while((r|0)<(q|0))}f=k}function Jb(b,a,c,d,E,q,g){b|=0;a|=0;c|=0;d|=0;E|=0;q|=0;var k=0,n=0,v=0,r=0,m=0,u=0,t=u=m=m=0,n=0,k=g=f;f=f+(4*q|0)|0;f=f+7&-8;n=k;v=f;f=f+(4*q|0)|0;f=f+7&-8;e[d>>2]=1;if(r=0<(q|0)){for(m=0;;)if(u=m+1|0,e[d+(u<<2)>>2]=+e[a+(m<<2)>>2],(u|0)<(q|0))m=u;else break;m=q+1|0}else m=1;if((m|0)<(E|0)){do e[d+(m<<2)>>2]=1.0000000036274937E-15,m=m+1|0;while((m|
0)<(E|0))}r&&(r=q<<2,wa(v|0,0,r|0),wa(n|0,0,r|0));if(!(0>=(E|0)))if(r=q-1|0,0<(r|0)){m=0;do{q=d+(m<<2)|0;t=+e[q>>2]+ +e[k>>2];u=-0-t;n=t+ +e[v>>2];e[q>>2]=n;t=-0-n;for(q=0;;)if(n=q+1|0,e[k+(q<<2)>>2]=+e[k+(n<<2)>>2]+ +e[c+(q<<2)>>2]*u,e[v+(q<<2)>>2]=+e[v+(n<<2)>>2]+ +e[b+(q<<2)>>2]*t,(n|0)<(r|0))q=n;else break;e[k+(r<<2)>>2]=+e[c+(r<<2)>>2]*u;e[v+(r<<2)>>2]=+e[b+(r<<2)>>2]*t;m=m+1|0}while((m|0)<(E|0))}else{q=0;do n=d+(q<<2)|0,u=+e[n>>2]+ +e[k>>2],t=u+ +e[v>>2],e[n>>2]=t,e[k+(r<<2)>>2]=+e[c+(r<<2)>>
2]*(-0-u),e[v+(r<<2)>>2]=+e[b+(r<<2)>>2]*(-0-t),q=q+1|0;while((q|0)<(E|0))}f=g}function Xb(b,a,c,d,E,q,g,k){b|=0;a|=0;c|=0;d|=0;E|=0;q|=0;g|=0;var n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,h=0,z=0,B=0,A=0,y=0,l=0,p=h=H=F=0,D=0,n=k=f;f=f+(4*q|0)|0;f=f+7&-8;v=E-1|0;r=f;f=f+(4*(v+q|0)|0)|0;f=f+7&-8;m=q-1|0;u=q>>1;if(0<(q|0)){t=0;do e[n+(m-t<<2)>>2]=+e[a+(t<<2)>>2],t=t+1|0;while((t|0)<(q|0))}if(t=0<(m|0)){a=q-2|0;q=0;do e[r+(q<<2)>>2]=+e[g+(a-q<<2)>>2],q=q+1|0;while((q|0)<(m|0))}(q=0<(E|0))&&Fa(r+(m<<2)|0,b|0,
E<<2)|0;if(t){t=0;do e[g+(t<<2)>>2]=+e[b+(v-t<<2)>>2],t=t+1|0;while((t|0)<(m|0))}if(q)for(q=0<(u|0),v=t=0;;){if(q)for(b=v+m|0,h=H=g=0;;)if(z=+e[n+(g<<2)>>2],B=+e[r+(g+v<<2)>>2],A=+e[r+(b-g<<2)>>2],F=g|1,y=+e[n+(F<<2)>>2],l=+e[r+(F+v<<2)>>2],F=+e[r+(b-F<<2)>>2],H=H+z*(B+A)+y*(l+F),h=h-z*(B-A)+y*(l-F),F=g+2|0,(F|0)<(u|0))g=F;else{p=H;D=h;break}else D=p=0;e[c+(t<<2)>>2]=p;e[d+(t<<2)>>2]=D;g=v+2|0;if((g|0)<(E|0))t=t+1|0,v=g;else break}f=k}function Cb(b,a,c,d,E,q,g,k,n){b|=0;a|=0;c|=0;d|=0;g|=0;k|=0;var v=
0,r=0,m=0,u=0,t=0,F=0,H=0,h=0,z=0,B=0,A=0,y=0,l=0,p=0,D=0,G=0,x=0,J=0,Pa=0,O=0,ka=0,K=0,L=0,C=0,w=J=0,r=u=B=z=h=H=x=G=0;n=f;v=(q|0)>>1;q=(E|0)>>1;E=v+q|0;r=f;f=f+(4*E|0)|0;m=f=f+7&-8;f=f+(4*E|0)|0;f=f+7&-8;if(E=0<(q|0)){u=q-1|0;t=0;do e[r+(t<<2)>>2]=+e[b+(u-t<<2)>>2],t=t+1|0;while((t|0)<(q|0))}if(t=0<(v|0)){u=0;do e[r+(u+q<<2)>>2]=+e[g+((u<<1|1)<<2)>>2],u=u+1|0;while((u|0)<(v|0))}if(E){u=q-1|0;b=0;do e[m+(b<<2)>>2]=+e[a+(u-b<<2)>>2],b=b+1|0;while((b|0)<(q|0))}if(t){b=0;do e[m+(b+q<<2)>>2]=+e[k+((b<<
1|1)<<2)>>2],b=b+1|0;while((b|0)<(v|0))}if(E)for(E=q-2|0,b=q-1|0,a=u=0;;){F=E+a|0;if(t){H=b+a|0;h=a+q|0;B=z=0;A=+e[r+(F<<2)>>2];y=+e[m+(F<<2)>>2];for(F=p=l=0;;)if(D=F<<1,G=+e[c+(D<<2)>>2],x=+e[c+((D|1)<<2)>>2],J=H+F|0,Pa=+e[r+(J<<2)>>2],O=+e[m+(J<<2)>>2],ka=Pa-O,K=Pa+O,O=+e[c+((D|2)<<2)>>2],Pa=+e[c+((D|3)<<2)>>2],D=h+F|0,L=+e[r+(D<<2)>>2],C=+e[m+(D<<2)>>2],J=p+G*ka+O*(L-C),w=l+x*K+Pa*(L+C),G=z+(A-y)*G+O*ka,x=B+(A+y)*x+K*Pa,D=F+2|0,(D|0)<(v|0))z=G,B=x,A=L,y=C,l=w,p=J,F=D;else break;H=2*G;h=2*x;z=2*
w;B=2*J}else B=z=h=H=0;F=u<<1;e[d+(F<<2)>>2]=B;e[d+((F|1)<<2)>>2]=z;e[d+((F|2)<<2)>>2]=H;e[d+((F|3)<<2)>>2]=h;F=u+2|0;h=-2-u|0;if((F|0)<(q|0))u=F,a=h;else break}if(t){u=0;do e[g+((u<<1|1)<<2)>>2]=+e[r+(u<<2)>>2],u=u+1|0;while((u|0)<(v|0));if(t){r=0;do e[k+((r<<1|1)<<2)>>2]=+e[m+(r<<2)>>2],r=r+1|0;while((r|0)<(v|0))}}f=n}function Kb(b,a,c,d){b|=0;a|=0;c|=0;d|=0;var E=0,q=0,g=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,h=0,z=0,B=0,A=0,y=0,l=0,p=0,k=q=y=0,E=f;f=f+112|0;q=E|0;g=-3-c|0;k=q|0;e[k>>2]=+Ha(b,b+
(g<<2)|0,d);e[q+4>>2]=+Ha(b,b+(g+1<<2)|0,d);e[q+8>>2]=+Ha(b,b+(g+2<<2)|0,d);e[q+12>>2]=+Ha(b,b+(g+3<<2)|0,d);e[q+16>>2]=+Ha(b,b+(g+4<<2)|0,d);e[q+20>>2]=+Ha(b,b+(g+5<<2)|0,d);e[q+24>>2]=+Ha(b,b+(g+6<<2)|0,d);for(n=0;;){v=3-n|0;r=0>(v|0)?0:v;v=10-n|0;m=7<(v|0)?7:v;if((r|0)<(m|0))for(v=n-3|0,u=r,t=0;;)if(F=t+ +e[1352+(u<<2)>>2]*+e[q+(v+u<<2)>>2],r=u+1|0,(r|0)<(m|0))u=r,t=F;else{H=F;break}else H=0;e[q+28+(n<<2)>>2]=H;u=n+1|0;if(7>(u|0))n=u;else{h=0;break}}for(;;){n=3-h|0;u=0>(n|0)?0:n;n=10-h|0;m=7<(n|
0)?7:n;if((u|0)<(m|0))for(n=h-3|0,v=u,H=0;;)if(t=H+ +e[1380+(v<<2)>>2]*+e[q+(n+v<<2)>>2],u=v+1|0,(u|0)<(m|0))v=u,H=t;else{z=t;break}else z=0;e[q+56+(h<<2)>>2]=z;v=h+1|0;if(7>(v|0))h=v;else{B=0;break}}do{h=3-B|0;v=0>(h|0)?0:h;h=10-B|0;m=7<(h|0)?7:h;if((v|0)<(m|0))for(h=B-3|0,n=v,z=0;;)if(H=z+ +e[1408+(n<<2)>>2]*+e[q+(h+n<<2)>>2],v=n+1|0,(v|0)<(m|0))n=v,z=H;else{A=H;break}else A=0;e[q+84+(B<<2)>>2]=A;B=B+1|0}while(7>(B|0));A=+e[k>>2];k=0;z=A;n=B=0;for(H=A;;){A=(m=H>z)?H:z;t=+e[q+(28*k|0)+4>>2];F=(h=
t>A)?t:A;A=+e[q+(28*k|0)+8>>2];t=(v=A>F)?A:F;F=+e[q+(28*k|0)+12>>2];A=(u=F>t)?F:t;t=+e[q+(28*k|0)+16>>2];F=(r=t>A)?t:A;A=+e[q+(28*k|0)+20>>2];t=(y=A>F)?A:F;F=+e[q+(28*k|0)+24>>2];p=(l=F>t)?k:y?k:r?k:u?k:v?k:h?k:m?k:B;y=l?6:y?5:r?4:u?3:v?2:h?1:m?0:n;m=k+1|0;if(4<=(m|0))break;k=m;z=l?F:t;B=p;n=y;H=+e[q+(28*m|0)>>2]}if(0>=(d|0))return q=(c+3|0)-y|0,f=E,q|0;q=0<(p|0);n=g+y|0;g=-6-c+y|0;B=p-1|0;p=0;do q?(k=g+p|0,k=+e[b+(k<<2)>>2]*+e[1352+(28*B|0)>>2]+0+ +e[b+(k+1<<2)>>2]*+e[1356+(28*B|0)>>2]+ +e[b+(k+
2<<2)>>2]*+e[1360+(28*B|0)>>2]+ +e[b+(k+3<<2)>>2]*+e[1364+(28*B|0)>>2]+ +e[b+(k+4<<2)>>2]*+e[1368+(28*B|0)>>2]+ +e[b+(k+5<<2)>>2]*+e[1372+(28*B|0)>>2]+ +e[b+(k+6<<2)>>2]*+e[1376+(28*B|0)>>2]):k=+e[b+(n+p<<2)>>2],e[a+(p<<2)>>2]=k,p=p+1|0;while((p|0)<(d|0));q=(c+3|0)-y|0;f=E;return q|0}function Lb(b,a,c,d,E,q,g,k,n){b|=0;a|=0;E|=0;q|=0;g|=0;k=+k;var v=0,r=0,m=0,u=0,t=0,F=0,H=t=0,h=u=0,z=m=r=u=v=0,B=0;d=0;d=n=f;f=f+(4*(E<<1)|0)|0;f=f+7&-8;Kb(b,d,q,80)|0;c=(q|0)>(g|0);g=d+(E<<2)|0;Kb(b,g,c?q<<1:-q|0,
80)|0;v=+Wa(+Ha(d,d,E)+1E3);r=+Wa(+Ha(g,g,E)+1E3);m=+Wa(+Ha(b,b,E)+1);u=+Ha(d,b,E);t=0>u?0:u;u=+Ha(g,b,E);F=0>u?0:u;t=t>v*m?1:t/m/v;H=F>r*m?1:F/m/r;F=m/r;0<k?(r=0.4*k+0.07,u=1.72*(r+-0.07)+0.5,h=r):h=u=0;r=1-t*t*u;t=1-H*H*u;u=h/(t<h?h:t);t=m/v*(h/(r<h?h:r));c?(v=F*u*0.3,u=0.7*t):(v=F*u*0.6,u=0.6*t);t=v;v=u;c=0<(E|0);do if(c){g=0;do e[a+(g<<2)>>2]=+e[b+(g<<2)>>2]+(v*+e[d+(g<<2)>>2]+t*+e[d+(g+E<<2)>>2]),g=g+1|0;while((g|0)<(E|0));if(c)for(m=r=0;;)if(u=+e[a+(r<<2)>>2],u=m+u*u,g=r+1|0,(g|0)<(E|0))r=g,
m=u;else{z=u;break}else z=0}else z=0;while(0);m=+(E|0);t=+Wa(z/m+0.1);if(c)for(z=r=0;;)if(v=+e[b+(r<<2)>>2],u=z+v*v,d=r+1|0,(d|0)<(E|0))r=d,z=u;else{B=u;break}else B=0;z=+Wa(B/m+0.1);m=1>z?1:z;z=1>t?1:t;t=(m>z?z:m)/z;if(c){d=0;do c=a+(d<<2)|0,e[c>>2]=t*+e[c>>2],d=d+1|0;while((d|0)<(E|0))}f=n}function Mb(b,a,c){b|=0;a|=0;c|=0;var d=0,f=0,q=0,g=0,k=0,n=0,v=0,r=f=0,m=0,u=0,t=0,F=0,H=0,f=+e[a>>2],q=0<(c|0);if(0==f){if(!q)return 0;wa(b|0,0,c<<2|0);return 0}if(q)k=0,n=f;else return+f;for(;;){q=k+1|0;f=
-0-+e[a+(q<<2)>>2];if(0<(k|0))for(d=0,v=f;;)if(f=v-+e[b+(d<<2)>>2]*+e[a+(k-d<<2)>>2],r=d+1|0,(r|0)<(k|0))d=r,v=f;else{m=f;break}else m=f;v=m/(n+0.003*+e[a>>2]);e[b+(k<<2)>>2]=v;d=k>>1;if(0<(d|0))for(r=k-1|0,u=0;;)if(t=b+(u<<2)|0,f=+e[t>>2],F=b+(r-u<<2)|0,e[t>>2]=f+v*+e[F>>2],e[F>>2]=v*f+ +e[F>>2],F=u+1|0,(F|0)<(d|0))u=F;else{H=d;break}else H=0;0!=(k&1|0)&&(d=b+(H<<2)|0,f=+e[d>>2],e[d>>2]=f+v*f);f=n-v*n*v;if((q|0)<(c|0))k=q,n=f;else{g=f;break}}return+g}function Nb(b,a,c,d){b|=0;a|=0;c|=0;d|=0;var f=
0,q=f=0,g=q=0,k=0;if(0!=(c|0)){f=c;do{f=f-1|0;if((f|0)<(d|0))for(q=0,c=f;;)if(q+=+e[b+(c<<2)>>2]*+e[b+(c-f<<2)>>2],g=c+1|0,(g|0)<(d|0))c=g;else{k=q;break}else k=0;e[a+(f<<2)>>2]=k}while(0!=(f|0))}f=+e[a>>2];e[a>>2]=f+10}function Db(b,a,c,d,E,q){b|=0;a|=0;c|=0;d|=0;E=+E;var g=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,h=0,z=0,B=0,A=0,y=0,l=y=A=0,p=0,D=F=h=0,G=0,x=0,J=h=D=t=H=0,Pa=F=k=0,O=0,C=J=H=z=0,K=t=0,L=K=0,w=0,M=H=F=0,P=0,R=0,ca=0,Y=0,U=0,Q=0,T=C=0,da=r=0,N=0,$=C=0;q=f;g=(a|0)/2|0;k=g+1|0;n=f;f=f+
(4*k|0)|0;f=f+7&-8;v=n;r=f;f=f+(4*k|0)|0;f=f+7&-8;m=r;e[r>>2]=1;e[n>>2]=1;u=1<(a|0);a:do if(u){t=a-1|0;F=0;H=n;h=r;B=z=1;do H=H+4|0,h=h+4|0,A=b+(F<<2)|0,y=b+(t-F<<2)|0,z=+e[A>>2]+ +e[y>>2]-z,e[h>>2]=z,B=+e[A>>2]-+e[y>>2]+B,e[H>>2]=B,F=F+1|0;while((F|0)<(g|0));if(u)for(A=1,y=r,l=n;;){e[y>>2]=2*+e[y>>2];e[l>>2]=2*+e[l>>2];if((A|0)>=(g|0))break a;A=A+1|0;y=y+4|0;l=l+4|0}}while(0);l=f;f=f+(4*k|0)|0;y=f=f+7&-8;f=f+(4*k|0)|0;f=f+7&-8;0<(k|0)&&(k=y,n=(g<<2)+4|0,Fa(l|0,m|0,n)|0,Fa(k|0,v|0,n)|0);if(0>=(a|
0))return f=q,0;B=E;n=0>(d|0);z=k=E=v=0;for(h=1;;){m=0==(v&1|0)?l:y;F=2*h;if(u){A=g;for(G=D=0;;)if(x=F*D-G+ +e[m+(g-A<<2)>>2],r=A-1|0,0<(r|0))A=r,G=D,D=x;else break;H=x;t=D}else t=H=0;D=G=+e[m+(g<<2)>>2];A=c+(v<<2)|0;J=z;r=k;b=0;k=E;F=0.5*F*H+(-0-t)+D;a:for(;;){if(b){Pa=J;O=h;break}else z=h,H=J,J=F;for(;;){if(-1>H){Pa=H;O=z;break a}C=z;t=B*(1-C*C*0.9);K=0.2>+Eb(+J)?0.5*t:t;K=z-K;t=2*K;if(u){F=g;for(L=C=0;;)if(w=t*C-L+ +e[m+(g-F<<2)>>2],H=F-1|0,0<(H|0))F=H,L=C,C=w;else break;F=w;H=C}else H=F=0;L=0.5*
t*F+(-0-H)+D;if(0>J*L)break;else H=z=K,J=L}F=r+1|0;b:do if(n)M=J,P=k,R=K;else{L=G;if(u)ca=J,Y=0,U=K,Q=z;else for(C=J,H=0,T=K,r=z;;)if(da=0.5*(T+r),N=0*da+L,C=(h=0>C*N)?C:N,N=h?da:T,t=H+1|0,(t|0)>(d|0)){M=C;P=da;R=N;break b}else H=t,T=N,r=h?r:da;for(;;){r=0.5*(U+Q);T=2*r;H=g;for(t=C=0;;)if($=T*C-t+ +e[m+(g-H<<2)>>2],h=H-1|0,0<(h|0))H=h,t=C,C=$;else break;t=0.5*T*$+(-0-C)+L;C=(H=0>ca*t)?ca:t;t=H?r:U;h=Y+1|0;if((h|0)>(d|0)){M=C;P=r;R=t;break}else ca=C,Y=h,U=t,Q=H?Q:r}}while(0);e[A>>2]=+Sc(P);h=P;J=R;
r=F;b=1;k=P;F=M}b=v+1|0;if((b|0)<(a|0))v=b,E=k,k=r,z=Pa,h=O;else{p=r;break}}f=q;return p|0}function fb(b,a,c,d){b|=0;a|=0;c|=0;var E=0,q=0,g=0,k=0,n=0,v=0,r=0,m=r=0,u=0,t=0,F=0,h=0,l=0,z=0,B=t=0,A=0;d=f;E=c>>1;q=E<<2;g=f;f=f+(4*(q|2)|0)|0;f=f+7&-8;0<=(q|0)&&(q=E<<2|2,wa(g|0,0,(1<(q|0)?q<<2:4)|0));q=f;f=f+(4*c|0)|0;f=f+7&-8;if(0<(c|0)){k=0;do v=n=+e[b+(k<<2)>>2],1.5707963268>v?(r=n*n,r=r*(r*(-0.0012712094467133284*r+0.04148774594068527)+-0.49991244077682495)+0.9999933242797852):(r=3.141592653589793-
v,v=r*r,r=-0-(v*(v*(-0.0012712094467133284*v+0.04148774594068527)+-0.49991244077682495)+0.9999933242797852)),e[q+(k<<2)>>2]=r,k=k+1|0;while((k|0)<(c|0))}if(!(0>(c|0)))if(0>=(E|0))for(r=1,k=0;!(0<(k|0)&&(v=+Ba(8),e[a+(k-1<<2)>>2]=0.5*(r-v+(r+ +Ba(4)))),e[1]=r,e[2]=r,b=k+1|0,(b|0)>(c|0));)r=0,k=b;else for(k=E<<2,r=1,b=0;;){v=r;for(u=m=0;;){t=m<<2;F=g+(t<<2)|0;h=t|1;l=g+(h<<2)|0;z=g+(h+1<<2)|0;h=g+((t|3)<<2)|0;n=+e[F>>2];t=+e[l>>2]+(r-2*+e[q+(u<<2)>>2]*n);B=+e[z>>2];A=+e[h>>2]+(v-2*+e[q+((u|1)<<2)>>
2]*B);e[l>>2]=n;e[h>>2]=B;e[F>>2]=r;e[z>>2]=v;z=m+1|0;if((z|0)>=(E|0))break;v=A;r=t;m=z;u=u+2|0}u=g+(k<<2)|0;m=g+((k|1)<<2)|0;0<(b|0)&&(e[a+(b-1<<2)>>2]=0.5*(A-+e[m>>2]+(t+ +e[u>>2])));e[u>>2]=t;e[m>>2]=A;m=b+1|0;if((m|0)>(c|0))break;else r=0,b=m}f=d}function gb(b,a,c){b|=0;c=+c;var d=0,f=0,q=0,g=0,k=q=0,g=k=f=0;+e[b>>2]<c&&(e[b>>2]=c);d=(a|0)-1|0;a=b+(d<<2)|0;f=3.141592653589793-c;+e[a>>2]>f&&(e[a>>2]=f);if(!(1>=(d|0)))for(a=1,f=+e[b+4>>2],q=+e[b>>2];;)if(g=b+(a<<2)|0,q+=c,k=f<q?e[g>>2]=q:f,f=a+
1|0,q=+e[b+(f<<2)>>2],k>q-c&&(k=0.5*(k+q-c),e[g>>2]=k),g=k,(f|0)<(d|0))a=f,f=q,q=g;else break}function hb(b,a,c,f,d,q){b|=0;a|=0;c|=0;f|=0;var g=0,k=0,g=(+(d|0)+1)/+(q|0);if(!(0>=(f|0))){k=1-g;q=0;do e[c+(q<<2)>>2]=k*+e[b+(q<<2)>>2]+g*+e[a+(q<<2)>>2],q=q+1|0;while((q|0)<(f|0))}}function Ha(b,a,c){var f=0,d=0,q=0,g=f=0,k=0,g=0,f=(c|0)>>2;if(0==(f|0))return 0;q=a|0;g=0;for(k=b|0;;)if(b=f-1|0,g+=+e[k>>2]*+e[q>>2]+0+ +e[k+4>>2]*+e[q+4>>2]+ +e[k+8>>2]*+e[q+8>>2]+ +e[k+12>>2]*+e[q+12>>2],0==(b|0)){d=g;
break}else q=q+16|0,f=b,k=k+16|0;return+d}function Ob(a,c,S,d,E,q,g,k){a|=0;c|=0;S|=0;d|=0;E|=0;q|=0;g|=0;var n=0,v=0,r=0,m=0,u=0,t=0,F=0,h=0,l=0,z=0,B=0,A=0,y=0,p=0,Ia=0,D=0,G=0,C=0,J=0,x=0,O=0,w=0,K=0,L=0;k=f;n=S-c|0;v=f;f=f+(4*(n+2|0)|0)|0;f=f+7&-8;r=n+1|0;m=f;f=f+(4*r|0)|0;u=f=f+7&-8;f=f+(4*g|0)|0;t=f=f+7&-8;f=f+(4*g|0)|0;f=f+7&-8;if(F=0<(g|0)){wa(t|0,0,g<<2|0);h=0;do e[u+(h<<2)>>2]=-1,b[E+(h<<2)>>2]=c,h=h+1|0;while((h|0)<(g|0))}h=d>>2;if(l=0==(h|0))z=e[v>>2]=0;else{B=h;A=0;for(y=a+(-c<<2)|0;p=
B-1|0,Ia=+e[y>>2],D=+e[y+4>>2],G=+e[y+8>>2],C=+e[y+12>>2],J=A+(Ia*Ia+0+D*D+G*G+C*C),0!=(p|0);)B=p,A=J,y=y+16|0;e[v>>2]=J;y=h;J=0;for(B=a;;)if(p=y-1|0,A=+e[B>>2],C=+e[B+4>>2],G=+e[B+8>>2],D=+e[B+12>>2],Ia=J+(A*A+0+C*C+G*G+D*D),0==(p|0)){z=Ia;break}else y=p,J=Ia,B=B+16|0}if((c|0)<(S|0)){B=d-1|0;d=c;do y=d-c|0,J=+e[a+(~d<<2)>>2],Ia=+e[a+(B-d<<2)>>2],D=+e[v+(y<<2)>>2]+J*J-Ia*Ia,e[v+(y+1<<2)>>2]=0>D?0:D,d=d+1|0;while((d|0)<(S|0))}a:do if(0<(r|0)){if(l)for(d=0;;){if(e[m+(n-d<<2)>>2]=0,d=d+1|0,(d|0)>=(r|
0))break a}else x=0;do{d=a+(x-S<<2)|0;B=h;D=0;for(y=a;p=B-1|0,O=D+(+e[y>>2]*+e[d>>2]+0+ +e[y+4>>2]*+e[d+4>>2]+ +e[y+8>>2]*+e[d+8>>2]+ +e[y+12>>2]*+e[d+12>>2]),0!=(p|0);)d=d+16|0,B=p,D=O,y=y+16|0;e[m+(n-x<<2)>>2]=O;x=x+1|0}while((x|0)<(r|0))}while(0);if((c|0)<=(S|0)){r=g-1|0;x=t+(r<<2)|0;n=u+(r<<2)|0;a=E+(r<<2)|0;h=c;do{l=h-c|0;O=+e[m+(l<<2)>>2];D=O*O;O=+e[v+(l<<2)>>2]+1;a:do if(D*+e[x>>2]>+e[n>>2]*O){e[n>>2]=D;e[x>>2]=O;b[a>>2]=h;for(l=0;;){if((l|0)>=(r|0))break a;w=t+(l<<2)|0;K=u+(l<<2)|0;if(D*+e[w>>
2]>+e[K>>2]*O){L=r;break}else l=l+1|0}for(;;)if(y=L-1|0,e[u+(L<<2)>>2]=+e[u+(y<<2)>>2],e[t+(L<<2)>>2]=+e[t+(y<<2)>>2],b[E+(L<<2)>>2]=b[E+(y<<2)>>2],(y|0)>(l|0))L=y;else break;e[K>>2]=D;e[w>>2]=O;b[E+(l<<2)>>2]=h}while(0);h=h+1|0}while((h|0)<=(S|0))}if(!(0==(q|0)|F^1)){O=+Wa(z);F=0;do S=(b[E+(F<<2)>>2]|0)-c|0,z=+e[m+(S<<2)>>2]/(O*+Wa(+e[v+(S<<2)>>2])+10),e[q+(F<<2)>>2]=0>z?0:z,F=F+1|0;while((F|0)<(g|0))}f=k}function Yb(a,c,S,d,E,q,xa,k,n,v,r,m,u,t,h,H,l,z,B,A){a|=0;c|=0;S|=0;d|=0;E|=0;q|=0;xa|=0;k|=
0;n|=0;r|=0;m|=0;u|=0;t|=0;h|=0;H|=0;l|=0;B|=0;A|=0;var y=0,p=0,Ia=0,D=0,G=0,x=0,J=0,w=0,O=0,M=0,K=0,L=0,P=0,N=0,R=0,$=0,ca=0,Y=R=P=v=N=0,U=0,Q=0,y=f;f=f+8|0;p=y|0;Ia=xa+4|0;D=b[Ia>>2]|0;G=1<<D;x=xa;J=(b[x>>2]|0)+((z|0)<<2<<D)|0;D=10<(l|0)?10:l;l=1>(D|0)?1:D;D=f;f=f+(4*l|0)|0;f=f+7&-8;if((n|0)<(k|0))return g(u,0,b[xa+8>>2]|0),g(u,0,b[Ia>>2]|0),wa(q|0,0,m<<2|0),f=y,k|0;z=n-k+1|0;w=(l|0)>(z|0)?z:l;(n|0)==(k|0)?b[D>>2]=n:Ob(c,k,n,m,D,0,w,0);n=f;f=f+(4*m|0)|0;c=f=f+7&-8;f=f+(4*m|0)|0;l=f=f+7&-8;f=f+(4*
m|0)|0;f=f+7&-8;if(0<(w|0))for(z=q,O=m<<2,M=n,K=l,L=c,P=0,v=-1,R=N=0;;){if($=b[D+(R<<2)>>2]|0,wa(z|0,0,O|0),ca=+Zb(a,S,d,E,q,J,G,$,r,m,t,h,H,c,p,B,+e[A>>2]),ca<v|0>v&&(Fa(M|0,z|0,O)|0,Fa(K|0,L|0,O)|0,N=b[p>>2]|0,v=ca,P=$),R=R+1|0,!((R|0)<(w|0))){Y=P;U=N;Q=$;break}}else Q=U=Y=0;g(u,Y-k|0,b[xa+8>>2]|0);g(u,U,b[Ia>>2]|0);v=+e[A>>2];e[A>>2]=(1024>v?32:0.03125*v)*+(C[(b[x>>2]|0)+(U<<2|3)|0]|0);U=q;q=n;n=m<<2;Fa(U|0,q|0,n)|0;q=a;Fa(q|0,l|0,n)|0;f=y;return Q|0}function Zb(a,c,S,d,g,q,xa,k,n,v,r,m,u,t,h,
H,l){a|=0;c|=0;S|=0;d|=0;g|=0;q|=0;xa|=0;k|=0;n|=0;v|=0;r|=0;m|=0;u|=0;t|=0;h|=0;H|=0;var z=0,B=0,A=0,y=0,p=0,Ia=0,D=0,G=0,x=0,J=0,w=0,O=0,M=0,K=0,L=0,P=0,R=0,N=0,$=0,ca=w=$=0,Y=0,U=0,Q=0,T=0,da=0,I=0,ea=0,ja=0,V=0,pa=0,fa=0,X=0,ba=0,ia=A=D=B=x=D=B=0,W=0,y=p=Ia=0,z=f;f=f+56|0;B=z|0;A=z+16|0;y=f;f=f+(4*(3*v|0)|0)|0;p=f=f+7&-8;f=f+(4*v|0)|0;f=f+7&-8;Ia=262144<+l?31:128;b[B>>2]=y;D=y+(v<<2)|0;b[B+4>>2]=D;G=v<<1;x=y+(G<<2)|0;b[B+8>>2]=x;J=0<(v|0);do if(J){w=0;do e[t+(w<<2)>>2]=+e[a+(w<<2)>>2],w=w+1|0;
while((w|0)<(v|0));w=Xa()|0;O=f;f=f+(4*n|0)|0;f=f+7&-8;M=O;if(J)for(R=1-k|0,N=0;;)if($=R+N|0,0>($|0)?e[p+(N<<2)>>2]=+e[m+($<<2)>>2]:($=$-k|0,e[p+(N<<2)>>2]=0>($|0)?+e[m+($<<2)>>2]:0),$=N+1|0,($|0)<(v|0))N=$;else{K=w;L=O;P=M;break}else K=w,L=O,P=M}else M=Xa()|0,O=f,f=f+(4*n|0)|0,f=f+7&-8,K=M,P=L=O;while(0);0<(n|0)?(wa(P|0,0,n<<2|0),Za(p,c,p,v,n,L,r),wa(P|0,0,n<<2|0)):Za(p,c,p,v,n,L,r);$a(p,S,d,p,v,n,L,r);if(J){r=0;do e[y+(G+r<<2)>>2]=+e[p+(r<<2)>>2],r=r+1|0;while((r|0)<(v|0))}Ya(K|0);K=~k;r=v-1|0;
l=+e[m+(-k<<2)>>2];w=+e[u>>2];e[D>>2]=l*w;if(0<(r|0)){for(p=0;;)if(L=p+1|0,e[y+(L+v<<2)>>2]=+e[y+(G+p<<2)>>2]+l*+e[u+(L<<2)>>2],(L|0)<(r|0))p=L;else break;l=+e[m+(K<<2)>>2];e[y>>2]=l*w;for(p=0;;)if(L=p+1|0,e[y+(L<<2)>>2]=+e[y+(p+v<<2)>>2]+l*+e[u+(L<<2)>>2],(L|0)<(r|0))p=L;else break}else e[y>>2]=+e[m+(K<<2)>>2]*w;K=v>>2;if(p=0==(K|0))U=Y=ca=0;else{r=t;u=K;w=0;for(L=y;;){n=u-1|0;Q=w+(+e[L>>2]*+e[r>>2]+0+ +e[L+4>>2]*+e[r+4>>2]+ +e[L+8>>2]*+e[r+8>>2]+ +e[L+12>>2]*+e[r+12>>2]);if(0==(n|0)){T=t;da=K;I=
0;ea=D;break}r=r+16|0;u=n;w=Q;L=L+16|0}for(;;)if(L=da-1|0,ja=I+(+e[ea>>2]*+e[T>>2]+0+ +e[ea+4>>2]*+e[T+4>>2]+ +e[ea+8>>2]*+e[T+8>>2]+ +e[ea+12>>2]*+e[T+12>>2]),0==(L|0)){V=t;pa=K;fa=0;X=x;break}else T=T+16|0,da=L,I=ja,ea=ea+16|0;for(;;)if(ea=pa-1|0,I=fa+(+e[X>>2]*+e[V>>2]+0+ +e[X+4>>2]*+e[V+4>>2]+ +e[X+8>>2]*+e[V+8>>2]+ +e[X+12>>2]*+e[V+12>>2]),0==(ea|0)){ca=I;Y=ja;U=Q;break}else V=V+16|0,pa=ea,fa=I,X=X+16|0}X=0;do{pa=B+(X<<2)|0;if(p){V=0;do e[A+(12*V|0)+(X<<2)>>2]=0,e[A+(12*X|0)+(V<<2)>>2]=0,V=V+
1|0;while((V|0)<=(X|0))}else{V=0;do{ea=b[B+(V<<2)>>2]|0;da=K;fa=0;for(T=b[pa>>2]|0;x=da-1|0,ba=fa+(+e[T>>2]*+e[ea>>2]+0+ +e[T+4>>2]*+e[ea+4>>2]+ +e[T+8>>2]*+e[ea+8>>2]+ +e[T+12>>2]*+e[ea+12>>2]),0!=(x|0);)ea=ea+16|0,da=x,fa=ba,T=T+16|0;e[A+(12*V|0)+(X<<2)>>2]=ba;e[A+(12*X|0)+(V<<2)>>2]=ba;V=V+1|0}while((V|0)<=(X|0))}X=X+1|0}while(3>(X|0));ba=+e[A+20>>2];fa=+e[A+4>>2];Q=+e[A+8>>2];X=2>(H|0)?2:H;ja=0.5*((30<(X|0)?0.6:0.02*+(X|0))+1);I=ja*+e[A+32>>2];w=ja*+e[A+16>>2];l=ja*+e[A>>2];if(0<(xa|0))for(ja=
-999999986991104,X=A=0;;)if(H=X<<2,B=+(C[q+H|0]|0)+32,D=+(C[q+(H|1)|0]|0)+32,x=+(C[q+(H|2)|0]|0)+32,B=ca*B*64+0+Y*D*64+U*x*64-ba*B*D-fa*D*x-Q*B*x-I*B*B-w*D*D-l*x*x,B>ja?+(C[q+(H|3)|0]|0)>Ia?(D=A,A=ja):(D=X,A=B):(D=A,A=ja),H=X+1|0,(H|0)<(xa|0))ja=A,A=D,X=H;else{ia=D;break}else ia=0;D=ia<<2;A=0.015625*+(C[q+D|0]|0)+0.5;ja=0.015625*+(C[q+(D|1)|0]|0)+0.5;Ia=0.015625*+(C[q+(D|2)|0]|0)+0.5;b[h>>2]=ia;wa(g|0,0,v<<2|0);ia=k+1|0;h=(ia|0)<(v|0)?ia:v;if(0<(h|0)){D=0;do q=g+(D<<2)|0,e[q>>2]=+e[q>>2]+Ia*+e[m+
(D-ia<<2)>>2],D=D+1|0;while((D|0)<(h|0))}D=ia+k|0;ia=(D|0)<(v|0)?D:v;if((h|0)<(ia|0)){q=h;do h=g+(q<<2)|0,e[h>>2]=+e[h>>2]+Ia*+e[m+(q-D<<2)>>2],q=q+1|0;while((q|0)<(ia|0))}ia=(k|0)<(v|0)?k:v;if(0<(ia|0)){q=0;do D=g+(q<<2)|0,e[D>>2]=+e[D>>2]+ja*+e[m+(q-k<<2)>>2],q=q+1|0;while((q|0)<(ia|0))}q=k<<1;D=(q|0)<(v|0)?q:v;if((ia|0)<(D|0)){h=ia;do ia=g+(h<<2)|0,e[ia>>2]=+e[ia>>2]+ja*+e[m+(h-q<<2)>>2],h=h+1|0;while((h|0)<(D|0))}D=k-1|0;h=(D|0)<(v|0)?D:v;if(0<(h|0)){q=0;do ia=g+(q<<2)|0,e[ia>>2]=+e[ia>>2]+A*
+e[m+(q-D<<2)>>2],q=q+1|0;while((q|0)<(h|0))}q=D+k|0;k=(q|0)<(v|0)?q:v;if((h|0)<(k|0)){D=h;do h=g+(D<<2)|0,e[h>>2]=+e[h>>2]+A*+e[m+(D-q<<2)>>2],D=D+1|0;while((D|0)<(k|0))}if(J){J=0;do k=t+(J<<2)|0,e[k>>2]=+e[k>>2]-(A*+e[y+(G+J<<2)>>2]+ja*+e[y+(J+v<<2)>>2]+Ia*+e[y+(J<<2)>>2]),J=J+1|0;while((J|0)<(v|0))}if(p)return f=z,0;Ia=K;p=0;for(y=t;;)if(t=Ia-1|0,Ia=+e[y>>2],ja=+e[y+4>>2],A=+e[y+8>>2],l=+e[y+12>>2],w=p+(Ia*Ia+0+ja*ja+A*A+l*l),0==(t|0)){W=w;break}else Ia=t,p=w,y=y+16|0;f=z;return+W}function $b(a,
c,S,d,f,q,g,k,n,v,r,m,u,t,F){a|=0;c|=0;S|=0;q|=0;g|=0;k|=0;n|=0;v|=0;m|=0;u|=0;t=+t;var H=0,l=H=d=r=0,z=0;r=H=d=r=f=0;r=q+4|0;d=b[q>>2]|0;H=ta(4<<b[r>>2],F|0)|0;F=(h(v,b[q+8>>2]|0)|0)+S|0;S=(h(v,b[r>>2]|0)|0)<<2;f=0.015625*+(C[d+(S+H)|0]|0)+0.5;r=0.015625*+(C[d+((S|1)+H)|0]|0)+0.5;d=0.015625*+(C[d+((S|2)+H)|0]|0)+0.5;0!=(m|0)&(F|0)>(u|0)&&(H=t,H=4>(m|0)?H:0.5*H,l=0.95<H?0.949999988079071:H,H=f,z=0<f?H:-0.5*H,H=d,H=(0>r?-0-r:r)+z+(0<d?H:-0.5*H),H<=l||(H=l/H,f*=H,r*=H,d*=H));b[k>>2]=F;e[n>>2]=f;e[n+
4>>2]=r;e[n+8>>2]=d;wa(c|0,0,g<<2|0);n=F+1|0;k=(n|0)<(g|0)?n:g;if(0<(k|0)){m=0;do u=c+(m<<2)|0,e[u>>2]=+e[u>>2]+d*+e[a+(m-n<<2)>>2],m=m+1|0;while((m|0)<(k|0))}m=n+F|0;n=(m|0)<(g|0)?m:g;if((k|0)<(n|0)){u=k;do k=c+(u<<2)|0,e[k>>2]=+e[k>>2]+d*+e[a+(u-m<<2)>>2],u=u+1|0;while((u|0)<(n|0))}n=(F|0)<(g|0)?F:g;if(0<(n|0)){u=0;do m=c+(u<<2)|0,e[m>>2]=+e[m>>2]+r*+e[a+(u-F<<2)>>2],u=u+1|0;while((u|0)<(n|0))}u=F<<1;m=(u|0)<(g|0)?u:g;if((n|0)<(m|0)){k=n;do n=c+(k<<2)|0,e[n>>2]=+e[n>>2]+r*+e[a+(k-u<<2)>>2],k=k+
1|0;while((k|0)<(m|0))}m=F-1|0;k=(m|0)<(g|0)?m:g;if(0<(k|0)){u=0;do n=c+(u<<2)|0,e[n>>2]=+e[n>>2]+f*+e[a+(u-m<<2)>>2],u=u+1|0;while((u|0)<(k|0))}u=m+F|0;F=(u|0)<(g|0)?u:g;if((k|0)<(F|0)){r=k;do k=c+(r<<2)|0,e[k>>2]=+e[k>>2]+f*+e[a+(r-u<<2)>>2],r=r+1|0;while((r|0)<(F|0))}}function ac(b,a,c,d,g,q,h,k,n,v,r,m,u,t,F,H,l,z,B,A){b|=0;c|=0;d|=0;g|=0;q|=0;k|=0;v=+v;r|=0;m|=0;t|=0;F|=0;h=a=0;A=f;B=q;z=f;f=f+(4*m|0)|0;f=f+7&-8;l=z;a=0.99<v?0.9900000095367432:v;H=0<(m|0);if(H&0<(k|0)){u=-m|0;n=-k|0;h=u>>>0>
n>>>0?u:n;n=0;do e[q+(n<<2)>>2]=a*+e[F+(n-k<<2)>>2],n=n+1|0;while((n|0)<(m|0)&(n|0)<(k|0));h=-h|0}else h=0;if((h|0)<(m|0)){do e[q+(h<<2)>>2]=a*+e[q+(h-k<<2)>>2],h=h+1|0;while((h|0)<(m|0))}if(!H)return nb(z,c,d,g,z,m,r,t),f=A,k|0;Fa(l|0,B|0,m<<2)|0;nb(z,c,d,g,z,m,r,t);t=0;do r=b+(t<<2)|0,e[r>>2]=+e[r>>2]-+e[z+(t<<2)>>2],t=t+1|0;while((t|0)<(m|0));f=A;return k|0}function bc(a,c,S,d,f,q,g,k,n,v,r,m,u,h,F){a|=0;c|=0;S|=0;f=+f;g|=0;n|=0;h=0.99<f?0.9900000095367432:f;if(0<(g|0)){F=0;do f=h*+e[a+(F-S<<2)>>
2],e[c+(F<<2)>>2]=f,e[a+(F<<2)>>2]=f,F=F+1|0;while((F|0)<(g|0))}b[(k|0)>>2]=S;e[n+8>>2]=0;e[n>>2]=0;e[n+4>>2]=h}function cc(a,c,e){a|=0;return Ta[b[a+4>>2]&31](b[a>>2]|0,c|0,e|0)|0}function dc(a,c,e){a|=0;c|=0;e|=0;var d=0,g=0,q=g=0,d=f;if(0==(c|0))b[e>>2]=b[a+4>>2]<<1,g=0;else if(1==(c|0)){g=e;e=b[g>>2]|0;if(0==(e|0))return b[g>>2]=4,f=d,0;q=b[a+32+(e<<2)>>2]|0;b[g>>2]=0==(q|0)?-1:b[q+52>>2];g=0}else sa(b[Oa>>2]|0,13424,(q=f,f=f+16|0,b[q>>2]=13952,b[q+8>>2]=c,q)|0)|0,f=q,g=-1;f=d;return g|0}function ec(a){a|=
0;var c=0,S=0,d=0,f=0,q=0,g=0,k=0,n=0,v=0,r=0,g=c=0,c=b[a>>2]|0,S=aa(228,1)|0;if(0==(S|0))return 0;b[S+68>>2]=0;b[S>>2]=a;a=c;d=b[a>>2]|0;b[S+8>>2]=d;f=c+4|0;q=(b[a>>2]|0)/(b[f>>2]|0)|0;g=S+16|0;b[g>>2]=q;k=b[f>>2]|0;b[S+12>>2]=k;b[S+20>>2]=d+k;d=b[c+8>>2]|0;f=S+24|0;b[f>>2]=d;e[S+56>>2]=+e[c+20>>2];e[S+60>>2]=+e[c+24>>2];b[S+28>>2]=b[c+12>>2];n=c+16|0;b[S+32>>2]=b[n>>2];e[S+64>>2]=+e[c+28>>2];b[S+208>>2]=c+32;v=b[c+96>>2]|0;b[S+216>>2]=v;b[S+212>>2]=v;b[S+40>>2]=1;b[S+204>>2]=1;e[S+36>>2]=1024;b[S+
72>>2]=aa(k<<2,1)|0;k=aa(((b[n>>2]|0)+(b[a>>2]|0)<<2)+8|0,1)|0;b[S+76>>2]=k;b[S+80>>2]=k+((b[n>>2]|0)+2<<2);k=aa(((b[n>>2]|0)+(b[a>>2]|0)<<2)+8|0,1)|0;b[S+84>>2]=k;b[S+88>>2]=k+((b[n>>2]|0)+2<<2);b[S+92>>2]=2432;b[S+96>>2]=3232;n=d<<2;k=aa(n,1)|0;a=S+100|0;b[a>>2]=k;b[S+104>>2]=aa(n,1)|0;b[S+4>>2]=1;if(0<(d|0)){n=0;v=d;for(c=k;;){k=n+1|0;e[c+(n<<2)>>2]=3.1415927410125732*+(k|0)/+(v+1|0);r=b[f>>2]|0;if((k|0)>=(r|0))break;n=k;v=r;c=b[a>>2]|0}c=r;g=b[g>>2]|0}else c=d,g=q;b[S+108>>2]=aa(c<<2,1)|0;q=c<<
2;b[S+112>>2]=aa(q,1)|0;b[S+116>>2]=aa(q,1)|0;b[S+120>>2]=aa(q,1)|0;b[S+124>>2]=aa(q,1)|0;q=g<<2;b[S+136>>2]=aa(q,1)|0;b[S+140>>2]=0;b[S+52>>2]=aa(q,1)|0;q=aa(64,1)|0;b[S+144>>2]=q;fc(q);e[S+148>>2]=8;wa(S+156|0,0,32);b[S+200>>2]=2;b[S+192>>2]=2;b[S+196>>2]=8E3;b[S+220>>2]=0;b[S+224>>2]=1;return S|0}function gc(a){a|=0;V(b[a+72>>2]|0);V(b[a+76>>2]|0);V(b[a+104>>2]|0);V(b[a+84>>2]|0);V(b[a+100>>2]|0);V(b[a+108>>2]|0);V(b[a+112>>2]|0);V(b[a+116>>2]|0);V(b[a+120>>2]|0);V(b[a+124>>2]|0);V(b[a+136>>2]|
0);V(b[a+52>>2]|0);V(b[(a+144|0)>>2]|0);V(a)}function hc(a,c,d){a|=0;c|=0;d|=0;var cb=0,E=0,q=0,h=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,l=0,z=0,B=0,A=0,y=0,p=0,x=0,D=0,G=0,C=0,J=0,w=0,O=0,M=0,K=0,L=0,P=0,N=0,R=0,V=0,ca=0,Y=0,U=0,Q=0,T=0,da=0,I=0,fa=0,ja=0,aa=0,bb=0,va=0,X=0,ba=0,ia=E=0,W=O=0,ha=Q=p=K=K=0,Z=ia=q=0,ga=0,qa=0,oa=0,sa=0,Ma=0,Ea=T=0,Ga=0,Ja=0,Aa=ba=0,la=0,Ka=0,Oa=0,Ta=0,ua=0,Ua=0,Ca=0,ya=la=0,Ha=0,Ba=ba=0,Da=0,na=0,Na=Aa=Y=la=Aa=ba=ba=na=0,Va=ua=0,h=Ka=0,cb=f;f=f+72|0;E=cb|0;q=cb+24|0;
h=cb+48|0;k=cb+56|0;n=cb+64|0;v=c;r=b[a+68>>2]|0;m=a+24|0;u=b[m>>2]|0;t=f;f=f+(4*u|0)|0;F=f=f+7&-8;f=f+(4*u|0)|0;H=f=f+7&-8;f=f+(4*u|0)|0;f=f+7&-8;l=H;z=f;f=f+(4*u|0)|0;f=f+7&-8;B=z;A=f;f=f+(4*u|0)|0;y=f=f+7&-8;f=f+(4*u|0)|0;f=f+7&-8;p=y;x=f;f=f+(4*u|0)|0;D=f=f+7&-8;f=f+(4*u|0)|0;G=f=f+7&-8;f=f+(4*u|0)|0;f=f+7&-8;u=b[a+76>>2]|0;C=a+8|0;J=a+32|0;pb(u|0,u+(b[C>>2]<<2)|0,(b[J>>2]<<2)+8|0);u=b[a+84>>2]|0;pb(u|0,u+(b[C>>2]<<2)|0,(b[J>>2]<<2)+8|0);0!=(b[a+224>>2]|0)&&za(v,v,b[C>>2]|0,0!=(b[a+220>>2]|0)?
2:0,a+128|0);u=a+20|0;w=b[u>>2]|0;O=Xa()|0;M=f;f=f+(4*w|0)|0;f=f+7&-8;w=(b[m>>2]|0)+1|0;K=f;f=f+(4*w|0)|0;f=f+7&-8;L=b[u>>2]|0;P=b[C>>2]|0;N=L-P|0;if(0<(N|0))for(R=b[a+72>>2]|0,V=b[a+92>>2]|0,ca=0;;)if(e[M+(ca<<2)>>2]=+e[R+(ca<<2)>>2]*+e[V+(ca<<2)>>2],Y=ca+1|0,(Y|0)<(N|0))ca=Y;else{U=Y;break}else U=0;if((U|0)<(L|0)){ca=b[a+92>>2]|0;N=U;do e[M+(N<<2)>>2]=+e[v+(N-L+P<<2)>>2]*+e[ca+(N<<2)>>2],N=N+1|0;while((N|0)<(L|0))}Nb(M,K,w,L);Q=+e[K>>2];T=Q+Q*+e[a+64>>2];e[K>>2]=T;L=b[m>>2]|0;w=L+1|0;a:do if(0<
(w|0))for(M=b[a+96>>2]|0,N=0,Q=T;;){e[K+(N<<2)>>2]=Q*+e[M+(N<<2)>>2];ca=N+1|0;if((ca|0)>=(w|0))break a;N=ca;Q=+e[K+(ca<<2)>>2]}while(0);+Mb(t,K,L);L=Db(t,b[m>>2]|0,z,10,0.20000000298023224,r)|0;t=b[m>>2]|0;if((L|0)!=(t|0)&0<(t|0)){L=b[a+100>>2]|0;K=0;do e[z+(K<<2)>>2]=+e[L+(K<<2)>>2],K=K+1|0;while((K|0)<(t|0))}Ya(O|0);O=(b[u>>2]|0)-(b[C>>2]|0)|0;t=a+4|0;0==(b[t>>2]|0)?(K=b[a+16>>2]|0,hb(b[a+100>>2]|0,z,y,b[m>>2]|0,K,K<<1),da=b[m>>2]|0):(K=b[m>>2]|0,0>=(K|0)||Fa(p|0,B|0,1<(K|0)?K<<2:4)|0,da=K);gb(y,
da,0.0020000000949949026);fb(y,D,b[m>>2]|0,r);da=a+212|0;B=a+208|0;p=b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0;0==(p|0)?I=815:2<(b[a+192>>2]|0)&&3>(b[p+8>>2]|0)?I=815:0!=(b[p+4>>2]|0)?I=815:-1!=(b[p>>2]|0)?I=815:0!=(b[a+156>>2]|0)?I=815:0!=(b[a+164>>2]|0)?I=815:(ja=fa=0,aa=a+72|0,bb=O<<2);if(815==(I|0))for(pa(+e[a+56>>2],D,F,b[m>>2]|0),pa(+e[a+60>>2],D,H,b[m>>2]|0),p=a+88|0,K=b[p>>2]|0,L=a+72|0,w=b[L>>2]|0,N=O<<2,Fa(K|0,w|0,N)|0,w=(b[p>>2]|0)+(O<<2)|0,K=(b[C>>2]|0)-O<<2,Fa(w|0,c|0,K)|0,K=b[p>>2]|0,$a(K,F,
H,K,b[C>>2]|0,b[m>>2]|0,b[a+116>>2]|0,r),K=E|0,w=q|0,Ob(b[p>>2]|0,b[a+28>>2]|0,b[J>>2]|0,b[C>>2]|0,K,w,6,r),T=+e[w>>2],Q=0.85*T,w=b[K>>2]|0,K=1;;){a:do if(+e[q+(K<<2)>>2]>Q){p=b[E+(K<<2)>>2]|0;M=(p<<1)-w|0;do if(3<=((0>(M|0)?-M|0:M)|0)&&(ca=(3*p|0)-w|0,!(4>((0>(ca|0)?-ca|0:ca)|0))&&(ca=(p<<2)-w|0,!(5>((0>(ca|0)?-ca|0:ca)|0))&&(ca=(5*p|0)-w|0,6<=((0>(ca|0)?-ca|0:ca)|0))))){va=w;break a}while(0);va=p}else va=w;while(0);M=K+1|0;if(6>(M|0))w=va,K=M;else{fa=va;ja=T;aa=L;bb=N;break}}N=a+80|0;L=b[N>>2]|
0;va=b[aa>>2]|0;Fa(L|0,va|0,bb)|0;bb=(b[N>>2]|0)+(O<<2)|0;va=(b[C>>2]|0)-O<<2;Fa(bb|0,c|0,va)|0;va=b[N>>2]|0;Bb(va,D,va,b[C>>2]|0,b[m>>2]|0,b[a+120>>2]|0,r);T=+Qa(b[N>>2]|0,b[C>>2]|0);X=1!=(b[da>>2]|0)&0<(fa|0)?T*+Wa(1-ja*ja*0.8)*1.1:T;va=b[a+144>>2]|0;do if(0==(va|0))I=866;else if(c=a+156|0,0==(b[c>>2]|0)&&0==(b[a+164>>2]|0))I=866;else{bb=b[m>>2]|0;if(0<(bb|0)){O=b[a+100>>2]|0;L=T=0;do Q=+e[O+(L<<2)>>2]-+e[z+(L<<2)>>2],T+=Q*Q,L=L+1|0;while((L|0)<(bb|0));ba=T}else ba=0;bb=a+176|0;0!=(b[bb>>2]|0)&&
(Q=+e[a+180>>2],0<+e[a+184>>2]*Q?(E=-1E-5*Q/(+e[a+188>>2]+1),ia=0.05<E?0.05000000074505806:E,O=-0.05<=ia?ia:-0.05000000074505806):O=0,p=a+148|0,Q=O+ +e[p>>2],ia=10<Q?10:Q,e[p>>2]=ia,0<=ia||(e[p>>2]=0));T=+ic(va,v,b[C>>2]|0,fa,ja);e[a+152>>2]=T;if(0==(b[c>>2]|0)){p=a+172|0;a:do if(2>T){L=b[p>>2]|0;do if(!(0==(L|0)|0.05<ba||0==(b[a+168>>2]|0)|20<(L|0))){b[p>>2]=L+1;W=0;break a}while(0);W=b[p>>2]=1}else b[p>>2]=0,W=b[a+216>>2]|0;while(0);b[da>>2]=W}else{b[h>>2]=8;ia=+e[a+148>>2];p=~~+ib(ia);Q=ia-+(p|
0);c=p+1|0;E=+(c|0)-ia;if(10==(p|0))for(L=0,ia=100,O=8;;)if(K=+e[392+(44*O|0)>>2],T>K?(K=T-K,K>=ia?(p=ia,Q=L):(p=K,Q=O)):(p=ia,Q=L),K=O-1|0,0==(K|0)){ha=Q;break}else L=Q,ia=p,O=K;else for(O=0,ia=100,L=8;;)if(K=Q*+e[352+(44*L|0)+(c<<2)>>2]+E*+e[352+(44*L|0)+(p<<2)>>2],T>K?(K=T-K,K>=ia?(q=ia,ia=O):(q=K,ia=L)):(q=ia,ia=O),K=L-1|0,0==(K|0)){ha=ia;break}else O=ia,ia=q,L=K;b[h>>2]=ha;L=a+172|0;a:do if(0==(ha|0)){O=b[L>>2]|0;do if(!(0==(O|0)|0.05<ba||0==(b[a+168>>2]|0)|20<(O|0))){b[h>>2]=0;b[L>>2]=O+1;break a}while(0);
b[h>>2]=1;b[L>>2]=1}else b[L>>2]=0;while(0);L=h;ea(a,6,L)|0;L=a+160|0;0<(b[L>>2]|0)&&(O=k,ea(a,19,O)|0,p=b[L>>2]|0,(b[k>>2]|0)<=(p|0)||(b[k>>2]=p,ea(a,18,O)|0));0!=(b[bb>>2]|0)&&(L=n,ea(a,19,L)|0,L=(b[n>>2]|0)-(b[bb>>2]|0)|0,O=a+180|0,e[O>>2]=+e[O>>2]+ +(L|0),O=a+184|0,e[O>>2]=0.95*+e[O>>2]+0.05*+(L|0),L=a+188|0,e[L>>2]=+e[L>>2]+1)}}while(0);866==(I|0)&&(e[a+152>>2]=-1);0!=(b[a+204>>2]|0)&&(g(d,0,1),g(d,b[da>>2]|0,4));n=b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0;if(0==(n|0)){k=b[C>>2]|0;if(0<(k|0))for(h=a+
88|0,ha=0;;)if(e[(b[h>>2]|0)+(ha<<2)>>2]=1.0000000036274937E-15,e[(b[N>>2]|0)+(ha<<2)>>2]=1.0000000036274937E-15,ia=ha+1|0,Q=b[C>>2]|0,(ia|0)<(Q|0))ha=ia;else{Z=Q;break}else Z=k;if(0<(b[m>>2]|0)){k=a+112|0;ha=0;do e[(b[k>>2]|0)+(ha<<2)>>2]=0,ha=ha+1|0;while((ha|0)<(b[m>>2]|0));ga=b[C>>2]|0}else ga=Z;b[t>>2]=1;b[a+40>>2]=1;Z=b[aa>>2]|0;ha=b[u>>2]|0;Fa(Z|0,v+((ga<<1)-ha<<2)|0,ha-ga<<2)|0;if(0>=(b[m>>2]|0))return f=cb,0;h=a+108|0;for(k=0;;)if(e[(b[h>>2]|0)+(k<<2)>>2]=0,Z=k+1|0,(Z|0)<(b[m>>2]|0))k=Z;
else{qa=0;break}f=cb;return qa|0}k=b[m>>2]|0;if(0!=(b[t>>2]|0)&0<(k|0)){h=a+100|0;Z=0;do e[(b[h>>2]|0)+(Z<<2)>>2]=+e[z+(Z<<2)>>2],Z=Z+1|0,oa=b[m>>2]|0;while((Z|0)<(oa|0));sa=b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0;Ma=oa}else sa=n,Ma=k;Pb[b[sa+16>>2]&7](z,A,Ma,d);Ma=b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0;-1==(b[Ma>>2]|0)?T=Ma:(g(d,fa-(b[a+28>>2]|0)|0,7),T=b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0);0==(b[T+4>>2]|0)?Ea=ja:(T=~~+ib(13.5*ja+0.5),Ma=15<(T|0)?15:T,T=0>(Ma|0)?0:Ma,g(d,T,4),Ea=0.066667*+(T|0));T=~~+ib(3.5*+ab(X)+
0.5);Ma=0>(T|0)?0:T;T=31<(Ma|0)?31:Ma;X=+vb(+(T|0)/3.5);g(d,T,5);T=b[m>>2]|0;if(0!=(b[t>>2]|0)&0<(T|0))for(Ma=a+104|0,sa=0;;)if(e[(b[Ma>>2]|0)+(sa<<2)>>2]=+e[A+(sa<<2)>>2],k=sa+1|0,n=b[m>>2]|0,(k|0)<(n|0))sa=k;else{Ga=n;break}else Ga=T;T=a+12|0;sa=b[T>>2]|0;Ma=f;f=f+(4*sa|0)|0;n=f=f+7&-8;f=f+(4*sa|0)|0;k=f=f+7&-8;f=f+(4*sa|0)|0;oa=f=f+7&-8;f=f+(4*sa|0)|0;Z=f=f+7&-8;f=f+(4*sa|0)|0;h=f=f+7&-8;f=f+(4*sa|0)|0;ga=f=f+7&-8;f=f+(4*Ga|0)|0;f=f+7&-8;ha=a+16|0;Q=b[ha>>2]|0;a:do if(0<(Q|0)){ia=a+88|0;W=a+100|
0;va=a+104|0;L=a+136|0;O=a+56|0;p=a+60|0;c=a+124|0;K=a+192|0;w=a+112|0;E=a+28|0;q=a+40|0;M=a+200|0;ca=a+36|0;P=a+52|0;U=n;V=a+140|0;R=a+108|0;Y=fa;Ja=0;ba=Q;Aa=sa;for(la=Ga;;){Ka=ta(Aa,Ja)|0;Oa=b[N>>2]|0;Ta=Oa+(Ka<<2)|0;ua=b[ia>>2]|0;Ua=ua+(Ka<<2)|0;hb(b[W>>2]|0,z,y,la,Ja,ba);hb(b[va>>2]|0,A,x,b[m>>2]|0,Ja,b[ha>>2]|0);gb(y,b[m>>2]|0,0.0020000000949949026);gb(x,b[m>>2]|0,0.0020000000949949026);fb(y,D,b[m>>2]|0,r);fb(x,G,b[m>>2]|0,r);Ca=b[m>>2]|0;if(0<(Ca|0))for(ja=1,la=0;;)if(ba=ja+(+e[G+((la|1)<<
2)>>2]-+e[G+(la<<2)>>2]),ya=la+2|0,(ya|0)<(Ca|0))ja=ba,la=ya;else{Ha=ba;break}else Ha=1;e[(b[L>>2]|0)+(Ja<<2)>>2]=Ha;pa(+e[O>>2],D,F,b[m>>2]|0);ja=+e[p>>2];la=b[m>>2]|0;0>ja?0>=(la|0)||wa(l|0,0,(1<(la|0)?la<<2:4)|0):pa(ja,D,H,la);la=(b[u>>2]|0)-(b[C>>2]|0)|0;if((la|0)!=(b[T>>2]|0)){I=900;break}Ca=0<(la|0);do if(0==(Ja|0))if(Ca)for(ba=0;;)if(ja=+e[(b[aa>>2]|0)+(ba<<2)>>2],e[ua+(ba+Ka<<2)>>2]=ja,e[h+(ba<<2)>>2]=ja,ya=ba+1|0,Da=b[T>>2]|0,(ya|0)<(Da|0))ba=ya;else{Ba=Da;break}else Ba=la;else if(Ca)for(Da=
Ja-1|0,ya=0,na=la;;)if(ja=+e[v+((ta(na,Da)|0)+ya<<2)>>2],e[ua+(ya+Ka<<2)>>2]=ja,e[h+(ya<<2)>>2]=ja,na=ya+1|0,ba=b[T>>2]|0,(na|0)<(ba|0))ya=na,na=ba;else{Ba=ba;break}else Ba=la;while(0);Bb(h,G,h,Ba,b[m>>2]|0,b[c>>2]|0,r);la=Aa>>(0==(b[K>>2]|0));Jb(G,F,H,Z,la,b[m>>2]|0,r);Ca=b[T>>2]|0;if((la|0)<(Ca|0)){na=la;do e[Z+(na<<2)>>2]=1.0000000036274937E-15,na=na+1|0;while((na|0)<(Ca|0))}na=b[m>>2]|0;if(0<(na|0)){la=b[R>>2]|0;ya=0;do e[ga+(ya<<2)>>2]=+e[la+(ya<<2)>>2],ya=ya+1|0;while((ya|0)<(na|0))}if(0<(Ca|
0)){ya=0;do e[oa+(ya<<2)>>2]=1.0000000036274937E-15,ya=ya+1|0;while((ya|0)<(Ca|0))}Za(oa,G,oa,Ca,na,ga,r);ya=b[m>>2]|0;if(0<(ya|0)){la=b[w>>2]|0;Da=0;do e[ga+(Da<<2)>>2]=+e[la+(Da<<2)>>2],Da=Da+1|0;while((Da|0)<(ya|0))}$a(oa,F,H,oa,b[T>>2]|0,ya,ga,r);Da=b[m>>2]|0;if(0<(Da|0)){la=b[w>>2]|0;na=0;do e[ga+(na<<2)>>2]=+e[la+(na<<2)>>2],na=na+1|0;while((na|0)<(Da|0))}$a(Ua,F,H,Ua,b[T>>2]|0,Da,ga,r);if(0==(b[K>>2]|0)&&0<(b[m>>2]|0)){ba=0;do e[(b[w>>2]|0)+(ba<<2)>>2]=+e[ga+(ba<<2)>>2],ba=ba+1|0;while((ba|
0)<(b[m>>2]|0))}Da=b[T>>2]|0;if(0<(Da|0)){na=0;do e[Ma+(na<<2)>>2]=+e[ua+(na+Ka<<2)>>2]-+e[oa+(na<<2)>>2],na=na+1|0;while((na|0)<(Da|0))}wa(Ta|0,0,Da<<2|0);na=b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0;ua=b[na+24>>2]|0;if(0==(ua|0)){I=926;break}la=b[na>>2]|0;-1==(la|0)?(Aa=b[J>>2]|0,la=b[E>>2]|0):0==(la|0)?la=Aa=Y:(ya=la-1+(b[E>>2]|0)|0,Ca=(Y|0)<(ya|0)?ya:Y,ya=(b[J>>2]|0)-la|0,ba=(Ca|0)>(ya|0)?ya:Ca,Aa=ba+la|0,la=1-la+ba|0,Y=ba);ba=jc[ua&7](Ma,Ua,G,F,H,k,b[na+32>>2]|0,la,0!=(b[q>>2]|0)&(Aa|0)>(Ka|0)?Ka:Aa,
Ea,b[m>>2]|0,b[T>>2]|0,d,r,Ta,Z,b[K>>2]|0,0,b[M>>2]|0,ca)|0;b[(b[P>>2]|0)+(Ja<<2)>>2]=ba;ba=b[T>>2]|0;wa(U|0,0,ba<<2|0);if(0<(ba|0)){na=0;do ua=h+(na<<2)|0,e[ua>>2]=+e[ua>>2]-+e[k+(na<<2)>>2],na=na+1|0;while((na|0)<(ba|0))}ja=+Qa(h,ba)/X;na=b[(b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0)+8>>2]|0;3==(na|0)?(Da=ob(ja,6864,8)|0,g(d,Da,3),Aa=X*+e[6896+(Da<<2)>>2]):0==(na|0)?Aa=X:(na=ob(ja,6928,2)|0,g(d,na,1),Aa=X*+e[6936+(na<<2)>>2]);La(Ma,Ma,Aa,b[T>>2]|0);na=b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0;Da=b[na+36>>2]|0;
if(0==(Da|0)){I=936;break}wb[Da&7](Ma,G,F,H,b[na+44>>2]|0,b[m>>2]|0,b[T>>2]|0,n,Z,d,r,b[K>>2]|0,b[na+12>>2]|0);ra(n,n,Aa,b[T>>2]|0);na=b[T>>2]|0;if(0<(na|0))for(Da=0;;)if(e[Oa+(Da+Ka<<2)>>2]=+e[k+(Da<<2)>>2]+ +e[n+(Da<<2)>>2],ua=Da+1|0,la=b[T>>2]|0,(ua|0)<(la|0))Da=ua;else{Na=la;break}else Na=na;if(0==(b[(b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0)+12>>2]|0))ua=Na;else{Da=Xa()|0;ba=f;f=f+(4*Na|0)|0;f=f+7&-8;la=b[T>>2]|0;wa(ba|0,0,la<<2|0);if(0<(la|0)){ua=0;do Ca=Ma+(ua<<2)|0,e[Ca>>2]=2.200000047683716*+e[Ca>>
2],ua=ua+1|0;while((ua|0)<(la|0))}ua=b[(b[B>>2]|0)+(b[da>>2]<<2)>>2]|0;wb[b[ua+36>>2]&7](Ma,G,F,H,b[ua+44>>2]|0,b[m>>2]|0,la,ba,Z,d,r,b[K>>2]|0,0);ra(ba,ba,0.4545449912548065*Aa,b[T>>2]|0);ua=b[T>>2]|0;if(0<(ua|0)){na=0;do Ca=n+(na<<2)|0,e[Ca>>2]=+e[Ca>>2]+ +e[ba+(na<<2)>>2],na=na+1|0;while((na|0)<(ua|0))}Ya(Da|0);ua=b[T>>2]|0}if(0<(ua|0))for(ua=0;;)if(e[Oa+(ua+Ka<<2)>>2]=+e[k+(ua<<2)>>2]+ +e[n+(ua<<2)>>2],na=ua+1|0,ba=b[T>>2]|0,(na|0)<(ba|0))ua=na;else{Va=ba;break}else Va=ua;0==(b[V>>2]|0)?Ka=Va:
(ja=+$(n,Va),e[(b[V>>2]|0)+(Ja<<2)>>2]=ja,Ka=b[T>>2]|0);Za(Ta,G,Ua,Ka,b[m>>2]|0,b[R>>2]|0,r);0!=(b[K>>2]|0)&&$a(Ua,F,H,Ua,b[T>>2]|0,b[m>>2]|0,b[w>>2]|0,r);ua=Ja+1|0;Ka=b[ha>>2]|0;if((ua|0)>=(Ka|0))break a;Ja=ua;ba=Ka;Aa=b[T>>2]|0;la=b[m>>2]|0}if(900==(I|0))return qb(13800,708),0;if(926==(I|0))return qb(13568,760),0;if(936==(I|0))return qb(13376,842),0}while(0);if(0<(b[da>>2]|0)){if(0<(b[m>>2]|0)){I=a+100|0;T=0;do e[(b[I>>2]|0)+(T<<2)>>2]=+e[z+(T<<2)>>2],T=T+1|0,h=b[m>>2]|0;while((T|0)<(h|0));if(!(0>=
(h|0))){T=a+104|0;I=0;do e[(b[T>>2]|0)+(I<<2)>>2]=+e[A+(I<<2)>>2],I=I+1|0;while((I|0)<(b[m>>2]|0))}}1==(b[da>>2]|0)&&(0==(b[a+172>>2]|0)?g(d,0,4):g(d,15,4))}b[t>>2]=0;t=b[aa>>2]|0;aa=b[C>>2]|0;C=b[u>>2]|0;u=v+((aa<<1)-C<<2)|0;Fa(t|0,u|0,C-aa<<2)|0;v=b[da>>2]|0;b[(a+40|0)>>2]=4==(b[(b[(b[B>>2]|0)+(v<<2)>>2]|0)+36>>2]|0)|0==(v|0)?1:0;f=cb;return 1}function qb(a,c){var e=0;sa(b[Oa>>2]|0,13984,(e=f,f=f+24|0,b[e>>2]=13904,b[e+8>>2]=c|0,b[e+16>>2]=a|0,e)|0)|0;f=e;Tc(1)}function kc(a){a|=0;var c=0,d=0,f=
0,g=0,q=0,h=0,k=0,n=0,c=b[a>>2]|0,d=aa(508,1)|0;if(0==(d|0))return 0;b[d+44>>2]=0;b[d>>2]=a;b[d+124>>2]=1;b[d+4>>2]=1;a=c;f=b[a>>2]|0;b[d+12>>2]=f;g=c+4|0;q=(b[a>>2]|0)/(b[g>>2]|0)|0;b[d+20>>2]=q;a=b[g>>2]|0;b[d+16>>2]=a;g=b[c+8>>2]|0;b[d+24>>2]=g;b[d+28>>2]=b[c+12>>2];h=b[c+16>>2]|0;b[d+32>>2]=h;b[d+128>>2]=c+32;b[d+132>>2]=b[c+96>>2];b[d+136>>2]=1;c=h<<1;n=k=aa((c+f+a<<2)+48|0,1)|0;b[d+48>>2]=n;b[d+52>>2]=n+(a+6+c<<2);wa(k|0,0,h+f<<2|0);f=g<<2;b[d+60>>2]=aa(f,1)|0;b[d+56>>2]=aa(f,1)|0;b[d+64>>2]=
aa(f,1)|0;b[d+76>>2]=aa(q<<2,1)|0;b[d+96>>2]=40;b[d+8>>2]=0;wa(d+104|0,0,16);b[d+120>>2]=1E3;b[d+36>>2]=8E3;e[d+40>>2]=0;b[d+464>>2]=22;b[d+468>>2]=0;b[d+144>>2]=0;b[d+164>>2]=0;b[d+184>>2]=0;b[d+204>>2]=0;b[d+224>>2]=0;b[d+244>>2]=0;b[d+264>>2]=0;b[d+284>>2]=0;b[d+304>>2]=0;b[d+324>>2]=0;b[d+344>>2]=0;b[d+364>>2]=0;b[d+384>>2]=0;b[d+404>>2]=0;b[d+424>>2]=0;b[d+444>>2]=0;wa(d+480|0,0,24);b[d+504>>2]=1;return d|0}function lc(a){a|=0;V(b[a+48>>2]|0);V(b[a+60>>2]|0);V(b[a+56>>2]|0);V(b[a+64>>2]|0);V(b[a+
76>>2]|0);V(a)}function mc(a,c,d){a|=0;c|=0;d|=0;var g=0,E=0,q=0,xa=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,l=0,z=0,B=0,A=0,y=0,C=0,w=0,D=0,G=0,M=0,J=0,N=0,O=m=0,ka=0,K=0,L=0,P=0,I=0,R=0,$=0,ca=0,Y=0,U=0,Q=0,T=0,da=0,V=0,ea=0,ja=0,fa=0,aa=0,Ea=0,X=0,ba=0,ia=0,W=0,ha=0,Z=0,ga=0,qa=X=0,oa=qa=0,Ga=oa=J=0,Ma=qa=qa=X=oa=W=0,La=u=0,Ba=0,Ja=0,Aa=aa=0,la=0,Ka=Z=aa=0,Ha=0,Na=Z=0,ua=0,Ua=0,Ca=E=0,ya=0,g=f;f=f+24|0;E=g|0;q=g+8|0;xa=d;k=a;n=b[a+44>>2]|0;do if(0==(c|0))if(0!=(b[a+496>>2]|0))v=a+132|0,b[v>>2]=0,
r=v;else{v=a+8|0;m=b[v>>2]|0;u=10>(m|0)?+e[12640+(m<<2)>>2]:0;t=+e[a+104>>2];F=+e[a+108>>2];H=+e[a+112>>2];l=t<F?F<H?F:t<H?H:t:H<F?F:H<t?H:t;m=a+100|0;t=+e[m>>2];z=l<t?e[m>>2]=l:t;t=u*(0.85<z?0.8500000238418579:z)+1.0000000036274937E-15;m=a+52|0;B=a+12|0;H=+Qa(b[m>>2]|0,b[B>>2]|0);A=b[a+48>>2]|0;y=a+32|0;C=a+16|0;pb(A|0,A+(b[B>>2]<<2)|0,((b[y>>2]<<1)+(b[C>>2]|0)<<2)+48|0);A=b[a+96>>2]|0;F=+((b[v>>2]|0)+1|0);w=a+120|0;D=(ta(b[w>>2]|0,1664525)|0)+1013904223|0;b[w>>2]=D;G=~~(3.4642*F*((b[db>>2]=D&8388607|
1065353216,+e[db>>2])+-1.5))+A|0;A=b[y>>2]|0;y=(G|0)>(A|0)?A:G;G=b[a+28>>2]|0;A=(y|0)<(G|0)?G:y;a:do if(0<(b[B>>2]|0))for(F=H*u*(1-t*t)*3.4642,y=0,G=D;;){M=b[m>>2]|0;J=t*(+e[M+(y-A<<2)>>2]+1.0000000036274937E-15);N=(ta(G,1664525)|0)+1013904223|0;b[w>>2]=N;e[M+(y<<2)>>2]=J+F*((b[db>>2]=N&8388607|1065353216,+e[db>>2])+-1.5);N=y+1|0;if((N|0)>=(b[B>>2]|0))break a;y=N;G=b[w>>2]|0}while(0);w=a+60|0;A=b[w>>2]|0;D=a+24|0;pa(0.9800000190734863,A,A,b[D>>2]|0);Za((b[m>>2]|0)+(-(b[C>>2]|0)<<2)|0,b[w>>2]|0,xa,
b[B>>2]|0,b[D>>2]|0,b[a+64>>2]|0,n);za(xa,xa,b[B>>2]|0,1,a+68|0);b[a+4>>2]=0;b[v>>2]=(b[v>>2]|0)+1;D=a+116|0;w=b[D>>2]|0;b[D>>2]=w+1;e[k+104+(w<<2)>>2]=t;if(2>=(b[D>>2]|0))return m=0,f=g,m|0;m=b[D>>2]=0;f=g;return m|0}else if(0==(b[a+124>>2]|0))r=a+132|0;else{if(5>(x(c)|0))return m=-1,f=g,m|0;D=a+140|0;w=a+464|0;A=a+468|0;a:for(;;){do if(0!=(h(c,1)|0)){p(c,(b[232+((h(c,3)|0)<<2)>>2]|0)-4|0);if(5>(x(c)|0)){m=-1;O=1124;break a}if(0!=(h(c,1)|0)&&(p(c,(b[232+((h(c,3)|0)<<2)>>2]|0)-4|0),0!=(h(c,1)|0))){O=
1005;break a}}while(0);if(4>(x(c)|0)){m=-1;O=1129;break}ka=h(c,4)|0;if(14==(ka|0)){if(G=nc(c,D,a)|0,0!=(G|0)){m=G;O=1121;break}}else if(13==(ka|0)){if(G=Ta[b[w>>2]&31](c,a,b[A>>2]|0)|0,0!=(G|0)){m=G;O=1125;break}}else{15==(ka|0)?(m=-1,O=1130):O=1011;break}if(5>(x(c)|0)){m=-1;O=1122;break}}if(1005==(O|0))return A=b[Oa>>2]|0,sa(A|0,14032,(K=f,f=f+8|0,b[K>>2]=13040,K)|0)|0,f=K,m=-2,f=g,m|0;if(1011==(O|0))if(8>=(ka|0))A=a+132|0,b[A>>2]=ka,r=A;else return sa(b[Oa>>2]|0,14032,(K=f,f=f+8|0,b[K>>2]=13208,
K)|0)|0,f=K,m=-2,f=g,m|0;else if(1121==(O|0)||1122==(O|0)||1124==(O|0)||1125==(O|0)||1129==(O|0)||1130==(O|0))return f=g,m|0}while(0);K=b[a+48>>2]|0;ka=a+12|0;k=a+32|0;A=a+16|0;pb(K|0,K+(b[ka>>2]<<2)|0,((b[k>>2]<<1)+(b[A>>2]|0)<<2)+48|0);K=a+128|0;w=0==(b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0);D=a+24|0;v=b[D>>2]|0;B=Xa()|0;C=f;f=f+(4*v|0)|0;f=f+7&-8;if(w){pa(0.9300000071525574,b[a+60>>2]|0,C,b[D>>2]|0);w=a+52|0;u=+Qa(b[w>>2]|0,b[ka>>2]|0);v=b[ka>>2]|0;if(0<(v|0))for(m=a+120|0,z=3.4642*u,G=0;;)if(y=(ta(b[m>>
2]|0,1664525)|0)+1013904223|0,b[m>>2]=y,e[(b[w>>2]|0)+(G<<2)>>2]=z*((b[db>>2]=y&8388607|1065353216,+e[db>>2])+-1.5),y=G+1|0,N=b[ka>>2]|0,(y|0)<(N|0))G=y;else{L=N;break}else L=v;b[a+4>>2]=1;Za(b[w>>2]|0,C,xa,L,b[D>>2]|0,b[a+64>>2]|0,n);b[a+8>>2]=0;Ya(B|0);f=g;return 0}Qb[b[(b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0)+20>>2]&7](C,b[D>>2]|0,c);L=a+8|0;if(0!=(b[L>>2]|0)&&(w=b[D>>2]|0,v=0<(w|0))){G=b[a+56>>2]|0;m=z=0;do u=+e[G+(m<<2)>>2]-+e[C+(m<<2)>>2],P=0>u?-0-u:u,z+=P,m=m+1|0;while((m|0)<(w|0));u=0.6*+vb(-0.2*
z);if(v){w=a+64|0;m=0;do G=(b[w>>2]|0)+(m<<2)|0,e[G>>2]=u*+e[G>>2],m=m+1|0;while((m|0)<(b[D>>2]|0))}}m=a+4|0;0==(b[m>>2]|0)?0!=(b[L>>2]|0)&&(O=1030):O=1030;if(1030==(O|0)&&!(0>=(b[D>>2]|0))){w=a+56|0;v=0;do e[(b[w>>2]|0)+(v<<2)>>2]=+e[C+(v<<2)>>2],v=v+1|0;while((v|0)<(b[D>>2]|0))}v=b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0;-1==(b[v>>2]|0)?(I=0,R=v):(v=b[a+28>>2]|0,I=w=(h(c,7)|0)+v|0,R=b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0);$=0==(b[R+4>>2]|0)?0:0.066667*+(h(c,4)|0);P=+vb(+(h(c,5)|0)/3.5);R=f;f=f+(4*(b[D>>2]|0)|
0)|0;f=f+7&-8;w=b[A>>2]|0;v=f;f=f+(4*w|0)|0;G=f=f+7&-8;f=f+(4*w|0)|0;f=f+7&-8;w=b[r>>2]|0;1==(w|0)?(b[a+496>>2]=15==(h(c,4)|0),ca=b[r>>2]|0):ca=w;1<(ca|0)&&(b[a+496>>2]=0);ca=a+20|0;do if(0<(b[ca>>2]|0)){w=a+52|0;N=a+80|0;y=a+28|0;M=q|0;Y=a+100|0;U=q+4|0;Q=q+8|0;T=v;da=a+120|0;u=1.5*($+-0.20000000298023224);z=0>u?0:u;u=1<z?1:z;V=a+492|0;ea=a+480|0;z=1-0.8500000238418579*u;l=0.15000000596046448*u;ja=a+484|0;fa=a+488|0;t=+(I<<1|0);H=P*u;F=u=0;aa=40;Ea=0;for(X=b[A>>2]|0;;){ba=ta(X,Ea)|0;ia=b[w>>2]|0;
W=ia+(ba<<2)|0;ha=b[N>>2]|0;Z=0==(ha|0)?0:ha+(ba<<2)|0;ha=W;wa(ha|0,0,X<<2|0);ga=b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0;X=b[ga+28>>2]|0;if(0==(X|0)){O=1046;break}qa=b[ga>>2]|0;-1==(qa|0)?(qa=b[k>>2]|0,oa=b[y>>2]|0):0==(qa|0)?oa=qa=I:(J=I-qa+1|0,oa=b[y>>2]|0,Ga=qa+I|0,qa=b[k>>2]|0,qa=(Ga|0)>(qa|0)?qa:Ga,oa=(J|0)<(oa|0)?oa:J);oc[X&7](W,G,oa,qa,$,b[ga+32>>2]|0,b[A>>2]|0,E,M,c,n,b[L>>2]|0,ba,+e[Y>>2],0);va(G,-32E3,32E3,b[A>>2]|0);J=+e[U>>2];W=0>J?-0-J:J;oa=J=+e[M>>2];X=0<J?oa:-0.5*oa;J=oa=+e[Q>>2];qa=0<oa?
J:-0.5*J;J=W+X+qa;qa=u+J;(ga=J>F)?(W=b[E>>2]|0,X=(aa<<1)-W|0,2>=((0>(X|0)?-X|0:X)|0)?O=1060:(X=(3*aa|0)-W|0,3>=((0>(X|0)?-X|0:X)|0)?O=1060:(X=(aa<<2)-W|0,4<((0>(X|0)?-X|0:X)|0)?(Ma=W,O=1069):O=1060))):O=1060;a:do if(1060==(O|0)){O=0;oa=J;u=F;oa>0.6*u?(W=b[E>>2]|0,X=aa-(W<<1)|0,3>((0>(X|0)?-X|0:X)|0)?La=W:(X=(-3*W|0)+aa|0,4>((0>(X|0)?-X|0:X)|0)?La=W:(X=aa-(W<<2)|0,5>((0>(X|0)?-X|0:X)|0)?La=W:O=1064))):O=1064;do if(1064==(O|0)){O=0;if(0.67*oa<=u){Ba=aa;Ja=F;break a}W=b[E>>2]|0;X=(aa<<1)-W|0;if(3>((0>
(X|0)?-X|0:X)|0))La=W;else if(X=(3*aa|0)-W|0,4>((0>(X|0)?-X|0:X)|0))La=W;else if(X=(aa<<2)-W|0,5>((0>(X|0)?-X|0:X)|0))La=W;else{Ba=aa;Ja=F;break a}}while(0);ga?(Ma=La,O=1069):(Ba=La,Ja=F)}while(0);1069==(O|0)&&(O=0,Ba=Ma,Ja=J);wa(T|0,0,b[A>>2]<<2|0);ga=b[(b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0)+8>>2]|0;aa=3==(ga|0)?P*+e[6896+((h(c,3)|0)<<2)>>2]:1==(ga|0)?P*+e[6936+((h(c,1)|0)<<2)>>2]:P;ga=b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0;W=b[ga+40>>2]|0;if(0==(W|0)){O=1074;break}xb[W&7](v,b[ga+44>>2]|0,b[A>>2]|0,c,n,da);
ra(v,v,aa,b[A>>2]|0);if(0!=(b[(b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0)+12>>2]|0)){ga=b[A>>2]|0;W=Xa()|0;X=f;f=f+(4*ga|0)|0;f=f+7&-8;ga=b[A>>2]|0;wa(X|0,0,ga<<2|0);J=b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0;xb[b[J+40>>2]&7](X,b[J+44>>2]|0,ga,c,n,da);ra(X,X,0.4545449912548065*aa,b[A>>2]|0);ga=b[A>>2]|0;if(0<(ga|0)){J=0;do oa=v+(J<<2)|0,e[oa>>2]=+e[oa>>2]+ +e[X+(J<<2)>>2],J=J+1|0;while((J|0)<(ga|0))}Ya(W|0)}ga=b[A>>2]|0;if(0<(ga|0))for(J=0;;)if(e[ia+(J+ba<<2)>>2]=+e[G+(J<<2)>>2]+ +e[v+(J<<2)>>2],X=J+1|0,oa=b[A>>2]|
0,(X|0)<(oa|0))J=X;else{Aa=oa;break}else Aa=ga;if(0!=(Z|0)&0<(Aa|0))for(J=0;;)if(e[Z+(J<<2)>>2]=+e[v+(J<<2)>>2],W=J+1|0,oa=b[A>>2]|0,(W|0)<(oa|0))J=W;else{la=oa;break}else la=Aa;do if(1==(b[r>>2]|0)){wa(ha|0,0,la<<2|0);J=b[V>>2]|0;ga=b[A>>2]|0;if((J|0)<(ga|0))for(oa=J,W=ga;;)if(-1<(oa|0)?(e[ia+(oa+ba<<2)>>2]=H*+Wa(t),aa=b[V>>2]|0,Z=b[A>>2]|0):(aa=oa,Z=W),X=aa+I|0,b[V>>2]=X,(X|0)<(Z|0))oa=X,W=Z;else{Ka=X;Ha=Z;break}else Ka=J,Ha=ga;b[V>>2]=Ka-Ha;if(0<(Ha|0))for(Z=0;;)if(W=ia+(Z+ba<<2)|0,J=+e[W>>2],
oa=v+(Z<<2)|0,e[W>>2]=0.699999988079071*J+0.30000001192092896*+e[ea>>2]+(z*+e[oa>>2]-l*+e[ja>>2]),e[ea>>2]=J,e[ja>>2]=+e[oa>>2],J=0.800000011920929*+e[fa>>2]+0.20000000298023224*+e[W>>2],e[fa>>2]=J,e[W>>2]=+e[W>>2]-J,W=Z+1|0,oa=b[A>>2]|0,(W|0)<(oa|0))Z=W;else{Na=oa;break}else Na=Ha}else Na=la;while(0);ba=Ea+1|0;if((ba|0)<(b[ca>>2]|0))u=qa,F=Ja,aa=Ba,Ea=ba,X=Na;else{O=1091;break}}if(1046==(O|0))return qb(12880,1321),0;if(1074==(O|0))return qb(12800,1397),0;1091==(O|0)&&(ua=0.25*qa,Ua=Ba)}else ua=0,
Ua=40;while(0);Ba=b[D>>2]|0;Na=f;f=f+(4*Ba|0)|0;f=f+7&-8;0==(b[a+136>>2]|0)?O=1096:(qa=+e[(b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0)+48>>2],0>=qa?O=1096:0!=(b[L>>2]|0)?O=1096:(la=a+52|0,Z=b[A>>2]|0,v=a+60|0,Lb((b[la>>2]|0)+(-Z<<2)|0,xa,b[v>>2]|0,Ba,Z<<1,Ua,40,qa,n),Z=b[A>>2]|0,Ha=Z<<1,Lb((b[la>>2]|0)+(Z<<2)|0,xa+(Ha<<2)|0,b[v>>2]|0,b[D>>2]|0,Ha,Ua,40,+e[(b[(b[K>>2]|0)+(b[r>>2]<<2)>>2]|0)+48>>2],n)));1096==(O|0)&&(O=(b[a+52>>2]|0)+(-(b[A>>2]|0)<<2)|0,r=b[ka>>2]<<2,Fa(d|0,O|0,r)|0);if(0!=(b[L>>2]|0)&&(r=a+
52|0,qa=P/(+Qa(b[r>>2]|0,b[ka>>2]|0)+1),Ja=2<qa?2:qa,0<(b[ka>>2]|0))){E=0;do O=(b[r>>2]|0)+(E<<2)|0,e[O>>2]=Ja*+e[O>>2],e[xa+(E<<2)>>2]=+e[(b[r>>2]|0)+(E-(b[A>>2]|0)<<2)>>2],E=E+1|0;while((E|0)<(b[ka>>2]|0))}E=b[ca>>2]|0;if(0<(E|0))for(r=a+56|0,O=a+76|0,d=a+60|0,K=a+64|0,Ba=0,Ha=E,E=b[D>>2]|0;;){v=xa+((ta(b[A>>2]|0,Ba)|0)<<2)|0;hb(b[r>>2]|0,C,Na,E,Ba,Ha);gb(Na,b[D>>2]|0,0.0020000000949949026);fb(Na,R,b[D>>2]|0,n);Z=b[D>>2]|0;if(0<(Z|0))for(la=0,Ja=1;;)if(qa=Ja+(+e[R+((la|1)<<2)>>2]-+e[R+(la<<2)>>
2]),Ka=la+2|0,(Ka|0)<(Z|0))la=Ka,Ja=qa;else{Ca=qa;break}else Ca=1;e[(b[O>>2]|0)+(Ba<<2)>>2]=Ca;Za(v,b[d>>2]|0,v,b[A>>2]|0,b[D>>2]|0,b[K>>2]|0,n);la=b[D>>2]|0;if(0<(la|0))for(Z=0;;)if(e[(b[d>>2]|0)+(Z<<2)>>2]=+e[R+(Z<<2)>>2],Ka=Z+1|0,Z=b[D>>2]|0,(Ka|0)<(Z|0))Z=Ka;else{ya=Z;break}else ya=la;Z=Ba+1|0;v=b[ca>>2]|0;if((Z|0)<(v|0))Ba=Z,Ha=v,E=ya;else break}0!=(b[a+504>>2]|0)&&za(xa,xa,b[ka>>2]|0,0!=(b[a+500>>2]|0)?3:1,a+68|0);Ca=P+1;e[a+84>>2]=Ca;ka=a+88|0;Ja=0.9900000095367432*+e[ka>>2];qa=Ja>Ca?Ja:Ca;
e[ka>>2]=qa;xa=a+92|0;Ja=1.0099999904632568*+e[xa>>2]+1;aa=Ja<Ca?Ja:Ca;e[xa>>2]=aa;Ca=aa+1;qa<Ca&&(e[ka>>2]=Ca);if(0<(b[D>>2]|0)){ka=a+56|0;xa=0;do e[(b[ka>>2]|0)+(xa<<2)>>2]=+e[C+(xa<<2)>>2],xa=xa+1|0;while((xa|0)<(b[D>>2]|0))}b[m>>2]=0;b[L>>2]=0;b[a+96>>2]=Ua;e[a+100>>2]=ua;Ua=a+116|0;L=b[Ua>>2]|0;b[Ua>>2]=L+1;e[a+104+(L<<2)>>2]=ua;2<(b[Ua>>2]|0)&&(b[Ua>>2]=0);e[a+40>>2]=P;Ya(B|0);f=g;return 0}function pc(a,c,d){a|=0;c|=0;d|=0;var g=0,E=0,q=0,h=0,k=0,n=0,v=0,r=0,m=h=0,u=0,t=0,m=v=k=t=0,g=f;f=f+
40|0;E=g|0;q=g+8|0;h=g+16|0;k=g+24|0;n=g+32|0;switch(c|0){case 8:case 6:v=b[d>>2]|0;b[a+212>>2]=v;b[a+216>>2]=v;f=g;break;case 17:b[d>>2]=b[a+192>>2];f=g;break;case 18:b[k>>2]=10;v=b[d>>2]|0;h=k;for(m=n;;){ea(a,4,h)|0;ea(a,19,m)|0;if((b[n>>2]|0)<=(v|0)){r=0;u=1227;break}t=b[k>>2]|0;b[k>>2]=t-1;if(0>=(t|0)){r=0;u=1232;break}}if(1227==(u|0)||1232==(u|0))return f=g,r|0;break;case 12:b[a+156>>2]=b[d>>2];f=g;break;case 101:u=a+16|0;if(0>=(b[u>>2]|0)){f=g;break}k=a+80|0;v=a+12|0;n=d;for(m=0;;)if(h=b[v>>
2]|0,e[n+(m<<2)>>2]=+Qa((b[k>>2]|0)+((ta(h,m)|0)<<2)|0,h),h=m+1|0,(h|0)<(b[u>>2]|0))m=h;else{r=0;break}f=g;return r|0;case 34:b[a+168>>2]=b[d>>2];f=g;break;case 35:b[d>>2]=b[a+168>>2];f=g;break;case 42:b[a+160>>2]=b[d>>2];f=g;break;case 43:b[d>>2]=b[a+160>>2];f=g;break;case 44:b[a+224>>2]=b[d>>2];f=g;break;case 45:b[d>>2]=b[a+224>>2];f=g;break;case 100:m=d;u=a+16|0;if(0>=(b[u>>2]|0)){f=g;break}k=a+136|0;for(n=0;;)if(e[m+(n<<2)>>2]=+e[(b[k>>2]|0)+(n<<2)>>2],v=n+1|0,(v|0)<(b[u>>2]|0))n=v;else{r=0;break}f=
g;return r|0;case 29:e[d>>2]=+e[a+152>>2];f=g;break;case 4:n=b[d>>2]|0;u=0>(n|0)?0:n;n=b[(b[b[a>>2]>>2]|0)+100+((10<(u|0)?10:u)<<2)>>2]|0;b[a+212>>2]=n;b[a+216>>2]=n;f=g;break;case 15:e[d>>2]=+e[a+148>>2];f=g;break;case 104:b[a+140>>2]=d;f=g;break;case 105:b[a+220>>2]=b[d>>2];f=g;break;case 106:b[d>>2]=b[a+68>>2];f=g;break;case 9:case 7:b[d>>2]=b[a+212>>2];f=g;break;case 39:b[d>>2]=(b[a+20>>2]|0)-(b[a+8>>2]|0);f=g;break;case 40:n=b[d>>2]|0;u=a+200|0;b[u>>2]=n;if(100>=(n|0)){f=g;break}b[u>>2]=100;
f=g;break;case 41:b[d>>2]=b[a+200>>2];f=g;break;case 32:u=d;n=b[u>>2]|0;b[a+176>>2]=n;k=0!=(n|0);b[a+156>>2]=k&1;if(!k){f=g;break}b[E>>2]=10;k=b[u>>2]|0;u=E;for(n=q;;){ea(a,4,u)|0;ea(a,19,n)|0;m=b[E>>2]|0;if((b[q>>2]|0)<=(k|0)){t=m;break}v=m-1|0;b[E>>2]=v;if(0>=(m|0)){t=v;break}}k=+(t|0);e[h>>2]=0>k?0:k;ea(a,14,h)|0;e[a+188>>2]=0;e[a+180>>2]=0;e[a+184>>2]=0;f=g;break;case 3:b[d>>2]=b[a+8>>2];f=g;break;case 30:b[a+164>>2]=b[d>>2];f=g;break;case 25:b[d>>2]=b[a+196>>2];f=g;break;case 26:b[a+40>>2]=1;
b[a+4>>2]=1;h=a+24|0;t=b[h>>2]|0;do if(0<(t|0)){E=a+100|0;k=0;for(q=t;;)if(n=k+1|0,e[(b[E>>2]|0)+(k<<2)>>2]=3.1415927410125732*+(n|0)/+(q+1|0),v=b[h>>2]|0,(n|0)<(v|0))k=n,q=v;else break;if(!(0>=(v|0))){q=a+120|0;k=a+108|0;E=a+116|0;n=a+112|0;u=0;do e[(b[q>>2]|0)+(u<<2)>>2]=0,e[(b[k>>2]|0)+(u<<2)>>2]=0,e[(b[E>>2]|0)+(u<<2)>>2]=0,e[(b[n>>2]|0)+(u<<2)>>2]=0,u=u+1|0;while((u|0)<(b[h>>2]|0))}}while(0);h=a+8|0;v=b[h>>2]|0;t=a+32|0;if(0<(v+1+(b[t>>2]|0)|0))for(u=a+84|0,n=a+76|0,E=0;;)if(e[(b[u>>2]|0)+(E<<
2)>>2]=0,e[(b[n>>2]|0)+(E<<2)>>2]=0,k=E+1|0,q=b[h>>2]|0,(k|0)<(q+1+(b[t>>2]|0)|0))E=k;else{m=q;break}else m=v;v=a+20|0;if(0>=((b[v>>2]|0)-m|0)){f=g;break}m=a+72|0;for(E=0;;)if(e[(b[m>>2]|0)+(E<<2)>>2]=0,t=E+1|0,(t|0)<((b[v>>2]|0)-(b[h>>2]|0)|0))E=t;else{r=0;break}f=g;return r|0;case 14:e[a+148>>2]=+e[d>>2];f=g;break;case 31:b[d>>2]=b[a+164>>2];f=g;break;case 19:E=b[(b[a+208>>2]|0)+(b[a+212>>2]<<2)>>2]|0;h=b[a+196>>2]|0;0==(E|0)?b[d>>2]=(5*h|0)/(b[a+8>>2]|0)|0:(v=ta(b[E+52>>2]|0,h)|0,b[d>>2]=(v|0)/
(b[a+8>>2]|0)|0);f=g;break;case 24:b[a+196>>2]=b[d>>2];f=g;break;case 13:b[d>>2]=b[a+156>>2];f=g;break;case 33:b[d>>2]=b[a+176>>2];f=g;break;case 36:b[a+204>>2]=b[d>>2];f=g;break;case 37:b[d>>2]=b[a+204>>2];f=g;break;case 16:v=b[d>>2]|0;d=a+192|0;b[d>>2]=v;if(0<=(v|0)){f=g;break}b[d>>2]=0;f=g;break;default:return sa(b[Oa>>2]|0,12680,(d=f,f=f+16|0,b[d>>2]=12712,b[d+8>>2]=c,d)|0)|0,f=d,f=g,-1}return 0}function qc(a,c,d){a|=0;c|=0;d|=0;var g=0,E=0,q=0,h=0,k=0,n=E=E=0,v=0,r=0,g=f;switch(c|0){case 19:return E=
b[(b[a+128>>2]|0)+(b[a+132>>2]<<2)>>2]|0,q=b[a+36>>2]|0,0==(E|0)?b[d>>2]=(5*q|0)/(b[a+12>>2]|0)|0:(k=ta(b[E+52>>2]|0,q)|0,b[d>>2]=(k|0)/(b[a+12>>2]|0)|0),f=g,0;case 24:return b[a+36>>2]=b[d>>2],f=g,0;case 47:return E=+e[a+92>>2],E=+ab(+e[a+84>>2]/E)/+ab(+e[a+88>>2]/E),E=1<E?1:E,b[d>>2]=0<E?~~(100*E):0,f=g,0;case 100:k=d;q=a+20|0;if(0>=(b[q>>2]|0))return f=g,0;E=a+76|0;for(n=0;;)if(e[k+(n<<2)>>2]=+e[(b[E>>2]|0)+(n<<2)>>2],v=n+1|0,(v|0)<(b[q>>2]|0))n=v;else{h=0;break}f=g;return h|0;case 20:return n=
d,q=a+140|0,b[q+(20*(b[n>>2]|0)|0)+4>>2]=b[d+4>>2],b[q+(20*(b[n>>2]|0)|0)+8>>2]=b[d+8>>2],E=b[n>>2]|0,b[q+(20*E|0)>>2]=E,f=g,0;case 8:case 6:return b[a+132>>2]=b[d>>2],f=g,0;case 36:return b[a+124>>2]=b[d>>2],f=g,0;case 106:return b[d>>2]=b[a+44>>2],f=g,0;case 26:E=a+24|0;if(0<(b[E>>2]|0)){q=a+64|0;n=0;do e[(b[q>>2]|0)+(n<<2)>>2]=0,n=n+1|0;while((n|0)<(b[E>>2]|0))}E=a+12|0;n=a+32|0;if(0>=((b[E>>2]|0)+1+(b[n>>2]|0)|0))return f=g,0;q=a+48|0;for(k=0;;)if(e[(b[q>>2]|0)+(k<<2)>>2]=0,v=k+1|0,(v|0)<((b[E>>
2]|0)+1+(b[n>>2]|0)|0))k=v;else{h=0;break}f=g;return h|0;case 101:k=a+20|0;if(0>=(b[k>>2]|0))return f=g,0;n=a+52|0;E=a+16|0;q=d;for(v=0;;)if(r=b[E>>2]|0,e[q+(v<<2)>>2]=+Qa((b[n>>2]|0)+((ta(r,v)|0)<<2)|0,r),r=v+1|0,(r|0)<(b[k>>2]|0))v=r;else{h=0;break}f=g;return h|0;case 9:case 7:return b[d>>2]=b[a+132>>2],f=g,0;case 0:return b[a+136>>2]=b[d>>2],f=g,0;case 22:return b[a+464>>2]=b[d+4>>2],b[a+468>>2]=b[d+8>>2],b[a+460>>2]=b[d>>2],f=g,0;case 3:return b[d>>2]=b[a+12>>2],f=g,0;case 105:return b[a+500>>
2]=b[d>>2],f=g,0;case 37:return b[d>>2]=b[a+124>>2],f=g,0;case 39:return b[d>>2]=b[a+16>>2],f=g,0;case 1:return b[d>>2]=b[a+136>>2],f=g,0;case 103:return b[d>>2]=b[a+496>>2],f=g,0;case 25:return b[d>>2]=b[a+36>>2],f=g,0;case 44:return b[a+504>>2]=b[d>>2],f=g,0;case 45:return b[d>>2]=b[a+504>>2],f=g,0;case 104:return b[a+80>>2]=d,f=g,0;default:return sa(b[Oa>>2]|0,12680,(d=f,f=f+16|0,b[d>>2]=12712,b[d+8>>2]=c,d)|0)|0,f=d,f=g,-1}}function rc(b,a,c,d){b|=0;a|=0;c|=0;d|=0;var E=0,q=0,h=0,k=0,n=0,v=0,
r=0,m=0,u=0,t=0,F=0,H=0,p=t=0,z=F=0,l=0,A=0,y=z=0,w=p=0,x=0,D=k=u=0,G=0,M=0,J=0,N=l=0,O=0,ka=0,K=J=0,L=0,P=0,I=0,q=q=0,E=f;f=f+40|0;q=E|0;h=0<(c|0);do if(h){k=0;do e[a+(k<<2)>>2]=+e[b+(k<<2)>>2],k=k+1|0;while((k|0)<(c|0));if(h){k=c-1|0;for(u=0;;)if(t=+e[a+(u<<2)>>2],F=0==(u|0)?t:t-+e[a+(u-1<<2)>>2],(u|0)==(k|0)?(H=3.141592653589793-t,t=c):(p=u+1|0,H=+e[a+(p<<2)>>2]-t,t=p),e[q+(u<<2)>>2]=10/((H<F?H:F)+0.04),(t|0)<(c|0))u=t;else break;if(h){F=0;do u=a+(F<<2)|0,e[u>>2]=+e[u>>2]-(0.25*+(F|0)+0.25),F=
F+1|0;while((F|0)<(c|0));if(h){z=0;do u=a+(z<<2)|0,e[u>>2]=256*+e[u>>2],z=z+1|0;while((z|0)<(c|0));if(h)for(l=0,A=999999986991104,z=0,y=12E3;;){t=u=0;for(k=y;;)if(p=+e[a+(u<<2)>>2]-+(C[k]|0),w=t+p*p,p=u+1|0,(p|0)<(c|0))u=p,t=w,k=k+1|0;else break;u=(k=w<A)?l:z;p=l+1|0;if(64>(p|0))l=p,A=k?w:A,z=u,y=y+c|0;else{x=u;break}}else n=0,v=999999986991104,r=0,m=1326}else n=0,v=999999986991104,r=0,m=1326}else n=0,v=999999986991104,r=0,m=1326}else n=0,v=999999986991104,r=0,m=1326}else n=0,v=999999986991104,r=
0,m=1326;while(0);if(1326==(m|0))for(;;)if(z=(y=0<v)?n:r,l=n+1|0,64>(l|0))n=l,v=y?0:v,r=z;else{x=z;break}if(h){m=ta(x,c)|0;r=0;do n=a+(r<<2)|0,e[n>>2]=+e[n>>2]-+(C[12E3+(r+m)|0]|0),r=r+1|0;while((r|0)<(c|0));g(d,x,6);if(h){u=0;do r=a+(u<<2)|0,e[r>>2]=2*+e[r>>2],u=u+1|0;while((u|0)<(c|0))}}else g(d,x,6);v=+e[a>>2];A=+e[q>>2];x=a+4|0;w=+e[x>>2];F=+e[q+4>>2];u=a+8|0;H=+e[u>>2];t=+e[q+8>>2];r=a+12|0;p=+e[r>>2];k=+e[q+12>>2];m=a+16|0;D=+e[m>>2];G=+e[q+16>>2];n=0;M=999999986991104;z=0;for(y=11040;;)if(J=
v-+(C[y]|0),l=w-+(C[y+1|0]|0),N=H-+(C[y+2|0]|0),O=p-+(C[y+3|0]|0),ka=D-+(C[y+4|0]|0),J=A*J*J+0+F*l*l+t*N*N+k*O*O+G*ka*ka,K=(l=J<M)?n:z,z=n+1|0,64>(z|0))n=z,M=l?J:M,z=K,y=y+5|0;else break;y=5*K|0;e[a>>2]=v-+(C[11040+y|0]|0);e[x>>2]=w-+(C[y+11041|0]|0);e[u>>2]=H-+(C[y+11042|0]|0);e[r>>2]=p-+(C[y+11043|0]|0);e[m>>2]=D-+(C[y+11044|0]|0);g(d,K,6);D=2*+e[a>>2];e[a>>2]=D;p=2*+e[x>>2];e[x>>2]=p;H=2*+e[u>>2];e[u>>2]=H;w=2*+e[r>>2];e[r>>2]=w;v=2*+e[m>>2];e[m>>2]=v;K=0;M=999999986991104;y=0;for(z=10720;;)if(J=
D-+(C[z]|0),ka=p-+(C[z+1|0]|0),O=H-+(C[z+2|0]|0),N=w-+(C[z+3|0]|0),l=v-+(C[z+4|0]|0),J=A*J*J+0+F*ka*ka+t*O*O+k*N*N+G*l*l,L=(n=J<M)?K:y,l=K+1|0,64>(l|0))K=l,M=n?J:M,y=L,z=z+5|0;else break;z=5*L|0;e[a>>2]=D-+(C[10720+z|0]|0);e[x>>2]=p-+(C[z+10721|0]|0);e[u>>2]=H-+(C[z+10722|0]|0);e[r>>2]=w-+(C[z+10723|0]|0);e[m>>2]=v-+(C[z+10724|0]|0);g(d,L,6);L=a+20|0;v=+e[L>>2];w=+e[q+20>>2];z=a+24|0;H=+e[z>>2];p=+e[q+24>>2];m=a+28|0;D=+e[m>>2];M=+e[q+28>>2];r=a+32|0;G=+e[r>>2];k=+e[q+32>>2];u=a+36|0;t=+e[u>>2];F=
+e[q+36>>2];q=0;A=999999986991104;x=0;for(y=11680;;)if(J=v-+(C[y]|0),l=H-+(C[y+1|0]|0),N=D-+(C[y+2|0]|0),O=G-+(C[y+3|0]|0),ka=t-+(C[y+4|0]|0),J=w*J*J+0+p*l*l+M*N*N+k*O*O+F*ka*ka,P=(K=J<A)?q:x,n=q+1|0,64>(n|0))q=n,A=K?J:A,x=P,y=y+5|0;else break;y=5*P|0;e[L>>2]=v-+(C[11680+y|0]|0);e[z>>2]=H-+(C[y+11681|0]|0);e[m>>2]=D-+(C[y+11682|0]|0);e[r>>2]=G-+(C[y+11683|0]|0);e[u>>2]=t-+(C[y+11684|0]|0);g(d,P,6);t=2*+e[L>>2];e[L>>2]=t;G=2*+e[z>>2];e[z>>2]=G;D=2*+e[m>>2];e[m>>2]=D;H=2*+e[r>>2];e[r>>2]=H;v=2*+e[u>>
2];e[u>>2]=v;P=0;A=999999986991104;y=0;for(x=11360;;)if(J=t-+(C[x]|0),ka=G-+(C[x+1|0]|0),O=D-+(C[x+2|0]|0),N=H-+(C[x+3|0]|0),l=v-+(C[x+4|0]|0),J=w*J*J+0+p*ka*ka+M*O*O+k*N*N+F*l*l,I=(q=J<A)?P:y,K=P+1|0,64>(K|0))P=K,A=q?J:A,y=I,x=x+5|0;else break;x=5*I|0;e[L>>2]=t-+(C[11360+x|0]|0);e[z>>2]=G-+(C[x+11361|0]|0);e[m>>2]=D-+(C[x+11362|0]|0);e[r>>2]=H-+(C[x+11363|0]|0);e[u>>2]=v-+(C[x+11364|0]|0);g(d,I,6);if(h){q=0;do I=a+(q<<2)|0,e[I>>2]=9.7656E-4*+e[I>>2],q=q+1|0;while((q|0)<(c|0));if(h){q=0;do h=a+(q<<
2)|0,e[h>>2]=+e[b+(q<<2)>>2]-+e[h>>2],q=q+1|0;while((q|0)<(c|0))}}f=E}function sc(b,a,c){b|=0;a|=0;c|=0;var d=0,f=0,q=0,g=0,k=0,n=0,v=0,r=0,m=0;if(0<(a|0)){d=0;do e[b+(d<<2)>>2]=0.25*+(d|0)+0.25,d=d+1|0;while((d|0)<(a|0))}a=10*(h(c,6)|0)|0;e[b>>2]=+e[b>>2]+0.0039062*+(C[12E3+a|0]|0);d=b+4|0;e[d>>2]=+e[d>>2]+0.0039062*+(C[12E3+(a|1)|0]|0);f=b+8|0;e[f>>2]=+e[f>>2]+0.0039062*+(C[a+12002|0]|0);q=b+12|0;e[q>>2]=+e[q>>2]+0.0039062*+(C[a+12003|0]|0);g=b+16|0;e[g>>2]=+e[g>>2]+0.0039062*+(C[a+12004|0]|0);
k=b+20|0;e[k>>2]=+e[k>>2]+0.0039062*+(C[a+12005|0]|0);n=b+24|0;e[n>>2]=+e[n>>2]+0.0039062*+(C[a+12006|0]|0);v=b+28|0;e[v>>2]=+e[v>>2]+0.0039062*+(C[a+12007|0]|0);r=b+32|0;e[r>>2]=+e[r>>2]+0.0039062*+(C[a+12008|0]|0);m=b+36|0;e[m>>2]=+e[m>>2]+0.0039062*+(C[a+12009|0]|0);a=5*(h(c,6)|0)|0;e[b>>2]=+e[b>>2]+0.0019531*+(C[11040+a|0]|0);e[d>>2]=+e[d>>2]+0.0019531*+(C[a+11041|0]|0);e[f>>2]=+e[f>>2]+0.0019531*+(C[a+11042|0]|0);e[q>>2]=+e[q>>2]+0.0019531*+(C[a+11043|0]|0);e[g>>2]=+e[g>>2]+0.0019531*+(C[a+11044|
0]|0);a=5*(h(c,6)|0)|0;e[b>>2]=+e[b>>2]+9.7656E-4*+(C[10720+a|0]|0);e[d>>2]=+e[d>>2]+9.7656E-4*+(C[a+10721|0]|0);e[f>>2]=+e[f>>2]+9.7656E-4*+(C[a+10722|0]|0);e[q>>2]=+e[q>>2]+9.7656E-4*+(C[a+10723|0]|0);e[g>>2]=+e[g>>2]+9.7656E-4*+(C[a+10724|0]|0);a=5*(h(c,6)|0)|0;e[k>>2]=+e[k>>2]+0.0019531*+(C[11680+a|0]|0);e[n>>2]=+e[n>>2]+0.0019531*+(C[a+11681|0]|0);e[v>>2]=+e[v>>2]+0.0019531*+(C[a+11682|0]|0);e[r>>2]=+e[r>>2]+0.0019531*+(C[a+11683|0]|0);e[m>>2]=+e[m>>2]+0.0019531*+(C[a+11684|0]|0);a=5*(h(c,6)|
0)|0;e[k>>2]=+e[k>>2]+9.7656E-4*+(C[11360+a|0]|0);e[n>>2]=+e[n>>2]+9.7656E-4*+(C[a+11361|0]|0);e[v>>2]=+e[v>>2]+9.7656E-4*+(C[a+11362|0]|0);e[r>>2]=+e[r>>2]+9.7656E-4*+(C[a+11363|0]|0);e[m>>2]=+e[m>>2]+9.7656E-4*+(C[a+11364|0]|0)}function tc(b,a,c,d){b|=0;a|=0;c|=0;d|=0;var E=0,q=0,h=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,p=t=0,l=F=0,B=0,A=0,y=l=0,w=p=0,x=0,D=k=u=0,G=0,M=0,J=0,N=B=0,O=0,P=0,K=J=0,L=0,q=q=0,E=f;f=f+40|0;q=E|0;h=0<(c|0);do if(h){k=0;do e[a+(k<<2)>>2]=+e[b+(k<<2)>>2],k=k+1|0;while((k|
0)<(c|0));if(h){k=c-1|0;for(u=0;;)if(t=+e[a+(u<<2)>>2],F=0==(u|0)?t:t-+e[a+(u-1<<2)>>2],(u|0)==(k|0)?(H=3.141592653589793-t,t=c):(p=u+1|0,H=+e[a+(p<<2)>>2]-t,t=p),e[q+(u<<2)>>2]=10/((H<F?H:F)+0.04),(t|0)<(c|0))u=t;else break;if(h){F=0;do u=a+(F<<2)|0,e[u>>2]=+e[u>>2]-(0.25*+(F|0)+0.25),F=F+1|0;while((F|0)<(c|0));if(h){l=0;do u=a+(l<<2)|0,e[u>>2]=256*+e[u>>2],l=l+1|0;while((l|0)<(c|0));if(h)for(B=0,A=999999986991104,l=0,y=12E3;;){t=u=0;for(k=y;;)if(p=+e[a+(u<<2)>>2]-+(C[k]|0),w=t+p*p,p=u+1|0,(p|0)<
(c|0))u=p,t=w,k=k+1|0;else break;u=(k=w<A)?B:l;p=B+1|0;if(64>(p|0))B=p,A=k?w:A,l=u,y=y+c|0;else{x=u;break}}else n=0,v=999999986991104,r=0,m=1370}else n=0,v=999999986991104,r=0,m=1370}else n=0,v=999999986991104,r=0,m=1370}else n=0,v=999999986991104,r=0,m=1370}else n=0,v=999999986991104,r=0,m=1370;while(0);if(1370==(m|0))for(;;)if(l=(y=0<v)?n:r,B=n+1|0,64>(B|0))n=B,v=y?0:v,r=l;else{x=l;break}if(h){m=ta(x,c)|0;r=0;do n=a+(r<<2)|0,e[n>>2]=+e[n>>2]-+(C[12E3+(r+m)|0]|0),r=r+1|0;while((r|0)<(c|0));g(d,x,
6);if(h){u=0;do r=a+(u<<2)|0,e[r>>2]=2*+e[r>>2],u=u+1|0;while((u|0)<(c|0))}}else g(d,x,6);v=+e[a>>2];x=a+4|0;A=+e[x>>2];u=a+8|0;w=+e[u>>2];r=a+12|0;F=+e[r>>2];m=a+16|0;H=+e[m>>2];t=+e[q>>2];p=+e[q+4>>2];k=+e[q+8>>2];D=+e[q+12>>2];G=+e[q+16>>2];n=0;M=999999986991104;l=0;for(y=11040;;){J=v-+(C[y]|0);B=A-+(C[y+1|0]|0);N=w-+(C[y+2|0]|0);O=F-+(C[y+3|0]|0);P=H-+(C[y+4|0]|0);J=t*J*J+0+p*B*B+k*N*N+D*O*O+G*P*P;K=(B=J<M)?n:l;l=n+1|0;if(64<=(l|0))break;n=l;M=B?J:M;l=K;y=y+5|0}y=5*K|0;e[a>>2]=v-+(C[11040+y|0]|
0);e[x>>2]=A-+(C[y+11041|0]|0);e[u>>2]=w-+(C[y+11042|0]|0);e[r>>2]=F-+(C[y+11043|0]|0);e[m>>2]=H-+(C[y+11044|0]|0);g(d,K,6);K=a+20|0;H=+e[K>>2];F=+e[q+20>>2];y=a+24|0;w=+e[y>>2];A=+e[q+24>>2];m=a+28|0;v=+e[m>>2];M=+e[q+28>>2];r=a+32|0;G=+e[r>>2];D=+e[q+32>>2];u=a+36|0;k=+e[u>>2];p=+e[q+36>>2];q=0;t=999999986991104;x=0;for(l=11680;;)if(J=H-+(C[l]|0),P=w-+(C[l+1|0]|0),O=v-+(C[l+2|0]|0),N=G-+(C[l+3|0]|0),B=k-+(C[l+4|0]|0),J=F*J*J+0+A*P*P+M*O*O+D*N*N+p*B*B,L=(n=J<t)?q:x,B=q+1|0,64>(B|0))q=B,t=n?J:t,x=
L,l=l+5|0;else break;l=5*L|0;e[K>>2]=H-+(C[11680+l|0]|0);e[y>>2]=w-+(C[l+11681|0]|0);e[m>>2]=v-+(C[l+11682|0]|0);e[r>>2]=G-+(C[l+11683|0]|0);e[u>>2]=k-+(C[l+11684|0]|0);g(d,L,6);if(h){q=0;do L=a+(q<<2)|0,e[L>>2]=0.0019531*+e[L>>2],q=q+1|0;while((q|0)<(c|0));if(h){q=0;do h=a+(q<<2)|0,e[h>>2]=+e[b+(q<<2)>>2]-+e[h>>2],q=q+1|0;while((q|0)<(c|0))}}f=E}function uc(b,a,c){b|=0;a|=0;c|=0;var d=0,f=0,q=0,g=0,k=0,n=0,v=0,r=0,m=0;if(0<(a|0)){d=0;do e[b+(d<<2)>>2]=0.25*+(d|0)+0.25,d=d+1|0;while((d|0)<(a|0))}a=
10*(h(c,6)|0)|0;e[b>>2]=+e[b>>2]+0.0039062*+(C[12E3+a|0]|0);d=b+4|0;e[d>>2]=+e[d>>2]+0.0039062*+(C[12E3+(a|1)|0]|0);f=b+8|0;e[f>>2]=+e[f>>2]+0.0039062*+(C[a+12002|0]|0);q=b+12|0;e[q>>2]=+e[q>>2]+0.0039062*+(C[a+12003|0]|0);g=b+16|0;e[g>>2]=+e[g>>2]+0.0039062*+(C[a+12004|0]|0);k=b+20|0;e[k>>2]=+e[k>>2]+0.0039062*+(C[a+12005|0]|0);n=b+24|0;e[n>>2]=+e[n>>2]+0.0039062*+(C[a+12006|0]|0);v=b+28|0;e[v>>2]=+e[v>>2]+0.0039062*+(C[a+12007|0]|0);r=b+32|0;e[r>>2]=+e[r>>2]+0.0039062*+(C[a+12008|0]|0);m=b+36|0;
e[m>>2]=+e[m>>2]+0.0039062*+(C[a+12009|0]|0);a=5*(h(c,6)|0)|0;e[b>>2]=+e[b>>2]+0.0019531*+(C[11040+a|0]|0);e[d>>2]=+e[d>>2]+0.0019531*+(C[a+11041|0]|0);e[f>>2]=+e[f>>2]+0.0019531*+(C[a+11042|0]|0);e[q>>2]=+e[q>>2]+0.0019531*+(C[a+11043|0]|0);e[g>>2]=+e[g>>2]+0.0019531*+(C[a+11044|0]|0);a=5*(h(c,6)|0)|0;e[k>>2]=+e[k>>2]+0.0019531*+(C[11680+a|0]|0);e[n>>2]=+e[n>>2]+0.0019531*+(C[a+11681|0]|0);e[v>>2]=+e[v>>2]+0.0019531*+(C[a+11682|0]|0);e[r>>2]=+e[r>>2]+0.0019531*+(C[a+11683|0]|0);e[m>>2]=+e[m>>2]+
0.0019531*+(C[a+11684|0]|0)}function vc(b,a,c,d){b|=0;a|=0;c|=0;d|=0;var E=0,q=0,h=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,l=t=0,p=F=F=0,B=H=F=0,A=0,y=A=0,w=u=0,x=0,D=0,G=l=t=k=u=0,M=0,q=q=0,E=f;f=f+40|0;q=E|0;h=0<(c|0);do if(h){k=0;do e[a+(k<<2)>>2]=+e[b+(k<<2)>>2],k=k+1|0;while((k|0)<(c|0));if(h){k=c-1|0;for(u=0;;)if(t=+e[a+(u<<2)>>2],F=0==(u|0)?t:t-+e[a+(u-1<<2)>>2],(u|0)==(k|0)?(H=3.141592653589793-t,t=c):(l=u+1|0,H=+e[a+(l<<2)>>2]-t,t=l),e[q+(u<<2)>>2]=10/((H<F?H:F)+0.04),(t|0)<(c|0))u=t;else break;
if(h){F=0;do u=a+(F<<2)|0,e[u>>2]=+e[u>>2]-(0.3125*+(F|0)+0.75),F=F+1|0;while((F|0)<(c|0));if(h){F=0;do u=a+(F<<2)|0,e[u>>2]=256*+e[u>>2],F=F+1|0;while((F|0)<(c|0));if(h)for(p=0,F=999999986991104,H=0,B=3920;;){t=u=0;for(k=B;;)if(A=+e[a+(u<<2)>>2]-+(C[k]|0),A=t+A*A,l=u+1|0,(l|0)<(c|0))u=l,t=A,k=k+1|0;else break;u=(k=A<F)?p:H;l=p+1|0;if(64>(l|0))p=l,F=k?A:F,H=u,B=B+c|0;else{y=u;break}}else n=0,v=999999986991104,r=0,m=1411}else n=0,v=999999986991104,r=0,m=1411}else n=0,v=999999986991104,r=0,m=1411}else n=
0,v=999999986991104,r=0,m=1411}else n=0,v=999999986991104,r=0,m=1411;while(0);if(1411==(m|0))for(;;)if(m=0,H=(B=0<v)?n:r,p=n+1|0,64>(p|0))n=p,v=B?0:v,r=H,m=1411;else{y=H;break}do if(h){r=ta(y,c)|0;n=0;do H=a+(n<<2)|0,e[H>>2]=+e[H>>2]-+(C[3920+(n+r)|0]|0),n=n+1|0;while((n|0)<(c|0));g(d,y,6);if(h){u=0;do n=a+(u<<2)|0,e[n>>2]=2*+e[n>>2],u=u+1|0;while((u|0)<(c|0));if(h)for(u=0,k=999999986991104,t=0,l=3408;;){v=n=0;for(r=l;;)if(F=+e[a+(n<<2)>>2]-+(C[r]|0),G=v+ +e[q+(n<<2)>>2]*F*F,H=n+1|0,(H|0)<(c|0))n=
H,v=G,r=r+1|0;else break;n=(r=G<k)?u:t;H=u+1|0;if(64>(H|0))u=H,k=r?G:k,t=n,l=l+c|0;else{M=n;break}}else w=0,x=999999986991104,D=0,m=1422}else w=0,x=999999986991104,D=0,m=1422}else g(d,y,6),w=0,x=999999986991104,D=0,m=1422;while(0);if(1422==(m|0))for(;;)if(l=(y=0<x)?w:D,t=w+1|0,64>(t|0))w=t,x=y?0:x,D=l;else{M=l;break}if(h){m=ta(M,c)|0;D=0;do w=a+(D<<2)|0,e[w>>2]=+e[w>>2]-+(C[3408+(D+m)|0]|0),D=D+1|0;while((D|0)<(c|0));g(d,M,6);if(h){q=0;do M=a+(q<<2)|0,e[M>>2]=0.0019531*+e[M>>2],q=q+1|0;while((q|0)<
(c|0));if(h){q=0;do h=a+(q<<2)|0,e[h>>2]=+e[b+(q<<2)>>2]-+e[h>>2],q=q+1|0;while((q|0)<(c|0))}}}else g(d,M,6);f=E}function wc(b,a,c){b|=0;a|=0;c|=0;var d=0,f=0,q=0,g=0;if(d=0<(a|0)){f=0;do e[b+(f<<2)>>2]=0.3125*+(f|0)+0.75,f=f+1|0;while((f|0)<(a|0));f=h(c,6)|0;if(d){q=ta(f,a)|0;f=0;do g=b+(f<<2)|0,e[g>>2]=+e[g>>2]+0.0039062*+(C[3920+(f+q)|0]|0),f=f+1|0;while((f|0)<(a|0));f=h(c,6)|0;if(!d)return;q=ta(f,a)|0;f=0;do g=b+(f<<2)|0,e[g>>2]=+e[g>>2]+0.0019531*+(C[3408+(f+q)|0]|0),f=f+1|0;while((f|0)<(a|0));
return}}else h(c,6)|0;h(c,6)|0}function xc(a){a|=0;var c=0,d=0,g=0,E=0,q=0,h=0,k=0,n=0,v=0,r=0,m=0,c=f;f=f+8|0;d=c|0;g=aa(172,1)|0;if(0==(g|0))return f=c,0;b[g>>2]=a;E=b[a>>2]|0;a=yc(b[E>>2]|0)|0;q=g+4|0;b[q>>2]=a;b[g+48>>2]=0;h=E+4|0;b[g+8>>2]=b[h>>2]<<1;k=b[h>>2]|0;n=g+12|0;b[n>>2]=k;v=E+8|0;r=b[v>>2]|0;b[g+16>>2]=r;m=g+20|0;b[m>>2]=(b[h>>2]|0)/(b[v>>2]|0)|0;v=g+24|0;b[v>>2]=r+k;k=g+28|0;b[k>>2]=b[E+12>>2];b[g+148>>2]=1;b[g+152>>2]=E+32;r=b[E+64>>2]|0;b[g+156>>2]=r;b[g+160>>2]=r;b[d>>2]=9;r=d;ea(a,
4,r)|0;b[d>>2]=1;ea(b[q>>2]|0,105,r)|0;e[g+36>>2]=+e[E+24>>2];e[g+40>>2]=+e[E+16>>2];e[g+44>>2]=+e[E+20>>2];b[g+32>>2]=1;b[g+52>>2]=aa((b[v>>2]|0)-(b[n>>2]|0)<<2,1)|0;b[g+56>>2]=aa(256,1)|0;b[g+60>>2]=aa(256,1)|0;b[g+64>>2]=2432;b[g+68>>2]=3232;n=b[k>>2]|0;v=n<<2;E=aa(v,1)|0;r=g+72|0;b[r>>2]=E;b[g+76>>2]=aa(v,1)|0;b[g+80>>2]=aa(v,1)|0;d=b[m>>2]<<2;b[g+96>>2]=aa(d,1)|0;b[g+100>>2]=aa(d,1)|0;b[g+104>>2]=0;b[g+84>>2]=aa(v,1)|0;b[g+88>>2]=aa(v,1)|0;b[g+92>>2]=aa(v,1)|0;a:do if(0<(n|0))for(v=0,d=n,m=E;;){a=
v+1|0;e[m+(v<<2)>>2]=3.1415927410125732*+(a|0)/+(d+1|0);h=b[k>>2]|0;if((a|0)>=(h|0))break a;v=a;d=h;m=b[r>>2]|0}while(0);e[g+108>>2]=8;b[g+112>>2]=0;b[g+116>>2]=0;b[g+120>>2]=2E4;b[g+140>>2]=0;b[g+124>>2]=0;e[g+144>>2]=0;b[g+164>>2]=2;k=r=g+168|0;ea(b[q>>2]|0,25,r)|0;b[k>>2]<<=1;f=c;return g|0}function zc(a){a|=0;Ac(b[a+4>>2]|0);V(b[a+52>>2]|0);V(b[a+56>>2]|0);V(b[a+60>>2]|0);V(b[a+72>>2]|0);V(b[a+76>>2]|0);V(b[a+80>>2]|0);V(b[a+96>>2]|0);V(b[a+100>>2]|0);V(b[a+84>>2]|0);V(b[a+88>>2]|0);V(b[a+92>>
2]|0);V(a)}function Bc(a,c,d){a|=0;d|=0;var h=0,E=0,q=0,l=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,p=0,z=0,B=0,A=0,y=0,w=0,x=0,D=0,G=0,C=0,J=0,M=0,O=0,N=0,K=0,L=0,P=0,I=0,R=0,V=0,ca=0,Y=0,U=0,Q=z=0,T=0,da=0,aa=da=T=0,fa=0,ja=A=0,va=r=0,sa=Q=E=v=0,za=0,X=0,ba=da=0,ia=0,W=0,ha=0,Z=Q=Q=Q=ha=Q=0,ga=0,D=x=L=va=x=q=q=Q=0,h=f;f=f+24|0;E=h|0;q=h+8|0;l=h+16|0;k=c|0;c=b[a+48>>2]|0;n=b[b[a>>2]>>2]|0;v=a+12|0;r=b[v>>2]|0;m=k+(r<<2)|0;u=a+8|0;Xb(k,5776,k,m,b[u>>2]|0,64,b[a+56>>2]|0,c);t=a+112|0;0==(b[t>>2]|0)?0==
(b[a+140>>2]|0)?H=F=1:p=1458:p=1458;1458==(p|0)&&(z=+Qa(k,b[v>>2]|0),F=z+1,H=+Qa(m,b[v>>2]|0)+1);m=a+20|0;B=f;f=f+(4*(b[m>>2]|0)|0)|0;f=f+7&-8;A=a+4|0;ea(b[A>>2]|0,104,B)|0;Cc(b[A>>2]|0,k,d)|0;y=a+24|0;w=(b[y>>2]|0)-(b[v>>2]|0)|0;x=r-w|0;r=k+(x<<2)|0;G=a+52|0;C=b[G>>2]|0;Fa(r|0,C|0,w<<2)|0;J=b[G>>2]|0;G=b[v>>2]|0;D=(b[y>>2]|0)-G<<2;Fa(J|0,k+(G+x<<2)|0,D)|0;D=b[m>>2]|0;C=f;f=f+(4*D|0)|0;J=f=f+7&-8;f=f+(4*D|0)|0;f=f+7&-8;ea(b[A>>2]|0,100,C)|0;ea(b[A>>2]|0,101,J)|0;ea(b[A>>2]|0,9,E)|0;b[E>>2]=0==(b[E>>
2]|0);D=a+28|0;G=b[D>>2]|0;w=f;f=f+(4*G|0)|0;M=f=f+7&-8;f=f+(4*G|0)|0;O=f=f+7&-8;f=f+(4*G|0)|0;N=f=f+7&-8;f=f+(4*G|0)|0;K=f=f+7&-8;f=f+(4*G|0)|0;L=f=f+7&-8;f=f+(4*G|0)|0;P=f=f+7&-8;f=f+(4*G|0)|0;I=f=f+7&-8;f=f+(4*G|0)|0;f=f+7&-8;R=Xa()|0;V=f;f=f+(4*(G+1|0)|0)|0;f=f+7&-8;G=b[y>>2]|0;y=f;f=f+(4*G|0)|0;f=f+7&-8;ca=a+16|0;Y=0<(G|0);if(80==(b[ca>>2]|0)){if(Y){U=b[a+64>>2]|0;z=0;do e[y+(z<<2)>>2]=+e[k+(z+x<<2)>>2]*+e[U+(z>>1<<2)>>2],z=z+1|0;while((z|0)<(G|0))}}else if(Y){z=b[a+64>>2]|0;U=0;do e[y+(U<<2)>>
2]=+e[k+(U+x<<2)>>2]*+e[z+(U<<2)>>2],U=U+1|0;while((U|0)<(G|0))}Nb(y,V,(b[D>>2]|0)+1|0,G);z=+e[V>>2];Q=z+z*+e[a+36>>2];e[V>>2]=Q;G=b[D>>2]|0;y=G+1|0;a:do if(0<(y|0))for(Y=b[a+68>>2]|0,U=0,z=Q;;){e[V+(U<<2)>>2]=z*+e[Y+(U<<2)>>2];z=U+1|0;if((z|0)>=(y|0))break a;U=z;z=+e[V+(z<<2)>>2]}while(0);+Mb(w,V,G);Ya(R|0);R=Db(w,b[D>>2]|0,K,10,0.20000000298023224,c)|0;G=b[D>>2]|0;if((R|0)!=(G|0)&&(V=Db(w,G,K,10,0.05000000074505806,c)|0,y=b[D>>2]|0,(V|0)!=(y|0)&0<(y|0))){V=b[a+72>>2]|0;U=0;do e[K+(U<<2)>>2]=+e[V+
(U<<2)>>2],U=U+1|0;while((U|0)<(y|0))}0==(b[t>>2]|0)?0!=(b[a+140>>2]|0)&&(p=1476):p=1476;do if(1476==(p|0)&&0==(b[E>>2]|0))if(G=a+124|0,0!=(b[G>>2]|0)&&(Q=+e[a+128>>2],0<+e[a+132>>2]*Q?(z=-1E-5*Q/(+e[a+136>>2]+1),T=0.1<z?0.10000000149011612:z,da=-0.1<=T?T:-0.10000000149011612):da=0,w=a+108|0,Q=da+ +e[w>>2],T=10<Q?10:Q,e[w>>2]=T,0<=T||(e[w>>2]=0)),T=2*+ab(H/F),w=b[A>>2]|0,y=R=a+144|0,ea(w,29,R)|0,Q=-4>T?-4:T,0==(b[t>>2]|0))T=2>+e[y>>2]?1:b[a+160>>2]|0,b[a+156>>2]=T;else{R=(b[n+160>>2]|0)-1|0;b[q>>
2]=R;T=(2<Q?2:Q)+2+ +e[y>>2];Q=-1>T?-1:T;e[y>>2]=Q;y=a+168|0;a:do if(0!=(R|0)){w=n+156|0;U=a+152|0;V=a+120|0;T=+e[a+108>>2];Y=R;do{z=~~+ib(T);10==(z|0)?da=+e[(b[w>>2]|0)+(44*Y|0)+40>>2]:(aa=z+1|0,fa=b[w>>2]|0,da=(T-+(z|0))*+e[fa+(44*Y|0)+(aa<<2)>>2]+(+(aa|0)-T)*+e[fa+(44*Y|0)+(z<<2)>>2]);if(Q>=da&&(z=ta(b[(b[(b[U>>2]|0)+(Y<<2)>>2]|0)+52>>2]|0,b[y>>2]|0)|0,((z|0)/(b[u>>2]|0)|0)<=(b[V>>2]|0)))break a;Y=Y-1|0;b[q>>2]=Y}while(0!=(Y|0))}while(0);y=q;ea(a,10,y)|0;0!=(b[G>>2]|0)&&(y=l,ea(a,19,y)|0,y=(b[l>>
2]|0)-(b[G>>2]|0)|0,R=a+128|0,e[R>>2]=+e[R>>2]+ +(y|0),R=a+132|0,e[R>>2]=0.95*+e[R>>2]+0.05*+(y|0),y=a+136|0,e[y>>2]=+e[y>>2]+1)}while(0);0!=(b[a+148>>2]|0)&&(g(d,1,1),0==(b[E>>2]|0)?g(d,b[a+156>>2]|0,3):g(d,0,3));do if(0==(b[E>>2]|0)&&(l=a+156|0,q=a+152|0,u=b[(b[q>>2]|0)+(b[l>>2]<<2)>>2]|0,0!=(u|0))){Pb[b[u+16>>2]&7](K,L,b[D>>2]|0,d);u=a+32|0;n=b[D>>2]|0;do if(0!=(b[u>>2]|0)&0<(n|0)){T=a+72|0;t=0;do e[(b[T>>2]|0)+(t<<2)>>2]=+e[K+(t<<2)>>2],t=t+1|0,A=b[D>>2]|0;while((t|0)<(A|0));if(0>=(A|0))ja=A;
else for(t=a+76|0,T=0;;)if(e[(b[t>>2]|0)+(T<<2)>>2]=+e[L+(T<<2)>>2],A=T+1|0,p=b[D>>2]|0,(A|0)<(p|0))T=A;else{ja=p;break}}else ja=n;while(0);n=f;f=f+(4*ja|0)|0;f=f+7&-8;G=b[ca>>2]|0;T=f;f=f+(4*G|0)|0;t=f=f+7&-8;f=f+(4*G|0)|0;f=f+7&-8;p=t;A=f;f=f+(4*G|0)|0;f=f+7&-8;if(0<(b[m>>2]|0)){y=a+72|0;R=a+76|0;Y=a+80|0;V=a+40|0;U=a+44|0;w=a+96|0;z=a+88|0;fa=a+104|0;aa=a+100|0;r=a+164|0;va=a+92|0;v=a+84|0;E=0;for(Q=G;;){G=k+((ta(Q,E)|0)+x<<2)|0;sa=Xa()|0;za=f;f=f+(4*Q|0)|0;f=f+7&-8;X=za;da=b[ca>>2]|0;ba=f;f=f+
(4*da|0)|0;ia=f=f+7&-8;f=f+(4*da|0)|0;f=f+7&-8;hb(b[y>>2]|0,K,P,b[D>>2]|0,E,b[m>>2]|0);hb(b[R>>2]|0,L,I,b[D>>2]|0,E,b[m>>2]|0);gb(P,b[D>>2]|0,0.05000000074505806);gb(I,b[D>>2]|0,0.05000000074505806);fb(P,M,b[D>>2]|0,c);fb(I,b[Y>>2]|0,b[D>>2]|0,c);pa(+e[V>>2],M,O,b[D>>2]|0);pa(+e[U>>2],M,N,b[D>>2]|0);e[(b[w>>2]|0)+(E<<2)>>2]=1;da=b[D>>2]|0;if(0<(da|0)){da=1;W=0;do ha=b[Y>>2]|0,F=+e[ha+((W|1)<<2)>>2],H=+e[ha+(W<<2)>>2],da+=F-H,ha=(b[w>>2]|0)+(E<<2)|0,e[ha>>2]=F+H+ +e[ha>>2],W=W+2|0,Q=b[D>>2]|0;while((W|
0)<(Q|0));ha=da+0.01}else ha=1.01,Q=da;H=(+e[C+(E<<2)>>2]+0.01)/ha;Bb(G,b[Y>>2]|0,za,b[ca>>2]|0,Q,b[z>>2]|0,c);F=+Qa(za,b[ca>>2]|0);if(0==(b[(b[(b[q>>2]|0)+(b[l>>2]<<2)>>2]|0)+36>>2]|0))W=ob(H*F/(+e[B+(E<<2)>>2]+1),6736,32)|0,ha=0>(W|0)?0:W,g(d,31<(ha|0)?31:ha,5),ha=b[fa>>2]|0,0!=(ha|0)&&(e[ha+(E<<2)>>2]=F),e[(b[aa>>2]|0)+(E<<2)>>2]=F;else{da=+e[J+(E<<2)>>2]+1;Q=H*(F+1)/da;Q=80==(b[ca>>2]|0)?0.7071099877357483*Q:Q;ha=ob(Q,6032,16)|0;g(d,ha,4);Q=0.8736*+e[6032+(ha<<2)>>2];ha=b[ca>>2]|0;Q=80==(ha|0)?
1.414199948310852*Q:Q;Q=Q/H*da;Jb(b[Y>>2]|0,O,N,T,ha,b[D>>2]|0,c);ha=b[ca>>2]|0;if(0<(ha|0)){W=0;do e[ba+(W<<2)>>2]=1.0000000036274937E-15,W=W+1|0;while((W|0)<(ha|0))}W=b[D>>2]|0;if(0<(W|0)){da=b[v>>2]|0;Z=0;do e[n+(Z<<2)>>2]=+e[da+(Z<<2)>>2],Z=Z+1|0;while((Z|0)<(W|0))}Za(ba,b[Y>>2]|0,ba,ha,W,n,c);Z=b[D>>2]|0;if(0<(Z|0)){da=b[va>>2]|0;ga=0;do e[n+(ga<<2)>>2]=+e[da+(ga<<2)>>2],ga=ga+1|0;while((ga|0)<(Z|0))}$a(ba,O,N,ba,b[ca>>2]|0,Z,n,c);ga=b[D>>2]|0;if(0<(ga|0)){da=b[va>>2]|0;W=0;do e[n+(W<<2)>>2]=
+e[da+(W<<2)>>2],W=W+1|0;while((W|0)<(ga|0))}$a(G,O,N,ia,b[ca>>2]|0,ga,n,c);W=b[ca>>2]|0;if(0<(W|0)){da=0;do e[A+(da<<2)>>2]=+e[ia+(da<<2)>>2]-+e[ba+(da<<2)>>2],da=da+1|0;while((da|0)<(W|0))}La(A,A,Q,W);da=b[ca>>2]|0;wa(p|0,0,da<<2|0);ba=b[(b[q>>2]|0)+(b[l>>2]<<2)>>2]|0;wb[b[ba+36>>2]&7](A,b[Y>>2]|0,O,N,b[ba+44>>2]|0,b[D>>2]|0,da,t,T,d,c,b[r>>2]|0,b[ba+12>>2]|0);ra(t,t,Q,b[ca>>2]|0);if(0!=(b[(b[(b[q>>2]|0)+(b[l>>2]<<2)>>2]|0)+12>>2]|0)){ba=b[ca>>2]|0;da=Xa()|0;ga=f;f=f+(4*ba|0)|0;f=f+7&-8;ba=b[ca>>
2]|0;wa(ga|0,0,ba<<2|0);if(0<(ba|0)){Z=0;do ha=A+(Z<<2)|0,e[ha>>2]=2.5*+e[ha>>2],Z=Z+1|0;while((Z|0)<(ba|0))}Z=b[(b[q>>2]|0)+(b[l>>2]<<2)>>2]|0;wb[b[Z+36>>2]&7](A,b[Y>>2]|0,O,N,b[Z+44>>2]|0,b[D>>2]|0,ba,ga,T,d,c,b[r>>2]|0,0);ra(ga,ga,0.4000000059604645*Q,b[ca>>2]|0);Z=b[ca>>2]|0;if(0<(Z|0)){W=0;do ha=t+(W<<2)|0,e[ha>>2]=+e[ha>>2]+ +e[ga+(W<<2)>>2],W=W+1|0;while((W|0)<(Z|0))}Ya(da|0)}Z=b[ca>>2]|0;0<(Z|0)&&(W=1<(Z|0)?Z<<2:4,Fa(X|0,p|0,W)|0);0==(b[fa>>2]|0)?Q=Z:(Q=0.7071099877357483*+$(t,Z),e[(b[fa>>
2]|0)+(E<<2)>>2]=Q,Q=b[ca>>2]|0);Q=+Qa(za,Q);e[(b[aa>>2]|0)+(E<<2)>>2]=Q}Z=b[D>>2]|0;W=b[v>>2]|0;if(0<(Z|0)){ga=0;do e[n+(ga<<2)>>2]=+e[W+(ga<<2)>>2],ga=ga+1|0;while((ga|0)<(Z|0))}Za(za,b[Y>>2]|0,G,b[ca>>2]|0,Z,W,c);$a(G,O,N,ia,b[ca>>2]|0,b[D>>2]|0,b[va>>2]|0,c);Ya(sa|0);ga=E+1|0;if((ga|0)>=(b[m>>2]|0))break;E=ga;Q=b[ca>>2]|0}q=b[D>>2]|0}else q=ja;if(0<(q|0)){Q=a+72|0;E=0;do e[(b[Q>>2]|0)+(E<<2)>>2]=+e[K+(E<<2)>>2],E=E+1|0,q=b[D>>2]|0;while((E|0)<(q|0));if(!(0>=(q|0))){E=a+76|0;Q=0;do e[(b[E>>2]|
0)+(Q<<2)>>2]=+e[L+(Q<<2)>>2],Q=Q+1|0;while((Q|0)<(b[D>>2]|0))}}b[u>>2]=0;x=1;f=h;return x|0}while(0);L=b[v>>2]|0;if(0<(L|0))for(q=0;;)if(e[k+(q+x<<2)>>2]=1.0000000036274937E-15,K=q+1|0,q=b[v>>2]|0,(K|0)<(q|0))q=K;else{va=q;break}else va=L;L=b[D>>2]|0;if(0<(L|0)){q=a+92|0;x=0;do e[(b[q>>2]|0)+(x<<2)>>2]=0,x=x+1|0,L=b[D>>2]|0;while((x|0)<(L|0));x=b[v>>2]|0}else x=va;D=L;b[a+32>>2]=1;Za(r,b[a+80>>2]|0,r,x,D,b[a+84>>2]|0,c);x=0==(b[E>>2]|0)|0;f=h;return x|0}function Dc(a){a|=0;var c=0,d=0,e=0,g=0,q=
0,h=0,k=0,n=0,v=0,r=0,c=f;f=f+8|0;d=c|0;e=aa(100,1)|0;if(0==(e|0))return f=c,0;b[e>>2]=a;g=b[a>>2]|0;b[e+88>>2]=1;a=Ec(b[g>>2]|0)|0;q=e+4|0;b[q>>2]=a;b[e+40>>2]=0;h=g+4|0;b[e+8>>2]=b[h>>2]<<1;b[e+12>>2]=b[h>>2];k=g+8|0;n=e+16|0;b[n>>2]=b[k>>2];v=e+20|0;b[v>>2]=(b[h>>2]|0)/(b[k>>2]|0)|0;k=e+24|0;b[k>>2]=b[g+12>>2];r=h=e+32|0;Ea(a,25,h)|0;b[r>>2]<<=1;b[d>>2]=1;Ea(b[q>>2]|0,105,d)|0;b[e+92>>2]=g+32;b[e+96>>2]=b[g+64>>2];b[e+28>>2]=1;b[e+44>>2]=aa(256,1)|0;b[e+48>>2]=aa(256,1)|0;b[e+52>>2]=aa(b[n>>2]<<
2,1)|0;n=b[k>>2]|0;k=n<<2;b[e+56>>2]=aa(k,1)|0;b[e+60>>2]=aa(k,1)|0;k=b[v>>2]<<2;b[e+68>>2]=aa(k,1)|0;b[e+72>>2]=aa(k,1)|0;b[e+64>>2]=aa(n<<3,1)|0;b[e+76>>2]=0;b[e+36>>2]=0;b[e+84>>2]=1E3;f=c;return e|0}function Fc(a){a|=0;Gc(b[a+4>>2]|0);V(b[a+44>>2]|0);V(b[a+48>>2]|0);V(b[a+52>>2]|0);V(b[a+56>>2]|0);V(b[a+60>>2]|0);V(b[a+68>>2]|0);V(b[a+72>>2]|0);V(b[a+64>>2]|0);V(a)}function Hc(a,c,d){a|=0;c|=0;var g=0,E=0,q=0,p=0,k=0,n=0,v=0,r=0,m=0,u=E=0,t=0,F=0,H=0,w=0,z=0,B=0,A=0,y=0,C=0,M=0,D=0,G=0,N=0,J=
0,P=0,O=0,R=0,K=0,L=0,I=0,V=0,$=0,aa=0,ca=0,Y=0,U=0,Q=0,T=0,da=Q=U=I=L=U=Y=0,ea=0,fa=V=0,g=f;f=f+8|0;E=g|0;q=d|0;d=a;p=b[a+40>>2]|0;k=b[b[a>>2]>>2]|0;n=a+12|0;v=b[n>>2]|0;r=a+4|0;Ea(b[r>>2]|0,104,q+(v<<2)|0)|0;m=Ic(b[r>>2]|0,c,q)|0;Ea(b[r>>2]|0,103,E)|0;if(0!=(m|0))return f=g,m|0;if(0==(c|0))return Rb(d,q,b[E>>2]|0,p),f=g,0;a:do if(0==(b[a+88>>2]|0))u=b[a+96>>2]|0;else{do if(0<(x(c)|0)&&0!=(l(c)|0)){h(c,1)|0;m=h(c,3)|0;b[a+96>>2]=m;if(0==(m|0)){u=0;break a}if(0!=(b[(b[a+92>>2]|0)+(m<<2)>>2]|0)){u=
m;break a}m=b[Oa>>2]|0;sa(m|0,13352,(m=f,f=f+8|0,b[m>>2]=12984,m)|0)|0;f=m;E=-2;f=g;return E|0}while(0);u=b[a+96>>2]=0}while(0);m=a+96|0;t=a+92|0;if(0==(b[(b[t>>2]|0)+(u<<2)>>2]|0)){if(0!=(b[E>>2]|0))return Rb(d,q,1,p),f=g,0;d=b[n>>2]|0;if(0<(d|0))for(E=0,u=d;;)if(e[q+(u+E<<2)>>2]=1.0000000036274937E-15,F=E+1|0,H=b[n>>2]|0,(F|0)<(H|0))E=F,u=H;else{w=H;break}else w=d;b[a+28>>2]=1;d=q+(w<<2)|0;Za(d,b[a+60>>2]|0,d,w,b[a+24>>2]|0,b[a+64>>2]|0,p);Cb(q,q+(b[n>>2]<<2)|0,5776,q,b[a+8>>2]|0,64,b[a+44>>2]|
0,b[a+48>>2]|0,p);f=g;return 0}w=a+20|0;d=b[w>>2]|0;u=Xa()|0;E=f;f=f+(4*d|0)|0;d=f=f+7&-8;f=f+(4*(b[w>>2]|0)|0)|0;f=f+7&-8;Ea(b[r>>2]|0,100,E)|0;Ea(b[r>>2]|0,101,d)|0;r=a+24|0;H=b[r>>2]|0;F=f;f=f+(4*H|0)|0;z=f=f+7&-8;f=f+(4*H|0)|0;f=f+7&-8;Qb[b[(b[(b[t>>2]|0)+(b[m>>2]<<2)>>2]|0)+20>>2]&7](F,H,c);H=a+28|0;B=b[r>>2]|0;if(0!=(b[H>>2]|0)&0<(B|0))for(A=a+56|0,y=0;;)if(e[(b[A>>2]|0)+(y<<2)>>2]=+e[F+(y<<2)>>2],C=y+1|0,M=b[r>>2]|0,(C|0)<(M|0))y=C;else{D=M;break}else D=B;B=f;f=f+(4*D|0)|0;f=f+7&-8;if(0<(b[w>>
2]|0))for(D=a+16|0,y=a+76|0,A=a+56|0,M=a+68|0,C=k+28|0,k=v+1|0,G=a+52|0,N=a+60|0,J=a+64|0,P=a+72|0,O=a+84|0,K=R=0;;){L=b[D>>2]|0;I=ta(L,K)|0;V=q+((b[n>>2]|0)+I<<2)|0;$=Xa()|0;aa=f;f=f+(4*L|0)|0;f=f+7&-8;L=b[y>>2]|0;0==(L|0)?ca=0:(Y=L+(I<<1<<2)|0,wa(Y|0,0,b[D>>2]<<3|0),ca=Y);hb(b[A>>2]|0,F,z,b[r>>2]|0,K,b[w>>2]|0);gb(z,b[r>>2]|0,0.05000000074505806);fb(z,B,b[r>>2]|0,p);e[(b[M>>2]|0)+(K<<2)>>2]=1;if(0<(b[r>>2]|0)){U=1;Y=0;do Q=+e[B+((Y|1)<<2)>>2],T=+e[B+(Y<<2)>>2],U+=Q-T,L=(b[M>>2]|0)+(K<<2)|0,e[L>>
2]=Q+T+ +e[L>>2],Y=Y+2|0;while((Y|0)<(b[r>>2]|0));Y=U+0.01}else Y=1.01;T=(+e[E+(K<<2)>>2]+0.01)/Y;wa(aa|0,0,b[D>>2]<<2|0);if(0==(b[(b[(b[t>>2]|0)+(b[m>>2]<<2)>>2]|0)+40>>2]|0)){if(Q=+vb(0.125*+((h(c,5)|0)-10|0))/T,Y=b[D>>2]|0,0<(Y|0)){U=0;do L=U+I|0,e[aa+(U<<2)>>2]=Q*+e[C>>2]*+e[q+(L+v<<2)>>2],e[aa+((U|1)<<2)>>2]=-0-Q*+e[C>>2]*+e[q+(k+L<<2)>>2],U=U+2|0;while((U|0)<(Y|0))}}else if(Y=h(c,4)|0,Q=0.8736*+e[6032+(Y<<2)>>2],Y=b[D>>2]|0,L=80==(Y|0)?1.414199948310852*Q:Q,Q=+e[d+(K<<2)>>2]*L/T,L=b[(b[t>>2]|
0)+(b[m>>2]<<2)>>2]|0,xb[b[L+40>>2]&7](aa,b[L+44>>2]|0,Y,c,p,O),ra(aa,aa,Q,b[D>>2]|0),0!=(b[(b[(b[t>>2]|0)+(b[m>>2]<<2)>>2]|0)+12>>2]|0)){Y=b[D>>2]|0;L=Xa()|0;I=f;f=f+(4*Y|0)|0;f=f+7&-8;Y=b[D>>2]|0;wa(I|0,0,Y<<2|0);U=b[(b[t>>2]|0)+(b[m>>2]<<2)>>2]|0;xb[b[U+40>>2]&7](I,b[U+44>>2]|0,Y,c,p,O);ra(I,I,0.4000000059604645*Q,b[D>>2]|0);Y=b[D>>2]|0;if(0<(Y|0)){U=0;do Q=aa+(U<<2)|0,e[Q>>2]=+e[Q>>2]+ +e[I+(U<<2)>>2],U=U+1|0;while((U|0)<(Y|0))}Ya(L|0)}I=b[D>>2]|0;if(0!=(b[y>>2]|0)&0<(I|0))for(Y=0;;)if(e[ca+(Y<<
1<<2)>>2]=+e[aa+(Y<<2)>>2],U=Y+1|0,I=b[D>>2]|0,(U|0)<(I|0))Y=U;else{da=I;break}else da=I;Za(b[G>>2]|0,b[N>>2]|0,V,da,b[r>>2]|0,b[J>>2]|0,p);Y=b[D>>2]|0;if(0<(Y|0))for(I=0;;)if(e[(b[G>>2]|0)+(I<<2)>>2]=+e[aa+(I<<2)>>2],U=I+1|0,Q=b[D>>2]|0,(U|0)<(Q|0))I=U;else{ea=Q;break}else ea=Y;if(0<(b[r>>2]|0)){I=0;do e[(b[N>>2]|0)+(I<<2)>>2]=+e[B+(I<<2)>>2],I=I+1|0;while((I|0)<(b[r>>2]|0));V=b[D>>2]|0}else V=ea;T=+Qa(b[G>>2]|0,V);e[(b[P>>2]|0)+(K<<2)>>2]=T;T=+e[(b[P>>2]|0)+(K<<2)>>2];U=R+T*T/+(b[w>>2]|0);Ya($|
0);I=K+1|0;if((I|0)<(b[w>>2]|0))R=U,K=I;else{fa=U;break}}else fa=0;e[a+80>>2]=+Wa(fa);Cb(q,q+(b[n>>2]<<2)|0,5776,q,b[a+8>>2]|0,64,b[a+44>>2]|0,b[a+48>>2]|0,p);if(0<(b[r>>2]|0)){p=a+56|0;a=0;do e[(b[p>>2]|0)+(a<<2)>>2]=+e[F+(a<<2)>>2],a=a+1|0;while((a|0)<(b[r>>2]|0))}b[H>>2]=0;Ya(u|0);f=g;return 0}function Rb(a,c,d,f){a|=0;c|=0;f|=0;var g=0,q=0,h=0,k=0,n=0,v=0,r=0,m=0,u=0,t=r=0;(g=0!=(d|0))?(d=a+96|0,q=b[d>>2]|0,b[d>>2]=1,b[a+28>>2]=1,h=q):(q=b[a+60>>2]|0,pa(0.9900000095367432,q,q,b[a+24>>2]|0),b[a+
28>>2]=1,q=a+80|0,e[q>>2]=0.8999999761581421*+e[q>>2],h=0);q=a+12|0;d=b[q>>2]|0;if(0<(d|0))for(k=a+80|0,n=a+84|0,v=0,r=d;;)if(m=+e[k>>2],u=(ta(b[n>>2]|0,1664525)|0)+1013904223|0,b[n>>2]=u,e[c+(r+v<<2)>>2]=3.4642*m*((b[db>>2]=u&8388607|1065353216,+e[db>>2])+-1.5),u=v+1|0,r=b[q>>2]|0,(u|0)<(r|0))v=u;else{t=r;break}else t=d;d=c+(t<<2)|0;Za(d,b[a+60>>2]|0,d,t,b[a+24>>2]|0,b[a+64>>2]|0,f);Cb(c,c+(b[q>>2]<<2)|0,5776,c,b[a+8>>2]|0,64,b[a+44>>2]|0,b[a+48>>2]|0,f);g&&(b[a+96>>2]=h)}function Jc(a,c,d){a|=0;
c|=0;d|=0;var g=0,h=0,q=0,l=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,H=0,p=0,z=n=h=t=n=0,q=h=p=H=z=0,g=f;f=f+80|0;h=g|0;q=g+8|0;l=g+16|0;k=g+24|0;n=g+32|0;v=g+40|0;r=g+48|0;m=g+56|0;u=g+64|0;t=g+72|0;switch(c|0){case 8:ea(b[a+4>>2]|0,8,d)|0;f=g;break;case 35:ea(b[a+4>>2]|0,35,d)|0;f=g;break;case 106:b[d>>2]=b[a+48>>2];f=g;break;case 3:b[d>>2]=b[a+8>>2];f=g;break;case 34:ea(b[a+4>>2]|0,34,d)|0;f=g;break;case 9:ea(b[a+4>>2]|0,9,d)|0;f=g;break;case 101:H=a+20|0;if(0>=(b[H>>2]|0)){f=g;break}p=a+100|0;n=d;for(t=
0;;)if(e[n+(t<<2)>>2]=+e[(b[p>>2]|0)+(t<<2)>>2],h=t+1|0,(h|0)<(b[H>>2]|0))t=h;else{F=0;break}f=g;return F|0;case 10:t=b[d>>2]|0;b[a+156>>2]=t;b[a+160>>2]=t;f=g;break;case 6:ea(a,4,d)|0;f=g;break;case 104:b[a+104>>2]=d;f=g;break;case 12:b[a+112>>2]=b[d>>2];ea(b[a+4>>2]|0,12,d)|0;f=g;break;case 13:b[d>>2]=b[a+112>>2];f=g;break;case 30:b[a+140>>2]=b[d>>2];ea(b[a+4>>2]|0,30,d)|0;f=g;break;case 31:b[d>>2]=b[a+140>>2];f=g;break;case 14:t=d;n=+e[t>>2];z=n+0.6;e[q>>2]=z;e[a+108>>2]=n;10<z&&(e[q>>2]=10);H=
~~+ib(+e[t>>2]+0.5);b[h>>2]=10<(H|0)?10:H;ea(b[a+4>>2]|0,14,q)|0;ea(a,4,h)|0;f=g;break;case 15:e[d>>2]=+e[a+108>>2];f=g;break;case 32:h=d;q=b[h>>2]|0;b[a+124>>2]=q;t=H=a+112|0;b[t>>2]=0!=(q|0);ea(b[a+4>>2]|0,12,H)|0;if(0==(b[t>>2]|0)){f=g;break}b[l>>2]=10;t=b[h>>2]|0;h=l;for(H=k;;){ea(a,4,h)|0;ea(a,19,H)|0;q=b[l>>2]|0;if((b[k>>2]|0)<=(t|0)){z=q;break}p=q-1|0;b[l>>2]=p;if(0>=(q|0)){z=p;break}}z=+(z|0);e[n>>2]=0>z?0:z;ea(a,14,n)|0;e[a+136>>2]=0;e[a+128>>2]=0;e[a+132>>2]=0;f=g;break;case 33:b[d>>2]=
b[a+124>>2];f=g;break;case 4:n=b[d>>2]|0;z=0>(n|0)?0:n;n=10<(z|0)?10:z;z=b[a>>2]|0;l=b[(b[z>>2]|0)+112+(n<<2)>>2]|0;b[a+156>>2]=l;b[a+160>>2]=l;b[v>>2]=b[(b[z>>2]|0)+68+(n<<2)>>2];ea(b[a+4>>2]|0,6,v)|0;f=g;break;case 16:ea(b[a+4>>2]|0,16,d)|0;v=b[d>>2]|0;n=a+164|0;b[n>>2]=v;if(1<=(v|0)){f=g;break}b[n>>2]=1;f=g;break;case 17:b[d>>2]=b[a+164>>2];f=g;break;case 18:b[r>>2]=10;n=b[d>>2]|0;v=r;for(z=m;;){ea(a,4,v)|0;ea(a,19,z)|0;if((b[m>>2]|0)<=(n|0)){F=0;H=1735;break}l=b[r>>2]|0;b[r>>2]=l-1;if(0>=(l|0)){F=
0;H=1736;break}}if(1735==(H|0)||1736==(H|0))return f=g,F|0;break;case 19:ea(b[a+4>>2]|0,19,d)|0;H=b[(b[a+152>>2]|0)+(b[a+156>>2]<<2)>>2]|0;r=b[a+168>>2]|0;0==(H|0)?(n=d,b[n>>2]=(b[n>>2]|0)+((r<<2|0)/(b[a+8>>2]|0)|0)):(n=ta(b[H+52>>2]|0,r)|0,r=d,b[r>>2]=(b[r>>2]|0)+((n|0)/(b[a+8>>2]|0)|0));f=g;break;case 24:n=b[d>>2]|0;b[a+168>>2]=n;b[u>>2]=n>>1;ea(b[a+4>>2]|0,24,u)|0;f=g;break;case 25:b[d>>2]=b[a+168>>2];f=g;break;case 26:b[a+32>>2]=1;u=a+28|0;n=b[u>>2]|0;do if(0<(n|0)){r=a+72|0;H=0;for(m=n;;)if(z=
H+1|0,e[(b[r>>2]|0)+(H<<2)>>2]=3.1415927410125732*+(z|0)/+(m+1|0),p=b[u>>2]|0,(z|0)<(p|0))H=z,m=p;else break;if(!(0>=(p|0))){m=a+88|0;H=a+84|0;r=a+92|0;z=0;do e[(b[m>>2]|0)+(z<<2)>>2]=0,e[(b[H>>2]|0)+(z<<2)>>2]=0,e[(b[r>>2]|0)+(z<<2)>>2]=0,z=z+1|0;while((z|0)<(b[u>>2]|0))}}while(0);u=a+60|0;p=a+56|0;for(n=0;;)if(e[(b[u>>2]|0)+(n<<2)>>2]=0,e[(b[p>>2]|0)+(n<<2)>>2]=0,z=n+1|0,64>(z|0))n=z;else{F=0;break}f=g;return F|0;case 36:b[a+148>>2]=b[d>>2];ea(b[a+4>>2]|0,36,d)|0;f=g;break;case 37:b[d>>2]=b[a+148>>
2];f=g;break;case 39:ea(b[a+4>>2]|0,39,d)|0;n=d;b[n>>2]=(b[n>>2]<<1)+63;f=g;break;case 40:ea(b[a+4>>2]|0,40,d)|0;f=g;break;case 41:ea(b[a+4>>2]|0,41,d)|0;f=g;break;case 42:n=b[d>>2]|0;b[a+116>>2]=n;42199<(n|0)?h=b[a+120>>2]=17600:27799<(n|0)?h=b[a+120>>2]=9600:(p=a+120|0,h=20600<(n|0)?b[p>>2]=5600:b[p>>2]=1800);q=80==(b[a+16>>2]|0)?b[a+120>>2]=1800:h;b[t>>2]=n-q;ea(b[a+4>>2]|0,42,t)|0;f=g;break;case 43:b[d>>2]=b[a+116>>2];f=g;break;case 44:ea(b[a+4>>2]|0,44,d)|0;f=g;break;case 45:ea(b[a+4>>2]|0,45,
d)|0;f=g;break;case 100:t=d;q=a+20|0;if(0>=(b[q>>2]|0)){f=g;break}n=a+96|0;for(h=0;;)if(e[t+(h<<2)>>2]=+e[(b[n>>2]|0)+(h<<2)>>2],p=h+1|0,(p|0)<(b[q>>2]|0))h=p;else{F=0;break}f=g;return F|0;case 29:e[d>>2]=+e[a+144>>2];f=g;break;case 105:ea(b[a+4>>2]|0,105,d)|0;f=g;break;default:return sa(b[Oa>>2]|0,13552,(d=f,f=f+16|0,b[d>>2]=13768,b[d+8>>2]=c,d)|0)|0,f=d,f=g,-1}return 0}function Kc(a,c,d){a|=0;c|=0;d|=0;var g=0,h=0,q=0,p=0,k=q=0,n=h=0,n=0,g=f;f=f+16|0;h=g|0;q=g+8|0;switch(c|0){case 0:return Ea(b[a+
4>>2]|0,0,d)|0,b[a+36>>2]=b[d>>2],f=g,0;case 8:return Ea(b[a+4>>2]|0,8,d)|0,f=g,0;case 26:q=a+24|0;if(0<(b[q>>2]<<1|0)){k=a+64|0;h=0;do e[(b[k>>2]|0)+(h<<2)>>2]=0,h=h+1|0;while((h|0)<(b[q>>2]<<1|0))}q=a+48|0;h=a+44|0;k=0;do e[(b[q>>2]|0)+(k<<2)>>2]=0,e[(b[h>>2]|0)+(k<<2)>>2]=0,k=k+1|0;while(64>(k|0));e[a+80>>2]=0;f=g;return 0;case 101:k=a+20|0;if(0>=(b[k>>2]|0))return f=g,0;h=a+72|0;q=d;for(n=0;;)if(e[q+(n<<2)>>2]=+e[(b[h>>2]|0)+(n<<2)>>2],n=n+1|0,!((n|0)<(b[k>>2]|0))){p=0;break}f=g;return p|0;case 3:return b[d>>
2]=b[a+8>>2],f=g,0;case 10:return b[a+96>>2]=b[d>>2],f=g,0;case 9:return Ea(b[a+4>>2]|0,9,d)|0,f=g,0;case 1:return b[d>>2]=b[a+36>>2],f=g,0;case 6:case 4:return n=b[d>>2]|0,k=0>(n|0)?0:n,n=10<(k|0)?10:k,k=b[a>>2]|0,b[a+96>>2]=b[(b[k>>2]|0)+112+(n<<2)>>2],b[h>>2]=b[(b[k>>2]|0)+68+(n<<2)>>2],Ea(b[a+4>>2]|0,6,h)|0,f=g,0;case 19:return Ea(b[a+4>>2]|0,19,d)|0,h=b[(b[a+92>>2]|0)+(b[a+96>>2]<<2)>>2]|0,n=b[a+32>>2]|0,0==(h|0)?(k=d,b[k>>2]=(b[k>>2]|0)+((n<<2|0)/(b[a+8>>2]|0)|0)):(k=ta(b[h+52>>2]|0,n)|0,n=
d,b[n>>2]=(b[n>>2]|0)+((k|0)/(b[a+8>>2]|0)|0)),f=g,0;case 24:return k=b[d>>2]|0,b[a+32>>2]=k,b[q>>2]=k>>1,Ea(b[a+4>>2]|0,24,q)|0,f=g,0;case 25:return b[d>>2]=b[a+32>>2],f=g,0;case 20:return Ea(b[a+4>>2]|0,20,d)|0,f=g,0;case 22:return Ea(b[a+4>>2]|0,22,d)|0,f=g,0;case 36:return b[a+88>>2]=b[d>>2],Ea(b[a+4>>2]|0,36,d)|0,f=g,0;case 37:return b[d>>2]=b[a+88>>2],f=g,0;case 39:return Ea(b[a+4>>2]|0,39,d)|0,q=d,b[q>>2]<<=1,f=g,0;case 44:return Ea(b[a+4>>2]|0,44,d)|0,f=g,0;case 45:return Ea(b[a+4>>2]|0,45,
d)|0,f=g,0;case 47:return Ea(b[a+4>>2]|0,47,d)|0,f=g,0;case 100:q=d;k=a+20|0;if(0>=(b[k>>2]|0))return f=g,0;n=a+68|0;for(h=0;;)if(e[q+(h<<2)>>2]=+e[(b[n>>2]|0)+(h<<2)>>2],h=h+1|0,!((h|0)<(b[k>>2]|0))){p=0;break}f=g;return p|0;case 103:return Ea(b[a+4>>2]|0,103,d)|0,f=g,0;case 104:return b[a+76>>2]=d,f=g,0;case 105:return Ea(b[a+4>>2]|0,105,d)|0,f=g,0;case 106:return b[d>>2]=b[a+40>>2],f=g,0;default:return sa(b[Oa>>2]|0,13552,(a=f,f=f+16|0,b[a>>2]=13768,b[a+8>>2]=c,a)|0)|0,f=a,f=g,-1}}function yc(a){a|=
0;return Sb[b[a+20>>2]&15](a)|0}function Ec(a){a|=0;return Sb[b[a+32>>2]&15](a)|0}function Ac(a){a|=0;Tb[b[(b[a>>2]|0)+24>>2]&15](a)}function Gc(a){a|=0;Tb[b[(b[a>>2]|0)+36>>2]&15](a)}function Cc(a,c,d){a|=0;return Ta[b[(b[a>>2]|0)+28>>2]&31](a,c|0,d|0)|0}function Ic(a,c,d){a|=0;return Ta[b[(b[a>>2]|0)+40>>2]&31](a,c|0,d|0)|0}function ea(a,c,d){a|=0;return Ta[b[(b[a>>2]|0)+44>>2]&31](a,c|0,d|0)|0}function Ea(a,c,d){a|=0;return Ta[b[(b[a>>2]|0)+48>>2]&31](a,c|0,d|0)|0}function Lc(a,c,d){a|=0;c|=0;
d|=0;var e=0,g=0,q=0,q=g=0,e=f;1==(c|0)?(g=d,q=b[g>>2]|0,0==(q|0)?b[g>>2]=5:(q=b[a+32+(q<<2)>>2]|0,b[g>>2]=0==(q|0)?-1:b[q+52>>2]),g=0):0==(c|0)?(b[d>>2]=b[a>>2],g=0):(sa(b[Oa>>2]|0,13192,(q=f,f=f+16|0,b[q>>2]=12768,b[q+8>>2]=c,q)|0)|0,f=q,g=-1);f=e;return g|0}function nc(a,c,d){a|=0;c|=0;d|=0;var e=0,g=0,e=0,e=h(a,4)|0,g=b[c+(20*e|0)+4>>2]|0;if(0!=(g|0))return e=Ta[g&31](a,d,b[c+(20*e|0)+8>>2]|0)|0,e|0;p(a,2>(e|0)?1:8>(e|0)?4:10>(e|0)?8:12>(e|0)?16:14>(e|0)?32:64);return 0}function Mc(b,a,c){b|=
0;p(b,(h(b,4)|0)<<3|5);return 0}function fc(a){a|=0;e[a+4>>2]=0;e[a+8>>2]=1;e[a+32>>2]=0;e[a>>2]=0.10000000149011612;e[a+40>>2]=0;e[a+36>>2]=0;e[a+44>>2]=0;e[a+52>>2]=0.6798535585403442;e[a+56>>2]=0.05000000074505806;e[a+48>>2]=13.597070693969727;b[a+60>>2]=0;e[a+12>>2]=8.699514389038086;e[a+16>>2]=8.699514389038086;e[a+20>>2]=8.699514389038086;e[a+24>>2]=8.699514389038086;e[a+28>>2]=8.699514389038086}function ic(a,c,d,g,f){a|=0;c|=0;d|=0;f=+f;var q=0,h=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,F=0,p=0,l=0,z=
0,B=0,A=0,y=0,w=0,x=0,D=0,G=0,C=0,J=0,M=0,O=0,N=0,K=0,L=0,I=0,P=I=N=I=0,R=0,V=0,q=B=C=C=B=B=J=x=x=w=F=l=0;g=d>>1;if(0<(g|0))for(h=q=0;;)if(k=+e[c+(h<<2)>>2],n=q+k*k,v=h+1|0,(v|0)<(g|0))q=n,h=v;else{r=n;break}else r=0;if((g|0)<(d|0))for(q=0,h=g;;)if(n=+e[c+(h<<2)>>2],k=q+n*n,g=h+1|0,(g|0)<(d|0))q=k,h=g;else{m=k;break}else m=0;q=r+m;k=+ab(q+6E3);h=a+12|0;n=+e[h>>2];u=k-n;d=a+16|0;t=+e[d>>2];F=k-t;c=a+20|0;p=+e[c>>2];l=k-p;g=a+24|0;z=+e[g>>2];B=k-z;v=a+28|0;A=k-+e[v>>2];y=(u*u+0+F*F+l*l+B*B+A*A)/150;
A=1<y?1:y;y=f;B=y+-0.4;l=3*B*+Eb(+B);F=+e[a>>2];w=a+4|0;u=q*F+(1-F)*+e[w>>2];e[w>>2]=u;w=a+52|0;F=+e[w>>2];x=a+56|0;D=+e[x>>2];G=F/D;e[a+48>>2]=G;C=q;J=+Uc(+C,0.3);M=D;O=6E3<q;0.06>M&O?(N=0.05*J,K=e[w>>2]=N):K=F;F=l;do if(0.3>F){N=A;if(0.2>N){L=J;I=G;if(L<1.2*I){I=1958;break}if(0.05>N)N=L;else{I=1953;break}}else{if(0.05<=N){I=1953;break}N=J;I=G}I=N<1.5*I?1958:1953}else I=1953;while(0);a:do if(1953==(I|0)){do if(0.4>F&&!(0.05<=A)&&J<1.2*G){I=1958;break a}while(0);0>l&&0.05>A?I=1958:(b[a+60>>2]=0,P=
K,R=D,V=0)}while(0);1958==(I|0)&&(l=a+60|0,F=(b[l>>2]|0)+1|0,b[l>>2]=F,A=3*G,3>=(F|0)?(P=K,R=D):(l=0.05*(J>A?A:J)+0.95*K,e[w>>2]=l,A=0.95*M+0.05,e[x>>2]=A,P=l,R=A),V=F);J<G&O&&(e[w>>2]=0.05*J+0.95*P,e[x>>2]=0.95*R+0.05);3E4>q?(R=1E4>q?5.600000381469727:6.300000190734863,w=3E3<=q?R:R+-0.7):(R=q+1,P=+ab(R/(+e[a+8>>2]+1)),J=+ab(R/(u+1)),R=-5>J?-5:J,J=2<R?2:R,x=0<J?0.6*J+7:7,x=0>J?0.5*J+x:x,J=0<P?(5<P?2.5:0.5*P)+x:x,w=m<=1.6*r?J:J+0.5);e[a+8>>2]=q;x=a+40|0;J=0.4*y+0.6*+e[x>>2];e[x>>2]=J;y=w+2.2*(B+(J+
-0.4));x=a+44|0;J=+e[x>>2];B=y<J?0.5*J+0.5*y:y;y=4>B?4:B;B=(w=2<(V|0))?4:10<y?10:y;B=0==(V|0)?B:B-(+ab(+(V|0)+3)+-1.0986122886681098);B=0>B?0:B;if(6E4<=q)return C=B,C=-1>C?-1:C,e[(a+36|0)>>2]=f,e[x>>2]=C,e[v>>2]=z,e[g>>2]=p,e[c>>2]=t,e[d>>2]=n,e[h>>2]=k,+C;B=w?B-0.5*(+ab(+(V|0)+3)+-1.0986122886681098):B;q=1E4<=q|w^1?B:B-0.5*(+ab(+(V|0)+3)+-1.0986122886681098);B=0.3*+ab(C/6E4+1E-4);C=(0>q?0:q)+B;C=-1>C?-1:C;e[(a+36|0)>>2]=f;e[x>>2]=C;e[v>>2]=z;e[g>>2]=p;e[c>>2]=t;e[d>>2]=n;e[h>>2]=k;return+C}function ob(b,
a,c){b=+b;a|=0;var d=0,g=0,f=0,g=0,d=(c|0)-1|0;a:do if(0<(d|0))for(c=a,g=0;;){if(+e[c>>2]>=b){f=g;break a}g=g+1|0;if((g|0)<(d|0))c=c+4|0;else{f=g;break}}else f=0;while(0);return f|0}function Hb(a,c,d,g,f,q,h,k,n){a|=0;d|=0;g|=0;f|=0;q|=0;h|=0;k|=0;var v=0,r=0,m=0,u=0,t=0,l=0,p=u=0,w=0,z=0,B=0,A=z=m=z=t=0,y=B=0;if(!(0>=(g|0)))if(n=q-1|0,v=k+(n<<2)|0,r=0<(n|0),0<(d|0))for(m=c|0,t=u=0;;){w=m;for(z=l=0;;)if(A=z+ +e[a+(l<<2)>>2]*+e[w>>2],c=l+1|0,(c|0)<(d|0))w=w+4|0,l=c,z=A;else break;l=m+(d<<2)|0;z=0.5*
+e[f+(u<<2)>>2]-A;(u|0)<(q|0)?p=2007:z<+e[v>>2]?p=2007:B=t;if(2007==(p|0)){p=0;a:do if(r)for(w=q,c=n;;){m=w-2|0;B=k+(m<<2)|0;if((c|0)<=(t|0)&&z>=+e[B>>2]){y=c;break a}e[k+(c<<2)>>2]=+e[B>>2];b[h+(c<<2)>>2]=b[h+(m<<2)>>2];m=c-1|0;if(0<(m|0))w=c,c=m;else{y=m;break}}else y=n;while(0);e[k+(y<<2)>>2]=z;b[h+(y<<2)>>2]=u;B=t+1|0}c=u+1|0;if((c|0)<(g|0))m=l,u=c,t=B;else break}else for(l=c=0;;){u=0.5*+e[f+(c<<2)>>2];(c|0)<(q|0)?p=2010:u<+e[v>>2]?p=2010:w=l;if(2010==(p|0)){p=0;a:do if(r)for(z=q,B=n;;){t=z-2|
0;z=k+(t<<2)|0;if((B|0)<=(l|0)&&u>=+e[z>>2]){m=B;break a}e[k+(B<<2)>>2]=+e[z>>2];b[h+(B<<2)>>2]=b[h+(t<<2)>>2];t=B-1|0;if(0<(t|0))z=B,B=t;else{m=t;break}}else m=n;while(0);e[k+(m<<2)>>2]=u;b[h+(m<<2)>>2]=c;w=l+1|0}B=c+1|0;if((B|0)<(g|0))c=B,l=w;else break}}function Ib(a,c,d,g,f,q,h,k,n){a|=0;d|=0;g|=0;f|=0;q|=0;h|=0;k|=0;var v=0,r=0,m=0,u=0,t=0,l=0,p=0,w=0,z=0,B=0,A=l=0,y=0,x=0,C=0,D=u=0;if(!(0>=(g|0)))for(n=0<(d|0),v=q-1|0,r=k+(v<<2)|0,m=0<(v|0),u=c|0,t=c=0;;){do if(n){l=u;for(w=p=0;;)if(z=w+ +e[a+
(p<<2)>>2]*+e[l>>2],B=p+1|0,(B|0)<(d|0))l=l+4|0,p=B,w=z;else break;p=u+(d<<2)|0;0>=z?(l=z,A=1):(l=-0-z,A=0);y=p}else l=0,A=1,y=u;while(0);w=l+0.5*+e[f+(c<<2)>>2];(c|0)<(q|0)?x=2028:w<+e[r>>2]?x=2028:C=t;do if(2028==(x|0)){x=0;a:do if(m)for(p=q,l=v;;){B=p-2|0;u=k+(B<<2)|0;if((l|0)<=(t|0)&&w>=+e[u>>2]){D=l;break a}e[k+(l<<2)>>2]=+e[u>>2];b[h+(l<<2)>>2]=b[h+(B<<2)>>2];B=l-1|0;if(0<(B|0))p=l,l=B;else{D=B;break}}else D=v;while(0);e[k+(D<<2)>>2]=w;l=h+(D<<2)|0;b[l>>2]=c;p=t+1|0;0!=(A|0)&&(b[l>>2]=c+g);
C=p}while(0);p=c+1|0;if((p|0)<(g|0))u=y,c=p,t=C;else break}}function jb(a){a|=0;var c=0,d=0,e=0,g=0,f=0,h=0,k=0,n=0,v=0,r=0,m=0,u=0,t=0,l=0,p=t=0,w=u=0,z=w=u=g=c=k=f=v=n=f=m=0,B=m=m=d=e=0,A=0,y=c=k=p=n=n=g=d=0,x=0,C=0,D=0,G=0,N=0,J=0,I=0,O=0,P=v=0,K=0,L=l=0,R=m=0,V=0,$=0,aa=m=0,ca=0,Y=0,U=m=0,Q=U=0,T=Q=Q=U=m=U=m=0,Q=e=e=e=m=m=m=U=Y=ca=0;do if(245>a>>>0){c=11>a>>>0?16:a+11&-8;d=c>>>3;e=b[3556]|0;g=e>>>(d>>>0);if(0!=(g&3|0)){f=(g&1^1)+d|0;h=f<<1;k=14264+(h<<2)|0;n=14264+(h+2<<2)|0;h=b[n>>2]|0;v=h+8|
0;r=b[v>>2]|0;if((k|0)==(r|0))b[3556]=e&~(1<<f);else{if(r>>>0<(b[3560]|0)>>>0)return M(),0;m=r+12|0;if((b[m>>2]|0)==(h|0))b[m>>2]=k,b[n>>2]=r;else return M(),0}r=f<<3;b[h+4>>2]=r|3;n=h+(r|4)|0;b[n>>2]|=1;u=v;return u|0}if(c>>>0<=(b[3558]|0)>>>0)t=c;else{if(0!=(g|0)){n=2<<d;r=g<<d&(n|-n);n=(r&-r)-1|0;r=n>>>12&16;k=n>>>(r>>>0);n=k>>>5&8;m=k>>>(n>>>0);k=m>>>2&4;l=m>>>(k>>>0);m=l>>>1&2;t=l>>>(m>>>0);l=t>>>1&1;p=(n|r|k|m|l)+(t>>>(l>>>0))|0;l=p<<1;t=14264+(l<<2)|0;m=14264+(l+2<<2)|0;l=b[m>>2]|0;k=l+8|0;
r=b[k>>2]|0;if((t|0)==(r|0))b[3556]=e&~(1<<p);else{if(r>>>0<(b[3560]|0)>>>0)return M(),0;n=r+12|0;if((b[n>>2]|0)==(l|0))b[n>>2]=t,b[m>>2]=r;else return M(),0}r=p<<3;m=r-c|0;b[l+4>>2]=c|3;t=l;e=t+c|0;b[t+(c|4)>>2]=m|1;b[t+r>>2]=m;r=b[3558]|0;if(0!=(r|0)){t=b[3561]|0;d=r>>>3;r=d<<1;g=14264+(r<<2)|0;v=b[3556]|0;h=1<<d;if(0==(v&h|0))b[3556]=v|h,u=g,w=14264+(r+2<<2)|0;else if(d=14264+(r+2<<2)|0,f=b[d>>2]|0,f>>>0>=(b[3560]|0)>>>0)u=f,w=d;else return M(),0;b[w>>2]=t;b[u+12>>2]=t;b[t+8>>2]=u;b[t+12>>2]=g}b[3558]=
m;b[3561]=e;u=k;return u|0}r=b[3557]|0;if(0==(r|0))t=c;else{h=(r&-r)-1|0;r=h>>>12&16;v=h>>>(r>>>0);h=v>>>5&8;l=v>>>(h>>>0);v=l>>>2&4;p=l>>>(v>>>0);l=p>>>1&2;d=p>>>(l>>>0);p=d>>>1&1;d=p=f=b[14528+((h|r|v|l|p)+(d>>>(p>>>0))<<2)>>2]|0;for(l=(b[f+4>>2]&-8)-c|0;;){f=b[p+16>>2]|0;if(0==(f|0))if(v=b[p+20>>2]|0,0==(v|0))break;else m=v;else m=f;f=(b[m+4>>2]&-8)-c|0;v=f>>>0<l>>>0;p=m;d=v?m:d;l=v?f:l}p=d;k=b[3560]|0;if(p>>>0<k>>>0)return M(),0;m=e=p+c|0;if(p>>>0>=e>>>0)return M(),0;e=b[d+24>>2]|0;g=b[d+12>>
2]|0;do if((g|0)==(d|0)){t=d+20|0;f=b[t>>2]|0;if(0==(f|0))if(v=d+16|0,r=b[v>>2]|0,0==(r|0)){f=0;break}else n=r;else n=f,v=t;for(;;)if(t=n+20|0,f=b[t>>2]|0,0!=(f|0))n=f,v=t;else if(t=n+16|0,f=b[t>>2]|0,0==(f|0))break;else n=f,v=t;if(v>>>0<k>>>0)return M(),0;b[v>>2]=0;f=n}else{t=b[d+8>>2]|0;if(t>>>0<k>>>0)return M(),0;f=t+12|0;if((b[f>>2]|0)!=(d|0))return M(),0;v=g+8|0;if((b[v>>2]|0)==(d|0))b[f>>2]=g,b[v>>2]=t,f=g;else return M(),0}while(0);a:do if(0!=(e|0)){g=d+28|0;k=14528+(b[g>>2]<<2)|0;do if((d|
0)==(b[k>>2]|0)){if(b[k>>2]=f,0==(f|0)){b[3557]&=~(1<<b[g>>2]);break a}}else{if(e>>>0<(b[3560]|0)>>>0)return M(),0;t=e+16|0;(b[t>>2]|0)==(d|0)?b[t>>2]=f:b[e+20>>2]=f;if(0==(f|0))break a}while(0);if(f>>>0<(b[3560]|0)>>>0)return M(),0;b[f+24>>2]=e;g=b[d+16>>2]|0;if(0!=(g|0)){if(g>>>0<(b[3560]|0)>>>0)return M(),0;b[f+16>>2]=g;b[g+24>>2]=f}g=b[d+20>>2]|0;if(0!=(g|0)){if(g>>>0<(b[3560]|0)>>>0)return M(),0;b[f+20>>2]=g;b[g+24>>2]=f}}while(0);if(16>l>>>0)e=l+c|0,b[d+4>>2]=e|3,g=p+(e+4)|0,b[g>>2]|=1;else{b[d+
4>>2]=c|3;b[p+(c|4)>>2]=l|1;b[p+(l+c)>>2]=l;g=b[3558]|0;if(0!=(g|0)){e=b[3561]|0;k=g>>>3;g=k<<1;t=14264+(g<<2)|0;v=b[3556]|0;f=1<<k;if(0==(v&f|0))b[3556]=v|f,f=t,k=14264+(g+2<<2)|0;else if(k=14264+(g+2<<2)|0,r=b[k>>2]|0,r>>>0>=(b[3560]|0)>>>0)f=r;else return M(),0;b[k>>2]=e;b[f+12>>2]=e;b[e+8>>2]=f;b[e+12>>2]=t}b[3558]=l;b[3561]=m}g=d+8|0;if(0==(g|0))t=c;else return u=g,u|0}}}else if(4294967231<a>>>0)t=-1;else if(g=a+11|0,f=g&-8,v=b[3557]|0,0==(v|0))t=f;else{p=-f|0;k=g>>>8;0==(k|0)?c=0:16777215<f>>>
0?c=31:(g=(k+1048320|0)>>>16&8,r=k<<g,h=(r+520192|0)>>>16&4,n=r<<h,r=(n+245760|0)>>>16&2,g=14-(h|g|r)+(n<<r>>>15)|0,c=f>>>((g+7|0)>>>0)&1|g<<1);k=b[14528+(c<<2)>>2]|0;a:do if(0==(k|0))u=0,w=p,z=0;else for(e=31==(c|0)?0:25-(c>>>1)|0,d=0,m=p,l=k,t=f<<e,e=0;;){g=b[l+4>>2]&-8;r=g-f|0;if(r>>>0<m>>>0)if((g|0)==(f|0)){u=l;w=r;z=l;break a}else d=l,m=r;r=b[l+20>>2]|0;g=b[l+16+(t>>>31<<2)>>2]|0;n=0==(r|0)|(r|0)==(g|0)?e:r;if(0==(g|0)){u=d;w=m;z=n;break}else l=g,t<<=1,e=n}while(0);if(0==(z|0)&0==(u|0)){k=2<<
c;p=v&(k|-k);if(0==(p|0)){t=f;break}k=(p&-p)-1|0;p=k>>>12&16;e=k>>>(p>>>0);k=e>>>5&8;t=e>>>(k>>>0);e=t>>>2&4;l=t>>>(e>>>0);t=l>>>1&2;m=l>>>(t>>>0);l=m>>>1&1;m=b[14528+((k|p|e|t|l)+(m>>>(l>>>0))<<2)>>2]|0}else m=z;if(0==(m|0))B=w,A=u;else for(l=m,m=w,t=u;;)if(e=(b[l+4>>2]&-8)-f|0,k=(p=e>>>0<m>>>0)?e:m,e=p?l:t,p=b[l+16>>2]|0,0!=(p|0))l=p,m=k,t=e;else if(p=b[l+20>>2]|0,0==(p|0)){B=k;A=e;break}else l=p,m=k,t=e;if(0==(A|0))t=f;else if(B>>>0>=((b[3558]|0)-f|0)>>>0)t=f;else{t=A;m=b[3560]|0;if(t>>>0<m>>>
0)return M(),0;v=l=t+f|0;if(t>>>0>=l>>>0)return M(),0;e=b[A+24>>2]|0;k=b[A+12>>2]|0;do if((k|0)==(A|0)){p=A+20|0;d=b[p>>2]|0;if(0==(d|0)){if(n=A+16|0,g=b[n>>2]|0,0==(g|0)){d=0;break}}else g=d,n=p;for(;;)if(p=g+20|0,d=b[p>>2]|0,0!=(d|0))g=d,n=p;else if(p=g+16|0,d=b[p>>2]|0,0==(d|0))break;else g=d,n=p;if(n>>>0<m>>>0)return M(),0;b[n>>2]=0;d=g}else{p=b[A+8>>2]|0;if(p>>>0<m>>>0)return M(),0;d=p+12|0;if((b[d>>2]|0)!=(A|0))return M(),0;n=k+8|0;if((b[n>>2]|0)==(A|0))b[d>>2]=k,b[n>>2]=p,d=k;else return M(),
0}while(0);a:do if(0!=(e|0)){k=A+28|0;m=14528+(b[k>>2]<<2)|0;do if((A|0)==(b[m>>2]|0)){if(b[m>>2]=d,0==(d|0)){b[3557]&=~(1<<b[k>>2]);break a}}else{if(e>>>0<(b[3560]|0)>>>0)return M(),0;p=e+16|0;(b[p>>2]|0)==(A|0)?b[p>>2]=d:b[e+20>>2]=d;if(0==(d|0))break a}while(0);if(d>>>0<(b[3560]|0)>>>0)return M(),0;b[d+24>>2]=e;k=b[A+16>>2]|0;if(0!=(k|0)){if(k>>>0<(b[3560]|0)>>>0)return M(),0;b[d+16>>2]=k;b[k+24>>2]=d}k=b[A+20>>2]|0;if(0!=(k|0)){if(k>>>0<(b[3560]|0)>>>0)return M(),0;b[d+20>>2]=k;b[k+24>>2]=d}}while(0);
do if(16>B>>>0)e=B+f|0,b[A+4>>2]=e|3,k=t+(e+4)|0,b[k>>2]|=1;else if(b[A+4>>2]=f|3,b[t+(f|4)>>2]=B|1,b[t+(B+f)>>2]=B,k=B>>>3,256>B>>>0){e=k<<1;m=14264+(e<<2)|0;p=b[3556]|0;n=1<<k;if(0==(p&n|0))b[3556]=p|n,n=m,p=14264+(e+2<<2)|0;else if(k=14264+(e+2<<2)|0,d=b[k>>2]|0,d>>>0>=(b[3560]|0)>>>0)n=d,p=k;else return M(),0;b[p>>2]=v;b[n+12>>2]=v;b[t+(f+8)>>2]=n;b[t+(f+12)>>2]=m}else if(e=l,n=B>>>8,0==(n|0)?k=0:16777215<B>>>0?k=31:(p=(n+1048320|0)>>>16&8,k=n<<p,d=(k+520192|0)>>>16&4,g=k<<d,k=(g+245760|0)>>>
16&2,r=14-(d|p|k)+(g<<k>>>15)|0,k=B>>>((r+7|0)>>>0)&1|r<<1),n=14528+(k<<2)|0,b[t+(f+28)>>2]=k,b[t+(f+20)>>2]=0,b[t+(f+16)>>2]=0,m=b[3557]|0,r=1<<k,0==(m&r|0))b[3557]=m|r,b[n>>2]=e,b[t+(f+24)>>2]=n,b[t+(f+12)>>2]=e,b[t+(f+8)>>2]=e;else{c=31==(k|0)?0:25-(k>>>1)|0;r=B<<c;for(m=b[n>>2]|0;(b[m+4>>2]&-8|0)!=(B|0);)if(y=m+16+(r>>>31<<2)|0,n=b[y>>2]|0,0==(n|0)){x=2188;break}else r<<=1,m=n;if(2188==(x|0)){if(y>>>0<(b[3560]|0)>>>0)return M(),0;b[y>>2]=e;b[t+(f+24)>>2]=m;b[t+(f+12)>>2]=e;b[t+(f+8)>>2]=e}else{r=
m+8|0;n=b[r>>2]|0;k=b[3560]|0;if(m>>>0<k>>>0||n>>>0<k>>>0)return M(),0;b[n+12>>2]=e;b[r>>2]=e;b[t+(f+8)>>2]=n;b[t+(f+12)>>2]=m;b[t+(f+24)>>2]=0}}while(0);t=A+8|0;if(0==(t|0))t=f;else return u=t,u|0}}while(0);A=b[3558]|0;if(t>>>0<=A>>>0)return y=A-t|0,B=b[3561]|0,15<y>>>0?(c=B,b[3561]=c+t,b[3558]=y,b[c+(t+4)>>2]=y|1,b[c+A>>2]=y,b[B+4>>2]=t|3):(b[3558]=0,b[3561]=0,b[B+4>>2]=A|3,y=B+(A+4)|0,b[y>>2]|=1),B+8|0;B=b[3559]|0;if(t>>>0<B>>>0)return y=B-t|0,b[3559]=y,A=B=b[3562]|0,b[3562]=A+t,b[A+(t+4)>>2]=
y|1,b[B+4>>2]=t|3,B+8|0;if(0==(b[3548]|0))if(B=kb(30)|0,0==(B-1&B|0))b[3550]=B,b[3549]=B,b[3551]=-1,b[3552]=-1,b[3553]=0,b[3667]=0,b[3548]=(lb(0)|0)&-16^1431655768;else return M(),0;B=t+48|0;y=b[3550]|0;A=t+47|0;c=y+A|0;k=-y|0;y=c&k;if(y>>>0<=t>>>0)return 0;n=b[3666]|0;if(0!=(n|0)&&(p=b[3664]|0,d=p+y|0,d>>>0<=p>>>0|d>>>0>n>>>0))return 0;a:do{if(0==(b[3667]&4|0)){n=b[3562]|0;b:do if(0==(n|0))x=2218;else{d=n;for(p=14672;;){C=p|0;g=b[C>>2]|0;if(g>>>0<=d>>>0&&(D=p+4|0,(g+(b[D>>2]|0)|0)>>>0>d>>>0))break;
g=b[p+8>>2]|0;if(0==(g|0)){x=2218;break b}else p=g}0==(p|0)?x=2218:(d=c-(b[3559]|0)&k,2147483647<=d>>>0?G=0:(m=eb(d|0)|0,N=(e=(m|0)==((b[C>>2]|0)+(b[D>>2]|0)|0))?m:-1,J=e?d:0,I=m,O=d,x=2227))}while(0);2218==(x|0)&&(n=eb(0)|0,-1==(n|0)?G=0:(f=n,d=b[3549]|0,m=d-1|0,v=0==(m&f|0)?y:y-f+(m+f&-d)|0,d=b[3664]|0,f=d+v|0,v>>>0>t>>>0&2147483647>v>>>0?(m=b[3666]|0,0!=(m|0)&&f>>>0<=d>>>0|f>>>0>m>>>0?G=0:(m=eb(v|0)|0,N=(f=(m|0)==(n|0))?n:-1,J=f?v:0,I=m,O=v,x=2227)):G=0));b:do if(2227==(x|0)){m=-O|0;if(-1!=(N|
0)){P=J;K=N;x=2238;break a}do if(-1!=(I|0)&2147483647>O>>>0&O>>>0<B>>>0)if(f=b[3550]|0,n=A-O+f&-f,2147483647<=n>>>0)l=O;else if(-1==(eb(n|0)|0)){eb(m|0)|0;G=J;break b}else l=n+O|0;else l=O;while(0);if(-1==(I|0))G=J;else{P=l;K=I;x=2238;break a}}while(0);b[3667]|=4;L=G}else L=0;x=2235}while(0);2235!=(x|0)||2147483647<=y>>>0||(G=eb(y|0)|0,I=eb(0)|0,-1!=(I|0)&-1!=(G|0)&G>>>0<I>>>0&&(l=I-G|0,J=(I=l>>>0>(t+40|0)>>>0)?G:-1,-1!=(J|0)&&(P=I?l:L,K=J,x=2238)));do if(2238==(x|0)){L=(b[3664]|0)+P|0;b[3664]=L;
L>>>0>(b[3665]|0)>>>0&&(b[3665]=L);L=b[3562]|0;a:do if(0==(L|0)){y=b[3560]|0;0==(y|0)|K>>>0<y>>>0&&(b[3560]=K);b[3668]=K;b[3669]=P;b[3671]=0;b[3565]=b[3548];b[3564]=-1;y=0;do J=y<<1,l=14264+(J<<2)|0,b[14264+(J+3<<2)>>2]=l,b[14264+(J+2<<2)>>2]=l,y=y+1|0;while(32>y>>>0);y=K+8|0;m=0==(y&7|0)?0:-y&7;y=P-40-m|0;b[3562]=K+m;b[3559]=y;b[K+(m+4)>>2]=y|1;b[K+(P-36)>>2]=40;b[3563]=b[3552]}else{for(y=14672;;){R=b[y>>2]|0;V=y+4|0;$=b[V>>2]|0;if((K|0)==(R+$|0)){x=2250;break}l=b[y+8>>2]|0;if(0==(l|0))break;else y=
l}do if(2250==(x|0)&&0==(b[y+12>>2]&8|0)&&(l=L,l>>>0>=R>>>0&l>>>0<K>>>0)){b[V>>2]=$+P;l=b[3562]|0;J=(b[3559]|0)+P|0;I=l;G=l+8|0;m=0==(G&7|0)?0:-G&7;G=J-m|0;b[3562]=I+m;b[3559]=G;b[I+(m+4)>>2]=G|1;b[I+(J+4)>>2]=40;b[3563]=b[3552];break a}while(0);K>>>0<(b[3560]|0)>>>0&&(b[3560]=K);y=K+P|0;for(J=14672;;){aa=J|0;if((b[aa>>2]|0)==(y|0)){x=2260;break}I=b[J+8>>2]|0;if(0==(I|0))break;else J=I}do if(2260==(x|0)&&0==(b[J+12>>2]&8|0)){b[aa>>2]=K;y=J+4|0;b[y>>2]=(b[y>>2]|0)+P;y=K+8|0;ca=0==(y&7|0)?0:-y&7;y=
K+(P+8)|0;Y=0==(y&7|0)?0:-y&7;I=y=K+(Y+P)|0;G=ca+t|0;O=l=K+G|0;A=y-(K+ca)-t|0;b[K+(ca+4)>>2]=t|3;do if((I|0)==(b[3562]|0))B=(b[3559]|0)+A|0,b[3559]=B,b[3562]=O,b[K+(G+4)>>2]=B|1;else if((I|0)==(b[3561]|0))B=(b[3558]|0)+A|0,b[3558]=B,b[3561]=O,b[K+(G+4)>>2]=B|1,b[K+(B+G)>>2]=B;else{B=P+4|0;N=b[K+(B+Y)>>2]|0;if(1==(N&3|0)){v=N&-8;D=N>>>3;b:do if(256>N>>>0){C=b[K+((Y|8)+P)>>2]|0;k=b[K+(P+12+Y)>>2]|0;c=14264+(D<<1<<2)|0;if((C|0)!=(c|0)&&(C>>>0<(b[3560]|0)>>>0||(b[C+12>>2]|0)!=(I|0)))return M(),0;if((k|
0)==(C|0))b[3556]&=~(1<<D);else{if((k|0)==(c|0))m=k+8|0;else{if(k>>>0<(b[3560]|0)>>>0)return M(),0;m=k+8|0;if((b[m>>2]|0)!=(I|0))return M(),0}b[C+12>>2]=k;b[m>>2]=C}}else{c=y;m=b[K+((Y|24)+P)>>2]|0;p=b[K+(P+12+Y)>>2]|0;do if((p|0)==(c|0)){n=Y|16;f=K+(B+n)|0;d=b[f>>2]|0;if(0==(d|0))if(e=K+(n+P)|0,n=b[e>>2]|0,0==(n|0)){U=0;break}else U=n,Q=e;else U=d,Q=f;for(;;)if(f=U+20|0,d=b[f>>2]|0,0!=(d|0))U=d,Q=f;else if(f=U+16|0,d=b[f>>2]|0,0==(d|0))break;else U=d,Q=f;if(Q>>>0<(b[3560]|0)>>>0)return M(),0;b[Q>>
2]=0}else{f=b[K+((Y|8)+P)>>2]|0;if(f>>>0<(b[3560]|0)>>>0)return M(),0;d=f+12|0;if((b[d>>2]|0)!=(c|0))return M(),0;e=p+8|0;if((b[e>>2]|0)==(c|0))b[d>>2]=p,b[e>>2]=f,U=p;else return M(),0}while(0);if(0!=(m|0)){p=K+(P+28+Y)|0;C=14528+(b[p>>2]<<2)|0;do if((c|0)==(b[C>>2]|0)){if(b[C>>2]=U,0==(U|0)){b[3557]&=~(1<<b[p>>2]);break b}}else{if(m>>>0<(b[3560]|0)>>>0)return M(),0;k=m+16|0;(b[k>>2]|0)==(c|0)?b[k>>2]=U:b[m+20>>2]=U;if(0==(U|0))break b}while(0);if(U>>>0<(b[3560]|0)>>>0)return M(),0;b[U+24>>2]=m;
c=Y|16;p=b[K+(c+P)>>2]|0;if(0!=(p|0)){if(p>>>0<(b[3560]|0)>>>0)return M(),0;b[U+16>>2]=p;b[p+24>>2]=U}p=b[K+(B+c)>>2]|0;if(0!=(p|0)){if(p>>>0<(b[3560]|0)>>>0)return M(),0;b[U+20>>2]=p;b[p+24>>2]=U}}}while(0);m=K+((v|Y)+P)|0;U=v+A|0}else m=I,U=A;B=m+4|0;b[B>>2]&=-2;b[K+(G+4)>>2]=U|1;b[K+(U+G)>>2]=U;B=U>>>3;if(256>U>>>0){D=B<<1;N=14264+(D<<2)|0;p=b[3556]|0;m=1<<B;if(0==(p&m|0))b[3556]=p|m,m=N,U=14264+(D+2<<2)|0;else if(B=14264+(D+2<<2)|0,C=b[B>>2]|0,C>>>0>=(b[3560]|0)>>>0)m=C,U=B;else return M(),0;
b[U>>2]=O;b[m+12>>2]=O;b[K+(G+8)>>2]=m;b[K+(G+12)>>2]=N}else if(D=l,m=U>>>8,0==(m|0)?Q=0:16777215<U>>>0?Q=31:(p=(m+1048320|0)>>>16&8,v=m<<p,B=(v+520192|0)>>>16&4,C=v<<B,v=(C+245760|0)>>>16&2,k=14-(B|p|v)+(C<<v>>>15)|0,Q=U>>>((k+7|0)>>>0)&1|k<<1),m=14528+(Q<<2)|0,b[K+(G+28)>>2]=Q,b[K+(G+20)>>2]=0,b[K+(G+16)>>2]=0,N=b[3557]|0,k=1<<Q,0==(N&k|0))b[3557]=N|k,b[m>>2]=D,b[K+(G+24)>>2]=m,b[K+(G+12)>>2]=D,b[K+(G+8)>>2]=D;else{Q=31==(Q|0)?0:25-(Q>>>1)|0;k=U<<Q;for(N=b[m>>2]|0;(b[N+4>>2]&-8|0)!=(U|0);)if(T=
N+16+(k>>>31<<2)|0,m=b[T>>2]|0,0==(m|0)){x=2333;break}else k<<=1,N=m;if(2333==(x|0)){if(T>>>0<(b[3560]|0)>>>0)return M(),0;b[T>>2]=D;b[K+(G+24)>>2]=N;b[K+(G+12)>>2]=D;b[K+(G+8)>>2]=D}else{k=N+8|0;m=b[k>>2]|0;v=b[3560]|0;if(N>>>0<v>>>0||m>>>0<v>>>0)return M(),0;b[m+12>>2]=D;b[k>>2]=D;b[K+(G+8)>>2]=m;b[K+(G+12)>>2]=N;b[K+(G+24)>>2]=0}}}while(0);u=K+(ca|8)|0;return u|0}while(0);J=L;for(G=14672;;){ca=b[G>>2]|0;if(ca>>>0<=J>>>0&&(Y=b[G+4>>2]|0,U=ca+Y|0,U>>>0>J>>>0))break;G=b[G+8>>2]|0}G=ca+(Y-39)|0;m=
0==(G&7|0)?0:-G&7;G=ca+(Y-47+m)|0;l=G>>>0<(L+16|0)>>>0?J:G;G=l+8|0;O=K+8|0;m=0==(O&7|0)?0:-O&7;O=P-40-m|0;b[3562]=K+m;b[3559]=O;b[K+(m+4)>>2]=O|1;b[K+(P-36)>>2]=40;b[3563]=b[3552];b[l+4>>2]=27;b[G>>2]=b[3668];b[G+4>>2]=b[3669];b[G+8>>2]=b[3670];b[G+12>>2]=b[3671];b[3668]=K;b[3669]=P;b[3671]=0;b[3670]=G;G=l+28|0;b[G>>2]=7;if((l+32|0)>>>0<U>>>0)for(O=G;;)if(G=O+4|0,b[G>>2]=7,(O+8|0)>>>0<U>>>0)O=G;else break;if((l|0)!=(J|0))if(O=l-L|0,G=J+(O+4)|0,b[G>>2]&=-2,b[L+4>>2]=O|1,b[J+O>>2]=O,G=O>>>3,256>O>>>
0){A=G<<1;I=14264+(A<<2)|0;y=b[3556]|0;m=1<<G;if(0==(y&m|0))b[3556]=y|m,m=I,e=14264+(A+2<<2)|0;else if(G=14264+(A+2<<2)|0,k=b[G>>2]|0,k>>>0>=(b[3560]|0)>>>0)m=k,e=G;else return M(),0;b[e>>2]=L;b[m+12>>2]=L;b[L+8>>2]=m;b[L+12>>2]=I}else if(A=L,m=O>>>8,0==(m|0)?e=0:16777215<O>>>0?e=31:(y=(m+1048320|0)>>>16&8,J=m<<y,l=(J+520192|0)>>>16&4,G=J<<l,J=(G+245760|0)>>>16&2,k=14-(l|y|J)+(G<<J>>>15)|0,e=O>>>((k+7|0)>>>0)&1|k<<1),m=14528+(e<<2)|0,b[L+28>>2]=e,b[L+20>>2]=0,b[L+16>>2]=0,I=b[3557]|0,k=1<<e,0==(I&
k|0))b[3557]=I|k,b[m>>2]=A,b[L+24>>2]=m,b[L+12>>2]=L,b[L+8>>2]=L;else{e=31==(e|0)?0:25-(e>>>1)|0;k=O<<e;for(I=b[m>>2]|0;(b[I+4>>2]&-8|0)!=(O|0);)if(Q=I+16+(k>>>31<<2)|0,m=b[Q>>2]|0,0==(m|0)){x=2368;break}else k<<=1,I=m;if(2368==(x|0)){if(Q>>>0<(b[3560]|0)>>>0)return M(),0;b[Q>>2]=A;b[L+24>>2]=I;b[L+12>>2]=L;b[L+8>>2]=L}else{k=I+8|0;O=b[k>>2]|0;m=b[3560]|0;if(I>>>0<m>>>0||O>>>0<m>>>0)return M(),0;b[O+12>>2]=A;b[k>>2]=A;b[L+8>>2]=O;b[L+12>>2]=I;b[L+24>>2]=0}}}while(0);L=b[3559]|0;if(!(L>>>0<=t>>>0))return O=
L-t|0,b[3559]=O,k=L=b[3562]|0,b[3562]=k+t,b[k+(t+4)>>2]=O|1,b[L+4>>2]=t|3,u=L+8|0,u|0}while(0);b[(Ub()|0)>>2]=12;return 0}function V(a){a|=0;var c=0,d=0,e=0,g=0,f=0,h=0,k=0,n=0,v=0,r=0,m=0,u=0,p=0,l=0,w=0,x=0,z=0,B=0,A=0,y=0,C=m=v=0,I=z=0,D=C=z=0,G=0,N=c=u=f=0,J=0,P=k=h=0,O=0,d=0;if(0!=(a|0)){d=c=a-8|0;e=b[3560]|0;c>>>0<e>>>0&&M();g=b[a-4>>2]|0;f=g&3;1==(f|0)&&M();h=g&-8;n=k=a+(h-8)|0;a:do if(0==(g&1|0)){v=b[c>>2]|0;if(0==(f|0))return;r=-8-v|0;u=m=a+r|0;p=v+h|0;m>>>0<e>>>0&&M();if((u|0)==(b[3561]|
0)){l=a+(h-4)|0;if(3!=(b[l>>2]&3|0)){w=u;x=p;break}b[3558]=p;b[l>>2]&=-2;b[a+(r+4)>>2]=p|1;b[k>>2]=p;return}l=v>>>3;if(256>v>>>0)v=b[a+(r+8)>>2]|0,z=b[a+(r+12)>>2]|0,B=14264+(l<<1<<2)|0,(v|0)!=(B|0)&&(v>>>0<e>>>0&&M(),(b[v+12>>2]|0)!=(u|0)&&M()),(z|0)==(v|0)?b[3556]&=~(1<<l):((z|0)==(B|0)?A=z+8|0:(z>>>0<e>>>0&&M(),y=z+8|0,(b[y>>2]|0)==(u|0)?A=y:M()),b[v+12>>2]=z,b[A>>2]=v),w=u,x=p;else{B=m;l=b[a+(r+24)>>2]|0;y=b[a+(r+12)>>2]|0;do if((y|0)==(B|0)){v=a+(r+20)|0;m=b[v>>2]|0;if(0==(m|0)){if(C=a+(r+16)|
0,z=b[C>>2]|0,0==(z|0)){I=0;break}}else z=m,C=v;for(;;)if(v=z+20|0,m=b[v>>2]|0,0!=(m|0))z=m,C=v;else if(v=z+16|0,m=b[v>>2]|0,0==(m|0))break;else z=m,C=v;C>>>0<e>>>0?M():(b[C>>2]=0,I=z)}else v=b[a+(r+8)>>2]|0,v>>>0<e>>>0&&M(),m=v+12|0,(b[m>>2]|0)!=(B|0)&&M(),C=y+8|0,(b[C>>2]|0)==(B|0)?(b[m>>2]=y,b[C>>2]=v,I=y):M();while(0);if(0==(l|0))w=u,x=p;else{y=a+(r+28)|0;m=14528+(b[y>>2]<<2)|0;do if((B|0)==(b[m>>2]|0)){if(b[m>>2]=I,0==(I|0)){b[3557]&=~(1<<b[y>>2]);w=u;x=p;break a}}else if(l>>>0<(b[3560]|0)>>>
0&&M(),v=l+16|0,(b[v>>2]|0)==(B|0)?b[v>>2]=I:b[l+20>>2]=I,0==(I|0)){w=u;x=p;break a}while(0);I>>>0<(b[3560]|0)>>>0&&M();b[I+24>>2]=l;B=b[a+(r+16)>>2]|0;0!=(B|0)&&(B>>>0<(b[3560]|0)>>>0?M():(b[I+16>>2]=B,b[B+24>>2]=I));B=b[a+(r+20)>>2]|0;0==(B|0)?(w=u,x=p):B>>>0<(b[3560]|0)>>>0?M():(b[I+20>>2]=B,b[B+24>>2]=I,w=u,x=p)}}}else w=d,x=h;while(0);d=w;d>>>0>=k>>>0&&M();I=a+(h-4)|0;e=b[I>>2]|0;0==(e&1|0)&&M();do if(0==(e&2|0)){if((n|0)==(b[3562]|0)){z=(b[3559]|0)+x|0;b[3559]=z;b[3562]=w;b[w+4>>2]=z|1;if((w|
0)!=(b[3561]|0))return;b[3561]=0;b[3558]=0;return}if((n|0)==(b[3561]|0)){z=(b[3558]|0)+x|0;b[3558]=z;b[3561]=w;b[w+4>>2]=z|1;b[d+z>>2]=z;return}z=(e&-8)+x|0;C=e>>>3;a:do if(256>e>>>0)A=b[a+h>>2]|0,f=b[a+(h|4)>>2]|0,c=14264+(C<<1<<2)|0,(A|0)!=(c|0)&&(A>>>0<(b[3560]|0)>>>0&&M(),(b[A+12>>2]|0)!=(n|0)&&M()),(f|0)==(A|0)?b[3556]&=~(1<<C):((f|0)==(c|0)?D=f+8|0:(f>>>0<(b[3560]|0)>>>0&&M(),g=f+8|0,(b[g>>2]|0)==(n|0)?D=g:M()),b[A+12>>2]=f,b[D>>2]=A);else{c=k;g=b[a+(h+16)>>2]|0;B=b[a+(h|4)>>2]|0;do if((B|0)==
(c|0)){l=a+(h+12)|0;y=b[l>>2]|0;if(0==(y|0))if(m=a+(h+8)|0,v=b[m>>2]|0,0==(v|0)){G=0;break}else f=v,u=m;else f=y,u=l;for(;;)if(l=f+20|0,y=b[l>>2]|0,0!=(y|0))f=y,u=l;else if(l=f+16|0,y=b[l>>2]|0,0==(y|0))break;else f=y,u=l;u>>>0<(b[3560]|0)>>>0?M():(b[u>>2]=0,G=f)}else l=b[a+h>>2]|0,l>>>0<(b[3560]|0)>>>0&&M(),y=l+12|0,(b[y>>2]|0)!=(c|0)&&M(),m=B+8|0,(b[m>>2]|0)==(c|0)?(b[y>>2]=B,b[m>>2]=l,G=B):M();while(0);if(0!=(g|0)){B=a+(h+20)|0;A=14528+(b[B>>2]<<2)|0;do if((c|0)==(b[A>>2]|0)){if(b[A>>2]=G,0==(G|
0)){b[3557]&=~(1<<b[B>>2]);break a}}else if(g>>>0<(b[3560]|0)>>>0&&M(),f=g+16|0,(b[f>>2]|0)==(c|0)?b[f>>2]=G:b[g+20>>2]=G,0==(G|0))break a;while(0);G>>>0<(b[3560]|0)>>>0&&M();b[G+24>>2]=g;c=b[a+(h+8)>>2]|0;0!=(c|0)&&(c>>>0<(b[3560]|0)>>>0?M():(b[G+16>>2]=c,b[c+24>>2]=G));c=b[a+(h+12)>>2]|0;0!=(c|0)&&(c>>>0<(b[3560]|0)>>>0?M():(b[G+20>>2]=c,b[c+24>>2]=G))}}while(0);b[w+4>>2]=z|1;b[d+z>>2]=z;if((w|0)!=(b[3561]|0))c=z;else{b[3558]=z;return}}else b[I>>2]=e&-2,b[w+4>>2]=x|1,c=b[d+x>>2]=x;while(0);x=c>>>
3;if(256>c>>>0)d=x<<1,e=14264+(d<<2)|0,I=b[3556]|0,G=1<<x,0==(I&G|0)?(b[3556]=I|G,N=e,J=14264+(d+2<<2)|0):(x=14264+(d+2<<2)|0,h=b[x>>2]|0,h>>>0>=(b[3560]|0)>>>0?(N=h,J=x):M()),b[J>>2]=w,b[N+12>>2]=w,b[w+8>>2]=N,b[w+12>>2]=e;else{e=w;N=c>>>8;0==(N|0)?h=0:16777215<c>>>0?h=31:(J=(N+1048320|0)>>>16&8,d=N<<J,G=(d+520192|0)>>>16&4,I=d<<G,d=(I+245760|0)>>>16&2,x=14-(G|J|d)+(I<<d>>>15)|0,h=c>>>((x+7|0)>>>0)&1|x<<1);N=14528+(h<<2)|0;b[w+28>>2]=h;b[w+20>>2]=0;b[w+16>>2]=0;x=b[3557]|0;d=1<<h;do if(0==(x&d|0))b[3557]=
x|d,b[N>>2]=e,b[w+24>>2]=N,b[w+12>>2]=w,b[w+8>>2]=w;else{k=31==(h|0)?0:25-(h>>>1)|0;I=c<<k;for(J=b[N>>2]|0;(b[J+4>>2]&-8|0)!=(c|0);)if(P=J+16+(I>>>31<<2)|0,G=b[P>>2]|0,0==(G|0)){O=2545;break}else I<<=1,J=G;if(2545==(O|0))if(P>>>0<(b[3560]|0)>>>0)M();else{b[P>>2]=e;b[w+24>>2]=J;b[w+12>>2]=w;b[w+8>>2]=w;break}I=J+8|0;z=b[I>>2]|0;G=b[3560]|0;J>>>0<G>>>0&&M();z>>>0<G>>>0?M():(b[z+12>>2]=e,b[I>>2]=e,b[w+8>>2]=z,b[w+12>>2]=J,b[w+24>>2]=0)}while(0);w=(b[3564]|0)-1|0;b[3564]=w;if(0==(w|0)){for(d=14680;w=
b[d>>2]|0,0!=(w|0);)d=w+8|0;b[3564]=-1}}}}function aa(a,c){a|=0;c|=0;var d=0,d=0;0==(a|0)?d=0:(d=ta(c,a)|0,d=65535>=(c|a)>>>0?d:((d>>>0)/(a>>>0)|0)==(c|0)?d:-1);c=jb(d)|0;if(0==(c|0)||0==(b[c-4>>2]&3|0))return c|0;wa(c|0,0,d|0);return c|0}function Ab(a,c){a|=0;c|=0;var d=0,e=0,e=d=0;if(0==(a|0))return d=jb(c)|0,d|0;if(4294967231<c>>>0)return b[(Ub()|0)>>2]=12,0;d=Vc(a-8|0,11>c>>>0?16:c+11&-8)|0;if(0!=(d|0))return d+8|0;d=jb(c)|0;if(0==(d|0))return 0;e=b[a-4>>2]|0;e=(e&-8)-(0==(e&3|0)?8:4)|0;Fa(d|
0,a|0,e>>>0<c>>>0?e:c)|0;V(a);return d|0}function Vc(a,c){a|=0;c|=0;var d=0,e=0,g=0,f=0,h=0,k=0,n=0,l=0,r=0,m=0,p=0,t=0,w=0,x=p=0,C=0,z=r=l=0,B=z=l=0,z=0,d=a+4|0,e=b[d>>2]|0,g=e&-8,f=a,k=h=f+g|0,n=b[3560]|0;if(f>>>0<n>>>0)return M(),0;l=e&3;if(!(1!=(l|0)&f>>>0<h>>>0))return M(),0;r=f+(g|4)|0;m=b[r>>2]|0;if(0==(m&1|0))return M(),0;if(0==(l|0))return 256>c>>>0?0:g>>>0>=(c+4|0)>>>0&&!((g-c|0)>>>0>b[3550]<<1>>>0)?a|0:0;if(g>>>0>=c>>>0){l=g-c|0;if(15>=l>>>0)return a|0;b[d>>2]=e&1|c|2;b[f+(c+4)>>2]=l|3;
b[r>>2]|=1;Fb(f+c|0,l);return a|0}if((k|0)==(b[3562]|0)){l=(b[3559]|0)+g|0;if(l>>>0<=c>>>0)return 0;r=l-c|0;b[d>>2]=e&1|c|2;b[f+(c+4)>>2]=r|1;b[3562]=f+c;b[3559]=r;return a|0}if((k|0)==(b[3561]|0)){r=(b[3558]|0)+g|0;if(r>>>0<c>>>0)return 0;l=r-c|0;15<l>>>0?(b[d>>2]=e&1|c|2,b[f+(c+4)>>2]=l|1,b[f+r>>2]=l,p=f+(r+4)|0,b[p>>2]&=-2,t=f+c|0,w=l):(b[d>>2]=e&1|r|2,e=f+(r+4)|0,b[e>>2]|=1,w=t=0);b[3558]=w;b[3561]=t;return a|0}if(0!=(m&2|0))return 0;t=(m&-8)+g|0;if(t>>>0<c>>>0)return 0;w=t-c|0;e=m>>>3;a:do if(256>
m>>>0){r=b[f+(g+8)>>2]|0;l=b[f+(g+12)>>2]|0;p=14264+(e<<1<<2)|0;if((r|0)!=(p|0)&&(r>>>0<n>>>0||(b[r+12>>2]|0)!=(k|0)))return M(),0;if((l|0)==(r|0))b[3556]&=~(1<<e);else{if((l|0)==(p|0))p=l+8|0;else{if(l>>>0<n>>>0)return M(),0;x=l+8|0;if((b[x>>2]|0)==(k|0))p=x;else return M(),0}b[r+12>>2]=l;b[p>>2]=r}}else{p=h;x=b[f+(g+24)>>2]|0;C=b[f+(g+12)>>2]|0;do if((C|0)==(p|0)){l=f+(g+20)|0;r=b[l>>2]|0;if(0==(r|0))if(z=f+(g+16)|0,l=b[z>>2]|0,0==(l|0)){z=0;break}else B=l;else B=r,z=l;for(;;)if(l=B+20|0,r=b[l>>
2]|0,0!=(r|0))B=r,z=l;else if(l=B+16|0,r=b[l>>2]|0,0==(r|0))break;else B=r,z=l;if(z>>>0<n>>>0)return M(),0;b[z>>2]=0;z=B}else{l=b[f+(g+8)>>2]|0;if(l>>>0<n>>>0)return M(),0;r=l+12|0;if((b[r>>2]|0)!=(p|0))return M(),0;z=C+8|0;if((b[z>>2]|0)==(p|0))b[r>>2]=C,b[z>>2]=l,z=C;else return M(),0}while(0);if(0!=(x|0)){C=f+(g+28)|0;r=14528+(b[C>>2]<<2)|0;do if((p|0)==(b[r>>2]|0)){if(b[r>>2]=z,0==(z|0)){b[3557]&=~(1<<b[C>>2]);break a}}else{if(x>>>0<(b[3560]|0)>>>0)return M(),0;l=x+16|0;(b[l>>2]|0)==(p|0)?b[l>>
2]=z:b[x+20>>2]=z;if(0==(z|0))break a}while(0);if(z>>>0<(b[3560]|0)>>>0)return M(),0;b[z+24>>2]=x;p=b[f+(g+16)>>2]|0;if(0!=(p|0)){if(p>>>0<(b[3560]|0)>>>0)return M(),0;b[z+16>>2]=p;b[p+24>>2]=z}p=b[f+(g+20)>>2]|0;if(0!=(p|0)){if(p>>>0<(b[3560]|0)>>>0)return M(),0;b[z+20>>2]=p;b[p+24>>2]=z}}}while(0);16>w>>>0?(b[d>>2]=t|b[d>>2]&1|2,z=f+(t|4)|0,b[z>>2]|=1):(b[d>>2]=b[d>>2]&1|c|2,b[f+(c+4)>>2]=w|3,d=f+(t|4)|0,b[d>>2]|=1,Fb(f+c|0,w));return a|0}function Gb(b,a){b|=0;a|=0;var c=0,c=9>b>>>0?jb(a)|0:Nc(b,
a)|0;return c|0}function Nc(a,c){a|=0;c|=0;var d=0,e=0,g=0,f=0,h=0,k=h=0,n=0,l=f=0,r=0,d=16>a>>>0?16:a;if(0==(d-1&d|0))e=d;else for(a=16;;)if(a>>>0<d>>>0)a<<=1;else{e=a;break}if((-64-e|0)>>>0<=c>>>0)return b[(Ub()|0)>>2]=12,0;g=11>c>>>0?16:c+11&-8;c=jb(e+12+g|0)|0;if(0==(c|0))return 0;d=a=c-8|0;f=e-1|0;0==(c&f|0)?h=d:(h=c+f&-e,k=h-8|0,n=a,h=f=15<(k-n|0)>>>0?k:h+(e-8)|0,k=f-n|0,n=c-4|0,l=b[n>>2]|0,r=(l&-8)-k|0,0==(l&3|0)?(b[f>>2]=(b[a>>2]|0)+k,b[f+4>>2]=r):(l=f+4|0,b[l>>2]=r|b[l>>2]&1|2,l=f+(r+4)|
0,b[l>>2]|=1,b[n>>2]=k|b[n>>2]&1|2,n=c+(k-4)|0,b[n>>2]|=1,Fb(d,k)));d=h+4|0;c=b[d>>2]|0;0!=(c&3|0)&&(f=c&-8,f>>>0<=(g+16|0)>>>0||(a=f-g|0,e=h,b[d>>2]=g|c&1|2,b[e+(g|4)>>2]=a|3,f=e+(f|4)|0,b[f>>2]|=1,Fb(e+g|0,a)));return h+8|0}function Vb(a,c,d,e){a|=0;c|=0;d|=0;e|=0;var g=0,f=0,h=0,k=f=0,n=0,l=0,r=0,m=h=0,p=g=m=0,t=0,w=0,x=0,C=0,z=0,k=0;if(0==(b[3548]|0))if(g=kb(30)|0,0==(g-1&g|0))b[3550]=g,b[3549]=g,b[3551]=-1,b[3552]=-1,b[3553]=0,b[3667]=0,b[3548]=(lb(0)|0)&-16^1431655768;else return M(),0;g=0==
(a|0);if(0==(e|0)){if(g)return f=jb(0)|0,f|0;h=a<<2;11>h>>>0?(f=0,k=16):(f=0,k=h+11&-8)}else{if(g)return e|0;f=e;k=0}do if(0==(d&1|0))if(g)l=n=0;else for(h=r=0;;)if(e=b[c+(h<<2)>>2]|0,m=11>e>>>0?16:e+11&-8,e=m+r|0,h=h+1|0,(h|0)==(a|0)){n=0;l=e;break}else r=e;else h=b[c>>2]|0,n=m=11>h>>>0?16:h+11&-8,l=ta(m,a)|0;while(0);m=jb(k-4+l|0)|0;if(0==(m|0))return 0;h=m-8|0;r=b[m-4>>2]&-8;0!=(d&2|0)&&wa(m|0,0,-4-k+r|0);0==(f|0)?(b[m+(l-4)>>2]=r-l|3,g=m+l|0,p=l):(g=f,p=r);b[g>>2]=m;m=a-1|0;a:do if(0==(m|0))t=
h,w=p;else{if(0==(n|0))x=h,C=p,z=0;else for(a=h,r=p,f=0;;)if(l=r-n|0,b[a+4>>2]=n|3,k=a+n|0,d=f+1|0,b[g+(d<<2)>>2]=a+(n+8),(d|0)==(m|0)){t=k;w=l;break a}else a=k,r=l,f=d;for(;;)if(f=b[c+(z<<2)>>2]|0,k=11>f>>>0?16:f+11&-8,f=C-k|0,b[x+4>>2]=k|3,r=x+k|0,a=z+1|0,b[g+(a<<2)>>2]=x+(k+8),(a|0)==(m|0)){t=r;w=f;break}else x=r,C=f,z=a}while(0);b[t+4>>2]=w|3;return g|0}function Fb(a,c){a|=0;c|=0;var d=0,e=0,g=0,f=0,h=0,k=0,n=0,l=0,r=0,m=0,p=0,t=0,w=0,x=0,C=0,z=0,B=0,A=0,y=w=k=0,I=0,N=y=A=0,D=0,G=h=n=f=0,P=0,
J=e=d=0,R=0,d=a,g=e=d+c|0,f=b[a+4>>2]|0;a:do if(0==(f&1|0)){h=b[a>>2]|0;if(0==(f&3|0))return;n=k=d+(-h|0)|0;l=h+c|0;r=b[3560]|0;k>>>0<r>>>0&&M();if((n|0)==(b[3561]|0)){m=d+(c+4)|0;if(3!=(b[m>>2]&3|0)){p=n;t=l;break}b[3558]=l;b[m>>2]&=-2;b[d+(4-h)>>2]=l|1;b[e>>2]=l;return}m=h>>>3;if(256>h>>>0)w=b[d+(8-h)>>2]|0,x=b[d+(12-h)>>2]|0,C=14264+(m<<1<<2)|0,(w|0)!=(C|0)&&(w>>>0<r>>>0&&M(),(b[w+12>>2]|0)!=(n|0)&&M()),(x|0)==(w|0)?b[3556]&=~(1<<m):((x|0)==(C|0)?z=x+8|0:(x>>>0<r>>>0&&M(),B=x+8|0,(b[B>>2]|0)==
(n|0)?z=B:M()),b[w+12>>2]=x,b[z>>2]=w),p=n,t=l;else{C=k;m=b[d+(24-h)>>2]|0;B=b[d+(12-h)>>2]|0;do if((B|0)==(C|0)){A=16-h|0;k=d+(A+4)|0;w=b[k>>2]|0;if(0==(w|0)){if(y=d+A|0,A=b[y>>2]|0,0==(A|0)){I=0;break}}else A=w,y=k;for(;;)if(k=A+20|0,w=b[k>>2]|0,0!=(w|0))A=w,y=k;else if(k=A+16|0,w=b[k>>2]|0,0==(w|0))break;else A=w,y=k;y>>>0<r>>>0?M():(b[y>>2]=0,I=A)}else k=b[d+(8-h)>>2]|0,k>>>0<r>>>0&&M(),w=k+12|0,(b[w>>2]|0)!=(C|0)&&M(),y=B+8|0,(b[y>>2]|0)==(C|0)?(b[w>>2]=B,b[y>>2]=k,I=B):M();while(0);if(0==(m|
0))p=n,t=l;else{B=d+(28-h)|0;r=14528+(b[B>>2]<<2)|0;do if((C|0)==(b[r>>2]|0)){if(b[r>>2]=I,0==(I|0)){b[3557]&=~(1<<b[B>>2]);p=n;t=l;break a}}else if(m>>>0<(b[3560]|0)>>>0&&M(),k=m+16|0,(b[k>>2]|0)==(C|0)?b[k>>2]=I:b[m+20>>2]=I,0==(I|0)){p=n;t=l;break a}while(0);I>>>0<(b[3560]|0)>>>0&&M();b[I+24>>2]=m;C=16-h|0;B=b[d+C>>2]|0;0!=(B|0)&&(B>>>0<(b[3560]|0)>>>0?M():(b[I+16>>2]=B,b[B+24>>2]=I));B=b[d+(C+4)>>2]|0;0==(B|0)?(p=n,t=l):B>>>0<(b[3560]|0)>>>0?M():(b[I+20>>2]=B,b[B+24>>2]=I,p=n,t=l)}}}else p=a,
t=c;while(0);a=b[3560]|0;e>>>0<a>>>0&&M();I=d+(c+4)|0;A=b[I>>2]|0;do if(0==(A&2|0)){if((g|0)==(b[3562]|0)){y=(b[3559]|0)+t|0;b[3559]=y;b[3562]=p;b[p+4>>2]=y|1;if((p|0)!=(b[3561]|0))return;b[3561]=0;b[3558]=0;return}if((g|0)==(b[3561]|0)){y=(b[3558]|0)+t|0;b[3558]=y;b[3561]=p;b[p+4>>2]=y|1;b[p+y>>2]=y;return}y=(A&-8)+t|0;z=A>>>3;a:do if(256>A>>>0)f=b[d+(c+8)>>2]|0,B=b[d+(c+12)>>2]|0,h=14264+(z<<1<<2)|0,(f|0)!=(h|0)&&(f>>>0<a>>>0&&M(),(b[f+12>>2]|0)!=(g|0)&&M()),(B|0)==(f|0)?b[3556]&=~(1<<z):((B|0)==
(h|0)?N=B+8|0:(B>>>0<a>>>0&&M(),m=B+8|0,(b[m>>2]|0)==(g|0)?N=m:M()),b[f+12>>2]=B,b[N>>2]=f);else{h=e;m=b[d+(c+24)>>2]|0;r=b[d+(c+12)>>2]|0;do if((r|0)==(h|0)){k=d+(c+20)|0;w=b[k>>2]|0;if(0==(w|0))if(x=d+(c+16)|0,k=b[x>>2]|0,0==(k|0)){D=0;break}else f=k,n=x;else f=w,n=k;for(;;)if(k=f+20|0,w=b[k>>2]|0,0!=(w|0))f=w,n=k;else if(k=f+16|0,w=b[k>>2]|0,0==(w|0))break;else f=w,n=k;n>>>0<a>>>0?M():(b[n>>2]=0,D=f)}else k=b[d+(c+8)>>2]|0,k>>>0<a>>>0&&M(),w=k+12|0,(b[w>>2]|0)!=(h|0)&&M(),x=r+8|0,(b[x>>2]|0)==
(h|0)?(b[w>>2]=r,b[x>>2]=k,D=r):M();while(0);if(0!=(m|0)){r=d+(c+28)|0;f=14528+(b[r>>2]<<2)|0;do if((h|0)==(b[f>>2]|0)){if(b[f>>2]=D,0==(D|0)){b[3557]&=~(1<<b[r>>2]);break a}}else if(m>>>0<(b[3560]|0)>>>0&&M(),B=m+16|0,(b[B>>2]|0)==(h|0)?b[B>>2]=D:b[m+20>>2]=D,0==(D|0))break a;while(0);D>>>0<(b[3560]|0)>>>0&&M();b[D+24>>2]=m;h=b[d+(c+16)>>2]|0;0!=(h|0)&&(h>>>0<(b[3560]|0)>>>0?M():(b[D+16>>2]=h,b[h+24>>2]=D));h=b[d+(c+20)>>2]|0;0!=(h|0)&&(h>>>0<(b[3560]|0)>>>0?M():(b[D+20>>2]=h,b[h+24>>2]=D))}}while(0);
b[p+4>>2]=y|1;b[p+y>>2]=y;if((p|0)!=(b[3561]|0))h=y;else{b[3558]=y;return}}else b[I>>2]=A&-2,b[p+4>>2]=t|1,h=b[p+t>>2]=t;while(0);t=h>>>3;if(256>h>>>0)A=t<<1,I=14264+(A<<2)|0,D=b[3556]|0,c=1<<t,0==(D&c|0)?(b[3556]=D|c,G=I,P=14264+(A+2<<2)|0):(t=14264+(A+2<<2)|0,d=b[t>>2]|0,d>>>0>=(b[3560]|0)>>>0?(G=d,P=t):M()),b[P>>2]=p,b[G+12>>2]=p,b[p+8>>2]=G,b[p+12>>2]=I;else if(I=p,G=h>>>8,0==(G|0)?d=0:16777215<h>>>0?d=31:(P=(G+1048320|0)>>>16&8,A=G<<P,c=(A+520192|0)>>>16&4,D=A<<c,A=(D+245760|0)>>>16&2,t=14-(c|
P|A)+(D<<A>>>15)|0,d=h>>>((t+7|0)>>>0)&1|t<<1),G=14528+(d<<2)|0,b[p+28>>2]=d,b[p+20>>2]=0,b[p+16>>2]=0,t=b[3557]|0,A=1<<d,0==(t&A|0))b[3557]=t|A,b[G>>2]=I,b[p+24>>2]=G,b[p+12>>2]=p,b[p+8>>2]=p;else{d=h<<(31==(d|0)?0:25-(d>>>1)|0);for(e=b[G>>2]|0;(b[e+4>>2]&-8|0)!=(h|0);)if(J=e+16+(d>>>31<<2)|0,G=b[J>>2]|0,0==(G|0)){R=2991;break}else d<<=1,e=G;2991==(R|0)?(J>>>0<(b[3560]|0)>>>0&&M(),b[J>>2]=I,b[p+24>>2]=e,b[p+12>>2]=p,b[p+8>>2]=p):(J=e+8|0,R=b[J>>2]|0,d=b[3560]|0,e>>>0<d>>>0&&M(),R>>>0<d>>>0&&M(),
b[R+12>>2]=I,b[J>>2]=I,b[p+8>>2]=R,b[p+12>>2]=e,b[p+24>>2]=0)}}function Fa(a,c,d){a|=0;c|=0;d|=0;var e=0,e=a|0;if((a&3)==(c&3)){for(;a&3;){if(0==(d|0))return e|0;C[a]=C[c]|0;a=a+1|0;c=c+1|0;d=d-1|0}for(;4<=(d|0);)b[a>>2]=b[c>>2],a=a+4|0,c=c+4|0,d=d-4|0}for(;0<(d|0);)C[a]=C[c]|0,a=a+1|0,c=c+1|0,d=d-1|0;return e|0}function pb(b,a,c){b|=0;a|=0;c|=0;if((a|0)<(b|0)&(b|0)<(a+c|0))for(a=a+c|0,b=b+c|0;0<(c|0);)b=b-1|0,a=a-1|0,c=c-1|0,C[b]=C[a]|0;else Fa(b,a,c)|0}function wa(a,c,d){a|=0;c|=0;d|=0;var e=0,
f=0,g=0,e=a+d|0;if(20<=(d|0)){c&=255;d=a&3;f=c|c<<8|c<<16|c<<24;g=e&-4;if(d)for(d=a+4-d|0;(a|0)<(d|0);)C[a]=c,a=a+1|0;for(;(a|0)<(g|0);)b[a>>2]=f,a=a+4|0}for(;(a|0)<(e|0);)C[a]=c,a=a+1|0}function rb(b,a,c,d,e,f,g,h,n,l,p,m,u){Ba(0)}function sb(b,a,c,d,e,f){Ba(1)}function Na(b){Ba(2)}function Oc(){Ba(3)}function Ga(b,a,c){Ba(4);return 0}function Va(b){Ba(5);return 0}function yb(b,a,c){Ba(6)}function tb(b,a,c,d,e,f,g,h,n,l,p,m,u,t,w,x,C,z,B,A){Ba(7);return 0}function ub(b,a,c,d,e,f,g,h,n,l,p,m,u,t,
w){Ba(8)}function Pc(b,a){Ba(9);return 0}function zb(b,a,c,d){Ba(10)}"use asm";var C=new a.Int8Array(d),mb=new a.Int16Array(d),b=new a.Int32Array(d),Rc=new a.Uint8Array(d);new a.Uint16Array(d);new a.Uint32Array(d);var e=new a.Float32Array(d);new a.Float64Array(d);var f=c.STACKTOP|0,db=c.tempDoublePtr|0,Oa=c._stderr|0,Qc=0,ib=a.Math.floor,Eb=a.Math.abs,Wa=a.Math.sqrt,Uc=a.Math.pow,Sc=a.Math.acos,vb=a.Math.exp,ab=a.Math.log,ta=a.Math.imul,Ba=c.abort,M=c._abort,sa=c._fprintf,Wc=c._fputc,Tc=c._exit,kb=
c._sysconf,Ya=c._llvm_stackrestore,eb=c._sbrk,Xa=c._llvm_stacksave,Ub=c.___errno_location,lb=c._time,wb=[rb,rb,w,rb,I,rb,rb,rb],xb=[sb,sb,R,sb,fa,sb,sb,sb],Tb=[Na,Na,lc,Na,zc,Na,Fc,Na,gc,Na,Na,Na,Na,Na,Na,Na],Xc=[Oc,Oc],Ta=[Ga,Ga,Lc,Ga,mc,Ga,Bc,Ga,Kc,Ga,pc,Ga,hc,Ga,qc,Ga,dc,Ga,Jc,Ga,Hc,Ga,Mc,Ga,Ga,Ga,Ga,Ga,Ga,Ga,Ga,Ga],Sb=[Va,Va,kc,Va,Dc,Va,xc,Va,ec,Va,Va,Va,Va,Va,Va,Va],Qb=[yb,yb,sc,yb,wc,yb,uc,yb],jc=[tb,tb,ac,tb,Yb,tb,tb,tb],oc=[ub,ub,bc,ub,$b,ub,ub,ub],Yc=[Pc,Pc],Pb=[zb,zb,tc,zb,vc,zb,rc,zb];
return{_strlen:function(b){b|=0;for(var a=0,a=b;C[a]|0;)a=a+1|0;return a-b|0},_speex_bits_destroy:function(a){a|=0;0!=(b[a+16>>2]|0)&&V(b[a>>2]|0)},_speex_bits_set_bit_buffer:function(a,c,d){a|=0;d|=0;b[a>>2]=c|0;b[a+24>>2]=d;b[a+16>>2]=0;b[a+4>>2]=d<<3;b[a+8>>2]=0;b[a+12>>2]=0;b[a+20>>2]=0},_speex_bits_write:function(a,c,d){a|=0;c|=0;d|=0;var e=0,f=0,h=0,l=0,k=0,n=0,e=a+12|0,f=b[e>>2]|0,h=a+8|0,l=b[h>>2]|0,k=a+4|0,n=b[k>>2]|0;if(0!=(f|0)&&(g(a,0,1),0!=(b[e>>2]|0))){do g(a,1,1);while(0!=(b[e>>2]|
0))}b[e>>2]=f;b[h>>2]=l;b[k>>2]=n;k=n+7>>3;n=(k|0)<(d|0)?k:d;if(0>=(n|0))return n|0;d=a|0;a=0;do C[c+a|0]=C[(b[d>>2]|0)+a|0]|0,a=a+1|0;while((a|0)<(n|0));return n|0},_nb_decoder_ctl:qc,_pvalloc:function(a){a|=0;var c=0;if(0==(b[3548]|0))if(c=kb(30)|0,0==(c-1&c|0))b[3550]=c,b[3549]=c,b[3551]=-1,b[3552]=-1,b[3553]=0,b[3667]=0,b[3548]=(lb(0)|0)&-16^1431655768;else return M(),0;c=b[3549]|0;return Gb(c,a-1+c&-c)|0},_nb_decoder_destroy:lc,_sb_encode:Bc,_lsp_enforce_margin:gb,_pitch_xcorr:function(b,a,c,
d,f,g){b|=0;a|=0;c|=0;f|=0;var h=0,k=0,n=0,l=0,p=0,m=n=0;if(!(0>=(f|0)))if(g=(d|0)>>2,d=f-1|0,0==(g|0)){h=0;do e[c+(d-h<<2)>>2]=0,h=h+1|0;while((h|0)<(f|0))}else{k=0;do{h=a+(k<<2)|0;n=g;l=0;for(p=b;n=n-1|0,m=l+(+e[p>>2]*+e[h>>2]+0+ +e[p+4>>2]*+e[h+4>>2]+ +e[p+8>>2]*+e[h+8>>2]+ +e[p+12>>2]*+e[h+12>>2]),0!=(n|0);)h=h+16|0,l=m,p=p+16|0;e[c+(d-k<<2)>>2]=m;k=k+1|0}while((k|0)<(f|0))}},_compute_rms16:Qa,_speex_bits_write_whole_bytes:function(a,c,d){a|=0;c|=0;d|=0;var e=0,f=0,g=0,h=0,e=a+4|0,f=b[e>>2]>>
3,g=(f|0)<(d|0)?f:d;d=a|0;if(0<(g|0)){f=0;do C[c+f|0]=C[(b[d>>2]|0)+f|0]|0,f=f+1|0;while((f|0)<(g|0))}f=b[d>>2]|0;h=0<(b[a+12>>2]|0)?C[f+g|0]|0:0;C[f]=h;b[a+8>>2]=0;b[e>>2]&=7;return g|0},_vbr_init:fc,_memcpy:Fa,_speex_bits_unpack_unsigned:h,_lsp_quant_high:vc,_malloc_trim:function(a){a|=0;var c=0,d=0,e=0,f=0,g=0,h=0,k=d=0,n=0,c=f=0;if(0==(b[3548]|0))if(c=kb(30)|0,0==(c-1&c|0))b[3550]=c,b[3549]=c,b[3551]=-1,b[3552]=-1,b[3553]=0,b[3667]=0,b[3548]=(lb(0)|0)&-16^1431655768;else return M(),0;if(4294967232<=
a>>>0)return 0;c=b[3562]|0;if(0==(c|0))return 0;e=b[3559]|0;do if(e>>>0>(a+40|0)>>>0){f=b[3550]|0;g=ta((((-41-a+e+f|0)>>>0)/(f>>>0)|0)-1|0,f)|0;h=c;for(d=14672;;){k=b[d>>2]|0;if(k>>>0<=h>>>0&&(k+(b[d+4>>2]|0)|0)>>>0>h>>>0){n=d;break}k=b[d+8>>2]|0;if(0==(k|0)){n=0;break}else d=k}if(0==(b[n+12>>2]&8|0)&&(d=eb(0)|0,h=n+4|0,(d|0)==((b[n>>2]|0)+(b[h>>2]|0)|0)&&(k=eb(-(2147483646<g>>>0?-2147483648-f|0:g)|0)|0,f=eb(0)|0,-1!=(k|0)&f>>>0<d>>>0&&(k=d-f|0,(d|0)!=(f|0)))))return b[h>>2]=(b[h>>2]|0)-k,b[3664]=
(b[3664]|0)-k,h=b[3562]|0,f=(b[3559]|0)-k|0,k=h,d=h+8|0,c=0==(d&7|0)?0:-d&7,d=f-c|0,b[3562]=k+c,b[3559]=d,b[k+(c+4)>>2]=d|1,b[k+(f+4)>>2]=40,b[3563]=b[3552],d=1,d|0}while(0);if((b[3559]|0)>>>0<=(b[3563]|0)>>>0)return 0;b[3563]=-1;return 0},_speex_decode_int:function(a,c,d){a|=0;c|=0;d|=0;var g=0,h=0,q=0,l=0,k=h=l=0,g=f;f=f+2568|0;h=g|0;q=g+8|0;l=a;Ta[b[(b[l>>2]|0)+48>>2]&31](a,3,h)|0;l=Ta[b[(b[l>>2]|0)+40>>2]&31](a,c,q)|0;c=b[h>>2]|0;if(0<(c|0))h=0;else return f=g,l|0;do k=+e[q+(h<<2)>>2],mb[d+(h<<
1)>>1]=32767<k?32767:-32768>k?-32768:~~+ib(k+0.5),h=h+1|0;while((h|0)<(c|0));f=g;return l|0},_speex_bits_reset:function(a){a|=0;C[b[a>>2]|0]=0;b[a+4>>2]=0;b[a+8>>2]=0;b[a+12>>2]=0;b[a+20>>2]=0},_lsp_unquant_high:wc,_speex_bits_unpack_signed:function(a,c){a|=0;c|=0;var d=0,e=0,f=0,g=0,h=0,k=0,n=0,l=0,p=0,m=0,u=0,t=p=0,u=m=m=0,d=a+8|0,e=b[d>>2]|0,f=a+12|0,g=b[f>>2]|0,h=a+20|0;do if((g+c+(e<<3)|0)>(b[a+4>>2]|0))b[h>>2]=1,k=0;else if(0!=(b[h>>2]|0)|0==(c|0))k=0;else for(n=b[a>>2]|0,l=c,p=0,m=e,u=g;;)if(p=
(C[n+m|0]|0)>>>((7-u|0)>>>0)&1|p<<1,t=u+1|0,b[f>>2]=t,8==(t|0)?(b[f>>2]=0,m=m+1|0,b[d>>2]=m,u=0):u=t,t=l-1|0,0==(t|0)){k=p;break}else l=t;while(0);return 0==(k>>>((c-1|0)>>>0)|0)?k|0:k|-1<<c|0},_malloc_usable_size:function(a){a|=0;var c=0,d=c=0;0==(a|0)?c=0:(c=b[a-4>>2]|0,d=c&3,c=1==(d|0)?0:(c&-8)-(0==(d|0)?8:4)|0);return c|0},_lsp_quant_nb:rc,_bw_lpc:pa,_wb_mode_query:dc,_sb_encoder_init:xc,_lsp_interpolate:hb,_sb_decode_lost:Rb,_free:V,_speex_bits_pack:g,_sb_decode:Hc,_speex_bits_insert_terminator:function(a){a|=
0;var c=0,c=a+12|0;if(0!=(b[c>>2]|0)&&(g(a,0,1),0!=(b[c>>2]|0))){do g(a,1,1);while(0!=(b[c>>2]|0))}},_memalign:Gb,_speex_bits_rewind:function(a){a|=0;b[a+8>>2]=0;b[a+12>>2]=0;b[a+20>>2]=0},_speex_std_mode_request_handler:function(a,c,d){d|=0;var e=0;c=f;f=f+8|0;e=c|0;b[e>>2]=h(a|0,4)|0;ea(d,6,e)|0;f=c;return 0},__speex_fatal:qb,_speex_stereo_state_init:function(){var a=0,a=aa(24,1)|0;e[a>>2]=1;e[a+4>>2]=0.5;e[a+8>>2]=1;e[a+12>>2]=1;b[a+16>>2]=0;b[a+20>>2]=0;return a|0},_independent_calloc:function(a,
c,d){var e=0,g=0,e=f;f=f+8|0;g=e|0;b[g>>2]=c|0;c=Vb(a|0,g,3,d|0)|0;f=e;return c|0},_lpc_to_lsp:Db,_lsp_to_lpc:fb,_speex_encode:function(a,c,d){a|=0;return Ta[b[(b[a>>2]|0)+28>>2]&31](a,c|0,d|0)|0},_speex_bits_remaining:x,_speex_std_enh_request_handler:function(a,c,d){d|=0;var e=0;c=f;f=f+8|0;e=c|0;b[e>>2]=h(a|0,1)|0;Ea(d,0,e)|0;f=c;return 0},_speex_bits_peek_unsigned:function(a,c){a|=0;c|=0;var d=0,e=0,f=0,g=0,h=0,k=0,n=e=0,d=b[a+8>>2]|0,e=b[a+12>>2]|0,f=a+20|0;if((e+c+(d<<3)|0)>(b[a+4>>2]|0))return b[f>>
2]=1,0;if(0!=(b[f>>2]|0))return 0;f=b[a>>2]|0;if(0==(c|0))return 0;h=c;k=0;for(n=d;;)if(d=(C[f+n|0]|0)>>>((7-e|0)>>>0)&1|k<<1,e=e+1|0,c=8==(e|0),a=h-1|0,0==(a|0)){g=d;break}else h=a,k=d,e=c?0:e,n=(c&1)+n|0;return g|0},_inner_prod:Ha,_speex_std_vbr_quality_request_handler:function(a,b,c){c|=0;var d=0;b=f;f=f+8|0;d=b|0;e[d>>2]=+((h(a|0,4)|0)>>>0>>>0);ea(c,14,d)|0;f=b;return 0},_speex_bits_nbytes:function(a){return(b[(a|0)+4>>2]|0)+7>>3|0},_speex_encoder_ctl:ea,_vbr_destroy:function(a){},_forced_pitch_quant:ac,
_speex_encoder_init:yc,_speex_decode_stereo_int:function(a,b,c){a|=0;b|=0;c|=0;var d=0,f=0,g=0,h=0,k=0,n=0,d=+e[c>>2],f=1/+Wa(+e[c+4>>2]*(d+1));if(!(0>=(b|0))){g=c+8|0;h=f*+Wa(d)*0.019999999552965164;k=c+12|0;d=0.019999999552965164*f;c=b;do c=c-1|0,b=mb[a+(c<<1)>>1]|0,f=h+0.9800000190734863*+e[g>>2],e[g>>2]=f,e[k>>2]=d+0.9800000190734863*+e[k>>2],n=+(b<<16>>16|0),b=c<<1,mb[a+(b<<1)>>1]=~~(n*f),mb[a+((b|1)<<1)>>1]=~~(n*+e[k>>2]);while(0<(c|0))}},_vbr_analysis:ic,_speex_lib_ctl:function(a,c){a|=0;c|=
0;var d=0,e=0,d=f;switch(a|0){case 7:b[c>>2]=14216;e=0;break;case 1:b[c>>2]=1;e=0;break;case 3:b[c>>2]=1;e=0;break;case 9:b[c>>2]=13544;e=0;break;case 5:b[c>>2]=16;e=0;break;default:sa(b[Oa>>2]|0,13192,(c=f,f=f+16|0,b[c>>2]=13320,b[c+8>>2]=a,c)|0)|0,f=c,e=-1}f=d;return e|0},_speex_std_low_mode_request_handler:function(a,c,d){d|=0;var e=0;c=f;f=f+8|0;e=c|0;b[e>>2]=h(a|0,4)|0;ea(d,8,e)|0;f=c;return 0},_vq_nbest:Hb,_lsp_quant_lbr:tc,_sb_decoder_destroy:Fc,__spx_lpc:Mb,_speex_packet_to_header:function(a,
c){a|=0;c|=0;for(var d=0,e=0,g=0,h=0,d=f,e=0;!(8<=(e|0));)if((C[a+e|0]|0)==(C[14056+e|0]|0))e=e+1|0;else{g=1893;break}if(1893==(g|0))return g=b[Oa>>2]|0,sa(g|0,12920,(h=f,f=f+8|0,b[h>>2]=13440,h)|0)|0,f=h,f=d,0;if(80>(c|0))return c=b[Oa>>2]|0,sa(c|0,12920,(h=f,f=f+8|0,b[h>>2]=13264,h)|0)|0,f=h,f=d,0;g=c=aa(80,1)|0;Fa(c|0,a|0,80)|0;a=c+48|0;if(2<(b[c+40>>2]|0)>>>0)return e=b[Oa>>2]|0,sa(e|0,12920,(h=f,f=f+8|0,b[h>>2]=13104,h)|0)|0,f=h,V(c),f=d,0;c=b[a>>2]|0;if(2<(c|0))return b[a>>2]=2,f=d,g|0;if(1<=
(c|0))return f=d,g|0;b[a>>2]=1;f=d;return g|0},_split_cb_shape_sign_unquant:R,_speex_bits_peek:l,_signal_mul:ra,_residue_percep_zero16:Wb,_pitch_search_3tap:Yb,_sb_encoder_ctl:Jc,_scal_quant:ob,_highpass:za,_speex_encode_int:function(a,c,d){a|=0;c|=0;d|=0;var g=0,h=0,q=0,l=0,k=0,g=f;f=f+2568|0;h=g|0;q=g+8|0;l=a;Ta[b[(b[l>>2]|0)+44>>2]&31](a,3,h)|0;k=b[h>>2]|0;if(0<(k|0)){h=0;do e[q+(h<<2)>>2]=+(mb[c+(h<<1)>>1]|0),h=h+1|0;while((h|0)<(k|0))}k=Ta[b[(b[l>>2]|0)+28>>2]&31](a,q,d)|0;f=g;return k|0},_compute_weighted_codebook:N,
_noise_codebook_quant:I,_independent_comalloc:function(a,b,c){return Vb(a|0,b|0,0,c|0)|0},_speex_mode_query:cc,_ialloc:Vb,_split_cb_search_shape_sign:w,_nb_decode:mc,_speex_lib_get_mode:function(a){a|=0;var c=0;if(2<a>>>0)return 0;c=b[1336+(a<<2)>>2]|0;return c|0},_speex_decoder_init:Ec,_sb_decoder_ctl:Kc,_memset:wa,_speex_bits_advance:p,_speex_stereo_state_destroy:function(a){V(a|0)},_nb_encoder_ctl:pc,_speex_default_user_handler:Mc,_filter_mem16:$a,_nb_mode_query:Lc,_internal_memalign:Nc,_speex_header_free:function(a){V(a|
0)},_mallopt:function(a,c){a|=0;c|=0;var d=0,d=0;if(0==(b[3548]|0))if(d=kb(30)|0,0==(d-1&d|0))b[3550]=d,b[3549]=d,b[3551]=-1,b[3552]=-1,b[3553]=0,b[3667]=0,b[3548]=(lb(0)|0)&-16^1431655768;else return M(),0;if(-3==(a|0))b[3551]=c,d=1;else if(-1==(a|0))b[3552]=c,d=1;else if(-2==(a|0)){if((b[3549]|0)>>>0>c>>>0||0!=(c-1&c|0))return 0;b[3550]=c;d=1}else d=0;return d|0},_speex_encode_stereo:function(a,b,c){a|=0;b|=0;c|=0;var d=0,f=0,h=0,l=0,k=0,n=0,n=l=d=n=k=0;if(0<(b|0)){l=h=f=d=0;do k=l<<1,n=+e[a+(k<<
2)>>2],d+=n*n,k=+e[a+((k|1)<<2)>>2],f+=k*k,n=0.5*(n+k),e[a+(l<<2)>>2]=n,h+=n*n,l=l+1|0;while((l|0)<(b|0));d+=1;l=f;n=h}else d=1,n=l=0;g(c,14,5);g(c,9,4);h=4*+ab(d/(l+1));0<h?g(c,0,1):g(c,1,1);f=+ib(+Eb(+h)+0.5);g(c,30<f?31:~~f,5);g(c,ob(n/(d+l),10688,4)|0,2)},_speex_std_stereo_request_handler:function(a,b,c){a|=0;c|=0;b=0==(h(a,1)|0);e[c>>2]=+vb((b?0.25:-0.25)*+((h(a,5)|0)>>>0>>>0));e[c+4>>2]=+e[10704+((h(a,2)|0)<<2)>>2];return 0},_speex_decode:function(a,c,d){a|=0;return Ta[b[(b[a>>2]|0)+40>>2]&
31](a,c|0,d|0)|0},_lsp_unquant_lbr:uc,_fir_mem16:Bb,_syn_percep_zero16:nb,_noise_codebook_unquant:fa,_nb_encoder_init:ec,_speex_decode_native:Ic,__spx_autocorr:Nb,_malloc:jb,_malloc_max_footprint:function(){return b[3665]|0},_speex_std_char_handler:function(a,b,c){c|=0;Wc((h(a|0,8)|0)&255|0,c|0)|0;return 0},_speex_bits_read_from:function(a,c,d){a|=0;c|=0;d|=0;var e=0,g=0,h=0,l=0,k=h=0,n=0,g=0,e=f,g=a+24|0;(b[g>>2]|0)<(d|0)?(h=b[Oa>>2]|0,sa(h|0,12744,(l=f,f=f+8|0,b[l>>2]=14152,l)|0)|0,f=l,0==(b[a+
16>>2]|0)?(sa(h|0,12864,(l=f,f=f+8|0,b[l>>2]=13712,l)|0)|0,f=l,h=b[g>>2]|0):(k=a|0,n=Ab(b[k>>2]|0,d)|0,0==(n|0)?(g=b[g>>2]|0,sa(h|0,12864,(l=f,f=f+8|0,b[l>>2]=14104,l)|0)|0,f=l,h=g):(b[g>>2]=d,b[k>>2]=n,h=d))):h=d;if(!(0>=(h|0))){d=a|0;g=0;do C[(b[d>>2]|0)+g|0]=C[c+g|0]|0,g=g+1|0;while((g|0)<(h|0))}b[(a+4|0)>>2]=h<<3;b[(a+8|0)>>2]=0;b[(a+12|0)>>2]=0;b[(a+20|0)>>2]=0;f=e},_valloc:function(a){a|=0;var c=0,c=c=0;if(0!=(b[3548]|0))return c=b[3549]|0,c=Gb(c,a)|0,c|0;c=kb(30)|0;if(0!=(c-1&c|0))return M(),
0;b[3550]=c;b[3549]=c;b[3551]=-1;b[3552]=-1;b[3553]=0;b[3667]=0;b[3548]=(lb(0)|0)&-16^1431655768;c=b[3549]|0;c=Gb(c,a)|0;return c|0},_malloc_footprint:function(){return b[3664]|0},_speex_decoder_destroy:Gc,_multicomb:Lb,_qmf_synth:Cb,_scal_quant32:function(a,b,c){a=+a;b|=0;var d=0,f=0,g=0,f=0,d=(c|0)-1|0;a:do if(0<(d|0))for(c=b,f=0;;){if(+e[c>>2]>=a){g=f;break a}f=f+1|0;if((f|0)<(d|0))c=c+4|0;else{g=f;break}}else g=0;while(0);return g|0},_signal_div:La,_speex_bits_init_buffer:function(a,c,d){a|=0;
c|=0;b[a>>2]=c;b[a+24>>2]=d|0;b[a+16>>2]=0;C[c]=0;b[a+4>>2]=0;b[a+8>>2]=0;b[a+12>>2]=0;b[a+20>>2]=0},_lsp_unquant_nb:sc,_calloc:aa,_forced_pitch_unquant:bc,_split_cb_search_shape_sign_N1:P,_qmf_decomp:Xb,_speex_stereo_state_reset:function(a){a|=0;e[a>>2]=1;e[a+4>>2]=0.5;e[a+8>>2]=1;e[a+12>>2]=1;b[a+16>>2]=0;b[a+20>>2]=0},_sb_encoder_destroy:zc,_nb_decoder_init:kc,_mallinfo:function(a){a|=0;var c=0,d=c=0,e=0,f=0,g=0,h=0,k=0,n=h=d=0,l=0,p=0,m=g=0,u=0,t=l=n=0,w=p=f=k=e=u=0,n=l=t=0;0==(b[3548]|0)&&(c=
kb(30)|0,0==(c-1&c|0)?(b[3550]=c,b[3549]=c,b[3551]=-1,b[3552]=-1,b[3553]=0,b[3667]=0,b[3548]=(lb(0)|0)&-16^1431655768):M());c=b[3562]|0;if(0==(c|0))k=h=g=f=e=d=c=0;else{d=b[3559]|0;h=d+40|0;n=1;p=l=h;for(h=14672;;){g=b[h>>2]|0;m=g+8|0;u=0==(m&7|0)?0:-m&7;m=g+(b[h+4>>2]|0)|0;t=p;for(u=g+u|0;;){if(u>>>0>=m>>>0|(u|0)==(c|0)){e=n;k=l;f=t;break}p=b[u+4>>2]|0;if(7==(p|0)){e=n;k=l;f=t;break}w=p&-8;t=w+t|0;1==(p&3|0)&&(l=w+l|0,n=n+1|0);p=u+w|0;if(p>>>0<g>>>0){e=n;k=l;f=t;break}else u=p}u=b[h+8>>2]|0;if(0==
(u|0))break;else n=e,l=k,p=f,h=u}h=b[3664]|0;c=d;d=f;f=h-f|0;g=b[3665]|0;h=h-k|0}b[a>>2]=d;b[a+4>>2]=e;e=a+8|0;b[e>>2]=0;b[e+4>>2]=0;b[a+16>>2]=f;b[a+20>>2]=g;b[a+24>>2]=0;b[a+28>>2]=h;b[a+32>>2]=k;b[a+36>>2]=c},_speex_std_high_mode_request_handler:function(a,c,d){d|=0;var e=0;c=f;f=f+8|0;e=c|0;b[e>>2]=h(a|0,4)|0;ea(d,10,e)|0;f=c;return 0},_malloc_stats:function(){var a=0,c=0,d=0,e=0,g=0,h=0,l=0,k=0,n=0,p=0,r=0,m=0,u=m=k=0,t=0,w=0,k=0,a=f;0==(b[3548]|0)&&(c=kb(30)|0,0==(c-1&c|0)?(b[3550]=c,b[3549]=
c,b[3551]=-1,b[3552]=-1,b[3553]=0,b[3667]=0,b[3548]=(lb(0)|0)&-16^1431655768):M());c=b[3562]|0;if(0==(c|0))g=e=d=0;else for(h=b[3665]|0,l=b[3664]|0,k=l-40-(b[3559]|0)|0,n=14672;;){p=b[n>>2]|0;r=p+8|0;m=0==(r&7|0)?0:-r&7;r=p+(b[n+4>>2]|0)|0;for(m=p+m|0;;){if(m>>>0>=r>>>0|(m|0)==(c|0)){u=k;break}t=b[m+4>>2]|0;if(7==(t|0)){u=k;break}w=t&-8;k=k-(1==(t&3|0)?w:0)|0;t=m+w|0;if(t>>>0<p>>>0){u=k;break}else m=t}m=b[n+8>>2]|0;if(0==(m|0)){d=u;e=l;g=h;break}else k=u,n=m}n=b[Oa>>2]|0;sa(n|0,13872,(u=f,f=f+8|0,
b[u>>2]=g,u)|0)|0;f=u;sa(n|0,13920,(u=f,f=f+8|0,b[u>>2]=e,u)|0)|0;f=u;sa(n|0,13608,(u=f,f=f+8|0,b[u>>2]=d,u)|0)|0;f=u;f=a},_speex_header_to_packet:function(a,c){a|=0;c|=0;var d=0,d=aa(80,1)|0;Fa(d|0,a|0,80)|0;b[c>>2]=80;return d|0},_speex_init_header:function(a,c,d,e){a|=0;c|=0;d|=0;e|=0;var g=0,h=0,h=0,g=f;C[a|0]=83;C[a+1|0]=112;C[a+2|0]=101;C[a+3|0]=101;C[a+4|0]=120;C[a+5|0]=32;C[a+6|0]=32;C[a+7|0]=32;C[a+8|0]=49;C[a+9|0]=46;C[a+10|0]=50;C[a+11|0]=114;C[a+12|0]=99;C[a+13|0]=49;wa(a+14|0,0,14);b[a+
28>>2]=1;b[a+32>>2]=80;b[a+36>>2]=c;c=e+12|0;b[a+40>>2]=b[c>>2];b[a+44>>2]=b[e+16>>2];0<=(b[c>>2]|0)||(sa(b[Oa>>2]|0,12848,(c=f,f=f+8|0,b[c>>2]=13672,c)|0)|0,f=c);b[(a+48|0)>>2]=d;b[(a+52|0)>>2]=-1;h=a+56|0;cc(e,0,h);h=a+60|0;wa(h|0,0,20);f=g},_sb_decoder_init:Dc,_speex_encode_native:Cc,_speex_inband_handler:nc,_realloc:Ab,_nb_encode:hc,_speex_bits_init:function(a){a|=0;var c=0,c=aa(2E3,1)|0;b[a>>2]=c;0!=(c|0)&&(b[a+24>>2]=2E3,b[a+16>>2]=1,C[c]=0,b[a+4>>2]=0,b[a+8>>2]=0,b[a+12>>2]=0,b[a+20>>2]=0)},
_vq_nbest_sign:Ib,_sanitize_values32:va,_interp_pitch:Kb,_speex_std_vbr_request_handler:function(a,c,d){d|=0;var e=0;c=f;f=f+8|0;e=c|0;b[e>>2]=h(a|0,1)|0;ea(d,12,e)|0;f=c;return 0},_compute_impulse_response:Jb,_iir_mem16:Za,_pitch_gain_search_3tap:Zb,_nb_encoder_destroy:gc,_speex_encoder_destroy:Ac,_open_loop_nbest_pitch:Ob,_memmove:pb,_pitch_unquant_3tap:$b,_speex_decode_stereo:function(a,b,c){a|=0;b|=0;c|=0;var d=0,f=0,g=0,h=0,k=0,l=0,d=+e[c>>2],f=1/+Wa(+e[c+4>>2]*(d+1));if(!(0>=(b|0))){g=c+8|0;
h=f*+Wa(d)*0.019999999552965164;k=c+12|0;d=0.019999999552965164*f;c=b;do c=c-1|0,f=+e[a+(c<<2)>>2],l=h+0.9800000190734863*+e[g>>2],e[g>>2]=l,e[k>>2]=d+0.9800000190734863*+e[k>>2],b=c<<1,e[a+(b<<2)>>2]=f*l,e[a+((b|1)<<2)>>2]=f*+e[k>>2];while(0<(c|0))}},_speex_bits_read_whole_bytes:function(a,c,d){a|=0;c|=0;d|=0;var e=0,g=0,h=0,l=0,k=0,n=0,p=k=0,l=l=l=k=l=h=0,e=f,g=a+4|0,h=b[g>>2]|0,l=a+24|0;((h+7>>3)+d|0)>(b[l>>2]|0)?0==(b[a+16>>2]|0)?(k=b[Oa>>2]|0,sa(k|0,12864,(n=f,f=f+8|0,b[n>>2]=13712,n)|0)|0,f=
n,k=b[l>>2]|0):(k=a|0,p=d+1|0,h=Ab(b[k>>2]|0,p+(h>>3)|0)|0,0==(h|0)?(l=(b[l>>2]|0)-1-(b[g>>2]>>3)|0,k=b[Oa>>2]|0,sa(k|0,12864,(n=f,f=f+8|0,b[n>>2]=13480,n)|0)|0,f=n,k=l):(b[l>>2]=p+(b[g>>2]>>3),b[k>>2]=h,k=d)):k=d;d=a+8|0;l=b[d>>2]|0;0<(l|0)&&(n=b[a>>2]|0,pb(n|0,n+l|0,((b[g>>2]|0)+7>>3)-l|0),l=b[d>>2]|0);l=(b[g>>2]|0)-(l<<3)|0;b[g>>2]=l;b[d>>2]=0;d=l>>3;if(!(0>=(k|0))){l=a|0;a=0;do C[(b[l>>2]|0)+(a+d)|0]=C[c+a|0]|0,a=a+1|0;while((a|0)<(k|0));l=b[g>>2]|0}l=l+(k<<3)|0;b[g>>2]=l;f=e},_speex_encode_stereo_int:function(a,
b,c){a|=0;b|=0;c|=0;var d=0,e=0,f=0,h=0,k=0,l=0,p=k=0,r=0,m=0,u=0,t=0,w=0,x=0,C=0,z=0;g(c,14,5);g(c,9,4);if(0<(b|0)){h=f=e=d=0;do k=h<<1,l=+(mb[a+(k<<1)>>1]|0),f+=l*l,k=+(mb[a+((k|1)<<1)>>1]|0),d+=k*k,k=~~(0.5*(l+k)),mb[a+(h<<1)>>1]=k,k=+(k<<16>>16|0),e+=k*k,h=h+1|0;while((h|0)<(b|0));k=e;f<=d?(p=f,r=k,m=d,u=1924):(g(c,0,1),t=d,x=w=f,C=k,z=d)}else m=r=p=0,u=1924;1924==(u|0)&&(g(c,1,1),t=p,w=m,x=p,C=r,z=m);u=~~+ib(+Eb(+(4*+ab((w+1)/(t+1))))+0.5);g(c,31>(u|0)?u:31,5);g(c,ob(C/(z+(x+1)),10688,4)|0,2)},
_compute_rms:$,_speex_decoder_ctl:Ea,runPostSets:function(){},stackAlloc:function(a){var b=0,b=f;f=f+(a|0)|0;f=f+7&-8;return b|0},stackSave:function(){return f|0},stackRestore:function(a){f=a|0},setThrew:function(a,b){0==(Qc|0)&&(Qc=a|0)},setTempRet0:function(a){},setTempRet1:function(a){},setTempRet2:function(a){},setTempRet3:function(a){},setTempRet4:function(a){},setTempRet5:function(a){},setTempRet6:function(a){},setTempRet7:function(a){},setTempRet8:function(a){},setTempRet9:function(a){},dynCall_viiiiiiiiiiiii:function(a,
b,c,d,e,f,g,h,l,p,r,m,u,t){wb[(a|0)&7](b|0,c|0,d|0,e|0,f|0,g|0,h|0,l|0,p|0,r|0,m|0,u|0,t|0)},dynCall_viiiiii:function(a,b,c,d,e,f,g){xb[(a|0)&7](b|0,c|0,d|0,e|0,f|0,g|0)},dynCall_vi:function(a,b){Tb[(a|0)&15](b|0)},dynCall_v:function(a){Xc[(a|0)&1]()},dynCall_iiii:function(a,b,c,d){return Ta[(a|0)&31](b|0,c|0,d|0)|0},dynCall_ii:function(a,b){return Sb[(a|0)&15](b|0)|0},dynCall_viii:function(a,b,c,d){Qb[(a|0)&7](b|0,c|0,d|0)},dynCall_iiiiiiiiiifiiiiiiiiii:function(a,b,c,d,e,f,g,h,l,p,r,m,u,t,w,x,C,
z,B,A,y){return jc[(a|0)&7](b|0,c|0,d|0,e|0,f|0,g|0,h|0,l|0,p|0,+ +r,m|0,u|0,t|0,w|0,x|0,C|0,z|0,B|0,A|0,y|0)|0},dynCall_viiiifiiiiiiiifi:function(a,b,c,d,e,f,g,h,l,p,r,m,u,t,w,x){oc[(a|0)&7](b|0,c|0,d|0,e|0,+ +f,g|0,h|0,l|0,p|0,r|0,m|0,u|0,t|0,+ +w,x|0)},dynCall_iii:function(a,b,c){return Yc[(a|0)&1](b|0,c|0)|0},dynCall_viiii:function(a,b,c,d,e){Pb[(a|0)&7](b|0,c|0,d|0,e|0)}}}({Math:Math,Int8Array:Int8Array,Int16Array:Int16Array,Int32Array:Int32Array,Uint8Array:Uint8Array,Uint16Array:Uint16Array,
Uint32Array:Uint32Array,Float32Array:Float32Array,Float64Array:Float64Array},{abort:abort,assert:assert,asmPrintInt:asmPrintInt,asmPrintFloat:asmPrintFloat,min:Math_min,invoke_viiiiiiiiiiiii:invoke_viiiiiiiiiiiii,invoke_viiiiii:invoke_viiiiii,invoke_vi:invoke_vi,invoke_v:invoke_v,invoke_iiii:invoke_iiii,invoke_ii:invoke_ii,invoke_viii:invoke_viii,invoke_iiiiiiiiiifiiiiiiiiii:invoke_iiiiiiiiiifiiiiiiiiii,invoke_viiiifiiiiiiiifi:invoke_viiiifiiiiiiiifi,invoke_iii:invoke_iii,invoke_viiii:invoke_viiii,
_fabsf:_fabsf,_floorf:_floorf,_abort:_abort,_fprintf:_fprintf,_sqrt:_sqrt,_fflush:_fflush,__reallyNegative:__reallyNegative,_sqrtf:_sqrtf,_fputc:_fputc,_log:_log,_fabs:_fabs,_floor:_floor,___setErrNo:___setErrNo,_fwrite:_fwrite,_send:_send,_write:_write,_exit:_exit,_sysconf:_sysconf,__exit:__exit,__formatString:__formatString,_llvm_stackrestore:_llvm_stackrestore,_pwrite:_pwrite,_llvm_pow_f64:_llvm_pow_f64,_sbrk:_sbrk,_llvm_stacksave:_llvm_stacksave,___errno_location:___errno_location,_exp:_exp,_time:_time,
_acos:_acos,STACKTOP:STACKTOP,STACK_MAX:STACK_MAX,tempDoublePtr:tempDoublePtr,ABORT:ABORT,NaN:NaN,Infinity:Infinity,_stderr:_stderr},buffer),_strlen=Module._strlen=asm._strlen,_speex_bits_destroy=Module._speex_bits_destroy=asm._speex_bits_destroy,_speex_bits_set_bit_buffer=Module._speex_bits_set_bit_buffer=asm._speex_bits_set_bit_buffer,_speex_bits_write=Module._speex_bits_write=asm._speex_bits_write,_nb_decoder_ctl=Module._nb_decoder_ctl=asm._nb_decoder_ctl,_pvalloc=Module._pvalloc=asm._pvalloc,
_nb_decoder_destroy=Module._nb_decoder_destroy=asm._nb_decoder_destroy,_sb_encode=Module._sb_encode=asm._sb_encode,_lsp_enforce_margin=Module._lsp_enforce_margin=asm._lsp_enforce_margin,_pitch_xcorr=Module._pitch_xcorr=asm._pitch_xcorr,_compute_rms16=Module._compute_rms16=asm._compute_rms16,_speex_bits_write_whole_bytes=Module._speex_bits_write_whole_bytes=asm._speex_bits_write_whole_bytes,_vbr_init=Module._vbr_init=asm._vbr_init,_memcpy=Module._memcpy=asm._memcpy,_speex_bits_unpack_unsigned=Module._speex_bits_unpack_unsigned=
asm._speex_bits_unpack_unsigned,_lsp_quant_high=Module._lsp_quant_high=asm._lsp_quant_high,_malloc_trim=Module._malloc_trim=asm._malloc_trim,_speex_decode_int=Module._speex_decode_int=asm._speex_decode_int,_speex_bits_reset=Module._speex_bits_reset=asm._speex_bits_reset,_lsp_unquant_high=Module._lsp_unquant_high=asm._lsp_unquant_high,_speex_bits_unpack_signed=Module._speex_bits_unpack_signed=asm._speex_bits_unpack_signed,_malloc_usable_size=Module._malloc_usable_size=asm._malloc_usable_size,_lsp_quant_nb=
Module._lsp_quant_nb=asm._lsp_quant_nb,_bw_lpc=Module._bw_lpc=asm._bw_lpc,_wb_mode_query=Module._wb_mode_query=asm._wb_mode_query,_sb_encoder_init=Module._sb_encoder_init=asm._sb_encoder_init,_lsp_interpolate=Module._lsp_interpolate=asm._lsp_interpolate,_sb_decode_lost=Module._sb_decode_lost=asm._sb_decode_lost,_free=Module._free=asm._free,_speex_bits_pack=Module._speex_bits_pack=asm._speex_bits_pack,_sb_decode=Module._sb_decode=asm._sb_decode,_speex_bits_insert_terminator=Module._speex_bits_insert_terminator=
asm._speex_bits_insert_terminator,_memalign=Module._memalign=asm._memalign,_speex_bits_rewind=Module._speex_bits_rewind=asm._speex_bits_rewind,_speex_std_mode_request_handler=Module._speex_std_mode_request_handler=asm._speex_std_mode_request_handler,__speex_fatal=Module.__speex_fatal=asm.__speex_fatal,_speex_stereo_state_init=Module._speex_stereo_state_init=asm._speex_stereo_state_init,_independent_calloc=Module._independent_calloc=asm._independent_calloc,_lpc_to_lsp=Module._lpc_to_lsp=asm._lpc_to_lsp,
_lsp_to_lpc=Module._lsp_to_lpc=asm._lsp_to_lpc,_speex_encode=Module._speex_encode=asm._speex_encode,_speex_bits_remaining=Module._speex_bits_remaining=asm._speex_bits_remaining,_speex_std_enh_request_handler=Module._speex_std_enh_request_handler=asm._speex_std_enh_request_handler,_speex_bits_peek_unsigned=Module._speex_bits_peek_unsigned=asm._speex_bits_peek_unsigned,_inner_prod=Module._inner_prod=asm._inner_prod,_speex_std_vbr_quality_request_handler=Module._speex_std_vbr_quality_request_handler=
asm._speex_std_vbr_quality_request_handler,_speex_bits_nbytes=Module._speex_bits_nbytes=asm._speex_bits_nbytes,_speex_encoder_ctl=Module._speex_encoder_ctl=asm._speex_encoder_ctl,_vbr_destroy=Module._vbr_destroy=asm._vbr_destroy,_forced_pitch_quant=Module._forced_pitch_quant=asm._forced_pitch_quant,_speex_encoder_init=Module._speex_encoder_init=asm._speex_encoder_init,_speex_decode_stereo_int=Module._speex_decode_stereo_int=asm._speex_decode_stereo_int,_vbr_analysis=Module._vbr_analysis=asm._vbr_analysis,
_speex_lib_ctl=Module._speex_lib_ctl=asm._speex_lib_ctl,_speex_std_low_mode_request_handler=Module._speex_std_low_mode_request_handler=asm._speex_std_low_mode_request_handler,_vq_nbest=Module._vq_nbest=asm._vq_nbest,_lsp_quant_lbr=Module._lsp_quant_lbr=asm._lsp_quant_lbr,_sb_decoder_destroy=Module._sb_decoder_destroy=asm._sb_decoder_destroy,__spx_lpc=Module.__spx_lpc=asm.__spx_lpc,_speex_packet_to_header=Module._speex_packet_to_header=asm._speex_packet_to_header,_split_cb_shape_sign_unquant=Module._split_cb_shape_sign_unquant=
asm._split_cb_shape_sign_unquant,_speex_bits_peek=Module._speex_bits_peek=asm._speex_bits_peek,_signal_mul=Module._signal_mul=asm._signal_mul,_residue_percep_zero16=Module._residue_percep_zero16=asm._residue_percep_zero16,_pitch_search_3tap=Module._pitch_search_3tap=asm._pitch_search_3tap,_sb_encoder_ctl=Module._sb_encoder_ctl=asm._sb_encoder_ctl,_scal_quant=Module._scal_quant=asm._scal_quant,_highpass=Module._highpass=asm._highpass,_speex_encode_int=Module._speex_encode_int=asm._speex_encode_int,
_compute_weighted_codebook=Module._compute_weighted_codebook=asm._compute_weighted_codebook,_noise_codebook_quant=Module._noise_codebook_quant=asm._noise_codebook_quant,_independent_comalloc=Module._independent_comalloc=asm._independent_comalloc,_speex_mode_query=Module._speex_mode_query=asm._speex_mode_query,_ialloc=Module._ialloc=asm._ialloc,_split_cb_search_shape_sign=Module._split_cb_search_shape_sign=asm._split_cb_search_shape_sign,_nb_decode=Module._nb_decode=asm._nb_decode,_speex_lib_get_mode=
Module._speex_lib_get_mode=asm._speex_lib_get_mode,_speex_decoder_init=Module._speex_decoder_init=asm._speex_decoder_init,_sb_decoder_ctl=Module._sb_decoder_ctl=asm._sb_decoder_ctl,_memset=Module._memset=asm._memset,_speex_bits_advance=Module._speex_bits_advance=asm._speex_bits_advance,_speex_stereo_state_destroy=Module._speex_stereo_state_destroy=asm._speex_stereo_state_destroy,_nb_encoder_ctl=Module._nb_encoder_ctl=asm._nb_encoder_ctl,_speex_default_user_handler=Module._speex_default_user_handler=
asm._speex_default_user_handler,_filter_mem16=Module._filter_mem16=asm._filter_mem16,_nb_mode_query=Module._nb_mode_query=asm._nb_mode_query,_internal_memalign=Module._internal_memalign=asm._internal_memalign,_speex_header_free=Module._speex_header_free=asm._speex_header_free,_mallopt=Module._mallopt=asm._mallopt,_speex_encode_stereo=Module._speex_encode_stereo=asm._speex_encode_stereo,_speex_std_stereo_request_handler=Module._speex_std_stereo_request_handler=asm._speex_std_stereo_request_handler,
_speex_decode=Module._speex_decode=asm._speex_decode,_lsp_unquant_lbr=Module._lsp_unquant_lbr=asm._lsp_unquant_lbr,_fir_mem16=Module._fir_mem16=asm._fir_mem16,_syn_percep_zero16=Module._syn_percep_zero16=asm._syn_percep_zero16,_noise_codebook_unquant=Module._noise_codebook_unquant=asm._noise_codebook_unquant,_nb_encoder_init=Module._nb_encoder_init=asm._nb_encoder_init,_speex_decode_native=Module._speex_decode_native=asm._speex_decode_native,__spx_autocorr=Module.__spx_autocorr=asm.__spx_autocorr,
_malloc=Module._malloc=asm._malloc,_malloc_max_footprint=Module._malloc_max_footprint=asm._malloc_max_footprint,_speex_std_char_handler=Module._speex_std_char_handler=asm._speex_std_char_handler,_speex_bits_read_from=Module._speex_bits_read_from=asm._speex_bits_read_from,_valloc=Module._valloc=asm._valloc,_malloc_footprint=Module._malloc_footprint=asm._malloc_footprint,_speex_decoder_destroy=Module._speex_decoder_destroy=asm._speex_decoder_destroy,_multicomb=Module._multicomb=asm._multicomb,_qmf_synth=
Module._qmf_synth=asm._qmf_synth,_scal_quant32=Module._scal_quant32=asm._scal_quant32,_signal_div=Module._signal_div=asm._signal_div,_speex_bits_init_buffer=Module._speex_bits_init_buffer=asm._speex_bits_init_buffer,_lsp_unquant_nb=Module._lsp_unquant_nb=asm._lsp_unquant_nb,_calloc=Module._calloc=asm._calloc,_forced_pitch_unquant=Module._forced_pitch_unquant=asm._forced_pitch_unquant,_split_cb_search_shape_sign_N1=Module._split_cb_search_shape_sign_N1=asm._split_cb_search_shape_sign_N1,_qmf_decomp=
Module._qmf_decomp=asm._qmf_decomp,_speex_stereo_state_reset=Module._speex_stereo_state_reset=asm._speex_stereo_state_reset,_sb_encoder_destroy=Module._sb_encoder_destroy=asm._sb_encoder_destroy,_nb_decoder_init=Module._nb_decoder_init=asm._nb_decoder_init,_mallinfo=Module._mallinfo=asm._mallinfo,_speex_std_high_mode_request_handler=Module._speex_std_high_mode_request_handler=asm._speex_std_high_mode_request_handler,_malloc_stats=Module._malloc_stats=asm._malloc_stats,_speex_header_to_packet=Module._speex_header_to_packet=
asm._speex_header_to_packet,_speex_init_header=Module._speex_init_header=asm._speex_init_header,_sb_decoder_init=Module._sb_decoder_init=asm._sb_decoder_init,_speex_encode_native=Module._speex_encode_native=asm._speex_encode_native,_speex_inband_handler=Module._speex_inband_handler=asm._speex_inband_handler,_realloc=Module._realloc=asm._realloc,_nb_encode=Module._nb_encode=asm._nb_encode,_speex_bits_init=Module._speex_bits_init=asm._speex_bits_init,_vq_nbest_sign=Module._vq_nbest_sign=asm._vq_nbest_sign,
_sanitize_values32=Module._sanitize_values32=asm._sanitize_values32,_interp_pitch=Module._interp_pitch=asm._interp_pitch,_speex_std_vbr_request_handler=Module._speex_std_vbr_request_handler=asm._speex_std_vbr_request_handler,_compute_impulse_response=Module._compute_impulse_response=asm._compute_impulse_response,_iir_mem16=Module._iir_mem16=asm._iir_mem16,_pitch_gain_search_3tap=Module._pitch_gain_search_3tap=asm._pitch_gain_search_3tap,_nb_encoder_destroy=Module._nb_encoder_destroy=asm._nb_encoder_destroy,
_speex_encoder_destroy=Module._speex_encoder_destroy=asm._speex_encoder_destroy,_open_loop_nbest_pitch=Module._open_loop_nbest_pitch=asm._open_loop_nbest_pitch,_memmove=Module._memmove=asm._memmove,_pitch_unquant_3tap=Module._pitch_unquant_3tap=asm._pitch_unquant_3tap,_speex_decode_stereo=Module._speex_decode_stereo=asm._speex_decode_stereo,_speex_bits_read_whole_bytes=Module._speex_bits_read_whole_bytes=asm._speex_bits_read_whole_bytes,_speex_encode_stereo_int=Module._speex_encode_stereo_int=asm._speex_encode_stereo_int,
_compute_rms=Module._compute_rms=asm._compute_rms,_speex_decoder_ctl=Module._speex_decoder_ctl=asm._speex_decoder_ctl,runPostSets=Module.runPostSets=asm.runPostSets,dynCall_viiiiiiiiiiiii=Module.dynCall_viiiiiiiiiiiii=asm.dynCall_viiiiiiiiiiiii,dynCall_viiiiii=Module.dynCall_viiiiii=asm.dynCall_viiiiii,dynCall_vi=Module.dynCall_vi=asm.dynCall_vi,dynCall_v=Module.dynCall_v=asm.dynCall_v,dynCall_iiii=Module.dynCall_iiii=asm.dynCall_iiii,dynCall_ii=Module.dynCall_ii=asm.dynCall_ii,dynCall_viii=Module.dynCall_viii=
asm.dynCall_viii,dynCall_iiiiiiiiiifiiiiiiiiii=Module.dynCall_iiiiiiiiiifiiiiiiiiii=asm.dynCall_iiiiiiiiiifiiiiiiiiii,dynCall_viiiifiiiiiiiifi=Module.dynCall_viiiifiiiiiiiifi=asm.dynCall_viiiifiiiiiiiifi,dynCall_iii=Module.dynCall_iii=asm.dynCall_iii,dynCall_viiii=Module.dynCall_viiii=asm.dynCall_viiii;Runtime.stackAlloc=function(a){return asm.stackAlloc(a)};Runtime.stackSave=function(){return asm.stackSave()};Runtime.stackRestore=function(a){asm.stackRestore(a)};var i64Math=null;
if(memoryInitializer){var applyData=function(a){HEAPU8.set(a,STATIC_BASE)};ENVIRONMENT_IS_NODE||ENVIRONMENT_IS_SHELL?applyData(Module.readBinary(memoryInitializer)):(addRunDependency("memory initializer"),Browser.asyncLoad(memoryInitializer,function(a){applyData(a);removeRunDependency("memory initializer")},function(a){throw"could not load memory initializer "+memoryInitializer;}))}function ExitStatus(a){this.name="ExitStatus";this.message="Program terminated with exit("+a+")";this.status=a}
ExitStatus.prototype=Error();ExitStatus.prototype.constructor=ExitStatus;var initialStackTop,preloadStartTime=null,calledMain=!1,dependenciesFulfilled=function runCaller(){!Module.calledRun&&shouldRunNow&&run();Module.calledRun||(dependenciesFulfilled=runCaller)};
Module.callMain=Module.callMain=function(a){function c(){for(var a=0;3>a;a++)g.push(0)}assert(0==runDependencies,"cannot call main when async dependencies remain! (listen on __ATMAIN__)");assert(0==__ATPRERUN__.length,"cannot call main when preRun functions remain to be called");a=a||[];ENVIRONMENT_IS_WEB&&null!==preloadStartTime&&Module.printErr("preload time: "+(Date.now()-preloadStartTime)+" ms");ensureInitRuntime();var d=a.length+1,g=[allocate(intArrayFromString("/bin/this.program"),"i8",ALLOC_NORMAL)];
c();for(var h=0;h<d-1;h+=1)g.push(allocate(intArrayFromString(a[h]),"i8",ALLOC_NORMAL)),c();g.push(0);g=allocate(g,"i32",ALLOC_NORMAL);initialStackTop=STACKTOP;try{var l=Module._main(d,g,0);Module.noExitRuntime||exit(l)}catch(p){if(!(p instanceof ExitStatus))if("SimulateInfiniteLoop"==p)Module.noExitRuntime=!0;else throw p&&"object"===typeof p&&p.stack&&Module.printErr("exception thrown: "+[p,p.stack]),p;}finally{calledMain=!0}};
function run(a){function c(){ensureInitRuntime();preMain();Module.calledRun=!0;Module._main&&shouldRunNow&&Module.callMain(a);postRun()}a=a||Module.arguments;null===preloadStartTime&&(preloadStartTime=Date.now());0<runDependencies?Module.printErr("run() called, but dependencies remain, so not running"):(preRun(),0<runDependencies||(Module.setStatus?(Module.setStatus("Running..."),setTimeout(function(){setTimeout(function(){Module.setStatus("")},1);ABORT||c()},1)):c()))}Module.run=Module.run=run;
function exit(a){ABORT=!0;EXITSTATUS=a;STACKTOP=initialStackTop;exitRuntime();throw new ExitStatus(a);}Module.exit=Module.exit=exit;function abort(a){a&&(Module.print(a),Module.printErr(a));ABORT=!0;EXITSTATUS=1;throw"abort() at "+stackTrace();}Module.abort=Module.abort=abort;if(Module.preInit)for("function"==typeof Module.preInit&&(Module.preInit=[Module.preInit]);0<Module.preInit.length;)Module.preInit.pop()();var shouldRunNow=!0;Module.noInitialRun&&(shouldRunNow=!1);run();
(function(a){a.util={toString:function(c,d){var g=new (a.WebKitBlobBuilder||a.MozBlobBuilder||a.BlobBuilder);g.append(c.buffer);buffer=null;var h=new FileReader;h.onload=function(a){d(a.target.result)};h.readAsBinaryString(g.getBlob())},parseInt:function(a){return Binary.toUint8(a)},mozPlay:function(a){var d,g=0,h;if((d=new Audio).mozSetup)for(d.mozSetup(1,8E3);g<a.length;)h=800<a.length-g?800:a.length-g,d.mozWriteAudio(a.subarray(g,g+h)),g+=h},play:function(a,d){var g=PCMData.encode({sampleRate:d||
8E3,channelCount:1,bytesPerSample:2,data:a}),h=new Audio;h.src="data:audio/wav;base64,"+btoa(g);h.play()},merge:function(a,d,g,h){h=h||[];g="undefined"==typeof g?2:g;for(var l in d)d.hasOwnProperty(l)&&0>h.indexOf(l)&&("object"===typeof a[l]&&g?merge(a[l],d[l],g-1,h):(a[l]=d[l],h.push(d[l])));return a},inherit:function(a,d){function g(){}g.prototype=d.prototype;a.prototype=new g},str2ab:function(a){for(var d=new ArrayBuffer(a.length),g=new Uint8Array(d),h=0,l=a.length;h<l;h++)g[h]=a.charCodeAt(h);
return d}}})(this);
(function(a){a.libspeex=Module||s;a.libspeex.generateStructInfo=libspeex.generateStructInfo||Runtime.generateStructInfo;a.types={SPEEX_NB_MODES:3,SPEEX_SET_ENH:0,SPEEX_GET_ENH:1,SPEEX_GET_FRAME_SIZE:3,SPEEX_SET_QUALITY:4,SPEEX_GET_QUALITY:5,SPEEX_SET_VBR:12,SPEEX_GET_VBR:13,SPEEX_SET_VBR_QUALITY:14,SPEEX_GET_VBR_QUALITY:15,SPEEX_SET_COMPLEXITY:16,SPEEX_GET_COMPLEXITY:17,SPEEX_SET_SAMPLING_RATE:24,SPEEX_GET_SAMPLING_RATE:25,SPEEX_SET_VAD:30,SPEEX_GET_VAD:31,SPEEX_SET_ABR:32,SPEEX_GET_ABR:33,SPEEX_SET_DTX:34,
SPEEX_GET_DTX:35,types:{SpeexBits:libspeex.generateStructInfo([["i1*","chars"],["i32","nbBits"],["i32","charPtr"],["i32","bitPtr"],["i32","owner"],["i32","overflow"],["i32","buf_size"],["i32","reserved1"],["i8*","reserved2"]]),SpeexHeader:libspeex.generateStructInfo([["i32","speex_version_id"],["i32","header_size"],["i32","rate"],["i32","mode"],["i32","mode_bitstream_version"],["i32","nb_channels"],["i32","bitrate"],["i32","frame_size"],["i32","vbr"],["i32","frames_per_packet"],["i32","extra_headers"],
["i32","reserved1"],["i32","reserved2"]]),SpeexPreprocessState:libspeex.generateStructInfo([]),SpeexEchoState:libspeex.generateStructInfo([])}}})(this);"use strict";
(function(a){function c(a){this.bitstr=new BitString("speex_string:8/char,speex_version_string:20/char,speex_version_id/int,header_size/int,rate/int,mode/int,mode_bitstream_version/int,nb_channels/int,bitrate/int,frame_size/int,vbr/int,frames_per_packet/int,extra_headers/int,reserved1/int,reserved2/int",{bytes:!0,bigEndian:!1});"string"==typeof a?(this.raw=a,this.data=this.bitstr.unpack(a),this.data.speex_string=String.fromCharCode.apply(null,this.data.speex_string),this.data.speex_version_string=
String.fromCharCode.apply(null,this.data.speex_version_string)):(this.data=a,this.data.speex_string=new Uint8Array(d.util.str2ab(a.speex_string)),this.data.speex_version_string=new Uint8Array(d.util.str2ab(a.speex_version_string)),this.raw=this.bitstr.pack(this.data))}function d(a){!a.mode&&(a.mode=0);this.params=a;this.frame_size=320;this.ring_size=2304;this.modoffset=this.ringoffset=this.linoffset=0;this.linbuf=new Int16Array(this.frame_size);this.ring=new Int16Array(2*this.ring_size);this.modframes=
new Int16Array(this.frame_size);this.spxbuf=[];this.header=null;this.encoder=new SpeexEncoder(a);this.decoder=new SpeexDecoder(a);this.init()}"function"===typeof importScripts&&(self.console={log:function(){},debug:function(){},warn:function(){},error:function(){}});c.prototype.toString=function(){return this.raw=this.bitstr.pack(this.unpacked)};d.util=a.util;d.onerror=function(a){console.error("decoding error: ",a.message)};d.parseHeader=function(a){this.header=new c(a);return this.header.data};
d.pkt2hdr=function(a,c){var l=libspeex.allocate(libspeex.intArrayFromString(a),"i8",libspeex.ALLOC_STACK),p=c||d.onerror;if(l=libspeex._speex_packet_to_header(l,a.length)){var x=d.types.SpeexHeader,w={},P;w.speex_string=libspeex.Pointer_stringify(l);w.speex_version_string=libspeex.Pointer_stringify(l+8);for(var N in x)"__size__"!==N&&(P=28+x[N],w[N]=libspeex.getValue(l+P,"i32"));(w.mode>=d.SPEEX_NB_MODES||0>w.mode)&&p(Error("Mode number "+w.mode+" does not (yet/any longer) exist in this version"));
1<w.speex_version_id&&p(Error("Version "+w.speex_version_string+" is not supported"));return w}p(Error("cannot read header from bitstream"))};d.prototype.set=function(a,c){this.options[a]=c};d.prototype.enable=function(a){this.set(a,!0)};d.prototype.disable=function(a){this.set(a,!1)};d.prototype.init=function(){this.encoder.init();this.decoder.init()};d.prototype.close=function(){this.decoder.close()};d.prototype.encode=function(a,c){if(c)return this.encoder.process(a);for(var d=-1,p=this.ringoffset;++d<
a.length;++p)this.ring[p]=a[d];this.ringoffset+=a.length;if(!(this.ringoffset>this.linoffset&&this.ringoffset-this.linoffset<this.frame_size)){for(d=-1;++d<this.linbuf.length;)this.linbuf[d]=this.ring[this.linoffset+d];this.linoffset+=this.linbuf.length;this.spxbuf=this.encoder.process(this.linbuf);this.ringoffset>this.ring_size&&(this.modoffset=this.ringoffset%this.ring_size,this.ringoffset=0);this.linoffset>this.ring_size&&(this.linoffset=0);return this.spxbuf}};d.prototype.decode=function(a,c){var d=
void 0;c&&(d=[].concat.apply([],c));return this.decoder.process(a,d)};util.merge(d,a.types);a.Speex=d;a.SpeexHeader=c;a.SpeexComment=function(a){this.bitstr=new BitString("vendor_length:4,vendor_string:vendor_length/char,user_comment_list_length:4,user_comments:_");"string"==typeof a?(this.raw=a,this.data=this.bitstr.unpack(a),this.data.vendor_string=String.fromCharCode.apply(null,this.data.vendor_string)):(this.data=a,this.data.vendor_string=new Uint8Array(d.util.str2ab(a.vendor_string)),this.raw=
this.bitstr.pack(this.data))}})(this);function CodecProcessor(a){this.mode=libspeex._speex_lib_get_mode(a.mode||0);this.params=a;this.opt_basename="SPEEX_SET_";this.ctl_func=libspeex._speex_encoder_ctl;this.options={}}
CodecProcessor.prototype.set=function(a,c){if("undefined"!==typeof c&&null!==c){this.options[a]=c;var d=libspeex.allocate(1,"i32",ALLOC_STACK),g;c.constructor==Number.prototype.constructor&&(g=parseInt(c));c.constructor==Boolean.prototype.constructor&&(g=c?1:0);setValue(d,g||0,"i32");flag=this.opt_basename+a.toUpperCase().replace(" ","_");console.log("%s: %d",flag,g);this[flag]&&this.ctl_func(this.state,this[flag],d);"quality"==a&&(this.bits_size=SpeexEncoder.quality_bits[g])}};
CodecProcessor.prototype.enable=function(a){this.set(a,1)};CodecProcessor.prototype.disable=function(a){this.set(a,0)};CodecProcessor.prototype.buffer=null;CodecProcessor.prototype.input=null;CodecProcessor.prototype.output=null;CodecProcessor.prototype.state=null;CodecProcessor.prototype.bits=null;
(function(a){function c(a){CodecProcessor.apply(this,arguments);this.floating_point=!a.lpcm&&!0;this.ctl_func=libspeex._speex_decoder_ctl;this.params=a;this.enh=a.enh||1;this.frame_size=a.frame_size||160;this.bits_size=void 0!==a.bits_size?a.bits_size:SpeexEncoder.quality_bits[a.quality||8]}var d=a.util;d.inherit(c,CodecProcessor);c.prototype.init=function(){var a=libspeex.allocate(c.types.SpeexBits.__size__,"i8",libspeex.ALLOC_STACK);libspeex._speex_bits_init(a);var d=libspeex.allocate(1,"i32",libspeex.ALLOC_STACK),
l=libspeex._speex_decoder_init(this.mode);libspeex.setValue(d,this.enh,"i32");libspeex._speex_decoder_ctl(l,c.SPEEX_SET_ENH,d);libspeex.setValue(d,this.params.sample_rate,"i32");libspeex._speex_decoder_ctl(l,c.SPEEX_SET_SAMPLING_RATE,d);libspeex._speex_decoder_ctl(l,c.SPEEX_GET_FRAME_SIZE,d);this.frame_size=libspeex.getValue(d,"i32");this.state=l;this.bits=a;this.buffer=libspeex.allocate(this.frame_size,"i16",libspeex.ALLOC_NORMAL);this.output=new Float32Array(1)};c.prototype.read=function(a,c,l){var p=
this.input;c=a+c>l.length?l.length-a:c;var x=l.constructor==String.prototype.constructor;!p&&(p=libspeex.allocate(this.bits_size,"i8",libspeex.ALLOC_NORMAL));for(var w=a-1,P=0;++w<a+c;P+=1)libspeex.setValue(p+P,x?d.parseInt(l[w]):l[w],"i8");libspeex._speex_bits_read_from(this.bits,p,c);this.input=p;return c};c.prototype.process=function(a,c){var d=0,p=0,x=0,w=this.bits_size,P=Math.ceil(a.length/w),w=this.frame_size*P,P=libspeex._speex_decode_int,N=!!this.params.benchmark;this.buffer||(this.buffer=
libspeex.allocate(this.frame_size,"i16",libspeex.ALLOC_STACK));var R=this.bits,I=this.buffer,fa=this.state;this.output.length<w&&(this.output=this.floating_point?new Float32Array(w):new Int16Array(w));for(;p<a.length;){N&&console.time("decode_packet_offset_"+p);w=c&&0<c.length?c[x]:this.bits_size;w=this.read(p,w,a);ret=P(fa,R,I);if(0>ret)return ret;this.write(d,this.frame_size,I);N&&console.timeEnd("decode_packet_offset_"+p);p+=w;d+=this.frame_size;x++}return this.output.subarray(0,d)};c.prototype.close=
function(){this.state&&(libspeex._speex_bits_destroy(this.bits),libspeex._speex_decoder_destroy(this.state))};c.prototype.write=function(a,c,d){for(var p,x=0,w=a-1;++w<a+c;x+=2)p=libspeex.getValue(d+x,"i16"),this.output[w]=this.floating_point?p/32768:p};d.merge(c,a.types);a.SpeexDecoder=c})(this);
(function(a){function c(a){CodecProcessor.apply(this,arguments);this.quality=a.quality||8;this.enh=a.enh||1;this.buffer_size=a.buffer_size||200;this.floating_point=!!a.floating_point;this.frame_size=a.frame_size||160;this.bits_size=a.bits_size||c.quality_bits[this.quality]}var d=Speex.util;d.inherit(c,CodecProcessor);c.quality_bits={1:10,2:15,3:20,4:20,5:28,6:28,7:38,8:38,9:46,10:46};c.prototype.init=function(){var a=libspeex.allocate(1,"i32",libspeex.ALLOC_STACK),c=libspeex.allocate(Speex.types.SpeexBits.__size__,
"i8",libspeex.ALLOC_STACK),d;libspeex._speex_bits_init(c);d=libspeex._speex_encoder_init(this.mode);libspeex._speex_encoder_ctl(d,Speex.SPEEX_GET_FRAME_SIZE,a);this.frame_size=libspeex.getValue(a,"i32");this.buffer_size=this.buffer_size;libspeex.setValue(a,this.quality,"i32");libspeex._speex_encoder_ctl(d,Speex.SPEEX_SET_QUALITY,a);this.state=d;this.bits=c;this.input=libspeex.allocate(this.frame_size,"i16",libspeex.ALLOC_NORMAL);this.buffer=libspeex.allocate(this.buffer_size,"i8",libspeex.ALLOC_NORMAL)};
c.prototype.read=function(a,c,d){var p=this.input;c=a+c>d.length?d.length-a:c;for(var x=a-1,w=0;++x<a+c;w+=2)libspeex.setValue(p+w,d[x],"i16");return c};c.prototype.write=function(a,c,d){for(var p=0,x=a-1;++x<a+c;p+=1)this.output[x]=libspeex.getValue(d+p,"i8")};c.prototype.process=function(a){var c=0,d=0,p,x,w=[],P=this.floating_point?libspeex._speex_encode:libspeex._speex_encode_int,N=!!this.params.benchmark;p=Math.ceil(a.length/this.frame_size);p*=this.bits_size;if(!this.output||this.output.length<
p)this.output=new Uint8Array(p);for(var R=this.bits,I=this.input,fa=this.buffer,pa=this.state;d<a.length;)N&&console.time("encode_packet_offset_"+d),libspeex._speex_bits_reset(R),p=this.read(d,this.frame_size,a),P(pa,I,R),x=libspeex._speex_bits_write(R,fa,this.buffer_size),this.write(c,x,fa),N&&console.timeEnd("encode_packet_offset_"+d),c+=x,d+=p,w.push(x);return[this.output.subarray(0,c),w]};c.prototype.close=function(){this.state&&(libspeex._speex_bits_destroy(this.bits),libspeex._speex_encoder_destroy(this.state))};
d.merge(c,a.types);a.SpeexEncoder=c})(this);function crc32(a){for(var c,d=crc32.table,g=0;g<a.length;g++)c=c<<8^d[c>>24&255^a.charCodeAt(g)];return c}
crc32.table=[0,79764919,159529838,222504665,319059676,398814059,445009330,507990021,638119352,583659535,797628118,726387553,890018660,835552979,1015980042,944750013,1276238704,1221641927,1167319070,1095957929,1595256236,1540665371,1452775106,1381403509,1780037320,1859660671,1671105958,1733955601,2031960084,2111593891,1889500026,1952343757,2552477408,2632100695,2443283854,2506133561,2334638140,2414271883,2191915858,2254759653,3190512472,3135915759,3081330742,3009969537,2905550212,2850959411,2762807018,
2691435357,3560074640,3505614887,3719321342,3648080713,3342211916,3287746299,3467911202,3396681109,4063920168,4143685023,4223187782,4286162673,3779000052,3858754371,3904687514,3967668269,881225847,809987520,1023691545,969234094,662832811,591600412,771767749,717299826,311336399,374308984,453813921,533576470,25881363,88864420,134795389,214552010,2023205639,2086057648,1897238633,1976864222,1804852699,1867694188,1645340341,1724971778,1587496639,1516133128,1461550545,1406951526,1302016099,1230646740,1142491917,
1087903418,2896545431,2825181984,2770861561,2716262478,3215044683,3143675388,3055782693,3001194130,2326604591,2389456536,2200899649,2280525302,2578013683,2640855108,2418763421,2498394922,3769900519,3832873040,3912640137,3992402750,4088425275,4151408268,4197601365,4277358050,3334271071,3263032808,3476998961,3422541446,3585640067,3514407732,3694837229,3640369242,1762451694,1842216281,1619975040,1682949687,2047383090,2127137669,1938468188,2001449195,1325665622,1271206113,1183200824,1111960463,1543535498,
1489069629,1434599652,1363369299,622672798,568075817,748617968,677256519,907627842,853037301,1067152940,995781531,51762726,131386257,177728840,240578815,269590778,349224269,429104020,491947555,4046411278,4126034873,4172115296,4234965207,3794477266,3874110821,3953728444,4016571915,3609705398,3555108353,3735388376,3664026991,3290680682,3236090077,3449943556,3378572211,3174993278,3120533705,3032266256,2961025959,2923101090,2868635157,2813903052,2742672763,2604032198,2683796849,2461293480,2524268063,
2284983834,2364738477,2175806836,2238787779,1569362073,1498123566,1409854455,1355396672,1317987909,1246755826,1192025387,1137557660,2072149281,2135122070,1912620623,1992383480,1753615357,1816598090,1627664531,1707420964,295390185,358241886,404320391,483945776,43990325,106832002,186451547,266083308,932423249,861060070,1041341759,986742920,613929101,542559546,756411363,701822548,3316196985,3244833742,3425377559,3370778784,3601682597,3530312978,3744426955,3689838204,3819031489,3881883254,3928223919,
4007849240,4037393693,4100235434,4180117107,4259748804,2310601993,2373574846,2151335527,2231098320,2596047829,2659030626,2470359227,2550115596,2947551409,2876312838,2788305887,2733848168,3165939309,3094707162,3040238851,2985771188];
function Ogg(a,c){var d=c||{};this.stream=a;this.pageExpr=new BitString("capturePattern:4/char,version:1,headerType:1,granulePos:8,serial:4,sequence:4,checksum:4,pageSegments:1,segments:pageSegments/char,frames:_,",{bytes:!0,bigEndian:!1});this.rawPages=[];this.pages=[];this.pageIdx=0;this.frames=[];this.data=null;this.segments=[];this.unpacked=!1;this.file=!!d.file;this.error=(c||{}).error||function(a){}}Ogg.CAPTURE_PATTERN=1332176723;Ogg.INVALID_CAPTURE_PATTERN=1;
Ogg.prototype.magic=function(a){var c;c|=a[0]<<24;c|=a[1]<<16;c|=a[2]<<8;return c|=a[3]};Ogg.prototype.createPage=function(a){return this.pageExpr.pack(a)};Ogg.prototype.parsePage=function(a){var c=this.pageExpr.unpack(a);this.magic(c.capturePattern)!=Ogg.CAPTURE_PATTERN?this.error({code:Ogg.INVALID_CAPTURE_PATTERN}):(this.rawPages.push(a),c.bos=function(){return 2==this.header},c.cont=function(){return 0==this.header},c.eos=function(){return 4==this.header},this.pages.push(c),this.frames.push(c.frames))};
Ogg.prototype.pageOut=function(){return this.pages[this.pageIdx],this.pageIdx+=1};Ogg.prototype.pages=function(){return this.pages};
Ogg.prototype.demux=function(){if(!this.unpacked){for(var a,c=0,d=0;0<=c;)a=this.stream.indexOf("OggS",c),c=this.stream.indexOf("OggS",a+4),a=this.stream.substring(a,-1!=c?c:void 0),this.parsePage(a);this.file&&(d=2,this.headers=this.frames.slice(0,d));this.data=this.frames.slice(d);for(c=d;c<this.pages.length;++c)this.segments.push(this.pages[c].segments);this.unpacked=!0;return this.pages}};
Ogg.prototype.mux=function(a,c){function d(a,c,d){return page={capturePattern:[79,103,103,83],version:0,headerType:a,granulePos:0,serial:406,sequence:0,checksum:d||0,pageSegments:1,segments:[c||0],frames:""}}function g(a){var c=d(0);c.pageSegments=a.length;c.segments=a;return c}function h(a,c){for(var d=crc32(a+c),g=new ArrayBuffer(a.length),h=new Uint8Array(g),l=0,p=a.length;l<p;l++)h[l]=a.charCodeAt(l);dv=new DataView(g);dv.setUint32(22,d,!0);return String.fromCharCode.apply(null,new Uint8Array(g))+
c}function l(a){for(var c=0,d=0;d<a.length;++d)c+=a[d];return c}c=c||{};var p="",x="",p=a[0],x=this.createPage(d(2,c.length||p.length,c.checksum)),p=h(x,p);if(1==a.length)return p;var w=a[1],x=this.createPage(d(0,c.length||w.length,c.checksum)),p=p+h(x,w);if(2==a.length)return p;for(var x=a[2],w=x[1].chunk(100),P=String.fromCharCode.apply(null,new Uint8Array(x[0].buffer)),N=0,R=0,I=w.length,fa=0;fa<I;++fa)x=w[fa],R+=l(x),x=this.createPage(g(x)),p+=h(x,P.substring(N,R)),N=R;return p};
Ogg.prototype.bitstream=function(){return this.unpacked?this.data.join(""):null};
/* Based on Xiph libogg checksum calculation */
function crc32(str) {
    var crc_reg;
    var crc_lookup = crc32.table;

    for (var i=0; i<str.length; i++)
        crc_reg = (crc_reg<<8)^crc_lookup[((crc_reg >> 24)&0xff)^str.charCodeAt(i)]

    return crc_reg;
}

crc32.table = [
    0x00000000,0x04c11db7,0x09823b6e,0x0d4326d9,
    0x130476dc,0x17c56b6b,0x1a864db2,0x1e475005,
    0x2608edb8,0x22c9f00f,0x2f8ad6d6,0x2b4bcb61,
    0x350c9b64,0x31cd86d3,0x3c8ea00a,0x384fbdbd,
    0x4c11db70,0x48d0c6c7,0x4593e01e,0x4152fda9,
    0x5f15adac,0x5bd4b01b,0x569796c2,0x52568b75,
    0x6a1936c8,0x6ed82b7f,0x639b0da6,0x675a1011,
    0x791d4014,0x7ddc5da3,0x709f7b7a,0x745e66cd,
    0x9823b6e0,0x9ce2ab57,0x91a18d8e,0x95609039,
    0x8b27c03c,0x8fe6dd8b,0x82a5fb52,0x8664e6e5,
    0xbe2b5b58,0xbaea46ef,0xb7a96036,0xb3687d81,
    0xad2f2d84,0xa9ee3033,0xa4ad16ea,0xa06c0b5d,
    0xd4326d90,0xd0f37027,0xddb056fe,0xd9714b49,
    0xc7361b4c,0xc3f706fb,0xceb42022,0xca753d95,
    0xf23a8028,0xf6fb9d9f,0xfbb8bb46,0xff79a6f1,
    0xe13ef6f4,0xe5ffeb43,0xe8bccd9a,0xec7dd02d,
    0x34867077,0x30476dc0,0x3d044b19,0x39c556ae,
    0x278206ab,0x23431b1c,0x2e003dc5,0x2ac12072,
    0x128e9dcf,0x164f8078,0x1b0ca6a1,0x1fcdbb16,
    0x018aeb13,0x054bf6a4,0x0808d07d,0x0cc9cdca,
    0x7897ab07,0x7c56b6b0,0x71159069,0x75d48dde,
    0x6b93dddb,0x6f52c06c,0x6211e6b5,0x66d0fb02,
    0x5e9f46bf,0x5a5e5b08,0x571d7dd1,0x53dc6066,
    0x4d9b3063,0x495a2dd4,0x44190b0d,0x40d816ba,
    0xaca5c697,0xa864db20,0xa527fdf9,0xa1e6e04e,
    0xbfa1b04b,0xbb60adfc,0xb6238b25,0xb2e29692,
    0x8aad2b2f,0x8e6c3698,0x832f1041,0x87ee0df6,
    0x99a95df3,0x9d684044,0x902b669d,0x94ea7b2a,
    0xe0b41de7,0xe4750050,0xe9362689,0xedf73b3e,
    0xf3b06b3b,0xf771768c,0xfa325055,0xfef34de2,
    0xc6bcf05f,0xc27dede8,0xcf3ecb31,0xcbffd686,
    0xd5b88683,0xd1799b34,0xdc3abded,0xd8fba05a,
    0x690ce0ee,0x6dcdfd59,0x608edb80,0x644fc637,
    0x7a089632,0x7ec98b85,0x738aad5c,0x774bb0eb,
    0x4f040d56,0x4bc510e1,0x46863638,0x42472b8f,
    0x5c007b8a,0x58c1663d,0x558240e4,0x51435d53,
    0x251d3b9e,0x21dc2629,0x2c9f00f0,0x285e1d47,
    0x36194d42,0x32d850f5,0x3f9b762c,0x3b5a6b9b,
    0x0315d626,0x07d4cb91,0x0a97ed48,0x0e56f0ff,
    0x1011a0fa,0x14d0bd4d,0x19939b94,0x1d528623,
    0xf12f560e,0xf5ee4bb9,0xf8ad6d60,0xfc6c70d7,
    0xe22b20d2,0xe6ea3d65,0xeba91bbc,0xef68060b,
    0xd727bbb6,0xd3e6a601,0xdea580d8,0xda649d6f,
    0xc423cd6a,0xc0e2d0dd,0xcda1f604,0xc960ebb3,
    0xbd3e8d7e,0xb9ff90c9,0xb4bcb610,0xb07daba7,
    0xae3afba2,0xaafbe615,0xa7b8c0cc,0xa379dd7b,
    0x9b3660c6,0x9ff77d71,0x92b45ba8,0x9675461f,
    0x8832161a,0x8cf30bad,0x81b02d74,0x857130c3,
    0x5d8a9099,0x594b8d2e,0x5408abf7,0x50c9b640,
    0x4e8ee645,0x4a4ffbf2,0x470cdd2b,0x43cdc09c,
    0x7b827d21,0x7f436096,0x7200464f,0x76c15bf8,
    0x68860bfd,0x6c47164a,0x61043093,0x65c52d24,
    0x119b4be9,0x155a565e,0x18197087,0x1cd86d30,
    0x029f3d35,0x065e2082,0x0b1d065b,0x0fdc1bec,
    0x3793a651,0x3352bbe6,0x3e119d3f,0x3ad08088,
    0x2497d08d,0x2056cd3a,0x2d15ebe3,0x29d4f654,
    0xc5a92679,0xc1683bce,0xcc2b1d17,0xc8ea00a0,
    0xd6ad50a5,0xd26c4d12,0xdf2f6bcb,0xdbee767c,
    0xe3a1cbc1,0xe760d676,0xea23f0af,0xeee2ed18,
    0xf0a5bd1d,0xf464a0aa,0xf9278673,0xfde69bc4,
    0x89b8fd09,0x8d79e0be,0x803ac667,0x84fbdbd0,
    0x9abc8bd5,0x9e7d9662,0x933eb0bb,0x97ffad0c,
    0xafb010b1,0xab710d06,0xa6322bdf,0xa2f33668,
    0xbcb4666d,0xb8757bda,0xb5365d03,0xb1f740b4
];

function Ogg(stream, options) {
    var opts = options || {};
    this.stream = stream;
    this.pageExpr = new BitString(
     "capturePattern:4/char,"
    +"version:1,"
    +"headerType:1,"
    +"granulePos:8,"
    +"serial:4,"
    +"sequence:4,"
    +"checksum:4,"
    +"pageSegments:1,"
    +"segments:pageSegments/char,"
    +"frames:_,", {
        bytes: true
      , bigEndian: false
    });

    this.rawPages = [];
    this.pages = [];
    this.pageIdx = 0;

    this.frames = [];
    this.data = null;
    this.segments = [];

    this.unpacked = false;
    this.file = !!opts.file;
    this.error = (options||{}).error || function (e) {};
}

Ogg.CAPTURE_PATTERN = 0x4f676753; // "OggS"
Ogg.INVALID_CAPTURE_PATTERN = 1;

Ogg.prototype.magic = function (c) {
    var magic;

    magic |= (c[0] << 24);
    magic |= (c[1] << 16);
    magic |= (c[2] << 8);
    magic |= c[3];

    return magic;
}

Ogg.prototype.createPage = function (data) {
    return this.pageExpr.pack(data);
}

Ogg.prototype.parsePage = function (binStr) {
    var page = this.pageExpr.unpack(binStr),
        seg = page.segments;

    if (this.magic(page.capturePattern) != Ogg.CAPTURE_PATTERN) {
        this.error( { code: Ogg.INVALID_CAPTURE_PATTERN });
        return;
    }

    this.rawPages.push(binStr);

    page.bos = function () {
        return (this.header == 2);
    }

    page.cont = function () {
        return (this.header == 0);
    }

    page.eos = function () {
        return (this.header == 4);
    }

    // Pushes the ogg parsed paged
    this.pages.push(page);

    // Pushes the page frames
    this.frames.push(page.frames);
}

Ogg.prototype.pageOut = function () {
    return this.pages[this.pageIdx], (this.pageIdx += 1);
}

Ogg.prototype.pages = function () {
    return this.pages;
}

Ogg.prototype.demux = function () {
    if (this.unpacked) return;

    var begin, next = 0, str, frameIdx = 0;

    while(next >= 0) {

        // Fetches OGG Page begin/end
        var begin = this.stream.indexOf("OggS", next), tmp;
        next = this.stream.indexOf("OggS", begin + 4);

        // Fetch Ogg Raw Page
        str = this.stream.substring(begin, next != -1 ? next : undefined)

        // Parse and store the page
        this.parsePage(str);
    }

    // Fetch headers
    if (this.file) {
        frameIdx = 2;
        this.headers = this.frames.slice(0, frameIdx);
    }

    // Fetch Data
    this.data = this.frames.slice(frameIdx);
    for (var i = frameIdx; i<this.pages.length; ++i) {
        this.segments.push(this.pages[i].segments);
    }

    this.unpacked = true;
    return this.pages;
}

Ogg.prototype.mux = function (d, o) {
    function OggPageHeader(type, length, checksum, granulePos) {
        return page = {
            capturePattern: [0x4f, 0x67, 0x67, 0x53]
          , version: 0
          , headerType: type
          , granulePos: granulePos || 0
          , serial: 406
          , sequence: 0
          , checksum: checksum || 0
          , pageSegments: 1
          , segments: [ length || 0 ]
          , frames: ""
        };
    }

    function OggPageData(segments, granulePos) {
        var p = OggPageHeader(0, null, null, granulePos);
        p.pageSegments = segments.length;
        p.segments = segments;
        return p;
    }

    function chksum(str, c) {
        var buf = new ArrayBuffer(str.length);
        var bufView = new Uint8Array(buf);
        for (var i=0, len=str.length; i<len; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        dv = new DataView(buf);
        dv.setUint32(22, c, true);

        return String.fromCharCode.apply(null, new Uint8Array(buf));
    }

    function hdrup(hdr, content) {
        var csum, str;
        csum = crc32(hdr + content);
        str = chksum(hdr, csum) + content;
        return str;
    }

    function frames(segments) {
        var sum = 0;
        for (var i=0; i<segments.length; ++i) {
            sum += segments[i];
        }
        return sum;
    }

    o=o||{};

    var str = "";
    var p = "";
    var header = d[0];
    var hdr = header.raw;
    // header page
    p = this.createPage(OggPageHeader(2,
            o.length || hdr.length, o.checksum, 0))
    str = hdrup(p, hdr);
    if (d.length == 1)
        return str;

    var comments = d[1];
    var comments_raw = comments.raw;
    // comments page
    p = this.createPage(OggPageHeader(0,
            o.length || comments_raw.length, o.checksum));
    str += hdrup(p, comments_raw);
    if (d.length == 2)
        return str;

    // data page
    var data = d[2];
    var segments = data[1].chunk(100)
      , stream = String.fromCharCode.apply(null,
            new Uint8Array(data[0]))  // TODO(Bieber)
      , a = 0
      , b = 0
      , len = segments.length;

    var granulePos = 0;
    var frame_size = header.data.frame_size;
    for (var i = 0; i < len; ++i) {
        var segchunk = segments[i];
        b += frames(segchunk);
        granulePos += segchunk.length * frame_size;

        p = this.createPage(OggPageData(segchunk, granulePos));
        str += hdrup(p, stream.substring(a, b));

        a = b;
    }
    return str;
}

Ogg.prototype.bitstream = function () {
    if (!this.unpacked) return null;
    return this.data.join("");
};
var Codec = {
    speex: new Speex({
        quality: 6
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
// Defines the Clip API
var Clip = {
    create: function() {
        return {
            samples: [],
            sampleRate: 44100, // TODO(Bieber): Use actual sample rate
            speex: [[],[]], // samples, frame sizes
            startTime: undefined,
            finalized: false
        };
    },

    createFromSamples: function(samples) {
        var clip = Clip.create();
        Clip.setSamples(clip, samples);
        return clip;
    },

    createFromSpeex: function(speex) {
        var clip = Clip.create();
        Clip.setSpeex(clip, speex);
        return clip;
    },

    createFromWaveFile: function(file) {

    },

    createFromSpeexFile: function(file) {

    },

    asWaveFile: function(clip, callback) {
        // TODO(Bieber): Make this work
        var samples = clip.samples;
        var sampleRate = clip.sampleRate;

        var buffer = new ArrayBuffer(44 + samples.length * 2);
        var view = new DataView(buffer);

        function floatTo16BitPCM(view, offset, input) {
            for (var i = 0; i < input.length; i++, offset += 2) {
                var s = Math.max(-1, Math.min(1, input[i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        }

        function writeString(view, offset, string) {
            for (var i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 44 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);
        floatTo16BitPCM(view, 44, samples);

        var audioBlob = new Blob([view], {
            type: 'wav'
        });

        return (window.URL || window.webkitURL).createObjectURL(audioBlob);
    },

    asSpeexFile: function(clip) {
        var sampleRate = clip.sampleRate;
        var isNarrowband = sampleRate < 16000;
        var oggdata = new Ogg(null, {file: true});

        var spxhdr = new SpeexHeader({
            bitrate: -1,
            extra_headers: 0,
            frame_size: isNarrowband ? 160 : 320,
            frames_per_packet: 1,
            header_size: 80,
            mode: isNarrowband ? 0 : 1,
            mode_bitstream_version: 4,
            nb_channels: 1,
            rate: sampleRate,
            reserved1: 0,
            reserved2: 0,
            speex_string: "Speex   ",
            speex_version_id: 1,
            speex_version_string: "1.2rc1\0\0\0\0\0\0\0\0\0\0\0\0\0\0",
            vbr: 0
        });

        var comment = "Encoded with speex.js";
        var spxcmt = new SpeexComment({
            vendor_string: comment,
            vendor_length: comment.length
        });

        var spxdata = clip.speex;

        var result = oggdata.mux([spxhdr, spxcmt, spxdata]);
        return result;
    },

    setStartTime: function(clip, time) {
        clip.startTime = time;
    },

    setSamples: function(clip, data) {
        clip.samples = data;
        Clip.computeSpeex(clip);
    },

    setSpeex: function(clip, data) {
        clip.speex = data;
        Clip.computeSamples(clip);
    },

    // WARNING: Leaves speex out of date.
    addSamples: function(clip, data) {
        Array.prototype.push.apply(clip.samples, data);
    },

    // WARNING: Leaves samples out of date.
    addSpeex: function(clip, data) {
        Array.prototype.push.apply(clip.speex[0], data[0]);
        Array.prototype.push.apply(clip.speex[1], data[1]);
    },

    // WARNING: Potentially slow.
    computeSamples: function(clip) {
        // Decodes speex data to get playable samples
        // TODO(Bieber): Make a copy
        // TODO(Bieber): Move to background thread
        clip.samples = Codec.decode(clip.speex[0]);
    },

    // WARNING: Potentially slow.
    computeSpeex: function(clip) {
        // Encodes samples to get smaller speex data
        // TODO(Bieber): Make a copy
        // TODO(Bieber): Move to background thread
        clip.speex = Codec.encode(clip.samples);
    },

    getStartTime: function(clip) {
        return clip.startTime;
    },

    getEndTime: function(clip) {
        return clip.startTime + Clip.getLength(clip);
    },

    // Returns clip length in milliseconds.
    getLength: function(clip) {
        return 1000 * clip.samples.length / clip.sampleRate;
    },

    finalize: function(clip) {
        clip.finalized = true;
    }
};
// The HTML5 Audio middleware that does the recording in modern browsers
var Html5Audio = {
    DEFAULT_WORKER_PATH: 'worker.js',
    worker: undefined,

    audioContext: undefined,
    playingSources: [],

    ready: false,
    recording: false,

    init: function(config) {
        Html5Audio.audioContext = new AudioContext();
        navigator.getUserMedia({audio: true}, Html5Audio._useStream, function(err){});

        var worker_path = (config && config.worker_path) || Html5Audio.DEFAULT_WORKER_PATH;
        try {
            Html5Audio.worker = new Worker(worker_path);
            Html5Audio.worker.onmessage = Html5Audio._handleMessage;
        } catch(error) {
            console.error(error);
        }
    },

    // Called by init with a MediaStream object
    _useStream: function(stream) {
        var mediaStreamSource = Html5Audio.audioContext.createMediaStreamSource(stream);
        var context = mediaStreamSource.context;

        var bufferLen = 4 * 4096;
        var numChannelsIn = 1;
        var numChannelsOut = 1;
        var node = context.createScriptProcessor(bufferLen, numChannelsIn, numChannelsOut);
        node.onaudioprocess = Html5Audio._handleAudio;

        mediaStreamSource.connect(node);
        node.connect(context.destination);

        Html5Audio.ready = true;
    },

    _handleAudio: function(event) {
        // Buffer has length specified in _useStream
        var buffer = event.inputBuffer.getChannelData(0);
        if (Html5Audio.recording) {
            // Add the samples immediately to the Clip
            Clip.addSamples(AudioRecorder.clip, buffer);

            // In the background, in multiples of 160, encode the samples
            // And push the encoded data back into the Clip ASAP.
            Html5Audio.worker.postMessage({
                command: 'put',
                buffer: buffer
            });
        }
    },

    _handleMessage: function(event) {
        switch(event.data.command) {
            case 'speex':
            var data = event.data.data;
            Clip.addSpeex(AudioRecorder.clip, data);
            break;

            case 'finalized':
            Clip.finalize(AudioRecorder.clip);
            if (Html5Audio.cb) Html5Audio.cb(AudioRecorder.clip);
            break;

            case 'cleared':
            Clip.setSamples(AudioRecorder.clip, []);
            break;

            case 'print':
            console.log(event.data.message);
            break;
        }
    },

    record: function() {
        Html5Audio.recording = true;
    },

    stopRecording: function(cb) {
        if (Html5Audio.recording) {
            Html5Audio.cb = cb; // TODO(Bieber): Be more robust maybe with ids
            Html5Audio.recording = false;
            Html5Audio.worker.postMessage({
                command: 'finalize'
            });
        }
    },

    clear: function(cb) {
        Html5Audio.worker.postMessage({
            command: 'clear'
        });
    },

    playClip: function(clip, inHowLong, offset) {
        var when = Html5Audio.audioContext.currentTime + inHowLong;
        var samples = clip.samples;

        var newBuffer = Html5Audio.audioContext.createBuffer(1, samples.length, clip.sampleRate);
        newBuffer.getChannelData(0).set(samples);

        var newSource = Html5Audio.audioContext.createBufferSource();
        newSource.buffer = newBuffer;

        newSource.connect(Html5Audio.audioContext.destination);
        newSource.start(when, offset);

        Html5Audio.playingSources.push(newSource);
    },

    stopPlaying: function() {
        // Stops playing all playing sources.
        // TODO(Bieber): Make sure things are removed from playingSources when they finish naturally
        for (var i = 0; i < Html5Audio.playingSources.length; i++) {
          var source = Html5Audio.playingSources[i];
          source.stop(0);
          delete source;
        }
        Html5Audio.playingSources = [];
    },

    isRecording: function() {
        return Html5Audio.ready && Html5Audio.recording;
    }
};
var FlashAudio = {
    init: function() {
        console.log("TODO(Bieber): Use Flash Audio");
    },

    record: function() {

    },

    stopRecording: function(cb) {

    },

    getClip: function() {

    },

    clear: function() {

    },

    playClip: function(clip, inHowLong, offset) {

    },

    stopPlaying: function(cb) {

    },

    isRecording: function() {
        return false;
    }
};
// AudioRecorder is a cross platform utility for recording and playing audio
// in all major browsers.

// TODO(Bieber): Make it work in Safari by falling back to Flash.
var AudioRecorder = {
    clip: undefined,
    middleware: undefined, // HTML5 or Flash audio

    init: function(config) {
        // Initializes the AudioRecorder
        window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

        var html5audio = !!window.AudioContext && !!navigator.getUserMedia;
        if (html5audio) {
            AudioRecorder.middleware = Html5Audio;
        } else {
            AudioRecorder.middleware = FlashAudio;
        }
        AudioRecorder.middleware.init(config);
    },

    record: function() {
        // Starts recording to the current clip
        if (AudioRecorder.isRecording()) return true;

        // If we can't record on the current clip, make a new one
        if (AudioRecorder.clip === undefined || AudioRecorder.clip.finalized) {
            AudioRecorder.newClip();
        }

        return AudioRecorder.middleware.record();
    },

    stopRecording: function(cb) {
        // Stops recording and passes the newly created clip object to the
        // callback function cb
        if (!AudioRecorder.isRecording()) return true;
        return AudioRecorder.middleware.stopRecording(cb);
    },

    newClip: function() {
        // Creates a new empty clip as the current clip
        if (AudioRecorder.isRecording()) {
            console.warn("Cannot create a new clip while recording");
            return false;
        }
        AudioRecorder.clip = Clip.create();
        return true;
    },

    getClip: function() {
        // Returns the current clips
        return AudioRecorder.clip;
    },

    setClip: function(clip) {
        // Sets the current clip
        if (AudioRecorder.isRecording()) {
            console.warn("Cannot set the clip while recording");
            return false;
        }
        AudioRecorder.clip = clip;
    },

    clear: function() {
        // Clears the current clip back to empty
        AudioRecorder.middleware.clear();
        return true;
    },

    playClip: function(clip, inHowLong, offset) {
        // Plays clip starting from the appropriate position at the
        // appropriate time
        if (inHowLong === undefined) {
            inHowLong = 0;
        }
        if (offset === undefined) {
            offset = 0;
        }
        AudioRecorder.middleware.playClip(clip, inHowLong, offset);
        return true;
    },

    stopPlaying: function() {
        // Stops all playing clips
        AudioRecorder.middleware.stopPlaying();
        return true;
    },

    isRecording: function() {
        // Returns True if currently recording, False otherwise
        return AudioRecorder.middleware.isRecording();
    }
};
