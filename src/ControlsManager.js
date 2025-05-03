// src/ControlsManager.js (Mit Phase 2 Logik)

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
// Stelle sicher, dass utils importiert wird und tempBox/tempSize enthält
import { tempBox, tempSize } from './utils.js';

// Hilfsmatrizen für Berechnungen (global für die Klasse oder pro Methode neu erstellen)
const mat4 = new THREE.Matrix4();
const vec3 = new THREE.Vector3(); // Zusätzlicher Hilfsvektor

class ControlsManager {
    // SelectionManager wird jetzt über setSelectionManager gesetzt
    constructor(camera, domElement) {
        if (!camera || !domElement) {
            throw new Error("ControlsManager requires camera and domElement!");
        }
        this.camera = camera;
        this.domElement = domElement;
        this.selectionManager = null; // Wird später gesetzt
        this.scene = null; // Wird in init gesetzt

        this.orbitControls = null;
        this.transformControls = null;
        this.isDraggingGizmo = false;

        // Zustand für Multi-Transformation
        this.isTransformingMultiGroup = false;
        this.multiGroupTransformStart = new THREE.Matrix4();
        this.childDataMap = new Map(); // { child: { initialMatrixWorld, originalParent } }

        // Methoden binden
        this.onDraggingChanged = this.onDraggingChanged.bind(this);
        this.onTransformStart = this.onTransformStart.bind(this);
        this.onTransformEnd = this.onTransformEnd.bind(this);
    }

    // NEU: Setter-Methode für SelectionManager
    setSelectionManager(selectionManager) {
        this.selectionManager = selectionManager;
        console.log("[ControlsManager] SelectionManager reference set.");
    }

    init(scene) { // Szene wird hier übergeben
        this.scene = scene; // Szene speichern für später (Fallback Reparenting)
        console.log("[ControlsManager] Initializing...");

        // OrbitControls
        this.orbitControls = new OrbitControls(this.camera, this.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.1;
        console.log("[ControlsManager] OrbitControls initialized.");

        // TransformControls
        this.transformControls = new TransformControls(this.camera, this.domElement);
        this.transformControls.visible = false;
        this.transformControls.name = "TransformControlsGizmo";
        this.transformControls.renderOrder = 999;

        // Listener hinzufügen
        this.transformControls.addEventListener('dragging-changed', this.onDraggingChanged);
        this.transformControls.addEventListener('mouseDown', this.onTransformStart);
        this.transformControls.addEventListener('mouseUp', this.onTransformEnd);

        if (this.scene) {
             this.scene.add(this.transformControls);
             console.log("[ControlsManager] TransformControls initialized, listeners added, and added to scene.");
        } else {
            console.error("[ControlsManager] Scene object not provided during init!");
        }
    }

    onDraggingChanged(event) {
        if (!this.orbitControls) return;
        const dragging = event.value;
        this.orbitControls.enabled = !dragging;
        this.isDraggingGizmo = dragging;
    }

    update(deltaTime) {
        if (this.orbitControls?.enabled) {
            this.orbitControls.update();
        }
    }

    attach(object) {
        console.log(`[ControlsManager] Attaching TC to: ${object?.name || object?.uuid}`);
        if (this.transformControls && object) {
            try {
                // Wichtig: Vor dem Anhängen sicherstellen, dass keine alte Transformation läuft
                 if (this.isTransformingMultiGroup) {
                    console.warn("[ControlsManager] Attach called while multi-transform was potentially active. Resetting state.");
                    this.resetMultiTransformState(); // Zustand sicherheitshalber zurücksetzen
                 }

                this.transformControls.attach(object);
                this.transformControls.visible = true;
                this.calculateGizmoSize(object);
                console.log(`[ControlsManager] TC Attached. Visible: ${this.transformControls.visible}, Size: ${this.transformControls.size.toFixed(2)}`);
            } catch(e) {
                 console.error(`[ControlsManager] Error attaching TC to ${object?.name || object?.uuid}:`, e);
                 this.detach();
            }
        } else {
             console.warn("[ControlsManager] Attach called with no object or TC not initialized.");
        }
    }

    // Angepasstes Detach prüft auf laufende Multi-Transformation
    detach() {
        console.log("[ControlsManager] Detach requested.");

        // Wenn gerade eine Multi-Transformation lief, diese sauber beenden
        if (this.isTransformingMultiGroup) {
             console.warn("[ControlsManager] Detach called during multi-group transform! Applying final transform before detaching.");
             this.onTransformEnd(); // Diese Methode kümmert sich um das Detachen und Aufräumen
             return; // onTransformEnd hat bereits alles erledigt
        }

        // Normales Detach für Einzelauswahl oder wenn nichts dran war
        if (this.transformControls) {
            if (this.transformControls.object) { // Nur detachen, wenn wirklich was dran hängt
                 console.log("[ControlsManager] Performing actual detach.");
                this.transformControls.detach();
                this.transformControls.visible = false;
            } else {
                 // console.log("[ControlsManager] Detach requested, but nothing attached.");
                 this.transformControls.visible = false; // Sicherstellen, dass es unsichtbar ist
            }
        }
        // OrbitControls nur aktivieren, wenn wir nicht gerade das Ziehen des Gizmos beendet haben
        if (this.orbitControls && !this.isDraggingGizmo) {
             this.orbitControls.enabled = true;
             // console.log("[ControlsManager] OrbitControls potentially re-enabled on detach.");
        } else {
             // console.log("[ControlsManager] OrbitControls not re-enabled (isDraggingGizmo=", this.isDraggingGizmo, ")");
        }
    }

    // Gizmo-Größe berechnen (mit optional unterschiedlichem Faktor)
    calculateGizmoSize(object) {
         if (!this.transformControls || !object) return;
         try {
            // Prüfen ob utils vorhanden sind
            if (typeof tempBox === 'undefined' || typeof tempSize === 'undefined') {
                 console.warn("[ControlsManager] tempBox/tempSize not available from utils. Using default Gizmo size.");
                 this.transformControls.size = 1; return;
            }
            tempBox.setFromObject(object, true);
            if (!tempBox.isEmpty() && isFinite(tempBox.min.x) && isFinite(tempBox.max.x)) {
                tempBox.getSize(tempSize); // Nutze tempSize aus utils
                const maxDim = Math.max(tempSize.x, tempSize.y, tempSize.z);
                if (maxDim > 0 && isFinite(maxDim)) {
                    // ANPASSBARER Faktor: Gruppe etwas kleiner darstellen?
                    const scaleFactor = object.name === 'MultiSelect_Gizmo_Group' ? 0.15 : 0.2;
                    this.transformControls.size = Math.max(0.1, maxDim * scaleFactor);
                } else { this.transformControls.size = 1; }
            } else { this.transformControls.size = 1; }
         } catch (e) {
             console.error("[ControlsManager] Error calculating BBox for Gizmo size:", e);
             this.transformControls.size = 1;
         }
     }

    // --- Phase 2: Event Handlers ---

    onTransformStart(event) {
        // Prüfen, ob SelectionManager vorhanden und das Objekt die Gruppe ist
        const attachedObject = this.transformControls?.object;
        if (!this.selectionManager || !attachedObject || attachedObject !== this.selectionManager.multiSelectionGroup) {
            this.resetMultiTransformState(); // Zustand zurücksetzen, falls es keine Gruppe ist
            return;
        }

        console.log("[ControlsManager] Multi-group transform started.");
        this.isTransformingMultiGroup = true;
        this.childDataMap.clear();

        // Start-Weltmatrix der Gruppe speichern
        attachedObject.updateMatrixWorld(true);
        this.multiGroupTransformStart.copy(attachedObject.matrixWorld);

        // Start-Daten für jedes Kind speichern
        const childrenToStore = [...attachedObject.children]; // Kopie!
        childrenToStore.forEach(child => {
            const originalParent = this.selectionManager.originalParents.get(child);
            if (originalParent) {
                 child.updateMatrixWorld(true); // Aktuelle Weltmatrix holen
                 this.childDataMap.set(child, {
                     initialMatrixWorld: child.matrixWorld.clone(),
                     originalParent: originalParent
                 });
            } else { /* Warnung */ }
        });
        console.log(`[ControlsManager] Stored initial state for ${this.childDataMap.size} objects.`);
    }


     onTransformEnd(event) {
          // Nur handeln, wenn wir eine Multi-Gruppen-Transformation beenden
          if (!this.isTransformingMultiGroup || !this.selectionManager) {
              // Flag nur zurücksetzen, wenn es nicht sowieso false war
              if (this.isTransformingMultiGroup) this.resetMultiTransformState();
              return;
          }

          console.log("[ControlsManager] Multi-group transform ended. Applying transforms...");
          const group = this.transformControls.object; // Sollte die multiSelectionGroup sein

          if (!group || this.childDataMap.size === 0) {
               console.error("[ControlsManager] TransformEnd: Invalid state!");
               this.resetMultiTransformState();
               this.detach(); // Versuch zu detachen
               this.selectionManager?.detachAndCleanupMultiGroup();
               return;
          }

          // Aktuelle Welt-Matrix der Gruppe holen
          group.updateMatrixWorld(true);
          const multiGroupTransformEnd = group.matrixWorld;

          // Delta-Transformation berechnen: T_delta = T_end * T_start^(-1)
          const multiGroupTransformStartInverse = this.multiGroupTransformStart.clone().invert();
          const deltaTransform = mat4.multiplyMatrices(multiGroupTransformEnd, multiGroupTransformStartInverse);

          // --- WICHTIG: Gizmo VOR dem Umhängen entfernen ---
          // Wir rufen detach() auf, was auch OrbitControls wieder aktiviert
          // UND das Flag isTransformingMultiGroup auf false setzt (verhindert Rekursion)
          console.log("[ControlsManager] Detaching controls before applying transforms...");
          this.detach(); // Ruft intern transformControls.detach() etc. auf

          console.log(`[ControlsManager] Applying delta transform to ${this.childDataMap.size} objects...`);
          // Verwende try...finally auch hier für Robustheit beim Anwenden
          try {
              this.childDataMap.forEach((data, child) => {
                  const { initialMatrixWorld, originalParent } = data;

                  if (!originalParent || typeof originalParent.add !== 'function') {
                       console.warn("Invalid original parent for child during transform apply:", child.name);
                       if(this.scene) this.scene.add(child); // Fallback
                       return; // Skip this child
                  }

                  // 1. Neue ZIEL-Welt-Matrix des Kindes berechnen:
                  const finalChildMatrixWorld = new THREE.Matrix4().multiplyMatrices(deltaTransform, initialMatrixWorld);

                  // 2. Kind zurück an ursprünglichen Parent hängen
                  originalParent.add(child); // Entfernt Kind aus Gruppe

                  // 3. Lokale Matrix des Kindes relativ zum neuen Parent berechnen
                  originalParent.updateMatrixWorld(true); // Parent Matrix muss aktuell sein!
                  const parentMatrixWorldInverse = originalParent.matrixWorld.clone().invert();
                  const finalChildMatrixLocal = new THREE.Matrix4().multiplyMatrices(parentMatrixWorldInverse, finalChildMatrixWorld);

                  // 4. Lokale Matrix auf Kind anwenden und zerlegen
                  child.matrix.copy(finalChildMatrixLocal);
                  child.matrix.decompose(child.position, child.quaternion, child.scale);

                  console.log(`Applied transform to ${child.name || child.uuid}`);
              });
          } catch (applyError) {
               console.error("[ControlsManager] Error applying transforms back to children:", applyError);
               // Was tun bei Fehler? Objekte könnten in inkonsistentem Zustand sein!
          } finally {
              console.log("[ControlsManager] Finished applying transforms loop.");

              // 5. SelectionManager Gruppe FINAL aufräumen lassen
              console.log("[ControlsManager] Requesting final cleanup from SelectionManager...");
              // detachAndCleanupMultiGroup sollte jetzt nur noch die leere Gruppe entfernen
              // und isMultiSelectActive auf false setzen.
              this.selectionManager.detachAndCleanupMultiGroup();

              // 6. Internen Zustand HIER ZURÜCKSETZEN
              this.resetMultiTransformState();
          }
     }

    // NEU: Hilfsmethode zum Zurücksetzen des Multi-Transform-Zustands
    resetMultiTransformState() {
        // console.log("[ControlsManager] Resetting multi-transform state.");
        this.isTransformingMultiGroup = false;
        this.childDataMap.clear();
        this.multiGroupTransformStart = null; // Oder .identity()? Sicherer ist null.
    }

    // --- Getter ---
    getTransformControls() { return this.transformControls; }
    getOrbitControls() { return this.orbitControls; }
    getAttachedObject() {
        return this.transformControls?.object || null; // Gibt das Objekt zurück, das am Gizmo hängt
    }

} // Ende class ControlsManager

export default ControlsManager;