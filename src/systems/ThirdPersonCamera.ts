import * as THREE from 'three';
import { InputManager } from '@/systems/InputManager';
import { Terrain } from '@/entities/Terrain';

export class ThirdPersonCamera {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private currentPosition: THREE.Vector3;
  private spherical: THREE.Spherical;
  
  // Camera settings
  private minDistance = 3;
  private maxDistance = 20;
  private minPolarAngle = 0.1; // Prevent camera from going too low
  private maxPolarAngle = Math.PI - 0.1; // Prevent camera from going too high
  
  // Mouse sensitivity
  private mouseSensitivity = 0.01;
  private zoomSensitivity = 0.005;
  
  // Smoothing
  private lerpFactor = 0.1;
  
  // State
  private isRotating = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 1, 0); // Target slightly above ground
    this.currentPosition = new THREE.Vector3();
    
    // Initialize spherical coordinates (radius, phi, theta)
    // phi = polar angle (0 to PI), theta = azimuthal angle (0 to 2*PI)
    this.spherical = new THREE.Spherical(8, Math.PI / 3, 0);
    
    this.updateCameraPosition();
  }

  public update(deltaTime: number, inputManager: InputManager, playerPosition?: THREE.Vector3, terrain?: Terrain): void {
    // Update target to follow player
    if (playerPosition) {
      this.target.copy(playerPosition);
      this.target.y += 1; // Camera looks at player's center (mesh center is 1 unit above ground)
    }

    // Handle mouse rotation
    const rightMousePressed = inputManager.isMouseButtonPressed(2); // Right mouse button
    
    if (rightMousePressed && !this.isRotating) {
      this.isRotating = true;
      document.body.style.cursor = 'none';
    } else if (!rightMousePressed && this.isRotating) {
      this.isRotating = false;
      document.body.style.cursor = 'auto';
    }

    if (this.isRotating) {
      const mouseMovement = inputManager.getMouseMovement();
      
      // Update spherical coordinates based on mouse movement
      this.spherical.theta -= mouseMovement.x * this.mouseSensitivity;
      this.spherical.phi -= mouseMovement.y * this.mouseSensitivity;
      
      // Clamp phi to prevent camera from flipping
      this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
    }

    // Handle zoom with mouse wheel
    const wheelDelta = inputManager.getWheelDelta();
    if (wheelDelta !== 0) {
      this.spherical.radius += wheelDelta * this.zoomSensitivity;
      this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
    }

    // Update camera position
    this.updateCameraPosition(terrain);
  }

  private updateCameraPosition(terrain?: Terrain): void {
    // Convert spherical coordinates to cartesian
    const offset = new THREE.Vector3();
    offset.setFromSpherical(this.spherical);
    
    // Calculate desired camera position
    const desiredPosition = this.target.clone().add(offset);
    
    // Check terrain collision
    if (terrain) {
      const terrainHeight = terrain.getHeightAt(desiredPosition.x, desiredPosition.z);
      const minCameraHeight = terrainHeight + 1; // Kamera musí být alespoň 1 jednotku nad terénem
      
      if (desiredPosition.y < minCameraHeight) {
        desiredPosition.y = minCameraHeight;
      }
    }
    
    // Smooth camera movement
    this.currentPosition.lerp(desiredPosition, this.lerpFactor);
    
    // Update camera
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.target);
  }

  public setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public setDistance(distance: number): void {
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
  }

  public getDistance(): number {
    return this.spherical.radius;
  }

  // Get camera's forward direction for player movement
  public getForwardDirection(): THREE.Vector3 {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0; // Remove vertical component for ground movement
    forward.normalize();
    return forward;
  }

  // Get camera's right direction for player movement
  public getRightDirection(): THREE.Vector3 {
    const forward = this.getForwardDirection();
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    right.normalize();
    return right;
  }

  public dispose(): void {
    document.body.style.cursor = 'auto';
  }
}
