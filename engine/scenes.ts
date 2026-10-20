export interface Scene {
  enter?(): void;
  exit?(): void;
  suspend?(): void; // the page went into the background
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
}

export class SceneStack {
  private stack: Scene[] = [];

  push(s: Scene): void {
    this.stack.push(s);
    s.enter?.();
  }

  pop(): void {
    this.stack.pop()?.exit?.();
  }

  replace(s: Scene): void {
    this.pop();
    this.push(s);
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }
}
