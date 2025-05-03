// src/ControlsManager.js (Pivot-Ansatz Version)

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { tempBox, tempSize } from './utils.js'; // tempVec ggf. hinzufügen

// Hilfsmatrizen
const mat4 = new THREE.Matrix4(); // Wiederverwendbar
const vec3 = new THREE.Vector3(); // Wiederverwendbar

class ControlsManager {
    constructor(camera, domElement) { // Nimmt selectionManager nicht mehr im Konstruktor
        if (!camera || !domElement) { throw new Error("ControlsManager requires camera and domElement!"); }
        this.camera = camera;
        this.domElement = domElement;
        this.selectionManager = null; // Wird über Setter gesetzt
        this.scene = null; // Wird über init gesetzt

        this.orbitControls = null;
        this.transformControls = null;
        this.isDraggingGizmo = false;

        // --- Zustand für Pivot-Transformation ---
        this.isTransformingPivot = false;
        this.pivotTransformStart = new THREE.Matrix4();
        this.selectedObjectsAtPivotStart = []; // Speichert Referenzen auf ausgewählte Objekte
        this.objectDataAtPivotStart = new Map(); // {obj: {initialMatrixWorld}}

        // Methoden binden
        this.onDraggingChanged = this.onDraggingChanged.bind(this);
        this.onTransformStart = this.onTransformStart.bind(this);
        this.onTransformEnd = this.onTransformEnd.bind(this);
    }

    setSelectionManager(selectionManager) { // Wie vorher
        this.selectionManager = selectionManager;
        console.log("[ControlsManager] SelectionManager reference set.");
    }

    init(scene) { // Wie vorher
        this.scene = scene;
        console.log("[ControlsManager] Initializing...");
        // OrbitControls
        this.orbitControls = new OrbitControls(this.camera, this.domElement);
        this.orbitControls.enableDamping = true; this.orbitControls.dampingFactor = 0.1;
        console.log("[ControlsManager] OrbitControls initialized.");
        // TransformControls
        this.transformControls = new TransformControls(this.camera, this.domElement);
        this.transformControls.visible = false; this.transformControls.name = "TransformControlsGizmo"; this.transformControls.renderOrder = 999;
        // Listener
        this.transformControls.addEventListener('dragging-changed', this.onDraggingChanged);
        this.transformControls.addEventListener('mouseDown', this.onTransformStart);
        this.transformControls.addEventListener('mouseUp', this.onTransformEnd);
        if (this.scene) { this.scene.add(this.transformControls); console.log("[ControlsManager] TransformControls initialized..."); }
        else { console.error("[ControlsManager] Scene object not provided during init!"); }
    }

    onDraggingChanged(event) { // Wie vorher
        if (!this.orbitControls) return;
        const dragging = event.value;
        this.orbitControls.enabled = !dragging;
        this.isDraggingGizmo = dragging;
    }

    update(deltaTime) { // Wie vorher
        if (this.orbitControls?.enabled) { this.orbitControls.update(); }
    }

    // --- attach überarbeitet für Pivot ---
    attach(object) {
        const objectId = object?.name || object?.uuid || 'Unknown'; // Bessere Log-Info
        console.log(`[ControlsManager] Attaching TC to: ${objectId}`);
        if (!this.transformControls) { console.warn("Attach called but TC not initialized."); return; }
        if (!object) { console.warn("Attach called with null object."); this.detach(); return; }

        try {
            // Prüfe, ob eine Pivot-Transformation abgebrochen werden muss
             if (this.isTransformingPivot && this.transformControls.object !== object) {
                console.warn("[ControlsManager] Attach called while pivot transform was active! Resetting state.");
                this.resetPivotTransformState();
             }

            this.transformControls.attach(object);
            this.transformControls.visible = true;

            // --- GRÖSSE IMMER FIX SETZEN ---
            const desiredFixedSize = 1.0; // <<< Setze hier deine gewünschte feste Größe!
            this.transformControls.size = desiredFixedSize;
            // --- ENDE GRÖSSENÄNDERUNG ---

            // Log angepasst
            const targetType = (this.selectionManager && object === this.selectionManager.getPivotObject()) ? "Pivot" : "Object";
            console.log(`[ControlsManager] TC Attached to ${targetType}. Visible: true, Size: ${this.transformControls.size.toFixed(2)} (Fixed)`);

        } catch(e) {
             console.error(`[ControlsManager] Error attaching TC to ${objectId}:`, e);
             this.detach();
        }
    }

    // --- detach überarbeitet (einfacher) ---
    detach() {
        console.log("[ControlsManager] Detach requested.");
        // Breche laufende Pivot-Transformation ab, falls vorhanden
        if (this.isTransformingPivot) {
             console.warn("[ControlsManager] Detach called during pivot transform! Resetting state.");
             // Hier keine Transformation anwenden, da extern getriggert. Nur State resetten.
             this.resetPivotTransformState();
        }

        // Normales Detach
        if (this.transformControls) {
            if (this.transformControls.object) {
                 console.log("[ControlsManager] Performing actual detach.");
                this.transformControls.detach();
                this.transformControls.visible = false;
            } else {
                 this.transformControls.visible = false; // Sicherstellen, dass unsichtbar
            }
        }
        // OrbitControls ggf. aktivieren
        if (this.orbitControls && !this.isDraggingGizmo) {
             this.orbitControls.enabled = true;
        }
    }


    // --- NEUE onTransformStart (Pivot-Logik) ---
    onTransformStart(event) {
        if (!this.selectionManager) return; // SelectionManager benötigt

        const attachedObject = this.transformControls?.object;
        const pivotObject = this.selectionManager.getPivotObject(); // Holt das Pivot-Objekt

        // Prüfen, ob das angehängte Objekt der Pivot ist UND ob mehr als 1 Objekt ausgewählt ist
        if (attachedObject && attachedObject === pivotObject && this.selectionManager.getSelectedObjects().length > 1) {
            console.log("[ControlsManager] Pivot transform started.");
            this.isTransformingPivot = true;
            this.objectDataAtPivotStart.clear(); // Alte Daten löschen

            // Start-Weltmatrix des Pivots speichern
            pivotObject.updateMatrixWorld(true);
            this.pivotTransformStart.copy(pivotObject.matrixWorld);

            // Start-Daten für jedes aktuell ausgewählte Objekt speichern
            this.selectedObjectsAtPivotStart = [...this.selectionManager.getSelectedObjects()]; // Kopie der Auswahl
            this.selectedObjectsAtPivotStart.forEach(obj => {
                obj.updateMatrixWorld(true); // Aktuelle Weltmatrix holen
                this.objectDataAtPivotStart.set(obj, {
                    initialMatrixWorld: obj.matrixWorld.clone()
                    // OriginalParent wird nicht mehr benötigt, da wir nicht umhängen
                });
            });
            console.log(`[ControlsManager] Stored initial state for ${this.objectDataAtPivotStart.size} objects (Pivot).`);
        } else {
            // Keine Pivot-Transformation (Einzelauswahl oder Fehler)
            this.resetPivotTransformState(); // Zustand zurücksetzen
        }
    }

    // --- NEUE onTransformEnd (Pivot-Logik) ---
    onTransformEnd(event) {
         // Nur handeln, wenn wir eine Pivot-Transformation beenden
         if (!this.isTransformingPivot || !this.selectionManager || this.selectedObjectsAtPivotStart.length === 0) {
             // Flag nur zurücksetzen, wenn nötig
             if (this.isTransformingPivot) this.resetPivotTransformState();
             return;
         }

         console.log("[ControlsManager] Pivot transform ended. Applying delta transforms...");
         const pivot = this.transformControls.object; // Sollte der Pivot sein

         if (!pivot || this.objectDataAtPivotStart.size !== this.selectedObjectsAtPivotStart.length) {
              console.error("[ControlsManager] Pivot TransformEnd: Invalid state! Aborting.");
              this.resetPivotTransformState();
              if (this.transformControls?.object) this.detach(); // Nur detachen, wenn Pivot noch dran war
              // Kein Cleanup im SelectionManager nötig, da nichts geändert wurde
              return;
         }

         // Aktuelle Welt-Matrix des Pivots holen
         pivot.updateMatrixWorld(true);
         const pivotTransformEnd = pivot.matrixWorld;

         // Delta-Transformation des Pivots berechnen: T_delta = T_end * T_start^(-1)
         const pivotTransformStartInverse = this.pivotTransformStart.clone().invert();
         const deltaTransform = mat4.multiplyMatrices(pivotTransformEnd, pivotTransformStartInverse); // mat4 ist globale Hilfsmatrix

         // --- Gizmo hier optional detachen ODER durch nächsten selectionManager Call ---
         // this.detach(); // Optional: Sofort entfernen

         console.log(`[ControlsManager] Applying Pivot delta transform to ${this.selectedObjectsAtPivotStart.length} objects...`);
         try {
             // Iteriere über die Objekte, die bei START ausgewählt waren
             this.selectedObjectsAtPivotStart.forEach(obj => {
                 const storedData = this.objectDataAtPivotStart.get(obj);
                 if (!storedData || !storedData.initialMatrixWorld) {
                     console.warn("No initial data found for object:", obj.name);
                     return; // Nächstes Objekt
                 }
                 const initialMatrixWorld = storedData.initialMatrixWorld;

                 // --- DEBUG LOGGING PRO OBJEKT ---
                 // console.groupCollapsed(`Applying Pivot Delta to: ${obj.name || obj.uuid}`); ... console.groupEnd();

                 // 1. Neue ZIEL-Welt-Matrix berechnen: M_obj_world_new = T_delta_pivot * M_obj_world_start
                 const finalObjectMatrixWorld = new THREE.Matrix4().multiplyMatrices(deltaTransform, initialMatrixWorld);

                 // 2. KEIN Umhängen nötig! Parent bleibt gleich.

                 // 3. Lokale Matrix relativ zum ECHTEN Parent berechnen
                 const parent = obj.parent;
                 if (!parent) { console.warn("Object has no parent:", obj.name); return; } // Überspringen
                 parent.updateMatrixWorld(true);
                 const parentMatrixWorldInverse = parent.matrixWorld.clone().invert();
                 const finalObjectMatrixLocal = new THREE.Matrix4().multiplyMatrices(parentMatrixWorldInverse, finalObjectMatrixWorld);

                 // 4. Lokale Matrix anwenden und zerlegen
                 obj.matrixAutoUpdate = false;
                 obj.matrix.copy(finalObjectMatrixLocal);
                 obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
                 obj.matrixAutoUpdate = true;
                 obj.matrixWorldNeedsUpdate = true; // Sicherstellen, dass Weltmatrix neu berechnet wird

                 // Check auf ungültige Werte
                 if (!isFinite(obj.position.x) || !isFinite(obj.quaternion.x) || !isFinite(obj.scale.x) || isNaN(obj.position.x) || isNaN(obj.quaternion.x) || isNaN(obj.scale.x) ) {
                       console.error(`!!! Invalid transform result (Pivot approach) for ${obj.name || obj.uuid} !!!`);
                 }
             });
         } catch (applyError) {
              console.error("[ControlsManager] Error applying pivot delta transforms:", applyError);
         } finally {
             console.log("[ControlsManager] Finished applying pivot delta transforms.");
             // --- Zustand zurücksetzen ---
             this.resetPivotTransformState();
             // --- KEIN Aufruf an SelectionManager nötig für Cleanup der Gruppe ---
             // Optional: Gizmo detachen, falls nicht oben geschehen
             if (this.transformControls?.object === pivot) {
                  this.detach();
             }
             console.log("[ControlsManager] Pivot onTransformEnd finished.");
         }
    } // Ende onTransformEnd


    // Hilfsmethode zum Zurücksetzen des Pivot-Transform-Zustands
    resetPivotTransformState() {
        // console.log("[ControlsManager] Resetting pivot transform state.");
        this.isTransformingPivot = false;
        this.selectedObjectsAtPivotStart = [];
        this.objectDataAtPivotStart.clear();
        if (this.pivotTransformStart) {
            this.pivotTransformStart.identity();
        } else {
            this.pivotTransformStart = new THREE.Matrix4();
        }
    }

    // Getter (wie vorher)
    getTransformControls() { return this.transformControls; }
    getOrbitControls() { return this.orbitControls; }
    getAttachedObject() { return this.transformControls?.object || null; }

} // Ende class ControlsManager

export default ControlsManager;