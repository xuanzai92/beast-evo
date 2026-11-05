import * as THREE from 'three';
import type { Vec2 } from './types';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public target = new THREE.Vector3(0, 0, 0);

  // Spherical orbit parameters
  public yaw = 0; // horizontal rotation in radians (0 to 2PI)
  public pitch = THREE.MathUtils.degToRad(48); // vertical angle (30 deg to 65 deg)
  public distance = 16.5; // distance from target

  private targetYaw = 0;
  private targetPitch = THREE.MathUtils.degToRad(48);
  private targetDistance = 16.5;

  private minPitch = THREE.MathUtils.degToRad(30);
  private maxPitch = THREE.MathUtils.degToRad(65);
  private minDistance = 11.0;
  private maxDistance = 25.0;

  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  public shakeIntensity = 0;
  public shakeDecay = 6.0;

  constructor(aspect = 16 / 9) {
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 500);
    this.updateCameraPosition(1);
  }

  public setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public setTarget(x: number, y: number, z: number) {
    this.target.set(x, y, z);
  }

  public sensitivity = 1.0;
  public invertPitch = false;

  public rotateDelta(deltaYaw: number, deltaPitch: number) {
    this.targetYaw += deltaYaw * this.sensitivity;
    const dp = this.invertPitch ? -deltaPitch : deltaPitch;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dp * this.sensitivity, this.minPitch, this.maxPitch);
  }

  public zoomDelta(delta: number) {
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + delta, this.minDistance, this.maxDistance);
  }

  public resetBehind(facing: Vec2) {
    // facing in 2D (x = right, y = down/forward in 2D)
    // in 3D: X is world X, Z is world Z.
    // When looking from behind facing (fx, fz):
    const angle = Math.atan2(facing.x, facing.y);
    this.targetYaw = angle;
  }

  public triggerShake(intensity = 0.3) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  public update(dt: number) {
    const smoothFactor = Math.min(1, dt * 14);
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, smoothFactor);
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, smoothFactor);
    this.distance = THREE.MathUtils.lerp(this.distance, this.targetDistance, smoothFactor);
    this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);

    this.updateCameraPosition();
  }

  private updateCameraPosition(immediateFactor = 0.18) {
    const cx = this.distance * Math.sin(this.pitch) * Math.sin(this.yaw);
    const cy = this.distance * Math.cos(this.pitch);
    const cz = this.distance * Math.sin(this.pitch) * Math.cos(this.yaw);

    const desiredCamPos = new THREE.Vector3(
      this.target.x + cx,
      this.target.y + cy,
      this.target.z + cz
    );

    if (this.shakeIntensity > 0) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      const sz = (Math.random() - 0.5) * this.shakeIntensity;
      desiredCamPos.add(new THREE.Vector3(sx, sy, sz));
    }

    if (immediateFactor >= 1) {
      this.camera.position.copy(desiredCamPos);
    } else {
      this.camera.position.lerp(desiredCamPos, immediateFactor);
    }

    this.camera.lookAt(this.target.x, this.target.y + 0.8, this.target.z);
  }

  public screenToGround(clientX: number, clientY: number, width: number, height: number): THREE.Vector3 | null {
    const ndcX = (clientX / width) * 2 - 1;
    const ndcY = -(clientY / height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hitPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint);
    return hit ? hitPoint : null;
  }

  public worldToScreen(worldPos: THREE.Vector3, width: number, height: number): { x: number; y: number; behind: boolean } {
    const p = worldPos.clone().project(this.camera);
    const behind = p.z > 1;
    const x = ((p.x + 1) * width) / 2;
    const y = ((-p.y + 1) * height) / 2;
    return { x, y, behind };
  }

  public getScreenEdgeIndicator(
    worldPos: THREE.Vector3,
    width: number,
    height: number,
    margin = 48
  ): { onScreen: boolean; x: number; y: number; angleRad: number; distance: number } {
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const toTarget = worldPos.clone().sub(this.camera.position);
    const distance = toTarget.length();
    const isBehind = toTarget.dot(camDir) < 0.1;

    const projected = worldPos.clone().project(this.camera);

    let ndcX = projected.x;
    let ndcY = projected.y;

    if (isBehind) {
      ndcX = -ndcX;
      ndcY = -ndcY;
      if (Math.abs(ndcX) < 0.001 && Math.abs(ndcY) < 0.001) {
        ndcY = -1;
      }
    }

    const screenX = ((ndcX + 1) * width) / 2;
    const screenY = ((-ndcY + 1) * height) / 2;

    const onScreen =
      !isBehind &&
      screenX >= margin &&
      screenX <= width - margin &&
      screenY >= margin &&
      screenY <= height - margin;

    if (onScreen) {
      return { onScreen: true, x: screenX, y: screenY, angleRad: 0, distance };
    }

    const cx = width / 2;
    const cy = height / 2;
    let dx = screenX - cx;
    let dy = screenY - cy;

    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      dy = 1;
    }

    const halfW = width / 2 - margin;
    const halfH = height / 2 - margin;

    const scaleX = halfW / Math.abs(dx);
    const scaleY = halfH / Math.abs(dy);
    const scale = Math.min(scaleX, scaleY);

    const edgeX = cx + dx * scale;
    const edgeY = cy + dy * scale;
    const angleRad = Math.atan2(dy, dx);

    return { onScreen: false, x: edgeX, y: edgeY, angleRad, distance };
  }
}
