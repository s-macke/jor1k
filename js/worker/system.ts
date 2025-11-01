// -------------------------------------------------
// ------------------- SYSTEM ----------------------
// -------------------------------------------------

"use strict";
// common
import message from './messagehandler.js';
import * as utils from './utils.js';
import RAM from './ram.js';
import bzip2 from './bzip2.js';
import elf from './elf.js';
import Timer from './timer.js';
import InitOpenRISC from './init_openrisc.js';
import InitRISCV from './init_riscv.js';
import FS from './filesystem/filesystem.js';

// Devices
import Virtio9p from './dev/virtio/9p.js';

import type { 
  Device, 
  CPUCore, 
  FastCPUCore,
  InterruptController,
  UARTDevice,
  SystemInitData
} from '../../types/index.js';

// System state constants
const SYSTEM_RUN = 0x1;
const SYSTEM_STOP = 0x2;
const SYSTEM_HALT = 0x3; // Idle

// Error classes for type-safe error handling
export class SystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: unknown
  ) {
    super(message);
    this.name = 'SystemError';
  }
}

export class SystemInitializationError extends SystemError {
  constructor(message: string, context?: unknown) {
    super(message, 'SYSTEM_INIT_ERROR', context);
  }
}

export class KernelLoadError extends SystemError {
  constructor(message: string, context?: unknown) {
    super(message, 'KERNEL_LOAD_ERROR', context);
  }
}

// Main system class for worker thread
class System {
  public status: number;
  public arch: 'or1k' | 'riscv';
  public memorysize: number;
  public ncores: number;
  public ips: number;
  public idletime: number;
  public idlemaxwait: number;
  public ticksperms: number;
  public loopspersecond: number;
  public timer: Timer;
  public memory?: WebAssembly.Memory;
  public heap: ArrayBuffer;
  public ram: RAM;
  public csr: Int32Array;
  public devices: Device[];
  public filesystem: FS;
  public virtio9pdev: Virtio9p;
  public cpu: CPUCore | FastCPUCore;
  public idletimeouthandle?: number;
  
  // Device references (optional, architecture-specific)
  public irqdev?: Device & InterruptController;
  public timerdev?: Device;
  public uartdev0?: UARTDevice;
  public uartdev1?: UARTDevice;
  public ethdev?: Device;
  public fbdev?: Device;
  public atadev?: Device;
  public tsdev?: Device;
  public kbddev?: Device;
  public snddev?: Device;
  public rtcdev?: Device;
  public plicdev?: Device & InterruptController;
  public clintdev?: Device;
  public romdev?: Device;
  public htif?: Device;
  
  // VirtIO devices
  public virtiodev1?: Device;
  public virtiodev2?: Device;
  public virtiodev3?: Device;
  public virtiodev4?: Device;
  public virtiodev5?: Device;
  public virtiodummydev?: Device;
  public virtionetdev?: Device;

  constructor() {
    // Initialize state
    this.status = SYSTEM_STOP;
    this.ips = 0;
    this.idletime = 0;
    this.idlemaxwait = 0;
    this.ticksperms = 20000;
    this.loopspersecond = 100;
    this.devices = [];
    
    // Placeholder values - will be set in Init
    this.arch = 'or1k';
    this.memorysize = 32;
    this.ncores = 1;
    this.heap = new ArrayBuffer(0);
    this.ram = null as any; // Will be initialized in Init
    this.csr = new Int32Array(0);
    this.filesystem = new FS();
    this.virtio9pdev = null as any; // Will be initialized in Init
    this.cpu = null as any; // Will be initialized in Init
    this.timer = null as any; // Will be initialized in Init

    // Register message handlers
    message.Register("LoadAndStart", this.LoadImageAndStart.bind(this));
    message.Register("execute", this.MainLoop.bind(this));
    message.Register("Init", this.Init.bind(this));
    message.Register("Reset", this.Reset.bind(this));
    message.Register("PrintOnAbort", this.PrintState.bind(this));

    message.Register("GetIPS", (_data: unknown) => {
      message.Send("GetIPS", this.ips);
      this.ips = 0;
    });
  }

  public Reset(): void {
    this.status = SYSTEM_STOP;
    for (let i = 0; i < this.devices.length; i++) {
      this.devices[i].Reset();
    }
    this.ips = 0;
  }

  public async Init(system: SystemInitData): Promise<void> {
    message.Debug("Init with following JSON structure: ");
    message.Debug(JSON.stringify(system));

    this.status = SYSTEM_STOP;

    this.arch = system.arch;
    this.memorysize = system.memorysize;
    this.ncores = system.ncores;
    if (!system.ncores) system.ncores = 1;

    this.ips = 0; // external instruction per second counter
    this.idletime = 0; // start time of the idle routine
    this.idlemaxwait = 0; // maximum waiting time in cycles

    // constants
    this.ticksperms = 20000; // 20 MHz
    this.loopspersecond = 100; // main loops per second, to keep the system responsive

    this.timer = new Timer(this.ticksperms, this.loopspersecond);

    message.Debug("Allocate " + this.memorysize + " MB");
    // this must be a power of two.
    if (((system.cpu == "dynamic") || (system.cpu == "wasm")) && (typeof WebAssembly !== "undefined")) {
      message.Debug("Use webassembly memory");
      try {
        this.memory = new WebAssembly.Memory({ initial: this.memorysize * 16, maximum: this.memorysize * 16 });
        this.heap = this.memory.buffer;
      } catch (error) {
        throw new SystemInitializationError(
          "Failed to allocate WebAssembly memory",
          { memorysize: this.memorysize, error: error instanceof Error ? error.message : String(error) }
        );
      }
    } else {
      message.Debug("Use arraybuffer memory");
      try {
        this.heap = new ArrayBuffer(this.memorysize * 0x100000);
      } catch (error) {
        throw new SystemInitializationError(
          "Failed to allocate ArrayBuffer memory",
          { memorysize: this.memorysize, error: error instanceof Error ? error.message : String(error) }
        );
      }
    }
    
    const ramoffset = 0x100000;
    this.memorysize--; // - the lower 1 MB are used for the cpu cores
    this.ram = new RAM(this.heap, ramoffset);
    if (this.memory) this.ram.memory = this.memory;
    this.csr = new Int32Array(this.heap, 0x2000, 4096);

    this.devices = [];
    this.filesystem = new FS();
    this.virtio9pdev = new Virtio9p(this.ram, this.filesystem);

    try {
      if (system.arch == "or1k") {
        await InitOpenRISC(this, system);
      } else if (system.arch == "riscv") {
        await InitRISCV(this, system);
      } else {
        throw new SystemInitializationError(
          "Architecture not supported",
          { arch: system.arch }
        );
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      message.Debug("Error: failed to create SoC: " + errorMessage);
      message.Abort();
      throw new SystemInitializationError("Failed to create SoC", { error: errorMessage });
    }
    
    message.Debug("Init Done");
    message.Send("InitDone", null);
  }

  public RaiseInterrupt(line: number): void {
    //message.Debug("Raise " + line);
    if (this.arch == "riscv") {
      if (this.plicdev) {
        (this.plicdev as InterruptController).RaiseInterrupt(line);
      }
    } else {
      if (this.cpu) {
        this.cpu.RaiseInterrupt(line, -1); // raise all cores
      }
    }
    
    if (this.status == SYSTEM_HALT) {
      this.status = SYSTEM_RUN;
      if (this.idletimeouthandle !== undefined) {
        clearTimeout(this.idletimeouthandle);
      }
      const delta = (utils.GetMilliseconds() - this.idletime) * this.ticksperms;
      const adjustedDelta = delta > this.idlemaxwait ? this.idlemaxwait : delta;
      this.cpu.ProgressTime(adjustedDelta);
      this.MainLoop();
    }
  }

  public ClearInterrupt(line: number): void {
    if (this.arch == "riscv") {
      if (this.plicdev) {
        (this.plicdev as InterruptController).ClearInterrupt(line);
      }
    } else {
      if (this.cpu) {
        this.cpu.ClearInterrupt(line, -1); // clear all cores
      }
    }
  }

  public RaiseSoftInterrupt(line: number, cpuid: number): void {
    // the cpu cannot be halted when this function is called, so skip this check
    if (this.cpu) {
      this.cpu.RaiseInterrupt(line, cpuid);
    }
  }

  public ClearSoftInterrupt(line: number, cpuid: number): void {
    if (this.cpu) {
      this.cpu.ClearInterrupt(line, cpuid);
    }
  }

  public PrintState(): void {
    // Flush the buffer of the terminal
    if (this.uartdev0) this.uartdev0.Step();
    if (this.uartdev1) this.uartdev1.Step();
    if (this.cpu) message.Debug(this.cpu.toString());
  }

  public SendStringToTerminal(str: string): void {
    const chars: number[] = [];
    for (let i = 0; i < str.length; i++) {
      chars.push(str.charCodeAt(i));
    }
    message.Send("tty0", chars);
  }

  public LoadImageAndStart(url: string | ArrayBuffer): void {
    this.SendStringToTerminal("\r================================================================================");

    if (typeof url == 'string') {
      this.SendStringToTerminal("\r\nLoading kernel and hard and basic file system from web server. Please wait ...\r\n");
      utils.LoadBinaryResource(
        url,
        this.OnKernelLoaded.bind(this),
        (error: Error) => {
          throw new KernelLoadError("Failed to load kernel", { url, error: error.message });
        }
      );
    } else {
      this.OnKernelLoaded(url);
    }
  }

  public PatchKernel(length: number): void {
    const m = this.ram.uint8mem;
    // set the correct memory size
    for (let i = 0; i < length; i++) { // search for the compiled dts file in the kernel
      if (m[i + 0] === 0x6d) // find "memory\0"
        if (m[i + 1] === 0x65)
          if (m[i + 2] === 0x6d)
            if (m[i + 3] === 0x6f)
              if (m[i + 4] === 0x72)
                if (m[i + 5] === 0x79)
                  if (m[i + 6] === 0x00)
                    if (m[i + 24] === 0x01)
                      if (m[i + 25] === 0xF0)
                        if (m[i + 26] === 0x00)
                          if (m[i + 27] === 0x00) {
                            m[i + 24] = (this.memorysize * 0x100000) >> 24;
                            m[i + 25] = (this.memorysize * 0x100000) >> 16;
                            m[i + 26] = 0x00;
                            m[i + 27] = 0x00;
                          }
    }
  }

  public OnKernelLoaded(buffer: ArrayBuffer): void {
    this.SendStringToTerminal("Decompressing kernel...\r\n");
    const buffer8 = new Uint8Array(buffer);
    let length = buffer.byteLength;

    try {
      if (elf.IsELF(buffer8)) {
        elf.Extract(buffer8, this.ram);
      } else if (bzip2.IsBZIP2(buffer8)) {
        length = 0;
        bzip2.simple(buffer8, (x: number) => { this.ram.uint8mem[length++] = x; });
        if (elf.IsELF(this.ram.uint8mem)) {
          const temp = new Uint8Array(length);
          for (let i = 0; i < length; i++) {
            temp[i] = this.ram.uint8mem[i];
          }
          elf.Extract(temp, this.ram);
        }
      } else {
        for (let i = 0; i < length; i++) this.ram.uint8mem[i] = buffer8[i];
      }
    } catch (error) {
      throw new KernelLoadError(
        "Failed to decompress or extract kernel",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    // OpenRISC CPU uses Big Endian
    if (this.cpu && this.cpu.littleendian == false) {
      this.PatchKernel(length);
      this.ram.Little2Big(length);
    }
    
    message.Debug("Kernel loaded: " + length + " bytes");
    this.SendStringToTerminal("Booting\r\n");
    this.SendStringToTerminal("================================================================================");
    // we can start the boot process already, even if the filesystem is not yet ready

    if (this.cpu) {
      this.cpu.Reset();
      this.cpu.AnalyzeImage();
    }
    
    message.Debug("Starting emulation");
    this.status = SYSTEM_RUN;

    message.Send("execute", 0);
  }

  // the kernel has sent a halt signal, so stop everything until the next interrupt is raised
  public HandleHalt(): void {
    if (!this.cpu) return;
    
    const delta = this.cpu.GetTimeToNextInterrupt();
    if (delta == -1) return;
    
    this.idlemaxwait = delta;
    const mswait = Math.floor(delta / this.ticksperms / this.timer.correction + 0.5);
    //message.Debug("wait " + mswait);

    if (mswait <= 1) return;
    if (mswait > 1000) message.Debug("Warning: idle for " + mswait + "ms");
    
    this.idletime = utils.GetMilliseconds();
    this.status = SYSTEM_HALT;
    this.idletimeouthandle = window.setTimeout(() => {
      if (this.status == SYSTEM_HALT) {
        this.status = SYSTEM_RUN;
        if (this.cpu) {
          this.cpu.ProgressTime(delta);
        }
        //this.snddev.Progress();
        this.MainLoop();
      }
    }, mswait);
  }

  public MainLoop(): void {
    if (this.status != SYSTEM_RUN) return;
    if (!this.cpu) return;
    
    message.Send("execute", 0);
    // execute the cpu loop for "instructionsperloop" instructions.
    const stepsleft = this.cpu.Step(this.timer.instructionsperloop, this.timer.timercyclesperinstruction);
    let totalsteps = this.timer.instructionsperloop - stepsleft;
    totalsteps++; // at least one instruction
    this.ips += totalsteps;

    if (this.uartdev0) this.uartdev0.Step();
    if (this.uartdev1) this.uartdev1.Step();
    //this.snddev.Progress();

    // stepsleft != 0 indicates CPU idle
    const gotoidle = stepsleft ? true : false;

    this.timer.Update(totalsteps, this.cpu.GetTicks(), gotoidle);

    if (gotoidle) {
      this.HandleHalt();
    }

    // go to worker thread idle state that onmessage is executed
  }
}

export default System;
