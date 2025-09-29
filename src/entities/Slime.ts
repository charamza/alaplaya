import * as THREE from 'three';
import { Enemy } from './Enemy';

export class Slime extends Enemy {
  private hopTimer: number = 0;
  private hopInterval: number = 2; // Hop every 2 seconds
  private hopHeight: number = 1;
  private originalY: number = 0;
  private isHopping: boolean = false;

  constructor() {
    super(100); // Slime has 100 health (4 hits to kill with 25 damage)
  }

  public async initialize(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync('/models/slime.glb');
      this.model = gltf.scene;

      // Set initial position
      this.model.position.copy(this.position);
      this.originalY = this.position.y;

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

      console.log('Slime model loaded successfully with', gltf.animations?.length || 0, 'animations');
    } catch (error) {
      console.error('Failed to load slime model:', error);
      // Create a fallback model if slime fails to load
      this.createFallbackModel();
    }
  }

  private createFallbackModel(): void {
    // Create a green bouncy cube as fallback
    const geometry = new THREE.SphereGeometry(0.8, 16, 12);
    geometry.scale(1, 0.7, 1); // Make it more slime-like (squashed sphere)
    
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.5; // Position so bottom touches ground

    this.model = new THREE.Group();
    this.model.add(mesh);
    this.model.position.copy(this.position);
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // No animations for fallback model, but we can simulate hopping
  }

  protected setupAnimations(animations: THREE.AnimationClip[]): void {
    if (!this.mixer) return;

    console.log('Slime available animations:', animations.map(anim => anim.name));

    animations.forEach(clip => {
      const action = this.mixer!.clipAction(clip);
      const lowerName = clip.name.toLowerCase();
      
      if (lowerName.includes('idle') || lowerName.includes('hop') || lowerName.includes('bounce')) {
        this.animations.hop = action;
        this.animations.idle = action;
      } else if (lowerName.includes('death') || lowerName.includes('die')) {
        this.animations.death = action;
      }
    });

    // Start with hop animation (slimes are always bouncing)
    if (this.animations.hop) {
      this.animations.hop.play();
      this.currentAnimation = 'hop';
    }
  }

  public update(deltaTime: number, terrain?: any): void {
    super.update(deltaTime, terrain);

    if (!this.isAlive) return;

    // Handle hopping behavior
    this.hopTimer += deltaTime;
    
    if (!this.isHopping && this.hopTimer >= this.hopInterval) {
      this.startHop();
    }

    // Update hop animation (simple bounce effect for fallback model)
    if (this.isHopping && !this.animations.hop) {
      this.updateFallbackHop(deltaTime);
    }
  }

  private startHop(): void {
    this.isHopping = true;
    this.hopTimer = 0;
    
    // Play hop animation if available
    if (this.animations.hop) {
      this.playAnimation('hop', false);
      
      // Reset hopping state after animation duration
      setTimeout(() => {
        this.isHopping = false;
      }, 1000); // Assume hop animation is about 1 second
    } else {
      // For fallback model, just do a simple bounce
      this.isHopping = false;
    }
  }

  private updateFallbackHop(deltaTime: number): void {
    // Simple sine wave bounce for fallback model
    const bounceSpeed = 4;
    const bounceHeight = 0.3;
    const bounce = Math.sin(this.hopTimer * bounceSpeed) * bounceHeight;
    
    if (this.model) {
      // Use current position Y (which includes terrain height) as base
      this.model.position.y = this.position.y + Math.max(0, bounce);
    }
    
    // Stop hopping after a short time
    if (this.hopTimer > 0.5) {
      this.isHopping = false;
      if (this.model) {
        this.model.position.y = this.position.y; // Return to terrain level
      }
    }
  }

  protected die(): void {
    super.die();
    
    // Stop hopping when dead
    this.isHopping = false;
    this.hopTimer = 0;
    
    // Play death animation if available
    if (this.animations.death) {
      this.playAnimation('death', false);
    } else {
      // For fallback model, just make it fall and fade
      if (this.model) {
        // Simple death effect - scale down and fade
        const mesh = this.model.children[0] as THREE.Mesh;
        if (mesh && mesh.material) {
          const material = mesh.material as THREE.MeshLambertMaterial;
          material.transparent = true;
          
          // Animate scale and opacity
          const startTime = Date.now();
          const animateDeath = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsed / 2, 1); // 2 second death animation
            
            const scale = 1 - progress * 0.5; // Scale down to 50%
            const opacity = 1 - progress; // Fade out
            
            this.model!.scale.setScalar(scale);
            material.opacity = opacity;
            
            if (progress < 1) {
              requestAnimationFrame(animateDeath);
            }
          };
          animateDeath();
        }
      }
    }
  }

  public setPosition(position: THREE.Vector3): void {
    super.setPosition(position);
    this.originalY = position.y;
  }

  // Get attack range for this enemy type
  public getAttackRange(): number {
    return 2.5; // Player needs to be within 2.5 units to attack slime
  }
}
