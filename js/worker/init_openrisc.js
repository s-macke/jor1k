// -------------------------------------------------
// --------------- INIT OPENRISC -------------------
// -------------------------------------------------

"use strict";
// common
import message from './messagehandler.js';
import * as utils from './utils.js';

// CPU
import OR1KCPU from './or1k/index.js';

import UARTDev from './dev/uart.js';
import IRQDev from './dev/irq.js';
import TimerDev from './dev/timer.js';
import FBDev from './dev/framebuffer.js';
import EthDev from './dev/ethmac.js';
import ATADev from './dev/ata.js';
import RTCDev from './dev/rtc.js';
import TouchscreenDev from './dev/touchscreen.js';
import KeyboardDev from './dev/keyboard.js';
import SoundDev from './dev/sound.js';
import VirtIODev from './dev/virtio.js';
import Virtio9p from './dev/virtio/9p.js';
import VirtioDummy from './dev/virtio/dummy.js';
import VirtioInput from './dev/virtio/input.js';
import VirtioNET from './dev/virtio/net.js';
import VirtioBlock from './dev/virtio/block.js';
import VirtioGPU from './dev/virtio/gpu.js';
import VirtioConsole from './dev/virtio/console.js';

/*
    Heap Layout for OpenRISC emulation
    ==================================
    The heap is needed by the asm.js CPU.
    For compatibility all CPUs use the same layout
    by using the different views of typed arrays

    ------ Core 1 ------
    0x0     -  0x7F     32 CPU registers
    0x80    -  0x1FFF   CPU specific, usually unused or temporary data
    0x2000  -  0x3FFF   group 0 (system control and status)
    0x4000  -  0x5FFF   group 1 (data MMU)
    0x6000  -  0x7FFF   group 2 (instruction MMU)
    ------ Core 2 ------
    0x8000  -  0x807F   32 CPU registers
    0x8080  -  0x9FFF   CPU specific, usually unused or temporary data
    0xA000  -  0xBFFF   group 0 (system control and status)
    0xC000  -  0xDFFF   group 1 (data MMU)
    0xE000  -  0xFFFF   group 2 (instruction MMU)
    ------ Core 3 ------
    ...
    ------- RAM --------
    0x100000 -  ...     RAM
*/

async function InitOpenRISC(system, initdata) {
    message.Debug("Init OpenRISC SoC with CPU type " + initdata.cpu);

    var irqhandler = system;
    system.cpu = new OR1KCPU(initdata.cpu, system.ram, system.heap, system.ncores);

    try {
        await system.cpu.Init();
    } catch (e) {
        message.Debug("Error: failed to create CPU:" + e);
        message.Abort();
    }

    system.devices.push(system.cpu);

    system.irqdev = new IRQDev(irqhandler);
    system.timerdev = new TimerDev();
    system.uartdev0 = new UARTDev(0, irqhandler, 0x2);
    system.uartdev1 = new UARTDev(1, irqhandler, 0x3);
    system.ethdev = new EthDev(system.ram, irqhandler);
    system.ethdev.TransmitCallback = function(data) {
        message.Send("ethmac", data);
    };

    system.fbdev = new FBDev(system.ram);
    system.atadev = new ATADev(irqhandler);
    system.tsdev = new TouchscreenDev(irqhandler);
    system.kbddev = new KeyboardDev(irqhandler);
    system.snddev = new SoundDev(irqhandler, system.ram);
    system.rtcdev = new RTCDev(irqhandler);

    //system.virtioinputdev = new VirtioInput(system.ram);
    //system.virtionetdev = new VirtioNET(system.ram);
    //system.virtioblockdev = new VirtioBlock(system.ram);
    system.virtiodummydev = new VirtioDummy(system.ram);
    //system.virtiogpudev = new VirtioGPU(system.ram);
    //system.virtioconsoledev = new VirtioConsole(system.ram);
    system.virtiodev1 = new VirtIODev(irqhandler, 0x6, system.ram, system.virtio9pdev);
    system.virtiodev2 = new VirtIODev(irqhandler, 0xB, system.ram, system.virtiodummydev);
    system.virtiodev3 = new VirtIODev(irqhandler, 0xC, system.ram, system.virtiodummydev);

    system.devices.push(system.irqdev);
    system.devices.push(system.timerdev);
    system.devices.push(system.uartdev0);
    system.devices.push(system.uartdev1);
    system.devices.push(system.ethdev);
    system.devices.push(system.fbdev);
    system.devices.push(system.atadev);
    system.devices.push(system.tsdev);
    system.devices.push(system.kbddev);
    system.devices.push(system.snddev);
    system.devices.push(system.rtcdev);
    system.devices.push(system.virtio9pdev);
    system.devices.push(system.virtiodev1);
    system.devices.push(system.virtiodev2);
    system.devices.push(system.virtiodev3);

    //system.devices.push(system.virtioinputdev);
    //system.devices.push(system.virtionetdev);
    //system.devices.push(system.virtioblockdev);
    system.devices.push(system.virtiodummydev);
    //system.devices.push(system.virtiogpudev);
    //system.devices.push(system.virtioconsoledev);

    system.ram.AddDevice(system.uartdev0,   0x90000000, 0x7);
    system.ram.AddDevice(system.fbdev,      0x91000000, 0x1000);
    system.ram.AddDevice(system.ethdev,     0x92000000, 0x1000);
    system.ram.AddDevice(system.tsdev,      0x93000000, 0x1000);
    system.ram.AddDevice(system.kbddev,     0x94000000, 0x100);
    system.ram.AddDevice(system.uartdev1,   0x96000000, 0x7);
    system.ram.AddDevice(system.virtiodev1, 0x97000000, 0x1000);
    system.ram.AddDevice(system.snddev,     0x98000000, 0x400);
    system.ram.AddDevice(system.rtcdev,     0x99000000, 0x1000);
    system.ram.AddDevice(system.irqdev,     0x9A000000, 0x1000);
    system.ram.AddDevice(system.timerdev,   0x9B000000, 0x1000);
    system.ram.AddDevice(system.virtiodev2, 0x9C000000, 0x1000);
    system.ram.AddDevice(system.virtiodev3, 0x9D000000, 0x1000);
    system.ram.AddDevice(system.atadev,     0x9E000000, 0x1000);
    message.Debug("Init OpenRISC SoC finished");
}

export default InitOpenRISC;
