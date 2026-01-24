/**
 * Internal log info structure for Winston format function
 */
export interface LogInfo {
  level: string;
  message: unknown;
  timestamp?: string;
  stack?: string;
  [key: string]: unknown;
}
