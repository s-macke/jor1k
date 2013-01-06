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
    this.buf8 = new Uint8ClampedArray(this.ram.mem, addr, this.imageData.data.length);
    this.Update();
};

FBDev.prototype.Update = function () {
    if (!this.buf8) {
        return;
    }
    // remove alpha channel. The buffer can then be used directly.
    var i, n = this.width * this.height * 4;
    for (i = 3; i < n; i += 4) {
        this.buf8[i] = 0xFF;
    }

    this.imageData.data.set(this.buf8);
    this.c.putImageData(this.imageData, 0, 0); // at coords 0,0
    window.setTimeout(this.Update.bind(this), 500); // update every half a second
};
