import * as THREE from 'three';

export interface CollisionBox {
  position: THREE.Vector3;
  size: THREE.Vector3;
  mesh?: THREE.Mesh; // Optional reference to the mesh
}

export class CollisionManager {
  private collisionBoxes: CollisionBox[] = [];

  public addCollisionBox(box: CollisionBox): void {
    this.collisionBoxes.push(box);
  }

  public removeCollisionBox(box: CollisionBox): void {
    const index = this.collisionBoxes.indexOf(box);
    if (index > -1) {
      this.collisionBoxes.splice(index, 1);
    }
  }

  // Get the highest collision point at a given x,z position (only for landing on top)
  public getHeightAt(x: number, z: number, playerRadius: number = 0.5, playerY: number = 0): number {
    let maxHeight = 0; // Default terrain height

    for (const box of this.collisionBoxes) {
      // Check if player is within the collision box bounds (with player radius)
      const boxMinX = box.position.x - box.size.x / 2 - playerRadius;
      const boxMaxX = box.position.x + box.size.x / 2 + playerRadius;
      const boxMinZ = box.position.z - box.size.z / 2 - playerRadius;
      const boxMaxZ = box.position.z + box.size.z / 2 + playerRadius;

      if (x >= boxMinX && x <= boxMaxX && z >= boxMinZ && z <= boxMaxZ) {
        // Only consider this box if player is coming from above
        const boxTopHeight = box.position.y + box.size.y / 2;
        const boxBottomHeight = box.position.y - box.size.y / 2;
        
        // Player must be falling from above the box to land on it
        if (playerY >= boxTopHeight - 0.1) { // Small tolerance for floating point precision
          maxHeight = Math.max(maxHeight, boxTopHeight);
        }
      }
    }

    return maxHeight;
  }

  // Check if a position would collide with any collision box
  public checkCollision(position: THREE.Vector3, playerSize: THREE.Vector3): boolean {
    for (const box of this.collisionBoxes) {
      if (this.boxesIntersect(position, playerSize, box.position, box.size)) {
        return true;
      }
    }
    return false;
  }

  // Check horizontal collision (for blocking side movement)
  public checkHorizontalCollision(newX: number, newZ: number, playerY: number, playerRadius: number = 0.5, playerHeight: number = 2): boolean {
    for (const box of this.collisionBoxes) {
      // Check if player would intersect with box horizontally
      const boxMinX = box.position.x - box.size.x / 2;
      const boxMaxX = box.position.x + box.size.x / 2;
      const boxMinZ = box.position.z - box.size.z / 2;
      const boxMaxZ = box.position.z + box.size.z / 2;
      const boxMinY = box.position.y - box.size.y / 2;
      const boxMaxY = box.position.y + box.size.y / 2;

      // Check if player's new position would overlap with box
      const playerMinX = newX - playerRadius;
      const playerMaxX = newX + playerRadius;
      const playerMinZ = newZ - playerRadius;
      const playerMaxZ = newZ + playerRadius;
      const playerMinY = playerY;
      const playerMaxY = playerY + playerHeight;

      // Check for intersection in all three dimensions
      const xOverlap = playerMinX < boxMaxX && playerMaxX > boxMinX;
      const zOverlap = playerMinZ < boxMaxZ && playerMaxZ > boxMinZ;
      const yOverlap = playerMinY < boxMaxY && playerMaxY > boxMinY;

      if (xOverlap && zOverlap && yOverlap) {
        return true; // Collision detected
      }
    }
    return false;
  }

  private boxesIntersect(pos1: THREE.Vector3, size1: THREE.Vector3, pos2: THREE.Vector3, size2: THREE.Vector3): boolean {
    // AABB collision detection
    const min1 = new THREE.Vector3(
      pos1.x - size1.x / 2,
      pos1.y - size1.y / 2,
      pos1.z - size1.z / 2
    );
    const max1 = new THREE.Vector3(
      pos1.x + size1.x / 2,
      pos1.y + size1.y / 2,
      pos1.z + size1.z / 2
    );

    const min2 = new THREE.Vector3(
      pos2.x - size2.x / 2,
      pos2.y - size2.y / 2,
      pos2.z - size2.z / 2
    );
    const max2 = new THREE.Vector3(
      pos2.x + size2.x / 2,
      pos2.y + size2.y / 2,
      pos2.z + size2.z / 2
    );

    return (
      min1.x <= max2.x && max1.x >= min2.x &&
      min1.y <= max2.y && max1.y >= min2.y &&
      min1.z <= max2.z && max1.z >= min2.z
    );
  }

  public clear(): void {
    this.collisionBoxes = [];
  }
}
