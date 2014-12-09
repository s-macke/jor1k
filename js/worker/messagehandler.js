// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";


function SendToMaster(command, data) {
    postMessage(
    {
        "command" : command,
        "data" : data
    }
    );
}

function DebugMessage(message) {
    SendToMaster("Debug", message);
}

function Abort() {
    DebugMessage("Abort execution.");
    SendToMaster("Stop", {});
    throw new Error('Kill worker');
}


var messagemap = new Object();
function RegisterMessage(message, OnReceive) {
    messagemap[message] = OnReceive;
}

onmessage = function(e) {
    if (typeof messagemap[e.data.command] == 'function') {
            messagemap[e.data.command](e.data.data);
            return;
    }
}

module.exports.Register = RegisterMessage;
module.exports.Debug = DebugMessage;
module.exports.Abort = Abort;
module.exports.Send = SendToMaster;
 
