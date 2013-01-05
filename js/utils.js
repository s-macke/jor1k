// -------------------------------------------------
// ------------------ Utils ------------------------
// -------------------------------------------------

function DebugMessage(message) {
    /*
	var Table = document.getElementById("Debug");
	var TR = Table.insertRow(-1);
	var TD = document.createElement("td");
	var TDtext = document.createTextNode(message);
	TD.appendChild(TDtext);
	TR.appendChild(TD);
	*/
    console.log(message);
}

function abort() {
    DebugMessage("Aborting execution.")
    PrintState();
    throw new Error('Abort javascript');
}

// big endian to little endian and vice versa
function Swap32(val) {
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >>> 8) & 0xFF00) | ((val >>> 24) & 0xFF);
}

function int32(val) {
    return (val >> 0);
}

function uint32(val) {
    return (val >>> 0);
}

function hex8(x) {
    return ("0x" + ("00000000" + x.toString(16)).substr(-8).toUpperCase());
}

function PrintState() {
    DebugMessage("Current state of the machine")
    //DebugMessage("clock: " + hex8(cpu.clock));
    DebugMessage("PC: " + hex8(cpu.pc));
    DebugMessage("next PC: " + hex8(cpu.nextpc));
    //DebugMessage("ins: " + hex8(cpu.ins));
    //DebugMessage("main opcode: " + hex8(cpu.ins>>>26));
    //DebugMessage("sf... opcode: " + hex8((cpu.ins>>>21)&0x1F));
    //DebugMessage("op38. opcode: " + hex8((cpu.ins>>>0)&0x3CF));

    for (var i = 0; i < 32; i += 4) {
        DebugMessage("   r" + (i + 0) + ": " +
            hex8(cpu.r[i + 0]) + "   r" + (i + 1) + ": " +
            hex8(cpu.r[i + 1]) + "   r" + (i + 2) + ": " +
            hex8(cpu.r[i + 2]) + "   r" + (i + 3) + ": " +
            hex8(cpu.r[i + 3]));
    }
    /*
    if (cpu.jumpdelayed) {
        DebugMessage("delayed jump");
    }
    */
    if (cpu.delayedins) {
        DebugMessage("delayed instruction");
    }

    if (cpu.SR_SM) {
        DebugMessage("Supervisor mode");
    }
    else {
        DebugMessage("User mode");
    }
    if (cpu.SR_TEE) {
        DebugMessage("tick timer exception enabled");
    }
    if (cpu.SR_IEE) {
        DebugMessage("interrupt exception enabled");
    }
    if (cpu.SR_DME) {
        DebugMessage("data mmu enabled");
    }
    if (cpu.SR_IME) {
        DebugMessage("instruction mmu enabled");
    }
    if (cpu.SR_LEE) {
        DebugMessage("little endian enabled");
    }
    if (cpu.SR_CID) {
        DebugMessage("context id enabled");
    }
    if (cpu.SR_F) {
        DebugMessage("flag set");
    }
    if (cpu.SR_CY) {
        DebugMessage("carry set");
    }
    if (cpu.SR_OV) {
        DebugMessage("overflow set");
    }
}

function LoadBinaryResource(url, OnLoadFunction) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.responseType = "arraybuffer";
    req.onreadystatechange = function() {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (req.status != 0)) {
            DebugMessage("Error: Could not load file " + url);
            return;
        };
        var arrayBuffer = req.response;
        if (arrayBuffer) {
            OnLoadFunction(arrayBuffer);
        }
    }
    /*
	req.onload = function(e)
	{
		var arrayBuffer = req.response;
		if (arrayBuffer)
		{	
			OnLoadFunction(arrayBuffer);
		}
	} 
    */
    req.send(null);
}

