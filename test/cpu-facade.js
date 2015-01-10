// this needs to bre present in the global scope
// for the message module
global.onmessage = null;

var RAM = require('../js/worker/ram');
var CPU = require('../js/worker/cpu');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('expect');

['safe', 'asm', 'smp'].forEach(function(cpuname) {
    lab.test(cpuname + ' CPU can add two 32 bit registers', function (done) {
        var memorySize = 2; // MB
        var ramOffset = 0x100000;
        var instructions = 5;
        var cyclesPerInstruction = 1;

        var heap = new ArrayBuffer(memorySize * 0x100000); 
        var registers = new Uint32Array(heap);
        var ram = new RAM(heap, ramOffset);
        var cpu = new CPU('safe', ram, heap, 1); // 1 core
        cpu.Reset();

        registers[0] = 0x00100000;
        registers[1] = 0x000AAAA0;

        var add = 0x3 << 30 | 0x8 << 26 |
            0x2 << 21 | // rD
            0x0 << 16 | // rA
            0x1 << 11;  // rB

        ram.WriteMemory32(0x0100, add);
        //console.log(cpu.toString());
        cpu.Step(1, 1);
        //console.log(cpu.toString());

        expect(registers[2]).toEqual(0x001AAAA0);
        done();
    });
});
