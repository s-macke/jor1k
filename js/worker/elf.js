var message = require('./messagehandler');
var utils = require('./utils');
var marshall = require('./dev/virtio/marshall');

var elf = {};

elf.IsELF = function(buffer) {
    if ((buffer[0] == 0x7F) && 
        (buffer[1] == 0x45) && 
        (buffer[2] == 0x4C) && 
        (buffer[3] == 0x46)) 
        return true;

    return false;
}
    
elf.Extract = function(srcbuffer, ram) {

    var offset = 0;
    var output = [];
    output = marshall.Unmarshall(["w", "b", "b", "b", "b"], srcbuffer, offset);
    var ei_class = output[1];
    if (ei_class != 1) {
        message.Debug("Error reading elf binary: 64-Bit not supported");
        message.Abort();
    }

/*
    output[0] // magic
    output[1] // ei_class  1 -> 32 bit, 2 -> 64 bit
    output[2] // ei_data    1 little end, 2 big end
    output[3] // ei_version  currently always 1
    output[4] // ei_pad      marks beginning of padding
*/

    offset = 0x10;
    output = marshall.Unmarshall(["h", "h", "w", "w", "w", "w"], srcbuffer, offset);
    var e_entry = output[3]; // virtual address of entry point into program
    var e_phoff = output[4]; // offset for program header
    var e_shoff = output[5]; // offset for section header
    //message.Debug("e_entry: " +  utils.ToHex(e_entry));
    //message.Debug("e_phoff: " +  utils.ToHex(e_phoff));
    //message.Debug("e_shoff: " +  utils.ToHex(e_shoff));

    offset = 0x28;
    output = marshall.Unmarshall(["h", "h", "h"], srcbuffer, offset);
    var e_ehsize = output[0]; // size of each individual entry in program header table
    var e_phentsize = output[1]; // Contains the size of a program header table entry.
    var e_phnum = output[2]; // Contains the number of entries in the program header table.

    offset = 0x2E;
    output = marshall.Unmarshall(["h", "h", "h"], srcbuffer, offset);
    var e_shentsize = output[0]; // size of each individual entry in section header table
    var e_shnum = output[1]; // number of entries in section header table
    var e_shstrndx = output[2]; // section header string table index
    //message.Debug("e_shentsize: " +  utils.ToHex(e_shnum));
    //message.Debug("e_shnum: " +  utils.ToHex(e_shnum));
    //message.Debug("e_shstrndx: " +  utils.ToHex(e_shstrndx));

    var program_headers = [];

    for (var i = 0; i < e_phnum; i++) {

        offset = e_phoff + i*e_phentsize;
        output = marshall.Unmarshall(["w", "w", "w", "w", "w", "w", "w", "w"], srcbuffer, offset);

        var section = {};
        section.type = output[0];
        section.offset = output[1];
        section.vaddr = output[2];
        section.paddr = output[3];
        section.filesz = output[4];
        section.memsz = output[5];
        section.flags = output[6];
        section.align = output[7];
/*
        message.Debug("elf program section"
                + " type:" + section.type
		+ " vaddr:" + utils.ToHex(section.vaddr)
		+ " paddr:" + utils.ToHex(section.paddr)
                + " offset:" + utils.ToHex(section.offset)
                + " filesz:" + utils.ToHex(section.filesz)
                + " memsz:" + utils.ToHex(section.memsz)
                + " flags:" + utils.ToHex(section.flags));
*/
        program_headers.push(section);
}

    var section_headers = [];

   for (var i = 0; i < e_shnum; i++) {

        offset = e_shoff + i*e_shentsize;
        output = marshall.Unmarshall(["w", "w", "w", "w", "w", "w"], srcbuffer, offset);

        var section = {};
        section.name = output[0];
        section.type = output[1];
        section.flags = output[2];
        section.addr = output[3];
        section.offset = output[4];
        section.size = output[5];
/*
        message.Debug("elf section name:" + section.name
		+ " addr:" + utils.ToHex(section.addr)
                + " offset:" + utils.ToHex(section.offset)
                + " size:" + utils.ToHex(section.size)
                + " flags:" + utils.ToHex(section.flags)
                + " type:" + utils.ToHex(section.type));
*/
        section_headers.push(section);

    }

    for (var i = 0; i < program_headers.length; i++) {
        if (program_headers[i].type != 1) continue;
        if (program_headers[i].memsz == 0) continue;

        if (program_headers[i].filesz > 0) {
            for (var j = 0; j < program_headers[i].filesz; j++) {
                ram.Write8(program_headers[i].paddr + j, srcbuffer[program_headers[i].offset + j]);
            }
        }
        for (var j = 0; j < program_headers[i].memsz-program_headers[i].filesz; j++) {
            ram.Write8(program_headers[i].paddr+program_headers[i].filesz + j, 0x0);
        }
    }
}

module.exports = elf;
