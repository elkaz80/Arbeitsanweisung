import * as THREE from 'three'; // <-- Import hinzugefügt
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { tempBox, tempSize } from './utils.js'; // Importiere Hilfsvariablen

class ControlsManager {
    constructor(camera, domElement) {
        if (!camera || !domElement) {
            throw new Error("ControlsManager requires camera and domElement!");
        }
        this.camera = camera;
        this.domElement = domElement;
        this.orbitControls = null;
        this.transformControls = null;
        this.isDraggingGizmo = false;

        this.onDraggingChanged = this.onDraggingChanged.bind(this);
    }

    init(scene) { // Szene übergeben, um TransformControls hinzuzufügen
        console.log("[ControlsManager] Initializing...");
        // OrbitControls
        this.orbitControls = new OrbitControls(this.camera, this.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.1;
        this.orbitControls.target.set(0, 0, 0); // Initiales Ziel
        console.log("[ControlsManager] OrbitControls initialized.");

        // TransformControls
        this.transformControls = new TransformControls(this.camera, this.domElement);
        this.transformControls.visible = false;
        this.transformControls.size = 1;
        this.transformControls.name = "TransformControlsGizmo"; // Name zur Identifikation
        this.transformControls.renderOrder = 999; // Hohe Render Order

        // Listener hinzufügen
        this.transformControls.addEventListener('dragging-changed', this.onDraggingChanged);

        // TransformControls zur Szene hinzufügen (notwendig für Rendering & Interaktion)
        if (scene) {
             scene.add(this.transformControls);
             console.log("[ControlsManager] TransformControls initialized, listener added, and added to scene.");
        } else {
            console.error("[ControlsManager] Scene object not provided during init! TransformControls might not render.");
        }
    }

    onDraggingChanged(event) {
        if (!this.orbitControls) return; // Safety check
        console.log(`[ControlsManager] dragging-changed: dragging=${event.value}, OrbitControls=${this.orbitControls.enabled}`);
        this.orbitControls.enabled = !event.value;
        this.isDraggingGizmo = event.value;
        console.log(`[ControlsManager] new OrbitControls=${this.orbitControls.enabled}, isDraggingGizmo=${this.isDraggingGizmo}`);
        // Keyframe Logic wird extern behandelt
    }

    update(deltaTime) {
        if (this.orbitControls?.enabled) { // Prüfen ob orbitControls existiert und enabled ist
            this.orbitControls.update();
        }
        // TC Update nicht nötig hier
    }

    attach(object) {
        console.log(`[ControlsManager] Attaching TC to: ${object?.name || object?.uuid}`);
        if (this.transformControls && object) {
            try {
                this.transformControls.attach(object);
                this.transformControls.visible = true;
                this.calculateGizmoSize(object);
                console.log(`[ControlsManager] TC Attached. Visible: ${this.transformControls.visible}, Size: ${this.transformControls.size.toFixed(2)}`);
            } catch(e) {
                 console.error(`[ControlsManager] Error attaching TC to ${object?.name || object?.uuid}:`, e);
                 this.detach(); // Versuch, bei Fehler zu detachen
            }
        } else {
             console.warn("[ControlsManager] Attach called with no object or TC not initialized.");
        }
    }

    detach() {
        console.log("[ControlsManager] Detaching TC.");
        if (this.transformControls) {
            this.transformControls.detach();
            this.transformControls.visible = false;
            this.transformControls.size = 1;
        }
        if (this.orbitControls && !this.isDraggingGizmo) {
             this.orbitControls.enabled = true;
             console.log("[ControlsManager] OrbitControls enabled on detach.");
        }
    }

    calculateGizmoSize(object) {
        if (!this.transformControls || !object) return;
        try {
            tempBox.setFromObject(object, true);
            if (!tempBox.isEmpty() && isFinite(tempBox.min.x) && isFinite(tempBox.max.x)) {
                tempBox.getSize(tempSize);
                const maxDim = Math.max(tempSize.x, tempSize.y, tempSize.z);
                if (maxDim > 0 && isFinite(maxDim)) {
                    const scaleFactor = 0.2;
                    this.transformControls.size = Math.max(0.1, maxDim * scaleFactor);
                } else { this.transformControls.size = 1; }
            } else { this.transformControls.size = 1; }
        } catch (e) {
            console.error("[ControlsManager] BBox Error:", e);
            this.transformControls.size = 1;
        }
    }

    getTransformControls() { return this.transformControls; }
    getOrbitControls() { return this.orbitControls; }
}

export default ControlsManager;