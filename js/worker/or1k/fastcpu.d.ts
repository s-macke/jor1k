// Type definitions for OpenRISC Fast CPU (asm.js implementation)
// This file provides type safety at the boundaries between TypeScript and asm.js code

import type { FastCPUCore, ASMJSForeignInterface } from '../../../types/cpu.js';

/**
 * Fast CPU implementation using asm.js for maximum performance.
 * This module uses "use asm" directive and cannot use complex TypeScript features.
 * Only primitive types and typed arrays are allowed.
 */
declare function FastCPU(
    stdlib: {
        Math: typeof Math;
        Int32Array: typeof Int32Array;
        Float32Array: typeof Float32Array;
        Uint8Array: typeof Uint8Array;
        Uint16Array: typeof Uint16Array;
    },
    foreign: ASMJSForeignInterface,
    heap: ArrayBuffer
): FastCPUCore & {
    Init(): void;
    GetStat(): number;
    InvalidateTLB(): void;
};

export default FastCPU;
