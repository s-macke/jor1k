// -------------------------------------------------
// ------------ Network Virtio Device --------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

function VirtioNET(ramdev) {
    this.configspace = [0x00, 0x0, 0x0, 0x0, 0x0, 0x0]; // mac address
    this.deviceid = 1;
    this.hostfeature = (1<<5); // Device has given MAC address

    this.replybuffer = new Uint8Array(65550); // the maximum size of a TCP or UDP packet, plus the 14 byte ethernet header
    this.replybuffersize = 0;

    // TODO: not all networks addresses are valid
    for(var i=1; i<6; i++) {
        this.configspace[i] = Math.floor(Math.random()*256);
    }

    message.Register("ethmac", this.Receive.bind(this) );

    this.Reset();
}

VirtioNET.prototype.Reset = function() {
    this.receivebufferdesc = new Array();
    this.receivebuffer = new Array();
}


VirtioNET.prototype.Receive = function(buffer) {
    //message.Debug("Received packet of size " + buffer.byteLength);
    this.receivebuffer.push(buffer);
    this.HandleReceive();
}

VirtioNET.prototype.HandleReceive = function() {

    if (this.receivebuffer.length == 0) {
        return;
    }

    if (this.receivebufferdesc.length == 0) {
        return;
    }

    var buffer = new Uint8Array(this.receivebuffer[0]);
    var desc = this.receivebufferdesc[0];

    if (buffer.length > desc.size.write) {
        message.Debug("Error in VirtioNET: Received packet is larger than the next receive buffer");
        message.Abort();
    }
    
    this.receivebuffer.shift();
    this.receivebufferdesc.shift();

    // both buffers are valid so copy

    this.replybuffersize = buffer.length + 12;
    marshall.Marshall(["b", "b", "h", "h", "h", "h", "h"], [0, 0, 0, 0, 0, 0, 0], this.replybuffer, 0);
    for(var i=0; i<buffer.length; i++) {
        this.replybuffer[i+12] = buffer[i];
    }
    //this.replybuffersize = desc.size.write;

    //message.Debug("Send packet of size " + buffer.length + " and idx " + desc.idx);
    this.SendReply(0, desc.idx);
}


VirtioNET.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    //message.Debug("Virtio network request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx > 1) {
        message.Debug("Error in VirtioNET: Unsupported ringbuffer");
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
        this.HandleReceive();
        return;
    }

    var hdr = marshall.Unmarshall2(["b", "b", "h", "h", "h", "h", "h"], GetByte);
    //message.Debug(hdr);
    var frame = new Uint8Array(size.read - 12);
    for(var i=0; i<size.read-12; i++) {
        frame[i] = GetByte();
    }
    message.Send("ethmac", frame.buffer);

    this.replybuffersize = 0;
    this.SendReply(queueidx, index);
}

module.exports = VirtioNET;
