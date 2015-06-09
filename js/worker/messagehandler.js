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
    Debug("Worker: Abort execution.");
    if (typeof messagemap["PrintOnAbort"] == 'function') {
            messagemap["PrintOnAbort"]();
    }    
    Send("Abort", {});
    run = false;
    throw new Error('Kill worker'); // Don't return
}

function DoError(message) {
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

    var command = e.data.command;
    if (typeof messagemap[command] == 'function') {
        try {
            messagemap[command](e.data.data);
        } catch (error) {
            Debug("Worker: Unhandled exception in command \"" + command + "\": " + error.message);
            run = false;
        }
        return;
    }
}

Register("Abort", function(){run = false;});

module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Error = DoError;
module.exports.Warning = Warning;
module.exports.Abort = Abort;
module.exports.Send = Send;

