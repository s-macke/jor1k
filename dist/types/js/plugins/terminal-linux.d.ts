export default LinuxTerm;
declare function LinuxTerm(termElementId: any): void;
declare class LinuxTerm {
    constructor(termElementId: any);
    termElementId: any;
    Init(jor1kGUI: any, tty: any): void;
    term: Terminal;
    terminalcanvas: HTMLElement;
    WasHitByEvent(evt: any): boolean;
    PauseBlink(pause: any): void;
    SetCharReceiveListener(callback: any): void;
    RemoveCharReceiveListener(): void;
}
import Terminal from "../master/dev/terminal.js";
//# sourceMappingURL=terminal-linux.d.ts.map