import * as THREE from 'three';

export class Terrain {
  private mesh: THREE.Mesh;
  private waterMeshes: THREE.Mesh[] = [];
  private heightMap: number[][] = [];
  private waterMaterial: THREE.ShaderMaterial | null = null;

  constructor() {
    // Create a plane for terrain with more subdivisions for better detail and smoother movement
    const geometry = new THREE.PlaneGeometry(100, 100, 80, 80);

    // Create vertex colors for terrain variation
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      // Fix shadow artifacts
      shadowSide: THREE.FrontSide, // Only front faces cast shadows
      transparent: false,
      alphaTest: 0.5
    });

    this.mesh = new THREE.Mesh(geometry, material);

    // Position it at ground level
    this.mesh.position.y = 0;

    // Enable shadows - terrain should receive but not cast shadows to avoid artifacts
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false; // Disable casting to prevent shadow artifacts on terrain

    // Generate height variation BEFORE rotation
    this.generateHeightMap();
    this.applyHeightMap();

    // Rotate to be horizontal (floor) AFTER applying height map
    this.mesh.rotation.x = -Math.PI / 2;

    // Create water bodies
    this.createWaterBodies();
  }

  private generateHeightMap(): void {
    // Generate a 81x81 height map (matching geometry vertices for 80x80 subdivisions)
    const size = 81;
    this.heightMap = [];

    for (let i = 0; i < size; i++) {
      this.heightMap[i] = [];
      for (let j = 0; j < size; j++) {
        // CRITICAL: PlaneGeometry vertex arrangement after rotation
        // PlaneGeometry(width, height, widthSegments, heightSegments)
        // After rotation.x = -PI/2: 
        // - Original X (width) stays X
        // - Original Y (height) becomes Z
        // So: i corresponds to Z (depth), j corresponds to X (width)
        
        const worldX = (j / (size - 1) - 0.5) * 100;  // j -> X
        const worldZ = (i / (size - 1) - 0.5) * 100;  // i -> Z

        // Generate height using multiple noise functions for more natural terrain
        const baseHeight = Math.sin(worldX * 0.01) * Math.cos(worldZ * 0.01) * 10;
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
    const size = 81;

    // Apply height map to geometry vertices

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

        if (height < -1) {
          // Deep water areas - dark blue
          colors[colorIndex] = 0.2;     // R
          colors[colorIndex + 1] = 0.3; // G
          colors[colorIndex + 2] = 0.5; // B
        } else if (height < 0) {
          // Shallow water/sand - yellow  
          colors[colorIndex] = 226/255;     // R
          colors[colorIndex + 1] = 202/255; // G
          colors[colorIndex + 2] = 118/255; // B
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

    // Update geometry
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  private createWaterBodies(): void {
    // Create one large water body covering the entire terrain
    const waterGeometry = new THREE.PlaneGeometry(100, 100, 20, 20);
    
    // Create simple clear water material
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waterColor: { 
          value: new THREE.Color(0x4a90e2)
        }, // Lighter blue water
        waveSpeed: { value: 1 },
        waveScale: { value: 0.015 },
        opacity: { value: 0.4 },
        fresnelPower: { value: 2.0 },
        sunDirection: { value: new THREE.Vector3(1, 1, 0.5).normalize() }
      },
      vertexShader: `
        uniform float time;
        uniform float waveSpeed;
        uniform float waveScale;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewPosition;
        
        void main() {
          vUv = uv;
          
          // Simple, gentle wave animation
          float wave1 = sin(position.x * waveScale + time * waveSpeed) * 0.05;
          float wave2 = cos(position.y * waveScale * 1.3 + time * waveSpeed * 0.7) * 0.03;
          float wave3 = sin((position.x + position.y) * waveScale * 0.8 + time * waveSpeed * 1.2) * 0.02;
          
          float waveHeight = wave1 + wave2 + wave3;
          
          // Apply wave displacement
          vec3 newPosition = position;
          newPosition.z += waveHeight;
          
          // Calculate normals for lighting
          float dx = cos(position.x * waveScale + time * waveSpeed) * waveScale * 0.05;
          float dy = -sin(position.y * waveScale * 1.3 + time * waveSpeed * 0.7) * waveScale * 1.3 * 0.03;
          
          vec3 tangent = normalize(vec3(1.0, 0.0, dx));
          vec3 bitangent = normalize(vec3(0.0, 1.0, dy));
          vNormal = normalize(cross(tangent, bitangent));
          
          // World position for effects
          vec4 worldPos = modelMatrix * vec4(newPosition, 1.0);
          vWorldPosition = worldPos.xyz;
          vViewPosition = (modelViewMatrix * vec4(newPosition, 1.0)).xyz;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 waterColor;
        uniform float opacity;
        uniform float fresnelPower;
        uniform vec3 sunDirection;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewPosition;
        
        void main() {
          // Calculate view direction
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          
          // Fresnel effect for realistic water transparency
          float fresnel = pow(1.0 - max(0.0, dot(viewDirection, vNormal)), fresnelPower);
          
          // Simple depth-based color variation
          float distFromCenter = length(vWorldPosition.xz);
          float depth = smoothstep(0.0, 40.0, distFromCenter);
          
          // Base water color with depth variation - much lighter overall
          vec3 shallowColor = vec3(0.6, 0.8, 0.9); // Very light blue for shallow
          vec3 deepColor = vec3(0.4, 0.6, 0.9); // Light blue even for deep water
          vec3 baseColor = mix(shallowColor, deepColor, depth * 0.8); // Reduce depth contrast
          
          // Sun reflection on water surface
          vec3 reflectionDir = reflect(-sunDirection, vNormal);
          float sunReflection = pow(max(0.0, dot(viewDirection, reflectionDir)), 64.0);
          
          // Combine effects for lighter water
          vec3 finalColor = baseColor;
          finalColor = mix(finalColor, vec3(1.0), sunReflection * 0.4); // Stronger sun highlights
          finalColor = mix(finalColor, vec3(0.9, 0.95, 1.0), fresnel * 0.3); // Lighter fresnel tint
          
          // Make water more transparent overall
          float finalOpacity = mix(opacity * 0.3, opacity * 0.7, depth) * (1.0 + fresnel * 0.2);
          
          gl_FragColor = vec4(finalColor, finalOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, -0.5, 0); // Position below terrain level
    waterMesh.receiveShadow = false;
    waterMesh.castShadow = false;

    this.waterMeshes.push(waterMesh);
    
    // Store material for animation updates
    this.waterMaterial = waterMaterial;
  }

  public initialize(): void {
    // Additional initialization if needed
    console.log('Terrain initialized with', this.waterMeshes.length, 'water bodies');
  }

  public update(deltaTime: number): void {
    // Update water shader animation
    if (this.waterMaterial) {
      this.waterMaterial.uniforms.time.value += deltaTime;
    }
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  // Get height at specific world position (x, z) with bilinear interpolation
  public getHeightAt(x: number, z: number): number {
    // Check bounds first
    if (!this.isWithinBounds(x, z)) {
      return 0;
    }

    // CRITICAL: Use SAME coordinate mapping as generateHeightMap
    // In generateHeightMap: 
    // - worldX = (j / (size - 1) - 0.5) * 100  -> j = ((worldX / 100) + 0.5) * (size - 1)
    // - worldZ = (i / (size - 1) - 0.5) * 100  -> i = ((worldZ / 100) + 0.5) * (size - 1)
    // So: heightMap[i][j] where i=Z-index, j=X-index
    const size = 81;
    const exactJ = ((x / 100) + 0.5) * (size - 1);  // j corresponds to X
    const exactI = ((z / 100) + 0.5) * (size - 1);  // i corresponds to Z

    // Get integer coordinates for bilinear interpolation
    const i0 = Math.floor(exactI);
    const i1 = Math.min(i0 + 1, size - 1);
    const j0 = Math.floor(exactJ);
    const j1 = Math.min(j0 + 1, size - 1);

    // Clamp to valid indices
    const clampedI0 = Math.max(0, Math.min(size - 1, i0));
    const clampedI1 = Math.max(0, Math.min(size - 1, i1));
    const clampedJ0 = Math.max(0, Math.min(size - 1, j0));
    const clampedJ1 = Math.max(0, Math.min(size - 1, j1));

    // Get fractional parts for interpolation
    const fi = exactI - i0;
    const fj = exactJ - j0;

    // Get the four corner heights
    const h00 = this.heightMap[clampedI0][clampedJ0];
    const h01 = this.heightMap[clampedI0][clampedJ1];
    const h10 = this.heightMap[clampedI1][clampedJ0];
    const h11 = this.heightMap[clampedI1][clampedJ1];

    // Bilinear interpolation
    const h0 = h00 * (1 - fj) + h01 * fj; // Interpolate along j-axis at i0
    const h1 = h10 * (1 - fj) + h11 * fj; // Interpolate along j-axis at i1
    const height = h0 * (1 - fi) + h1 * fi; // Interpolate along i-axis

    return height;
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
    
    // Dispose water material
    if (this.waterMaterial) {
      this.waterMaterial.dispose();
      this.waterMaterial = null;
    }
  }
}
