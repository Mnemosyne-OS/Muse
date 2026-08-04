/**
 * Converged onto the shared package (doc 58) — DO NOT reimplement the transport.
 * App-specific wrappers: extend MnemoCartridgeSDK in a separate file, or call
 * sdk.invoke('<action>', payload) directly (actions: doc 52).
 */
export * from '@mnemosyne_os/cartridge-sdk';
