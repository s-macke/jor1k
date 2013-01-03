jor1k
=====

OR1K Emulator written in Javascript running Linux

Hardware Specifications of Emulated hardware:

-    32-Bit OR1000 Emulator with MMU, TICK counter and PIC 
-    32 MB Ram
-    UART 16550
-    ocfb Framebuffer 320x240 32bpp
-    Linux Terminal Emulator
-    5 MB image running Linux 3.1 and busybox 1.19 (and much more)
    
Memory Map:

0x00000000 - 0x02000000		32 MB Random Access Memory
0x90000000 - 0x90000006 	UART 16550 connected to the terminal and keyboard
0x91000000 - 0x91001000		opencore VGA/LCD 2.0 core frame buffer (320x200 32bpp)
0x92000000 - 0x92001000		Ethernet MAC controller (not working, just for compatibility)

To increase the speed of the simulation the TLB Refill is done in Javascript. Unfortunately 
this makes it dependent on the Linux kernel as it needs the pointer to the internal translation table of 
the Linux kernel.

