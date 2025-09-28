export class InputManager {
  private keys: { [key: string]: boolean } = {};
  private mouseButtons: { [button: number]: boolean } = {};
  private mousePosition = { x: 0, y: 0 };
  private mouseMovement = { x: 0, y: 0 };
  private wheelDelta = 0;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));

    // Mouse events
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('wheel', this.onWheel.bind(this));

    // Prevent context menu
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Lock pointer for mouse look (will be useful later)
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keys[event.code] = true;

    // Prevent default for game keys
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys[event.code] = false;
  }

  private onMouseDown(event: MouseEvent): void {
    this.mouseButtons[event.button] = true;
    event.preventDefault();
  }

  private onMouseUp(event: MouseEvent): void {
    this.mouseButtons[event.button] = false;
    event.preventDefault();
  }

  private onMouseMove(event: MouseEvent): void {
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
    this.mouseMovement.x = event.movementX;
    this.mouseMovement.y = event.movementY;
  }

  private onWheel(event: WheelEvent): void {
    this.wheelDelta = event.deltaY;
    event.preventDefault();
  }

  private onPointerLockChange(): void {
    // Handle pointer lock changes (for future mouse look)
  }

  public update(): void {
    // Reset mouse movement and wheel delta for next frame
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
    this.wheelDelta = 0;
  }

  // Input checking methods
  public isKeyPressed(key: string): boolean {
    return !!this.keys[key];
  }

  public isMouseButtonPressed(button: number): boolean {
    return !!this.mouseButtons[button];
  }

  public getMousePosition(): { x: number; y: number } {
    return { ...this.mousePosition };
  }

  public getMouseMovement(): { x: number; y: number } {
    return { ...this.mouseMovement };
  }

  public getWheelDelta(): number {
    return this.wheelDelta;
  }

  // Movement input helpers
  public getMovementInput(): { forward: number; right: number; up: number } {
    const forward = (this.isKeyPressed('KeyW') ? 1 : 0) + (this.isKeyPressed('KeyS') ? -1 : 0);
    const right = (this.isKeyPressed('KeyD') ? 1 : 0) + (this.isKeyPressed('KeyA') ? -1 : 0);
    const up = this.isKeyPressed('Space') ? 1 : 0;

    return { forward, right, up };
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
    window.removeEventListener('mousedown', this.onMouseDown.bind(this));
    window.removeEventListener('mouseup', this.onMouseUp.bind(this));
    window.removeEventListener('mousemove', this.onMouseMove.bind(this));
    window.removeEventListener('wheel', this.onWheel.bind(this));
    window.removeEventListener('contextmenu', () => {});
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
  }
}
