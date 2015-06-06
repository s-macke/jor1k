// -------------------------------------------------
// ------------- Dummy Virtio Device ---------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');

function VirtioDummy(ramdev) {
    this.configspace = [0x0];
    this.deviceid = 0x0;
    this.hostfeature = 0x0;
    this.Reset();
}

VirtioDummy.prototype.Reset = function() {
}

VirtioDummy.prototype.ReceiveRequest = function (index, GetByte) {
}

module.exports = VirtioDummy;
