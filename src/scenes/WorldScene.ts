import * as THREE from 'three';
import { InputManager } from '@/systems/InputManager';
import { Player } from '@/entities/Player';
import { Terrain } from '@/entities/Terrain';
import { Sky } from '@/entities/Sky';
import { CollisionManager } from '@/systems/CollisionManager';
import { ThirdPersonCamera } from '@/systems/ThirdPersonCamera';
import { EnemyManager } from '@/systems/EnemyManager';
import { Enemy } from '@/entities/Enemy';

export class WorldScene {
  private sceneGroup: THREE.Group;
  private player: Player;
  private terrain: Terrain;
  private sky: Sky;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private debugCube: THREE.Mesh;
  private collisionManager: CollisionManager;
  private enemyManager: EnemyManager;

  constructor() {
    this.sceneGroup = new THREE.Group();
    this.player = new Player();
    this.terrain = new Terrain();
    this.sky = new Sky();
    this.collisionManager = new CollisionManager();
    this.enemyManager = new EnemyManager();

    // Setup lighting
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Stronger ambient light

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.directionalLight.position.set(50, 50, 25);
    this.directionalLight.castShadow = true;

    // Configure shadow properties for better shadow quality and reduced artifacts
    this.directionalLight.shadow.mapSize.width = 2048; // Reduced for better performance
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 1;
    this.directionalLight.shadow.camera.far = 100; // Reduced far plane
    this.directionalLight.shadow.camera.left = -30;
    this.directionalLight.shadow.camera.right = 30;
    this.directionalLight.shadow.camera.top = 30;
    this.directionalLight.shadow.camera.bottom = -30;
    // Add shadow bias to reduce shadow acne
    this.directionalLight.shadow.bias = -0.0005;
    this.directionalLight.shadow.normalBias = 0.02;

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

    // Add water bodies to scene
    const waterMeshes = this.terrain.getWaterMeshes();
    waterMeshes.forEach(waterMesh => {
      this.sceneGroup.add(waterMesh);
    });

    // Add debug cube to collision manager
    this.collisionManager.addCollisionBox({
      position: this.debugCube.position.clone(),
      size: new THREE.Vector3(2, 2, 2),
      mesh: this.debugCube
    });

    // Spawn some test slimes
    await this.spawnTestSlimes();

    // Set up player callback to check if target is alive
    this.player.setIsTargetAliveCallback((position: THREE.Vector3) => {
      return this.isEnemyAliveAtPosition(position);
    });

    console.log('Scene objects added:', {
      terrain: !!this.terrain.getMesh(),
      sky: !!this.sky.getMesh(),
      player: !!this.player.getModel(),
      debugCube: !!this.debugCube,
      enemies: this.enemyManager.getEnemies().length
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

  private async spawnTestSlimes(): Promise<void> {
    // Spawn a few test slimes around the player
    const slimePositions = [
      new THREE.Vector3(5, 0, 5),
      new THREE.Vector3(-5, 0, 5),
      new THREE.Vector3(0, 0, 8),
      new THREE.Vector3(3, 0, -3)
    ];

    for (const position of slimePositions) {
      const slime = await this.enemyManager.spawnSlime(position);
      
      // Add slime model to scene
      const slimeModel = slime.getModel();
      if (slimeModel) {
        this.sceneGroup.add(slimeModel);
      }
      
      // Add selection ring to scene
      const selectionRing = slime.getSelectionRing();
      if (selectionRing) {
        this.sceneGroup.add(selectionRing);
      }
    }
  }

  public update(deltaTime: number, inputManager: InputManager, camera?: ThirdPersonCamera): void {
    // Update player
    this.player.update(deltaTime, inputManager, camera, this.terrain, this.collisionManager);
    
    // Update enemies
    this.enemyManager.update(deltaTime);
    
    // Handle combat - deal damage once per attack
    if (this.player.shouldDealDamage()) {
      const playerPos = this.player.getPosition();
      const attackRange = 2.5;
      
      this.enemyManager.getAliveEnemies().forEach(enemy => {
        const enemyPos = enemy.getPosition();
        const distance = playerPos.distanceTo(enemyPos);
        
        if (distance <= attackRange) {
          // Player is attacking and enemy is in range - deal damage once
          enemy.takeDamage(this.player.getAttackDamage());
          this.player.markDamageDealt();
          console.log(`Player dealt ${this.player.getAttackDamage()} damage to enemy`);
        }
      });
    }
    
    // Check if player's attack target is dead and cancel attack if so
    const attackTarget = this.player.getAttackTarget();
    if (attackTarget) {
      const targetEnemy = this.findEnemyAtPosition(attackTarget);
      if (targetEnemy && !targetEnemy.isAliveCheck()) {
        console.log('Target enemy is dead, canceling attack');
        this.player.cancelAttack();
      }
    }
  }

  private findEnemyAtPosition(position: THREE.Vector3): any {
    const threshold = 1.0; // Distance threshold to consider enemy at position
    return this.enemyManager.getEnemies().find(enemy => {
      const enemyPos = enemy.getPosition();
      return enemyPos.distanceTo(position) <= threshold;
    });
  }

  private isEnemyAliveAtPosition(position: THREE.Vector3): boolean {
    const enemy = this.findEnemyAtPosition(position);
    return enemy ? enemy.isAliveCheck() : false;
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

  public getEnemyManager(): EnemyManager {
    return this.enemyManager;
  }

  public handleMouseClick(event: MouseEvent, camera: THREE.Camera, scene: THREE.Scene): void {
    // Handle enemy selection and attack
    const clickedEnemy = this.enemyManager.handleClick(event, camera, scene);
    
    if (clickedEnemy) {
      // Second click on selected enemy - start attack if possible
      const enemyPosition = clickedEnemy.getPosition();
      
      // Only start attack if player can attack (not on cooldown and not already attacking)
      if (this.player.canAttack()) {
        if (this.player.isInAttackRange(enemyPosition)) {
          // In range, attack immediately
          this.player.startAttack(enemyPosition);
        } else {
          // Not in range, move towards enemy
          this.player.startAttack(enemyPosition); // This will make player move towards target
        }
      } else {
        console.log('Player cannot attack yet (cooldown or already attacking)');
      }
    }
  }

  public dispose(): void {
    this.player.dispose();
    this.terrain.dispose();
    this.sky.dispose();

    // Clear collision manager
    this.collisionManager.clear();

    // Dispose enemy manager
    this.enemyManager.dispose();

    // Dispose lights
    this.sceneGroup.remove(this.ambientLight);
    this.sceneGroup.remove(this.directionalLight);

    // Dispose debug cube
    this.sceneGroup.remove(this.debugCube);
    this.debugCube.geometry.dispose();
    (this.debugCube.material as THREE.Material).dispose();

    // Dispose water meshes (they are disposed in terrain.dispose(), just remove from scene)
    const waterMeshes = this.terrain.getWaterMeshes();
    waterMeshes.forEach(waterMesh => {
      this.sceneGroup.remove(waterMesh);
    });
  }
}
