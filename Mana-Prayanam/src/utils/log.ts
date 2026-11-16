/** Simple tagged logs for Metro / Expo console. */
export function log(tag: string, message: string, data?: unknown) {
  if (data !== undefined) {
    console.log(`[${tag}] ${message}`, data);
  } else {
    console.log(`[${tag}] ${message}`);
  }
}

export function logError(tag: string, message: string, error?: unknown) {
  console.error(`[${tag}] ${message}`, error ?? '');
}
