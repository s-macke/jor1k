// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

import Terminal from './dev/terminal.js';
import TerminalInput from './dev/terminal-input.js';
import Framebuffer from './dev/framebuffer.js';
import Ethernet from './dev/ethernet.js';
import LoopSoundBuffer from './dev/sound.js';
import Filesystem from './dev/filesystem.js';

import message from './messagehandler.js';
import type { 
  EmulatorParameters, 
  SystemConfig, 
  FilesystemConfig,
  MessageHandler,
  Terminal as TerminalInterface
} from '../../types/index.js';

const TERMINAL = 0xDEADBEEF;

"use strict";

// Error classes for type-safe error handling
export class EmulatorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: unknown
  ) {
    super(message);
    this.name = 'EmulatorError';
  }
}

export class SystemInitializationError extends EmulatorError {
  constructor(message: string, context?: unknown) {
    super(message, 'SYSTEM_INIT_ERROR', context);
  }
}

export class DeviceError extends EmulatorError {
  constructor(
    message: string,
    public readonly deviceName: string,
    context?: unknown
  ) {
    const errorContext = typeof context === 'object' && context !== null 
      ? { ...context as Record<string, unknown>, deviceName }
      : { deviceName };
    super(message, 'DEVICE_ERROR', errorContext);
  }
}

// Main GUI system class
class jor1kGUI {
  public params: EmulatorParameters;
  public message: MessageHandler;
  public worker: Worker;
  public clipboard?: HTMLInputElement;
  public stats?: HTMLElement;
  public framebuffer?: Framebuffer;
  public terms: TerminalInterface[];
  public activeTTY: string;
  public terminput: TerminalInput;
  public fs: Filesystem;
  public sound: LoopSoundBuffer;
  public ethernet?: Ethernet;
  public lastMouseDownTarget?: EventTarget | null | number;
  public stop: boolean;
  public userpaused: boolean;
  public executepending: boolean;

  constructor(parameters: EmulatorParameters) {
    this.params = parameters;
    this.message = message;

    // Initialize state flags
    this.stop = false;
    this.userpaused = false;
    this.executepending = false;

    // --- parameters parsing ---
    this.params.system = this.params.system || {} as SystemConfig;

    this.params.path = this.params.path || "";

    console.log("kernel URL: " + this.params.system.kernelURL);
    this.params.system.memorysize = this.params.system.memorysize || 32;
    this.params.system.arch = this.params.system.arch || "or1k";
    this.params.system.cpu = this.params.system.cpu || "asm";
    this.params.system.ncores = this.params.system.ncores || 1;
    this.params.syncURL = this.params.syncURL || "";

    if (typeof this.params.fs !== "undefined") {
      this.params.fs.path = this.params.fs.path || this.params.path;
      this.params.fs.basefsURL = this.params.fs.basefsURL || "basefs.json";
      this.params.fs.basefsURL = this.params.fs.path + this.params.fs.basefsURL;
      if (this.params.fs.extendedfsURL) {
        this.params.fs.extendedfsURL = this.params.fs.path + this.params.fs.extendedfsURL;
      }
      this.params.fs.earlyload = this.params.fs.earlyload || [];
      this.params.fs.lazyloadimages = this.params.fs.lazyloadimages || [];
    }

    // add path to every URL
    this.params.system.kernelURL = this.params.path + this.params.system.kernelURL;
    if (this.params.system.dtbURL) {
      this.params.system.dtbURL = this.params.path + this.params.system.dtbURL;
    }

    this.params.userid = this.params.userid || "";

    // ----------------------

    try {
      this.worker = (this.params.worker instanceof Worker) ?
        this.params.worker : new Worker("jor1k-worker-min.js");
    } catch (error) {
      throw new SystemInitializationError(
        "Failed to create worker thread",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    message.SetWorker(this.worker);
    message.Send("WorkingPath", this.params.path);

    // ----

    if (this.params.clipboardid) {
      const clipboardElement = document.getElementById(this.params.clipboardid);
      if (clipboardElement instanceof HTMLInputElement) {
        this.clipboard = clipboardElement;
      } else {
        throw new DeviceError(
          "Clipboard element is not an input element",
          "clipboard",
          { clipboardid: this.params.clipboardid }
        );
      }
    }

    if (this.params.statsid) {
      const statsElement = document.getElementById(this.params.statsid);
      if (statsElement) {
        this.stats = statsElement;
      } else {
        console.warn(`Stats element with id '${this.params.statsid}' not found`);
      }
    }

    if (this.params.fbid) {
      try {
        this.framebuffer = new Framebuffer(this.params.fbid, this.params.fps ?? 30);
        message.Register("GetFB", (data: unknown) => {
          if (this.framebuffer && data instanceof Int32Array) {
            this.framebuffer.Update(data);
          }
        });
      } catch (error) {
        throw new DeviceError(
          "Failed to initialize framebuffer",
          "framebuffer",
          { fbid: this.params.fbid, error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    this.terms = [];
    if (this.params.term) {
      this.terms = [this.params.term];
    } else if (this.params.terms) {
      this.terms = this.params.terms.slice(0, 2); // support up to 2 terminals
    }
    for (let i = 0; i < this.terms.length; i++) {
      try {
        this.terms[i].Init(this, "tty" + i);
      } catch (error) {
        throw new DeviceError(
          `Failed to initialize terminal ${i}`,
          "terminal",
          { index: i, error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    this.activeTTY = "tty0";
    this.terminput = new TerminalInput(this.SendChars.bind(this));

    try {
      this.fs = new Filesystem(this.params.syncURL, this.params.userid);
    } catch (error) {
      throw new DeviceError(
        "Failed to initialize filesystem",
        "filesystem",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    try {
      this.sound = new LoopSoundBuffer(22050);
      message.Register("sound", (data: unknown) => {
        if (data instanceof Int8Array) {
          this.sound.AddBuffer(data);
        }
      });
      message.Register("sound.rate", (data: unknown) => {
        if (typeof data === 'number') {
          this.sound.SetRate(data);
        }
      });
    } catch (error) {
      throw new DeviceError(
        "Failed to initialize sound device",
        "sound",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    if (this.clipboard) {
      this.clipboard.onpaste = (event: ClipboardEvent) => {
        if (this.clipboard) {
          this.clipboard.value = "";
          setTimeout(this.SendClipboard.bind(this), 4);
        }
      };
    }

    const recordTarget = (event: MouseEvent) => {
      let termHitByEvent = false;
      for (let i = 0; i < this.terms.length; i++) {
        if (this.terms[i].WasHitByEvent(event)) {
          termHitByEvent = true;
          this.activeTTY = "tty" + i;
          break;
        }
      }
      if (termHitByEvent) {
        this.lastMouseDownTarget = TERMINAL;
      } else {
        this.lastMouseDownTarget = event.target;
      }
    };

    if (document.addEventListener) {
      document.addEventListener('mousedown', recordTarget, false);
    } else {
      // @ts-ignore - IE 10 support (untested)
      window.onmousedown = recordTarget;
    }

    document.onkeypress = (event: KeyboardEvent): boolean => {
      if (this.IgnoreKeys()) return true;
      if ((this.lastMouseDownTarget === TERMINAL) || (this.clipboard && this.lastMouseDownTarget === this.clipboard)) {
        return this.terminput.OnKeyPress(event);
      }
      message.Send("keypress", { keyCode: event.keyCode, charCode: event.charCode });
      return false;
    };

    document.onkeydown = (event: KeyboardEvent): boolean => {
      if (this.IgnoreKeys()) return true;
      if ((this.lastMouseDownTarget === TERMINAL) || (this.clipboard && this.lastMouseDownTarget === this.clipboard)) {
        return this.terminput.OnKeyDown(event);
      }
      message.Send("keydown", { keyCode: event.keyCode, charCode: event.charCode });
      return false;
    };

    document.onkeyup = (event: KeyboardEvent): boolean => {
      if (this.IgnoreKeys()) return true;
      if ((this.lastMouseDownTarget === TERMINAL) || (this.clipboard && this.lastMouseDownTarget === this.clipboard)) {
        return this.terminput.OnKeyUp(event);
      }
      message.Send("keyup", { keyCode: event.keyCode, charCode: event.charCode });
      return false;
    };

    if (this.params.relayURL) {
      try {
        this.ethernet = new Ethernet(this.params.relayURL);
        this.ethernet.onmessage = (e: MessageEvent) => {
          message.Send("ethmac", e.data);
        };
        message.Register("ethmac", this.ethernet.SendFrame.bind(this.ethernet));
      } catch (error) {
        throw new DeviceError(
          "Failed to initialize ethernet device",
          "ethernet",
          { relayURL: this.params.relayURL, error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    message.Register("GetIPS", this.ShowIPS.bind(this));
    message.Register("execute", this.Execute.bind(this));
    message.Register("WorkerReady", this.OnWorkerReady.bind(this));
  }

  private SendClipboard(): void {
    if (!this.clipboard) return;
    
    const chars: number[] = [];
    const v = this.clipboard.value;

    for (let i = 0; i < v.length; i++) {
      chars.push(v.charCodeAt(i));
    }

    this.SendChars(chars);
    this.clipboard.value = "";
  }

  private IgnoreKeys(): boolean {
    return (
      (this.lastMouseDownTarget !== TERMINAL) &&
      (this.framebuffer ? this.lastMouseDownTarget !== this.framebuffer.fbcanvas : true) &&
      (this.clipboard ? this.lastMouseDownTarget !== this.clipboard : true)
    );
  }

  public OnWorkerReady(): void {
    this.Reset();
    window.setInterval(() => {
      message.Send("GetIPS", 0);
    }, 1000);
  }

  // this command is sent back and forth to be responsive
  public Execute(): void {
    if (this.stop) return;
    if (this.userpaused) {
      this.executepending = true;
    } else {
      this.executepending = false;
      message.Send("execute", 0);
    }
  }

  public ShowIPS(ips: number): void {
    if (!this.stats) return;
    if (this.userpaused) {
      this.stats.innerHTML = "Paused";
    } else {
      this.stats.innerHTML = ips < 1000000 ?
        Math.floor(ips / 1000) + " KIPS"
        :
        (Math.floor(ips / 100000) / 10.) + " MIPS";
    }
  }

  public Reset(): void {
    this.stop = false; // VM Stopped/Aborted
    this.userpaused = false;
    this.executepending = false; // if we rec an execute message while paused

    message.Register("InitDone", this.OnInit.bind(this));
    message.Send("Init", this.params.system);
  }

  public OnInit(): void {
    message.Send("Reset", null);
    message.Send("LoadAndStart", this.params.system.kernelURL);

    if (this.params.fs) {
      message.Send("LoadFilesystem", this.params.fs);
    }

    if (this.terms.length > 0) {
      this.terms.forEach((term: TerminalInterface) => {
        term.PauseBlink(false);
      });
      this.lastMouseDownTarget = TERMINAL;
      // activeTTY remains the same, so the user can start typing into the terminal last used
      // or the default terminal initialized in the constructor
    }
  }

  public Pause(pause: boolean): void {
    pause = !!pause; // coerce to boolean
    if (pause == this.userpaused) return;
    this.userpaused = pause;
    if (!this.userpaused && this.executepending) {
      this.executepending = false;
      message.Send("execute", 0);
    }
    this.terms.forEach((term: TerminalInterface) => {
      term.PauseBlink(pause);
    });
  }

  // sends the input characters for the terminal
  public SendChars(chars: number[]): void {
    if (this.framebuffer && this.lastMouseDownTarget == this.framebuffer.fbcanvas) return;
    message.Send(this.activeTTY as any, chars);
    message.Send("htif.term0.Transfer", chars);
  }

  // Returns the terminal attached to tty
  // tty is the tty string, for example, tty0
  public GetTerm(tty: string): TerminalInterface | undefined {
    const index = parseInt(tty.slice(3));
    return this.terms[index];
  }

  public FocusTerm(tty: string): void {
    this.activeTTY = tty;
    this.lastMouseDownTarget = TERMINAL;
  }
}

export default jor1kGUI;
