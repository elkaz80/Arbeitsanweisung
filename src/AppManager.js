// src/AppManager.js

import * as THREE from 'three';

class AppManager {
    constructor(canvas, container) {
        this.canvas = canvas;
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cameraPivot = null;
        this.clock = new THREE.Clock();
        this.updateCallback = null; // Callback für Updates im Loop
        this.uiManager = null;      // Referenzen zu anderen Managern
        this.selectionManager = null;
        this.controlsManager = null;
        this.html3DManager = null;
        this.animationManager = null;

        this.animate = this.animate.bind(this); // 'this' binden
    }

    // Methode zum Setzen der Manager-Referenzen (wird von main.js aufgerufen)
    setManagers(uiManager, selectionManager, controlsManager, html3DManager, animationManager) {
        this.uiManager = uiManager;
        this.selectionManager = selectionManager;
        this.controlsManager = controlsManager;
        this.html3DManager = html3DManager;
        this.animationManager = animationManager;
    }

    init() {
        console.log("[AppManager] Initializing...");

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true }); // Alpha für CSS Overlay
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x1a1d21, 1); // Dunkler Hintergrund (aus Theme)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Schatten aktivieren
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Weiche Schatten

        // WebGL Kontext Listener
        this.renderer.domElement.addEventListener('webglcontextlost', (e) => console.error('WebGL Context Lost!', e), false);
        this.renderer.domElement.addEventListener('webglcontextrestored', () => console.log('WebGL Context Restored.'), false);

        // Szene
        this.scene = new THREE.Scene();

        // Kamera & Pivot
        const aspectRatio = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 1000); // Etwas weniger FOV
        this.cameraPivot = new THREE.Object3D(); this.cameraPivot.name = "CameraPivot";
        this.scene.add(this.cameraPivot); this.cameraPivot.add(this.camera);
        this.camera.position.set(0, 3, 8); // Startposition angepasst
        this.camera.lookAt(this.cameraPivot.position);
        console.log("[AppManager] Camera initialized.");

        // Lichter (mit Schatten)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Weniger Ambient
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Stärker Directional
        directionalLight.position.set(8, 15, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5; directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -15; directionalLight.shadow.camera.right = 15;
        directionalLight.shadow.camera.top = 15; directionalLight.shadow.camera.bottom = -15;
        this.scene.add(ambientLight); this.scene.add(directionalLight);
        console.log("[AppManager] Lights added (shadow enabled).");

        // Helpers (Grid bleibt, Achsen optional)
        const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444); // Dunkleres Grid
        this.scene.add(gridHelper);
        // const axesHelper = new THREE.AxesHelper(5); this.scene.add(axesHelper);
        console.log("[AppManager] GridHelper added.");

        // Boden (Reflektierend + Schatten)
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3d41, // Dunkelgrauer Boden
            metalness: 0.1, // Leichte Reflektion
            roughness: 0.7, // Nicht zu glatt
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; floor.name = "Floor";
        floor.receiveShadow = true; // Boden empfängt Schatten
        this.scene.add(floor);
        console.log("[AppManager] Floor added.");

        // Test Cube (Optional, wirft Schatten)
        const testCubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const testCubeMaterial = new THREE.MeshStandardMaterial({ color: 0x5a9cf8 }); // Blau
        const testCube = new THREE.Mesh(testCubeGeometry, testCubeMaterial);
        testCube.position.set(0, 0.5, 0); testCube.name = "TestCube";
        testCube.castShadow = true; // Würfel wirft Schatten
        this.scene.add(testCube);
        console.log("[AppManager] Added TestCube (casts shadow).");

        // Initial Resize & Listener
        this.handleResize();
        window.addEventListener('resize', this.handleResize.bind(this));
        console.log("[AppManager] Initialization complete.");
    }

    handleResize() {
        if (!this.renderer || !this.camera || !this.container) return;
        const width = this.container.clientWidth; const height = this.container.clientHeight;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
        this.html3DManager?.resize(width, height); // CSS Renderer auch anpassen
        console.log(`[AppManager] Resized to ${width}x${height}`);
    }

    setUpdateCallback(callback) { this.updateCallback = callback; }

    // Haupt-Animationsloop
    animate() {
        requestAnimationFrame(this.animate);
        const deltaTime = this.clock.getDelta();
        const time = this.animationManager?.getCurrentTime() ?? this.clock.getElapsedTime(); // Zeit holen

        // Animationen anwenden (NEUE FUNKTION)
        this.applyAnimations(time);

        // Updates anderer Manager aufrufen
        if (this.updateCallback) {
            this.updateCallback(deltaTime, time); // Zeit übergeben
        }

        // Rendern
        try {
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
            // HTML 3D Szene rendern
            this.html3DManager?.render(this.scene, this.camera);
        } catch (e) { console.error("Render error:", e); }
    }

     // Wendet Keyframe-Animationen auf Objekte an
     applyAnimations(time) {
         if (!this.animationManager || !this.scene || !this.controlsManager || !this.selectionManager) return;
         const isGizmoDragging = this.controlsManager.isDraggingGizmo;
         const selectedObj = this.selectionManager.getSelectedObject();

         // Gehe durch alle Objekte, für die Keyframes existieren könnten
         for (const uuid in this.animationManager.keyframes) {
             const obj = this.scene.getObjectByProperty('uuid', uuid); // Finde Objekt in Szene
             // TODO: Auch cssScene durchsuchen für HTML-Elemente
             if (!obj) continue; // Objekt nicht (mehr) in Szene

             // Nur animieren, wenn NICHT ausgewählt und vom Gizmo gezogen
             if (!(isGizmoDragging && obj === selectedObj)) {
                 if (!hasInvalidTransform(obj)) {
                     const animatedValues = this.animationManager.getAnimatedValues(obj, time);
                     if (animatedValues.position) obj.position.copy(animatedValues.position);
                     if (animatedValues.quaternion) obj.quaternion.copy(animatedValues.quaternion);
                     if (animatedValues.scale && obj !== this.cameraPivot) obj.scale.copy(animatedValues.scale);

                     // Spezielle Prüfung für Kamera-Pivot-Update, damit OrbitControls folgt
                     if (obj === this.cameraPivot && this.controlsManager.orbitControls?.enabled && (animatedValues.position || animatedValues.quaternion)) {
                          this.controlsManager.orbitControls.target.copy(this.cameraPivot.position);
                     }
                 }
             }
         }
     }


    start() {
        console.log("[AppManager] Starting loop.");
        if (!this.controlsManager?.getOrbitControls()) { console.error("OrbitControls not ready!"); return; }
        this.controlsManager.getOrbitControls().target.copy(this.cameraPivot.position); // Initiales Ziel setzen
        this.controlsManager.getOrbitControls().update();
        this.animate();
    }

    // Getter für andere Module
    getScene() { return this.scene; }
    getCamera() { return this.camera; }
    getRenderer() { return this.renderer; }
    getCameraPivot() { return this.cameraPivot; }

    // Methoden zum Modifizieren der Szene
    addObjectToScene(obj) {
        if (obj) {
            obj.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } }); // Schatten für alle Meshes aktivieren
            this.scene.add(obj);
            console.log(`[AppManager] Added: ${obj.name || obj.uuid}`);
            this.uiManager?.updateObjectList(this.scene); // Objektliste im UI aktualisieren
        }
    }

    removeObjectFromScene(obj) {
         if (obj) {
            const name = obj.name || obj.uuid;
            // TODO: disposeNode(obj); // Wichtig: Ressourcen freigeben
            obj.removeFromParent();
            console.log(`[AppManager] Removed: ${name}`);
            this.uiManager?.updateObjectList(this.scene); // Objektliste im UI aktualisieren
            this.animationManager?.removeKeyframesForObject(obj); // Zugehörige Keyframes löschen
        }
    }
}

export default AppManager;