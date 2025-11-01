// CPU architecture interfaces and types

// Base CPU state - compatible with asm.js constraints
export interface CPUState {
  pc: number;
  nextpc: number;
  delayedpc: number;
  SR: number;
  group0: Int32Array;
  group1: Int32Array;
  group2: Int32Array;
}

// Generic CPU interface for safe/dynamic implementations
export interface CPUCore {
  Reset(): void;
  Step(instructions: number, cycles: number): number;
  GetTicks(): number;
  GetTimeToNextInterrupt(): number;
  ProgressTime(delta: number): void;
  RaiseInterrupt(line: number, cpuid: number): void;
  ClearInterrupt(line: number, cpuid: number): void;
  AnalyzeImage(): void;
  toString(): string;
  littleendian?: boolean;
}

// Fast CPU interface - minimal for asm.js compatibility
// Note: Fast CPU uses "use asm" and cannot use complex TypeScript features
export interface FastCPUCore {
  // Only primitive types and typed arrays allowed
  // No classes, interfaces, or complex objects in asm.js modules
  Reset(): void;
  Step(instructions: number, cycles: number): number;
  GetTicks(): number;
  GetTimeToNextInterrupt(): number;
  ProgressTime(delta: number): void;
  RaiseInterrupt(line: number, cpuid: number): void;
  ClearInterrupt(line: number, cpuid: number): void;
  AnalyzeImage(): void;
  littleendian?: boolean;
}

// OpenRISC-specific CPU interface
export interface OR1KCPUCore extends CPUCore {
  r: Int32Array; // general purpose registers
  f: Float32Array; // floating point registers
  group0: Int32Array; // special purpose registers
  group1: Int32Array; // data TLB
  group2: Int32Array; // instruction TLB
  pc: number;
  nextpc: number;
  delayedpc: number;
  SR: number;
  TTMR: number; // tick timer mode register
  TTCR: number; // tick timer count register
  PICMR: number; // programmable interrupt controller mask register
  PICSR: number; // programmable interrupt controller status register
}

// RISC-V specific CPU interface
export interface RISCVCPUCore extends CPUCore {
  x: Int32Array; // general purpose registers
  f: Float64Array; // floating point registers
  pc: number;
  fence: number;
  csr: Int32Array; // control and status registers
  prv: number; // privilege level
  mstatus: number;
  mtvec: number;
  medeleg: number;
  mideleg: number;
  mie: number;
  mip: number;
  mcause: number;
  mepc: number;
  mtval: number;
}

// Instruction set for non-asm implementations
export interface InstructionSet {
  [opcode: number]: (instruction: number) => void;
}

// CPU exception interface
export interface CPUException {
  type: number;
  addr: number;
  pc: number;
}

// CPU factory type to handle different implementations
export type CPUImplementation = 'asm' | 'safe' | 'dynamic' | 'wasm' | 'smp';

export interface CPUFactory {
  createCPU(type: CPUImplementation, ram: RAM, heap: ArrayBuffer): CPUCore | FastCPUCore;
}

// Foreign function interface for asm.js CPU
export interface ASMJSForeignInterface {
  imul(a: number, b: number): number;
  DebugMessage(message: string): void;
  abort(): void;
  Read32(addr: number): number;
  Write32(addr: number, value: number): void;
  Read16(addr: number): number;
  Write16(addr: number, value: number): void;
  Read8(addr: number): number;
  Write8(addr: number, value: number): void;
}

// Forward declaration for RAM interface
export interface RAM {
  heap: ArrayBuffer;
  memory?: WebAssembly.Memory;
  int8mem: Int8Array;
  uint8mem: Uint8Array;
  int16mem: Int16Array;
  uint16mem: Uint16Array;
  int32mem: Int32Array;
  uint32mem: Uint32Array;
}