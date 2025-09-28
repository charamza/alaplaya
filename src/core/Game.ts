import * as THREE from 'three';
import { SceneManager } from '@/scenes/SceneManager';
import { InputManager } from '@/systems/InputManager';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  private clock: THREE.Clock;
  private animationId: number | null = null;
  private isRunning = false;

  constructor(container: HTMLElement) {
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Initialize managers
    this.sceneManager = new SceneManager();
    this.inputManager = new InputManager();
    this.clock = new THREE.Clock();

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.sceneManager.resize(width, height);
    this.renderer.setSize(width, height);
  }

  public async initialize(): Promise<void> {
    await this.sceneManager.initialize();
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.animate();
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private animate(): void {
    if (!this.isRunning) return;

    this.animationId = requestAnimationFrame(this.animate.bind(this));

    const deltaTime = this.clock.getDelta();

    // Update scene (uses input data from previous frame)
    this.sceneManager.update(deltaTime, this.inputManager);

    // Update input (reset for next frame)
    this.inputManager.update();

    // Render
    this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
  }

  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.sceneManager.dispose();
    this.inputManager.dispose();
    this.renderer.dispose();
  }

  public getSceneManager(): SceneManager {
    return this.sceneManager;
  }

  public getInputManager(): InputManager {
    return this.inputManager;
  }
}
