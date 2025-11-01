// Type definitions for RISC-V Fast CPU (asm.js implementation)
// This file provides type safety at the boundaries between TypeScript and asm.js code

import type { FastCPUCore } from '../../../types/cpu.js';

/**
 * RISC-V Fast CPU implementation using asm.js for maximum performance.
 * This module uses "use asm" directive and cannot use complex TypeScript features.
 * Only primitive types and typed arrays are allowed.
 */
declare function FastCPU(
    stdlib: {
        Math: typeof Math;
        Int32Array: typeof Int32Array;
        Float32Array: typeof Float32Array;
        Float64Array: typeof Float64Array;
        Int8Array: typeof Int8Array;
        Int16Array: typeof Int16Array;
        Uint8Array: typeof Uint8Array;
        Uint16Array: typeof Uint16Array;
    },
    foreign: {
        DebugMessage(message: number): void;
        abort(): void;
        Read32(addr: number): number;
        Write32(addr: number, value: number): void;
        Read16(addr: number): number;
        Write16(addr: number, value: number): void;
        Read8(addr: number): number;
        Write8(addr: number, value: number): void;
        ReadDEVCMDToHost(): number;
        ReadDEVCMDFromHost(): number;
        WriteDEVCMDToHost(value: number): void;
        WriteDEVCMDFromHost(value: number): void;
        ReadToHost(): number;
        ReadFromHost(): number;
        WriteToHost(value: number): void;
        WriteFromHost(value: number): void;
        imul(a: number, b: number): number;
    },
    heap: ArrayBuffer
): FastCPUCore & {
    Init(): void;
    GetPC(): number;
    InvalidateTLB(): void;
    PushPrivilegeStack(): void;
    PopPrivilegeStack(): void;
};

export default FastCPU;
