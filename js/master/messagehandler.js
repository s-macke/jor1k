// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

var worker;


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
    Debug("Abort execution.");
    Send("Stop", {});
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
    if (typeof messagemap[e.data.command] == 'function') {
            messagemap[e.data.command](e.data.data);
            return;
    }
}

function SetWorker(_worker) {
    worker = _worker;
    worker.onmessage = OnMessage;
    worker.onerror = function(e) {
        Debug("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
        Abort();
    }
}

module.exports.SetWorker = SetWorker;
module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Warning = Warning;
module.exports.Error = Error;
module.exports.Abort = Abort;
module.exports.Send = Send;
 
