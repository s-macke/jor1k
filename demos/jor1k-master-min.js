require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
//download.js v3.1, by dandavis; 2008-2014. [CCBY2] see http://danml.com/download.html for tests/usage
// v1 landed a FF+Chrome compat way of downloading strings to local un-named files, upgraded to use a hidden frame and optional mime
// v2 added named files via a[download], msSaveBlob, IE (10+) support, and window.URL support for larger+faster saves than dataURLs
// v3 added dataURL and Blob Input, bind-toggle arity, and legacy dataURL fallback was improved with force-download mime and base64 support. 3.1 improved safari handling.

// https://github.com/rndme/download

// data can be a string, Blob, File, or dataURL
function download(data, strFileName, strMimeType) {
	
	var self = window, // this script is only for browsers anyway...
		u = "application/octet-stream", // this default mime also triggers iframe downloads
		m = strMimeType || u, 
		x = data,
		D = document,
		a = D.createElement("a"),
		z = function(a){return String(a);},
		B = (self.Blob || self.MozBlob || self.WebKitBlob || z);
		B=B.call ? B.bind(self) : Blob ;
		var fn = strFileName || "download",
		blob, 
		fr;

	
	if(String(this)==="true"){ //reverse arguments, allowing download.bind(true, "text/xml", "export.xml") to act as a callback
		x=[x, m];
		m=x[0];
		x=x[1]; 
	}
	
	


	//go ahead and download dataURLs right away
	if(String(x).match(/^data\:[\w+\-]+\/[\w+\-]+[,;]/)){
		return navigator.msSaveBlob ?  // IE10 can't do a[download], only Blobs:
			navigator.msSaveBlob(d2b(x), fn) : 
			saver(x) ; // everyone else can save dataURLs un-processed
	}//end if dataURL passed?
	
	blob = x instanceof B ? 
		x : 
		new B([x], {type: m}) ;
	
	
	function d2b(u) {
		var p= u.split(/[:;,]/),
		t= p[1],
		dec= p[2] == "base64" ? atob : decodeURIComponent,
		bin= dec(p.pop()),
		mx= bin.length,
		i= 0,
		uia= new Uint8Array(mx);

		for(i;i<mx;++i) uia[i]= bin.charCodeAt(i);

		return new B([uia], {type: t});
	 }
	  
	function saver(url, winMode){
		
		if ('download' in a) { //html5 A[download] 			
			a.href = url;
			a.setAttribute("download", fn);
			a.innerHTML = "downloading...";
			D.body.appendChild(a);
			setTimeout(function() {
				a.click();
				D.body.removeChild(a);
				if(winMode===true){setTimeout(function(){ self.URL.revokeObjectURL(a.href);}, 250 );}
			}, 66);
			return true;
		}

		if(typeof safari !=="undefined" ){ // handle non-a[download] safari as best we can:
			url="data:"+url.replace(/^data:([\w\/\-\+]+)/, u);
			if(!window.open(url)){ // popup blocked, offer direct download: 
				if(confirm("Displaying New Document\n\nUse Save As... to download, then click back to return to this page.")){ location.href=url; }
			}
			return true;
		}
		
		//do iframe dataURL download (old ch+FF):
		var f = D.createElement("iframe");
		D.body.appendChild(f);
		
		if(!winMode){ // force a mime that will download:
			url="data:"+url.replace(/^data:([\w\/\-\+]+)/, u);
		}
		f.src=url;
		setTimeout(function(){ D.body.removeChild(f); }, 333);
		
	}//end saver 
		



	if (navigator.msSaveBlob) { // IE10+ : (has Blob, but not a[download] or URL)
		return navigator.msSaveBlob(blob, fn);
	} 	
	
	if(self.URL){ // simple fast and modern way using Blob and URL:
		saver(self.URL.createObjectURL(blob), true);
	}else{
		// handle non-Blob()+non-URL browsers:
		if(typeof blob === "string" || blob.constructor===z ){
			try{
				return saver( "data:" +  m   + ";base64,"  +  self.btoa(blob)  ); 
			}catch(y){
				return saver( "data:" +  m   + "," + encodeURIComponent(blob)  ); 
			}
		}
		
		// Blob but not URL:
		fr=new FileReader();
		fr.onload=function(e){
			saver(this.result); 
		};
		fr.readAsDataURL(blob);
	}	
	return true;
} /* end download() */

module.exports = download;

},{}],2:[function(require,module,exports){
// -------------------------------------------------
// ------------------ UTF8 Helpers -----------------
// -------------------------------------------------
// http://en.wikipedia.org/wiki/UTF-8
"use strict";

function UTF8StreamToUnicode() {

    this.stream = new Uint8Array(5);
    this.ofs = 0;

    this.Put = function(key) {
        this.stream[this.ofs] = key;
        this.ofs++;
        switch(this.ofs) {
            case 1:
                if (this.stream[0] < 0x80) {
                    this.ofs = 0;
                    return this.stream[0];
                }
                break;

            case 2:
                if ((this.stream[0]&0xE0) == 0xC0)
                if ((this.stream[1]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0x1F)<<6) | 
                        ((this.stream[1]&0x3F)<<0);
                }
                break;

            case 3:
                if ((this.stream[0]&0xF0) == 0xE0)
                if ((this.stream[1]&0xC0) == 0x80)
                if ((this.stream[2]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0xF ) << 12) | 
                        ((this.stream[1]&0x3F) << 6)  | 
                        ((this.stream[2]&0x3F) << 0);
                }
                break;

            case 4:
                if ((this.stream[0]&0xF8) == 0xF0)
                if ((this.stream[1]&0xC0) == 0x80)
                if ((this.stream[2]&0xC0) == 0x80)
                if ((this.stream[3]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0x7 ) << 18) | 
                        ((this.stream[1]&0x3F) << 12) | 
                        ((this.stream[2]&0x3F) << 6)  |
                        ((this.stream[3]&0x3F) << 0);
                }
                this.ofs = 0;
                return -1; //obviously illegal character, so reset
                break;

            default:
                this.ofs = 0;
                return -1;
                break;
        }
        return -1;
    }

}

function UnicodeToUTF8Stream(key) {
    key = key|0;
    if (key < 0x80) {
        return [key];
    } else 
    if (key <= 0x7FF) {
        return [
            (key >> 6) | 0xC0, 
            (key & 0x3F) | 0x80
            ];
    } else 
    if (key <= 0xFFFF) {
        return [
            (key >> 12) | 0xE0,
            ((key >> 6) & 0x3F) | 0x80,
            (key & 0x3F) | 0x80
            ];
    } else 
    if (key <= 0x10FFFF) {
        return [
            (key >> 18) | 0xF0,
            ((key >> 12) & 0x3F) | 0x80,
            ((key >> 6) & 0x3F) | 0x80,
            (key & 0x3F) | 0x80
            ];
    } else {
        //message.Debug("Error in utf-8 encoding: Invalid key");
    }
    return [];
}

function UTF8Length(s)
{
    var length = 0;
    for(var i=0; i<s.length; i++) {
        var key = s.charCodeAt(i);
        if (key < 0x80) {
            length += 1;
        } else
        if (key <= 0x7FF) {
            length += 2;
        } else 
        if (key <= 0xFFFF) {
            length += 3;
        } else 
        if (key <= 0x10FFFF) {
            length += 4;
        } else {
        }
    }
    return length;
}

module.exports.UTF8StreamToUnicode = UTF8StreamToUnicode;
module.exports.UTF8Length = UTF8Length;
module.exports.UnicodeToUTF8Stream = UnicodeToUTF8Stream;

},{}],3:[function(require,module,exports){
// manages the websocket connection for the ethmac peripheral

var message = require('../messagehandler');

"use strict";

function Ethernet(relayURL) {
    this.url = relayURL;
    this.onmessage = function(e) { };
    this.ntries = 0;
    this.OpenSocket();
}

function EthernetMessageHandler(e) {
    // if we recv binary data, call the onmessage handler
    // which was assigned to this Ethernet object
    if (e.data instanceof ArrayBuffer) {
        this.onmessage(e);
    } else
        // otherwise, this might be a textual "ping" message to keep
        // the connection alive
        if (e.data.toString().indexOf('ping:') == 0) {
        this.socket.send('pong:' + e.data.toString().substring(5));
    }
}

function EthernetOpenHandler(e) {
    this.ntries = 0;
}

function EthernetCloseHandler(e) {
    // reopen websocket if it closes
    if (this.ntries > 3) {
        message.Debug("Websocket error: Connection failed");
        return;
    }
    this.ntries++;
    message.Debug("Websocket closed. Reopening.");
    this.OpenSocket();
}

function EthernetErrorHandler(e) {
    // just report the error to console, close event
    // will handle reopening if possible
    message.Debug("Websocket error:");
    message.Debug(e);
}

Ethernet.prototype.OpenSocket = function() {        
    try {
        this.socket = new WebSocket(this.url);
    } catch(err) {
        delete this.socket;
        EthernetErrorHandler(err);
        return;
    }
    this.socket.binaryType = 'arraybuffer';
    this.socket.onmessage = EthernetMessageHandler.bind(this);
    this.socket.onclose = EthernetCloseHandler.bind(this);
    this.socket.onopen = EthernetOpenHandler.bind(this);
    this.socket.onerror = EthernetErrorHandler.bind(this);
}

Ethernet.prototype.SendFrame = function(data) {
    if (typeof this.socket == "undefined") return;
    try {
        this.socket.send(data);
    } catch (err) {
        // this is unusual error, object exists, but send does not work 
        EthernetErrorHandler(err);
    }
}

Ethernet.prototype.Close = function() {
    this.socket.onclose = undefined;
    this.socket.close();
}

module.exports = Ethernet;

},{"../messagehandler":9}],4:[function(require,module,exports){
var message = require('../messagehandler');
var download = require('../../lib/download');
var utils = require('../utils');

"use strict";

function Filesystem(syncURL, userid) {
    this.syncURL = syncURL;
    this.userid = userid;
}

Filesystem.prototype.TAR = function(path) {
    if (path == "") {
        path = "/home/user";
    }
    var arrayPath = path.split('/');
    message.Register("tar", function(d){download(d, arrayPath[arrayPath.length-1]+".tar", "application/x-tar");} );
    message.Send("tar", path);
}

Filesystem.prototype.Sync = function(path) {
    message.Register("sync", this.OnSync.bind(this));
    message.Send("sync", path);
}

Filesystem.prototype.OnSync = function(d) {
    utils.UploadBinaryResource(this.syncURL, this.userid + ".tar", d,
        function(response) {
            alert(
                "Message from Server:" + response + "\n" +
                "The home folder '/home/user' has been synced with the server\n" +
                "In order to access the data at a later date,\n" +
                "start the next session with the current url with the user id\n" +
                "The folder size is currently limited to 1MB. Note that the feature is experimental.\n" +
                "The content can be downloaded under http://jor1k.com/sync/tarballs/" + this.userid+".tar.bz2"
            );
            }.bind(this),
        function(msg) {alert(msg);}
    );
}

Filesystem.prototype.UploadExternalFile = function(path, f) {
    var reader = new FileReader();
    if (path.slice(-1) != '/') {
        path += '/';
    }
    reader.onload = function(e) {
        message.Send("MergeFile",
        {name: path+f.name, data: new Uint8Array(reader.result)});
    }.bind(this);
    reader.readAsArrayBuffer(f);
}

Filesystem.prototype.MergeFile = function(fileName, data) {
  function stringToUint(string) {
    var charList = string.split(''),
        uintArray = [];
    for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
  }
  message.Send("MergeFile", {name: fileName, data: stringToUint(data)});
}

Filesystem.prototype.MergeBinaryFile = function(fileName, data) {
  message.Send("MergeFile", {name: fileName, data: data});
}

Filesystem.prototype.CreateDirectory = function(dirctoryName) {
    message.Send("CreateDirectory", dirctoryName );
}

Filesystem.prototype.ReadFile = function(fileName, callback) {
  message.Register("ReadFile", callback);
  message.Send("ReadFile", { name: fileName });
}

//deletes contents of specified directory.
Filesystem.prototype.DeleteDirContents = function(dirPath) {
    message.Send("DeleteDirContents", dirPath);
}

//deletes file, recursively deletes dir
Filesystem.prototype.DeleteNode = function(nodeName) {
    message.Send("DeleteNode", nodeName);
}

Filesystem.prototype.Rename = function(oldPath, newPath) {
    message.Send("Rename", {oldPath:oldPath, newPath: newPath});
}

Filesystem.prototype.WatchFile = function(fileName, callback) {
  message.Register("WatchFileEvent", callback);
  message.Send("WatchFile", { name: fileName });
}

Filesystem.prototype.WatchDirectory = function(directoryPath, callback) {
  message.Register("WatchDirectoryEvent", callback);
  message.Send("WatchDirectory", { name: directoryPath });
}

module.exports = Filesystem;

},{"../../lib/download":1,"../messagehandler":9,"../utils":11}],5:[function(require,module,exports){
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

},{"../messagehandler":9}],6:[function(require,module,exports){
// Provides a loop sound buffer.

var message = require('../messagehandler');

"use strict";

function LoopSoundBuffer(samplerate) {
    this.enabled = false;
    this.nperiods = 8; // number of periods

    this.source = new Array(this.nperiods);
    this.soundbuffer = new Array(this.nperiods);

    this.period = 0;
    this.periodsize = 0;
    this.bufferpos = 0;

    if (typeof AudioContext == "undefined") return;

    this.context = new AudioContext();
    this.SetRate(samplerate);
}

LoopSoundBuffer.prototype.SetRate = function(rate) {
    if (this.samplerate == rate) return;
    if (typeof this.context === "undefined") return;
    this.samplerate = rate;
    this.periodsize = Math.floor(this.samplerate/4); // 250ms
    this.sampleslen = this.periodsize*this.nperiods;
    this.buffer = new Float32Array(this.sampleslen);

    for(var i=0; i<this.nperiods; i++) {
        this.soundbuffer[i] = this.context.createBuffer(1, this.periodsize, this.samplerate);
    }
}

LoopSoundBuffer.prototype.OnEnded = function()
{
    if (!this.enabled) return;
    this.PlayBuffer(this.period);
    this.period++;
}

LoopSoundBuffer.prototype.Enabled = function(e)
{
    this.enabled = e;
    if (typeof this.context === "undefined") return;
    if (!e) return;
    this.period = 0;
    this.basetime = this.context.currentTime;
    this.PlayBuffer(0);
    this.PlayBuffer(1);
    this.period = 2;
    this.bufferpos = this.periodsize*(this.period+4);
}

LoopSoundBuffer.prototype.PlayBuffer = function(period)
{
    if (!this.enabled) return;
    var idx = period % this.nperiods;
    var buffer = this.soundbuffer[idx].getChannelData(0);
    var offset = idx * this.periodsize;
    for(var i=0; i<this.periodsize; i++) {
        buffer[i] = this.buffer[i + offset];
        this.buffer[i+offset] = 0;
    }
    var source = this.context.createBufferSource(); // creates a sound source
    source.buffer = this.soundbuffer[idx];
    source.connect(this.context.destination);
    source.onended = this.OnEnded.bind(this);
    source.start(this.basetime + period*(this.periodsize)/this.samplerate);

    // save the source. Otherwise the garbage collector might take them and the function OnEnded is not executed
    this.source[idx] = source;
}

LoopSoundBuffer.prototype.AddBuffer = function(addbuffer)
{
    if (!this.enabled) return;

    var currentperiod = (this.bufferpos / this.periodsize);
    if ((currentperiod) < (this.period+2)) {
        this.bufferpos = this.periodsize*(this.period+4);
        //message.Debug("Warning: Sound buffer underrun, resetting");
    }
    if (currentperiod > (this.period+5)) {
        this.bufferpos = this.periodsize*(this.period+4);
        //message.Debug("Warning: Sound buffer overrun, resetting");
    }

    for(var i=0; i<addbuffer.length; i++) {
        this.buffer[this.bufferpos%this.sampleslen] = addbuffer[i]/128.;
        this.bufferpos++;
    }
}

module.exports = LoopSoundBuffer;

},{"../messagehandler":9}],7:[function(require,module,exports){
// -------------------------------------------------
// -------------- Terminal Input -------------------
// -------------------------------------------------

// for the special keys look at
// http://www2.gar.no/glinkj/help/cmds/ansm.htm
// http://www.comptechdoc.org/os/linux/howlinuxworks/linux_hlkeycodes.html

"use strict";

var UTF8 = require('../../lib/utf8');

function TerminalInput(SendChars) {
    this.CTRLpressed = false;
    this.ALTpressed = false;
    this.SendChars = SendChars;
    this.enabled = true;
}


TerminalInput.prototype.OnKeyPress = function(e) {
    if (!this.enabled) {
        return;
    }
    var key = 0;
    key = e.charCode;
    if (key == 0) {
        return false;
    }
    // Define that the control key has this effect only if special keys have been pressed A..Z a..z. Otherwise some foreign keyboards will not work
    if ((this.CTRLpressed) && (((key >= 0x41) && (key <= 0x5A)) || ((key >= 0x61) && (key <= 0x7A)))) {
        key &= 0x1F;
    }
    this.SendChars(UTF8.UnicodeToUTF8Stream(key));
    return false;
};

TerminalInput.prototype.OnKeyUp = function(e) {
    if (!this.enabled) {
        return;
    }
    var keycode = e.keyCode;
    var unicode = e.charCode;
    if (keycode == 17) {
        this.CTRLpressed = false;
    } else
    if (keycode == 18) {
        this.ALTpressed = false;
    }
    return false;
};

TerminalInput.prototype.OnKeyDown = function(e) {
    if (!this.enabled) {
        return;
    }
    var keycode = e.keyCode;
    var unicode = e.charCode;
 
    // CTRL + x key handling for chrome 
    if ((this.CTRLpressed) && (!this.ALTpressed) && (keycode >= 65) && (keycode <= 90)) {
        this.SendChars([(keycode-32) & 0x1F]);
        e.preventDefault();
        return false;
    }
    // TODO tab?
    switch (keycode) {
    case 8:
        // del
        this.SendChars([0x7F]);
        e.preventDefault();
        return false;
        break;
    case 9: 
        //tab
        break;
    case 16:
        // shift
        return;
        break;
    case 38:
        // up
        this.SendChars([0x1B, 0x5B, 0x41]);
        e.preventDefault();
        return false;
        break;
    case 37:
        // left
        this.SendChars([0x1B, 0x5B, 0x44]);
        e.preventDefault();
        return false;
        break;
    case 39:
        // right
        this.SendChars([0x1B, 0x5B, 0x43]);
        e.preventDefault();
        return false;
        break;
    case 40:
        // down
        this.SendChars([0x1B, 0x5B, 0x42]);
        e.preventDefault();
        return false;
        break;
    case 112:
    case 113:
    case 114:
    case 115:
    case 116:
        // F1 - F5
        this.SendChars([0x1B, 0x5B, 0x5B, keycode-112+0x41]);
        e.preventDefault();
        return false;
        break;
    case 117:
    case 118:
    case 119:
        // F6 - F8
        this.SendChars([0x1B, 0x5B, 0x31, keycode-117+0x37, 0x7E]);
        e.preventDefault();
        return false;
        break;
    case 120:
    case 121:
        // F9 - F10
        this.SendChars([0x1B, 0x5B, 0x32, keycode-120+0x30, 0x7E]);
        e.preventDefault();
        return false;
        break;

    case 36:
        // pos1
        this.SendChars([0x1b, 0x5b, 0x48]);
        e.preventDefault();
        return false;
        break;
    case 35:
        // end
        this.SendChars([0x1b, 0x5b, 0x46]);
        e.preventDefault();
        return false;
        break;
    case 33:
        // Page up
        this.SendChars([0x1b, 0x5b, 0x35, 0x7e]);
        e.preventDefault();
        return false;
        break;
    case 34:
        // Page down
        this.SendChars([0x1b, 0x5b, 0x36, 0x7e]);
        e.preventDefault();
        return false;
        break;
    case 45:
        // ins
        this.SendChars([0x1b, 0x5b, 0x32, 0x7e]);
        e.preventDefault();
        return false;
        break;
    case 46:
        // del
        this.SendChars([0x1b, 0x5b, 0x33, 0x7e]);
        e.preventDefault();
        return false;
        break;
    case 17:
        // CTRL
        this.CTRLpressed = true;
        //e.preventDefault();
        //return false;
        return;
        break;
    case 18:
        // Alt
        this.ALTpressed = true;
        return;
        break;
    }

    if ((keycode != 0) && (keycode <= 0x1F)) {
        this.SendChars([keycode]);
        e.preventDefault();
        return false;
    }
    
    return;
};


module.exports = TerminalInput;

},{"../../lib/utf8":2}],8:[function(require,module,exports){
// -------------------------------------------------
// --------------- Terminal Emulator ---------------
// -------------------------------------------------
// http://lxr.free-electrons.com/source/drivers/tty/vt/vt.c

"use strict";

let UTF8 = require('../../lib/utf8');
let message = require('../messagehandler');

const Colors = ["#000000", "#BB0000", "#00BB00", "#BBBB00",
    "#0000BB", "#BB00BB", "#00BBBB", "#BBBBBB",
    // brighter colors
    "#555555", "#FF5555", "#55FF55", "#FFFF55",
    "#5555FF", "#FF55FF", "#55FFFF", "#FFFFFF",
    // dimmed colors
    "#000000", "#770000", "#007700", "#777700",
    "#000077", "#770077", "#007777", "#777777"];


// constructor
function Terminal(nrows, ncolumns, elemId) {
    let i;
    this.nrows = nrows;
    this.ncolumns = ncolumns;

    let ele = document.getElementById(elemId);
    if (ele.tagName === "CANVAS") {
        this.canvas = ele;
        this.context = this.canvas.getContext("2d");
        this.context.font = "13px courier,fixed,swiss,monospace,sans-serif";
    } else {
        this.Table = ele;
        this.rowelements = new Array(this.nrows);
        for (i = 0; i < nrows; i++) {
            let TR = this.Table.insertRow(0);
            let TD = document.createElement("td");
            this.rowelements[i] = TD;
            TR.appendChild(TD);
        }
        // after appending new elements, Firefox needs some form of reset of the root class.
        this.Table.className = this.Table.className;
    }

    this.cursorvisible = false;
    this.escapetype = 0;
    this.escapestring = "";
    this.cursorx = 0;
    this.cursory = 0;
    this.scrolltop = 0;
    this.cursortype = 1;
    this.scrollbottom = this.nrows - 1;

    this.attr_color = 0x7;
    this.attr_reverse = false;
    this.attr_italic = false;
    this.attr_intensity = 0x1;

    this.pauseblink = false;
    this.OnCharReceived = function () {
    };

    this.framerequested = false;
    this.timeout = 30; // the time in ms when the next frame is drawn

    this.updaterow = new Uint8Array(this.nrows);

    this.utf8converter = new UTF8.UTF8StreamToUnicode();

    this.screen = new Array(this.nrows);
    this.color = new Array(this.nrows);
    for (i = 0; i < this.nrows; i++) {
        this.updaterow[i] = 1;
        this.screen[i] = new Uint16Array(this.ncolumns);
        this.color[i] = new Uint16Array(this.ncolumns);

        for (let j = 0; j < this.ncolumns; j++) {
            this.screen[i][j] = 0x20;
            this.color[i][j] = this.attr_color;
        }
    }
    this.UpdateScreen();
    this.Blink();
}

// Stop blinking cursor when the VM is paused
Terminal.prototype.PauseBlink = function (pause) {
    pause = !!pause;
    this.pauseblink = pause;
    if (this.cursortype) {
        this.cursorvisible = !pause;
    }
    this.PrepareUpdateRow(this.cursory, this.cursorx);
}

Terminal.prototype.GetColor = function () {
    let c = this.attr_color;
    if (this.attr_reverse) {
        c = ((c & 0x7) << 8) | ((c >> 8)) & 0x7;
    }
    if (this.attr_intensity === 2) {
        c = c | 0x8;
    } else if (this.attr_intensity === 0) {
        c = c | 0x10;
    }
    return c;
}

Terminal.prototype.Blink = function () {
    this.cursorvisible = !this.cursorvisible;
    if (!this.pauseblink) this.PrepareUpdateRow(this.cursory, this.cursorx);
    window.setTimeout(this.Blink.bind(this), 500); // update every half second
};

Terminal.prototype.DeleteRow = function (row) {
    for (let j = 0; j < this.ncolumns; j++) {
        this.screen[row][j] = 0x20;
        this.color[row][j] = this.attr_color;
    }
    this.PrepareUpdateRow(row);
};

Terminal.prototype.DeleteArea = function (row, column, row2, column2) {
    for (let i = row; i <= row2; i++) {
        for (let j = column; j <= column2; j++) {
            this.screen[i][j] = 0x20;
            this.color[i][j] = this.attr_color;
        }
        this.PrepareUpdateRow(i);
    }
};


Terminal.prototype.UpdateRowCanvas = function (row) {
    let i;
    let x;
    let column;
    let y = row << 4;
    let line = this.screen[row];
    let c = this.color[row][0] | 0;
    let n = 0;

    for (column = 0; column < this.ncolumns; column++) {

        let cnew = this.color[row][column] | 0;

        if (this.cursorvisible)
            if (row === this.cursory)
                if (column === this.cursorx) {
                    cnew |= 0x600;
                }

        if (c !== cnew) {
            x = (column - n) << 3;
            this.context.fillStyle = Colors[(c >>> 8) & 0x1F];
            this.context.fillRect(x, y, n * 8, 16);
            this.context.fillStyle = Colors[c & 0x1F];
            for (i = 0; i < n; i++) {
                this.context.fillText(String.fromCharCode(line[column - n + i]), x + (i << 3), y + 12);
            }
            c = cnew;
            n = 0;
        }

        n++;
    }

    x = (column - n) << 3;
    this.context.fillStyle = Colors[(c >>> 8) & 0x1F];
    this.context.fillRect(x, y, n * 8, 16);
    this.context.fillStyle = Colors[c & 0x1F];
    for (i = 0; i < n; i++) {
        this.context.fillText(String.fromCharCode(line[column - n + i]), x + (i << 3), y + 12);
    }

};

Terminal.prototype.GetSpan = function (c, line, idx, n) {
    let html = "<span style=\"color:" + Colors[c & 0x1F] + ";background-color:" + Colors[(c >> 8) & 0x1F] + "\">";
    for (let i = 0; i < n; i++) {
        switch (line[idx + i]) {
            case 0x20:
                html += "&nbsp;";
                break;

            case 0x26: // '&'
                html += "&amp;";
                break;

            case 0x3C: // '<'
                html += "&lt;";
                break;

            case 0x3E: // '>'
                html += "&gt;";
                break;

            default:
                html += String.fromCharCode(line[idx + i]);
                break;
        }
    }
    html += "</span>";
    return html;
}


Terminal.prototype.UpdateRowTable = function (row) {
    let column;
    let line = this.screen[row];
    let c = this.color[row][0] | 0;
    let n = 0;
    let html = "";

    for (column = 0; column < this.ncolumns; column++) {

        let cnew = this.color[row][column] | 0;

        if (this.cursorvisible)
            if (row === this.cursory)
                if (column === this.cursorx) {
                    cnew |= 0x600;
                }

        if (c !== cnew) {
            html += this.GetSpan(c, line, column - n, n);
            c = cnew;
            n = 0;
        }
        n++;
    }
    html += this.GetSpan(c, line, column - n, n);
    this.rowelements[this.nrows - row - 1].innerHTML = html;

};

Terminal.prototype.UpdateScreen = function () {
    let nupdated = 0;
    for (let i = 0; i < this.nrows; i++) {
        if (!this.updaterow[i]) continue;
        if (this.canvas) {
            this.UpdateRowCanvas(i);
        } else {
            this.UpdateRowTable(i);
        }
        nupdated++;
        this.updaterow[i] = 0;
    }
    this.framerequested = false;
    if (nupdated >= (this.nrows - 1)) {
        this.timeout = 100;
    } else {
        this.timeout = 30;
    }
}

Terminal.prototype.PrepareUpdateRow = function (row) {
    this.updaterow[row] = 1;
    if (this.framerequested) return;
    window.setTimeout(this.UpdateScreen.bind(this), this.timeout);
    this.framerequested = true;
}

Terminal.prototype.ScrollDown = function (draw) {
    let tempscreen = this.screen[this.scrollbottom];
    let tempcolor = this.color[this.scrollbottom];

    for (let i = this.scrollbottom - 1; i >= this.scrolltop; i--) {
        if (i === this.nrows - 1) continue;
        this.screen[i + 1] = this.screen[i];
        this.color[i + 1] = this.color[i];
        if (draw) this.PrepareUpdateRow(i + 1);
    }
    this.screen[this.scrolltop] = tempscreen;
    this.color[this.scrolltop] = tempcolor;
    this.DeleteRow(this.scrolltop);
    if (draw) this.PrepareUpdateRow(this.scrolltop);
}

Terminal.prototype.ScrollUp = function (draw) {
    let tempscreen = this.screen[this.scrolltop];
    let tempcolor = this.color[this.scrolltop];

    for (let i = this.scrolltop + 1; i <= this.scrollbottom; i++) {
        if (i === 0) continue;
        this.screen[i - 1] = this.screen[i];
        this.color[i - 1] = this.color[i];
        if (draw) this.PrepareUpdateRow(i - 1);
    }

    this.screen[this.scrollbottom] = tempscreen;
    this.color[this.scrollbottom] = tempcolor;
    this.DeleteRow(this.scrollbottom);
    if (draw) this.PrepareUpdateRow(this.scrollbottom);
};

Terminal.prototype.LineFeed = function () {
    if (this.cursory !== this.scrollbottom) {
        this.cursory++;
        if (this.cursorvisible) {
            this.PrepareUpdateRow(this.cursory - 1); // delete old cursor position
            this.PrepareUpdateRow(this.cursory); // show new cursor position
        }
        return;
    }
    this.ScrollUp(true);
};

Terminal.prototype.ChangeCursor = function (Numbers) {
    switch (Numbers.length) {
        case 0:
            this.cursorx = 0;
            this.cursory = 0;
            break;
        case 1:
            this.cursory = Numbers[0];
            if (this.cursory) this.cursory--;
            break;
        case 2:
        default:
            // TODO check for boundaries
            this.cursory = Numbers[0];
            this.cursorx = Numbers[1];
            if (this.cursorx) this.cursorx--;
            if (this.cursory) this.cursory--;
            break;
    }
    if (this.cursorx >= this.ncolumns) this.cursorx = this.ncolumns - 1;
    if (this.cursory >= this.nrows) this.cursory = this.nrows - 1;
};

Terminal.prototype.ChangeColor = function (Numbers) {

    if (Numbers.length === 0) { // reset;
        this.attr_color = 0x7;
        this.attr_reverse = false;
        this.attr_italic = false;
        this.attr_intensity = 1;
        return;
    }

    let c = this.attr_color;

    for (let i = 0; i < Numbers.length; i++) {
        switch (Number(Numbers[i])) {

            case 0: // reset
                c = 0x7;
                this.attr_reverse = false;
                this.attr_italic = false;
                this.attr_intensity = 1;
                break;
            case 1: // brighter foreground color
                this.attr_intensity = 2;
                break;
            case 2: // dimmed foreground color
                this.attr_intensity = 0;
                break;
            case 3: // italic
                this.attr_italic = true;
                break;
            case 4: // underline ignored
                break;
            case 5: // extended colors or blink ignored
                //i++;
                break;
            case 7: // reversed
                this.attr_reverse = true;
                break;
            case 8: // hidden ignored
                break;
            case 10: // reset mapping ?
                break;
            case 21:
            case 22:
                this.attr_intensity = 1;
                break;
            case 23:
                this.attr_italic = false;
                break;
            case 27: // no reverse
                this.attr_reverse = false;
                break;

            case 30:
            case 31:
            case 32:
            case 33:
            case 34:
            case 35:
            case 36:
            case 37:
                c = c & (0xFFF8) | (Numbers[i] - 30) & 0x7;
                break;
            case 40:
            case 41:
            case 42:
            case 43:
            case 44:
            case 45:
            case 46:
            case 47:
                c = c & (0x00FF) | (((Numbers[i] - 40) & 0x7) << 8);
                break;
            case 39:
                c = c & (0xFF00) | 0x7; // set standard foreground color
                break;
            case 49:
                c = c & 0x00FF; // set standard background color
                break;
            default:
                message.Warning("Color " + Numbers[i] + " not found");
                break;
        }
    }
    this.attr_color = c | 0;
};

Terminal.prototype.ChangeMode = function (numbers, question, onoff) {

    for (let i = 0; i < numbers.length; i++) {
        switch (numbers[i]) {
            case 4: // insert mode
                break;

            case 7: // auto wrap on off
                break;

            case 25: // cursor on/off
                this.cursortype = onoff;
                break;

            case 1000: // 
                break;

            case 1006: // 
                break;

            case 1005: // 
                break;

            default:
                message.Warning("Mode term parameter " + this.escapestring + " unknown");
                break;
        }
    }
}

Terminal.prototype.ChangeCursorType = function (numbers, question) {
    if (!question) {
        message.Warning("cursor parameter unknown");
        return;
    }

    for (let i = 0; i < numbers.length; i++) {
        switch (numbers[i]) {
            case 0:
                //this.cursorvisible = false;
                //this.cursortype = 0;
                break;
            case 1:
                //this.cursortype = 1;
                break;
            default:
                message.Warning("Term parameter " + this.escapestring + " unknown");
                break;
        }
    }
}


Terminal.prototype.HandleEscapeSequence = function () {
    //message.Debug("Escape sequence:'" + this.escapestring+"'");
    let i = 0;
    if (this.escapestring === "[J") {
        this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
        this.DeleteArea(this.cursory + 1, 0., this.nrows - 1, this.ncolumns - 1);
        return;
    } else if (this.escapestring === "M") {
        this.ScrollDown(true);
        return;
    }
    // Testing for [x;y;z
    let s = this.escapestring;

    if (s.charAt(0) !== "[") {
        message.Warning("Short escape sequence unknown:'" + this.escapestring + "'");
        return; // the short escape sequences must be handled earlier
    }

    s = s.substr(1); // delete first sign

    let lastsign = s.substr(s.length - 1); // extract command
    s = s.substr(0, s.length - 1); // remove command

    let question = false;
    if (s.charAt(0) === '?') {
        question = true;
        s = s.substr(1); // delete question mark
    }

    let numbers = s.split(";"); // if there are multiple numbers, split them
    if (numbers[0].length === 0) {
        numbers = [];
    }


    // the array must contain of numbers and not strings. Make this sure
    for (i = 0; i < numbers.length; i++) {
        numbers[i] = Number(numbers[i]);
    }

    let oldcursory = this.cursory; // save current cursor position
    let count = 0;
    switch (lastsign) {

        case 'l':
            this.ChangeMode(numbers, question, true);
            return;

        case 'h':
            this.ChangeMode(numbers, question, false);
            return;

        case 'c':
            this.ChangeCursorType(numbers, question);
            return;
    }

    if (question) {
        message.Warning("Escape sequence unknown:'" + this.escapestring + "'");
        return;
    }

    let j;
    let top = 0;
    switch (lastsign) {
        case 'm': // colors
            this.ChangeColor(numbers);
            return;

        case 'A': // move cursor up
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            this.cursory -= count;
            break;

        case 'B': // move cursor down
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            this.cursory += count;
            break;

        case 'C': // move cursor right
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            this.cursorx += count;
            break;

        case 'D': // move cursor left
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            this.cursorx -= count;
            if (this.cursorx < 0) this.cursorx = 0;
            break;

        case 'E': // move cursor down
            count = numbers.length ? numbers[0] : 1;
            this.cursory += count;
            this.cursorx = 0;
            break;

        case 'F': // move cursor up
            count = numbers.length ? numbers[0] : 1;
            this.cursory -= count;
            if (this.cursory < 0) this.cursory = 0;
            this.cursorx = 0;
            break;

        case 'G': // change cursor column
            count = numbers.length ? numbers[0] : 1;
            this.cursorx = count;
            if (this.cursorx) this.cursorx--;
            break;

        case 'H': // cursor position
        case 'd':
        case 'f':
            this.ChangeCursor(numbers);
            break;

        case 'K': // erase
            count = numbers.length ? numbers[0] : 1;
            if (!numbers.length) {
                this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
            } else if (numbers[0] == 1) {
                this.DeleteArea(this.cursory, 0., this.cursory, this.cursorx);
            } else if (numbers[0] == 2) {
                this.DeleteRow(this.cursory);
            }
            break;

        case 'L': // scroll down
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            top = this.scrolltop;
            this.scrolltop = this.cursory;
            if (count === 1) {
                this.ScrollDown(true);
            } else {
                for (j = 0; j < count - 1; j++) {
                    this.ScrollDown(false);
                }
                this.ScrollDown(true);
            }
            this.scrolltop = top;
            break;

        case 'M': // scroll up
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            top = this.scrolltop;
            this.scrolltop = this.cursory;
            if (count === 1) {
                this.ScrollUp(true);
            } else {
                for (j = 0; j < count - 1; j++) {
                    this.ScrollUp(false);
                }
                this.ScrollUp(true);
            }
            this.scrolltop = top;
            break;

        case 'P': /* shift left from cursor and fill with zero */
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            let n = 0;
            for (j = this.cursorx + count; j < this.ncolumns; j++) {
                this.screen[this.cursory][this.cursorx + n] = this.screen[this.cursory][j];
                this.color[this.cursory][this.cursorx + n] = this.color[this.cursory][j];
                n++;
            }
            this.DeleteArea(this.cursory, this.ncolumns - count, this.cursory, this.ncolumns - 1);
            this.PrepareUpdateRow(this.cursory);
            break;

        case 'r': // set scrolling region
            if (numbers.length === 0) {
                this.scrolltop = 0;
                this.scrollbottom = this.nrows - 1;
            } else {
                this.scrolltop = numbers[0];
                this.scrollbottom = numbers[1];
                if (this.scrolltop) this.scrolltop--;
                if (this.scrollbottom) this.scrollbottom--;
            }
            return;

        case 'X': // erase only number of characters in current line    
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            for (j = 0; j < count; j++) {
                this.screen[this.cursory][this.cursorx + j] = 0x20;
                this.color[this.cursory][this.cursorx + j] = this.GetColor();
            }
            this.PrepareUpdateRow(this.cursory);
            break;

        default:
            message.Warning("Escape sequence unknown:'" + this.escapestring + "'");
            break;
    }

    if (this.cursorvisible) {
        this.PrepareUpdateRow(this.cursory);
        if (this.cursory !== oldcursory) {
            this.PrepareUpdateRow(oldcursory);
        }
    }
};


Terminal.prototype.PutChar = function (c) {
    //message.Debug("Char:" + c + " " +  String.fromCharCode(c));
    // escape sequence (CS)
    if (this.escapetype === 2) {
        this.escapestring += String.fromCharCode(c);
        if ((c >= 64) && (c <= 126)) {
            this.HandleEscapeSequence();
            this.escapetype = 0;
        }
        return;
    }

    // escape sequence
    if ((this.escapetype === 0) && (c === 0x1B)) {
        this.escapetype = 1;
        this.escapestring = "";
        return;
    }

    // starting escape sequence
    if (this.escapetype === 1) {
        this.escapestring += String.fromCharCode(c);
        // Control Sequence Introducer ([)
        if (c === 0x5B) {
            this.escapetype = 2;
            return;
        }
        this.HandleEscapeSequence();
        this.escapetype = 0;
        return;
    }
    switch (c) {
        case 0xA:
            // line feed
            this.LineFeed();
            this.OnCharReceived("\n");
            return;
        case 0xD:
            // carriage return
            this.cursorx = 0;
            this.PrepareUpdateRow(this.cursory);
            return;
        case 0x7:
            // beep
            return;
        case 0x8:
            // back space
            this.cursorx--;
            if (this.cursorx < 0) {
                this.cursorx = 0;
            }
            this.PrepareUpdateRow(this.cursory);
            return;
        case 0x9:
            // horizontal tab
            let spaces = 8 - (this.cursorx & 7);
            do {
                if (this.cursorx >= this.ncolumns) {
                    this.PrepareUpdateRow(this.cursory);
                    this.LineFeed();
                    this.cursorx = 0;
                }
                this.screen[this.cursory][this.cursorx] = 0x20;
                this.color[this.cursory][this.cursorx] = this.attr_color;
                this.cursorx++;
            } while (spaces--);
            this.PrepareUpdateRow(this.cursory);
            return;

        case 0x00:
        case 0x01:
        case 0x02:
        case 0x03:
        case 0x04:
        case 0x05:
        case 0x06:
        case 0x0B:
        case 0x0C:
        case 0x0E:
        case 0x0F:
        case 0x10:
        case 0x11:
        case 0x12:
        case 0x13:
        case 0x14:
        case 0x15:
        case 0x16:
        case 0x17:
        case 0x18:
        case 0x19:
        case 0x1A:
        case 0x1B:
        case 0x1C:
        case 0x1D:
        case 0x1E:
        case 0x1F:
        case 0x7F:
            message.Warning("unknown character " + c);
            return;
    }

    if (this.cursorx >= this.ncolumns) {
        this.LineFeed();
        this.cursorx = 0;
    }

    c = this.utf8converter.Put(c);
    if (c === -1) return;
    let cx = this.cursorx;
    let cy = this.cursory;
    this.screen[cy][cx] = c;

    this.color[cy][cx] = this.GetColor();
    this.cursorx++;
    //message.Debug("Write: " + String.fromCharCode(c));
    this.PrepareUpdateRow(cy);

    this.OnCharReceived(String.fromCharCode(c));
};

module.exports = Terminal;

},{"../../lib/utf8":2,"../messagehandler":9}],9:[function(require,module,exports){
// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

var worker;

var run = true;

function Send(command, data) {
    worker.postMessage(
    {
        "command" : command,
        "data" : data
    }
    );
}

function Debug(message) {
    console.log(message);
}

function Abort() {
    Debug("Master: Abort execution.");
    run = false;
    Send("Abort", {});
    throw new Error('Kill master');
}

function DoError(message) {
    Send("Debug", "Error: " + message);
    Abort();
}

function Warning(message) {
    Send("Debug", "Warning: " + message);
}

var messagemap = new Object();
function Register(message, OnReceive) {
    messagemap[message] = OnReceive;
}

// this is a global object of the worker
function OnMessage(e) {
    var command = e.data.command;

    // Debug Messages are always allowed
    if (command == "Debug") {
        messagemap[command](e.data.data);
        return;
    }

    if (!run) return;
    if (typeof messagemap[command] == 'function') {
        try {
            messagemap[command](e.data.data);
        } catch (error) {
            Debug("Master: Unhandled exception in command \"" + command + "\": " + error.message);
            run = false;
        }
    }
}

function SetWorker(_worker) {
    worker = _worker;
    worker.onmessage = OnMessage;
    worker.onerror = function(e) {
        Debug("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
        Abort();
    }
    Register("Abort", function(){Debug("Master: Received abort signal from worker"); run=false;});
    Register("Debug", function(d){Debug(d);});
}

module.exports.SetWorker = SetWorker;
module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Warning = Warning;
module.exports.Error = DoError;
module.exports.Abort = Abort;
module.exports.Send = Send;
 

},{}],10:[function(require,module,exports){
// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

var Terminal = require('./dev/terminal');
var TerminalInput = require('./dev/terminal-input');
var Framebuffer = require('./dev/framebuffer');
var Ethernet = require('./dev/ethernet');
var LoopSoundBuffer = require('./dev/sound');
var Filesystem = require('./dev/filesystem');
var utils = require('./utils');
var message = require('./messagehandler');

var TERMINAL = 0xDEADBEEF;

"use strict";


function jor1kGUI(parameters)
{
    this.params = parameters;
    this.message = message;

    // --- parameters parsing ---
    this.params.system = this.params.system  || {};

    this.params.path = this.params.path || "";

    console.log("kernel URL: " + this.params.system.kernelURL);
    this.params.system.memorysize = this.params.system.memorysize || 32;
    this.params.system.arch = this.params.system.arch || "or1k";
    this.params.system.cpu = this.params.system.cpu || "asm";
    this.params.system.ncores = this.params.system.ncores || 1;
    this.params.syncURL = this.params.syncURL || "";

    if (typeof this.params.fs !== "undefined") {
        this.params.fs.path = this.params.fs.path || this.params.path;
        this.params.fs.basefsURL = this.params.fs.basefsURL || "basefs.json";
        this.params.fs.basefsURL = this.params.fs.path + this.params.fs.basefsURL;
        if (this.params.fs.extendedfsURL) {
            this.params.fs.extendedfsURL = this.params.fs.path + this.params.fs.extendedfsURL;
        }
        this.params.fs.earlyload = this.params.fs.earlyload  || [];
        this.params.fs.lazyloadimages = this.params.fs.lazyloadimages  || [];
    }

    // add path to every URL
    this.params.system.kernelURL = this.params.path + this.params.system.kernelURL;
    this.params.system.dtbURL = this.params.path + this.params.system.dtbURL;

    this.params.userid = this.params.userid || "";

    // ----------------------

    this.worker = (this.params.worker instanceof Worker) ?
        this.params.worker : new Worker("jor1k-worker-min.js");

    message.SetWorker(this.worker);
    message.Send("WorkingPath", this.params.path);

    // ----

    if (this.params.clipboardid) {
        this.clipboard = document.getElementById(this.params.clipboardid);
    }

    if (this.params.statsid) {
        this.stats = document.getElementById(this.params.statsid);
    }

    if (this.params.fbid) {
        this.framebuffer = new Framebuffer(this.params.fbid, this.params.fps);
        message.Register("GetFB", this.framebuffer.Update.bind(this.framebuffer));
    }

    this.terms = [];
    if (this.params.term) {
        this.terms = [this.params.term];
    } else if (this.params.terms) {
        this.terms = this.params.terms.slice(0, 2); // support up to 2 terminals
    }
    for (var i = 0; i < this.terms.length; i++) {
        this.terms[i].Init(this, "tty" + i);
    }

    this.activeTTY = "tty0";
    this.terminput = new TerminalInput(this.SendChars.bind(this));

    this.fs = new Filesystem(this.params.syncURL, this.params.userid);

    this.sound = new LoopSoundBuffer(22050);
    message.Register("sound",      this.sound.AddBuffer.bind(this.sound));
    message.Register("sound.rate", this.sound.SetRate.bind(this.sound));

   if (this.clipboard) {
   this.clipboard.onpaste = function(event) {
       this.clipboard.value = "";
       setTimeout(this.SendClipboard.bind(this), 4);
   }.bind(this);


   this.SendClipboard = function() {
       var chars = [];
       var v = this.clipboard.value;

       for(var i=0; i<v.length; i++) {
           chars.push(v.charCodeAt(i));
       }

       this.SendChars(chars);
       this.clipboard.value = "";
   }.bind(this);
   }

   this.IgnoreKeys = function() {
      return (
          (this.lastMouseDownTarget != TERMINAL) &&
          (this.framebuffer ? this.lastMouseDownTarget != this.framebuffer.fbcanvas : true) &&
          (this.lastMouseDownTarget != this.clipboard)
      );
    }

    var recordTarget = function(event) {
        var termHitByEvent = false;
        for (var i = 0; i < this.terms.length; i++) {
            if (this.terms[i].WasHitByEvent(event)) {
                termHitByEvent = true;
                this.activeTTY = "tty" + i;
                break;
            }
        }
        if (termHitByEvent)
            this.lastMouseDownTarget = TERMINAL;
        else
            this.lastMouseDownTarget = event.target;
    }.bind(this);

    if(document.addEventListener)
      document.addEventListener('mousedown', recordTarget, false);
    else
      Window.onmousedown = recordTarget; // IE 10 support (untested)

    document.onkeypress = function(event) {
        if(this.IgnoreKeys()) return true;
        if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyPress(event);
        }
        message.Send("keypress", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    document.onkeydown = function(event) {
        if(this.IgnoreKeys()) return true;
        if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyDown(event);
        }
        message.Send("keydown", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    document.onkeyup = function(event) {
        if(this.IgnoreKeys()) return true;
        if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyUp(event);
        }
        message.Send("keyup", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    if (this.params.relayURL) {
        this.ethernet = new Ethernet(this.params.relayURL);
        this.ethernet.onmessage = function(e) {
            message.Send("ethmac", e.data);
        }.bind(this);
        message.Register("ethmac", this.ethernet.SendFrame.bind(this.ethernet));
    }

    message.Register("GetIPS", this.ShowIPS.bind(this));
    message.Register("execute", this.Execute.bind(this));
    message.Register("WorkerReady", this.OnWorkerReady.bind(this));
}

jor1kGUI.prototype.OnWorkerReady = function() {
    this.Reset();
    window.setInterval(function() {
        message.Send("GetIPS", 0);
    }, 1000);
};

// this command is send back and forth to be responsive
jor1kGUI.prototype.Execute = function() {
    if (this.stop) return;
    if(this.userpaused) {
        this.executepending = true;
    } else {
        this.executepending = false;
        message.Send("execute", 0);
    }
};

jor1kGUI.prototype.ShowIPS = function(ips) {
    if (!this.stats) return;
    if (this.userpaused) {
        this.stats.innerHTML = "Paused";
    } else {
        this.stats.innerHTML = ips<1000000?
        Math.floor(ips/1000) + " KIPS"
        :
        (Math.floor(ips/100000)/10.) + " MIPS";
   }
};

jor1kGUI.prototype.Reset = function () {
    this.stop = false; // VM Stopped/Aborted
    this.userpaused = false;
    this.executepending = false; // if we rec an execute message while paused

    message.Register("InitDone", this.OnInit.bind(this));
    message.Send("Init", this.params.system);
}

jor1kGUI.prototype.OnInit = function () {
    message.Send("Reset");
    message.Send("LoadAndStart", this.params.system.kernelURL);

    if (this.params.fs) message.Send("LoadFilesystem", this.params.fs);

    if (this.terms.length > 0) {
        this.terms.forEach(function (term) {
            term.PauseBlink(false);
        });
        this.lastMouseDownTarget = TERMINAL;
        // activeTTY remains the same, so the user can start typing into the terminal last used
        // or the default terminal initialized in the constructor
    }
}

jor1kGUI.prototype.Pause = function(pause) {
    pause = !! pause; // coerce to boolean
    if(pause == this.userpaused) return;
    this.userpaused = pause;
    if(! this.userpaused && this.executepending) {
      this.executepending = false;
       message.Send("execute", 0);
    }
    this.terms.forEach(function (term) {
        term.PauseBlink(pause);
    });
}

// sends the input characters for the terminal
jor1kGUI.prototype.SendChars = function(chars) {
    if (this.lastMouseDownTarget == this.fbcanvas) return;
    message.Send(this.activeTTY, chars);
    message.Send("htif.term0.Transfer", chars);
}

// Returns the terminal attached to tty
// tty is the tty string, for example, tty0
jor1kGUI.prototype.GetTerm = function(tty) {
    var index = parseInt(tty.slice(3));
    return this.terms[index];
}

jor1kGUI.prototype.FocusTerm = function(tty) {
    this.activeTTY = tty;
    this.lastMouseDownTarget = TERMINAL;
}

module.exports = jor1kGUI;

},{"./dev/ethernet":3,"./dev/filesystem":4,"./dev/framebuffer":5,"./dev/sound":6,"./dev/terminal":8,"./dev/terminal-input":7,"./messagehandler":9,"./utils":11}],11:[function(require,module,exports){
// -------------------------------------------------
// --------------------- Utils ---------------------
// -------------------------------------------------

"use strict";

function UploadBinaryResource(url, filename, data, OnSuccess, OnError) {

    var boundary = "xxxxxxxxx";

    var xhr = new XMLHttpRequest();
    xhr.open('post', url, true);
    xhr.setRequestHeader("Content-Type", "multipart/form-data, boundary=" + boundary);
    //xhr.setRequestHeader("Content-Length", data.length);
    xhr.onreadystatechange = function () {
        if (xhr.readyState != 4) {
            return;
        }
        if ((xhr.status != 200) && (xhr.status != 0)) {
            OnError("Error: Could not upload file " + filename);
            return;
        }
        OnSuccess(this.responseText);
    };

    var bodyheader = "--" + boundary + "\r\n";
    bodyheader += 'Content-Disposition: form-data; name="uploaded"; filename="' + filename + '"\r\n';
    bodyheader += "Content-Type: application/octet-stream\r\n\r\n";

    var bodyfooter = "\r\n";
    bodyfooter += "--" + boundary + "--";

    var newdata = new Uint8Array(data.length + bodyheader.length + bodyfooter.length);
    var offset = 0;
    for(var i=0; i<bodyheader.length; i++)
        newdata[offset++] = bodyheader.charCodeAt(i);

    for(var i=0; i<data.length; i++)
        newdata[offset++] = data[i];

    for(var i=0; i<bodyfooter.length; i++)
        newdata[offset++] = bodyfooter.charCodeAt(i);

    xhr.send(newdata.buffer);
}

module.exports.UploadBinaryResource = UploadBinaryResource;

},{}],"Jor1k":[function(require,module,exports){
var Jor1k = require('./system');

module.exports = Jor1k;

},{"./system":10}],"LinuxTerm":[function(require,module,exports){
var Terminal = require("../master/dev/terminal");

function LinuxTerm(termElementId) {
    this.termElementId = termElementId;
}

LinuxTerm.prototype.Init = function(jor1kGUI, tty) {
    this.term = new Terminal(24, 80, this.termElementId);
    jor1kGUI.message.Register(tty, function(d) {
       d.forEach(function(c) {
           this.term.PutChar(c&0xFF);
       }.bind(this));
    }.bind(this));

    this.terminalcanvas = document.getElementById(this.termElementId);
    this.terminalcanvas.onmousedown = function(event) {
        if (!jor1kGUI.framebuffer) return;
        jor1kGUI.framebuffer.fbcanvas.style.border = "2px solid #000000";
    }.bind(this);
}

LinuxTerm.prototype.WasHitByEvent = function(evt) {
    return this.terminalcanvas.contains(evt.target);
}

LinuxTerm.prototype.PauseBlink = function(pause) {
    this.term.PauseBlink(pause);
}

LinuxTerm.prototype.SetCharReceiveListener = function (callback) {
    this.term.OnCharReceived = callback;
}

LinuxTerm.prototype.RemoveCharReceiveListener = function () {
    this.term.OnCharReceived = function (){};
}

module.exports = LinuxTerm;

},{"../master/dev/terminal":8}]},{},[]);
