import TerminalInput from './dev/terminal-input.js';
import Framebuffer from './dev/framebuffer.js';
import Ethernet from './dev/ethernet.js';
import LoopSoundBuffer from './dev/sound.js';
import Filesystem from './dev/filesystem.js';
import type { EmulatorParameters, MessageHandler, Terminal as TerminalInterface } from '../../types/index.js';
export declare class EmulatorError extends Error {
    readonly code: string;
    readonly context?: any;
    constructor(message: string, code: string, context?: any);
}
export declare class SystemInitializationError extends EmulatorError {
    constructor(message: string, context?: any);
}
export declare class DeviceError extends EmulatorError {
    readonly deviceName: string;
    constructor(message: string, deviceName: string, context?: any);
}
declare class jor1kGUI {
    params: EmulatorParameters;
    message: MessageHandler;
    worker: Worker;
    clipboard?: HTMLInputElement;
    stats?: HTMLElement;
    framebuffer?: Framebuffer;
    terms: TerminalInterface[];
    activeTTY: string;
    terminput: TerminalInput;
    fs: Filesystem;
    sound: LoopSoundBuffer;
    ethernet?: Ethernet;
    lastMouseDownTarget?: any;
    stop: boolean;
    userpaused: boolean;
    executepending: boolean;
    constructor(parameters: EmulatorParameters);
    private SendClipboard;
    private IgnoreKeys;
    OnWorkerReady(): void;
    Execute(): void;
    ShowIPS(ips: number): void;
    Reset(): void;
    OnInit(): void;
    Pause(pause: boolean): void;
    SendChars(chars: number[]): void;
    GetTerm(tty: string): TerminalInterface | undefined;
    FocusTerm(tty: string): void;
}
export default jor1kGUI;
//# sourceMappingURL=system.d.ts.map