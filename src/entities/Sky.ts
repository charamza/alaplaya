import * as THREE from 'three';

export class Sky {
  private mesh: THREE.Mesh;

  constructor() {
    // Create a sky sphere
    const geometry = new THREE.SphereGeometry(800, 32, 32);
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec3 skyColor = vec3(0.5, 0.7, 1.0); // Light blue
          vec3 horizonColor = vec3(0.8, 0.9, 1.0); // Lighter blue at horizon
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(skyColor, horizonColor, max(pow(max(h, 0.0), 0.8), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide // Render inside of sphere
    });

    this.mesh = new THREE.Mesh(geometry, material);
  }

  public initialize(): void {
    // Additional initialization if needed
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
