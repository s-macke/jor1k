// -------------------------------------------------
// ------------------ Utils ------------------------
// -------------------------------------------------

function SendToMaster(command, data) {
    postMessage(
    {
        "command" : command,
        "data" : data
    }
    );
}

function DebugMessage(message) {
    SendToMaster("Debug", message);
}

function abort() {
    DebugMessage("Abort execution.");
    sys.PrintState();
    SendToMaster("Stop");
    throw new Error('Kill worker');
}

// big endian to little endian and vice versa
function Swap32(val) {
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >>> 8) & 0xFF00) | ((val >>> 24) & 0xFF);
}

function Swap16(val) {
    return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

// cast an integer to a signed integer
function int32(val) {
    return (val >> 0);
}

// cast an integer to a unsigned integer
function uint32(val) {
    return (val >>> 0);
}

function hex8(x) {
    var val = uint32(x);
    return ("0x" + ("00000000" + val.toString(16)).substr(-8).toUpperCase());
}

function CopyBinary(to, from, size, buffersrc, bufferdest) {
    var i = 0;
    for (i = 0; i < size; i++) {
        bufferdest[to + i] = buffersrc[from + i];
    }
}

function DownloadAllAsync(urls, OnSuccess, OnError) {
    var result = [];
    urls.forEach(function(url, i) {
        result[i] = fs.readFileSync(url);
    });
    OnSuccess(result);
}
