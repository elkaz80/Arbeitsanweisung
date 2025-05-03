// src/SelectionManager.js (Version mit Multi-Selektion)

import * as THREE from 'three';
import { hasInvalidTransform } from './utils';

class SelectionManager {
    constructor(camera, scene, cssScene, domElement, controlsManager, uiManager, html3DManager) {
        // Abhängigkeitsprüfung
        if (!camera || !scene || !cssScene || !domElement || !controlsManager || !uiManager || !html3DManager) {
             throw new Error("SelectionManager missing required arguments!");
        }
        this.camera = camera;
        this.scene = scene;
        this.cssScene = cssScene;
        this.domElement = domElement;
        this.controlsManager = controlsManager;
        this.uiManager = uiManager;
        this.html3DManager = html3DManager;

        // Interne Zustände
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.selectedObjects = []; // NEU: Array für Multi-Selektion
        this.hoveredObject = null;
        this.isPotentialClick = false;
        this.pointerDownPosition = new THREE.Vector2();
        this.pointerDownOnCanvas = false;
        this.potentialSelection = null;

        // Konfiguration
        this.dragThreshold = 8;

        // Zustand und Optionen für Highlighting
        this.originalMaterialStates = new Map();
        this.highlightOptions = {
            opacity: 0.5,
            emissiveColor: 0x87ceeb,
        };

        // Zustand und Optionen für Hover-Effekt
        this.originalMaterialStatesForHover = new Map();
        this.hoverOptions = {
            emissiveColor: 0xaaaaaa,
        };

        // Methoden binden
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.applyHighlight = this.applyHighlight.bind(this);
        this.removeHighlight = this.removeHighlight.bind(this);
        this.applyHoverEffect = this.applyHoverEffect.bind(this);
        this.removeHoverEffect = this.removeHoverEffect.bind(this);
        // NEU: `select` muss nicht mehr extern gebunden werden, da es nicht direkt als Callback dient
    }

    init() {
        console.log("[SelectionManager] Initializing (with multi-selection)..."); // Log angepasst
        this.domElement.addEventListener('pointerdown', this.onPointerDown, false);
        this.domElement.addEventListener('pointermove', this.onPointerMove, false);
        this.domElement.addEventListener('pointerup', this.onPointerUp, false);
        console.log("[SelectionManager] Event listeners added to canvas.");
    }

    onPointerDown(event) {
        // Nur auf Canvas reagieren
        if (event.target !== this.domElement) {
            this.pointerDownOnCanvas = false;
            return;
        }

        // Hover entfernen
        if (this.hoveredObject) {
            this.removeHoverEffect(this.hoveredObject);
            this.hoveredObject = null;
        }

        this.pointerDownOnCanvas = true;
        this.isPotentialClick = true;
        this.pointerDownPosition.set(event.clientX, event.clientY);
        this.potentialSelection = null;

        // Pointer-Koordinaten
        const rect = this.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycasting
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const selectableObjects = [];
         this.scene.traverseVisible((obj) => {
             if (obj === this.controlsManager.getTransformControls() || obj.parent === this.controlsManager.getTransformControls()) return;
             if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) {
                 if (!(obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper || obj instanceof THREE.Light || obj instanceof THREE.Camera || obj === this.cameraPivot || obj.name === "Floor")) {
                     if (!hasInvalidTransform(obj)) {
                         selectableObjects.push(obj);
                     }
                 }
             }
         });

        const intersects = this.raycaster.intersectObjects(selectableObjects, true);

        if (intersects.length > 0) {
            let hitObject = intersects[0].object;

            // Kind- oder Elternobjekt basierend auf Alt-Taste bestimmen
            let targetObject = null;
            if (event.altKey) {
                // Alt gedrückt: Kind-Objekt
                if (hitObject !== this.controlsManager.getTransformControls() && hitObject.parent !== this.controlsManager.getTransformControls()) {
                     targetObject = hitObject;
                }
            } else {
                // Alt NICHT gedrückt: Eltern-Objekt suchen
                let parentCandidate = hitObject;
                while (parentCandidate.parent && parentCandidate.parent !== this.scene && !parentCandidate.name ) {
                    if (parentCandidate.parent === this.controlsManager.getTransformControls()) { parentCandidate = null; break; }
                    parentCandidate = parentCandidate.parent;
                 }
                 if (parentCandidate && parentCandidate !== this.scene && parentCandidate !== this.controlsManager.getTransformControls()) {
                     targetObject = parentCandidate;
                 }
            }

            // Potenzielle Auswahl speichern (kann null sein)
            this.potentialSelection = targetObject;

            // Verhindert OrbitControls-Start bei Klick auf irgendein auswählbares Objekt
            if (this.potentialSelection) {
                 event.stopPropagation();
            }

        } else {
            // Hintergrund getroffen
            this.potentialSelection = null;
        }
    } // Ende onPointerDown

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
              this.scene.traverseVisible((obj) => {
                  if (obj === this.controlsManager.getTransformControls() || obj.parent === this.controlsManager.getTransformControls()) return;
                  if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) {
                      if (!(obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper || obj instanceof THREE.Light || obj instanceof THREE.Camera || obj === this.cameraPivot || obj.name === "Floor")) {
                          if (!hasInvalidTransform(obj)) {
                              selectableObjects.push(obj);
                          }
                      }
                  }
              });

             const intersects = this.raycaster.intersectObjects(selectableObjects, true);
             let targetHoverObject = null;

             if (intersects.length > 0) {
                 let hitObject = intersects[0].object;
                 // Kind/Elternteil für Hover bestimmen
                 if (event.altKey) {
                      if (hitObject !== this.controlsManager.getTransformControls() && hitObject.parent !== this.controlsManager.getTransformControls()) {
                           targetHoverObject = hitObject;
                      }
                 } else {
                      let parentCandidate = hitObject;
                      while (parentCandidate.parent && parentCandidate.parent !== this.scene && !parentCandidate.name ) {
                          if (parentCandidate.parent === this.controlsManager.getTransformControls()) { parentCandidate = null; break; }
                          parentCandidate = parentCandidate.parent;
                      }
                      if (parentCandidate && parentCandidate !== this.scene && parentCandidate !== this.controlsManager.getTransformControls()) {
                           targetHoverObject = parentCandidate;
                      }
                 }
             }

             // Hover-Effekt aktualisieren
             if (targetHoverObject !== this.hoveredObject) {
                 // Alten Hover entfernen (wenn nicht ausgewählt)
                 if (this.hoveredObject && !this.selectedObjects.includes(this.hoveredObject)) {
                     this.removeHoverEffect(this.hoveredObject);
                 }
                 // Neuen Hover anwenden (wenn nicht ausgewählt)
                 if (targetHoverObject && !this.selectedObjects.includes(targetHoverObject)) {
                     this.applyHoverEffect(targetHoverObject);
                 }
                 this.hoveredObject = targetHoverObject;
             }
         } // Ende Hover-Effekt-Logik
    } // Ende onPointerMove


    onPointerUp(event) {
        if (!this.pointerDownOnCanvas) return;

        // Nur handeln, wenn es ein Klick war und der Gizmo nicht bewegt wurde
        if (this.isPotentialClick && !this.controlsManager.isDraggingGizmo) {
             // `potentialSelection` enthält das Zielobjekt (Kind oder Parent) oder null (Hintergrund)
             const target = this.potentialSelection;
             const isModifierPressed = event.shiftKey || event.ctrlKey || event.metaKey; // Shift, Strg/Cmd

             this.updateSelection(target, isModifierPressed);

        } // Ende if (isPotentialClick...)

        // Zustände zurücksetzen
        this.pointerDownOnCanvas = false;
        this.isPotentialClick = false;
        this.potentialSelection = null;
    } // Ende onPointerUp


    // NEU: Logik zur Aktualisierung der Auswahl basierend auf Klick und Modifier-Tasten
    updateSelection(targetObject, isModifierPressed) {
         console.log(`[SelectionManager] updateSelection. Target: ${targetObject?.name || targetObject?.uuid || 'Background'}, Modifier: ${isModifierPressed}`);

         const previouslySelected = [...this.selectedObjects]; // Kopie der vorherigen Auswahl

         // Fall 1: Keine Modifier-Taste gedrückt
         if (!isModifierPressed) {
             // Alle bisherigen deselektieren (Highlight entfernen)
             previouslySelected.forEach(obj => this.removeHighlight(obj, false)); // Map noch nicht leeren

             if (targetObject) {
                 // Nur das neue Objekt auswählen
                 this.selectedObjects = [targetObject];
                 this.applyHighlight(targetObject); // Highlight anwenden
                 console.log(`[SelectionManager] Selected single: ${targetObject.name || targetObject.uuid}`);
             } else {
                 // Hintergrund geklickt -> Alles deselektieren
                 this.selectedObjects = [];
                 this.originalMaterialStates.clear(); // Jetzt Map leeren
                 console.log("[SelectionManager] Deselected all (background click)");
             }
         }
         // Fall 2: Modifier-Taste gedrückt
         else {
             if (targetObject) {
                 const index = this.selectedObjects.findIndex(obj => obj === targetObject);
                 if (index > -1) {
                     // Objekt war ausgewählt -> Deselektieren (Toggle)
                     this.removeHighlight(targetObject, false); // Highlight entfernen, Map nicht leeren
                     this.selectedObjects.splice(index, 1);
                     console.log(`[SelectionManager] Deselected (modifier): ${targetObject.name || targetObject.uuid}`);
                 } else {
                     // Objekt war nicht ausgewählt -> Hinzufügen
                     this.selectedObjects.push(targetObject);
                     this.applyHighlight(targetObject); // Highlight anwenden
                     console.log(`[SelectionManager] Added to selection (modifier): ${targetObject.name || targetObject.uuid}`);
                 }
             }
             // Klick auf Hintergrund mit Modifier -> Nichts tun
         }

         // Interaktivität und Gizmo basierend auf der *neuen* Auswahl anpassen
         this.updateAttachedControls();

         // UI Liste aktualisieren
         this.uiManager?.updateSelectionHighlight(this.selectedObjects); // Übergibt das Array

         // HTML Interaktivität für alle Objekte (neu/alt) aktualisieren
         const allAffectedObjects = new Set([...previouslySelected, ...this.selectedObjects]);
         allAffectedObjects.forEach(obj => {
             if (obj) { // Sicherstellen, dass obj existiert
                 const isSelected = this.selectedObjects.includes(obj);
                 this.html3DManager?.setElementInteractivity(obj, !isSelected);
             }
         });
    } // Ende updateSelection


    // NEU: Aktualisiert Gizmo basierend auf aktueller Auswahl
    updateAttachedControls() {
        if (this.selectedObjects.length === 1) {
            const singleObject = this.selectedObjects[0];
            // Sicherstellen, dass kein Hover-Effekt aktiv ist
            this.removeHoverEffect(singleObject);
            // Gizmo anhängen
            this.controlsManager.attach(singleObject);
            console.log("[SelectionManager] Attached controls to single object.");
        } else {
            // Bei 0 oder >1 Auswahl: Gizmo entfernen
            this.controlsManager.detach();
            if (this.selectedObjects.length > 1) {
                console.log("[SelectionManager] Detached controls (multiple objects selected).");
            } else {
                 console.log("[SelectionManager] Detached controls (no objects selected).");
            }
        }
    }


    // Highlighting (Auswahl) anwenden (Bleibt fast gleich, wendet auf 1 Objekt an)
    applyHighlight(object) {
        if (!object) return;

        object.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (!material.uuid) material.uuid = THREE.MathUtils.generateUUID();
                    // Speichere Originalzustand nur, wenn nicht schon durch anderes ausgewähltes Objekt gespeichert
                    if (!this.originalMaterialStates.has(material.uuid)) {
                        this.originalMaterialStates.set(material.uuid, {
                            opacity: material.opacity,
                            transparent: material.transparent,
                            emissive: material.emissive.getHex(),
                        });
                    }
                    material.transparent = true;
                    material.opacity = this.highlightOptions.opacity;
                    material.emissive.setHex(this.highlightOptions.emissiveColor);
                    material.needsUpdate = true;
                });
            }
        });
    }

    // Highlighting (Auswahl) entfernen (ANGEPASST: optionales Leeren der Map)
    removeHighlight(object, clearGlobalMapIfNeeded = false) {
        if (!object) return;

        object.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (material.uuid && this.originalMaterialStates.has(material.uuid)) {
                        // Prüfen, ob dieses Material noch von einem *anderen* ausgewählten Objekt genutzt wird
                        let isUsedByOtherSelected = false;
                        for(const otherObj of this.selectedObjects) {
                             if (otherObj !== object) { // Schaue nur andere Objekte an
                                 otherObj.traverse((otherChild) => {
                                      if(otherChild.isMesh && otherChild.material) {
                                           const otherMaterials = Array.isArray(otherChild.material) ? otherChild.material : [otherChild.material];
                                           if(otherMaterials.some(m => m.uuid === material.uuid)) {
                                                isUsedByOtherSelected = true;
                                           }
                                      }
                                 });
                             }
                             if(isUsedByOtherSelected) break;
                        }

                        // Nur wiederherstellen, wenn nicht von anderem ausgewählten Objekt genutzt
                        if (!isUsedByOtherSelected) {
                             const originalState = this.originalMaterialStates.get(material.uuid);
                             material.opacity = originalState.opacity;
                             material.transparent = originalState.transparent;
                             material.emissive.setHex(originalState.emissive);
                             material.needsUpdate = true;
                             // Zustand aus Map entfernen, da wiederhergestellt
                             this.originalMaterialStates.delete(material.uuid);
                        }
                    }
                });
            }
        });

        // Globale Map nur leeren, wenn explizit gefordert (z.B. bei Deselect All)
        if (clearGlobalMapIfNeeded && this.originalMaterialStates.size > 0) {
             console.warn("[SelectionManager] Clearing highlight states map, but some states might remain unrestored if materials were shared and other objects kept them selected.");
             // Besser: Die Map wird nur durch das Entfernen oben nach und nach geleert.
             // this.originalMaterialStates.clear(); // Vorerst nicht global leeren hier
        }
    }

    // Hover-Effekt anwenden
    applyHoverEffect(object) {
        if (!object || this.selectedObjects.includes(object)) return; // Nicht auf ausgewählte Objekte anwenden

        this.originalMaterialStatesForHover.clear();

        object.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (!material.uuid) material.uuid = THREE.MathUtils.generateUUID();
                    if (!this.originalMaterialStatesForHover.has(material.uuid)) {
                         this.originalMaterialStatesForHover.set(material.uuid, {
                              emissive: material.emissive.getHex()
                         });
                    }
                    material.emissive.setHex(this.hoverOptions.emissiveColor);
                    material.needsUpdate = true;
                });
            }
        });
    }

     // Hover-Effekt entfernen
     removeHoverEffect(object) {
          if (!object || this.originalMaterialStatesForHover.size === 0) return;
          // Hover nicht entfernen, wenn Objekt gerade ausgewählt wurde (Highlight überschreibt)
          if (this.selectedObjects.includes(object)) return;

          object.traverse((child) => {
               if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                         if (material.uuid && this.originalMaterialStatesForHover.has(material.uuid)) {
                              const originalHoverState = this.originalMaterialStatesForHover.get(material.uuid);
                              material.emissive.setHex(originalHoverState.emissive);
                              material.needsUpdate = true;
                         }
                    });
               }
          });
          this.originalMaterialStatesForHover.clear();
     }

    // Explizite Deselektion aller Objekte
    deselectAll() {
        this.updateSelection(null, false); // Simuliert Klick auf Hintergrund
    }

    // Gibt das Array der ausgewählten Objekte zurück
    getSelectedObjects() {
        return this.selectedObjects;
    }

    // Gibt das erste ausgewählte Objekt zurück (für Kompatibilität oder einfache Fälle)
    getSingleSelectedObject() {
         return this.selectedObjects[0] || null;
    }
}

export default SelectionManager;