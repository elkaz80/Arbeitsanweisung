// src/Managers/AnimationManager.js

import * as THREE from 'three';

class AnimationManager {
    constructor() {
        this.keyframes = {}; // { uuid: [ {time, position?, quaternion?, scale?}, ... ] }
        this.currentTime = 0;
        this.duration = 100;
        this.isPlaying = false;
        this.uiManager = null; // Für Timeline-Updates

        console.log("[AnimationManager] Initialized.");
    }

    /**
     * Setzt die Referenz auf den UIManager.
     */
    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }

    /**
     * Fügt einen Keyframe hinzu oder aktualisiert ihn.
     */
    addKeyframe(object, time, values = {}) {
        if (!object || !object.uuid || typeof time !== 'number' || time < 0) { return; }
        const uuid = object.uuid;
        if (!this.keyframes[uuid]) { this.keyframes[uuid] = []; }

        const newFrameData = { time: time };
        if (values.position instanceof THREE.Vector3) newFrameData.position = values.position.clone();
        if (values.quaternion instanceof THREE.Quaternion) newFrameData.quaternion = values.quaternion.clone();
        if (values.scale instanceof THREE.Vector3) newFrameData.scale = values.scale.clone();

        const existingFrameIndex = this.keyframes[uuid].findIndex(frame => Math.abs(frame.time - time) < 0.001); // Toleranz für Zeitvergleich

        if (existingFrameIndex > -1) {
            Object.assign(this.keyframes[uuid][existingFrameIndex], newFrameData);
            // console.log(`[AnimationManager] Updated keyframe for ${object.name || uuid} at time ${time.toFixed(2)}s`);
        } else {
            this.keyframes[uuid].push(newFrameData);
            this.keyframes[uuid].sort((a, b) => a.time - b.time);
            // console.log(`[AnimationManager] Added keyframe for ${object.name || uuid} at time ${time.toFixed(2)}s`);
        }
        this.recalculateDuration();
        // notifyTimelineUpdate wird durch recalculateDuration aufgerufen (falls Dauer sich ändert oder Zeit angepasst wird)
    }

    /**
     * Entfernt alle Keyframes für ein Objekt.
     */
    removeKeyframesForObject(object) {
        if (!object || !object.uuid) return;
        const uuid = object.uuid;
        if (this.keyframes[uuid]) {
            delete this.keyframes[uuid];
            console.log(`[AnimationManager] Removed all keyframes for ${object.name || uuid}`);
            this.recalculateDuration();
            this.notifyTimelineUpdate(); // UI informieren, dass sich Dauer geändert haben *könnte*
        }
    }

    /**
     * Berechnet die Gesamtdauer neu.
     */
    recalculateDuration() {
        let maxTime = 0;
        for (const uuid in this.keyframes) {
            const frames = this.keyframes[uuid];
            if (frames && frames.length > 0) {
                maxTime = Math.max(maxTime, frames[frames.length - 1].time);
            }
        }
        if (this.duration !== maxTime) {
             this.duration = maxTime;
             console.log(`[AnimationManager] Recalculated duration: ${this.duration.toFixed(2)}s`);
             // Wenn aktuelle Zeit außerhalb, anpassen
             if (this.currentTime > this.duration) {
                 this.setTime(this.duration); // SetTime ruft notifyTimeUpdate
             } else {
                  this.notifyTimelineUpdate(); // UI informieren über neue Dauer
             }
        }
    }

    // --- Wiedergabesteuerung ---
    play() {
        if (this.duration <= 0) { return; }
        if (this.currentTime >= this.duration) { this.currentTime = 0; }
        this.isPlaying = true;
        console.log("[AnimationManager] Play");
        this.notifyTimelineUpdate(); // Play/Pause Button aktualisieren
    }

    pause() {
        this.isPlaying = false;
        console.log("[AnimationManager] Pause");
        this.notifyTimelineUpdate(); // Play/Pause Button aktualisieren
    }

    stop() {
        this.isPlaying = false; // Wichtig: isPlaying VOR setTime setzen
        this.setTime(0);       // Setzt Zeit auf 0 und ruft notifyTimeUpdate
        console.log("[AnimationManager] Stop");
    }

    /**
     * Setzt die aktuelle Zeit manuell.
     */
    setTime(time) {
        const newTime = THREE.MathUtils.clamp(time, 0, this.duration);
        if (this.currentTime !== newTime) { // Nur updaten wenn nötig
             this.currentTime = newTime;
             // console.log(`[AnimationManager] Set time to ${this.currentTime.toFixed(2)}`);
             this.notifyTimeUpdate();
        }
    }

    /**
     * Wird vom AppManager im Loop aufgerufen.
     */
    update(isGizmoDragging, deltaTime) {
        if (this.isPlaying && !isGizmoDragging) {
            const newTime = this.currentTime + deltaTime;
            if (newTime >= this.duration) {
                 this.currentTime = this.duration;
                 this.pause(); // Pausiert UND ruft notifyTimeUpdate
                 console.log("[AnimationManager] Animation ended.");
            } else {
                 this.currentTime = newTime;
                 this.notifyTimeUpdate(); // UI informieren
            }
        }
    }

    /**
     * Informiert das UI über die Zeit- und Statusänderung.
     */
    notifyTimeUpdate() {
        // Übergibt Zeit, Dauer und Play-Status an die UI-Methode
        this.uiManager?.updateTimelineIndicator(this.currentTime, this.duration, this.isPlaying);
    }

    // --- Werteberechnung ---
    /**
     * Berechnet die interpolierten Werte für ein Objekt zur Zeit t.
     */
    getAnimatedValues(object, time) {
        if (!object?.uuid) return {};
        const frames = this.keyframes[object.uuid];
        if (!frames || frames.length === 0) return {};
        if (frames.length === 1) return { /* Klon von Frame 0 Werten */
            position: frames[0].position?.clone(),
            quaternion: frames[0].quaternion?.clone(),
            scale: frames[0].scale?.clone()
        };

        let prevFrame = frames[0]; let nextFrame = frames[frames.length - 1];
        for (let i = frames.length - 1; i >= 0; i--) { if (frames[i].time <= time) { prevFrame = frames[i]; break; } }
        for (let i = 0; i < frames.length; i++) { if (frames[i].time >= time) { nextFrame = frames[i]; break; } }

        if (prevFrame === nextFrame) { return { /* Klon von prevFrame Werten */
            position: prevFrame.position?.clone(),
            quaternion: prevFrame.quaternion?.clone(),
            scale: prevFrame.scale?.clone()
        }; }

        const timeDiff = nextFrame.time - prevFrame.time;
        const alpha = (timeDiff === 0) ? 0 : THREE.MathUtils.clamp((time - prevFrame.time) / timeDiff, 0, 1);

        const result = {};
        const tempVec1 = new THREE.Vector3(); const tempVec2 = new THREE.Vector3();
        const tempQuat1 = new THREE.Quaternion(); const tempQuat2 = new THREE.Quaternion();

        // Interpoliere nur, wenn beide Frames den entsprechenden Wert haben
        if (prevFrame.position && nextFrame.position) { result.position = tempVec1.copy(prevFrame.position).lerp(tempVec2.copy(nextFrame.position), alpha); }
        if (prevFrame.quaternion && nextFrame.quaternion) { result.quaternion = tempQuat1.copy(prevFrame.quaternion).slerp(tempQuat2.copy(nextFrame.quaternion), alpha); }
        if (prevFrame.scale && nextFrame.scale) { result.scale = tempVec1.copy(prevFrame.scale).lerp(tempVec2.copy(nextFrame.scale), alpha); }

        return result;
    }

    // --- Getter ---
    getCurrentTime() { return this.currentTime; }
    getDuration() { return this.duration; }
    getIsPlaying() { return this.isPlaying; } // Nützlich für UI
    getKeyframesForObject(object) { return this.keyframes[object.uuid] || []; }

} // Ende class AnimationManager

export default AnimationManager;