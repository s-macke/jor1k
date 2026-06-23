// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

var run = true;
var workingpath = '';

// "transfer" is an optional array of Transferable objects (e.g. ArrayBuffers)
// whose ownership is handed to the other thread without copying. This avoids
// the structured-clone deep copy for large payloads such as the framebuffer.
function Send(command, data, transfer) {
    var msg = {
        "command" : command,
        "data" : data
    };
    if (transfer) {
        postMessage(msg, transfer);
    } else {
        postMessage(msg);
    }
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
            Debug(error.stack);
            run = false;
        }
        return;
    }
}

Register("Abort", function(){ run = false; });
Register("WorkingPath", function(data){ workingpath = data; });

module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Error = DoError;
module.exports.Warning = Warning;
module.exports.Abort = Abort;
module.exports.Send = Send;
module.exports.GetWorkingPath = function() { return workingpath; };
