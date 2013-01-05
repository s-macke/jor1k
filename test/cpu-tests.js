var cpu = new CPU();

test('Processor flags', function() { 
    equal(cpu.GetFlags(), 0x8001, 'Initial flags'); 
});