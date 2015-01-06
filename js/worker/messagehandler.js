// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

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
    Send("Stop", {});
    throw new Error('Kill worker');
}


var messagemap = new Object();
function Register(message, OnReceive) {
    messagemap[message] = OnReceive;
}

// this is a global object of the worker
onmessage = function(e) {
    if (typeof messagemap[e.data.command] == 'function') {
            messagemap[e.data.command](e.data.data);
            return;
    }
}

module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Abort = Abort;
module.exports.Send = Send;
 
