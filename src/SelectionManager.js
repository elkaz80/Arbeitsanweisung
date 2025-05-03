// src/SelectionManager.js (KORRIGIERT)

import * as THREE from 'three';
import { hasInvalidTransform } from './utils'; // Importiere Hilfsfunktion

class SelectionManager {
    constructor(camera, scene, cssScene, domElement, controlsManager, uiManager, html3DManager) { // cssScene & html3DManager hinzugefügt
        if (!camera || !scene || !cssScene || !domElement || !controlsManager || !uiManager || !html3DManager) { // Alle Abhängigkeiten prüfen
             throw new Error("SelectionManager missing required arguments!");
        }
        this.camera = camera;
        this.scene = scene;
        this.cssScene = cssScene; // CSS Szene speichern
        this.domElement = domElement;
        this.controlsManager = controlsManager;
        this.uiManager = uiManager;
        this.html3DManager = html3DManager; // HTML Manager speichern

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.selectedObject = null;
        this.isPotentialClick = false;
        this.pointerDownPosition = new THREE.Vector2();
        this.pointerDownOnCanvas = false;

        // Bind 'this' für Event Handler
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
    }

    init() {
        console.log("[SelectionManager] Initializing...");
        // Listener nur auf Haupt-Canvas für 3D-Objekte
        this.domElement.addEventListener('pointerdown', this.onPointerDown, false);
        this.domElement.addEventListener('pointermove', this.onPointerMove, false);
        this.domElement.addEventListener('pointerup', this.onPointerUp, false);
        // HTML Klicks werden im HTML3DManager behandelt und rufen ggf. this.select() auf
        console.log("[SelectionManager] Event listeners added to canvas.");
    }

    // Wird für Klicks auf das 3D-Canvas (Hintergrund oder 3D-Objekte) aufgerufen
    onPointerDown(event) {
         // Ignoriere Klicks, die nicht direkt auf dem Canvas sind (z.B. auf UI-Overlays)
         if (event.target !== this.domElement) {
             this.pointerDownOnCanvas = false;
             return;
         }

         this.pointerDownOnCanvas = true;
         this.isPotentialClick = true;
         this.pointerDownPosition.set(event.clientX, event.clientY);
         let potentialSelection = null; // Lokale Variable für diesen Klick

         // Pointer-Koordinaten berechnen
         const rect = this.domElement.getBoundingClientRect();
         this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
         this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

         // Raycasting nur für 3D-Szene hier
         this.raycaster.setFromCamera(this.pointer, this.camera);
         const selectableObjects = [];
         this.scene.traverseVisible((obj) => { // Nur sichtbare Objekte prüfen
              // Gizmo und seine Teile ausschließen
              if (obj === this.controlsManager.getTransformControls() || obj.parent === this.controlsManager.getTransformControls()) {
                   return;
              }
              // Helpers, Lichter, Boden, Kamera etc. ausschließen
              if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) { // Typen, die wählbar sein sollen
                 // TestCube einschließen, falls vorhanden
                 if (obj.name === "TestCube" || !(obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper || obj instanceof THREE.Light || obj instanceof THREE.Camera || obj === this.cameraPivot || obj.name === "Floor")) {
                      if (!hasInvalidTransform(obj)) {
                           selectableObjects.push(obj);
                      }
                 }
              }
         });

        const intersects = this.raycaster.intersectObjects(selectableObjects, true); // true: Kinder prüfen

        if (intersects.length > 0) {
            let hitObject = intersects[0].object;
            // Zum "Hauptobjekt" hochgehen (direktes Kind der Szene oder benanntes Objekt)
             while (hitObject.parent && hitObject.parent !== this.scene && !hitObject.name ) {
                // Stoppen, wenn wir beim Gizmo landen würden
                if (hitObject.parent === this.controlsManager.getTransformControls()) {
                    hitObject = null; // Treffer ignorieren
                    break;
                }
                hitObject = hitObject.parent;
             }

             if (hitObject && hitObject !== this.scene) {
                potentialSelection = hitObject; // Objekt als potenzielle Auswahl merken
                console.log("[SelectionManager] Marked potential (3D):", potentialSelection.name || potentialSelection.uuid);
                event.stopPropagation(); // Verhindert OrbitControls-Start bei Klick auf Objekt
            }
        } else {
            console.log("[SelectionManager] Hit background (3D).");
            // Kein stopPropagation, OrbitControls soll bei Hintergrundklick starten
        }
         this.potentialSelection = potentialSelection; // Im Manager speichern (kann auch null sein)
    }

    onPointerMove(event) {
        // Wenn Maus bei gedrückter Taste signifikant bewegt wird -> kein Klick mehr
        if (this.pointerDownOnCanvas && this.isPotentialClick && event.buttons > 0 &&
            this.pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) {
            // console.log("[SelectionManager] Drag detected, cancelling click.");
            this.isPotentialClick = false;
            this.potentialSelection = null; // Auswahl bei Drag verwerfen
        }
    }

    onPointerUp(event) {
        if (!this.pointerDownOnCanvas) return; // Nur reagieren, wenn Down auf Canvas war

        // Nur ausführen, wenn es ein Klick war (kein Drag) UND der Gizmo nicht aktiv war
        if (this.isPotentialClick && !this.controlsManager.isDraggingGizmo) {
             console.log(`[SelectionManager] PointerUp - Potential Click. Target: ${this.potentialSelection?.name || this.potentialSelection?.uuid || 'Background'}`);
             // Rufe die zentrale select-Methode auf (wählt Objekt oder null aus)
            this.select(this.potentialSelection);
        }
        // Reset für den nächsten Klick/Drag
        this.pointerDownOnCanvas = false;
        this.isPotentialClick = false;
        this.potentialSelection = null; // Wichtig: Zurücksetzen
    }

    // Zentrale Methode zur Auswahl (wird von onPointerUp und HTML3DManager aufgerufen)
    select(objectToSelect) {
        // Verhindere Auswahl des Gizmos selbst
        if (objectToSelect === this.controlsManager.getTransformControls() ||
            objectToSelect?.parent === this.controlsManager.getTransformControls()) {
            console.log("[SelectionManager] Prevented selecting TransformControls gizmo.");
            return;
        }
        // Verhindere Auswahl von Objekten mit ungültigen Transformationen
        if (objectToSelect && hasInvalidTransform(objectToSelect)) {
             console.warn(`[SelectionManager] Prevented selecting invalid object: ${objectToSelect.name || objectToSelect.uuid}`);
             return;
        }

        const currentSelectionName = this.selectedObject?.name || this.selectedObject?.uuid || 'null';
        const newSelectionName = objectToSelect?.name || objectToSelect?.uuid || 'null';
        console.log(`[SelectionManager] select() called. New: ${newSelectionName}, Current: ${currentSelectionName}`);

        if (this.selectedObject === objectToSelect) {
             console.log("[SelectionManager] Object already selected.");
             return; // Keine Änderung nötig
        }

        // Altes Objekt deselektieren (falls vorhanden)
        if (this.selectedObject) {
            console.log(`[SelectionManager] Deselecting old: ${currentSelectionName}`);
            this.html3DManager?.setElementInteractivity(this.selectedObject, true); // HTML wieder klickbar machen
            // restoreObjectOpacity(this.selectedObject); // Opazität (später)
            this.controlsManager.detach(); // Gizmo entfernen
        }

        // Neues Objekt auswählen
        this.selectedObject = objectToSelect;

        if (this.selectedObject) {
            console.log(`[SelectionManager] Selecting new: ${newSelectionName}`);
            this.controlsManager.attach(this.selectedObject); // Gizmo anhängen (inkl. size/visible)
            this.html3DManager?.setElementInteractivity(this.selectedObject, false); // HTML nicht klickbar machen
            // setObjectOpacity(this.selectedObject, 0.5, true); // Opazität (später)
        } else {
            console.log("[SelectionManager] Deselected all.");
        }

        // UI immer aktualisieren, um Highlight zu ändern/entfernen
        this.uiManager?.updateSelectionHighlight(this.selectedObject);
        // Objektliste nur aktualisieren, wenn sich die Liste der Objekte ändert (Laden/Löschen)
        // this.uiManager?.updateObjectList(this.scene);

        console.log("[SelectionManager] select() finished. Final selected:", this.selectedObject ? newSelectionName : "None");
    }

    // Explizite Deselektion von außen (z.B. Escape-Taste)
    deselect() {
        this.select(null);
    }

    getSelectedObject() {
        return this.selectedObject;
    }
} // Ende der Klasse SelectionManager

export default SelectionManager; // Export am Ende