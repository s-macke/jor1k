// this needs to bre present in the global scope
// for the message module
global.onmessage = null;
global.postMessage = function() {
    console.log(arguments);
}
var RAM = require('../js/worker/ram');
var CPU = require('../js/worker/cpu');

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('expect');

['safe', 'smp', 'asm'].forEach(function(cpuname) {

    lab.test(cpuname + ' CPU can add two 32 bit registers', function (done) {
        var memorySize = 2; // MB
        var ramOffset = 0x100000;

        var heap = new ArrayBuffer(memorySize * 0x100000); 
        var registers = new Uint32Array(heap);
        var ram = new RAM(heap, ramOffset);
        console.log('creating ' + cpuname + ' CPU');
        var cpu = new CPU(cpuname, ram, heap, 1); // 1 core
        console.log('done');
        console.log('reset');
        cpu.Reset();
        console.log('done');

        registers[0] = 0x00100000;
        registers[1] = 0x000AAAA0;

        var add = 0x3 << 30 | 0x8 << 26 |
            0x2 << 21 | // rD
            0x0 << 16 | // rA
            0x1 << 11;  // rB

        ram.WriteMemory32(0x0100, add);
        //console.log(cpu.toString());
        console.log('adding');
        cpu.Step(1, 1);
        console.log('done');
        //console.log(cpu.toString());

        expect(registers[2]).toEqual(0x001AAAA0);
        done();
    });
});
