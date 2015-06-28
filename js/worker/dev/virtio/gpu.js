// -------------------------------------------------
// -------------- GPU Virtio Device ----------------
// -------------------------------------------------
//https://github.com/qemu/qemu/blob/master/hw/display/virtio-gpu.c
//https://www.kraxel.org/cgit/linux/commit/?h=virtio-gpu&id=1a9b48b35ab5961488a401276c7c574f7f90763f
//https://www.kraxel.org/blog/
//https://www.kraxel.org/virtio/virtio-v1.0-csprd03-virtio-gpu.html

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_GPU_UNDEFINED = 0;

/* 2d commands */
var VIRTIO_GPU_CMD_GET_DISPLAY_INFO = 0x0100;
var VIRTIO_GPU_CMD_RESOURCE_CREATE_2D = 0x0101;
var VIRTIO_GPU_CMD_RESOURCE_UNREF = 0x0102;
var VIRTIO_GPU_CMD_SET_SCANOUT = 0x0103;
var VIRTIO_GPU_CMD_RESOURCE_FLUSH = 0x0104;
var VIRTIO_GPU_CMD_TRANSFER_TO_HOST_2D = 0x0105;
var VIRTIO_GPU_CMD_RESOURCE_ATTACH_BACKING = 0x0106;
var VIRTIO_GPU_CMD_RESOURCE_DETACH_BACKING = 0x0107;

/* cursor commands */
var VIRTIO_GPU_CMD_UPDATE_CURSOR = 0x0300;
var VIRTIO_GPU_CMD_MOVE_CURSOR = 0x0301;

/* success responses */
var VIRTIO_GPU_RESP_OK_NODATA = 0x1100;
var VIRTIO_GPU_RESP_OK_DISPLAY_INFO = 0x1101;

/* error responses */
var VIRTIO_GPU_RESP_ERR_UNSPEC = 0x1200;
var VIRTIO_GPU_RESP_ERR_OUT_OF_MEMORY = 0x1201;
var VIRTIO_GPU_RESP_ERR_INVALID_SCANOUT_ID = 0x1202;
var VIRTIO_GPU_RESP_ERR_INVALID_RESOURCE_ID = 0x1203;
var VIRTIO_GPU_RESP_ERR_INVALID_CONTEXT_ID = 0x1204;
var VIRTIO_GPU_RESP_ERR_INVALID_PARAMETER = 0x1205;


var VIRTIO_GPU_EVENT_DISPLAY  = (1 << 0);
/*
struct virtio_gpu_config {
	__u32 events_read;
	__u32 events_clear;
	__u32 num_scanouts;
	__u32 reserved;
};
*/

function VirtioGPU(ramdev) {
    // virtio_gpu_config
    this.configspace = [
    0x0, 0x0, 0x0, 0x0, // events_read: signals pending events to the driver. The driver MUST NOT write to this field. 
    0x0, 0x0, 0x0, 0x0, // events_clear: clears pending events in the device. Writing a ’1’ into a bit will clear the corresponding bit in events_read, mimicking write-to-clear behavior.
    0x1, 0x0, 0x0, 0x0, // num_scanouts maximum 16
    0x0, 0x0, 0x0, 0x0, // reserved
    ];

    this.deviceid = 16;
    this.hostfeature = 0x0;

    this.replybuffersize = 0;
    this.replybuffer = new Uint8Array(1024);

    this.Reset();
}

VirtioGPU.prototype.Reset = function() {
    this.resource = new Array();
}

VirtioGPU.prototype.ReplyOk = function(index) {
    marshall.Marshall(["w", "w", "d", "w", "w"], [VIRTIO_GPU_RESP_OK_NODATA, 0,0,0,0], this.replybuffer, 0);
    this.replybuffersize = 24;
    this.SendReply(0, index);
}


VirtioGPU.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    message.Debug("");
    message.Debug("Virtio GPU request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx != 0) {
        message.Debug("Error in virtio gpu: queue no. " + queueidx + " unknown");
        message.Abort();
    }
    
    // virtio_gpu_ctrl_hdr
    var request = marshall.Unmarshall2(["w", "w", "d", "w", "w"], GetByte);
    var type = request[0];
    var ctx_id = request[3]; // not used in 2D mode
    message.Debug(
    "type: " + type + 
    " flags: " + request[1] + 
    " fence: " + request[2] + 
    " ctx_id: " + ctx_id );


    switch(request[0]) {

// --------------------------

        case VIRTIO_GPU_CMD_GET_DISPLAY_INFO:
            // struct virtio_gpu_resp_display_info
            marshall.Marshall(["w", "w", "d", "w", "w"], [VIRTIO_GPU_RESP_OK_DISPLAY_INFO, 0,0,0,0], this.replybuffer, 0);
            for(var i=0; i<24+16*24; i++) {
                this.replybuffersize[i] = 0x0;
            }
            // one display connected with 1024x768 enabled=1
            marshall.Marshall(["w", "w", "w", "w", "w", "w"], [0, 0, 1024, 768, 1, 0], this.replybuffer, 24);
            message.Debug("get display info");
            this.replybuffersize = 24 + 16*(16+8);
            this.SendReply(queueidx, index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_RESOURCE_CREATE_2D:
            // struct virtio_gpu_resource_create_2d
            var request = marshall.Unmarshall2(["w", "w", "w", "w"], GetByte);
            var resource_id = request[0];
            var width = request[2];
            var height = request[3];
            var format = request[1];
            if (resource_id == 0) {
                message.Debug("Error in virtio gpu: resource_id is 0");
            }
            this.resource[resource_id] = {
                valid: true, 
                width:width, 
                height:height, 
                format:format, 
                addr:0x0, 
                length: 0x0,
                scanout_id: -1};
            message.Debug("create 2d: " + width  + "x" + height + " format: " + format + " resource_id: " + request[0]);
            this.ReplyOk(index);
            break;

        case VIRTIO_GPU_CMD_RESOURCE_UNREF:
            // struct virtio_gpu_resource_unref
            var request = marshall.Unmarshall2(["w"], GetByte);
            var resource_id = request[0];
            
            this.resource[resource_id].valid = false;
            message.Debug("resource unref: resource_id: " + request[0]);
            this.ReplyOk(index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_RESOURCE_ATTACH_BACKING:
            // struct virtio_gpu_resource_attach_backing
            var request = marshall.Unmarshall2(["w", "w"], GetByte);
            var nr_entries = request[1];
            var resource_id = request[0];
            message.Debug("attach backing: resource_id: " + resource_id + " nr_entries:" + request[1] );
            for(var i=0; i<nr_entries; i++) {
                // struct virtio_gpu_mem_entry
                var request = marshall.Unmarshall2(["d", "w", "w"], GetByte);
                message.Debug("attach backing: addr:" + utils.ToHex(request[0]) + " length: " + request[1]);
                this.resource[resource_id].addr = request[0];
                this.resource[resource_id].length = request[1];
            }
            this.ReplyOk(index);
            break;

        case VIRTIO_GPU_CMD_RESOURCE_DETACH_BACKING:
            // struct virtio_gpu_resource_detach_backing
            var request = marshall.Unmarshall2(["w"], GetByte);
            var resource_id = request[0];
            message.Debug("detach backing: resource_id: " + resource_id);
            this.resource[resource_id].addr = 0x0;
            this.resource[resource_id].length = 0x0;
            this.ReplyOk(index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_SET_SCANOUT:
            var request = marshall.Unmarshall2(["w", "w", "w", "w", "w", "w"], GetByte);
            var x = request[0];
            var y = request[1];
            var width = request[2];
            var height = request[3];
            var scanout_id = request[4];
            var resource_id = request[5];
            message.Debug("set scanout: x: " + x + " y: " + y + " width: " + width + " height: " + height + " scanout_id: " + scanout_id + " resource_id: " + resource_id);
            if (resource_id != 0)
                this.resource[resource_id].scanout_id = scanout_id;
            this.ReplyOk(index);
            break;

        default:
            message.Debug("Error in virtio gpu: Unknown type " + type);
            message.Abort();
        break;
    }


}

module.exports = VirtioGPU;
