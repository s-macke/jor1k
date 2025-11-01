// -------------------------------------------------
// ---------------- INIT RISCV ---------------------
// -------------------------------------------------

/*
compile dts file via
dtc -O dtb riscv.dts > riscv.dtb
od -A n -t x1 -v riscv.dtb | sed 's/ /,0x/g'
*/

"use strict";
// common
import message from './messagehandler.js';
import * as utils from './utils.js';

// CPU
import RISCVCPU from './riscv/index.js';

// Devices
import HTIF from './riscv/htif.js';
import CLINTDev from './dev/clint.js';
import PLICDev from './dev/plic.js';
import ROMDev from './dev/rom.js';
import UARTDev from './dev/uart.js';

//var IRQDev = require('./dev/irq');
//var TimerDev = require('./dev/timer');
//var FBDev = require('./dev/framebuffer');
//var EthDev = require('./dev/ethmac');
//var ATADev = require('./dev/ata');
//var RTCDev = require('./dev/rtc');
//var TouchscreenDev = require('./dev/touchscreen');
//var KeyboardDev = require('./dev/keyboard');
//var SoundDev = require('./dev/sound');
import VirtIODev from './dev/virtio.js';
import Virtio9p from './dev/virtio/9p.js';
import VirtioDummy from './dev/virtio/dummy.js';
import VirtioNET from './dev/virtio/net.js';
//var VirtioInput = require('./dev/virtio/input');
//var VirtioBlock = require('./dev/virtio/block');
//var VirtioGPU = require('./dev/virtio/gpu');
//var VirtioConsole = require('./dev/virtio/console');

import type { SystemInitData, Device, RAM, CPUCore, FastCPUCore, InterruptController } from '../../types/index.js';

// HTIF interface (Host-Target Interface for RISC-V)
interface HTIFDevice extends Device {
  // HTIF-specific methods can be added here
}

// System interface for initialization
interface SystemContext {
  cpu: CPUCore | FastCPUCore;
  ram: RAM;
  heap: ArrayBuffer;
  ncores: number;
  csr: Int32Array;
  devices: Device[];
  
  // Interrupt controller methods
  RaiseInterrupt(line: number): void;
  ClearInterrupt(line: number): void;
  
  // Device references
  htif?: HTIFDevice;
  rom?: ArrayBuffer;
  romdev?: Device;
  uartdev0?: Device;
  clintdev?: Device;
  plicdev?: Device & InterruptController;
  virtiodev1?: Device;
  virtiodev2?: Device;
  virtiodev3?: Device;
  virtiodev4?: Device;
  virtiodev5?: Device;
  virtio9pdev?: Device;
  virtionetdev?: Device;
  virtiodummydev?: Device;
  virtioinputdev?: Device;
  virtioblockdev?: Device;
  virtiogpudev?: Device;
  virtioconsoledev?: Device;
}

async function InitRISCV(system: SystemContext, initdata: SystemInitData): Promise<void> {
    message.Debug("Init RISCV SoC");
    const irqhandler = system;

    // at the moment the htif interface is part of the CPU initialization.
    // However, it uses uartdev0
    system.htif = new HTIF(system.ram, system);
    system.cpu = new RISCVCPU(initdata.cpu, system.ram, system.htif, system.heap, system.ncores);

    try {
        await system.cpu.Init();
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        message.Debug("Error: failed to create CPU:" + errorMessage);
        message.Abort();
        throw e;
    }

    system.devices.push(system.cpu);

    system.rom = new ArrayBuffer(0x2000);
    const buffer32view = new Int32Array(system.rom);
    const buffer8view = new Uint8Array(system.rom);
    // boot process starts at 0x1000
    buffer32view[0x400] = 0x297 + 0x80000000 - 0x1000; // auipc t0, DRAM_BASE=0x80000000
    buffer32view[0x401] = 0x597; // auipc a1, 0 // a1 = 0x1004
    buffer32view[0x402] = 0x58593 + ((8*4-4)<<20); // addi a1, a1, 0 (pointer to dtb)
    buffer32view[0x403] = 0xf1402573; // csrr a0,mhartid
    buffer32view[0x404] = 0x00028067;  // jalr zero, t0, 0 (jump straight to DRAM_BASE)
    buffer32view[0x405] = 0x00000000; // trap vector
    buffer32view[0x406] = 0x00000000; // trap vector
    buffer32view[0x407] = 0x00000000; // trap vector

    message.Debug("Load DTB");
    
    if (!initdata.dtbURL) {
        throw new Error("DTB URL is required for RISC-V initialization");
    }
    
    utils.LoadBinaryResourceII(
        initdata.dtbURL,
        function(buffer: ArrayBuffer) {
            const configstring = new Uint8Array(buffer);
            for (let i = 0; i < configstring.length; i++) {
                buffer8view[0x1020 + i] = configstring[i];
            }
        },
        false,
        function(error: Error) {
            throw error;
        }
    );

    system.virtionetdev = new VirtioNET(system.ram);
    system.virtiodummydev = new VirtioDummy(system.ram);
    //system.virtioinputdev = new VirtioInput(system.ram);
    //system.virtioblockdev = new VirtioBlock(system.ram);
    //system.virtiogpudev = new VirtioGPU(system.ram);
    //system.virtioconsoledev = new VirtioConsole(system.ram);

    system.virtiodev1 = new VirtIODev(irqhandler, 0x3, system.ram, system.virtio9pdev);
    system.virtiodev2 = new VirtIODev(irqhandler, 0x4, system.ram, system.virtionetdev);
    system.virtiodev3 = new VirtIODev(irqhandler, 0x5, system.ram, system.virtiodummydev);
    system.virtiodev4 = new VirtIODev(irqhandler, 0x6, system.ram, system.virtiodummydev);
    system.virtiodev5 = new VirtIODev(irqhandler, 0x7, system.ram, system.virtiodummydev);
    system.romdev     = new ROMDev(system.rom);
    system.uartdev0   = new UARTDev(0, irqhandler, 2);
    system.clintdev   = new CLINTDev(system.csr);
    system.plicdev    = new PLICDev(system.cpu);

    system.devices.push(system.romdev);
    system.devices.push(system.uartdev0);
    system.devices.push(system.clintdev);
    system.devices.push(system.plicdev);
    system.devices.push(system.virtiodev1);
    system.devices.push(system.virtiodev2);
    system.devices.push(system.virtiodev3);
    system.devices.push(system.virtiodev4);
    system.devices.push(system.virtiodev5);
    system.devices.push(system.virtio9pdev);

    system.ram.AddDevice(system.romdev,      0x00000000, 0x7);
    system.ram.AddDevice(system.uartdev0,    0x03000000, 0x2000);
    system.ram.AddDevice(system.clintdev,    0x02000000, 0x2000);
    system.ram.AddDevice(system.plicdev,     0x04000000, 0xF00000);
    system.ram.AddDevice(system.virtiodev1,  0x20000000, 0x2000);
    system.ram.AddDevice(system.virtiodev2,  0x30000000, 0x2000);
    system.ram.AddDevice(system.virtiodev3,  0x40000000, 0x2000);
    system.ram.AddDevice(system.virtiodev4,  0x50000000, 0x2000);
    system.ram.AddDevice(system.virtiodev5,  0x60000000, 0x2000);
    message.Debug("Init RISC-V SoC finished");
}

export default InitRISCV;
