// Self-contained regression test for the OpenRISC CPU facade.
//
// Runs with plain Node ("npm test") - no browser and no test framework needed.
// It exercises each selectable CPU backend through the same public facade the
// worker uses (js/worker/or1k/index.js) and checks that a basic l.add produces
// the expected result.

// These globals exist inside a Web Worker but not in Node; the message handler
// module references them at load time.
global.onmessage = null;
global.postMessage = function () {};

var RAM = require('../js/worker/ram');
var CPU = require('../js/worker/or1k/index');

var EXPECTED = 0x001AAAA0;

function buildProgram(heap) {
    var h = new Uint32Array(heap);
    var registers = new Uint32Array(heap);

    registers[0] = 0x00100000;
    registers[1] = 0x000AAAA0;

    // l.add rD=2, rA=0, rB=1
    var add = (0x3 << 30) | (0x8 << 26) | (0x2 << 21) | (0x0 << 16) | (0x1 << 11);
    var nop = (0x5 << 26) | (0x1 << 24);

    var initialPC = 0x40040;
    h[initialPC] = add;
    for (var i = 0; i < 20000; i++) {
        h[initialPC + i + 1] = nop;
    }
    return registers;
}

async function runBackend(cpuname) {
    var memorySize = 2; // MB
    var heap = new ArrayBuffer(memorySize * 0x100000);
    var ram = new RAM(heap, 0x100000);
    var registers = buildProgram(heap);

    var cpu = new CPU(cpuname, ram, heap, 1); // 1 core
    await cpu.Init();
    cpu.Reset();
    cpu.Step(64, 0);

    var got = registers[2] >>> 0;
    if (got !== EXPECTED) {
        throw new Error('expected r2=0x' + EXPECTED.toString(16) +
            ' got 0x' + got.toString(16));
    }
}

(async function () {
    var backends = ['safe', 'asm', 'smp'];
    var failures = 0;
    for (var i = 0; i < backends.length; i++) {
        var name = backends[i];
        try {
            await runBackend(name);
            console.log('ok   - ' + name + ' CPU adds two 32 bit registers');
        } catch (e) {
            failures++;
            console.error('FAIL - ' + name + ' CPU: ' + e.message);
        }
    }
    if (failures) {
        console.error('\n' + failures + ' backend(s) failed');
        process.exit(1);
    }
    console.log('\nAll CPU backends passed');
})();
