import type { SystemInitData } from '../../types/index.js';
interface SystemContext {
    cpu: any;
    ram: any;
    heap: ArrayBuffer;
    ncores: number;
    csr: Int32Array;
    devices: any[];
    RaiseInterrupt(line: number): void;
    ClearInterrupt(line: number): void;
    htif?: any;
    rom?: ArrayBuffer;
    romdev?: any;
    uartdev0?: any;
    clintdev?: any;
    plicdev?: any;
    virtiodev1?: any;
    virtiodev2?: any;
    virtiodev3?: any;
    virtiodev4?: any;
    virtiodev5?: any;
    virtio9pdev?: any;
    virtionetdev?: any;
    virtiodummydev?: any;
    virtioinputdev?: any;
    virtioblockdev?: any;
    virtiogpudev?: any;
    virtioconsoledev?: any;
}
declare function InitRISCV(system: SystemContext, initdata: SystemInitData): Promise<void>;
export default InitRISCV;
//# sourceMappingURL=init_riscv.d.ts.map