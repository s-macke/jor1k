// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

var message = require('./messagehandler');
var System = require('./system');

new System();
message.Send("WorkerReady", 0);
