// -------------------------------------------------
// ----------------- Ethernet ----------------------
// -------------------------------------------------
// Emulation of the OpenCores ethmac ethernet controller.

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

//REGISTER ADDRESSES
var ETHMAC_ADDR_MODER = 0x0;
var ETHMAC_ADDR_INT_SOURCE = 0x4;
var ETHMAC_ADDR_INT_MASK = 0x8;
var ETHMAC_ADDR_IPGT = 0xC;
var ETHMAC_ADDR_IPGR1 = 0x10;
var ETHMAC_ADDR_IPGR2 = 0x14;
var ETHMAC_ADDR_PACKETLEN = 0x18;
var ETHMAC_ADDR_COLLCONF = 0x1C;
var ETHMAC_ADDR_TX_BD_NUM = 0x20;
var ETHMAC_ADDR_CTRLMODER = 0x24;
var ETHMAC_ADDR_MIIMODER = 0x28;
var ETHMAC_ADDR_MIICOMMAND = 0x2C;
var ETHMAC_ADDR_MIIADDRESS = 0x30;
var ETHMAC_ADDR_MIITX_DATA = 0x34;
var ETHMAC_ADDR_MIIRX_DATA = 0x38;
var ETHMAC_ADDR_MIISTATUS = 0x3C;
var ETHMAC_ADDR_MAC_ADDR0 = 0x40;
var ETHMAC_ADDR_MAC_ADDR1 = 0x44;
var ETHMAC_ADDR_ETH_HASH0_ADR = 0x48;
var ETHMAC_ADDR_ETH_HASH1_ADR = 0x4C;
var ETHMAC_ADDR_ETH_TXCTRL = 0x50;

var ETHMAC_ADDR_BD_START = 0x400;
var ETHMAC_ADDR_BD_END = 0x7FF;


var MII_BMCR =           0x00;        /* Basic mode control register */
var MII_BMSR =           0x01;        /* Basic mode status register  */
var MII_PHYSID1 =        0x02;        /* PHYS ID 1                   */
var MII_PHYSID2 =        0x03;        /* PHYS ID 2                   */
var MII_ADVERTISE =      0x04;        /* Advertisement control reg   */
var MII_LPA =            0x05;        /* Link partner ability reg    */
var MII_EXPANSION =      0x06;        /* Expansion register          */
var MII_CTRL1000 =       0x09;        /* 1000BASE-T control          */
var MII_STAT1000 =       0x0a;        /* 1000BASE-T status           */
var MII_ESTATUS =        0x0f;        /* Extended Status */
var MII_DCOUNTER =       0x12;        /* Disconnect counter          */
var MII_FCSCOUNTER =     0x13;        /* False carrier counter       */
var MII_NWAYTEST =       0x14;        /* N-way auto-neg test reg     */
var MII_RERRCOUNTER =    0x15;        /* Receive error counter       */
var MII_SREVISION =      0x16;        /* Silicon revision            */
var MII_RESV1 =          0x17;        /* Reserved...                 */
var MII_LBRERROR =       0x18;        /* Lpback, rx, bypass error    */
var MII_PHYADDR =        0x19;        /* PHY address                 */
var MII_RESV2 =          0x1a;        /* Reserved...                 */
var MII_TPISTATUS =      0x1b;        /* TPI status for 10mbps       */
var MII_NCONFIG =        0x1c;        /* Network interface config    */



//TODO: MODER.LOOPBCK - loopback support
//TODO: Carrier Sense?
//TODO: Huge frames
//TODO: IAM mode
//TODO: MODER.BRO
function EthDev(ram, intdev, mac) {
    "use strict";
    this.ram = ram;
    this.intdev = intdev;
    this.TransmitCallback = function(data){}; // Should call handler to send data asynchronously.


    this.toTxStat = function(val) {
        return {
            LEN:   val >>> 16,
            RD:   (val >>> 15) & 1,
            IRQ:  (val >>> 14) & 1,
            WR:   (val >>> 13) & 1,
            PAD:  (val >>> 12) & 1,
            CRC:  (val >>> 11) & 1,
            UR:   (val >>> 8)  & 1,
            RTRY: (val >>> 4)  & 0xF,
            RL:   (val >>> 3)  & 1,
            LC:   (val >>> 2)  & 1,
            DF:   (val >>> 1)  & 1,
            CS:    val         & 1
        }
    }

    this.fromTxStat = function(stat) {
        var val = (stat.LEN << 16);
        val |=    ((stat.RD   & 1)   << 15);
        val |=    ((stat.IRQ  & 1)   << 14);
        val |=    ((stat.WR   & 1)   << 13);
        val |=    ((stat.PAD  & 1)   << 12);
        val |=    ((stat.CRC  & 1)   << 11);
        val |=    ((stat.UR   & 1)   << 8);
        val |=    ((stat.RTRY & 0xF) << 4);
        val |=    ((stat.RL   & 1)   << 3);
        val |=    ((stat.LC   & 1)   << 2);
        val |=    ((stat.CDF  & 1)   << 1);
        val |=     (stat.CS   & 1);
        return val;
    }

    this.toRxStat = function(val) {
        return {
            LEN:  val >>> 16,
            E:   (val >>> 15) & 1,
            IRQ: (val >>> 14) & 1,
            WR:  (val >>> 13) & 1,
            CF:  (val >>> 8)  & 1,
            M:   (val >>> 7)  & 1,
            OR:  (val >>> 6)  & 1,
            IS:  (val >>> 5)  & 1,
            DN:  (val >>> 4)  & 1,
            TL:  (val >>> 3)  & 1,
            SF:  (val >>> 2)  & 1,
            CRC: (val >>> 1)  & 1,
            LC:   val         & 1
        }
    }

    this.fromRxStat = function(stat) {
        var val = (stat.LEN << 16);
        val |=    ((stat.E   & 1) << 15);
        val |=    ((stat.IRQ & 1) << 14);
        val |=    ((stat.WR  & 1) << 13);
        val |=    ((stat.CF  & 1) << 8);
        val |=    ((stat.M   & 1) << 7);
        val |=    ((stat.OR  & 1) << 6);
        val |=    ((stat.IS  & 1) << 5);
        val |=    ((stat.DN  & 1) << 4);
        val |=    ((stat.TL  & 1) << 3);
        val |=    ((stat.SF  & 1) << 2);
        val |=    ((stat.CRC & 1) << 1);
        val |=     (stat.LC  & 1) ;
        return val;
    }

    this.makeCRCTable = function() {
        var c;
        var crcTable = [];
        for(var n =0; n < 256; n++) {
            c = n;
            for(var k =0; k < 8; k++) {
                c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        return crcTable;
    }

    this.crcTable = this.makeCRCTable();

    this.crc32 = function(data, offset, length) {
        var crc = 0 ^ (-1);

        var bytelen = 4;
        if (data instanceof Uint16Array || data instanceof Int16Array) {
            bytelen = 2;
        } else if (data instanceof Uint8Array || data instanceof Int8Array) {
            bytelen = 1;
        }

        if (!length) {
            length = data.length;
        }
        if (!offset) {
            offset = 0;
        }

        var val = 0x0;
        for (var i = offset; i < length; i++ ) {
            //first byte
            val = data[i] & 0xFF;
            crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

            if (bytelen > 1) {
                //second byte
                val = (data[i] >>> 8) & 0xFF;
                crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

                if (bytelen > 2) {
                    //third byte
                    val = (data[i] >>> 16) & 0xFF;
                    crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

                    //fourth byte
                    val = (data[i] >>> 24) & 0xFF;
                    crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];
                }
            }
        }

        return (crc ^ (-1)) >>> 0;
    };

    this.Reset = function () {
        this.MODER = 0xA000;
        this.INT_SOURCE = 0x0;
        this.INT_MASK = 0x0;
        this.IPGT = 0x12;
        this.IPGR1 = 0xC;
        this.IPGR2 = 0x12;
        this.PACKETLEN = 0x400600;
        this.COLLCONF = 0xF003F;
        this.TX_BD_NUM = 0x40;
        this.CTRLMODER = 0x0;
        this.MIIMODER = 0x64;
        this.MIICOMMAND = 0x0;
        this.MIIADDRESS = 0x0;
        this.MIITX_DATA = 0x0;
        this.MIIRX_DATA = 0x22; //default is 0x0
        this.MIISTATUS = 0x0;
        
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 24);
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 16);
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 8);
        this.MAC_ADDR0 |= Math.floor(Math.random()*256);

        this.MAC_ADDR1 |= (((Math.floor(Math.random()*256) << 8) & 0xfe) | 0x02);
        this.MAC_ADDR1 |= Math.floor(Math.random()*256);

        this.ETH_HASH0_ADR = 0x0;
        this.ETH_HASH1_ADR = 0x0;
        this.ETH_TXCTRL = 0x0;

        this.BD = new Uint32Array(256);//128 64bit descriptors
        for(var i=0;i<256;i++) {
            this.BD[i] = 0x0;
        }
         
        this.MIIregs = new Uint16Array(16);
        this.MIIregs[MII_BMCR] = 0x0100; // Full duplex
        // link ok, negotiation complete, 10Mbit and 100Mbit available
        this.MIIregs[MII_BMSR] = 0x4 | 0x20 | 0x800 | 0x1000 | 0x2000 | 0x4000;

        this.MIIregs[MII_PHYSID1] = 0x2000;
        this.MIIregs[MII_PHYSID2] = 0x5c90;
        this.MIIregs[MII_ADVERTISE] = 0x01e1;
	this.MIIregs[MII_PHYADDR] = 0x0;

        // link ok
        // this.MIIregs[MII_LPA] |= 0x01e1;

        this.currRX = (this.TX_BD_NUM << 1);
    };

    this.Receive = function(data_arraybuffer) {
        //check RXEN
        if ((this.MODER & 0x1) == 0) {
            return;
        }
        var data = new Uint8Array(data_arraybuffer);

        //if this is a binary transmission, it's a frame
        var promiscuous = false;
        var match = false;
        var multicast = false;
        
        //MAC detection
        var mac0 = 0x0;
        var mac1 = 0x0;

        mac0 |= (data[2] << 24);
        mac0 |= (data[3] << 16);
        mac0 |= (data[4] << 8);
        mac0 |= data[5];

        mac1 |= (data[0] << 8);
        mac1 |= data[1];

        if (mac0 == this.MAC_ADDR0 && mac1 == this.MAC_ADDR1) {
            match = true;
        }else if (mac1 & (1 << 15)) {
            multicast = true;
        }

        if (this.MODER & (1<<5)) {
            promiscuous = true;
        }

        var i = this.currRX;

        //won't branch if no match/multicast and we're not promiscuous
        if (promiscuous || multicast || match) {
            var err = false;
            //if this BD is ready
            if (this.BD[i] & (1 << 15)) {
                var stat = this.toRxStat(this.BD[i]);

                if (!match && !multicast && promiscuous) {
                    stat.M = 1;
                }
                
                //NOTE: ethoc leaves control frame support disabled
                //leaving these as todo for now.
                //TODO: control frame detection, see pg 31 of SPEC:
                    //TODO: PAUSE frame
                    //TODO: Type/length control frame
                    //TODO: Latch Control Frame
                
                
                //TODO: Dribble Nibble - for now assume frame is proper size
                stat.DN = 0;

                //Too Long, bigger than max packetlen
                if (data.length > (this.PACKETLEN & 0xFFFF)) {
                    //check HUGEN
                    if (this.MODER & (1 << 14)) {
                        //TODO: in this case, how much of the frame do we write?
                        stat.TL = 1;
                    } else {
                        stat.TL = 0;
                        //according to 2.3.5.6 of design doc, we still write
                        //the start of the frame, and don't mark TL bit?
                        //TODO: need to check this behavior
                    }
                } else {
                    stat.TL = 0;
                }
                
                if (stat.DN == 0) {
                    //We don't get a CRC from TAP devices, so just assert this
                    stat.CRC = 0;
                }

                var crc = 0x0;

                crc |= (data[data.length-4] << 24);
                crc |= (data[data.length-3] << 16);
                crc |= (data[data.length-2] << 8);
                crc |= data[data.length-1];

                //write the packet to the memory location
                //TODO: do we want to write on an error, anyway?
                if (!err) {
                    stat.LEN = data.length;

                    var aligned = true;

                    if (stat.LEN > (this.PACKETLEN & 0xFFFF)) {
                        stat.LEN = this.PACKETLEN & 0xFFFF;
                    }

                    var ptr = this.BD[i+1];
                    for(var j=0;j<stat.LEN;j++) {
                        ram.Write8(ptr+j, data[j]);
                    }
                    
                    //add the CRC back into the length field
                    stat.LEN += 4;

                    //mark buffer ready to be read
                    stat.E = 0;
                }

                this.BD[i] = this.fromRxStat(stat);
                //IRQ
                if (stat.IRQ) {
                    if (err) {
                        //RXE interrupt
                        this.INT_SOURCE |= (1 << 3);
                    }
                    //RXB interrupt
                    this.INT_SOURCE |= (1 << 2);

                    if (this.INT_MASK & this.INT_SOURCE) {
                        this.intdev.RaiseInterrupt(0x4);
                    } else {
                        this.intdev.ClearInterrupt(0x4);
                    }

                }
            } else {
                //BUSY interrupt
                this.INT_SOURCE |= (1 << 4);
                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }
            }

            //check wrap bit and BD bounds
            if ((this.BD[this.currRX] & (1 << 13)) ||
                (this.currRX + 2) >= this.BD.length) {

                this.currRX = (this.TX_BD_NUM << 1);
            } else {
                this.currRX+=2;
            }
        }
    };

    this.Transmit = function(bd_num) {
        
        //check MODER.TXEN
        if ((this.MODER & (1 << 1)) == 0) {
            return;
        }

        var stat = this.toTxStat(this.BD[bd_num << 1]);
        var ptr = this.BD[(bd_num << 1) + 1];

        //Check RD bit
        if (stat.RD == 0) {
            return;
        }


        //check crc gen for frame size modification
        var frameSize = stat.LEN;
        var crc = false;
        if (stat.CRC || (this.MODER & (1 << 13))) {
            //frameSize += 4;
            //crc = true;
        }

        //check padding for frame size modification
        var pad = false;
        var padlen = 0;
        if (stat.PAD || (this.MODER & (1 << 15))) {
            pad = true;

            if ((this.PACKETLEN >>> 16) > stat.LEN) {
                frameSize = this.PACKETLEN >>> 16;
            }
        }

        //TODO: do we ever need preamble/frame start?
        var frame = new Uint8Array(frameSize);
        
        for(var i=0;i<frame.length;i++) {
            if (i<stat.LEN) {
                frame[i] = ram.Read8(ptr+i);
            } else {
                frame[i] = 0;
            }
        }

        //should only have one 32bit word left to write here
        if (crc) {
            var crcval = 0;
            //if DLYCRCEN
            if (this.MODER & (1 << 12)) {
                crcval = this.crc32(frame, 4, frame.length-4);
            } else {
                crcval = this.crc32(frame, 0, frame.length-4);
            }

            frame[frame.length-1] = (crcval >> 24);
            frame[frame.length-2] = (crcval >> 16) & 0xFF;
            frame[frame.length-3] = (crcval >> 8) & 0xFF;
            frame[frame.length-4] = crcval & 0xFF;
        }

        this.TransmitCallback(frame.buffer);

        //set error bits
        stat.UR = 0;
        stat.RTRY = 0;
        stat.RL = 0;
        stat.LC = 0;
        stat.DF = 0;
        stat.CS = 0;

        stat.RD = 0;

        this.BD[bd_num << 1] = this.fromTxStat(stat);

        this.INT_SOURCE |= 1;

        if (this.INT_MASK & this.INT_SOURCE) {
            this.intdev.RaiseInterrupt(0x4);
        } else {
            this.intdev.ClearInterrupt(0x4);
        }
    };

    this.ReadReg32 = function (addr) {
        var ret = 0x0;
        switch (addr) {
            case ETHMAC_ADDR_MODER:
                ret = this.MODER;
                break;

            case ETHMAC_ADDR_INT_SOURCE:
                ret = this.INT_SOURCE;
                break;

            case ETHMAC_ADDR_INT_MASK:
                ret = this.INT_MASK;
                break;

            case ETHMAC_ADDR_IPGT:
                ret = this.IPGT;
                break;

            case ETHMAC_ADDR_IPGR1:
                ret = this.IPGR1;
                break;

            case ETHMAC_ADDR_IPGR2:
                ret = this.IPGR2;
                break;

            case ETHMAC_ADDR_PACKETLEN:
                ret = this.PACKETLEN;
                break;

            case ETHMAC_ADDR_COLLCONF:
                ret = this.COLLCONF;
                break;

            case ETHMAC_ADDR_TX_BD_NUM:
                ret = this.TX_BD_NUM;
                break;

            case ETHMAC_ADDR_CTRLMODER:
                ret = this.CTRLMODER;
                break;

            case ETHMAC_ADDR_MIIMODER:
                ret = this.MIIMODER;
                break;

            case ETHMAC_ADDR_MIICOMMAND:
                ret = this.MIICOMMAND;
                break;

            case ETHMAC_ADDR_MIIADDRESS:
                ret = this.MIIADDRESS;
                break;

            case ETHMAC_ADDR_MIITX_DATA:
                ret = this.MIITX_DATA;
                break;

            case ETHMAC_ADDR_MIIRX_DATA:
                ret = this.MIIRX_DATA;
                break;

            case ETHMAC_ADDR_MIISTATUS:
                ret = this.MIISTATUS;
                break;

            case ETHMAC_ADDR_MAC_ADDR0:
                ret = this.MAC_ADDR0;
                break;

            case ETHMAC_ADDR_MAC_ADDR1:
                ret = this.MAC_ADDR1;
                break;

            case ETHMAC_ADDR_ETH_HASH0_ADR:
                ret = this.ETH_HASH0_ADR;
                break;

            case ETHMAC_ADDR_ETH_HASH1_ADR:
                ret = this.ETH_HASH1_ADR;
                break;

            case ETHMAC_ADDR_ETH_TXCTRL:
                ret = this.ETH_TXCTRL;
                break;
            default:
                if (addr >= ETHMAC_ADDR_BD_START &&
                    addr <= ETHMAC_ADDR_BD_END) {
                    ret = this.BD[(addr-ETHMAC_ADDR_BD_START)>>>2];
                } else {
                    message.Debug("Attempt to access ethmac register beyond 0x800");
                }
        }
        return ret;
    };

    this.HandleMIICommand = function()
    {
        var fiad = this.MIIADDRESS & 0x1F;
        var rgad = (this.MIIADDRESS >> 8) & 0x1F;
        var phy_addr = 0x0;
        switch(this.MIICOMMAND) {
            case 0:
                break;

            case 1: // scan status
                break;

            case 2: // read status
                if (fiad != phy_addr) {
                    this.MIIRX_DATA = 0xFFFF;
                } else {
                    // message.Debug("MIICOMMAND read" + " " + utils.ToHex(rgad));
                    this.MIIRX_DATA = this.MIIregs[rgad];
                }
                break;

            case 4: // write status
                if (fiad != phy_addr) {
                } else {
                    // message.Debug("MIICOMMAND write" + " " + utils.ToHex(rgad) + " " + utils.ToHex(this.MIITX_DATA));
                    //this.MIIregs[rgad] = this.MIITX_DATA & 0xFFFF;
                }
                break;

            default:
                message.Debug("Error in ethmac: Unknown mii command detected");
                break;
        }

    }



    this.WriteReg32 = function (addr, val) {
        // message.Debug("write ethmac " + utils.ToHex(addr));
        switch (addr) {
            case ETHMAC_ADDR_MODER:
                this.MODER = val;
                break;

            case ETHMAC_ADDR_INT_SOURCE:
                //to clear an interrupt, it must be set in the write
                //otherwise, leave the other bits alone
                this.INT_SOURCE = this.INT_SOURCE & ~val;

                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }

                break;

            case ETHMAC_ADDR_INT_MASK:
                this.INT_MASK = val;

                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }

                break;

            case ETHMAC_ADDR_IPGT:
                this.IPGT = val;
                break;

            case ETHMAC_ADDR_IPGR1:
                this.IPGR1 = val;
                break;

            case ETHMAC_ADDR_IPGR2:
                this.IPGR2 = val;
                break;

            case ETHMAC_ADDR_PACKETLEN:
                this.PACKETLEN = val;
                break;

            case ETHMAC_ADDR_COLLCONF:
                this.COLLCONF = val;
                break;

            case ETHMAC_ADDR_TX_BD_NUM:
                this.TX_BD_NUM = val;
                this.currRX = (val << 1);
                break;

            case ETHMAC_ADDR_CTRLMODER:
                this.CTRLMODER = val;
                break;

            case ETHMAC_ADDR_MIIMODER:
                this.MIIMODER = val;
                break;

            case ETHMAC_ADDR_MIICOMMAND:
                this.MIICOMMAND = val;
		this.HandleMIICommand();
                break;

            case ETHMAC_ADDR_MIIADDRESS:
                this.MIIADDRESS = val;
                break;

            case ETHMAC_ADDR_MIITX_DATA:
                this.MIITX_DATA = val;
                break;

            case ETHMAC_ADDR_MIIRX_DATA:
                this.MIIRX_DATA = val;
                break;

            case ETHMAC_ADDR_MIISTATUS:
                this.MIISTATUS = val;
                break;

            case ETHMAC_ADDR_MAC_ADDR0:
                this.MAC_ADDR0 = val;
                break;

            case ETHMAC_ADDR_MAC_ADDR1:
                this.MAC_ADDR1 = val;
                break;

            case ETHMAC_ADDR_ETH_HASH0_ADR:
                this.ETH_HASH0_ADR = val;
                break;

            case ETHMAC_ADDR_ETH_HASH1_ADR:
                this.ETH_HASH1_ADR = val;
                break;

            case ETHMAC_ADDR_ETH_TXCTRL:
                this.ETH_TXCTRL = val;
                break;

            default:
                if (addr >= ETHMAC_ADDR_BD_START &&
                    addr <= ETHMAC_ADDR_BD_END) {

                    this.BD[(addr-ETHMAC_ADDR_BD_START)>>>2] = val;

                    //which buffer descriptor?
                    var BD_NUM = (addr - ETHMAC_ADDR_BD_START)>>>3;
                    
                    //make sure this isn't the pointer portion
                    if (((BD_NUM << 3) + ETHMAC_ADDR_BD_START) == addr) {
                        //did we just set the ready/empty bit?
                        if ((val & (1 << 15)) != 0) {
                            //TX, or RX?
                            if (BD_NUM < this.TX_BD_NUM) {
                                //TX BD
                                this.Transmit(BD_NUM);
                            }
                        }
                    }
                } else {
                    message.Debug("Attempt to access ethmac register beyond 0x800");
                }
        }
    };

    this.Reset();
    message.Register("ethmac", this.Receive.bind(this) );

}

module.exports = EthDev;
