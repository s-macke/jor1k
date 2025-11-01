// TypeScript type definitions for jor1k emulator
// This file serves as the main entry point for type definitions

// Export all types for easy importing
export * from './system.js';
export * from './cpu.js';
export * from './devices.js';
export * from './messages.js';

// Export validation utilities
export * from '../js/lib/validation.js';

// Re-export commonly used types for convenience
export type { 
  SystemConfig, 
  FilesystemConfig, 
  EmulatorParameters, 
  Terminal,
  CPUImplementation 
} from './system.js';

export type { 
  CPUCore, 
  FastCPUCore, 
  CPUState, 
  InstructionSet 
} from './cpu.js';

export type { 
  Device, 
  MemoryMappedDevice, 
  InterruptController, 
  RAM,
  UARTDevice,
  FramebufferDevice,
  EthernetDevice,
  HTIFDevice 
} from './devices.js';

export type { 
  MessageType, 
  MessageHandler, 
  WorkerMessage, 
  TypedMessageHandler,
  MessageDataMap 
} from './messages.js';