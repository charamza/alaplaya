import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InputManager } from '@/systems/InputManager';
import { ThirdPersonCamera } from '@/systems/ThirdPersonCamera';
import { Terrain } from '@/entities/Terrain';
import { CollisionManager } from '@/systems/CollisionManager';

export class Player {
  private model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private position: THREE.Vector3;
  private velocity: THREE.Vector3;
  private speed = 10; // Movement speed
  private loader: GLTFLoader;
  
  // Jumping properties
  private isOnGround = true;
  private jumpForce = 15;
  private gravity = -50;
  
  // Animation properties
  private animations: { [key: string]: THREE.AnimationAction } = {};
  private currentAnimation: string = 'idle';
  private animationNames = {
    idle: 'idle',
    run: 'run',
    runBack: 'run_back', 
    runLeft: 'run_left',
    runRight: 'run_right',
    attack: 'attack'
  };

  // Attack properties
  private isAttacking: boolean = false;
  private attackTarget: THREE.Vector3 | null = null;
  private attackRange: number = 2.5;
  private attackDamage: number = 25;
  private attackSpeed: number = 1.5; // Seconds between attacks
  private lastAttackTime: number = 0;
  private attackAnimationDuration: number = 1.0; // Duration of attack animation in seconds
  private hasDealtDamageThisAttack: boolean = false;
  private attackStartTime: number = 0;

  constructor() {
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.loader = new GLTFLoader();
  }

  public async initialize(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync('/models/player.glb');
      this.model = gltf.scene;

      // Set initial position
      this.model.position.copy(this.position);

      // Scale if needed
      this.model.scale.setScalar(1);

      // Enable shadows
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Setup animations
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model);
        this.setupAnimations(gltf.animations);
      }

      console.log('Player model loaded successfully with', gltf.animations?.length || 0, 'animations');
    } catch (error) {
      console.error('Failed to load player model:', error);
      // Create a fallback cube if model fails to load
      this.createFallbackModel();
    }
  }

  private createFallbackModel(): void {
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);

    // Position mesh so its bottom is at y=0 (mesh center is at y=1)
    mesh.position.y = 1; // Half of box height

    this.model = new THREE.Group();
    this.model.add(mesh);
    this.model.position.y = 0; // Group starts at ground level
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // No animations for fallback model
  }

  private setupAnimations(animations: THREE.AnimationClip[]): void {
    if (!this.mixer) return;

    console.log('Available animations:', animations.map(anim => anim.name));

    // Create animation actions for each available animation
    animations.forEach(clip => {
      const action = this.mixer!.clipAction(clip);
      
      // Find matching animation name
      const animKey = Object.keys(this.animationNames).find(key => 
        this.animationNames[key as keyof typeof this.animationNames] === clip.name
      );
      
      if (animKey) {
        this.animations[animKey] = action;
        console.log(`Mapped animation: ${animKey} -> ${clip.name}`);
      } else {
        // If exact match not found, try to map by name similarity
        const lowerName = clip.name.toLowerCase();
        if (lowerName.includes('idle')) {
          this.animations.idle = action;
          console.log(`Mapped animation: idle -> ${clip.name}`);
        } else if (lowerName.includes('run') || lowerName.includes('walk')) {
          if (lowerName.includes('back')) {
            this.animations.runBack = action;
            console.log(`Mapped animation: runBack -> ${clip.name}`);
          } else if (lowerName.includes('left')) {
            this.animations.runLeft = action;
            console.log(`Mapped animation: runLeft -> ${clip.name}`);
          } else if (lowerName.includes('right')) {
            this.animations.runRight = action;
            console.log(`Mapped animation: runRight -> ${clip.name}`);
          } else {
            this.animations.run = action;
            console.log(`Mapped animation: run -> ${clip.name}`);
          }
        } else if (lowerName.includes('attack') || lowerName.includes('punch') || lowerName.includes('hit')) {
          this.animations.attack = action;
          console.log(`Mapped animation: attack -> ${clip.name}`);
        }
      }
    });

    // Start with idle animation
    if (this.animations.idle) {
      this.animations.idle.play();
      this.currentAnimation = 'idle';
    }
  }

  private playAnimation(animationName: string, loop: boolean = true): void {
    if (!this.animations[animationName] || this.currentAnimation === animationName) {
      return;
    }

    const newAction = this.animations[animationName];
    const oldAction = this.animations[this.currentAnimation];

    if (oldAction) {
      oldAction.fadeOut(0.2);
    }

    newAction.reset().fadeIn(0.2);
    newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    newAction.play();
    this.currentAnimation = animationName;

    // Handle attack animation completion
    if (animationName === 'attack' && !loop) {
      newAction.clampWhenFinished = true;
      
      // Set animation duration to match our attack speed
      newAction.setDuration(this.attackAnimationDuration);
      
      // Record when attack started for manual timing
      this.attackStartTime = Date.now() / 1000;
    }
  }

  private lerpAngle(from: number, to: number, t: number): number {
    // Calculate the shortest angular distance
    let diff = to - from;
    
    // Wrap difference to [-PI, PI] range
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    
    // Lerp the shortest way
    return from + diff * t;
  }

  public update(deltaTime: number, inputManager: InputManager, camera?: ThirdPersonCamera, terrain?: Terrain, collisionManager?: CollisionManager): void {
    if (!this.model) return;

    // Check if attack animation is finished
    if (this.isAttacking && this.attackStartTime > 0) {
      const currentTime = Date.now() / 1000;
      if (currentTime - this.attackStartTime >= this.attackAnimationDuration) {
        this.isAttacking = false;
        this.attackStartTime = 0;
        console.log('Attack finished, player can move again');
      }
    }

    // If attacking, don't process movement input
    if (this.isAttacking) {
      // Apply gravity during attack
      this.velocity.y += this.gravity * deltaTime;
      
      // Apply vertical movement
      this.position.y += this.velocity.y * deltaTime;

      // Handle ground collision during attack
      let groundHeight = 0;
      if (terrain) {
        groundHeight = terrain.getHeightAt(this.position.x, this.position.z);
      }
      if (collisionManager) {
        const collisionHeight = collisionManager.getHeightAt(this.position.x, this.position.z, 0.5, this.position.y);
        groundHeight = Math.max(groundHeight, collisionHeight);
      }
      if (this.position.y <= groundHeight) {
        this.position.y = groundHeight;
        this.velocity.y = 0;
        this.isOnGround = true;
      }

      // Update model position and animations
      this.model.position.copy(this.position);
      if (this.mixer) {
        this.mixer.update(deltaTime);
      }
      return;
    }

    // Handle movement towards attack target
    if (this.attackTarget && !this.isAttacking) {
      const distance = this.position.distanceTo(this.attackTarget);
      if (distance > this.attackRange) {
        // Move towards target
        const direction = this.attackTarget.clone().sub(this.position).normalize();
        const speed = this.speed * deltaTime;
        
        // Check collision before moving
        const newX = this.position.x + direction.x * speed;
        const newZ = this.position.z + direction.z * speed;
        
        let canMoveX = true;
        let canMoveZ = true;
        
        if (collisionManager) {
          canMoveX = !collisionManager.checkHorizontalCollision(newX, this.position.z, this.position.y, 0.5, 2);
          canMoveZ = !collisionManager.checkHorizontalCollision(this.position.x, newZ, this.position.y, 0.5, 2);
        }
        
        if (canMoveX) this.position.x = newX;
        if (canMoveZ) this.position.z = newZ;
        
        // Face the target
        const targetRotation = Math.atan2(direction.x, direction.z);
        this.model.rotation.y = this.lerpAngle(this.model.rotation.y, targetRotation, 0.1);
        
        // Play run animation
        this.playAnimation('run');
      } else {
        // In range, start attack
        this.startAttack(this.attackTarget);
      }
    }

    // Get movement input (only if not moving to attack target)
    const movement = inputManager.getMovementInput();
    const hasMovementInput = movement.forward !== 0 || movement.right !== 0;

    // If player gives movement input while moving to target or attacking, cancel attack target
    if ((this.attackTarget || this.isAttacking) && hasMovementInput) {
      console.log('Canceling attack due to manual movement input');
      this.attackTarget = null;
      this.isAttacking = false;
      this.hasDealtDamageThisAttack = false;
      this.attackStartTime = 0;
    }

    // Handle jumping
    if (movement.up > 0 && this.isOnGround) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
    }

    // Apply gravity
    this.velocity.y += this.gravity * deltaTime;

    // Calculate horizontal movement direction based on camera orientation
    const horizontalDirection = new THREE.Vector3(0, 0, 0);
    
    if (camera && hasMovementInput) {
      const forward = camera.getForwardDirection();
      const right = camera.getRightDirection();
      
      // Combine forward/backward and left/right movement
      horizontalDirection.addScaledVector(forward, movement.forward);
      horizontalDirection.addScaledVector(right, movement.right);
      horizontalDirection.normalize();
    }

    // Determine animation based on movement input (only if not moving to attack target and not attacking)
    let targetAnimation = 'idle';
    
    if (hasMovementInput) {
      // Determine primary movement direction for animation
      if (Math.abs(movement.forward) > Math.abs(movement.right)) {
        // Forward/backward movement is stronger
        if (movement.forward > 0) {
          targetAnimation = 'runBack';
          // Rotate player to face camera forward direction
          if (this.model && camera) {
            const forward = camera.getForwardDirection();
            const targetRotation = Math.atan2(forward.x, forward.z);
            this.model.rotation.y = this.lerpAngle(this.model.rotation.y, targetRotation, 0.1);
          }
        } else {
          targetAnimation = 'run';
          // Rotate player to face opposite of camera forward direction
          if (this.model && camera) {
            const forward = camera.getForwardDirection();
            const targetRotation = Math.atan2(forward.x, forward.z);
            this.model.rotation.y = this.lerpAngle(this.model.rotation.y, targetRotation, 0.1);
          }
        }
      } else {
        // Left/right movement is stronger
        if (movement.right > 0) {
          targetAnimation = 'runLeft';
          // Rotate player to face camera right direction
          if (this.model && camera) {
            const right = camera.getRightDirection();
            const targetRotation = Math.atan2(right.x, right.z);
            this.model.rotation.y = this.lerpAngle(this.model.rotation.y, targetRotation, 0.1);
          }
        } else {
          targetAnimation = 'runRight';
          // Rotate player to face camera left direction
          if (this.model && camera) {
            const right = camera.getRightDirection();
            const targetRotation = Math.atan2(-right.x, -right.z);
            this.model.rotation.y = this.lerpAngle(this.model.rotation.y, targetRotation, 0.1);
          }
        }
      }
    }

    // Play appropriate animation
    this.playAnimation(targetAnimation);

    // Apply horizontal movement with collision checking
    if (horizontalDirection.length() > 0) {
      // Calculate speed based on movement direction
      let currentSpeed = this.speed;
      
      // Reduce speed for backward movement
      if (movement.forward < 0 && Math.abs(movement.forward) > Math.abs(movement.right)) {
        currentSpeed = this.speed * 0.5; // Half speed for backward movement
      }
      
      const horizontalVelocity = horizontalDirection.multiplyScalar(currentSpeed * deltaTime);
      const newX = this.position.x + horizontalVelocity.x;
      const newZ = this.position.z + horizontalVelocity.z;
      
      // Check for horizontal collision before moving
      let canMoveX = true;
      let canMoveZ = true;
      
      if (collisionManager) {
        // Check X movement separately
        if (horizontalVelocity.x !== 0) {
          canMoveX = !collisionManager.checkHorizontalCollision(newX, this.position.z, this.position.y, 0.5, 2);
        }
        
        // Check Z movement separately  
        if (horizontalVelocity.z !== 0) {
          canMoveZ = !collisionManager.checkHorizontalCollision(this.position.x, newZ, this.position.y, 0.5, 2);
        }
        
        // Check diagonal movement if both X and Z are allowed individually
        if (canMoveX && canMoveZ && horizontalVelocity.x !== 0 && horizontalVelocity.z !== 0) {
          const canMoveBoth = !collisionManager.checkHorizontalCollision(newX, newZ, this.position.y, 0.5, 2);
          if (!canMoveBoth) {
            // If diagonal is blocked, try individual axes
            canMoveX = !collisionManager.checkHorizontalCollision(newX, this.position.z, this.position.y, 0.5, 2);
            canMoveZ = !collisionManager.checkHorizontalCollision(this.position.x, newZ, this.position.y, 0.5, 2);
          }
        }
      }
      
      // Apply movement only if no collision
      if (canMoveX) {
        this.position.x = newX;
      }
      if (canMoveZ) {
        this.position.z = newZ;
      }
    }

    // Apply vertical movement
    this.position.y += this.velocity.y * deltaTime;

    // Terrain and collision detection
    let groundHeight = 0;
    
    if (terrain) {
      groundHeight = terrain.getHeightAt(this.position.x, this.position.z);
    }
    
    // Check collision manager for higher surfaces (like boxes to jump on)
    if (collisionManager) {
      const collisionHeight = collisionManager.getHeightAt(this.position.x, this.position.z, 0.5, this.position.y);
      groundHeight = Math.max(groundHeight, collisionHeight);
    }
    
    // Apply ground collision
    if (this.position.y <= groundHeight) {
      this.position.y = groundHeight;
      this.velocity.y = 0;
      this.isOnGround = true;
    }

    // Update model position (model mesh is already positioned correctly within group)
    this.model.position.copy(this.position);

    // Update animations
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }

  public getModel(): THREE.Group | null {
    return this.model;
  }

  public getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  public setPosition(position: THREE.Vector3): void {
    this.position.copy(position);
    if (this.model) {
      this.model.position.copy(position);
    }
  }

  public startAttack(targetPosition: THREE.Vector3): boolean {
    const currentTime = Date.now() / 1000; // Convert to seconds
    
    if (this.isAttacking) {
      return false; // Already attacking
    }

    // Check attack cooldown
    if (currentTime - this.lastAttackTime < this.attackSpeed) {
      return false; // Still on cooldown
    }

    const distance = this.position.distanceTo(targetPosition);
    if (distance > this.attackRange) {
      // Move towards target first
      this.attackTarget = targetPosition.clone();
      return false; // Not in range yet
    }

    // In range, start attack
    this.isAttacking = true;
    this.attackTarget = targetPosition.clone();
    this.lastAttackTime = currentTime;
    this.hasDealtDamageThisAttack = false; // Reset damage flag
    this.attackStartTime = 0; // Will be set in playAnimation
    
    // Face the target
    if (this.model) {
      const direction = targetPosition.clone().sub(this.position).normalize();
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.model.rotation.y = targetRotation;
    }

    // Play attack animation
    this.playAnimation('attack', false);
    return true; // Attack started
  }

  public isInAttackRange(targetPosition: THREE.Vector3): boolean {
    return this.position.distanceTo(targetPosition) <= this.attackRange;
  }

  public isCurrentlyAttacking(): boolean {
    return this.isAttacking;
  }

  public getAttackDamage(): number {
    return this.attackDamage;
  }

  public getAttackTarget(): THREE.Vector3 | null {
    return this.attackTarget ? this.attackTarget.clone() : null;
  }

  public cancelAttack(): void {
    this.isAttacking = false;
    this.attackTarget = null;
    this.hasDealtDamageThisAttack = false;
    this.attackStartTime = 0;
  }

  public shouldDealDamage(): boolean {
    return this.isAttacking && !this.hasDealtDamageThisAttack;
  }

  public markDamageDealt(): void {
    this.hasDealtDamageThisAttack = true;
  }

  public canAttack(): boolean {
    const currentTime = Date.now() / 1000;
    const timeSinceLastAttack = currentTime - this.lastAttackTime;
    const canAttack = !this.isAttacking && (timeSinceLastAttack >= this.attackSpeed);
    
    console.log(`canAttack check: isAttacking=${this.isAttacking}, timeSinceLastAttack=${timeSinceLastAttack.toFixed(2)}s, attackSpeed=${this.attackSpeed}s, canAttack=${canAttack}`);
    
    return canAttack;
  }

  public dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    // GLTF models will be disposed by Three.js automatically
  }
}
