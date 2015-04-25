// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

var worker;

var run = true;

function Send(command, data) {
    worker.postMessage(
    {
        "command" : command,
        "data" : data
    }
    );
}

function Debug(message) {
    console.log(message);
}

function Abort() {
    Debug("Master: Abort execution.");
    run = false;
    Send("Abort", {});
    throw new Error('Kill master');
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
function OnMessage(e) {
    var command = e.data.command;

    // Debug Messages are always allowed
    if (command == "Debug") {
        messagemap[command](e.data.data);
        return;
    }

    if (!run) return;
    if (typeof messagemap[command] == 'function') {
        try {
            messagemap[command](e.data.data);
        } catch (error) {
            Debug("Master: Unhandled exception in command \"" + command + "\": " + error.message);
            run = false;
        }
    }
}

function SetWorker(_worker) {
    worker = _worker;
    worker.onmessage = OnMessage;
    worker.onerror = function(e) {
        Debug("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
        Abort();
    }
    Register("Abort", function(){Debug("Master: Received abort signal from worker"); run=false;});
    Register("Debug", function(d){Debug(d);});
}

module.exports.SetWorker = SetWorker;
module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Warning = Warning;
module.exports.Error = DoError;
module.exports.Abort = Abort;
module.exports.Send = Send;
 
