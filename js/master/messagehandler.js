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
function OnMessage(e) {

    // Debug Message are always allowed
    if (e.data.command == "Debug") {
        messagemap[e.data.command](e.data.data);
        return;
    }

    if (!run) return;
    if (typeof messagemap[e.data.command] == 'function') {
        try {
            messagemap[e.data.command](e.data.data);
        } catch (e) {
            message.Debug("Master: Unhandled exception in command: " + e.data.command);
            message.Debug(e);
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
module.exports.Error = Error;
module.exports.Abort = Abort;
module.exports.Send = Send;
 
