import * as THREE from 'three';
import { Enemy } from '@/entities/Enemy';
import { Slime } from '@/entities/Slime';

export class EnemyManager {
  private enemies: Enemy[] = [];
  private selectedEnemy: Enemy | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  public addEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
  }

  public removeEnemy(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index > -1) {
      // Deselect if this enemy was selected
      if (this.selectedEnemy === enemy) {
        this.selectedEnemy = null;
      }
      
      this.enemies.splice(index, 1);
      enemy.dispose();
    }
  }

  public update(deltaTime: number): void {
    // Update all enemies
    this.enemies.forEach(enemy => {
      enemy.update(deltaTime);
    });

    // Remove dead enemies after their death animation
    this.enemies = this.enemies.filter(enemy => {
      if (!enemy.isAliveCheck() && enemy.getModel()) {
        // Check if death animation is finished (simple time-based check)
        // In a real game, you'd want to listen for animation completion events
        return true; // Keep dead enemies for now, remove them manually or after some time
      }
      return true;
    });
  }

  public handleClick(event: MouseEvent, camera: THREE.Camera, scene: THREE.Scene): Enemy | null {
    // Calculate mouse position in normalized device coordinates
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, camera);

    // Get all enemy models for raycasting
    const enemyModels: THREE.Object3D[] = [];
    const enemyMap = new Map<THREE.Object3D, Enemy>();

    this.enemies.forEach(enemy => {
      const model = enemy.getModel();
      if (model && enemy.isAliveCheck()) {
        enemyModels.push(model);
        enemyMap.set(model, enemy);
      }
    });

    // Perform raycast
    const intersects = this.raycaster.intersectObjects(enemyModels, true);

    if (intersects.length > 0) {
      // Find the enemy that was clicked
      let clickedEnemy: Enemy | null = null;
      
      for (const intersect of intersects) {
        let object = intersect.object;
        
        // Traverse up the hierarchy to find the enemy model
        while (object.parent && !enemyMap.has(object)) {
          object = object.parent;
        }
        
        if (enemyMap.has(object)) {
          clickedEnemy = enemyMap.get(object)!;
          break;
        }
      }

      if (clickedEnemy) {
        // If clicking on already selected enemy, return it for attack
        if (this.selectedEnemy === clickedEnemy) {
          return clickedEnemy;
        }
        
        // Otherwise, select the new enemy
        this.selectEnemy(clickedEnemy);
        return null; // Return null to indicate selection, not attack
      }
    }

    // If clicked on empty space, deselect current enemy
    this.selectEnemy(null);
    return null;
  }

  public selectEnemy(enemy: Enemy | null): void {
    // Deselect previous enemy
    if (this.selectedEnemy) {
      this.selectedEnemy.setSelected(false);
    }

    // Select new enemy
    this.selectedEnemy = enemy;
    if (this.selectedEnemy) {
      this.selectedEnemy.setSelected(true);
    }
  }

  public getSelectedEnemy(): Enemy | null {
    return this.selectedEnemy;
  }

  public getEnemies(): Enemy[] {
    return [...this.enemies]; // Return copy to prevent external modification
  }

  public getAliveEnemies(): Enemy[] {
    return this.enemies.filter(enemy => enemy.isAliveCheck());
  }

  public createSlime(position: THREE.Vector3): Slime {
    const slime = new Slime();
    slime.setPosition(position);
    return slime;
  }

  public async spawnSlime(position: THREE.Vector3): Promise<Slime> {
    const slime = this.createSlime(position);
    await slime.initialize();
    this.addEnemy(slime);
    return slime;
  }

  public getEnemyModels(): THREE.Object3D[] {
    const models: THREE.Object3D[] = [];
    
    this.enemies.forEach(enemy => {
      const model = enemy.getModel();
      if (model) {
        models.push(model);
      }
    });
    
    return models;
  }

  public getSelectionRings(): THREE.Mesh[] {
    const rings: THREE.Mesh[] = [];
    
    this.enemies.forEach(enemy => {
      const ring = enemy.getSelectionRing();
      if (ring) {
        rings.push(ring);
      }
    });
    
    return rings;
  }

  public dispose(): void {
    this.enemies.forEach(enemy => {
      enemy.dispose();
    });
    this.enemies = [];
    this.selectedEnemy = null;
  }
}
