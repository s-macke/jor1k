// -------------------------------------------------
// -------------------- HTIF -----------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');
var bzip2 = require('../bzip2');
var syscalls = require('./syscalls');

// -------------------------------------------------

function StringToBytes(str, ram, offset) {
    for(var i=0; i<str.length; i++) {
        ram.Write8(offset+i, str.charCodeAt(i));
    }
    ram.Write8(offset+str.length, 0);
}


// -------------------------------------------------


function HTIFFB(ram, SendFunc) {
    this.ram = ram;
    this.identify = "rfb";
    this.Send = SendFunc;
    this.width = 640;
    this.height = 400;
    this.paddr = 0x0;

    this.Read = function(value) {
        this.width  = (value >>  0)&0xFFFF;
        this.height = (value >> 16)&0xFFFF;
        this.n = (this.width * this.height)>>1;
        this.buffer = new Int32Array(this.n);
        this.Send(3, 0, 1);
    }

    this.Write = function(value) {
        this.paddr = value;
        this.Send(3, 1, 1);
    }

    this.OnGetFB = function() {
        if (this.paddr == 0x0) return;
        message.Send("GetFB", this.GetBuffer() );
    }

    this.GetBuffer = function () {
        var i=0, n = this.buffer.length;
        var data = this.buffer;
        var mem = this.ram.int32mem;
        var addr = this.paddr>>2;
        for (i = 0; i < n; ++i) {
            data[i] = mem[addr+i];
        }
        return this.buffer;
    }

    message.Register("GetFB", this.OnGetFB.bind(this) );
};


// -------------------------------------------------

function HTIFConsole(ram, SendFunc) {
    this.ram = ram;
    this.identify = "bcd";
    this.Send = SendFunc;
    this.charqueue = [];
    this.readpresent = false;

    this.Read = function(value) {
        //message.Debug("Read: " + value);
        //this.Send(1, 0, 1);
        this.readpresent = true;
        if (this.charqueue.length == 0) return;
        this.Send(1, 0, this.charqueue.shift());
        this.readpresent = false;
    }

    this.Write = function(value) {
        this.ram.Write8(0x90000000 >> 0, value);
        if (value == 0xA) this.ram.Write8(0x90000000 >> 0, 0xD);
        this.Send(1, 1, 1);
    }

    this.ReceiveChar = function(c) {
        this.charqueue = this.charqueue.concat(c);

        if (!this.readpresent) return;
        this.Send(1, 0, this.charqueue.shift());
        this.readpresent = false;

    }

    message.Register("htif.term0.Transfer", this.ReceiveChar.bind(this) );

};

// -------------------------------------------------

function HTIFSyscall(ram, SendFunc) {
    this.ram = ram;
    this.Send = SendFunc;
    this.syscallHandler = new syscalls(this.ram);
    this.identify = "syscall_proxy";

    this.Read = function(value) {
        if((value>>>0) > 0x100) {
            this.syscallHandler.HandleSysCall(value);
        } else {
            this.ram.Write8(0x90000000 >> 0, value+0x30);
            message.Debug("return value: " + value);
            message.Abort();
       }
       this.Send(0, 0, 1);
    }

};

// -------------------------------------------------

function HTIFDisk(ram, SendFunc) {
    this.ram = ram;
    this.Send = SendFunc;
    this.buffer = new Uint8Array(1024*1024);
    this.identify = "disk size="+this.buffer.length;
    
    utils.LoadBinaryResourceII("../sys/riscv/ext2fsimage.bz2", 
    function(buffer) {
        this.buffer = new Uint8Array(20*1024*1024);

        var length = 0;
        var buffer8 = new Uint8Array(buffer);
	bzip2.simple(buffer8, function(x){this.buffer[length++] = x;}.bind(this));

        this.identify = "disk size="+this.buffer.length;   
    }.bind(this)
    , false, function(error){throw error;});

    this.Read = function(value) {
        var addr   = this.ram.Read32(value + 0);
        var offset = this.ram.Read32(value + 8);
        var size   = this.ram.Read32(value + 16);
        var tag    = this.ram.Read32(value + 24);
        //message.Debug("" + utils.ToHex(addr) + " " + utils.ToHex(offset) + " " + size + " " + tag);
        for(var i=0; i<size; i++) {
            this.ram.Write8(addr+i, this.buffer[offset+i]);
        }
        this.Send(2, 0, tag);
    }


    this.Write = function(value) {
        var addr   = this.ram.Read32(value + 0);
        var offset = this.ram.Read32(value + 8);
        var size   = this.ram.Read32(value + 16);
        var tag    = this.ram.Read32(value + 24);
        //message.Debug("" + utils.ToHex(addr) + " " + utils.ToHex(offset) + " " + size + " " + tag);
        for(var i=0; i<size; i++) {
            this.buffer[offset+i] = this.ram.Read8(addr+i);
        }
        this.Send(2, 1, tag);
    }
};

// -------------------------------------------------


// constructor
function HTIF(ram, irqdev) {
    this.ram = ram;
    this.irqdev = irqdev;
    
    this.device = [];

    this.device.push( new HTIFSyscall(this.ram, this.Send.bind(this)) ); // dev 0
    this.device.push( new HTIFConsole(this.ram, this.Send.bind(this)) ); // dev 1
    this.device.push( new HTIFDisk   (this.ram, this.Send.bind(this)) ); // dev 2
    this.device.push( new HTIFFB     (this.ram, this.Send.bind(this)) ); // dev 3

    this.devid = 0x0;
    this.cmd = 0x0;

    this.reg_tohost = 0x0;
    this.reg_devcmdfromhost = 0x0;

    this.fromhostqueue = [];
}

HTIF.prototype.Send = function(devid, cmd, data) {
    //message.Debug("Send " + devid + " " + cmd + " " + data);
    this.fromhostqueue.push({
        devid: devid, 
        cmd: cmd, 
        data: data});

    if (this.fromhostqueue.length == 1)
        this.reg_devcmdfromhost =
            (this.fromhostqueue[0].devid << 16) | this.fromhostqueue[0].cmd;

    this.irqdev.RaiseInterrupt(0xF);
}

// -------------------------------------------------

HTIF.prototype.ReadDEVCMDToHost = function() {
    return (this.devid << 16) | this.cmd;
}

HTIF.prototype.WriteDEVCMDToHost = function(value) {
    this.devid = value >>> 16;
    this.cmd = value & 0xFFFF;
}

// -------------------------------------------------

HTIF.prototype.WriteDEVCMDFromHost = function(value) {
    this.reg_devcmdfromhost = value;
    return;
}

HTIF.prototype.ReadDEVCMDFromHost = function() {
    if (this.fromhostqueue.length != 0)
        return this.reg_devcmdfromhost;
    else
        return 0x0;
}

// -------------------------------------------------

HTIF.prototype.ReadToHost = function() {
    return 0; // always immediate response
}

HTIF.prototype.WriteToHost = function(value) {
    this.reg_tohost = value|0;
    this.HandleRequest();
}

// -------------------------------------------------

HTIF.prototype.ReadFromHost = function() {
    //message.Debug("ReadFromHost " + this.fromhostqueue.length);
    if (this.fromhostqueue.length != 0)
        return this.fromhostqueue[0].data; 
    else
        return 0x0;
}

HTIF.prototype.WriteFromHost = function(value) {
    //message.Debug("WriteFromHost: " + value);
    //if (value == 1) message.Abort();
    if ((value == 0) && (this.reg_devcmdfromhost == 0))
    {
        this.fromhostqueue.shift();

        if (this.fromhostqueue.length > 0) {
            this.reg_devcmdfromhost =
                (this.fromhostqueue[0].devid << 16) | this.fromhostqueue[0].cmd;
            this.irqdev.RaiseInterrupt(0xF);
        }
    }
}

// -------------------------------------------------

HTIF.prototype.IsQueueEmpty = function() {
    return (this.fromhostqueue.length == 0)?true:false;
}


HTIF.prototype.HandleRequest = function() {

    //if (this.devid != 1)
    //    message.Debug("dev:" + this.devid + " cmd:" + this.cmd + " " + utils.ToHex(this.reg_tohost));

    if (this.cmd == 255) { // identify
        var pid = this.reg_tohost;

        if (!this.device[this.devid]) {
            this.ram.Write8(pid+0, 0x00);
        } else {
            StringToBytes(this.device[this.devid].identify, this.ram, pid);
        }
        this.Send(this.devid, 255, 1);
        this.reg_tohost = 0;
        return;
    }

    if (this.cmd == 0) { // read

        if (!this.device[this.devid]) {
            message.Debug("Error in HTIF: unknown read from device");
            message.Abort();
        } else {
            this.device[this.devid].Read(this.reg_tohost);
        }
        this.reg_tohost = 0;
        return;
    }

    if (this.cmd == 1) { // write
        
        if (!this.device[this.devid]) {
            message.Debug("Error in HTIF: unknown write from device");
            message.Abort();
        } else {
            this.device[this.devid].Write(this.reg_tohost);
        }
        this.reg_tohost = 0;
        return;
    }

    message.Debug("Error HTIF: unknown request");
    message.Abort();
}			

module.exports = HTIF;
