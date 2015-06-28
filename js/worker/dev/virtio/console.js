// -------------------------------------------------
// ------------ Console Virtio Device --------------
// -------------------------------------------------
// http://docs.oasis-open.org/virtio/virtio/v1.0/csprd01/virtio-v1.0-csprd01.html#x1-1230003

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_CONSOLE_DEVICE_READY     = 0;
var VIRTIO_CONSOLE_PORT_ADD         = 1;
var VIRTIO_CONSOLE_PORT_REMOVE      = 2;
var VIRTIO_CONSOLE_PORT_READY       = 3;
var VIRTIO_CONSOLE_CONSOLE_PORT     = 4;
var VIRTIO_CONSOLE_RESIZE           = 5;
var VIRTIO_CONSOLE_PORT_OPEN        = 6;
var VIRTIO_CONSOLE_PORT_NAME        = 7;

function VirtioConsole(ramdev) {
    this.configspace = [80, 0, 24, 0, 1, 0, 0, 0]; // cols, rows, max_nr_ports
    this.deviceid = 0x3;
    this.hostfeature = 0x0;
    //this.hostfeature = 3; // VIRTIO_CONSOLE_F_MULTIPORT and VIRTIO_CONSOLE_F_SIZE
    //this.hostfeature = 2; // VIRTIO_CONSOLE_F_MULTIPORT

    this.replybuffersize = 0;
    this.replybuffer = new Uint8Array(8);

    //message.Register("virtio.tty" + id + ".transfer", this.ReceiveChar.bind(this) );

    this.Reset();
}

VirtioConsole.prototype.Receive = function(chars) {

}

VirtioConsole.prototype.Reset = function() {
}

VirtioConsole.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    message.Debug("Virtio console request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write)

    if (queueidx == 1) {
        var s = "";
        for(var i=0; i<size.read; i++)
        {
            s = s + String.fromCharCode(GetByte());
        }
        message.Debug("Write: " + s);
        this.replybuffersize = 0;
        this.SendReply(queueidx, index);
    }

    if (queueidx == 0) {


    }

    if (queueidx == 3) {
    var request = marshall.Unmarshall2(["w", "h", "h"], GetByte);
    var id = request[0]; /* Port number */
    var event = request[1]; /* The kind of control event */
    var value = request[2]; /* Extra information for the event */

    message.Debug("virtio console: " + id + " " + event + " " + value);
    switch(event) {
        case VIRTIO_CONSOLE_DEVICE_READY:
            this.replybuffersize = 0;
            this.SendReply(queueidx, index);
            break;
        default:
            message.Debug("Error in virtio console: Unknown event");
            message.Abort();
            break;
    }

    }


}

module.exports = VirtioConsole;
