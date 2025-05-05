// src/Core/AppManager.js (Refaktorierte Version nach Auslagerung des Setups)

import * as THREE from 'three';
// Loader für Environment Maps (werden in setEnvironment benötigt)
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { CubeTextureLoader } from 'three';
// Import für utils, wird in applyAnimations benötigt
import { hasInvalidTransform } from '../Utils/utils.js'; // Korrekter Pfad von Core/ nach Utils/

class AppManager {
    /**
     * Verwaltet die Kernkomponenten der Three.js-Anwendung (Renderer, Szene, Kamera, Loop).
     * @param {HTMLCanvasElement} canvas - Das Canvas-Element für WebGL.
     * @param {HTMLElement} container - Das Container-Element für Größenanpassungen.
     */
    constructor(canvas, container) {
        if (!canvas || !container) {
            throw new Error("AppManager requires canvas and container elements!");
        }
        this.canvas = canvas;
        this.container = container;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.cameraPivot = null;
        this.clock = new THREE.Clock();
        this.updateCallback = null; // Externer Callback für den Update-Loop

        // Manager-Referenzen (werden extern gesetzt)
        this.uiManager = null;
        this.selectionManager = null;
        this.controlsManager = null;
        this.html3DManager = null;
        this.animationManager = null;
        this.connectorManager = null; // Hinzugefügt

        // Referenzen auf Szene-Objekte (werden extern gesetzt)
        this.ambientLight = null;
        this.directionalLight = null;
        this.floor = null;

        // Loader Instanzen
        this.rgbeLoader = new RGBELoader();
        this.cubeTextureLoader = new CubeTextureLoader();

        // Methoden binden
        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    /**
     * Speichert Referenzen auf andere Manager.
     * Wird von main.js aufgerufen, nachdem alle Manager instanziiert wurden.
     */
    setManagers(uiManager, selectionManager, controlsManager, html3DManager, animationManager, connectorManager) {
        this.uiManager = uiManager;
        this.selectionManager = selectionManager;
        this.controlsManager = controlsManager;
        this.html3DManager = html3DManager;
        this.animationManager = animationManager;
        this.connectorManager = connectorManager; // Gespeichert
        console.log("[AppManager] Manager references set.");
    }

    /**
     * Speichert Referenzen auf initial erstellte Szene-Objekte.
     * Wird von main.js nach dem Aufruf von SceneSetup aufgerufen.
     */
    setInitialSceneObjects(lights, floor) {
         if(lights) {
             this.ambientLight = lights.ambientLight;
             this.directionalLight = lights.directionalLight;
             console.log("[AppManager] Light object references stored.");
         }
         this.floor = floor;
         if (this.floor) console.log("[AppManager] Floor object reference stored.");
    }

    /**
     * Initialisiert Renderer, Szene und Kamera. Fügt keine Lichter/Boden/Helper mehr hinzu.
     */
    init() {
        console.log("[AppManager] Initializing Core (Renderer, Scene, Camera)...");

        // 1. Renderer
        try {
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setClearColor(0x1a1d21, 1); // Hintergrundfarbe
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.shadowMap.enabled = true; // Schatten aktivieren
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Weiche Schatten
            this.renderer.domElement.addEventListener('webglcontextlost', (e) => console.error('WebGL Context Lost!', e), false);
            this.renderer.domElement.addEventListener('webglcontextrestored', () => console.log('WebGL Context Restored.'), false);
        } catch (e) { console.error("Error initializing WebGL Renderer:", e); throw e; }


        // 2. Szene
        this.scene = new THREE.Scene();
        // Optional: Standard-Hintergrundfarbe setzen
        // this.scene.background = new THREE.Color(0x333333);

        // 3. Kamera & Pivot
        const aspectRatio = this.container.clientWidth / this.container.clientHeight || 1;
        this.camera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 1000); // FOV 60 als Standard
        this.cameraPivot = new THREE.Object3D();
        this.cameraPivot.name = "CameraPivot";
        this.scene.add(this.cameraPivot); // Pivot direkt zur Szene
        this.cameraPivot.add(this.camera);  // Kamera in den Pivot
        this.camera.position.set(0, 4, 10); // Angepasste Startposition
        this.camera.lookAt(this.cameraPivot.position); // Schaut zum Pivot-Ursprung
        console.log("[AppManager] Camera initialized and added to pivot.");

        // 4. Resize-Listener hinzufügen und initial ausführen
        window.addEventListener('resize', this.handleResize);
        this.handleResize(); // Setzt initiale Renderer-Größe und Kamera-Aspekt

        console.log("[AppManager] Core initialization complete.");
    }

    /**
     * Passt Renderer und Kamera an die Fenstergröße an. Informiert andere Manager.
     */
    handleResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        if (width === 0 || height === 0) return; // Ignoriere ungültige Größen

        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        // Informiere andere Manager über die Größenänderung
        this.html3DManager?.resize(width, height);
        this.connectorManager?.updateResolution(width, height); // Connector Linienstärke anpassen

        // console.log(`[AppManager] Resized to ${width}x${height}`);
    }

    /** Setzt den Update-Callback */
    setUpdateCallback(callback) { this.updateCallback = callback; }

    /** Startet den Render-Loop */
    start() {
        console.log("[AppManager] Starting loop.");
        if (!this.renderer) { console.error("Renderer not initialized!"); return; }
        // Initiales OrbitControls Target setzen
        if(this.controlsManager?.orbitControls && this.cameraPivot) {
            this.controlsManager.orbitControls.target.copy(this.cameraPivot.position);
            this.controlsManager.orbitControls.update();
        }
        this.renderer.setAnimationLoop(this.animate);
    }

    /** Stoppt den Render-Loop */
    stop() {
        if (!this.renderer) return;
        this.renderer.setAnimationLoop(null);
        console.log("[AppManager] Loop stopped.");
    }

    /** Der eigentliche Render-Loop */
    animate(time) { // 'time' wird von setAnimationLoop übergeben (in Millisekunden)
        const timeSeconds = time / 1000; // Umrechnung in Sekunden für Konsistenz
        const deltaTime = this.clock.getDelta(); // Zeit seit letztem Frame

        // Updates anderer Manager aufrufen
        if (this.updateCallback) {
            this.updateCallback(deltaTime, timeSeconds); // Übergebe Delta und Gesamtzeit
        }

        // Animationen anwenden (nutzt intern currentTime vom AnimationManager)
        this.applyAnimations(this.animationManager?.getCurrentTime() ?? timeSeconds);

        // Rendern
        try {
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
            // HTML 3D Szene rendern
            this.html3DManager?.render(this.scene, this.camera);
        } catch (e) { console.error("Render error:", e); this.stop(); } // Loop stoppen bei Renderfehler
    }

    /** Wendet Keyframe-Animationen an */
    applyAnimations(currentTime) { // Nimmt jetzt explizit die Zeit entgegen
       if (!this.animationManager || !this.scene || !this.controlsManager || !this.selectionManager) return;
       const isGizmoDragging = this.controlsManager.isDraggingGizmo;
       const selectedObj = this.selectionManager.getSingleSelectedObject();

       // Iteriere durch animierte Objekte (UUIDs als Schlüssel in keyframes)
       for (const uuid in this.animationManager.keyframes) {
           const obj = this.scene.getObjectByProperty('uuid', uuid);
           if (!obj) continue; // Objekt nicht (mehr) in Szene

           // Überspringe Animation, wenn Objekt ausgewählt ist UND der Gizmo bewegt wird
           if (!(isGizmoDragging && obj === selectedObj)) {
               if (!hasInvalidTransform(obj)) { // hasInvalidTransform muss importiert sein
                   const animatedValues = this.animationManager.getAnimatedValues(obj, currentTime);

                   // Wende Werte an, wenn vorhanden
                   if (animatedValues.position) obj.position.copy(animatedValues.position);
                   if (animatedValues.quaternion) obj.quaternion.copy(animatedValues.quaternion);
                   // Skalierung nicht auf Kamera-Pivot anwenden
                   if (animatedValues.scale && obj !== this.cameraPivot) obj.scale.copy(animatedValues.scale);

                   // OrbitControls Target anpassen, wenn Pivot animiert wird
                   if (obj === this.cameraPivot && this.controlsManager.orbitControls?.enabled && (animatedValues.position || animatedValues.quaternion)) {
                       this.controlsManager.orbitControls.target.copy(this.cameraPivot.position);
                   }
               }
           }
       }
   }


    // --- Getter ---
    getScene() { return this.scene; }
    getCamera() { return this.camera; }
    getRenderer() { return this.renderer; }
    getCameraPivot() { return this.cameraPivot; }
    getFloorObject() { return this.scene.getObjectByName("Floor"); } // Verwendet den Namen
    getCameraFov() { return this.camera?.fov || 75; }

    // --- Methoden für UI Callbacks ---

    /** Setzt Umgebungstextur */
    setEnvironment(pathOrArray) {
        if (!pathOrArray) { this.scene.environment = null; this.scene.background = new THREE.Color(0x333333); /*...*/ this.updateAllMaterials(); return; } // Standardfarbe bei 'Keine'
        if (typeof pathOrArray === 'string' && pathOrArray.endsWith('.hdr')) {
            this.rgbeLoader.load(pathOrArray, (texture) => { texture.mapping = THREE.EquirectangularReflectionMapping; this.scene.environment = texture; this.scene.background = texture; this.updateAllMaterials(); /*...*/ }, undefined, (error) => console.error(`Failed HDR: ${pathOrArray}`, error));
        } else if (Array.isArray(pathOrArray) && pathOrArray.length === 6) {
            this.cubeTextureLoader.load(pathOrArray, (texture) => { this.scene.environment = texture; this.scene.background = texture; this.updateAllMaterials(); /*...*/ }, undefined, (error) => console.error(`Failed CubeTexture: ${pathOrArray}`, error));
        } else { /*...*/ }
    }

    /** Schaltet Licht an/aus */
    toggleLight(lightName, isEnabled) {
        let light = null;
        if (lightName === 'AmbientLight' && this.ambientLight) light = this.ambientLight;
        else if (lightName === 'DirectionalLight' && this.directionalLight) light = this.directionalLight;
        else light = this.scene.getObjectByName(lightName);

        if (light?.isLight) { light.visible = isEnabled; console.log(`Light '${lightName}' visibility: ${isEnabled}`); /* Helper? */ }
        else { console.warn(`Light '${lightName}' not found.`); }
    }

    /** Setzt Kamera FOV */
    setCameraFov(fov) {
        if (this.camera?.isPerspectiveCamera) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    }

    /** Erzwingt Material Update */
    updateAllMaterials() {
         this.scene.traverse((child) => { if (child.isMesh && child.material) { const mats = Array.isArray(child.material) ? child.material : [child.material]; mats.forEach(mat => { if(mat) mat.needsUpdate = true; }); } });
         console.log("[AppManager] Flagged materials for update.");
     }

     /** Setzt Bodenmaterial */
     setFloorMaterial(newMaterial) {
         if (!newMaterial) { console.error("setFloorMaterial: invalid material."); return; }
         const floorObject = this.getFloorObject();
         if (floorObject?.isMesh) {
             // Optional: Altes Material disposen
             // if (floorObject.material && floorObject.material !== newMaterial && ...) floorObject.material.dispose();
             floorObject.material = newMaterial;
             console.log(`[AppManager] Floor material set to: ${newMaterial.name || 'Unnamed'}`);
         } else { console.error("Floor object not found for setFloorMaterial."); }
     }


    // --- Szenen-Modifikation ---
    addObjectToScene(obj) {
        if (obj) { /*...*/ this.scene.add(obj); console.log(`[AppManager] Added: ${obj.name || obj.uuid}`); this.uiManager?.objectGraphPanel?.updateObjectList(); } // Ruft ObjectGraphPanel auf
    }
    removeObjectFromScene(obj) {
         if (obj) { /*...*/ obj.removeFromParent(); console.log(`[AppManager] Removed: ${obj.name || obj.uuid}`); this.uiManager?.objectGraphPanel?.updateObjectList(); this.animationManager?.removeKeyframesForObject(obj); this.connectorManager?.removeConnectorsForObject(obj); } // Ruft ObjectGraphPanel auf, entfernt Animationen & Connectoren
    }
} // Ende class AppManager

export default AppManager;