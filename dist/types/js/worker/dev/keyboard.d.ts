export default KeyboardDev;
declare function KeyboardDev(intdev: any): void;
declare class KeyboardDev {
    constructor(intdev: any);
    intdev: any;
    Reset(): void;
    key: any;
    fifo: any[];
    OnKeyDown(event: any): void;
    OnKeyUp(event: any): void;
    ReadReg8(addr: any): any;
}
//# sourceMappingURL=keyboard.d.ts.map