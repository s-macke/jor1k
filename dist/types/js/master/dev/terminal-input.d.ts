export default TerminalInput;
declare function TerminalInput(SendChars: any): void;
declare class TerminalInput {
    constructor(SendChars: any);
    CTRLpressed: boolean;
    ALTpressed: boolean;
    SendChars: any;
    enabled: boolean;
    OnKeyPress(e: any): boolean;
    OnKeyUp(e: any): boolean;
    OnKeyDown(e: any): boolean;
}
//# sourceMappingURL=terminal-input.d.ts.map