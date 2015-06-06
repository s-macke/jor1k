// -------------------------------------------------
// ------------- Input Virtio Device ---------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');

function VirtioInput(ramdev) {
    this.configspace = [0x0, 0x0];
    this.deviceid = 18;
    this.hostfeature = 0x1;
    this.Reset();
}

VirtioInput.prototype.Reset = function() {
}

VirtioInput.prototype.ReceiveRequest = function (index, GetByte) {
    message.Debug("Virtio input request");
}

module.exports = VirtioInput;
