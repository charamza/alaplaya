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
  
  // Smooth terrain following
  private targetGroundHeight = 0;
  private terrainFollowSpeed = 8; // How fast to adjust to terrain height
  
  // Animation properties
  private animations: { [key: string]: THREE.AnimationAction } = {};
  private currentAnimation: string = 'idle';
  private animationNames = {
    idle: 'CharacterArmature|Idle',
    run: 'CharacterArmature|Run',
    runBack: 'CharacterArmature|Run_Back', 
    runLeft: 'CharacterArmature|Run_Left',
    runRight: 'CharacterArmature|Run_Right',
    attack: 'CharacterArmature|Sword_Slash'
  };

  // Attack system - robust state machine for MMORPG
  private attackState: 'idle' | 'moving_to_target' | 'attacking' | 'cooldown' = 'idle';
  private attackTarget: THREE.Vector3 | null = null;
  private attackRange: number = 2.5;
  private attackDamage: number = 25;
  private attackCooldownDuration: number = 0.2; // Seconds between attacks
  private attackAnimationDuration: number = 1.0; // Duration of attack animation
  private attackStateStartTime: number = 0;
  private damageDealtThisAttack: boolean = false;
  private shouldDealDamageThisFrame: boolean = false;
  private isTargetAliveCallback: ((position: THREE.Vector3) => boolean) | null = null;

  constructor() {
    this.position = new THREE.Vector3(0, 5, 0); // Start slightly above ground so gravity pulls player down
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
        // // If exact match not found, try to map by name similarity
        // const lowerName = clip.name.toLowerCase();
        // if (lowerName.includes('idle')) {
        //   this.animations.idle = action;
        //   console.log(`Mapped animation: idle -> ${clip.name}`);
        // } else if (lowerName.includes('run') || lowerName.includes('walk')) {
        //   if (lowerName.includes('back')) {
        //     this.animations.runBack = action;
        //     console.log(`Mapped animation: runBack -> ${clip.name}`);
        //   } else if (lowerName.includes('left')) {
        //     this.animations.runLeft = action;
        //     console.log(`Mapped animation: runLeft -> ${clip.name}`);
        //   } else if (lowerName.includes('right')) {
        //     this.animations.runRight = action;
        //     console.log(`Mapped animation: runRight -> ${clip.name}`);
        //   } else {
        //     this.animations.run = action;
        //     console.log(`Mapped animation: run -> ${clip.name}`);
        //   }
        // } else if (lowerName.includes('attack') || lowerName.includes('punch') || lowerName.includes('hit')) {
        //   this.animations.attack = action;
        //   console.log(`Mapped animation: attack -> ${clip.name}`);
        // }
      }
    });

    // Start with idle animation
    if (this.animations.idle) {
      this.animations.idle.play();
      this.currentAnimation = 'idle';
    }
  }

  private playAnimation(animationName: string, loop: boolean = true): void {
    if (!this.animations[animationName]) {
      return;
    }

    // For attack animation, always restart it (don't check if it's already playing)
    const shouldRestart = animationName === 'attack' && !loop;
    
    if (!shouldRestart && this.currentAnimation === animationName) {
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

    // Set animation duration for attack
    if (animationName === 'attack' && !loop) {
      newAction.clampWhenFinished = true;
      newAction.setDuration(this.attackAnimationDuration);
    }

    console.log(`Playing animation: ${animationName} (loop: ${loop})`);
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

    // Reset damage flag at start of each frame
    this.shouldDealDamageThisFrame = false;

    // Update attack state machine
    this.updateAttackStateMachine(deltaTime);

    // Get movement input
    const movement = inputManager.getMovementInput();
    const hasMovementInput = movement.forward !== 0 || movement.right !== 0;

    // Cancel attack if player gives manual movement input
    if (hasMovementInput && this.attackState !== 'idle') {
      this.cancelAttack();
    }

    // Handle movement based on attack state
    const canMove = this.attackState === 'idle' || this.attackState === 'moving_to_target';
    
    if (canMove) {
      this.handleMovement(deltaTime, inputManager, camera, hasMovementInput);
    }

    // Apply physics
    this.applyPhysics(deltaTime, terrain, collisionManager);

    // Update model position and animations
    this.model.position.copy(this.position);
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
  }

  private updateAttackStateMachine(deltaTime: number): void {
    const currentTime = Date.now() / 1000;
    const stateTime = currentTime - this.attackStateStartTime;

    switch (this.attackState) {
      case 'idle':
        // Nothing to do in idle state
        break;

      case 'moving_to_target':
        if (!this.attackTarget) {
          this.setAttackState('idle');
          break;
        }

        const distance = this.position.distanceTo(this.attackTarget);
        if (distance <= this.attackRange) {
          // In range, start attacking
          this.setAttackState('attacking');
          this.playAnimation('attack', false);
          this.faceTarget();
        } else {
          // Keep moving towards target
          this.moveTowardsTarget(deltaTime);
          this.playAnimation('run');
        }
        break;

      case 'attacking':
        // Deal damage at 50% of animation (once per attack)
        if (!this.damageDealtThisAttack && stateTime >= this.attackAnimationDuration * 0.5) {
          this.damageDealtThisAttack = true;
          this.shouldDealDamageThisFrame = true; // Signal damage should be dealt this frame
          console.log('Damage should be dealt this frame');
        }

        // Check if attack animation is finished
        if (stateTime >= this.attackAnimationDuration) {
          this.setAttackState('cooldown');
        }
        break;

      case 'cooldown':
        // Wait for cooldown to finish
        if (stateTime >= this.attackCooldownDuration) {
          // Check if we should continue attacking or go idle
          if (this.shouldContinueAttacking()) {
            this.setAttackState('moving_to_target');
          } else {
            this.setAttackState('idle');
            this.attackTarget = null;
          }
        }
        break;
    }
  }

  private setAttackState(newState: 'idle' | 'moving_to_target' | 'attacking' | 'cooldown'): void {
    if (this.attackState === newState) return;

    console.log(`Attack state: ${this.attackState} -> ${newState}`);
    this.attackState = newState;
    this.attackStateStartTime = Date.now() / 1000;

    // Reset damage flags when starting new attack
    if (newState === 'attacking') {
      this.damageDealtThisAttack = false;
      this.shouldDealDamageThisFrame = false;
    }
  }

  private moveTowardsTarget(deltaTime: number): void {
    if (!this.attackTarget) return;

    const direction = this.attackTarget.clone().sub(this.position).normalize();
    const speed = this.speed * deltaTime;
    
    this.position.x += direction.x * speed;
    this.position.z += direction.z * speed;
    
    this.faceTarget();
  }

  private faceTarget(): void {
    if (!this.attackTarget || !this.model) return;
    
    const direction = this.attackTarget.clone().sub(this.position).normalize();
    const targetRotation = Math.atan2(direction.x, direction.z);
    this.model.rotation.y = this.lerpAngle(this.model.rotation.y, targetRotation, 0.1);
  }

  private shouldContinueAttacking(): boolean {
    if (!this.attackTarget) {
      return false;
    }

    // Check if target is still alive
    if (this.isTargetAliveCallback && !this.isTargetAliveCallback(this.attackTarget)) {
      console.log('Target is dead, stopping attack');
      return false;
    }

    // Check if player is still close enough to continue attacking
    const distance = this.position.distanceTo(this.attackTarget);
    const maxContinueDistance = this.attackRange * 2; // Allow some leeway
    
    if (distance > maxContinueDistance) {
      console.log(`Player too far from target (${distance.toFixed(2)} > ${maxContinueDistance}), stopping attack`);
      return false;
    }

    console.log('Continuing attack after cooldown');
    return true;
  }

  private handleMovement(deltaTime: number, inputManager: InputManager, camera?: ThirdPersonCamera, hasMovementInput?: boolean): void {
    const movement = inputManager.getMovementInput();

    // Handle jumping
    if (movement.up > 0 && this.isOnGround) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
    }

    // Calculate horizontal movement
    const horizontalDirection = new THREE.Vector3(0, 0, 0);
    
    if (camera && hasMovementInput) {
      const forward = camera.getForwardDirection();
      const right = camera.getRightDirection();
      
      horizontalDirection.addScaledVector(forward, movement.forward);
      horizontalDirection.addScaledVector(right, movement.right);
      horizontalDirection.normalize();
    }

    // Apply horizontal movement
    if (horizontalDirection.length() > 0) {
      let currentSpeed = this.speed;
      
      // Reduce speed for backward movement
      if (movement.forward < 0 && Math.abs(movement.forward) > Math.abs(movement.right)) {
        currentSpeed = this.speed * 0.5;
      }
      
      const horizontalVelocity = horizontalDirection.multiplyScalar(currentSpeed * deltaTime);
      this.position.x += horizontalVelocity.x;
      this.position.z += horizontalVelocity.z;
    }

    // Handle animations for manual movement
    if (this.attackState === 'idle' && hasMovementInput) {
      this.handleMovementAnimations(movement, camera);
    } else if (this.attackState === 'idle') {
      this.playAnimation('idle');
    }
  }

  private handleMovementAnimations(movement: any, camera?: ThirdPersonCamera): void {
    let targetAnimation = 'run';

    // Determine animation based on movement direction
    if (Math.abs(movement.forward) > Math.abs(movement.right)) {
      targetAnimation = movement.forward > 0 ? 'runBack' : 'run';
    } else {
      targetAnimation = movement.right > 0 ? 'runLeft' : 'runRight';
    }

    // Rotate player based on movement
    if (this.model && camera) {
      const forward = camera.getForwardDirection();
      const right = camera.getRightDirection();
      let targetRotation = 0;

      if (targetAnimation === 'runBack') {
        targetRotation = Math.atan2(forward.x, forward.z);
      } else if (targetAnimation === 'run') {
        targetRotation = Math.atan2(forward.x, forward.z);
      } else if (targetAnimation === 'runLeft') {
        targetRotation = Math.atan2(right.x, right.z);
      } else if (targetAnimation === 'runRight') {
        targetRotation = Math.atan2(-right.x, -right.z);
      }

      this.model.rotation.y = this.lerpAngle(this.model.rotation.y, targetRotation, 0.1);
    }

    this.playAnimation(targetAnimation);
  }

  private applyPhysics(deltaTime: number, terrain?: Terrain, collisionManager?: CollisionManager): void {
    // Apply gravity
    this.velocity.y += this.gravity * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    // Calculate ground height
    let groundHeight = 0;

    if (terrain) {
      const terrainHeight = terrain.getHeightAt(this.position.x, this.position.z);
      groundHeight = terrainHeight;
    }

    if (collisionManager) {
      const collisionHeight = collisionManager.getHeightAt(this.position.x, this.position.z, 0.5, this.position.y);
      groundHeight = Math.max(groundHeight, collisionHeight);
    }

    // Update target ground height
    this.targetGroundHeight = groundHeight;

    // Check if player is falling or jumping
    const isFalling = this.velocity.y < 0;
    const isJumping = this.velocity.y > 0;

    if (this.position.y <= groundHeight && isFalling) {
      // Hit the ground - stop falling
      this.position.y = groundHeight;
      this.velocity.y = 0;
      this.isOnGround = true;
    } else if (this.isOnGround && !isJumping) {
      // On ground and not jumping - smoothly follow terrain
      const heightDiff = this.targetGroundHeight - this.position.y;
      
      // Only adjust if the height difference is reasonable (not a cliff)
      if (Math.abs(heightDiff) < 3.0) {
        // Smooth interpolation to target height
        const adjustmentSpeed = this.terrainFollowSpeed * deltaTime;
        this.position.y += heightDiff * adjustmentSpeed;
        
        // Clamp to avoid overshooting
        if (Math.abs(heightDiff) < 0.1) {
          this.position.y = this.targetGroundHeight;
        }
      } else {
        // Large height difference - treat as falling off edge
        this.isOnGround = false;
      }
    } else if (isJumping) {
      // Player is jumping - don't adjust to terrain
      this.isOnGround = false;
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
    // Can only start attack if idle
    if (this.attackState !== 'idle') {
      return false;
    }

    // Set target and start moving towards it
    this.attackTarget = targetPosition.clone();
    this.setAttackState('moving_to_target');
    return true;
  }

  public isInAttackRange(targetPosition: THREE.Vector3): boolean {
    return this.position.distanceTo(targetPosition) <= this.attackRange;
  }

  public isCurrentlyAttacking(): boolean {
    return this.attackState === 'attacking';
  }

  public getAttackDamage(): number {
    return this.attackDamage;
  }

  public getAttackTarget(): THREE.Vector3 | null {
    return this.attackTarget ? this.attackTarget.clone() : null;
  }

  public cancelAttack(): void {
    console.log('Canceling attack due to manual movement input');
    this.setAttackState('idle');
    this.attackTarget = null;
    this.damageDealtThisAttack = false;
    this.shouldDealDamageThisFrame = false;
  }

  public shouldDealDamage(): boolean {
    return this.shouldDealDamageThisFrame;
  }

  public markDamageDealt(): void {
    // Damage is automatically marked in state machine
  }

  public canAttack(): boolean {
    const canAttack = this.attackState === 'idle';
    console.log(`canAttack check: attackState=${this.attackState}, canAttack=${canAttack}`);
    return canAttack;
  }

  public getAttackState(): string {
    return this.attackState;
  }

  public setIsTargetAliveCallback(callback: (position: THREE.Vector3) => boolean): void {
    this.isTargetAliveCallback = callback;
  }

  public dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    // GLTF models will be disposed by Three.js automatically
  }
}
