// src/SelectionManager.js (Version mit Multi-Selektion und Korrekturen)

import * as THREE from 'three';
// Importiere die benötigten Hilfsobjekte und Funktionen aus utils.js
// Stelle sicher, dass der Pfad './utils' korrekt ist und die Datei existiert.
import { hasInvalidTransform, tempBox, tempVec } from './utils'; // Passe ggf. den Namen 'tempVec' an

class SelectionManager {
    constructor(camera, scene, cssScene, domElement, controlsManager, uiManager, html3DManager) {
        // Abhängigkeitsprüfung
        if (!camera || !scene || !domElement || !controlsManager || !uiManager) { // cssScene & html3DManager sind optionaler? Überprüfen!
             console.error("SelectionManager missing required arguments!", {camera, scene, cssScene, domElement, controlsManager, uiManager, html3DManager});
             throw new Error("SelectionManager missing required arguments! Check console for details.");
        }
        this.camera = camera;
        this.scene = scene;
        this.cssScene = cssScene; // Wird derzeit nicht aktiv genutzt
        this.domElement = domElement;
        this.controlsManager = controlsManager;
        this.uiManager = uiManager;
        this.html3DManager = html3DManager; // Wird derzeit nicht aktiv genutzt

        // Interne Zustände
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.selectedObjects = []; // Array für Multi-Selektion
        this.hoveredObject = null;
        this.isPotentialClick = false;
        this.pointerDownPosition = new THREE.Vector2();
        this.pointerDownOnCanvas = false;
        this.potentialSelection = null; // Das Objekt, das bei mouseUp ausgewählt *werden könnte*

        // Konfiguration
        this.dragThreshold = 8; // Pixel-Distanz, ab der ein Klick als Drag gilt

        // Zustand und Optionen für Highlighting (Auswahl)
        this.originalMaterialStates = new Map(); // Speichert { materialUUID: { originalState } }
        this.highlightOptions = {
            opacity: 0.5,
            emissiveColor: 0x87ceeb, // Helles Himmelblau
            // Optional: Weitere Optionen wie depthWrite: false etc. könnten hier sinnvoll sein
        };

        // Zustand und Optionen für Hover-Effekt
        this.originalMaterialStatesForHover = new Map(); // Temporärer Speicher für Hover
        this.hoverOptions = {
            emissiveColor: 0xaaaaaa, // Helles Grau
        };

        // Methoden binden (Nur die, die als EventListener übergeben werden!)
        // Dies ist notwendig, damit 'this' innerhalb der Listener korrekt auf die Instanz zeigt.
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        // NEU: Für Multi-Selektion mit Gizmo
        this.multiSelectionGroup = new THREE.Group();
        this.multiSelectionGroup.name = 'MultiSelect_Gizmo_Group'; // Hilfreich für Debugging
        this.originalParents = new Map(); // Speichert { object: originalParent }
        this.isMultiSelectActive = false; // Ist der Gizmo gerade an der multiSelectionGroup?

        // Das Binden von detachAndCleanupMultiGroup wurde entfernt, da es einen Fehler verursachte.
        // Interne Methodenaufrufe wie this.detachAndCleanupMultiGroup() behalten den 'this'-Kontext.
    }

    /**
     * Initialisiert den SelectionManager durch Hinzufügen der Event Listener.
     */
    init() {
        console.log("[SelectionManager] Initializing (with multi-selection)...");
        this.domElement.addEventListener('pointerdown', this.onPointerDown, false);
        this.domElement.addEventListener('pointermove', this.onPointerMove, false);
        this.domElement.addEventListener('pointerup', this.onPointerUp, false);
        // Optional: Listener für 'mouseleave' oder 'contextmenu' hinzufügen?
        console.log("[SelectionManager] Event listeners added to canvas.");
    }

    /**
     * Behandelt das 'pointerdown'-Event auf dem Canvas.
     * Ermittelt das potenziell auszuwählende Objekt.
     */
    onPointerDown(event) {
        if (event.target !== this.domElement) {
            this.pointerDownOnCanvas = false;
            return; // Klick außerhalb des Canvas ignorieren
        }
        this.pointerDownOnCanvas = true;

        // Aktuellen Hover-Effekt entfernen
        if (this.hoveredObject) {
            this.removeHoverEffect(this.hoveredObject);
            this.hoveredObject = null;
        }

        this.isPotentialClick = true; // Annahme: Es ist ein Klick, bis Drag erkannt wird
        this.pointerDownPosition.set(event.clientX, event.clientY);
        this.potentialSelection = null; // Zurücksetzen

        // Pointer-Koordinaten für Raycasting berechnen
        const rect = this.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycasting durchführen
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const selectableObjects = [];
        this.scene.traverseVisible((obj) => { // Nur sichtbare Objekte prüfen
            // Ignoriere bestimmte Objekte
            if (obj === this.controlsManager.getTransformControls() ||
                obj.parent === this.controlsManager.getTransformControls() ||
                obj === this.multiSelectionGroup || // Multi-Select-Gruppe ignorieren
                obj.isLight || obj.isCamera || // Lichter und Kameras ignorieren
                obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper || // Hilfslinien ignorieren
                obj.name === "Floor" || // Den Boden ignorieren (Annahme)
                (this.appManager && obj === this.appManager.getCameraPivot())) // Kamera-Pivot ignorieren (falls vorhanden)
            {
                return;
            }

            // Nur auswählbare Geometrietypen berücksichtigen
            if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) {
                // Optional: Weitere Filterung nach 'userData' oder Layer?
                 if (!hasInvalidTransform(obj)) { // Nur Objekte mit gültigen Transformationen
                    selectableObjects.push(obj);
                }
            }
        });

        const intersects = this.raycaster.intersectObjects(selectableObjects, true); // true = rekursiv prüfen

        if (intersects.length > 0) {
            let hitObject = intersects[0].object; // Das direkt getroffene Objekt (kann ein Kind sein)

            // Zielobjekt bestimmen (Kind oder Parent, je nach Alt-Taste)
            // (Logik wie zuvor, ggf. anpassen an deine Objektstruktur)
            let targetObject = null;
            if (event.altKey) {
                 targetObject = hitObject; // Bei Alt-Taste das Kind nehmen
            } else {
                let parentCandidate = hitObject;
                // Gehe in der Hierarchie nach oben, bis ein benanntes Objekt oder die Szene erreicht ist
                while (parentCandidate.parent && parentCandidate.parent !== this.scene && !parentCandidate.name) {
                    parentCandidate = parentCandidate.parent;
                 }
                 targetObject = parentCandidate;
            }

             // Sicherstellen, dass wir nicht versehentlich die Gruppe auswählen
             if (targetObject === this.multiSelectionGroup) targetObject = null;

            this.potentialSelection = targetObject; // Dieses Objekt vormerken

            // Verhindert OrbitControls-Aktivierung bei Klick auf ein Objekt
            if (this.potentialSelection) {
                 event.stopPropagation();
            }

        } else {
            // Hintergrund getroffen
            this.potentialSelection = null;
        }
    } // Ende onPointerDown

    /**
     * Behandelt das 'pointermove'-Event.
     * Erkennt Dragging und aktualisiert den Hover-Effekt.
     */
    onPointerMove(event) {
         // 1. Drag-Erkennung: Wenn Maus gedrückt und bewegt wird
         if (this.pointerDownOnCanvas && this.isPotentialClick && event.buttons > 0 &&
             this.pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > this.dragThreshold) {
             this.isPotentialClick = false; // Es ist ein Drag
             this.potentialSelection = null; // Klick-Ziel verwerfen
         }

         // 2. Hover-Effekt (nur wenn KEINE Maustaste gedrückt ist)
         if (event.buttons === 0) {
             const rect = this.domElement.getBoundingClientRect();
             this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
             this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

             this.raycaster.setFromCamera(this.pointer, this.camera);
             const selectableObjects = [];
             this.scene.traverseVisible((obj) => {
                  // --- KORREKTUR: Ignoriere Gizmo UND MultiSelect-Gruppe ---
                  if (obj === this.controlsManager.getTransformControls() ||
                      obj.parent === this.controlsManager.getTransformControls() ||
                      obj === this.multiSelectionGroup || // Gruppe ignorieren
                      obj.isLight || obj.isCamera ||
                      obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper ||
                      obj.name === "Floor" ||
                      (this.appManager && obj === this.appManager.getCameraPivot()))
                   {
                      return;
                  }
                  // --- ENDE KORREKTUR ---
                  if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) {
                      if (!hasInvalidTransform(obj)) {
                          selectableObjects.push(obj);
                      }
                  }
             });

             const intersects = this.raycaster.intersectObjects(selectableObjects, true);
             let targetHoverObject = null;

             if (intersects.length > 0) {
                 let hitObject = intersects[0].object;
                 // Ziel für Hover bestimmen (wie bei onPointerDown)
                 if (event.altKey) {
                      targetHoverObject = hitObject;
                 } else {
                      let parentCandidate = hitObject;
                      while (parentCandidate.parent && parentCandidate.parent !== this.scene && !parentCandidate.name) {
                          parentCandidate = parentCandidate.parent;
                      }
                       targetHoverObject = parentCandidate;
                 }
                  if (targetHoverObject === this.multiSelectionGroup) targetHoverObject = null; // Gruppe ignorieren
             }

             // Hover-Effekt aktualisieren, wenn sich das Ziel geändert hat
             if (targetHoverObject !== this.hoveredObject) {
                 // Alten Hover entfernen (falls Objekt nicht ausgewählt ist)
                 if (this.hoveredObject && !this.selectedObjects.includes(this.hoveredObject)) {
                     this.removeHoverEffect(this.hoveredObject);
                 }
                 // Neuen Hover anwenden (falls Objekt nicht ausgewählt ist)
                 if (targetHoverObject && !this.selectedObjects.includes(targetHoverObject)) {
                     this.applyHoverEffect(targetHoverObject);
                 }
                 this.hoveredObject = targetHoverObject; // Aktuelles Hover-Objekt merken
             }
         } // Ende Hover-Effekt-Logik
    } // Ende onPointerMove

    /**
     * Behandelt das 'pointerup'-Event.
     * Löst die Aktualisierung der Auswahl aus, wenn es ein Klick war.
     */
    onPointerUp(event) {
        if (!this.pointerDownOnCanvas) return; // Ignorieren, wenn Down nicht auf Canvas war

        // Nur handeln, wenn es ein Klick war (kein Drag)
        // UND der Gizmo NICHT gerade manipuliert wird (wichtig!)
        if (this.isPotentialClick && !this.controlsManager.isDraggingGizmo) {
             const target = this.potentialSelection; // Das in onPointerDown ermittelte Ziel
             const isModifierPressed = event.shiftKey || event.ctrlKey || event.metaKey;

             // Die eigentliche Auswahl-Logik aufrufen
             this.updateSelection(target, isModifierPressed);

        } // Ende if (isPotentialClick...)

        // Zustände für nächsten Klick zurücksetzen
        this.pointerDownOnCanvas = false;
        this.isPotentialClick = false;
        this.potentialSelection = null;
    } // Ende onPointerUp


    /**
     * Aktualisiert die Auswahl basierend auf dem geklickten Objekt und Modifier-Tasten.
     * @param {THREE.Object3D | null} targetObject Das geklickte Objekt oder null für Hintergrund.
     * @param {boolean} isModifierPressed Ob Shift/Strg/Cmd gedrückt wurde.
     */
    updateSelection(targetObject, isModifierPressed) {
         console.log(`[SelectionManager] updateSelection. Target: ${targetObject?.name || targetObject?.uuid || 'Background'}, Modifier: ${isModifierPressed}`);

         const previouslySelected = [...this.selectedObjects]; // Kopie für spätere Vergleiche/Updates

         // --- Auswahl-Logik ---
         if (!isModifierPressed) { // Fall 1: Normaler Klick (kein Modifier)
             previouslySelected.forEach(obj => this.removeHighlight(obj)); // Alte Highlights entfernen
             this.originalMaterialStates.clear(); // Material-States löschen

             if (targetObject) { // Klick auf Objekt
                 this.selectedObjects = [targetObject]; // Nur dieses Objekt auswählen
                 this.applyHighlight(targetObject);
                 console.log(`[SelectionManager] Selected single: ${targetObject.name || targetObject.uuid}`);
             } else { // Klick auf Hintergrund
                 this.selectedObjects = []; // Auswahl leeren
                 console.log("[SelectionManager] Deselected all (background click)");
             }
         } else { // Fall 2: Klick mit Modifier (Shift/Strg/Cmd)
             if (targetObject) { // Klick auf Objekt mit Modifier
                 const index = this.selectedObjects.findIndex(obj => obj === targetObject);
                 if (index > -1) { // Objekt war schon drin -> entfernen (Toggle)
                     this.removeHighlight(targetObject);
                     this.selectedObjects.splice(index, 1);
                     console.log(`[SelectionManager] Deselected (modifier): ${targetObject.name || targetObject.uuid}`);
                 } else { // Objekt war nicht drin -> hinzufügen
                     this.selectedObjects.push(targetObject);
                     this.applyHighlight(targetObject);
                     console.log(`[SelectionManager] Added to selection (modifier): ${targetObject.name || targetObject.uuid}`);
                 }
             }
             // Klick auf Hintergrund mit Modifier -> Auswahl nicht ändern
         }

         // --- Gizmo und UI aktualisieren ---
         // Diese Methode MUSS jetzt existieren und korrekt funktionieren!
         try {
              this.updateAttachedControls();
         } catch (e) {
              console.error("[SelectionManager] FATAL Error calling updateAttachedControls:", e);
              // Notfall-Plan: Versuchen, alles zurückzusetzen
              if(this.controlsManager?.detach) this.controlsManager.detach();
              this.isMultiSelectActive = false;
              // Eventuell weitere Aufräumarbeiten nötig
         }

         // UI-Updates (optional, falls vorhanden)
         this.uiManager?.updateSelectionHighlight(this.selectedObjects);
         this.updateHtmlInteractivity(previouslySelected); // Beispiel für HTML-Update
    } // Ende updateSelection

    /**
     * Aktualisiert die Interaktivität von HTML-Elementen basierend auf der Auswahl.
     * Beispielhafte Implementierung, muss an dein HTML3DManager angepasst werden.
     * @param {Array<THREE.Object3D>} previouslySelected - Die Objekte, die vor der aktuellen Aktion ausgewählt waren.
     */
    updateHtmlInteractivity(previouslySelected) {
        if (!this.html3DManager?.setElementInteractivity) return; // Nur wenn Funktion existiert

        const allAffectedObjects = new Set([...previouslySelected, ...this.selectedObjects]);
        allAffectedObjects.forEach(obj => {
            if (obj) { // Nur gültige Objekte berücksichtigen
                const isCurrentlySelected = this.selectedObjects.includes(obj);
                // Beispiel: Element ist interaktiv (klickbar), wenn es NICHT ausgewählt ist
                this.html3DManager.setElementInteractivity(obj, !isCurrentlySelected);
            }
        });
     }


    /**
     * Aktualisiert den TransformControls Gizmo basierend auf der aktuellen Auswahl.
     * (Implementierung aus vorherigem Schritt mit Korrekturen)
     */
    updateAttachedControls() {
        const selectionCount = this.selectedObjects.length;
        if (selectionCount === 0) {
            console.log("[SelectionManager] updateAttachedControls: selectionCount is 0.");
            if (this.isMultiSelectActive) {
                console.log("[SelectionManager] Deselecting: Multi-select WAS active. Calling detachAndCleanupMultiGroup...");
                // detachAndCleanupMultiGroup ruft intern controlsManager.detach() auf,
                // was wiederum transformControls.detach() aufruft.
                this.detachAndCleanupMultiGroup();
            } else {
                console.log("[SelectionManager] Deselecting: Multi-select was NOT active.");
                // --- KORREKTUR: Prüfe die .object Eigenschaft der transformControls Instanz ---
                const currentlyAttachedObject = this.controlsManager.transformControls?.object; // Sicherer Zugriff
                console.log("[SelectionManager] Checking controlsManager.transformControls.object:", currentlyAttachedObject);
        
                if (currentlyAttachedObject) { // Prüfen, ob WIRKLICH etwas angehängt ist
                     console.log("[SelectionManager] Deselecting: transformControls.object exists. Calling controlsManager.detach()...");
                     this.controlsManager.detach(); // Direkter Aufruf zum Entfernen des Gizmos
                     console.log("[SelectionManager] Detached controls (no objects selected / single deselect path).");
                } else {
                     console.log("[SelectionManager] Deselecting: transformControls.object is already null/undefined. No detach needed.");
                }
                // --- ENDE KORREKTUR ---
            }
            console.log("[SelectionManager] Deselecting: Setting isMultiSelectActive=false.");
            this.isMultiSelectActive = false; // Sicherstellen, dass Status zurückgesetzt wird
            return; // Frühzeitiger Ausstieg
        }
        // --- Fall 1: Nichts ausgewählt ---
        if (selectionCount === 0) {
            if (this.isMultiSelectActive) {
                this.detachAndCleanupMultiGroup(); // Räumt Gruppe auf UND detacht Gizmo
            } else if (this.controlsManager.object) { // Nur detachen, wenn Gizmo an einzelnem Objekt hing
                 this.controlsManager.detach();
                 console.log("[SelectionManager] Detached controls (no objects selected).");
            }
            this.isMultiSelectActive = false; // Status sicherheitshalber setzen
            return;
        }

        // --- Fall 2: Genau ein Objekt ausgewählt ---
        if (selectionCount === 1) {
            if (this.isMultiSelectActive) {
                this.detachAndCleanupMultiGroup(); // Räumt Gruppe auf UND detacht Gizmo
            }
            const singleObject = this.selectedObjects[0];
            if (this.controlsManager.object !== singleObject) { // Nur anhängen, wenn nicht schon dran
                 this.removeHoverEffect(singleObject); // Hover entfernen
                 this.controlsManager.attach(singleObject);
                 console.log("[SelectionManager] Attached controls to single object:", singleObject.name || singleObject.uuid);
            }
            this.isMultiSelectActive = false; // Status sicherheitshalber setzen
            return;
        }

        // --- Fall 3: Mehr als ein Objekt ausgewählt ---
        if (selectionCount > 1) {
            // Wenn Multi-Select schon aktiv war, erst aufräumen, um Neuaubau zu erzwingen
            // (Eine Optimierung wäre, nur Deltas zu verarbeiten, aber das ist komplexer)
            if (this.isMultiSelectActive) {
                 this.detachAndCleanupMultiGroup();
            }

            console.log(`[SelectionManager] Attaching controls to multi-select group (${selectionCount} objects)...`);
            this.isMultiSelectActive = true; // Status setzen
            this.originalParents.clear(); // Alte Parent-Infos löschen

            // 1. Mittelpunkt der Auswahl berechnen (mit importierten utils)
            const combinedBox = tempBox.makeEmpty(); // Nutze importiertes tempBox
            let validObjectsInBox = 0;
            this.selectedObjects.forEach(obj => {
                // Erstelle eine NEUE Box für setFromObject für jedes Objekt
                const objBox = new THREE.Box3().setFromObject(obj, true); // true = präzise
                // Prüfe auf gültige Box
                if (!objBox.isEmpty() && isFinite(objBox.min.x) && isFinite(objBox.max.x)) {
                     combinedBox.union(objBox);
                     validObjectsInBox++;
                } else {
                    console.warn("[SelectionManager] Object has empty/invalid bounding box, using world position as fallback:", obj.name || obj.uuid);
                    // Nutze importiertes tempVec für die Position (wird hier überschrieben)
                    combinedBox.expandByPoint(obj.getWorldPosition(tempVec));
                    validObjectsInBox++; // Zähle es trotzdem, um eine leere Box zu vermeiden
                 }
            });

             // Nur fortfahren, wenn die Box sinnvoll ist
             if (combinedBox.isEmpty() || validObjectsInBox === 0) {
                console.error("[SelectionManager] Cannot create multi-select group: combined bounding box is empty or contains no valid objects.");
                this.isMultiSelectActive = false;
                this.controlsManager.detach(); // Sicherstellen, dass nichts angehängt ist
                return;
            }

            // Nutze importiertes tempVec für das Zentrum (wird hier überschrieben)
            const groupCenter = combinedBox.getCenter(tempVec);

            // 2. Gruppe konfigurieren und positionieren
            this.multiSelectionGroup.position.copy(groupCenter); // Kopiere Wert aus tempVec
            this.multiSelectionGroup.rotation.set(0, 0, 0);
            this.multiSelectionGroup.scale.set(1, 1, 1);
            this.multiSelectionGroup.updateMatrixWorld(true); // Wichtig für spätere Berechnungen

            // 3. Ausgewählte Objekte in die Gruppe umhängen
            let objectsAddedToGroup = 0;
            this.selectedObjects.forEach(obj => {
                if (obj.parent) { // Nur Objekte umhängen, die schon in der Szene sind
                    this.originalParents.set(obj, obj.parent); // Original-Elternteil merken
                    this.multiSelectionGroup.add(obj); // Hinzufügen (entfernt automatisch von altem Parent)
                    objectsAddedToGroup++;
                 } else {
                    console.warn("[SelectionManager] Selected object has no parent, cannot add to multi-select group:", obj.name || obj.uuid);
                 }
            });

            // 4. Gruppe zur Szene hinzufügen und Gizmo anhängen (nur wenn Objekte erfolgreich hinzugefügt wurden)
            if (objectsAddedToGroup > 0) {
                this.scene.add(this.multiSelectionGroup); // Gruppe zur Szene hinzufügen
                this.controlsManager.attach(this.multiSelectionGroup); // Gizmo an Gruppe hängen
                console.log(`[SelectionManager] Attached controls to multi-select group containing ${objectsAddedToGroup} objects.`);
            } else {
                console.warn("[SelectionManager] Multi-select group is empty after trying to add objects. Detaching controls.");
                this.isMultiSelectActive = false; // Status zurücksetzen
                this.controlsManager.detach();
                 // Sicherstellen, dass die leere Gruppe nicht in der Szene bleibt
                 if(this.multiSelectionGroup.parent === this.scene) {
                    this.scene.remove(this.multiSelectionGroup);
                 }
            }
        }
    } // Ende updateAttachedControls


    /**
     * Entfernt den Gizmo von der Multi-Selektions-Gruppe (falls aktiv),
     * hängt die Objekte zurück an ihre ursprünglichen Eltern und räumt auf.
     * WICHTIG: Wendet noch KEINE Transformationen an! (Das ist Phase 2)
     */
    detachAndCleanupMultiGroup() {
        // Nur ausführen, wenn Multi-Select wirklich aktiv war
        if (!this.isMultiSelectActive) {
            console.log("[SelectionManager] detachAndCleanupMultiGroup called but not active. Skipping.");
            return;
        }
        console.log("[SelectionManager] Detaching controls from multi-select group and cleaning up...");
        let cleanupError = null; // Zum Speichern eines Fehlers, falls einer auftritt
    
        try { // Hauptlogik im try-Block
            // 1. Detach Controls FIRST
            // Prüfen, ob der Gizmo überhaupt an unserer Gruppe hängt
            if (this.controlsManager.transformControls?.object === this.multiSelectionGroup) {
                console.log("[SelectionManager] Calling controlsManager.detach()...");
                this.controlsManager.detach(); // Sollte transformControls.object = null setzen
            } else {
                console.warn("[SelectionManager] Cleanup started, but TransformControls was not attached to multiSelectionGroup?");
            }
    
            // 2. Objekte zurück zu ursprünglichen Eltern verschieben
            console.log("[SelectionManager] Reparenting objects...");
            const objectsToReparent = [...this.multiSelectionGroup.children]; // Kopie erstellen!
            objectsToReparent.forEach(child => {
                const originalParent = this.originalParents.get(child);
                if (originalParent && typeof originalParent.add === 'function') {
                     originalParent.add(child); // Entfernt Kind aus multiSelectionGroup
                     // Phase 2 (Transformation anwenden) fehlt hier noch
                } else {
                    console.warn("[SelectionManager] Could not find/use original parent for", child.name || child.uuid, ". Attaching to scene as fallback.");
                    this.scene.add(child); // Notfall-Fallback
                 }
            });
            console.log("[SelectionManager] Reparenting finished.");
    
    
            // 3. Gruppe aus Szene entfernen (nur wenn sie noch einen Parent hat)
            if (this.multiSelectionGroup.parent) {
                 console.log("[SelectionManager] Removing multiSelectionGroup from scene.");
                this.multiSelectionGroup.parent.remove(this.multiSelectionGroup);
            } else {
                 console.log("[SelectionManager] multiSelectionGroup was already removed from scene or had no parent.");
            }
    
    
        } catch (error) {
             // Fehler während des try-Blocks abfangen und loggen
             console.error("[SelectionManager] Error during multi-group cleanup (try block):", error);
             cleanupError = error; // Fehler merken für später, falls nötig
        } finally { // Dieser Block wird IMMER ausgeführt, auch nach einem Fehler im try-Block
             console.log("[SelectionManager] Entering finally block for state reset...");
    
            // 4. Zustand IMMER zurücksetzen, egal was im try passiert ist
            this.originalParents.clear();
    
            // Gruppe selbst zurücksetzen (Kinder sollten weg sein)
            if (this.multiSelectionGroup.children.length > 0) {
                console.warn("[SelectionManager] Multi-select group children not empty in finally block! Force clearing.");
                // Dies sollte eigentlich nicht passieren, wenn das Reparenting funktioniert hat
                this.multiSelectionGroup.clear(); // Entfernt alle verbleibenden Kinder
            }
            this.multiSelectionGroup.position.set(0, 0, 0);
            this.multiSelectionGroup.rotation.set(0, 0, 0);
            this.multiSelectionGroup.scale.set(1, 1, 1);
            this.multiSelectionGroup.matrix.identity();
            this.multiSelectionGroup.matrixWorld.identity();
            // Sichtbarkeit wieder herstellen, falls sie geändert wurde (wurde sie aber nicht mehr)
            // this.multiSelectionGroup.visible = true;
    
            // WICHTIGSTER TEIL: Status zuverlässig zurücksetzen
            this.isMultiSelectActive = false;
            console.log("[SelectionManager] Multi-select group cleanup complete (finally). isMultiSelectActive has been set to:", this.isMultiSelectActive);
    
            // Optional: Wenn ein kritischer Fehler aufgetreten ist, könnte man ihn hier erneut werfen,
            // aber für das Deselektieren ist es vielleicht besser, den Zustand zu bereinigen.
            // if (cleanupError) {
            //     console.error("[SelectionManager] Re-throwing error caught during cleanup.");
            //     throw cleanupError;
            // }
        }
    } // Ende detachAndCleanupMultiGroup

    /**
     * Wendet den Highlight-Effekt auf ein Objekt an.
     * Stellt sicher, dass Materialien und emissive Eigenschaften vorhanden sind.
     */
    applyHighlight(object) {
        if (!object) return;
        object.traverse((child) => {
            // Prüfe auf Mesh oder andere Typen, die Materialien haben könnten
            if ((child.isMesh || child.isLine || child.isPoints) && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                     if (material) { // Prüfe, ob Material existiert
                        if (!material.uuid) material.uuid = THREE.MathUtils.generateUUID();

                        // Speichere Originalzustand nur, wenn nicht schon gespeichert
                        if (!this.originalMaterialStates.has(material.uuid)) {
                            this.originalMaterialStates.set(material.uuid, {
                                opacity: material.opacity ?? 1.0, // Standardwert falls undefined
                                transparent: material.transparent ?? false, // Standardwert
                                // Sicherer Zugriff auf emissive, Standardwert 0x000000
                                emissive: material.emissive?.getHex() ?? 0x000000,
                                // Optional: Weitere Eigenschaften wie depthWrite speichern?
                            });
                        }
                        // Highlight anwenden
                        material.transparent = true; // Mache es transparent für Opacity-Effekt
                        material.opacity = this.highlightOptions.opacity;
                        if(material.emissive) { // Nur setzen, wenn 'emissive' existiert
                             material.emissive.setHex(this.highlightOptions.emissiveColor);
                        } else {
                            // console.warn("[SelectionManager] Material has no emissive property during highlight:", material);
                        }
                        material.needsUpdate = true; // Wichtig, damit Änderungen sichtbar werden
                    }
                });
            }
        });
    } // Ende applyHighlight

    /**
     * Entfernt den Highlight-Effekt von einem Objekt.
     * Stellt Materialeigenschaften wieder her, wenn das Objekt nicht mehr von
     * einem anderen ausgewählten Objekt verwendet wird.
     */
    removeHighlight(object) {
        if (!object) return;
        object.traverse((child) => {
             if ((child.isMesh || child.isLine || child.isPoints) && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                     if (material && material.uuid && this.originalMaterialStates.has(material.uuid)) {
                        // Prüfen, ob dieses Material noch von einem *anderen* ausgewählten Objekt verwendet wird
                        let isUsedByOtherSelected = false;
                        for(const otherObj of this.selectedObjects) {
                             // Prüfe nicht das Objekt selbst und nur, wenn wir noch keinen Treffer haben
                             if (otherObj !== object && !isUsedByOtherSelected) {
                                 otherObj.traverse((otherChild) => {
                                      if ((otherChild.isMesh || otherChild.isLine || otherChild.isPoints) && otherChild.material) {
                                           const otherMaterials = Array.isArray(otherChild.material) ? otherChild.material : [otherChild.material];
                                           // Prüfe, ob irgendein Material im anderen Objekt dasselbe ist
                                           if (otherMaterials.some(m => m && m.uuid === material.uuid)) {
                                                isUsedByOtherSelected = true;
                                           }
                                      }
                                 });
                             }
                        }

                        // Nur wiederherstellen, wenn nicht von anderem ausgewählten Objekt genutzt
                        if (!isUsedByOtherSelected) {
                             const originalState = this.originalMaterialStates.get(material.uuid);
                             material.opacity = originalState.opacity;
                             material.transparent = originalState.transparent;
                             if (material.emissive) { // Nur wiederherstellen, wenn vorhanden
                                material.emissive.setHex(originalState.emissive);
                             }
                             material.needsUpdate = true;
                             // Gespeicherten Zustand entfernen, da wiederhergestellt
                             this.originalMaterialStates.delete(material.uuid);
                        }
                    }
                });
            }
        });
    } // Ende removeHighlight


    /**
     * Wendet den Hover-Effekt an (mit Korrektur für fehlendes emissive).
     */
    applyHoverEffect(object) {
        if (!object || this.selectedObjects.includes(object)) return; // Nicht auf ausgewählte anwenden
        this.originalMaterialStatesForHover.clear(); // Alte Hover-States löschen

        object.traverse((child) => {
             if ((child.isMesh || child.isLine || child.isPoints) && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    // --- KORREKTUR ---
                    if (material && material.emissive) { // Prüfen ob Material UND emissive existieren
                        if (!material.uuid) material.uuid = THREE.MathUtils.generateUUID();
                        // Speichere originalen Emissive-Wert, falls noch nicht geschehen
                        if (!this.originalMaterialStatesForHover.has(material.uuid)) {
                            this.originalMaterialStatesForHover.set(material.uuid, {
                                emissive: material.emissive.getHex() // Sicherer Zugriff
                            });
                        }
                        // Wende Hover-Farbe an
                        material.emissive.setHex(this.hoverOptions.emissiveColor);
                        material.needsUpdate = true;
                    } else if (material) {
                        // Optional: Log, wenn kein emissive vorhanden
                        // console.log("[SelectionManager] Material has no emissive property during hover:", material);
                    }
                    // --- ENDE KORREKTUR ---
                });
            }
        });
    } // Ende applyHoverEffect

    /**
     * Entfernt den Hover-Effekt, stellt ursprüngliche Emissive-Farbe wieder her.
     */
     removeHoverEffect(object) {
          if (!object || this.originalMaterialStatesForHover.size === 0) return; // Nichts zu tun
          // Hover nicht entfernen, wenn Objekt gerade ausgewählt wurde (Highlight ist wichtiger)
          if (this.selectedObjects.includes(object)) {
                this.originalMaterialStatesForHover.clear(); // Aber Map leeren
                return;
          }

          object.traverse((child) => {
               if ((child.isMesh || child.isLine || child.isPoints) && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                         // Stelle nur wieder her, wenn Material existiert, eine UUID hat,
                         // im Hover-Speicher ist UND eine emissive Eigenschaft hat
                         if (material && material.uuid && this.originalMaterialStatesForHover.has(material.uuid) && material.emissive) {
                              const originalHoverState = this.originalMaterialStatesForHover.get(material.uuid);
                              material.emissive.setHex(originalHoverState.emissive); // Stelle Originalfarbe her
                              material.needsUpdate = true;
                         }
                    });
               }
          });
          this.originalMaterialStatesForHover.clear(); // Immer leeren nach Entfernen
     } // Ende removeHoverEffect

    /**
     * Explizite Methode, um alle Objekte zu deselektieren.
     * Simuliert einen Klick auf den Hintergrund.
     */
    deselectAll() {
        this.updateSelection(null, false);
    }

    /**
     * Gibt das Array der aktuell ausgewählten Objekte zurück.
     * @returns {Array<THREE.Object3D>}
     */
    getSelectedObjects() {
        return this.selectedObjects;
    }

    /**
     * Gibt das erste ausgewählte Objekt zurück, oder null, wenn keins ausgewählt ist.
     * Nützlich für Fälle, wo nur eine Einzelauswahl relevant ist.
     * @returns {THREE.Object3D | null}
     */
    getSingleSelectedObject() {
         return this.selectedObjects[0] || null;
    }
} // Ende class SelectionManager

export default SelectionManager;