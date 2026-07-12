export interface InputHandle {
  isDown(code: string): boolean;
  destroy(): void;
}

export function createInput(target: EventTarget): InputHandle {
  const held = new Set<string>();

  function onDown(e: Event) {
    held.add((e as KeyboardEvent).code);
  }
  function onUp(e: Event) {
    held.delete((e as KeyboardEvent).code);
  }

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);

  return {
    isDown(code) { return held.has(code); },
    destroy() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      held.clear();
    },
  };
}
