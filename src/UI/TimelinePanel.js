// src/UI/TimelinePanel.js

import * as THREE from 'three'; // Für Vector3 etc. in addKeyframe

class TimelinePanel {
    /**
     * Verwaltet die UI-Elemente der Animations-Timeline.
     * @param {object} animationManager - Instanz des AnimationManagers.
     * @param {object} selectionManager - Instanz des SelectionManagers (für Add Keyframe).
     * @param {HTMLElement} parentElement - Das DOM-Element (#timeline-controls).
     */
    constructor(animationManager, selectionManager, parentElement) {
        if (!animationManager || !selectionManager || !parentElement) {
            throw new Error("TimelinePanel requires AnimationManager, SelectionManager, and parentElement!");
        }
        this.animationManager = animationManager;
        this.selectionManager = selectionManager;
        this.parentElement = parentElement;

        // DOM-Elemente finden
        this.stopBtn = this.parentElement.querySelector('#anim-stop-btn');
        this.playPauseBtn = this.parentElement.querySelector('#anim-play-pause-btn');
        this.playPauseIcon = this.parentElement.querySelector('#play-pause-icon'); // Speziell das Icon
        this.slider = this.parentElement.querySelector('#timeline-slider');
        this.timeDisplay = this.parentElement.querySelector('#timeline-time');
        this.addKeyframeBtn = this.parentElement.querySelector('#add-keyframe-btn');

        // Prüfen ob alles da ist
        if (!this.stopBtn || !this.playPauseBtn || !this.playPauseIcon || !this.slider || !this.timeDisplay || !this.addKeyframeBtn) {
            console.error("[TimelinePanel] Could not find all required timeline elements!");
            return; // Verhindert Listener, wenn Elemente fehlen
        }

        this.isDraggingSlider = false; // Verhindert Konflikte beim Ziehen des Sliders

        this.init();
    }

    init() {
        this.attachListeners();
        this.updateIndicator(this.animationManager.getCurrentTime()); // Initialen Zustand anzeigen
        console.log("[TimelinePanel] Initialized.");
    }

    attachListeners() {
        // Stop Button
        this.stopBtn.addEventListener('click', () => this.animationManager.stop());

        // Play/Pause Button
        this.playPauseBtn.addEventListener('click', () => {
            if (this.animationManager.isPlaying) {
                this.animationManager.pause();
            } else {
                this.animationManager.play();
            }
            // UI sofort aktualisieren (Icon und Slider-Status)
            this.updateIndicator(this.animationManager.getCurrentTime());
        });

        // Timeline Slider
        this.slider.addEventListener('mousedown', () => { this.isDraggingSlider = true; });
        this.slider.addEventListener('mouseup', () => { this.isDraggingSlider = false; });
        this.slider.addEventListener('input', (event) => { // 'input' für live-Update beim Ziehen
            const time = parseFloat(event.target.value);
            this.animationManager.setTime(time); // Setzt Zeit im Manager
            // UI wird durch notifyTimeUpdate() aktualisiert, aber zur Sicherheit direkt:
             this.updateTimeDisplay(time);
        });

        // Keyframe Button
        this.addKeyframeBtn.addEventListener('click', () => this.handleAddKeyframe());

        console.log("[TimelinePanel] Timeline listeners attached.");
    }

    /**
     * Fügt Keyframes für aktuell ausgewählte Objekte zur aktuellen Zeit hinzu.
     */
    handleAddKeyframe() {
        const currentTime = this.animationManager.getCurrentTime();
        const selectedObjects = this.selectionManager.getSelectedObjects();

        if (selectedObjects.length === 0) {
            alert("Bitte mindestens ein Objekt auswählen, um einen Keyframe hinzuzufügen.");
            return;
        }

        console.log(`[TimelinePanel] Adding keyframe at time ${currentTime.toFixed(2)}s for ${selectedObjects.length} objects.`);
        selectedObjects.forEach(obj => {
            // Speichere aktuelle Position, Rotation und Skalierung
            const values = {
                position: obj.position.clone(),
                quaternion: obj.quaternion.clone(),
                scale: obj.scale.clone()
            };
            this.animationManager.addKeyframe(obj, currentTime, values);
        });
        // Optional: Visuelles Feedback
    }

    /**
     * Aktualisiert die UI-Anzeige (Slider-Position, Zeit, Play/Pause-Icon).
     * Wird vom AnimationManager über den UIManager aufgerufen.
     * @param {number} currentTime - Die aktuelle Zeit vom AnimationManager.
     */
    updateIndicator(currentTime) {
        const duration = this.animationManager.getDuration();

        // Slider-Maximum und -Position aktualisieren (nur wenn nicht gezogen wird)
        if (this.slider && !this.isDraggingSlider) {
            this.slider.max = duration > 0 ? duration.toFixed(2) : "0.01"; // Max muss > Min sein
            this.slider.value = currentTime.toFixed(2);
        }

        // Zeitanzeige aktualisieren
        this.updateTimeDisplay(currentTime, duration);

        // Play/Pause Icon aktualisieren
        if (this.playPauseIcon) {
            this.playPauseIcon.textContent = this.animationManager.isPlaying ? 'pause' : 'play_arrow';
            this.playPauseBtn.title = this.animationManager.isPlaying ? 'Pause (Space)' : 'Play (Space)';
        }
    }

    /**
     * Aktualisiert nur die Textanzeige der Zeit.
     */
    updateTimeDisplay(currentTime, duration = null) {
         if (this.timeDisplay) {
             // Hole Dauer, falls nicht übergeben
             const currentDuration = duration ?? this.animationManager.getDuration();
             this.timeDisplay.textContent = `${currentTime.toFixed(2)}s / ${currentDuration.toFixed(2)}s`;
         }
    }

} // Ende class TimelinePanel

export default TimelinePanel;