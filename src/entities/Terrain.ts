import * as THREE from 'three';

export class Terrain {
  private mesh: THREE.Mesh;
  private waterMeshes: THREE.Mesh[] = [];
  private heightMap: number[][] = [];

  constructor() {
    console.log('=== TERRAIN ANALYSIS START ===');
    
    // Create a plane for terrain with more subdivisions for better detail
    const geometry = new THREE.PlaneGeometry(100, 100, 50, 50);
    
    console.log('PlaneGeometry created:');
    console.log('- Width: 100, Height: 100');
    console.log('- Width segments: 50, Height segments: 50');
    console.log('- Total vertices:', geometry.attributes.position.count);
    console.log('- Expected vertices (51x51):', 51 * 51);

    // Analyze original geometry coordinates
    const positions = geometry.attributes.position.array as Float32Array;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
      maxY = Math.max(maxY, positions[i + 1]);
      minZ = Math.min(minZ, positions[i + 2]);
      maxZ = Math.max(maxZ, positions[i + 2]);
    }
    console.log('Original PlaneGeometry coordinates:');
    console.log(`X: ${minX.toFixed(2)} to ${maxX.toFixed(2)} (width: ${(maxX - minX).toFixed(2)})`);
    console.log(`Y: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (height: ${(maxY - minY).toFixed(2)})`);
    console.log(`Z: ${minZ.toFixed(2)} to ${maxZ.toFixed(2)} (depth: ${(maxZ - minZ).toFixed(2)})`);

    // Create vertex colors for terrain variation
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);

    // Position it at ground level
    this.mesh.position.y = 0;

    // Enable shadows
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    // Generate height variation BEFORE rotation
    console.log('Generating height map...');
    this.generateHeightMap();
    console.log('Applying height map...');
    this.applyHeightMap();

    // Rotate to be horizontal (floor) AFTER applying height map
    this.mesh.rotation.x = -Math.PI / 2;
    console.log('Applied rotation.x = -Math.PI / 2 AFTER height mapping');

    // Create water bodies
    this.createWaterBodies();
    
    console.log('=== TERRAIN ANALYSIS END ===');
  }

  private generateHeightMap(): void {
    // Generate a 51x51 height map (matching geometry vertices)
    const size = 51;
    this.heightMap = [];

    for (let i = 0; i < size; i++) {
      this.heightMap[i] = [];
      for (let j = 0; j < size; j++) {
        // Convert grid coordinates to world coordinates (-50 to 50)
        const worldX = (i / (size - 1) - 0.5) * 100;
        const worldZ = (j / (size - 1) - 0.5) * 100;

        // Generate height using multiple noise functions for more natural terrain
        const baseHeight = Math.sin(worldX * 0.01) * Math.cos(worldZ * 0.01) * 2;
        const detail1 = Math.sin(worldX * 0.03) * Math.cos(worldZ * 0.03) * 0.5;
        const detail2 = Math.sin(worldX * 0.05 + Math.PI/4) * Math.cos(worldZ * 0.05 + Math.PI/4) * 0.3;

        const height = baseHeight + detail1 + detail2;

        // Add some random variation for more natural look
        const randomVariation = (Math.random() - 0.5) * 0.2;

        this.heightMap[i][j] = Math.max(height + randomVariation, -1); // Ensure minimum depth for water
      }
    }
  }

  private applyHeightMap(): void {
    const positions = this.mesh.geometry.attributes.position.array as Float32Array;
    const colors = this.mesh.geometry.attributes.color.array as Float32Array;
    const size = 51;

    console.log('=== ANALYZING VERTEX MAPPING ===');
    console.log('Total position values:', positions.length);
    console.log('Total vertices:', positions.length / 3);
    console.log('Expected grid size:', size, 'x', size, '=', size * size);

    // Let's check how PlaneGeometry actually arranges vertices
    console.log('First 10 vertices (before height mapping):');
    for (let i = 0; i < 30; i += 3) {
      const vertexNum = i / 3;
      console.log(`Vertex ${vertexNum}: (${positions[i].toFixed(2)}, ${positions[i+1].toFixed(2)}, ${positions[i+2].toFixed(2)})`);
    }

    // Check coordinate ranges before applying height map
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
      maxY = Math.max(maxY, positions[i + 1]);
      minZ = Math.min(minZ, positions[i + 2]);
      maxZ = Math.max(maxZ, positions[i + 2]);
    }
    console.log('Coordinate ranges BEFORE height mapping:');
    console.log(`X: ${minX.toFixed(2)} to ${maxX.toFixed(2)} (width: ${(maxX - minX).toFixed(2)})`);
    console.log(`Y: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (height: ${(maxY - minY).toFixed(2)})`);
    console.log(`Z: ${minZ.toFixed(2)} to ${maxZ.toFixed(2)} (depth: ${(maxZ - minZ).toFixed(2)})`);

    // CRITICAL ANALYSIS: Let's understand how PlaneGeometry arranges vertices
    // PlaneGeometry with (widthSegments=50, heightSegments=50) creates 51x51 vertices
    // But we need to understand the actual vertex order!
    
    console.log('=== TESTING VERTEX ARRANGEMENT ===');
    // Test a few specific positions to understand the mapping
    for (let testRow = 0; testRow < 3; testRow++) {
      for (let testCol = 0; testCol < 3; testCol++) {
        const testIndex = (testRow * size + testCol) * 3;
        if (testIndex < positions.length) {
          console.log(`Grid[${testRow}][${testCol}] -> Vertex ${testIndex/3}: (${positions[testIndex].toFixed(2)}, ${positions[testIndex+1].toFixed(2)}, ${positions[testIndex+2].toFixed(2)})`);
        }
      }
    }

    // Apply height map using our current assumption
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        // Calculate vertex index in the position array
        const vertexIndex = (i * size + j) * 3;
        
        if (vertexIndex >= positions.length) {
          console.error(`ERROR: vertexIndex ${vertexIndex} exceeds positions.length ${positions.length}`);
          continue;
        }
        
        const height = this.heightMap[i][j];

        // CRITICAL FIX: We want terrain in XZ plane with Y as height
        // PlaneGeometry starts in XY plane (X=width, Y=height, Z=0)
        // After rotation.x = -PI/2: X stays X, Y becomes Z, Z becomes -Y
        // So to get proper terrain: we need to set Z coordinate to height
        // This will become Y coordinate after rotation
        positions[vertexIndex + 2] = height;  // Set Z, which becomes Y after rotation

        // Set vertex colors based on height and position for terrain variation
        const colorIndex = vertexIndex;

        if (height < -0.5) {
          // Deep water areas - dark blue
          colors[colorIndex] = 0.2;     // R
          colors[colorIndex + 1] = 0.3; // G
          colors[colorIndex + 2] = 0.5; // B
        } else if (height < 0) {
          // Shallow water/mud - brown
          colors[colorIndex] = 0.4;     // R
          colors[colorIndex + 1] = 0.3; // G
          colors[colorIndex + 2] = 0.2; // B
        } else if (height < 1) {
          // Grass/low areas - green
          colors[colorIndex] = 0.3;     // R
          colors[colorIndex + 1] = 0.5; // G
          colors[colorIndex + 2] = 0.2; // B
        } else if (height < 2) {
          // Hills - lighter green
          colors[colorIndex] = 0.4;     // R
          colors[colorIndex + 1] = 0.6; // G
          colors[colorIndex + 2] = 0.3; // B
        } else {
          // Mountains - gray/brown
          colors[colorIndex] = 0.5;     // R
          colors[colorIndex + 1] = 0.4; // G
          colors[colorIndex + 2] = 0.3; // B
        }

        // Add some variation based on position for more natural look
        const worldX = positions[vertexIndex];
        const worldY = positions[vertexIndex + 1];  // This is the original Y coordinate (will become Z)
        const variation = (Math.sin(worldX * 0.01) + Math.cos(worldY * 0.01)) * 0.1;
        colors[colorIndex] = Math.max(0, Math.min(1, colors[colorIndex] + variation));
        colors[colorIndex + 1] = Math.max(0, Math.min(1, colors[colorIndex + 1] + variation * 0.5));
        colors[colorIndex + 2] = Math.max(0, Math.min(1, colors[colorIndex + 2] + variation * 0.3));
      }
    }

    // Check coordinate ranges AFTER applying height map
    minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity; minZ = Infinity; maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]);
      maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i + 1]);
      maxY = Math.max(maxY, positions[i + 1]);
      minZ = Math.min(minZ, positions[i + 2]);
      maxZ = Math.max(maxZ, positions[i + 2]);
    }
    console.log('Coordinate ranges AFTER height mapping (BEFORE rotation):');
    console.log(`X: ${minX.toFixed(2)} to ${maxX.toFixed(2)} (width: ${(maxX - minX).toFixed(2)})`);
    console.log(`Y: ${minY.toFixed(2)} to ${maxY.toFixed(2)} (original height: ${(maxY - minY).toFixed(2)})`);
    console.log(`Z: ${minZ.toFixed(2)} to ${maxZ.toFixed(2)} (terrain height: ${(maxZ - minZ).toFixed(2)})`);
    console.log('After rotation.x = -PI/2: X stays X, Y->Z, Z->Y');

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    
    console.log('=== HEIGHT MAP APPLICATION COMPLETE ===');
  }

  private createWaterBodies(): void {
    // Create a few water bodies at lower elevations
    const waterPositions = [
      { x: -20, z: -20, size: 8 },
      { x: 15, z: 25, size: 6 },
      { x: 35, z: -10, size: 5 },
      { x: -35, z: 15, size: 7 }
    ];

    waterPositions.forEach(({ x, z, size }) => {
      // Only create water if the terrain is low enough
      const terrainHeight = this.getHeightAt(x, z);
      if (terrainHeight < 0.5) {
        const waterGeometry = new THREE.CircleGeometry(size, 16);
        const waterMaterial = new THREE.MeshLambertMaterial({
          color: 0x4a90e2,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide
        });

        const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        waterMesh.rotation.x = -Math.PI / 2;
        waterMesh.position.set(x, terrainHeight + 0.1, z); // Slightly above terrain
        waterMesh.receiveShadow = false;
        waterMesh.castShadow = false;

        this.waterMeshes.push(waterMesh);
      }
    });
  }

  public initialize(): void {
    // Additional initialization if needed
    console.log('Terrain initialized at position:', this.mesh.position);
    console.log('Terrain geometry size:', 100, 'x', 100);
    console.log('Terrain has', this.waterMeshes.length, 'water bodies');
    console.log('Terrain rotation:', this.mesh.rotation);
    console.log('Terrain visible:', this.mesh.visible);
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  // Get height at specific world position (x, z)
  public getHeightAt(x: number, z: number): number {
    // Check bounds first
    if (!this.isWithinBounds(x, z)) {
      return 0;
    }

    // Convert world coordinates to grid coordinates
    const size = 51;
    const gridX = Math.floor(((x + 50) / 100) * (size - 1));
    const gridZ = Math.floor(((z + 50) / 100) * (size - 1));

    // Clamp to valid indices
    const clampedX = Math.max(0, Math.min(size - 1, gridX));
    const clampedZ = Math.max(0, Math.min(size - 1, gridZ));

    return this.heightMap[clampedX][clampedZ];
  }

  // Check if position is within terrain bounds
  public isWithinBounds(x: number, z: number): boolean {
    return Math.abs(x) <= 50 && Math.abs(z) <= 50; // Terrain is 100x100
  }

  // Get all water meshes for scene integration
  public getWaterMeshes(): THREE.Mesh[] {
    return this.waterMeshes;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();

    // Dispose water meshes
    this.waterMeshes.forEach(waterMesh => {
      waterMesh.geometry.dispose();
      (waterMesh.material as THREE.Material).dispose();
    });
    this.waterMeshes = [];
  }
}
