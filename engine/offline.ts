// Caches the game so it starts again without a signal. `url` is the root
// worker's address relative to the page. Callers pass it only in real builds:
// in development a worker would serve stale files.
export async function registerWorker(
  url: string,
  container: ServiceWorkerContainer | undefined = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
): Promise<void> {
  if (!container) return;
  try {
    await container.register(url);
  } catch (err) {
    console.warn('offline play unavailable:', err);
  }
}
