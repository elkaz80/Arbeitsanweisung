// src/SelectionManager.js (Pivot-Ansatz Version)

import * as THREE from 'three';
import { hasInvalidTransform, tempBox, tempVec } from './utils'; // tempVec für Zentrumsberechnung

class SelectionManager {
    constructor(camera, scene, cssScene, domElement, controlsManager, uiManager, html3DManager) {
        // Abhängigkeitsprüfung (wie vorher)
        if (!camera || !scene || !domElement || !controlsManager || !uiManager ) {
             console.error("SelectionManager missing required arguments!", {camera, scene, cssScene, domElement, controlsManager, uiManager, html3DManager});
             throw new Error("SelectionManager missing required arguments!");
        }
        this.camera = camera;
        this.scene = scene;
        this.cssScene = cssScene;
        this.domElement = domElement;
        this.controlsManager = controlsManager;
        this.uiManager = uiManager;
        this.html3DManager = html3DManager;

        // Interne Zustände (wie vorher)
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.selectedObjects = [];
        this.hoveredObject = null;
        this.isPotentialClick = false;
        this.pointerDownPosition = new THREE.Vector2();
        this.pointerDownOnCanvas = false;
        this.potentialSelection = null;

        // Konfiguration (wie vorher)
        this.dragThreshold = 8;

        // Highlighting & Hover (wie vorher, mit Fixes)
        this.originalMaterialStates = new Map();
        this.highlightOptions = { opacity: 0.5, emissiveColor: 0x87ceeb };
        this.originalMaterialStatesForHover = new Map();
        this.hoverOptions = { emissiveColor: 0xaaaaaa };

        // --- Pivot-Objekt statt Gruppe ---
        this.pivotObject = new THREE.Object3D();
        this.pivotObject.name = 'MultiSelectPivot';
        this.pivotObject.visible = false; // Pivot selbst ist unsichtbar
        this.scene.add(this.pivotObject); // Pivot permanent zur Szene hinzufügen
        // --- Ende Pivot ---

        // Methoden binden (Listener)
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
    }

    init() { // Wie vorher
        console.log("[SelectionManager] Initializing (using Pivot Object approach)...");
        this.domElement.addEventListener('pointerdown', this.onPointerDown, false);
        this.domElement.addEventListener('pointermove', this.onPointerMove, false);
        this.domElement.addEventListener('pointerup', this.onPointerUp, false);
        console.log("[SelectionManager] Event listeners added to canvas.");
    }

    // onPointerDown, onPointerMove, onPointerUp (Angepasst: Ignoriere Pivot beim Raycasting)
    onPointerDown(event) {
        if (event.target !== this.domElement) { /*...*/ return; }
        this.pointerDownOnCanvas = true;
        if (this.hoveredObject) { this.removeHoverEffect(this.hoveredObject); this.hoveredObject = null; }
        this.isPotentialClick = true; this.pointerDownPosition.set(event.clientX, event.clientY); this.potentialSelection = null;
        const rect = this.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const selectableObjects = [];
        this.scene.traverseVisible((obj) => {
            // Ignoriere Pivot und Gizmo etc.
            if (obj === this.controlsManager.getTransformControls() ||
                obj.parent === this.controlsManager.getTransformControls() ||
                obj === this.pivotObject || // <-- Pivot ignorieren
                obj.isLight || obj.isCamera || /* ...Rest wie vorher... */
                obj.name === "Floor" || (this.appManager && obj === this.appManager.getCameraPivot()))
            { return; }
            if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) {
                if (!hasInvalidTransform(obj)) { selectableObjects.push(obj); }
            }
        });
        const intersects = this.raycaster.intersectObjects(selectableObjects, true);
        if (intersects.length > 0) { /* Parent/Kind Logik wie vorher */
            let hitObject = intersects[0].object; let targetObject = null;
            if (event.altKey) { targetObject = hitObject; } else { let pc = hitObject; while(pc.parent && pc.parent !== this.scene && !pc.name){ pc=pc.parent; } targetObject = pc; }
            if (targetObject === this.pivotObject) targetObject = null; // Wichtig
            this.potentialSelection = targetObject;
            if (this.potentialSelection) { event.stopPropagation(); }
        } else { this.potentialSelection = null; }
    }

    onPointerMove(event) {
        if (this.pointerDownOnCanvas && this.isPotentialClick && event.buttons > 0 && /* Drag Check */ this.pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > this.dragThreshold) { this.isPotentialClick = false; this.potentialSelection = null; }
        if (event.buttons === 0) { // Hover Check
             const rect = this.domElement.getBoundingClientRect(); this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
             this.raycaster.setFromCamera(this.pointer, this.camera); const selectableObjects = [];
             this.scene.traverseVisible((obj) => { // Filter wie in onPointerDown (Pivot ignorieren)
                  if (obj === this.controlsManager.getTransformControls() || obj.parent === this.controlsManager.getTransformControls() || obj === this.pivotObject || obj.isLight || obj.isCamera || obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper || obj.name === "Floor" || (this.appManager && obj === this.appManager.getCameraPivot())) { return; }
                   if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) { if (!hasInvalidTransform(obj)) { selectableObjects.push(obj); } }
             });
             const intersects = this.raycaster.intersectObjects(selectableObjects, true); let targetHoverObject = null;
             if (intersects.length > 0) { /* Parent/Kind Logik wie vorher */
                 let hitObject = intersects[0].object; if (event.altKey) { targetHoverObject = hitObject; } else { let pc = hitObject; while(pc.parent && pc.parent !== this.scene && !pc.name){ pc=pc.parent; } targetHoverObject = pc; }
                 if (targetHoverObject === this.pivotObject) targetHoverObject = null; // Wichtig
             }
             if (targetHoverObject !== this.hoveredObject) { /* apply/remove Hover wie vorher */
                 if (this.hoveredObject && !this.selectedObjects.includes(this.hoveredObject)) { this.removeHoverEffect(this.hoveredObject); }
                 if (targetHoverObject && !this.selectedObjects.includes(targetHoverObject)) { this.applyHoverEffect(targetHoverObject); }
                 this.hoveredObject = targetHoverObject;
             }
         }
    }

    onPointerUp(event) { // Wie vorher
        if (!this.pointerDownOnCanvas) return;
        if (this.isPotentialClick && !this.controlsManager.isDraggingGizmo) {
             const target = this.potentialSelection; const isModifierPressed = event.shiftKey || event.ctrlKey || event.metaKey;
             this.updateSelection(target, isModifierPressed);
        }
        this.pointerDownOnCanvas = false; this.isPotentialClick = false; this.potentialSelection = null;
    }

    updateSelection(targetObject, isModifierPressed) { // Wie vorher
         console.log(`[SelectionManager] updateSelection. Target: ${targetObject?.name || targetObject?.uuid || 'Background'}, Modifier: ${isModifierPressed}`);
         const previouslySelected = [...this.selectedObjects];
         // Auswahl-Logik (Normaler Klick vs. Modifier Klick)
         if (!isModifierPressed) { /*...*/ } else { /*...*/ }
         // --- (Code für Auswahl-Logik wie in deiner letzten funktionierenden Version einfügen) ---
          // --- Beispiel (gekürzt): ---
          if (!isModifierPressed) {
               previouslySelected.forEach(obj => this.removeHighlight(obj)); this.originalMaterialStates.clear();
               if (targetObject) { this.selectedObjects = [targetObject]; this.applyHighlight(targetObject); console.log(`Selected single: ${targetObject.name || targetObject.uuid}`); }
               else { this.selectedObjects = []; console.log("Deselected all"); }
          } else { if (targetObject) { const index = this.selectedObjects.findIndex(obj => obj === targetObject); if (index > -1) { this.removeHighlight(targetObject); this.selectedObjects.splice(index, 1); console.log(`Deselected (modifier): ${targetObject.name || targetObject.uuid}`); } else { this.selectedObjects.push(targetObject); this.applyHighlight(targetObject); console.log(`Added to selection (modifier): ${targetObject.name || targetObject.uuid}`); } } }


         // Gizmo und UI aktualisieren
         try { this.updateAttachedControls(); } catch (e) { console.error("Error calling updateAttachedControls:", e); }
         this.uiManager?.updateSelectionHighlight(this.selectedObjects);
         this.updateHtmlInteractivity(previouslySelected);
    }

    updateHtmlInteractivity(previouslySelected) { // Wie vorher
        if (!this.html3DManager?.setElementInteractivity) return;
        const allAffectedObjects = new Set([...previouslySelected, ...this.selectedObjects]);
        allAffectedObjects.forEach(obj => { if (obj) { const isCurrentlySelected = this.selectedObjects.includes(obj); this.html3DManager.setElementInteractivity(obj, !isCurrentlySelected); } });
     }


    // --- updateAttachedControls STARK überarbeitet ---
    /**
     * Aktualisiert den Gizmo: Hängt ihn an Einzelauswahl oder an den Pivot bei Mehrfachauswahl.
     */
    updateAttachedControls() {
        const selectionCount = this.selectedObjects.length;
        const currentlyAttached = this.controlsManager.getAttachedObject();

        if (selectionCount === 0) { // Nichts ausgewählt
            if (currentlyAttached) { // Wenn überhaupt etwas angehängt war
                this.controlsManager.detach();
                console.log("[SelectionManager] Detached controls (no selection).");
            }
            this.pivotObject.visible = false; // Pivot sicherheitshalber ausblenden
        }
        else if (selectionCount === 1) { // Einzelauswahl
            const singleObject = this.selectedObjects[0];
             this.pivotObject.visible = false; // Pivot ausblenden
            if (currentlyAttached !== singleObject) { // Nur anhängen, wenn nötig
                 this.removeHoverEffect(singleObject); // Hover entfernen
                 this.controlsManager.attach(singleObject);
                 console.log("[SelectionManager] Attached controls to single object:", singleObject.name || singleObject.uuid);
            }
        }
        else { // Mehrfachauswahl (selectionCount > 1)
            console.log(`[SelectionManager] Attaching controls to Pivot for multi-select (${selectionCount} objects)...`);
            // 1. Mittelpunkt berechnen
            const combinedBox = tempBox.makeEmpty();
            let validObjectsInBox = 0;
            this.selectedObjects.forEach(obj => { /* BBox Logik wie vorher */
                const objBox = new THREE.Box3().setFromObject(obj, true);
                if (!objBox.isEmpty() && isFinite(objBox.min.x) && isFinite(objBox.max.x)) { combinedBox.union(objBox); validObjectsInBox++; }
                else { combinedBox.expandByPoint(obj.getWorldPosition(tempVec)); validObjectsInBox++; }
            });
            if (combinedBox.isEmpty() || validObjectsInBox === 0) { console.error("Cannot calculate center for Pivot."); this.controlsManager.detach(); return; }
            const center = combinedBox.getCenter(tempVec);

            // 2. Pivot positionieren und konfigurieren
            this.pivotObject.position.copy(center);
            this.pivotObject.rotation.set(0, 0, 0);
            this.pivotObject.scale.set(1, 1, 1);
            this.pivotObject.visible = false; // Pivot selbst bleibt unsichtbar
            this.pivotObject.updateMatrixWorld(true);

            // 3. Gizmo an Pivot hängen (nur wenn nicht schon dran)
            if (currentlyAttached !== this.pivotObject) {
                this.controlsManager.attach(this.pivotObject);
                console.log("[SelectionManager] Attached controls to Pivot object.");
            }
        }
    } // Ende updateAttachedControls


    // --- detachAndCleanupMultiGroup Methode komplett ENTFERNT ---


    // --- Hover und Highlight Methoden (mit Fixes von letzter Version) ---
    applyHighlight(object) { // Version MIT Hover-Bereinigung
        if (!object) return;
        object.traverse((child) => { if ((child.isMesh || child.isLine || child.isPoints) && child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(material => { if (material) { if (!material.uuid) material.uuid = THREE.MathUtils.generateUUID(); if (!this.originalMaterialStates.has(material.uuid)) { let originalEmissiveValue = material.emissive?.getHex() ?? 0x000000; const hoverState = this.originalMaterialStatesForHover.get(material.uuid); if (hoverState) { originalEmissiveValue = hoverState.emissive; } this.originalMaterialStates.set(material.uuid, { opacity: material.opacity ?? 1.0, transparent: material.transparent ?? false, emissive: originalEmissiveValue, }); } material.transparent = true; material.opacity = this.highlightOptions.opacity; if(material.emissive) { material.emissive.setHex(this.highlightOptions.emissiveColor); } material.needsUpdate = true; } }); } });
         if (object === this.hoveredObject) { this.removeHoverEffect(this.hoveredObject); this.hoveredObject = null; } else if (this.originalMaterialStatesForHover.size > 0) { this.originalMaterialStatesForHover.clear(); }
    }

    removeHighlight(object) { // Version von vorher (ohne clearMap Flag)
        if (!object) return;
        object.traverse((child) => { if ((child.isMesh || child.isLine || child.isPoints) && child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(material => { if (material && material.uuid && this.originalMaterialStates.has(material.uuid)) { let isUsed = false; for(const otherObj of this.selectedObjects) { if (otherObj !== object && !isUsed) { otherObj.traverse((otherChild) => { if((otherChild.isMesh||otherChild.isLine||otherChild.isPoints) && otherChild.material){ const oms = Array.isArray(otherChild.material)?otherChild.material:[otherChild.material]; if(oms.some(m=>m&&m.uuid===material.uuid)){ isUsed=true; } } }); } } if (!isUsed) { const state = this.originalMaterialStates.get(material.uuid); material.opacity = state.opacity; material.transparent = state.transparent; if (material.emissive) { material.emissive.setHex(state.emissive); } material.needsUpdate = true; this.originalMaterialStates.delete(material.uuid); } } }); } });
    }

    applyHoverEffect(object) { // Version OHNE clear() am Anfang
        if (!object || this.selectedObjects.includes(object)) return;
        object.traverse((child) => { if ((child.isMesh || child.isLine || child.isPoints) && child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(material => { if (material && material.emissive) { if (!material.uuid) material.uuid = THREE.MathUtils.generateUUID(); if (!this.originalMaterialStatesForHover.has(material.uuid)) { this.originalMaterialStatesForHover.set(material.uuid, { emissive: material.emissive.getHex() }); } material.emissive.setHex(this.hoverOptions.emissiveColor); material.needsUpdate = true; } }); } });
    }

    removeHoverEffect(object) { // Version von vorher
          if (!object || this.originalMaterialStatesForHover.size === 0) return;
          if (this.selectedObjects.includes(object)) { this.originalMaterialStatesForHover.clear(); return; }
          object.traverse((child) => { if ((child.isMesh || child.isLine || child.isPoints) && child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(material => { if (material && material.uuid && this.originalMaterialStatesForHover.has(material.uuid) && material.emissive) { const state = this.originalMaterialStatesForHover.get(material.uuid); material.emissive.setHex(state.emissive); material.needsUpdate = true; } }); } });
          this.originalMaterialStatesForHover.clear();
     }

    // Getter/Setter (wie vorher)
    deselectAll() { this.updateSelection(null, false); }
    getSelectedObjects() { return this.selectedObjects; }
    getSingleSelectedObject() { return this.selectedObjects[0] || null; }
    // NEU: Getter für Pivot (falls ControlsManager ihn braucht)
    getPivotObject() { return this.pivotObject; }

} // Ende class SelectionManager

export default SelectionManager;