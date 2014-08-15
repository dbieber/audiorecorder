package {
    import flash.events.TimerEvent;
    import flash.events.Event;
    import flash.events.ErrorEvent;
    import flash.events.SampleDataEvent;
    import flash.external.ExternalInterface;
    import flash.media.Microphone;
    import flash.media.Sound;
    import flash.media.SoundChannel;
    import flash.system.Capabilities;
    import flash.utils.ByteArray;
    import flash.utils.getTimer;
    import flash.utils.Timer;
    import flash.system.Security;
    import flash.system.SecurityPanel;
    import flash.events.StatusEvent;
    import flash.utils.getQualifiedClassName;

    import mx.collections.ArrayCollection;

    public class Recorder {
        private var logger:Logger;

        protected var isRecording:Boolean = false;
        protected var isPlaying:Boolean = false;
        protected var microphoneWasMuted:Boolean;
        protected var playingProgressTimer:Timer;
        protected var microphone:Microphone;
        protected var buffer:ByteArray = new ByteArray();
        protected var sound:Sound;
        protected var channel:SoundChannel;
        protected var recordingStartTime:Number = 0;
        protected static var sampleRate:Number = 44.1;

        public function Recorder(logger:Logger) {
            this.logger = logger;
        }

        public function addExternalInterfaceCallbacks():void {
            ExternalInterface.addCallback("record",         this.record);
            ExternalInterface.addCallback("_stop",          this.stop);
            ExternalInterface.addCallback("_play",          this.play);
            ExternalInterface.addCallback("audioData",      this.audioData);
            ExternalInterface.addCallback("showFlash",      this.showFlash);
            ExternalInterface.addCallback("recordingDuration",     this.recordingDuration);
            ExternalInterface.addCallback("playDuration",     this.playDuration);

            triggerEvent("initialized", {});
            logger.log("Recorder initialized");
        }

        protected function record():void
        {
            if (!microphone) {
                setupMicrophone();
            }

            microphoneWasMuted = microphone.muted;
            if (microphoneWasMuted) {
                logger.log('showFlashRequired');
                triggerEvent('showFlash','');
            } else {
                notifyRecordingStarted();
            }

            buffer = new ByteArray();
            microphone.addEventListener(SampleDataEvent.SAMPLE_DATA, recordSampleDataHandler);
        }

        protected function recordStop():int
        {
            logger.log('stopRecording');
            isRecording = false;
            triggerEvent('recordingStop', {duration: recordingDuration()});
            microphone.removeEventListener(SampleDataEvent.SAMPLE_DATA, recordSampleDataHandler);
            return recordingDuration();
        }

        protected function play():void
        {
            logger.log('startPlaying');
            isPlaying = true;
            triggerEvent('playingStart', {});
            buffer.position = 0;
            sound = new Sound();
            sound.addEventListener(SampleDataEvent.SAMPLE_DATA, playSampleDataHandler);

            channel = sound.play();
            channel.addEventListener(Event.SOUND_COMPLETE, function():void {
                playStop();
            });

            if (playingProgressTimer){
                playingProgressTimer.reset();
            }
            playingProgressTimer = new Timer(250);
            var that:Recorder = this;
            playingProgressTimer.addEventListener(TimerEvent.TIMER, function playingProgressTimerHandler(event:TimerEvent):void {
                triggerEvent('playingProgress', that.playDuration());
            });
            playingProgressTimer.start();
        }

        protected function stop():int
        {
            playStop();
            return recordStop();
        }

        protected function playStop():void
        {
            logger.log('stopPlaying');
            if (channel){
                channel.stop();
                playingProgressTimer.reset();

                triggerEvent('playingStop', {});
                isPlaying = false;
            }
        }

        protected function audioData(newData:String=null):String
        {
            var delimiter:String = ";";
            if (newData) {
                buffer = new ByteArray();
                var splittedData:Array = newData.split(delimiter);
                for(var i:int = 0; i < splittedData.length; i++){
                    buffer.writeFloat(parseFloat(splittedData[i]));
                }
                return "";
            } else {
                var ret:String="";
                buffer.position = 0;
                while (buffer.bytesAvailable > 0) {
                    ret += buffer.readFloat().toString() + delimiter;
                }
                return ret;
            }
        }

        protected function showFlash():void
        {
            Security.showSettings(SecurityPanel.PRIVACY);
            triggerEvent('showFlash','');
        }

        /* Recording Helper */
        protected function setupMicrophone():void
        {
            logger.log('setupMicrophone');
            microphone = Microphone.getMicrophone();
            microphone.codec = "Nellymoser";
            microphone.setSilenceLevel(0);
            microphone.rate = sampleRate;
            microphone.gain = 50;
            microphone.addEventListener(StatusEvent.STATUS, function statusHandler(e:Event):void {
                logger.log('Microphone Status Change');
                if (microphone.muted){
                    triggerEvent('recordingCancel','');
                } else {
                    if (!isRecording){
                        notifyRecordingStarted();
                    }
                }
            });

            logger.log('setupMicrophone done: ' + microphone.name + ' ' + microphone.muted);
        }

        protected function notifyRecordingStarted():void
        {
            if (microphoneWasMuted){
                microphoneWasMuted = false;
                triggerEvent('hideFlash','');
            }
            recordingStartTime = getTimer();
            triggerEvent('recordingStart', {});
            logger.log('startRecording');
            isRecording = true;
        }

        /* Sample related */

        protected function recordingDuration():int
        {
            var duration:int = int(getTimer() - recordingStartTime);
            return Math.max(duration, 0);
        }

        protected function playDuration():int
        {
            return int(channel.position);
        }

        protected function recordSampleDataHandler(event:SampleDataEvent):void
        {
            while(event.data.bytesAvailable)
            {
                var sample:Number = event.data.readFloat();

                buffer.writeFloat(sample);
                if (buffer.length % 40000 == 0){
                    triggerEvent('recordingProgress', recordingDuration(),  microphone.activityLevel);
                }
            }
        }

        protected function playSampleDataHandler(event:SampleDataEvent):void
        {
            var expectedSampleRate:Number = 44.1;
            var writtenSamples:int = 0;
            var channels:int = 2;
            var maxSamples:int = 8192 * channels;
            // if the sampleRate doesn't match the expectedSampleRate of flash.media.Sound (44.1) write the sample multiple times
            // this will result in a little down pitchshift.
            // also write 2 times for stereo channels
            while(writtenSamples < maxSamples && buffer.bytesAvailable)
            {
                var sample:Number = buffer.readFloat();
              for (var j:int = 0; j < channels * (expectedSampleRate / sampleRate); j++){
                    event.data.writeFloat(sample);
                    writtenSamples++;
                    if (writtenSamples >= maxSamples){
                        break;
                    }
                }
            }
            logger.log("Wrote " + writtenSamples + " samples");
        }

        /* ExternalInterface Communication */

        protected function triggerEvent(eventName:String, arg0:Object, arg1:Object=null):void
        {
            ExternalInterface.call("Recorder.triggerEvent", eventName, arg0, arg1);
        }
    }
}
