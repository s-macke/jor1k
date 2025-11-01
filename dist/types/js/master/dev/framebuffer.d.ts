declare class Framebuffer {
    fbid: string;
    fps: number;
    fbcanvas?: HTMLCanvasElement;
    fbctx?: CanvasRenderingContext2D;
    fbimageData?: ImageData;
    fbinterval?: number;
    constructor(fbid: string, fps: number);
    Init(fbid: string): void;
    SetFPS(fps: number): void;
    Update(buffer: Int32Array): void;
}
export default Framebuffer;
//# sourceMappingURL=framebuffer.d.ts.map