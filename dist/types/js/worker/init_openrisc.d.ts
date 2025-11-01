import type { SystemInitData } from '../../types/index.js';
interface SystemContext {
    cpu: any;
    ram: any;
    heap: ArrayBuffer;
    ncores: number;
    devices: any[];
    RaiseInterrupt(line: number): void;
    ClearInterrupt(line: number): void;
    RaiseSoftInterrupt(line: number, cpuid: number): void;
    ClearSoftInterrupt(line: number, cpuid: number): void;
    irqdev?: any;
    timerdev?: any;
    uartdev0?: any;
    uartdev1?: any;
    ethdev?: any;
    fbdev?: any;
    atadev?: any;
    tsdev?: any;
    kbddev?: any;
    snddev?: any;
    rtcdev?: any;
    virtio9pdev?: any;
    virtiodev1?: any;
    virtiodev2?: any;
    virtiodev3?: any;
    virtiodummydev?: any;
    virtionetdev?: any;
    virtioinputdev?: any;
    virtioblockdev?: any;
    virtiogpudev?: any;
    virtioconsoledev?: any;
}
declare function InitOpenRISC(system: SystemContext, initdata: SystemInitData): Promise<void>;
export default InitOpenRISC;
//# sourceMappingURL=init_openrisc.d.ts.map