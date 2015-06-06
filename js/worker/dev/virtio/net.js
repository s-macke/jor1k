// -------------------------------------------------
// ------------- Input Virtio Device ---------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');

function VirtioNET(ramdev) {
    this.configspace = [0x0, 0x0];
    this.deviceid = 1;
    this.hostfeature = 0x0;
    this.Reset();
}

VirtioNET.prototype.Reset = function() {
}

VirtioNET.prototype.ReceiveRequest = function (index, GetByte) {
    message.Debug("Virtio network request");
}

module.exports = VirtioNET;
