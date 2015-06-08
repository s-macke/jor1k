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
    
elf.Extract = function(srcbuffer, destbuffer) {

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

    offset = 0x2E;
    output = marshall.Unmarshall(["h", "h", "h"], srcbuffer, offset);
    var e_shentsize = output[0]; // size of each individual entry in section header table
    var e_shnum = output[1]; // number of entries in section header table
    var e_shstrndx = output[2]; // section header string table index
    //message.Debug("e_shentsize: " +  utils.ToHex(e_shnum));
    //message.Debug("e_shnum: " +  utils.ToHex(e_shnum));
    //message.Debug("e_shstrndx: " +  utils.ToHex(e_shstrndx));

    var section_headers = [];

    for (var i = 0; i < e_shnum; i++) {

        offset = e_shoff + i*e_shentsize;
        output = marshall.Unmarshall(["w", "w", "w", "w", "w", "w"], srcbuffer, offset);

        var section = {};
        section.name = output[0];
        section.type = output[1];
        section.flags = output[2];
        section.addr = output[3];
        section.offs = output[4];
        section.size = output[5];
        /*
        message.Debug("" +
		section.name + " " + 
		utils.ToHex(section.addr) + " " + 
		utils.ToHex(section.size));
        */
        section_headers.push(section);
    }

    // copy necessary data into memory
    for (var i = 0; i < section_headers.length; i++) {

        // check for allocate flag (bit #1) and type != 8 (aka NOT NOBITS)
        if ((((section_headers[i].flags >> 1) & 0x1) == 0x1) && (section_headers[i].type != 8)) {
            for (var j = 0; j < section_headers[i].size; j++) {
                destbuffer[section_headers[i].addr + j] = srcbuffer[section_headers[i].offs + j];
            }
        } else 
        if ((((section_headers[i].flags >> 1) & 0x1) == 0x1) && (section_headers.type == 8)) {
            // for .bss, load in zeroes, since it's not actually stored in the elf
            for (var j = 0; j < section_headers[i].size; j++) {
                destbuffer[section_headers[i].addr + j] = 0x0;
            }
        }
    }
}

module.exports = elf;
