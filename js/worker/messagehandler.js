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
