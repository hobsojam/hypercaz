// A canvas context that accepts every call and property write, recording each
// call's arguments by method name and each write under '=name'.
export function stubCtx() {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    calls[name] ??= [];
    calls[name].push(args);
    return proxy;
  };
  const proxy: object = new Proxy({}, { get: (_t, prop) => (prop === 'calls' ? calls : record(String(prop))), set: (_t, prop, value) => {
    const name = `=${String(prop)}`;
    calls[name] ??= [];
    calls[name].push([value]);
    return true;
  } });
  return proxy as CanvasRenderingContext2D & { calls: Record<string, unknown[][]> };
}
