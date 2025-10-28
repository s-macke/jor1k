// -------------------------------------------------
// ------------- Dummy Virtio Device ---------------
// -------------------------------------------------

"use strict";

import { Debug, Abort } from '../../messagehandler.js';
import * as utils from '../../utils.js';

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

export default VirtioDummy;
