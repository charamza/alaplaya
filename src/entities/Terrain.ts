import * as THREE from 'three';

export class Terrain {
  private mesh: THREE.Mesh;

  constructor() {
    // Create a plane for terrain (make it larger for visibility)
    const geometry = new THREE.PlaneGeometry(100, 100, 10, 10);
    const material = new THREE.MeshLambertMaterial({
      color: 0x4a7c59,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);

    // Rotate to be horizontal (floor)
    this.mesh.rotation.x = -Math.PI / 2;

    // Position it at ground level
    this.mesh.position.y = 0;

    // Enable shadows
    this.mesh.receiveShadow = true;

    // Temporarily disable height variation for debugging
    // const positions = geometry.attributes.position.array as Float32Array;
    // for (let i = 0; i < positions.length; i += 3) {
    //   const x = positions[i];
    //   const z = positions[i + 2];
    //   // Simple height variation using sine waves
    //   positions[i + 1] = Math.sin(x * 0.005) * Math.cos(z * 0.005) * 1;
    // }
    // geometry.attributes.position.needsUpdate = true;
    // geometry.computeVertexNormals();
  }

  public initialize(): void {
    // Additional initialization if needed
    console.log('Terrain initialized at position:', this.mesh.position);
    console.log('Terrain geometry size:', 100, 'x', 100);
    console.log('Terrain rotation:', this.mesh.rotation);
    console.log('Terrain visible:', this.mesh.visible);
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  // Get height at specific world position (x, z)
  public getHeightAt(x: number, z: number): number {
    // For now, return 0 since terrain is flat
    // Later this can be extended for height maps
    return 0;
  }

  // Check if position is within terrain bounds
  public isWithinBounds(x: number, z: number): boolean {
    return Math.abs(x) <= 50 && Math.abs(z) <= 50; // Terrain is 100x100
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
