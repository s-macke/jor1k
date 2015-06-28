// -------------------------------------------------
// ------------- Block Virtio Device ---------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_BLK_T_IN          = 0;
var VIRTIO_BLK_T_OUT         = 1;
var VIRTIO_BLK_T_FLUSH       = 4;
var VIRTIO_BLK_T_FLUSH_OUT   = 5;

var VIRTIO_BLK_S_OK        = 0; 
var VIRTIO_BLK_S_IOERR     = 1;
var VIRTIO_BLK_S_UNSUPP    = 2;

function VirtioBlock(ramdev) {
    this.blocks = 100;
    this.configspace = [
        (this.blocks >> 0)&0xFF,
        (this.blocks >> 8)&0xFF,
        (this.blocks >> 16)&0xFF,
        0x0, 0x0, 0x0, 0x0, 0x0]; // the size in little endian

    this.deviceid = 0x2;
    this.hostfeature = 0x0;
    this.replybuffer = new Uint8Array(0x10000); // there is no size limit
    this.replybuffersize = 0;
    this.buffer = new Uint8Array(this.blocks*512);
    this.Reset();
}

VirtioBlock.prototype.Reset = function() {
}

VirtioBlock.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    //message.Debug("block device request: " + queueidx + " " + index + " " + size.read + " " + size.write);
    var request  = marshall.Unmarshall2(["w", "w", "d"], GetByte);
    var type = request[0];
    var sector = request[2];
    //message.Debug("type: " + type + " sector: " + sector);

    switch(type) {
        case VIRTIO_BLK_T_IN:
            if (size.write > 0x10000) {
                message.Debug("Error in virtioblock: replybuffer too small");
                message.Abort();
            }
            for(var i=0; i<size.write-1; i++) {
                this.replybuffer[i] = this.buffer[sector*512+i];
            }
            this.replybuffersize = size.write;
            this.replybuffer[size.write-1] = VIRTIO_BLK_S_OK;
            this.SendReply(0, index);
            break;

        case VIRTIO_BLK_T_OUT:
            for(var i=0; i<size.read-16; i++) {
                this.buffer[sector*512+i] = GetByte();
            }
            this.replybuffersize = 1;
            this.replybuffer[0] = VIRTIO_BLK_S_OK;
            this.SendReply(0, index);
            break;

        case VIRTIO_BLK_T_FLUSH:
            break;

        case VIRTIO_BLK_T_FLUSH_OUT:
            break;
        
        default:
            message.Debug("Error in VirtioBlock: Unknown request type " + type);
            message.Abort();
            break;
    }

}

module.exports = VirtioBlock;
