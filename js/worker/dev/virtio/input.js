// -------------------------------------------------
// ------------- Input Virtio Device ---------------
// -------------------------------------------------
// https://github.com/torvalds/linux/blob/master/include/uapi/linux/virtio_input.h
// https://github.com/torvalds/linux/blob/master/drivers/virtio/virtio_input.c

// https://lwn.net/Articles/637590/
// http://lxr.free-electrons.com/source/include/uapi/linux/input.h

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_INPUT_CFG_UNSET      = 0x00; 
var VIRTIO_INPUT_CFG_ID_NAME    = 0x01;  
var VIRTIO_INPUT_CFG_ID_SERIAL  = 0x02;  
var VIRTIO_INPUT_CFG_ID_DEVIDS  = 0x03;
var VIRTIO_INPUT_CFG_PROP_BITS  = 0x10;
var VIRTIO_INPUT_CFG_EV_BITS    = 0x11;  
var VIRTIO_INPUT_CFG_ABS_INFO   = 0x12;

var EV_SYN                = 0x00;
var EV_KEY                = 0x01;
var EV_REL                = 0x02;
var EV_ABS                = 0x03;
var EV_MSC                = 0x04;
var EV_SW                 = 0x05;
var EV_LED                = 0x11;
var EV_SND                = 0x12;
var EV_REP                = 0x14;
var EV_FF                 = 0x15;
var EV_PWR                = 0x16;
var EV_FF_STATUS          = 0x17;
var EV_MAX                = 0x1f;
var EV_CNT                = (EV_MAX+1);

function VirtioInput(ramdev) {
    this.configspace = new Uint8Array(256);
    this.deviceid = 18;
    this.hostfeature = 0x0;

    // TODO remove old keyboard driver
    message.Register("virtio.kbd.keydown", this.OnKeyDown.bind(this) );
    message.Register("virtio.kbd.keyup", this.OnKeyUp.bind(this) );
    
    this.replybuffersize = 8;
    this.replybuffer = new Uint8Array(8);

    this.Reset();
}

VirtioInput.prototype.Reset = function() {
    this.receivebufferdesc = new Array();
}


VirtioInput.prototype.OnKeyDown = function(event) {
    if (this.receivebufferdesc.length == 0) return;
    var desc = this.receivebufferdesc[0];
    this.receivebufferdesc.shift();
    this.replybuffersize = 8;
    // type, code and value
    marshall.Marshall(["h", "h", "w"], [EV_KEY, event.keyCode, 1], this.replybuffer, 0);
    this.SendReply(0, desc.idx);

}

VirtioInput.prototype.OnKeyUp = function(event) {
    if (this.receivebufferdesc.length == 0) return;
    var desc = this.receivebufferdesc[0];
    this.receivebufferdesc.shift();
    this.replybuffersize = 8;
    // type, code and value
    marshall.Marshall(["h", "h", "w"], [EV_KEY, event.keyCode, 0], this.replybuffer, 0);
    this.SendReply(0, desc.idx);
}


VirtioInput.prototype.WriteConfig = function (addr, val) {
    this.configspace[addr] = val;
    if (addr != 1) return;
    //message.Debug("virtioinput configtype: " + this.configspace[0x0] + " " + this.configspace[0x1]);
    
    switch(this.configspace[0x0]) {
        case VIRTIO_INPUT_CFG_UNSET:
            break;

        case VIRTIO_INPUT_CFG_ID_NAME:
            this.configspace[2] = 5; // size
            this.configspace[8] = 0x56; // "V"
            this.configspace[9] = 0x4B; // "K"
            this.configspace[10] = 0x42; // "B"
            this.configspace[11] = 0x44; // "D"
            this.configspace[12] = 0;
            break;

        case VIRTIO_INPUT_CFG_ID_SERIAL:
            this.configspace[2] = 0; // size
            this.configspace[8] = 0;
            break;

        case VIRTIO_INPUT_CFG_ID_DEVIDS:
            this.configspace[2] = 0; // size
            break;

        case VIRTIO_INPUT_CFG_PROP_BITS:
            this.configspace[2] = 0;
            break;

        case VIRTIO_INPUT_CFG_EV_BITS:
            switch(this.configspace[1]) {
                case EV_REP:
                    this.configspace[2] = 0;
                    break;

                case EV_KEY:
                    this.configspace[2] = 128/8;
                    this.configspace[8] = 0xFF;
                    this.configspace[9] = 0xFF;
                    this.configspace[10] = 0xFF;
                    this.configspace[11] = 0xFF;
                    this.configspace[12] = 0xFF;
                    this.configspace[13] = 0xFF;
                    this.configspace[14] = 0xFF;
                    this.configspace[15] = 0xFF;
                    this.configspace[16] = 0xFF;
                    this.configspace[17] = 0xFF;
                    this.configspace[18] = 0xFF;
                    this.configspace[19] = 0xFF;
                    this.configspace[20] = 0xFF;
                    this.configspace[21] = 0xFF;
                    this.configspace[22] = 0xFF;
                    this.configspace[22] = 0xFF;
                    break;

                default:
                    this.configspace[2] = 0;
                    break;
            }
            break;

        case VIRTIO_INPUT_CFG_ABS_INFO:
            this.configspace[2] = 0;
            message.Debug("Virtioinput: abs_info not implemented");
            message.Abort();
            break;

        default:
            message.Debug("Error in virtio input: Unknown config");
            message.Abort();
        break;
    }

}

VirtioInput.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    //message.Debug("Virtio input request " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx >= 1) {
        message.Debug("Error in Virtio input: Unsupported queue index");
        message.Abort();
    }

    if (queueidx == 0) {
        // for some reason, some descriptors are sent multiple times. So check and return.
        for(var i=0; i<this.receivebufferdesc.length; i++) {
            if (this.receivebufferdesc[i].idx == index) {
                return;
            }
        }
        this.receivebufferdesc.push({idx: index, size: size});
        return;
    }

}

module.exports = VirtioInput;
