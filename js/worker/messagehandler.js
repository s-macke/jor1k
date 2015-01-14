// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

var run = true;

function Send(command, data) {
    postMessage(
    {
        "command" : command,
        "data" : data
    }
    );
}

function Debug(message) {
    Send("Debug", message);
}

function Abort() {
    Debug("Abort execution.");
    run = false;
    Send("Stop", {});
    throw new Error('Kill worker');
}

function Error(message) {
    Send("Debug", "Error: " + message);
    Abort();
}

function Warning(message) {
    Send("Debug", "Warning: " + message);
}

var messagemap = new Object();

function Register(message, OnReceive) {
    messagemap[message] = OnReceive;
}

// this is a global object of the worker
onmessage = function(e) {
    if (!run) return; // ignore all messages after an error

    if (typeof messagemap[e.data.command] == 'function') {
        try {
            messagemap[e.data.command](e.data.data);
        } catch (e) {
            run = false;
        }
        return;
    }
}

module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Error = Error;
module.exports.Warning = Warning;
module.exports.Abort = Abort;
module.exports.Send = Send;
 
