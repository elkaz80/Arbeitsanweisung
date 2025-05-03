import * as THREE from 'three';

// Hilfsfunktion: Prüfung auf ungültige Transformationen
export function hasInvalidTransform(obj) {
    if (!obj || obj.isCSS3DObject) return false;
    const p = obj.position, r = obj.quaternion, s = obj.scale;
    if (isNaN(p.x)||isNaN(p.y)||isNaN(p.z)||isNaN(r.x)||isNaN(r.y)||isNaN(r.z)||isNaN(r.w)||isNaN(s.x)||isNaN(s.y)||isNaN(s.z)||s.x<=0||s.y<=0||s.z<=0) {
        console.warn(`[TRANSFORM CHECK] Invalid detected for ${obj.name||obj.uuid}`);
        return true;
    }
    if (!isFinite(p.x)||!isFinite(p.y)||!isFinite(p.z)||!isFinite(r.x)||!isFinite(r.y)||!isFinite(r.z)||!isFinite(r.w)||!isFinite(s.x)||!isFinite(s.y)||!isFinite(s.z)) {
        console.warn(`[TRANSFORM CHECK] Infinite value detected for ${obj.name||obj.uuid}`);
        return true;
    }
    return false;
}

// Globale temporäre Objekte für Berechnungen (um Garbage Collection zu reduzieren)
export const tempBox = new THREE.Box3();
export const tempSize = new THREE.Vector3();
export const tempVec = new THREE.Vector3();