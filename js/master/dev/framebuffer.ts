import message from '../messagehandler.js';

"use strict";

class Framebuffer {
    fbid: string;
    fps: number;
    fbcanvas?: HTMLCanvasElement;
    fbctx?: CanvasRenderingContext2D;
    fbimageData?: ImageData;
    fbinterval?: number;

    constructor(fbid: string, fps: number) {
        this.fbid = fbid;
        this.fps = 0;

        this.Init(fbid);
        this.SetFPS(fps);
    }

    // Init Framebuffer if it exists
    Init(fbid: string): void {
        const canvas = document.getElementById(fbid);
        if (!canvas) return;

        this.fbcanvas = canvas as HTMLCanvasElement;
        const ctx = this.fbcanvas.getContext("2d");
        if (!ctx) return;

        this.fbctx = ctx;
        this.fbctx.fillStyle = "rgba(0, 0, 0, 255)";
        this.fbctx.fillRect(0, 0, this.fbcanvas.width, this.fbcanvas.height);

        this.fbimageData = this.fbctx.createImageData(this.fbcanvas.width, this.fbcanvas.height);

        this.fbcanvas.onmousedown = (event: MouseEvent) => {
            if (!this.fbcanvas) return;
            this.fbcanvas.style.border = "2px solid #FF0000";
            const rect = this.fbcanvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * 640 / rect.width;
            const y = (event.clientY - rect.top) * 400 / rect.height;
            message.Send("tsmousedown", { x: x, y: y });
        };

        this.fbcanvas.onmouseup = (event: MouseEvent) => {
            if (!this.fbcanvas) return;
            const rect = this.fbcanvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * 640 / rect.width;
            const y = (event.clientY - rect.top) * 400 / rect.height;
            message.Send("tsmouseup", { x: x, y: y });
        };

        this.fbcanvas.onmousemove = (event: MouseEvent) => {
            if (!this.fbcanvas) return;
            const rect = this.fbcanvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * 640 / rect.width;
            const y = (event.clientY - rect.top) * 400 / rect.height;
            message.Send("tsmousemove", { x: x, y: y });
        };
    }

    // receive interval of the contents of the framebuffer
    SetFPS(fps: number): void {
        this.fps = fps;
        if (!this.fbcanvas) return;
        if (this.fbinterval) {
            window.clearInterval(this.fbinterval);
        }
        if (fps != 0) {
            this.fbinterval = window.setInterval(() => {
                message.Send("GetFB", 0);
            }, 1000 / this.fps);
        }
    }

    Update(buffer: Int32Array): void {
        if (!this.fbcanvas) return;
        if (!this.fbimageData) return;
        //if(this.userpaused) return;
        let i = 0;
        const n = buffer.length;
        const data = this.fbimageData.data;

        let offset = 0x0;
        for (i = 0; i < n; i++) {
            const x = buffer[i];
            data[offset++] = (x >> 24) & 0xF8;
            data[offset++] = (x >> 19) & 0xFC;
            data[offset++] = (x >> 13) & 0xF8;
            data[offset++] = 0xFF;
            data[offset++] = (x >> 8) & 0xF8;
            data[offset++] = (x >> 3) & 0xFC;
            data[offset++] = (x << 3) & 0xF8;
            data[offset++] = 0xFF;
        }

        //data.set(buffer);
        this.fbctx!.putImageData(this.fbimageData, 0, 0); // at coords 0,0
    }
}

export default Framebuffer;
