// manages the websocket connection for the ethmac peripheral

function Ethernet(relayURL) {
    this.url = relayURL;
    this.onmessage = function(e) { };
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

function EthernetCloseHandler(e) {
    // reopen websocket if it closes
    console.log("Websocket closed. Reopening.");
    this.OpenSocket();
}

function EthernetErrorHandler(e) {
    // just report the error to console, close event
    // will handle reopening if possible
    console.error("Websocket error:");
    console.error(e);
}

Ethernet.prototype.OpenSocket = function() {
    if (this.url) {
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onmessage = EthernetMessageHandler.bind(this);
        this.socket.onclose = EthernetCloseHandler.bind(this);
        this.socket.onerror = EthernetErrorHandler.bind(this);
    } else {
        this.socket = {
            send : function(){}
        };
    }
}

Ethernet.prototype.SendFrame = function(data) {
    this.socket.send(data);
}

Ethernet.prototype.Close = function() {
    this.socket.onclose = undefined;
    this.socket.close();
}

