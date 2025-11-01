declare class LoopSoundBuffer {
    enabled: boolean;
    nperiods: number;
    source: (AudioBufferSourceNode | null)[];
    soundbuffer: AudioBuffer[];
    period: number;
    periodsize: number;
    bufferpos: number;
    context?: AudioContext;
    samplerate?: number;
    sampleslen?: number;
    buffer?: Float32Array;
    basetime?: number;
    constructor(samplerate: number);
    SetRate(rate: number): void;
    OnEnded(): void;
    Enabled(e: boolean): void;
    PlayBuffer(period: number): void;
    AddBuffer(addbuffer: Int8Array): void;
}
export default LoopSoundBuffer;
//# sourceMappingURL=sound.d.ts.map