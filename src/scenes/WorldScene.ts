import * as THREE from 'three';
import { InputManager } from '@/systems/InputManager';
import { Player } from '@/entities/Player';
import { Terrain } from '@/entities/Terrain';
import { Sky } from '@/entities/Sky';
import { CollisionManager } from '@/systems/CollisionManager';
import { ThirdPersonCamera } from '@/systems/ThirdPersonCamera';

export class WorldScene {
  private sceneGroup: THREE.Group;
  private player: Player;
  private terrain: Terrain;
  private sky: Sky;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private debugCube: THREE.Mesh;
  private collisionManager: CollisionManager;

  constructor() {
    this.sceneGroup = new THREE.Group();
    this.player = new Player();
    this.terrain = new Terrain();
    this.sky = new Sky();
    this.collisionManager = new CollisionManager();

    // Setup lighting
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Stronger ambient light

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.directionalLight.position.set(50, 50, 25);
    this.directionalLight.castShadow = true;

    // Configure shadow properties for better shadow quality
    this.directionalLight.shadow.mapSize.width = 4096;
    this.directionalLight.shadow.mapSize.height = 4096;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 200;
    this.directionalLight.shadow.camera.left = -50;
    this.directionalLight.shadow.camera.right = 50;
    this.directionalLight.shadow.camera.top = 50;
    this.directionalLight.shadow.camera.bottom = -50;

    // Create debug cube
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    this.debugCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    this.debugCube.position.set(0, 1, 3); // Position on terrain in front of camera
    this.debugCube.castShadow = true;
    this.debugCube.receiveShadow = true;
  }

  public async initialize(): Promise<void> {
    // Initialize all entities
    await this.player.initialize();
    this.terrain.initialize();
    this.sky.initialize();

    // Add lights to scene
    this.sceneGroup.add(this.ambientLight);
    this.sceneGroup.add(this.directionalLight);

    // Add to scene
    this.sceneGroup.add(this.terrain.getMesh());
    this.sceneGroup.add(this.sky.getMesh());
    this.sceneGroup.add(this.player.getModel() as THREE.Object3D);
    this.sceneGroup.add(this.debugCube); // Add debug cube

    // Add debug cube to collision manager
    this.collisionManager.addCollisionBox({
      position: this.debugCube.position.clone(),
      size: new THREE.Vector3(2, 2, 2),
      mesh: this.debugCube
    });

    console.log('Scene objects added:', {
      terrain: !!this.terrain.getMesh(),
      sky: !!this.sky.getMesh(),
      player: !!this.player.getModel(),
      debugCube: !!this.debugCube
    });

    // Debug terrain mesh properties
    const terrainMesh = this.terrain.getMesh();
    console.log('Terrain mesh debug:', {
      position: terrainMesh.position,
      rotation: terrainMesh.rotation,
      scale: terrainMesh.scale,
      visible: terrainMesh.visible,
      material: (terrainMesh.material as THREE.Material).type,
      geometry: terrainMesh.geometry.type,
      vertices: terrainMesh.geometry.attributes.position.count
    });
  }

  public update(deltaTime: number, inputManager: InputManager, camera?: ThirdPersonCamera): void {
    this.player.update(deltaTime, inputManager, camera, this.terrain, this.collisionManager);
  }

  public getSceneGroup(): THREE.Group {
    return this.sceneGroup;
  }

  public getPlayer(): Player {
    return this.player;
  }

  public getTerrain(): Terrain {
    return this.terrain;
  }

  public getCollisionManager(): CollisionManager {
    return this.collisionManager;
  }

  public dispose(): void {
    this.player.dispose();
    this.terrain.dispose();
    this.sky.dispose();

    // Clear collision manager
    this.collisionManager.clear();

    // Dispose lights
    this.sceneGroup.remove(this.ambientLight);
    this.sceneGroup.remove(this.directionalLight);

    // Dispose debug cube
    this.sceneGroup.remove(this.debugCube);
    this.debugCube.geometry.dispose();
    (this.debugCube.material as THREE.Material).dispose();
  }
}
