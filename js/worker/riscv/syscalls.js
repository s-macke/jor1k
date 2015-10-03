// -------------------------------------------------
// ----------------- SYSCALLS ----------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

var SYS_OPENAT      = 56;
var SYS_CLOSE       = 57;
var SYS_PREAD       = 67;
var SYS_WRITE       = 64;
var SYS_FSTAT       = 80;
var SYS_EXIT        = 93;
var SYS_GETMAINVARS = 2011;

function SysCalls(ram) {

    this.ram = ram;
    this.elf8mem = [];
    this.file_descriptor_table = [];
    this.file_size = []; //file descriptor is the index
    this.file_pointer = []; //file descriptor is the index
    this.file_descriptor_offset = 9;
    this.elf8mem_offset = 0x00;

}

SysCalls.prototype.HandleSysCall = function (addr) {

    addr = addr | 0;
    var ram = this.ram;
    var syscall_id = this.ram.Read32(addr);
    //message.Debug("syscall_id " + syscall_id);
    var argv = ["spike", "-m31", "-p1", "vmlinux"];
    switch(syscall_id){

        case SYS_OPENAT:
            //sys_openat
            var filename_pointer = this.ram.Read32(addr + 16);
            var filename = "";
            for(var i=0,c;;i++){
                c = this.ram.Read8(filename_pointer+i);
                if(c == 0)
                    break;
                else
                    filename += String.fromCharCode(c);
            }
            var url = filename;
            utils.LoadBinaryResourceII("../sys/riscv/" + url, 
                this.OnFileLoaded.bind(this), 
                false, 
                function(error){throw error;}
            );
            this.ram.Write32(addr, this.file_descriptor_offset);
            break;

        case SYS_PREAD:
            //sys_pread
            var file_descriptor = this.ram.Read32(addr + 8);
            var file_address = this.file_descriptor_table[file_descriptor];
            var buffer_address = this.ram.Read32(addr + 16);
            var number_bytes = this.ram.Read32(addr + 24);
            //var file_offset = this.file_pointer[file_descriptor];
            var file_offset = this.ram.Read32(addr + 32);
            var file_length = this.file_size[file_descriptor];
            var i = 0;
            for(var b;i < number_bytes;i++){
                if((i + file_offset) >= file_length) break;
                b = this.elf8mem[file_address + i + file_offset];
                this.ram.Write8(buffer_address + i, b);
            }
            this.file_pointer[file_descriptor] += i;
            this.ram.Write32(addr, i);
            break;

        case SYS_CLOSE:
            //sys_close
            this.ram.Write32(addr, 0);
            break;

        case SYS_FSTAT:
            //sys_fstat
            var file_descriptor = this.ram.Read32(addr + 8);
            var stat_buffer_address = this.ram.Read32(addr + 16);
            this.ram.Write32(stat_buffer_address, 0); //unsigned long   Device. 
            this.ram.Write32(stat_buffer_address + 4, 0); //unsigned long   File serial number
            this.ram.Write16(stat_buffer_address + 8, 0x81FF); //unsigned int    File mode
            this.ram.Write16(stat_buffer_address +10, 0); //unsigned int    Link count
            this.ram.Write16(stat_buffer_address +12, 0); //unsigned int    User ID of the file's owner
            this.ram.Write16(stat_buffer_address +14, 0); //unsigned int    Group ID of the file's group
            this.ram.Write32(stat_buffer_address +16, 0); //unsigned long   Device number, if device
            this.ram.Write32(stat_buffer_address +20, 0); //unsigned long   __pad1
            this.ram.Write32(stat_buffer_address +24, this.file_size[file_descriptor]); //long Size of file, in bytes
            this.ram.Write16(stat_buffer_address +28, 512); //int           Optimal block size for I/O
            this.ram.Write16(stat_buffer_address +30, 0); //int             __pad2
            this.ram.Write32(stat_buffer_address +32, 0); //long            Number 512-byte blocks allocated
            this.ram.Write32(stat_buffer_address +36, 0); //long            Time of last access
            this.ram.Write32(stat_buffer_address +40, 0); //unsigned long   st_atime_nsec
            this.ram.Write32(stat_buffer_address +44, 0); //long            Time of last modification
            this.ram.Write32(stat_buffer_address +48, 0); //unsigned long   st_mtime_nsec
            this.ram.Write32(stat_buffer_address +52, 0); //long            Time of last status change
            this.ram.Write32(stat_buffer_address +56, 0); //unsigned long   st_ctime_nsec
            this.ram.Write16(stat_buffer_address +60, 0); //unsigned int    __unused4
            this.ram.Write16(stat_buffer_address +62, 0); //unsigned int    __unused5
            this.ram.Write32(addr, 1);
            break;

        case SYS_WRITE:
            //sys_write
            var length = this.ram.Read32(addr + 8*3), i =0;
            var string_address = this.ram.Read32(addr + 8*2);
            while(i < length){
                var c = this.ram.Read8(string_address + (i++));
                this.ram.Write8Little(0x90000000 >> 0, c);
                if (c == 0xA) this.ram.Write8(0x90000000 >> 0, 0xD);
            }
            this.ram.Write32(addr, i);
            break;

        case SYS_EXIT:
            //sys_exit
            message.Debug("Program exited with sys_exit for inst at PC "+utils.ToHex(this.pc));
            message.Abort();
            break;

        case SYS_GETMAINVARS:
            //sys_getmainvars
            var address = this.ram.Read32(addr + 8);
            var length = this.ram.Read32(addr + 16);

           // write argc
            this.ram.Write32(address, argv.length);
            // argv[argc] = NULL
            // envp[0] = NULL

            // generate list of pointers to string
            var ofs = argv.length*8 + 8*4; // offset of first string entry
            for(var i=0; i<argv.length; i++) {
                this.ram.Write32(address+8+i*8, address + ofs);
                ofs += argv[i].length+1;
            }

            ofs = argv.length*8 + 8*4;
            for(var i=0; i<argv.length; i++) {
                for (var j=0; j<argv[i].length; j++) {
                    this.ram.Write8(address + ofs, argv[i].charCodeAt(j));
                    ofs++;
                }
                ofs++; // terminating "\0"
            }

            this.ram.Write32(addr, 0);
            break;

        default:
            message.Debug("unkown SysCall "+utils.ToHex(syscall_id)+" at PC "+utils.ToHex(this.pc));
            message.Abort();
           break;
    }

};

SysCalls.prototype.OnFileLoaded = function(buffer) {
    var buffer8 = new Uint8Array(buffer);
    var length = buffer8.length;
message.Debug("On File Loaded " + length);
    for(var i=0; i<length; i++) this.elf8mem[i+this.elf8mem_offset] = buffer8[i];
    this.file_descriptor_table[++this.file_descriptor_offset] = this.elf8mem_offset;
    this.elf8mem_offset += length;
    this.file_size[this.file_descriptor_offset] = length;
    this.file_pointer[this.file_descriptor_offset] = 0;
    
};

module.exports = SysCalls;
