// A canvas context that accepts every call and property write, recording each
// call's arguments by method name.
export function stubCtx() {
  const calls: Record<string, unknown[][]> = {};
  const proxy: object = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'calls') return calls;
        return (...args: unknown[]) => {
          (calls[String(prop)] ??= []).push(args);
          return proxy;
        };
      },
      set: () => true,
    },
  );
  return proxy as CanvasRenderingContext2D & { calls: Record<string, unknown[][]> };
}
