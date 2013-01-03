# jor1k

jor1k is an  OR1K emulator written in JavaScrip running Linux. It runs in common web browser.

### Installation instruction
Download the content from the repisotory and open jor1k.html in your browser. Currently the program is tested under following browsers
* Firefox 17
* Opera 12
* Google Chrome 23 (if running locally you have to run the browser with the command --disable-web-security)
* Safari under iOS: works but no keyboard input
* Safari 5: Boots but hangs after the unpacking of initramfs (no Uint8ClampedArray support)
* Internet Explorer: not working

### Hardware Specifications of Emulated hardware:

* 32-Bit OR1000 Emulator with MMU, TICK counter and PIC ( [or1k specification](http://opencores.org/or1k/Main_Page) )
* 32 MB Ram
* UART 16550
* ocfb Framebuffer 320x240 32bpp
* Linux Terminal Emulator
* 5 MB image running Linux 3.1 and busybox 1.19 (and much more)
    
### Memory Map:

* 0x00000000 - 0x02000000    	32 MB Random Access Memory
* 0x90000000 - 0x90000006 		UART 16550 connected to the terminal and keyboard
* 0x91000000 - 0x91001000		opencore VGA/LCD 2.0 core frame buffer (320x200 32bpp)
* 0x92000000 - 0x92001000		Ethernet MAC controller (not working, just for compatibility)

### Hardware TLB Refill Hack
To increase the speed of the simulation the TLB Refill is done in Javascript. Unfortunately 
this makes it dependent on the Linux kernel as it needs the pointer to the internal translation table of 
the Linux kernel.

### Future plans
* separating and cleanup code 
* Include ATA emulation to simulate a drive, to have more space for programs which will be loaded on demand from the web server
* Add scripts in the repository to create this drive image.
* Running a C64 Emulator on the machine with the game Zork.
Emulation chain x86 -> JavaScript -> or1k -> MOS6502 -> Z-Machine
* Running a small X-server in the framebuffer. Add touch screen input.
* Run Ethernet over the server.
* Speed up the whole emulation.


### Developer
Sebastian Macke [simulationcorner.net](http://simulationcorner.net)
