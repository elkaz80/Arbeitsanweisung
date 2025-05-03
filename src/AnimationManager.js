// src/AnimationManager.js (KORRIGIERT v2)

import * as THREE from 'three';
import { hasInvalidTransform } from './utils'; // Nur hasInvalidTransform

// *** getInterpolatedValue HIER als lokale Hilfsfunktion definieren ***
function getInterpolatedValue(frames, time, isQuaternion = false) {
    if (!frames || frames.length === 0) return null;
    const firstFrameValid = !hasInvalidTransform({ value: frames[0].value });
    const lastFrameValid = !hasInvalidTransform({ value: frames[frames.length - 1].value });
    if (time <= frames[0].time) return firstFrameValid ? frames[0].value.clone() : null;
    if (time >= frames[frames.length - 1].time) return lastFrameValid ? frames[frames.length - 1].value.clone() : null;
    for (let i = 1; i < frames.length; i++) { const prev = frames[i - 1]; const next = frames[i]; if (time >= prev.time && time <= next.time) { const prevValid = !hasInvalidTransform({ value: prev.value }); const nextValid = !hasInvalidTransform({ value: next.value }); if (next.time === prev.time || !prevValid || !nextValid) { return prevValid ? prev.value.clone() : null; } const t = (time - prev.time) / (next.time - prev.time); if (isQuaternion) return prev.value.clone().slerp(next.value, t); else return prev.value.clone().lerp(next.value, t); } }
     return lastFrameValid ? frames[frames.length - 1].value.clone() : null;
}
// **************************************************************

class AnimationManager {
    constructor() { /* ... (wie vorher) ... */ this.keyframes = {}; this.playing = false; this.timelineTime = 0; this.maxTimelineTime = 10.0; this.clock = new THREE.Clock(); }
    setKeyframe(object, type, time, value) { /* ... (wie vorher) ... */ if (!object) return; const id = object.uuid; if ((type==='position'||type==='scale') && (isNaN(value.x)||!isFinite(value.x)||isNaN(value.y)||!isFinite(value.y)||isNaN(value.z)||!isFinite(value.z))) { console.error(`[AnimManager] Invalid ${type} value`, value); return; } if (type==='quaternion' && (isNaN(value.x)||!isFinite(value.x)||isNaN(value.y)||!isFinite(value.y)||isNaN(value.z)||!isFinite(value.z)||isNaN(value.w)||!isFinite(value.w))) { console.error(`[AnimManager] Invalid quat value`, value); return; } if (type==='scale' && (isNaN(value.x)||!isFinite(value.x)||isNaN(value.y)||!isFinite(value.y)||isNaN(value.z)||!isFinite(value.z)||value.x<=0||value.y<=0||value.z<=0 )) { console.error(`[AnimManager] Invalid scale value`, value); return; } if (!this.keyframes[id]) this.keyframes[id] = { position: [], quaternion: [], scale: [] }; if (!this.keyframes[id][type]) this.keyframes[id][type] = []; const tol = 0.001; const idx = this.keyframes[id][type].findIndex(f => Math.abs(f.time - time) < tol); if (idx > -1) { this.keyframes[id][type][idx].value.copy(value); } else { this.keyframes[id][type].push({ time, value: value.clone() }); this.keyframes[id][type].sort((a, b) => a.time - b.time); } }
    getKeyframesForObject(object) { return object ? this.keyframes[object.uuid] : null; }
    deleteKeyframe(object, type, time) { if (!object) return false; const id = object.uuid; const tol = 0.001; if (this.keyframes[id]?.[type]) { const len = this.keyframes[id][type].length; this.keyframes[id][type] = this.keyframes[id][type].filter(f => Math.abs(f.time - time) > tol); return this.keyframes[id][type].length < len; } return false; }
    removeKeyframesForObject(object) { if (object?.uuid && this.keyframes[object.uuid]) { delete this.keyframes[object.uuid]; console.log(`[AnimManager] Removed keyframes for ${object.name || object.uuid}`); } }
    play() { if (!this.playing) { this.playing = true; this.clock.start(); console.log("[AnimManager] Play"); } }
    pause() { if (this.playing) { this.playing = false; this.clock.stop(); console.log("[AnimManager] Pause"); } }
    togglePlayPause() { if (this.playing) this.pause(); else this.play(); return this.playing; }
    setTime(newTime) { this.timelineTime = Math.max(0, Math.min(this.maxTimelineTime, newTime)); console.log(`[AnimManager] Time set: ${this.timelineTime.toFixed(2)}`); }
    step(direction) { if (this.playing) this.pause(); const step = 1 / 30; const newTime = this.timelineTime + direction * step; this.setTime(newTime); }
    setMaxTime(newMaxTime) { if (!isNaN(newMaxTime) && newMaxTime > 0) { this.maxTimelineTime = newMaxTime; if (this.timelineTime > this.maxTimelineTime) this.setTime(this.maxTimelineTime); console.log(`[AnimManager] Max time set: ${this.maxTimelineTime.toFixed(1)}`); } else console.warn(`[AnimManager] Invalid max time: ${newMaxTime}`); }
    getMaxTime() { return this.maxTimelineTime; } // Diese Methode existiert!
    getCurrentTime() { return this.timelineTime; }
    isPlaying() { return this.playing; }
    update(isGizmoDragging) { if (this.playing && !isGizmoDragging) { this.timelineTime += this.clock.getDelta(); if (this.timelineTime > this.maxTimelineTime) this.timelineTime = 0; } }
    getAnimatedValues(object, time) { if (!object || hasInvalidTransform(object)) return {}; const id = object.uuid; const data = this.keyframes[id]; if (!data) return {}; const pos = getInterpolatedValue(data.position, time, false); const quat = getInterpolatedValue(data.quaternion, time, true); const scl = getInterpolatedValue(data.scale, time, false); const values = {}; if (pos && !isNaN(pos.x) && isFinite(pos.x)) values.position = pos; if (quat && !isNaN(quat.x) && isFinite(quat.x)) values.quaternion = quat; if (scl && !isNaN(scl.x) && isFinite(scl.x) && scl.x > 0 && object.name !== "CameraPivot") values.scale = scl; return values; }
}
export default AnimationManager;