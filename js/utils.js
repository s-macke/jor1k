// -------------------------------------------------
// ------------------ Utils ------------------------
// -------------------------------------------------

function DebugMessage(message) {
    console.log(message);
}

function abort() {
    DebugMessage("Abort execution.")
    sys.PrintState();
    throw new Error('Abort javascript');
}

// big endian to little endian and vice versa
function Swap32(val) {
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >>> 8) & 0xFF00) | ((val >>> 24) & 0xFF);
}

// cast an integer so a signed integer
function int32(val) {
    return (val >> 0);
}

// cast an integer so a unsigned integer
function uint32(val) {
    return (val >>> 0);
}

function hex8(x) {
    return ("0x" + ("00000000" + x.toString(16)).substr(-8).toUpperCase());
}

function CopyBinary(to, from, size, buffersrc, bufferdest) {
    for (var i = 0; i < size; i++) bufferdest[to + i] = buffersrc[from + i];
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

