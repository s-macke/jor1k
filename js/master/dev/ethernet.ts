// manages the websocket connection for the ethmac peripheral

import message from '../messagehandler.js';

"use strict";

class Ethernet {
    url: string;
    onmessage: (e: MessageEvent) => void;
    ntries: number;
    socket?: WebSocket;

    constructor(relayURL: string) {
        this.url = relayURL;
        this.onmessage = function (_e: MessageEvent) { };
        this.ntries = 0;
        this.OpenSocket();
    }

    private EthernetMessageHandler(e: MessageEvent): void {
        // if we recv binary data, call the onmessage handler
        // which was assigned to this Ethernet object
        if (e.data instanceof ArrayBuffer) {
            this.onmessage(e);
        } else
            // otherwise, this might be a textual "ping" message to keep
            // the connection alive
            if (e.data.toString().indexOf('ping:') == 0) {
                if (this.socket) {
                    this.socket.send('pong:' + e.data.toString().substring(5));
                }
            }
    }

    private EthernetOpenHandler(_e: Event): void {
        this.ntries = 0;
    }

    private EthernetCloseHandler(_e: CloseEvent): void {
        // reopen websocket if it closes
        if (this.ntries > 3) {
            message.Debug("Websocket error: Connection failed");
            return;
        }
        this.ntries++;
        message.Debug("Websocket closed. Reopening.");
        this.OpenSocket();
    }

    private EthernetErrorHandler(e: Event | Error): void {
        // just report the error to console, close event
        // will handle reopening if possible
        message.Debug("Websocket error:");
        message.Debug(e instanceof Error ? e.message : e.type);
    }

    OpenSocket(): void {
        try {
            this.socket = new WebSocket(this.url);
        } catch (err) {
            delete this.socket;
            this.EthernetErrorHandler(err as Error);
            return;
        }
        this.socket.binaryType = 'arraybuffer';
        this.socket.onmessage = this.EthernetMessageHandler.bind(this);
        this.socket.onclose = this.EthernetCloseHandler.bind(this);
        this.socket.onopen = this.EthernetOpenHandler.bind(this);
        this.socket.onerror = this.EthernetErrorHandler.bind(this);
    }

    SendFrame(data: ArrayBuffer): void {
        if (typeof this.socket == "undefined") return;
        try {
            this.socket.send(data);
        } catch (err) {
            // this is unusual error, object exists, but send does not work 
            this.EthernetErrorHandler(err as Error);
        }
    }

    Close(): void {
        if (this.socket) {
            this.socket.onclose = null;
            this.socket.close();
        }
    }
}

export default Ethernet;
