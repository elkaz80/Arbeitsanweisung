// src/SelectionManager.js (Angepasst für Phase 2 ControlsManager & Hover/Highlight Fix)

import * as THREE from 'three';
// Importiere die benötigten Hilfsobjekte und Funktionen aus utils.js
import { hasInvalidTransform, tempBox, tempVec } from './utils';

class SelectionManager {
    constructor(camera, scene, cssScene, domElement, controlsManager, uiManager, html3DManager) {
        // Abhängigkeitsprüfung
        if (!camera || !scene || !domElement || !controlsManager || !uiManager ) {
             console.error("SelectionManager missing required arguments!", {camera, scene, cssScene, domElement, controlsManager, uiManager, html3DManager});
             throw new Error("SelectionManager missing required arguments! Check console for details.");
        }
        this.camera = camera;
        this.scene = scene;
        this.cssScene = cssScene;
        this.domElement = domElement;
        this.controlsManager = controlsManager; // Benötigt für getAttachedObject() etc.
        this.uiManager = uiManager;
        this.html3DManager = html3DManager;

        // Interne Zustände
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.selectedObjects = []; // Array für Multi-Selektion
        this.hoveredObject = null;
        this.isPotentialClick = false;
        this.pointerDownPosition = new THREE.Vector2();
        this.pointerDownOnCanvas = false;
        this.potentialSelection = null;

        // Konfiguration
        this.dragThreshold = 8;

        // Zustand und Optionen für Highlighting (Auswahl)
        this.originalMaterialStates = new Map(); // { materialUUID: { originalState } }
        this.highlightOptions = {
            opacity: 0.5,
            emissiveColor: 0x87ceeb,
        };

        // Zustand und Optionen für Hover-Effekt
        this.originalMaterialStatesForHover = new Map(); // Temporärer Speicher für Hover
        this.hoverOptions = {
            emissiveColor: 0xaaaaaa,
        };

        // Methoden binden (Nur Listener!)
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        // Multi-Selektion State
        this.multiSelectionGroup = new THREE.Group();
        this.multiSelectionGroup.name = 'MultiSelect_Gizmo_Group';
        this.originalParents = new Map(); // { object: originalParent }
        this.isMultiSelectActive = false;

        // Kein .bind() für interne Methoden nötig
    }

    /**
     * Initialisiert den SelectionManager durch Hinzufügen der Event Listener.
     */
    init() {
        console.log("[SelectionManager] Initializing (with multi-selection)...");
        this.domElement.addEventListener('pointerdown', this.onPointerDown, false);
        this.domElement.addEventListener('pointermove', this.onPointerMove, false);
        this.domElement.addEventListener('pointerup', this.onPointerUp, false);
        console.log("[SelectionManager] Event listeners added to canvas.");
    }

    /**
     * Behandelt das 'pointerdown'-Event auf dem Canvas.
     */
    onPointerDown(event) {
        if (event.target !== this.domElement) { this.pointerDownOnCanvas = false; return; }
        this.pointerDownOnCanvas = true;

        // Aktuellen Hover-Effekt entfernen, BEVOR Raycasting etc. stattfindet
        if (this.hoveredObject) {
            // Wichtig: removeHoverEffect prüft intern, ob Objekt selektiert ist
            this.removeHoverEffect(this.hoveredObject);
            this.hoveredObject = null;
        }

        this.isPotentialClick = true;
        this.pointerDownPosition.set(event.clientX, event.clientY);
        this.potentialSelection = null;

        const rect = this.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);
        const selectableObjects = [];
        this.scene.traverseVisible((obj) => {
            // Ignoriere nicht auswählbare Objekte (Gizmo, Gruppe, Hilfsobjekte etc.)
            if (obj === this.controlsManager.getTransformControls() ||
                obj.parent === this.controlsManager.getTransformControls() ||
                obj === this.multiSelectionGroup ||
                obj.isLight || obj.isCamera ||
                obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper ||
                obj.name === "Floor" ||
                (this.appManager && obj === this.appManager.getCameraPivot())) // appManager muss verfügbar sein
            { return; }
            if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) {
                if (!hasInvalidTransform(obj)) { selectableObjects.push(obj); }
            }
        });

        const intersects = this.raycaster.intersectObjects(selectableObjects, true);
        if (intersects.length > 0) {
            let hitObject = intersects[0].object;
            let targetObject = null;
            if (event.altKey) { targetObject = hitObject; }
            else { /* Parent-Logik */
                let pc = hitObject;
                while (pc.parent && pc.parent !== this.scene && !pc.name) { pc = pc.parent; }
                targetObject = pc;
            }
             if (targetObject === this.multiSelectionGroup) targetObject = null; // Wichtig
            this.potentialSelection = targetObject;
            if (this.potentialSelection) { event.stopPropagation(); } // Verhindert Orbit bei Klick auf Objekt
        } else {
            this.potentialSelection = null; // Hintergrund getroffen
        }
    } // Ende onPointerDown

    /**
     * Behandelt das 'pointermove'-Event. (OHNE die detaillierten Hover-Logs)
     */
    onPointerMove(event) {
         // 1. Drag-Erkennung
         if (this.pointerDownOnCanvas && this.isPotentialClick && event.buttons > 0 &&
             this.pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > this.dragThreshold) {
             this.isPotentialClick = false;
             this.potentialSelection = null;
         }

         // 2. Hover-Effekt (nur wenn keine Maustaste gedrückt)
         if (event.buttons === 0) {
             const rect = this.domElement.getBoundingClientRect();
             this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
             this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

             this.raycaster.setFromCamera(this.pointer, this.camera);
             const selectableObjects = [];
             this.scene.traverseVisible((obj) => { // Filter wie in onPointerDown
                  if (obj === this.controlsManager.getTransformControls() ||
                      obj.parent === this.controlsManager.getTransformControls() ||
                      obj === this.multiSelectionGroup ||
                      obj.isLight || obj.isCamera ||
                      obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper ||
                      obj.name === "Floor" ||
                      (this.appManager && obj === this.appManager.getCameraPivot()))
                  { return; }
                   if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) {
                       if (!hasInvalidTransform(obj)) { selectableObjects.push(obj); }
                   }
             });

             const intersects = this.raycaster.intersectObjects(selectableObjects, true);
             let targetHoverObject = null;
             if (intersects.length > 0) { // Parent/Kind Logik für Hover
                 let hitObject = intersects[0].object;
                 if (event.altKey) { targetHoverObject = hitObject; }
                 else { let pc = hitObject; while(pc.parent && pc.parent !== this.scene && !pc.name){ pc=pc.parent; } targetHoverObject = pc; }
                 if (targetHoverObject === this.multiSelectionGroup) targetHoverObject = null;
             }

             // Hover-Effekt aktualisieren
             if (targetHoverObject !== this.hoveredObject) {
                 // Alten Hover entfernen (wenn nötig)
                 if (this.hoveredObject && !this.selectedObjects.includes(this.hoveredObject)) {
                     this.removeHoverEffect(this.hoveredObject);
                 }
                 // Neuen Hover anwenden (wenn nötig)
                 if (targetHoverObject && !this.selectedObjects.includes(targetHoverObject)) {
                     this.applyHoverEffect(targetHoverObject);
                 }
                 this.hoveredObject = targetHoverObject; // Zustand aktualisieren
             }
         } // Ende Hover-Effekt-Logik
    } // Ende onPointerMove

    /**
     * Behandelt das 'pointerup'-Event.
     */
    onPointerUp(event) {
        if (!this.pointerDownOnCanvas) return;
        // Nur handeln, wenn Klick (kein Drag) UND Gizmo nicht bewegt wird
        if (this.isPotentialClick && !this.controlsManager.isDraggingGizmo) {
             const target = this.potentialSelection;
             const isModifierPressed = event.shiftKey || event.ctrlKey || event.metaKey;
             this.updateSelection(target, isModifierPressed); // Auswahl aktualisieren
        }
        // Zustände zurücksetzen
        this.pointerDownOnCanvas = false;
        this.isPotentialClick = false;
        this.potentialSelection = null;
    } // Ende onPointerUp

    /**
     * Aktualisiert die Auswahl.
     */
    updateSelection(targetObject, isModifierPressed) {
         console.log(`[SelectionManager] updateSelection. Target: ${targetObject?.name || targetObject?.uuid || 'Background'}, Modifier: ${isModifierPressed}`);
         const previouslySelected = [...this.selectedObjects];

         // Auswahl-Logik (Normaler Klick vs. Modifier Klick)
         if (!isModifierPressed) {
             previouslySelected.forEach(obj => this.removeHighlight(obj)); // Alte Highlights entfernen
             this.originalMaterialStates.clear(); // Nur bei komplett neuer Auswahl leeren
             if (targetObject) {
                 this.selectedObjects = [targetObject];
                 this.applyHighlight(targetObject); // Neues Highlight
                 console.log(`[SelectionManager] Selected single: ${targetObject.name || targetObject.uuid}`);
             } else {
                 this.selectedObjects = []; // Auswahl leeren
                 console.log("[SelectionManager] Deselected all (background click)");
             }
         } else { // Modifier Klick
             if (targetObject) {
                 const index = this.selectedObjects.findIndex(obj => obj === targetObject);
                 if (index > -1) { // Toggle: Entfernen
                     this.removeHighlight(targetObject); // Highlight entfernen
                     this.selectedObjects.splice(index, 1);
                     console.log(`[SelectionManager] Deselected (modifier): ${targetObject.name || targetObject.uuid}`);
                 } else { // Hinzufügen
                     this.selectedObjects.push(targetObject);
                     this.applyHighlight(targetObject); // Highlight anwenden
                     console.log(`[SelectionManager] Added to selection (modifier): ${targetObject.name || targetObject.uuid}`);
                 }
             } // Klick auf Hintergrund mit Modifier -> Nichts tun
         }

         // Gizmo und UI aktualisieren
         try {
              this.updateAttachedControls();
         } catch (e) { console.error("[SelectionManager] Error calling updateAttachedControls:", e); /*...*/ }
         this.uiManager?.updateSelectionHighlight(this.selectedObjects);
         this.updateHtmlInteractivity(previouslySelected);
    } // Ende updateSelection

    /**
     * Aktualisiert HTML Interaktivität.
     */
    updateHtmlInteractivity(previouslySelected) { // Wie vorher
        if (!this.html3DManager?.setElementInteractivity) return;
        const allAffectedObjects = new Set([...previouslySelected, ...this.selectedObjects]);
        allAffectedObjects.forEach(obj => {
            if (obj) {
                const isCurrentlySelected = this.selectedObjects.includes(obj);
                this.html3DManager.setElementInteractivity(obj, !isCurrentlySelected);
            }
        });
     }

    /**
     * Aktualisiert den Gizmo. (Mit Korrektur für Abfrage des angehängten Objekts)
     */
    updateAttachedControls() {
        const selectionCount = this.selectedObjects.length;

        if (selectionCount === 0) { // Nichts ausgewählt
            // console.log("[SelectionManager] updateAttachedControls: selectionCount is 0."); // Log entfernt
            if (this.isMultiSelectActive) {
                // console.log("[SelectionManager] Deselecting: Multi-select WAS active..."); // Log entfernt
                this.detachAndCleanupMultiGroup();
            } else {
                // console.log("[SelectionManager] Deselecting: Multi-select was NOT active."); // Log entfernt
                // --- Korrigierte Prüfung ---
                const currentlyAttachedObject = this.controlsManager.getAttachedObject();
                // console.log("[SelectionManager] Checking controlsManager.getAttachedObject():", currentlyAttachedObject); // Log entfernt
                if (currentlyAttachedObject) {
                     // console.log("[SelectionManager] Deselecting: Attached object exists..."); // Log entfernt
                     this.controlsManager.detach();
                     // console.log("[SelectionManager] Detached controls (no objects selected / single deselect path)."); // Log entfernt
                } else {
                     // console.log("[SelectionManager] Deselecting: No object attached. No detach needed."); // Log entfernt
                }
                // --- Ende Korrektur ---
            }
            // Wichtig: Status muss ZUVERLÄSSIG zurückgesetzt werden (passiert jetzt in detachAndCleanupMultiGroup oder hier)
            this.isMultiSelectActive = false;
            return;
        }

        if (selectionCount === 1) { // Einzelauswahl
            if (this.isMultiSelectActive) { this.detachAndCleanupMultiGroup(); } // Aufräumen falls nötig
            const singleObject = this.selectedObjects[0];
            const currentlyAttachedObject = this.controlsManager.getAttachedObject();
            if (currentlyAttachedObject !== singleObject) { // Nur anhängen, wenn nötig
                 this.removeHoverEffect(singleObject); // Hover entfernen
                 this.controlsManager.attach(singleObject);
                 console.log("[SelectionManager] Attached controls to single object:", singleObject.name || singleObject.uuid);
            }
            this.isMultiSelectActive = false; // Status setzen/bestätigen
            return;
        }

        if (selectionCount > 1) { // Mehrfachauswahl
            if (this.isMultiSelectActive) { this.detachAndCleanupMultiGroup(); } // Erst aufräumen
            console.log(`[SelectionManager] Attaching controls to multi-select group (${selectionCount} objects)...`);
            this.isMultiSelectActive = true;
            this.originalParents.clear();

            // Mittelpunkt berechnen
            const combinedBox = tempBox.makeEmpty();
            let validObjectsInBox = 0;
            this.selectedObjects.forEach(obj => { /* BBox Logik */
                const objBox = new THREE.Box3().setFromObject(obj, true);
                if (!objBox.isEmpty() && isFinite(objBox.min.x) && isFinite(objBox.max.x)) {
                     combinedBox.union(objBox); validObjectsInBox++;
                } else { combinedBox.expandByPoint(obj.getWorldPosition(tempVec)); validObjectsInBox++; }
            });
            if (combinedBox.isEmpty() || validObjectsInBox === 0) { /* Fehler */ this.isMultiSelectActive = false; this.controlsManager.detach(); return; }
            const groupCenter = combinedBox.getCenter(tempVec);

            // Gruppe konfigurieren
            this.multiSelectionGroup.position.copy(groupCenter);
            this.multiSelectionGroup.rotation.set(0, 0, 0); this.multiSelectionGroup.scale.set(1, 1, 1);
            this.multiSelectionGroup.updateMatrixWorld(true);

            // Objekte umhängen
            let objectsAddedToGroup = 0;
            this.selectedObjects.forEach(obj => {
                if (obj.parent) { this.originalParents.set(obj, obj.parent); this.multiSelectionGroup.add(obj); objectsAddedToGroup++; }
            });

            // Gruppe anhängen
            if (objectsAddedToGroup > 0) {
                this.scene.add(this.multiSelectionGroup);
                this.controlsManager.attach(this.multiSelectionGroup);
                console.log(`[SelectionManager] Attached controls to multi-select group containing ${objectsAddedToGroup} objects.`);
            } else { /* Fehler/Aufräumen */ this.isMultiSelectActive = false; this.controlsManager.detach(); if(this.multiSelectionGroup.parent === this.scene) { this.scene.remove(this.multiSelectionGroup); } }
        }
    } // Ende updateAttachedControls


    /**
     * Phase 2 Anpassung: Räumt NUR die Gruppe auf und setzt den Status zurück.
     * Wird von updateAttachedControls ODER ControlsManager.onTransformEnd aufgerufen.
     */
    detachAndCleanupMultiGroup() {
        if (!this.isMultiSelectActive) { return; } // Nur wenn aktiv
        console.log("[SelectionManager] Cleaning up multi-select group...");
        let cleanupError = null;

        try {
            // 1. Sicherstellen, dass Gizmo weg ist
            if (this.controlsManager.getAttachedObject() === this.multiSelectionGroup) {
                 console.warn("[SelectionManager] Cleanup called, but TransformControls still attached to group? Forcing detach.");
                 this.controlsManager.detach();
            }

            // 2. Prüfen ob Gruppe leer ist (Kinder sollten von onTransformEnd umgehängt worden sein)
            if (this.multiSelectionGroup.children.length > 0) {
                 console.warn(`[SelectionManager] Cleanup called, but multiSelectionGroup still has ${this.multiSelectionGroup.children.length} children! This shouldn't happen if onTransformEnd worked correctly. Force clearing.`);
                 // Notfall-Reparenting (sollte nicht nötig sein)
                 const remainingChildren = [...this.multiSelectionGroup.children];
                 remainingChildren.forEach(child => {
                      const originalParent = this.originalParents.get(child);
                      if (originalParent && originalParent.add) { originalParent.add(child); }
                      else { this.scene.add(child); }
                 });
            }

            // 3. Gruppe aus Szene entfernen
            if (this.multiSelectionGroup.parent) {
                this.multiSelectionGroup.parent.remove(this.multiSelectionGroup);
            }

        } catch (error) {
             console.error("[SelectionManager] Error during multi-group cleanup (try block):", error);
             cleanupError = error;
        } finally {
             // 4. Zustand IMMER zurücksetzen
             // console.log("[SelectionManager] Entering finally block for state reset..."); // Log entfernt
             this.originalParents.clear();
             // Gruppe zurücksetzen
             if (this.multiSelectionGroup.children.length > 0) { this.multiSelectionGroup.clear(); } // Sicherstellen, dass leer
             this.multiSelectionGroup.position.set(0, 0, 0);
             this.multiSelectionGroup.rotation.set(0, 0, 0);
             this.multiSelectionGroup.scale.set(1, 1, 1);
             this.multiSelectionGroup.matrix.identity();
             this.multiSelectionGroup.matrixWorld.identity();

             this.isMultiSelectActive = false; // Status ZUVERLÄSSIG zurücksetzen
             console.log("[SelectionManager] Multi-select group cleanup complete (finally). isMultiSelectActive has been set to:", this.isMultiSelectActive);
             // if (cleanupError) throw cleanupError;
        }
    } // Ende detachAndCleanupMultiGroup


    /**
     * Wendet Highlight an. (Mit Korrektur für Hover-Interaktion)
     */
    applyHighlight(object) {
        if (!object) return;
        object.traverse((child) => {
            if ((child.isMesh || child.isLine || child.isPoints) && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                     if (material) {
                        if (!material.uuid) material.uuid = THREE.MathUtils.generateUUID();
                        // KORRIGIERT: Speichere wahren Originalzustand
                        if (!this.originalMaterialStates.has(material.uuid)) {
                            let originalEmissiveValue = material.emissive?.getHex() ?? 0x000000;
                            const hoverState = this.originalMaterialStatesForHover.get(material.uuid);
                            if (hoverState) { originalEmissiveValue = hoverState.emissive; } // Nimm Wert aus Hover-Map wenn vorhanden
                            this.originalMaterialStates.set(material.uuid, {
                                opacity: material.opacity ?? 1.0, transparent: material.transparent ?? false,
                                emissive: originalEmissiveValue,
                            });
                        }
                        // Highlight anwenden
                        material.transparent = true; material.opacity = this.highlightOptions.opacity;
                        if(material.emissive) { material.emissive.setHex(this.highlightOptions.emissiveColor); }
                        material.needsUpdate = true;
                    }
                });
            }
        });
         // KORRIGIERT: Hover-Zustand beim Auswählen aufräumen
         if (object === this.hoveredObject) {
             this.removeHoverEffect(this.hoveredObject); // Räumt hoverMap auf
             this.hoveredObject = null;
         } else if (this.originalMaterialStatesForHover.size > 0) {
             this.originalMaterialStatesForHover.clear(); // Sicherheitshalber leeren
         }
    } // Ende applyHighlight


    /**
     * Entfernt Highlight.
     */
    removeHighlight(object) { // Parameter clearGlobalMapIfNeeded entfernt, da Map nur pro Material geleert wird
        if (!object) return;
        object.traverse((child) => {
             if ((child.isMesh || child.isLine || child.isPoints) && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                     if (material && material.uuid && this.originalMaterialStates.has(material.uuid)) {
                        // Prüfe, ob von anderen ausgewählten genutzt
                        let isUsedByOtherSelected = false;
                        for(const otherObj of this.selectedObjects) { if (otherObj !== object && !isUsedByOtherSelected) { otherObj.traverse((otherChild) => { if((otherChild.isMesh||otherChild.isLine||otherChild.isPoints) && otherChild.material){ const oms = Array.isArray(otherChild.material)?otherChild.material:[otherChild.material]; if(oms.some(m=>m&&m.uuid===material.uuid)){ isUsedByOtherSelected=true; } } }); } }
                        // Nur wiederherstellen, wenn nicht mehr gebraucht
                        if (!isUsedByOtherSelected) {
                             const originalState = this.originalMaterialStates.get(material.uuid);
                             material.opacity = originalState.opacity;
                             material.transparent = originalState.transparent;
                             if (material.emissive) { material.emissive.setHex(originalState.emissive); }
                             material.needsUpdate = true;
                             this.originalMaterialStates.delete(material.uuid); // Zustand entfernen
                        }
                    }
                });
            }
        });
    } // Ende removeHighlight


    /**
     * Wendet Hover an. (Ohne clear am Anfang)
     */
    applyHoverEffect(object) {
        if (!object || this.selectedObjects.includes(object)) return;
        // Kein clear() hier!
        object.traverse((child) => {
             if ((child.isMesh || child.isLine || child.isPoints) && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (material && material.emissive) {
                        if (!material.uuid) material.uuid = THREE.MathUtils.generateUUID();
                        if (!this.originalMaterialStatesForHover.has(material.uuid)) { // Nur speichern, wenn nicht schon drin
                            this.originalMaterialStatesForHover.set(material.uuid, {
                                emissive: material.emissive.getHex()
                            });
                        }
                        material.emissive.setHex(this.hoverOptions.emissiveColor);
                        material.needsUpdate = true;
                    }
                });
            }
        });
    } // Ende applyHoverEffect

    /**
     * Entfernt Hover.
     */
     removeHoverEffect(object) {
          if (!object || this.originalMaterialStatesForHover.size === 0) return;
          // Hover auch nicht entfernen, wenn Objekt ausgewählt ist (Highlight ist aktiv)
          if (this.selectedObjects.includes(object)) {
              this.originalMaterialStatesForHover.clear(); // Zustand verwerfen, da Highlight aktiv wird/ist
              return;
          }
          object.traverse((child) => {
               if ((child.isMesh || child.isLine || child.isPoints) && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                         if (material && material.uuid && this.originalMaterialStatesForHover.has(material.uuid) && material.emissive) {
                              const originalHoverState = this.originalMaterialStatesForHover.get(material.uuid);
                              material.emissive.setHex(originalHoverState.emissive);
                              material.needsUpdate = true;
                         }
                    });
               }
          });
          this.originalMaterialStatesForHover.clear(); // Zustandsspeicher leeren nach Wiederherstellung
     } // Ende removeHoverEffect

    // Getter/Setter (wie vorher)
    deselectAll() { this.updateSelection(null, false); }
    getSelectedObjects() { return this.selectedObjects; }
    getSingleSelectedObject() { return this.selectedObjects[0] || null; }

} // Ende class SelectionManager

export default SelectionManager;