// -------------------------------------------------
// ---------------- Framebuffer --------------------
// -------------------------------------------------

// constructor
function Framebuffer(elemId) {
    var element = document.getElementById(elemId);
    this.c = element.getContext("2d");
    // read the width and height of the canvas
    this.width = element.width;
    this.height = element.height;
    // create a new batch of pixels with the same
    // dimensions as the image:
    this.imageData = this.c.createImageData(this.width, this.height);
}

Framebuffer.prototype.SetAddr = function(addr) {
    this.buf8 = new Uint8ClampedArray(ram.mem, addr, this.imageData.data.length);
    this.Update();
};

Framebuffer.prototype.Update = function() {
    if (!this.buf8) {
        return;
    }
    // copy the image data back onto the canvas
    for (var i = 3; i < this.width * this.height * 4; i += 4) {
        this.buf8[i] = 0xFF;
    }

    this.imageData.data.set(this.buf8);
    this.c.putImageData(this.imageData, 0, 0); // at coords 0,0
    // hack, because this.Update does not work
    window.setTimeout(function() {
        fb.Update();
    }, 500); // update every half a second
};
