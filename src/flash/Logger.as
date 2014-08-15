package {
    public class Logger {
        protected var _debugLog:Array = new Array();

        public function Logger() {
        }

        public function log(message:String):void {
            _debugLog.push(message);
        }

        public function debugLog():Array {
            return _debugLog;
        }
    }
}
