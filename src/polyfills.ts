import { Buffer } from 'buffer';
import process from 'process';

// Polyfill global Buffer and process for Web3 libraries, WalletConnect, and AppKit in browser environment
if (typeof window !== 'undefined') {
  (window as any).Buffer = (window as any).Buffer || Buffer;
  (window as any).process = (window as any).process || process;
  (window as any).global = (window as any).global || window;
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
  (globalThis as any).process = (globalThis as any).process || process;
  (globalThis as any).global = (globalThis as any).global || globalThis;
}

export { Buffer };
