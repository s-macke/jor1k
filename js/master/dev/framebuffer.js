var message = require('../messagehandler');


"use strict";


function Framebuffer(fbid, fps) {
    this.fbid = fbid;

    this.Init(fbid);
    this.SetFPS(fps);
}


// Init Framebuffer if it exists
Framebuffer.prototype.Init = function(fbid) {
    this.fbcanvas = document.getElementById(fbid);
    if(!this.fbcanvas) return;

    this.fbctx = this.fbcanvas.getContext("2d");
    this.fbctx.fillStyle = "rgba(0, 0, 0, 255)";
    this.fbctx.fillRect ( 0, 0 , this.fbcanvas.width, this.fbcanvas.height );

    this.fbimageData = this.fbctx.createImageData(this.fbcanvas.width, this.fbcanvas.height);

    this.fbcanvas.onmousedown = function(event) {
        this.fbcanvas.style.border = "2px solid #FF0000";
        var rect = this.fbcanvas.getBoundingClientRect();
        var x = (event.clientX - rect.left)*640/rect.width;
        var y = (event.clientY - rect.top)*400/rect.height;
        message.Send("tsmousedown", {x:x, y:y});
    }.bind(this);

    this.fbcanvas.onmouseup = function(event) {
        var rect = this.fbcanvas.getBoundingClientRect();
        var x = (event.clientX - rect.left)*640/rect.width;
        var y = (event.clientY - rect.top)*400/rect.height;
        message.Send("tsmouseup", {x:x, y:y});
    }.bind(this);

    this.fbcanvas.onmousemove = function(event) {
        var rect = this.fbcanvas.getBoundingClientRect();
        var x = (event.clientX - rect.left)*640/rect.width;
        var y = (event.clientY - rect.top)*400/rect.height;
        message.Send("tsmousemove", {x:x, y:y});
    }.bind(this);
}


// receive interval of the contents of the framebuffer
Framebuffer.prototype.SetFPS = function(fps) {
    this.fps = fps;
    if(!this.fbcanvas) return;
    if (this.fbinterval) {
        window.clearInterval(this.fbinterval);
    }
    if (fps != 0) {
        this.fbinterval = window.setInterval(function(){message.Send("GetFB", 0)}.bind(this), 1000/this.fps);
    }
}


Framebuffer.prototype.Update = function(buffer) {
    if(!this.fbcanvas) return;
    //if(this.userpaused) return;
    var i=0, n = buffer.length;
    var data = this.fbimageData.data;

    var offset = 0x0;
    for (i = 0; i < n; i++) {
        var x = buffer[i];
        data[offset++] = (x >> 24) & 0xF8;
        data[offset++] = (x >> 19) & 0xFC;
        data[offset++] = (x >> 13) & 0xF8;
        data[offset++] = 0xFF;
        data[offset++] = (x >> 8) & 0xF8;
        data[offset++] = (x >> 3) & 0xFC;
        data[offset++] = (x << 3) & 0xF8;
        data[offset++] = 0xFF;
    }

    //data.set(buffer);
    this.fbctx.putImageData(this.fbimageData, 0, 0); // at coords 0,0
}


module.exports = Framebuffer;
