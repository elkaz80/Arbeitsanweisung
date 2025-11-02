// src/Managers/ControlsManager.js (Verbesserte Version)

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// Hilfsmatrizen
const mat4 = new THREE.Matrix4(); // Wiederverwendbar

class ControlsManager {
    constructor(camera, renderer, scene) {
        console.log("[ControlsManager] Constructor called.");
        // Validate essential dependencies
        if (!camera || !renderer || !scene) {
            console.error("[ControlsManager] Constructor Error: Missing required arguments (camera, renderer, or scene).");
            throw new Error("ControlsManager requires camera, renderer, and scene!");
        }
        if (!renderer.domElement) {
             console.error("[ControlsManager] Constructor Error: Provided renderer is missing 'domElement'.");
             throw new Error("ControlsManager: Provided renderer is invalid!");
        }

        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.domElement = renderer.domElement;
        this.selectionManager = null;

        this.orbitControls = null;
        this.transformControls = null;
        this.isDraggingGizmo = false;

        // --- State for Pivot Transformation ---
        this.isTransformingPivot = false;
        this.pivotTransformStart = new THREE.Matrix4();
        this.selectedObjectsAtPivotStart = [];
        this.objectDataAtPivotStart = new Map();

        // Bind methods
        this.onDraggingChanged = this.onDraggingChanged.bind(this);
        this.onTransformStart = this.onTransformStart.bind(this);
        this.onTransformEnd = this.onTransformEnd.bind(this);

        console.log("[ControlsManager] Constructor: Dependencies stored.");
    }

    setSelectionManager(selectionManager) {
        this.selectionManager = selectionManager;
        console.log("[ControlsManager] SelectionManager reference set.");
    }

    init() {
        console.log("[ControlsManager] Initializing...");

        // --- OrbitControls Initialization ---
        try {
            if (this.camera && this.domElement) {
                this.orbitControls = new OrbitControls(this.camera, this.domElement);
                this.orbitControls.enableDamping = true;
                this.orbitControls.dampingFactor = 0.1;
                console.log("[ControlsManager] OrbitControls initialized.");
            } else {
                console.error("[ControlsManager] Cannot init OrbitControls: camera or domElement missing.");
            }
        } catch (error) {
            console.error("[ControlsManager] Error initializing OrbitControls:", error);
        }

        // --- TransformControls Initialization ---
        try {
            if (!this.camera || !this.renderer || !this.renderer.domElement) {
                throw new Error("Camera or Renderer not properly initialized before TransformControls creation.");
            }

            // Create TransformControls instance
            this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
            this.transformControls.visible = false; // Start invisible
            this.transformControls.name = "TransformControlsGizmo";
            this.transformControls.renderOrder = 999; // Render on top

            // WICHTIG: TransformControls zur Szene hinzufügen!
            this.scene.add(this.transformControls);
            console.log("[ControlsManager] TransformControls added to scene.");

            console.log("[ControlsManager] TransformControls instance created successfully.");

            // --- Add Event Listeners ---
            // Listener for debugging position changes (optional, kann für Production entfernt werden)
            this.transformControls.addEventListener('objectChange', () => {
                if (this.transformControls?.object) {
                    // Auskommentiert um Log-Spam zu vermeiden
                    // console.log(`[ControlsManager] Object position changed:`, this.transformControls.object.position);
                }
            });
            
            // Listener to disable OrbitControls while dragging gizmo
            this.transformControls.addEventListener('dragging-changed', this.onDraggingChanged);
            
            // Listeners for Pivot Transformation logic
            this.transformControls.addEventListener('mouseDown', this.onTransformStart);
            this.transformControls.addEventListener('mouseUp', this.onTransformEnd);

        } catch (error) {
            console.error("[ControlsManager] Error initializing TransformControls:", error);
            this.transformControls = null;
        }

        console.log("[ControlsManager] Initialization finished.");
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
        const objectId = object?.name || object?.uuid || 'Unknown';
        console.log(`[ControlsManager] Attaching TC to: ${objectId}`);
    
        if (!this.transformControls) {
            console.warn("[ControlsManager] Attach called but TransformControls are not initialized. Aborting.");
            return;
        }
        if (!object) {
            console.warn("[ControlsManager] Attach called with null object. Detaching if necessary.");
            this.detach();
            return;
        }
    
        try {
            if (this.isTransformingPivot && this.transformControls.object !== object) {
                console.warn("[ControlsManager] Attach called while pivot transform was active! Resetting state.");
                this.resetPivotTransformState();
            }
    
            // Attach the controls to the new object
            this.transformControls.attach(object);
            this.transformControls.visible = true;
    
            // Fixe Größe für bessere Sichtbarkeit
            const desiredFixedSize = 1.0;
            this.transformControls.size = desiredFixedSize;
    
            const targetType = (this.selectionManager && object === this.selectionManager.getPivotObject()) ? "Pivot" : "Object";
            console.log(`[ControlsManager] TC Attached to ${targetType} (${objectId}). Visible: ${this.transformControls.visible}, Size: ${this.transformControls.size.toFixed(2)}`);
    
        } catch(e) {
            console.error(`[ControlsManager] Error attaching TC to ${objectId}:`, e);
            this.detach();
        }
    }
    
    detach() {
        console.log("[ControlsManager] Detach requested.");
    
        if (this.isTransformingPivot) {
            console.warn("[ControlsManager] Detach called during pivot transform! Resetting state.");
            this.resetPivotTransformState();
        }
    
        if (this.transformControls) {
            const currentlyAttached = this.transformControls.object;
            if (currentlyAttached) {
                const objectId = currentlyAttached.name || currentlyAttached.uuid;
                console.log(`[ControlsManager] Performing actual detach from ${objectId}.`);
                this.transformControls.detach();
            }
            this.transformControls.visible = false;
        }
    
        if (this.orbitControls && !this.isDraggingGizmo) {
            this.orbitControls.enabled = true;
        }
        this.isDraggingGizmo = false;
    }

    setTransformMode(mode) {
        if (!this.transformControls) return;
        
        const validModes = ['translate', 'rotate', 'scale'];
        if (!validModes.includes(mode)) {
            console.warn(`[ControlsManager] Invalid transform mode: ${mode}`);
            return;
        }
        
        this.transformControls.mode = mode;
        console.log(`[ControlsManager] Transform mode set to: ${mode}`);
    }

    // --- Pivot Transformation Start Logic ---
    onTransformStart(event) {
        if (!this.selectionManager || !this.transformControls) return;

        const attachedObject = this.transformControls.object;
        const pivotObject = this.selectionManager.getPivotObject();

        if (attachedObject && attachedObject === pivotObject && this.selectionManager.getSelectedObjects().length > 1) {
            console.log("[ControlsManager] Pivot transform started.");
            this.isTransformingPivot = true;
            this.objectDataAtPivotStart.clear();

            pivotObject.updateMatrixWorld(true);
            this.pivotTransformStart.copy(pivotObject.matrixWorld);

            this.selectedObjectsAtPivotStart = [...this.selectionManager.getSelectedObjects()];
            this.selectedObjectsAtPivotStart.forEach(obj => {
                obj.updateMatrixWorld(true);
                this.objectDataAtPivotStart.set(obj, {
                    initialMatrixWorld: obj.matrixWorld.clone()
                });
            });
            console.log(`[ControlsManager] Stored initial state for ${this.objectDataAtPivotStart.size} objects (Pivot).`);
        } else {
            this.resetPivotTransformState();
        }
    }

    // --- Pivot Transformation End Logic ---
    onTransformEnd(event) {
        if (!this.isTransformingPivot || !this.selectionManager || this.selectedObjectsAtPivotStart.length === 0) {
            if (this.isTransformingPivot) this.resetPivotTransformState();
            return;
        }

        console.log("[ControlsManager] Pivot transform ended. Applying delta transforms...");
        const pivot = this.transformControls?.object;

        if (!pivot || this.objectDataAtPivotStart.size !== this.selectedObjectsAtPivotStart.length) {
            console.error("[ControlsManager] Pivot TransformEnd: Invalid state! Aborting.");
            this.resetPivotTransformState();
            if (this.transformControls?.object) this.detach();
            return;
        }

        pivot.updateMatrixWorld(true);
        const pivotTransformEnd = pivot.matrixWorld;

        const pivotTransformStartInverse = this.pivotTransformStart.clone().invert();
        const deltaTransform = mat4.multiplyMatrices(pivotTransformEnd, pivotTransformStartInverse);

        console.log(`[ControlsManager] Applying Pivot delta transform to ${this.selectedObjectsAtPivotStart.length} objects...`);
        
        try {
            this.selectedObjectsAtPivotStart.forEach(obj => {
                const storedData = this.objectDataAtPivotStart.get(obj);
                if (!storedData?.initialMatrixWorld) {
                    console.warn(`[ControlsManager] No initial data found for object: ${obj.name || obj.uuid}. Skipping.`);
                    return;
                }
                const initialMatrixWorld = storedData.initialMatrixWorld;

                const finalObjectMatrixWorld = new THREE.Matrix4().multiplyMatrices(deltaTransform, initialMatrixWorld);

                const parent = obj.parent;
                if (!parent) {
                    console.warn(`[ControlsManager] Object ${obj.name || obj.uuid} has no parent. Skipping transform application.`);
                    return;
                }
                parent.updateMatrixWorld(true);
                const parentMatrixWorldInverse = parent.matrixWorld.clone().invert();
                const finalObjectMatrixLocal = new THREE.Matrix4().multiplyMatrices(parentMatrixWorldInverse, finalObjectMatrixWorld);

                obj.matrixAutoUpdate = false;
                obj.matrix.copy(finalObjectMatrixLocal);
                obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
                obj.matrixAutoUpdate = true;
                obj.matrixWorldNeedsUpdate = true;

                // Sanity check
                if (!isFinite(obj.position.x) || !isFinite(obj.quaternion.x) || !isFinite(obj.scale.x) ||
                    isNaN(obj.position.x) || isNaN(obj.quaternion.x) || isNaN(obj.scale.x)) {
                    console.error(`!!! Invalid transform result for ${obj.name || obj.uuid} !!!`);
                }
            });
        } catch (applyError) {
            console.error("[ControlsManager] Error during pivot delta transform application:", applyError);
        } finally {
            console.log("[ControlsManager] Finished applying pivot delta transforms.");
            this.resetPivotTransformState();
            if (this.transformControls?.object === pivot) {
                this.detach();
            }
            console.log("[ControlsManager] Pivot onTransformEnd finished.");
        }
    }

    resetPivotTransformState() {
        this.isTransformingPivot = false;
        this.selectedObjectsAtPivotStart = [];
        this.objectDataAtPivotStart.clear();
        if (this.pivotTransformStart) {
            this.pivotTransformStart.identity();
        } else {
            this.pivotTransformStart = new THREE.Matrix4();
        }
    }

    // --- Getters ---
    getTransformControls() { 
        return this.transformControls; 
    }
    
    getOrbitControls() { 
        return this.orbitControls; 
    }
    
    getAttachedObject() { 
        return this.transformControls?.object || null; 
    }

} // End class ControlsManager

export default ControlsManager;
