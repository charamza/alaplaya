import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export abstract class Enemy {
  protected model: THREE.Group | null = null;
  protected mixer: THREE.AnimationMixer | null = null;
  protected position: THREE.Vector3;
  protected health: number;
  protected maxHealth: number;
  protected loader: GLTFLoader;
  protected animations: { [key: string]: THREE.AnimationAction } = {};
  protected currentAnimation: string = 'idle';
  protected isAlive: boolean = true;
  protected selectionRing: THREE.Mesh | null = null;
  protected isSelected: boolean = false;

  constructor(maxHealth: number = 100) {
    this.position = new THREE.Vector3();
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.loader = new GLTFLoader();
    this.createSelectionRing();
  }

  private createSelectionRing(): void {
    const ringGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      transparent: true, 
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.selectionRing.rotation.x = -Math.PI / 2; // Rotate to lay flat on ground
    this.selectionRing.visible = false;
  }

  public abstract initialize(): Promise<void>;

  protected setupAnimations(animations: THREE.AnimationClip[]): void {
    if (!this.mixer) return;

    console.log(`${this.constructor.name} available animations:`, animations.map(anim => anim.name));

    animations.forEach(clip => {
      const action = this.mixer!.clipAction(clip);
      const lowerName = clip.name.toLowerCase();
      
      if (lowerName.includes('idle') || lowerName.includes('hop')) {
        this.animations.idle = action;
        this.animations.hop = action;
      } else if (lowerName.includes('death') || lowerName.includes('die')) {
        this.animations.death = action;
      }
    });

    // Start with idle/hop animation
    if (this.animations.idle) {
      this.animations.idle.play();
      this.currentAnimation = 'idle';
    }
  }

  protected playAnimation(animationName: string, loop: boolean = true): void {
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

    // If it's death animation, mark as not alive when it finishes
    if (animationName === 'death' && !loop) {
      newAction.clampWhenFinished = true;
    }
  }

  public update(deltaTime: number): void {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // Update selection ring position
    if (this.selectionRing && this.model) {
      this.selectionRing.position.copy(this.position);
      this.selectionRing.position.y = 0.01; // Slightly above ground
    }
  }

  public takeDamage(damage: number): void {
    if (!this.isAlive) return;

    this.health -= damage;
    console.log(`${this.constructor.name} took ${damage} damage. Health: ${this.health}/${this.maxHealth}`);

    if (this.health <= 0) {
      this.die();
    }
  }

  protected die(): void {
    if (!this.isAlive) return;
    
    this.isAlive = false;
    this.health = 0;
    this.playAnimation('death', false);
    console.log(`${this.constructor.name} died`);
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected;
    if (this.selectionRing) {
      this.selectionRing.visible = selected;
    }
  }

  public getSelected(): boolean {
    return this.isSelected;
  }

  public getModel(): THREE.Group | null {
    return this.model;
  }

  public getSelectionRing(): THREE.Mesh | null {
    return this.selectionRing;
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

  public isAliveCheck(): boolean {
    return this.isAlive;
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public getBoundingBox(): THREE.Box3 {
    if (!this.model) {
      return new THREE.Box3();
    }
    return new THREE.Box3().setFromObject(this.model);
  }

  public dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    if (this.selectionRing) {
      this.selectionRing.geometry.dispose();
      (this.selectionRing.material as THREE.Material).dispose();
    }
  }
}
