import * as THREE from 'three';
import { WorldScene } from '@/scenes/WorldScene';
import { InputManager } from '@/systems/InputManager';
import { ThirdPersonCamera } from '@/systems/ThirdPersonCamera';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private worldScene: WorldScene;
  private thirdPersonCamera: ThirdPersonCamera;

  constructor() {
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 500);

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    // Initialize third person camera system
    this.thirdPersonCamera = new ThirdPersonCamera(this.camera);

    // Initialize world scene
    this.worldScene = new WorldScene();
  }

  public async initialize(): Promise<void> {
    await this.worldScene.initialize();
    this.scene.add(this.worldScene.getSceneGroup());
  }

  public update(deltaTime: number, inputManager: InputManager): void {
    this.worldScene.update(deltaTime, inputManager);
    
    // Update third person camera with player position
    const player = this.worldScene.getPlayer();
    const playerPosition = player.getPosition();
    const terrain = this.worldScene.getTerrain(); // Get terrain reference
    this.thirdPersonCamera.update(deltaTime, inputManager, playerPosition, terrain);
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    this.worldScene.dispose();
    this.thirdPersonCamera.dispose();
  }

  public getWorldScene(): WorldScene {
    return this.worldScene;
  }

  public getThirdPersonCamera(): ThirdPersonCamera {
    return this.thirdPersonCamera;
  }
}
