// -------------------------------------------------
// ---------------- Framebuffer --------------------
// -------------------------------------------------

// constructor
function FBDev(elemId, ram) {
    this.ram = ram;
    var element = document.getElementById(elemId);
    this.c = element.getContext("2d");
    // read the width and height of the canvas
    this.width = element.width;
    this.height = element.height;
    // create a new batch of pixels with the same
    // dimensions as the image:
    this.imageData = this.c.createImageData(this.width, this.height);
    // address in ram where the pixeldata resides 
    this.addr = 0x0;
}

FBDev.prototype.ReadReg32 = function (addr) {
    return 0x0;
};

FBDev.prototype.WriteReg32 = function (addr, value) {
    switch (addr) {
    case 0x14:
        this.SetAddr(Swap32(value));
        break;
    default:
        return 0x0;
    }
};

FBDev.prototype.SetAddr = function (addr) {
    this.addr = addr;
    if (typeof Uint8ClampedArray !== 'undefined')  {
        this.buf8 = new Uint8ClampedArray(this.ram.mem, addr, this.imageData.data.length);
    }
    this.Update();
};

FBDev.prototype.Update = function () {
    var i=0, n = this.width * this.height * 4;
    var data = this.imageData.data;
    if (!this.buf8) { 
        // copy the framebuffer byte by byte
        var mem = this.ram.uint8mem;
   	    for (i = 0; i < n; ++i) {
            data[i] = mem[this.addr+i];
        }
    } else
    {
        // otherwise use set
        data.set(this.buf8);
    }

    // remove alpha channel.
  	for (i = 3; i < n; i += 4) {
        data[i] = 0xFF;
    }
    this.c.putImageData(this.imageData, 0, 0); // at coords 0,0
    window.setTimeout(this.Update.bind(this), 100); // update 10 times a second. Maybe use requestAnimationFrame
};
