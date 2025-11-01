import type { InterruptController } from '../../../types/devices.js';
declare class UARTDev {
    intno: number;
    intdev: InterruptController;
    id: number;
    verboseuart: boolean;
    LCR: number;
    LSR: number;
    MSR: number;
    ints: number;
    IIR: number;
    IER: number;
    DLL: number;
    DLH: number;
    FCR: number;
    MCR: number;
    rxbuf: number[];
    txbuf: number[];
    constructor(id: number, intdev: InterruptController, intno: number);
    ToBitDescription(val: number, desc: string[]): string;
    Reset(): void;
    Step(): void;
    ReceiveChar(data: number[]): void;
    CheckInterrupt(): void;
    ThrowInterrupt(line: number): void;
    ClearInterrupt(line: number): void;
    ReadReg8(addr: number): number;
    WriteReg8(addr: number, x: number): void;
}
export default UARTDev;
//# sourceMappingURL=uart.d.ts.map