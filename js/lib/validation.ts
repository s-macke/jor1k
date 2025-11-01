// -------------------------------------------------
// ------------- Type Validation -------------------
// -------------------------------------------------

"use strict";

import type { SystemConfig, FilesystemConfig, EmulatorParameters } from '../../types/index.js';

/**
 * Validation error class for type validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate SystemConfig object
 * @param config - The configuration object to validate
 * @returns True if valid
 * @throws ValidationError if invalid
 */
export function validateSystemConfig(config: unknown): config is SystemConfig {
  if (typeof config !== 'object' || config === null) {
    throw new ValidationError('SystemConfig must be an object', 'config', config);
  }

  const c = config as Record<string, unknown>;

  // Validate arch
  if (typeof c.arch !== 'string' || !['or1k', 'riscv'].includes(c.arch)) {
    throw new ValidationError(
      'SystemConfig.arch must be "or1k" or "riscv"',
      'arch',
      c.arch
    );
  }

  // Validate cpu
  if (typeof c.cpu !== 'string' || !['asm', 'safe', 'dynamic', 'wasm', 'smp'].includes(c.cpu)) {
    throw new ValidationError(
      'SystemConfig.cpu must be one of: "asm", "safe", "dynamic", "wasm", "smp"',
      'cpu',
      c.cpu
    );
  }

  // Validate memorysize
  if (typeof c.memorysize !== 'number' || c.memorysize <= 0) {
    throw new ValidationError(
      'SystemConfig.memorysize must be a positive number',
      'memorysize',
      c.memorysize
    );
  }

  // Validate ncores
  if (typeof c.ncores !== 'number' || c.ncores < 1 || !Number.isInteger(c.ncores)) {
    throw new ValidationError(
      'SystemConfig.ncores must be a positive integer',
      'ncores',
      c.ncores
    );
  }

  // Validate kernelURL
  if (typeof c.kernelURL !== 'string' || c.kernelURL.length === 0) {
    throw new ValidationError(
      'SystemConfig.kernelURL must be a non-empty string',
      'kernelURL',
      c.kernelURL
    );
  }

  // Validate optional dtbURL
  if (c.dtbURL !== undefined && typeof c.dtbURL !== 'string') {
    throw new ValidationError(
      'SystemConfig.dtbURL must be a string if provided',
      'dtbURL',
      c.dtbURL
    );
  }

  return true;
}

/**
 * Validate FilesystemConfig object
 * @param config - The configuration object to validate
 * @returns True if valid
 * @throws ValidationError if invalid
 */
export function validateFilesystemConfig(config: unknown): config is FilesystemConfig {
  if (typeof config !== 'object' || config === null) {
    throw new ValidationError('FilesystemConfig must be an object', 'config', config);
  }

  const c = config as Record<string, unknown>;

  // Validate basefsURL
  if (typeof c.basefsURL !== 'string' || c.basefsURL.length === 0) {
    throw new ValidationError(
      'FilesystemConfig.basefsURL must be a non-empty string',
      'basefsURL',
      c.basefsURL
    );
  }

  // Validate optional path
  if (c.path !== undefined && typeof c.path !== 'string') {
    throw new ValidationError(
      'FilesystemConfig.path must be a string if provided',
      'path',
      c.path
    );
  }

  // Validate optional extendedfsURL
  if (c.extendedfsURL !== undefined && typeof c.extendedfsURL !== 'string') {
    throw new ValidationError(
      'FilesystemConfig.extendedfsURL must be a string if provided',
      'extendedfsURL',
      c.extendedfsURL
    );
  }

  // Validate earlyload array
  if (!Array.isArray(c.earlyload)) {
    throw new ValidationError(
      'FilesystemConfig.earlyload must be an array',
      'earlyload',
      c.earlyload
    );
  }

  if (!c.earlyload.every((item: unknown) => typeof item === 'string')) {
    throw new ValidationError(
      'FilesystemConfig.earlyload must be an array of strings',
      'earlyload',
      c.earlyload
    );
  }

  // Validate lazyloadimages array
  if (!Array.isArray(c.lazyloadimages)) {
    throw new ValidationError(
      'FilesystemConfig.lazyloadimages must be an array',
      'lazyloadimages',
      c.lazyloadimages
    );
  }

  if (!c.lazyloadimages.every((item: unknown) => typeof item === 'string')) {
    throw new ValidationError(
      'FilesystemConfig.lazyloadimages must be an array of strings',
      'lazyloadimages',
      c.lazyloadimages
    );
  }

  return true;
}

/**
 * Validate EmulatorParameters object
 * @param params - The parameters object to validate
 * @returns True if valid
 * @throws ValidationError if invalid
 */
export function validateEmulatorParameters(params: unknown): params is EmulatorParameters {
  if (typeof params !== 'object' || params === null) {
    throw new ValidationError('EmulatorParameters must be an object', 'params', params);
  }

  const p = params as Record<string, unknown>;

  // Validate required system config
  if (!p.system) {
    throw new ValidationError(
      'EmulatorParameters.system is required',
      'system',
      p.system
    );
  }

  validateSystemConfig(p.system);

  // Validate optional filesystem config
  if (p.fs !== undefined) {
    validateFilesystemConfig(p.fs);
  }

  // Validate optional worker
  if (p.worker !== undefined && !(p.worker instanceof Worker)) {
    throw new ValidationError(
      'EmulatorParameters.worker must be a Worker instance if provided',
      'worker',
      p.worker
    );
  }

  // Validate optional fps
  if (p.fps !== undefined && (typeof p.fps !== 'number' || p.fps <= 0)) {
    throw new ValidationError(
      'EmulatorParameters.fps must be a positive number if provided',
      'fps',
      p.fps
    );
  }

  return true;
}

/**
 * Type guard to check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if a value is an ArrayBuffer
 */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

/**
 * Type guard to check if a value is a typed array
 */
export function isTypedArray(value: unknown): value is Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array {
  return (
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array
  );
}

/**
 * Safely parse JSON with error handling
 * @param json - JSON string to parse
 * @returns Parsed object or null on error
 */
export function safeJSONParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new ValidationError(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      'json',
      json
    );
  }
}

/**
 * Assert that a value is defined (not null or undefined)
 * @param value - Value to check
 * @param name - Name of the value for error message
 * @throws ValidationError if value is null or undefined
 */
export function assertDefined<T>(value: T | null | undefined, name: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(
      `${name} must be defined`,
      name,
      value
    );
  }
}

/**
 * Assert that a value is a number
 * @param value - Value to check
 * @param name - Name of the value for error message
 * @throws ValidationError if value is not a number
 */
export function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(
      `${name} must be a valid number`,
      name,
      value
    );
  }
}

/**
 * Assert that a value is a string
 * @param value - Value to check
 * @param name - Name of the value for error message
 * @throws ValidationError if value is not a string
 */
export function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${name} must be a string`,
      name,
      value
    );
  }
}
