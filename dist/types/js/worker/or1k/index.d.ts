export default CPU;
declare function CPU(cpuname: any, ram: any, heap: any, ncores: any): void;
declare class CPU {
    constructor(cpuname: any, ram: any, heap: any, ncores: any);
    name: any;
    ncores: any;
    ram: any;
    heap: any;
    littleendian: boolean;
    Init(): Promise<void>;
    cpu: any;
    toString(): string;
}
//# sourceMappingURL=index.d.ts.map