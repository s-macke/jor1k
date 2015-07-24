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
