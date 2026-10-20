// A canvas context that accepts every call and property write, recording each
// call's arguments by method name.
export function stubCtx() {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return proxy;
  };
  const proxy: object = new Proxy({}, { get: (_t, prop) => (prop === 'calls' ? calls : record(String(prop))), set: () => true });
  return proxy as CanvasRenderingContext2D & { calls: Record<string, unknown[][]> };
}
