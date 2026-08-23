/**
 * Public surface of the library.
 *
 * Kept deliberately small: the protocol layer, the engine and the pattern
 * language are the parts that are useful outside this app.
 */
export * from './midi/messages';
export * from './midi/notes';
export * from './midi/constants';
export * from './midi/smf';
export * from './midi/rpn';
export * from './midi/sysex';
export * from './midi/mpe';
export * from './midi/ump';
export * from './patterns';
export type { DeviceProfile, Parameter } from './midi/devices/profile';
export { Device } from './midi/devices/profile';
