declare class Ethernet {
    url: string;
    onmessage: (e: MessageEvent) => void;
    ntries: number;
    socket?: WebSocket;
    constructor(relayURL: string);
    private EthernetMessageHandler;
    private EthernetOpenHandler;
    private EthernetCloseHandler;
    private EthernetErrorHandler;
    OpenSocket(): void;
    SendFrame(data: ArrayBuffer): void;
    Close(): void;
}
export default Ethernet;
//# sourceMappingURL=ethernet.d.ts.map