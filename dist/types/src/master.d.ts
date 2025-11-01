import LinuxTerm from '../js/plugins/terminal-linux.js';
import Jor1k from '../js/master/system.js';
export { LinuxTerm, Jor1k };
export type { EmulatorParameters, Terminal, SystemConfig, FilesystemConfig, CPUImplementation, MessageType, MessageHandler } from '../types/index.js';
declare global {
    interface Window {
        LinuxTerm: typeof LinuxTerm;
        Jor1k: typeof Jor1k;
    }
}
//# sourceMappingURL=master.d.ts.map