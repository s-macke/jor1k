# TypeScript Type Definitions

This directory contains TypeScript type definitions for the jor1k emulator.

## Files

- `index.ts` - Main entry point for all type definitions
- `system.ts` - System configuration and emulator parameter types
- `cpu.ts` - CPU architecture interfaces and types
- `devices.ts` - Device interfaces and types  
- `messages.ts` - Message system types for worker communication

## Usage

Import types in TypeScript files:

```typescript
import { SystemConfig, EmulatorParameters } from '../types/index';
```

## Notes

- Fast CPU implementations (fastcpu.js) remain as JavaScript due to asm.js constraints
- Type definitions will be expanded as modules are migrated to TypeScript
- All types are designed to maintain backward compatibility with existing JavaScript code