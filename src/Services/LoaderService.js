import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'; // NEU
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'; // NEU
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'; // NEU
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'; // NEU
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'; // NEU (Optional für GLTF)

// Stellen Sie sicher, dass diese utils importiert werden
import { hasInvalidTransform, tempBox, tempSize } from '../Utils/utils'; // Annahme: tempBox/tempSize sind THREE.Box3/Vector3

class LoaderService {
    constructor(appManager) {
        if (!appManager) throw new Error("LoaderService requires AppManager!");
        this.appManager = appManager;

        // Loader Instanzen erstellen
        this.gltfLoader = new GLTFLoader();
        this.objLoader = new OBJLoader();
        this.fbxLoader = new FBXLoader(); // NEU
        this.stlLoader = new STLLoader(); // NEU
        this.plyLoader = new PLYLoader(); // NEU
        this.colladaLoader = new ColladaLoader(); // NEU

        // --- Optional: DRACO Konfiguration für GLTF/GLB ---
        // const dracoLoader = new DRACOLoader();
        // // WICHTIG: Passe diesen Pfad an, wo die Draco-Decoder-Dateien liegen!
        // // Normalerweise relativ zum public/ oder dist/ Verzeichnis deiner Anwendung.
        // // Oder eine URL zu einem CDN.
        // dracoLoader.setDecoderPath('/libs/draco/gltf/'); // Beispielpfad
        // dracoLoader.setDecoderConfig({ type: 'js' }); // oder 'wasm'
        // this.gltfLoader.setDRACOLoader(dracoLoader);
        // console.log("[LoaderService] DRACOLoader configured for GLTFLoader (adjust decoder path if needed).");
        // --- Ende Optional: DRACO ---

        // Default Material für Geometrie-Loader
        this.defaultMaterial = new THREE.MeshStandardMaterial({
             color: 0xcccccc,
             metalness: 0.1,
             roughness: 0.8,
             side: THREE.DoubleSide // Wichtig für STL oft
        });
        this.defaultPointsMaterial = new THREE.PointsMaterial({
             color: 0xcccccc,
             size: 0.05,
             vertexColors: false // Wird für PLY ggf. angepasst
         });
    }

    /**
     * Löst den Ladevorgang für eine Datei aus.
     * @param {File} file Die zu ladende Datei.
     */
    loadFile(file) {
        if (!file) return;

        const fileName = file.name;
        const extension = fileName.split('.').pop()?.toLowerCase();

        if (!extension) {
             console.error(`[LoaderService] Could not determine file extension for: ${fileName}`);
             alert(`Dateityp von "${fileName}" konnte nicht bestimmt werden.`);
             return;
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            const content = event.target.result; // ArrayBuffer
            console.log(`[LoaderService] Read: ${fileName} (${(content.byteLength / 1024 / 1024).toFixed(2)} MB)`);
            this.loadModelData(extension, content, fileName);
        };

        reader.onerror = (event) => {
            console.error(`[LoaderService] Read error: ${fileName}`, event);
            alert(`Fehler beim Lesen der Datei: ${fileName}`);
        };

        // Die meisten Loader (GLTF, FBX, STL, PLY, DAE) arbeiten am besten mit ArrayBuffer
        reader.readAsArrayBuffer(file);
    }

    /**
     * Verarbeitet die gelesenen Modelldaten basierend auf der Dateiendung.
     * @param {string} extension Die Dateiendung.
     * @param {ArrayBuffer} data Der Inhalt der Datei als ArrayBuffer.
     * @param {string} fileName Der ursprüngliche Dateiname.
     */
    loadModelData(extension, data, fileName) {
        console.log(`[LoaderService] Parsing: ${fileName} (Format: ${extension})`);
        let loadedObject = null; // Wird verwendet, wenn der Loader das Objekt direkt zurückgibt

        // --- onLoad Callback ---
        const onLoad = (loadedContent) => {
            console.log(`[LoaderService] Parsed ${fileName}.`);
            let finalObject = null;

            // --- Loader-spezifische Verarbeitung des Ergebnisses ---
            switch (extension) {
                case 'gltf':
                case 'glb':
                    finalObject = loadedContent.scene; // GLTFLoader gibt ein Objekt mit { scene, animations, ... } zurück
                    // TODO: Optional Animationen verarbeiten: this.appManager.handleAnimations(loadedContent.animations);
                    break;
                case 'obj':
                case 'fbx':
                    finalObject = loadedContent; // OBJLoader und FBXLoader geben direkt das THREE.Group Objekt zurück
                    break;
                case 'stl':
                    // STLLoader gibt BufferGeometry zurück -> In Mesh verpacken
                    const stlGeometry = loadedContent;
                    finalObject = new THREE.Mesh(stlGeometry, this.defaultMaterial.clone());
                    console.log("[LoaderService] STL geometry wrapped in Mesh.");
                    break;
                case 'ply':
                    // PLYLoader gibt BufferGeometry zurück -> In Mesh oder Points verpacken
                    const plyGeometry = loadedContent;
                    if (plyGeometry.hasAttribute('color')) {
                        // Wenn Vertex-Farben vorhanden sind, PointsMaterial verwenden
                         const pointsMat = this.defaultPointsMaterial.clone();
                         pointsMat.vertexColors = true;
                         finalObject = new THREE.Points(plyGeometry, pointsMat);
                         console.log("[LoaderService] PLY geometry with colors wrapped in Points.");
                    } else {
                        // Sonst als Mesh darstellen
                         finalObject = new THREE.Mesh(plyGeometry, this.defaultMaterial.clone());
                         console.log("[LoaderService] PLY geometry wrapped in Mesh.");
                    }
                    plyGeometry.computeVertexNormals(); // Wichtig für Beleuchtung bei Meshes
                    break;
                case 'dae':
                     finalObject = loadedContent.scene; // ColladaLoader gibt ein Objekt mit { scene, ... } zurück
                     // TODO: Optional Animationen verarbeiten
                     break;
                default:
                    console.error(`[LoaderService] Internal error: onLoad called for unsupported extension? (${extension})`);
                    return; // Sollte nicht passieren
            }
            // --- Ende Loader-spezifische Verarbeitung ---


            if (!finalObject) {
                console.error(`[LoaderService] Loader returned empty object for: ${fileName}.`);
                alert(`Fehler: Der Loader gab kein gültiges Objekt für "${fileName}" zurück.`);
                return;
            }

            // Sinnvollen Namen setzen
            if (!finalObject.name) {
                finalObject.name = fileName.replace(/\.[^/.]+$/, "") || `Loaded_${extension.toUpperCase()}`;
            }

            // Optional: Ungültige Transformationen prüfen
            let hasInvalid = false;
            if (typeof hasInvalidTransform === 'function') {
                finalObject.traverse(node => {
                    if (hasInvalidTransform(node)) hasInvalid = true;
                });
                if (hasInvalid) console.warn(`[LoaderService] Model "${finalObject.name}" contains invalid transforms!`);
            }

            // Objekt zur Szene hinzufügen und zentrieren/fokussieren
            this.appManager.addObjectToScene(finalObject);
            if (typeof this.centerAndFocus === 'function') this.centerAndFocus(finalObject);

            // Objekt auswählen
            const selectionManager = this.appManager.selectionManager;
            if (selectionManager && !hasInvalid) {
                console.log(`[LoaderService] Requesting selection for ${finalObject.name} using updateSelection`);
                selectionManager.updateSelection(finalObject, false);
            } else if (hasInvalid) {
                console.warn("[LoaderService] Selection skipped due to invalid transforms.");
            } else {
                console.error("[LoaderService] SelectionManager not available on AppManager!");
            }
        }; // --- Ende onLoad Callback ---

        // --- onError Callback ---
        const onError = (error) => {
            // Gib detailliertere Fehler aus, wenn möglich
            let errorMessage = `Fehler beim Parsen der Datei: ${fileName}.`;
            if (error instanceof Error) {
                 errorMessage += `\nMessage: ${error.message}`;
                 console.error(`[LoaderService] Parse error for ${fileName}:`, error);
            } else if (error instanceof ProgressEvent) {
                 errorMessage += `\nNetwork or read error occurred.`;
                 console.error(`[LoaderService] Network/Read error for ${fileName}:`, error);
            } else {
                 errorMessage += `\nUnknown error occurred. Check console.`;
                 console.error(`[LoaderService] Unknown parse error for ${fileName}:`, error);
            }
            alert(errorMessage);
        }; // --- Ende onError Callback ---

        // --- Ladevorgang starten ---
        try {
            switch (extension) {
                case 'gltf':
                case 'glb':
                    this.gltfLoader.parse(data, '', onLoad, onError);
                    break;
                case 'obj':
                    const textDecoder = new TextDecoder();
                    const text = textDecoder.decode(data);
                    loadedObject = this.objLoader.parse(text);
                    onLoad(loadedObject); // Wirft Fehler direkt
                    break;
                case 'fbx':
                    loadedObject = this.fbxLoader.parse(data, '');
                    onLoad(loadedObject); // Wirft Fehler direkt
                    break;
                case 'stl':
                     const stlGeometry = this.stlLoader.parse(data);
                     onLoad(stlGeometry); // Wirft Fehler direkt
                     break;
                case 'ply':
                     const plyGeometry = this.plyLoader.parse(data);
                     onLoad(plyGeometry); // Wirft Fehler direkt
                     break;
                 case 'dae':
                     const colladaResult = this.colladaLoader.parse(new TextDecoder().decode(data), ''); // Collada braucht Text
                     onLoad(colladaResult); // Wirft Fehler direkt
                     break;
                default:
                    console.error('[LoaderService] Unsupported file format:', extension);
                    alert(`Nicht unterstütztes Dateiformat: ".${extension}"`);
                    // Rufe onError nicht auf, da kein Parse-Versuch stattfindet
            }
        } catch (parseError) {
            // Fängt synchrone Fehler ab, die direkt in .parse() auftreten
            onError(parseError);
        }
    }

    /**
     * Zentriert das gegebene Objekt in der Szene und passt die Kameraposition an.
     * (Code unverändert von deiner vorherigen Version)
     * @param {THREE.Object3D} object Das zu zentrierende Objekt.
     */
    centerAndFocus(object) {
        if (!object || !this.appManager) return;
        console.log(`[LoaderService] Centering: ${object.name}`);
        const camera = this.appManager.getCamera();
        const controls = this.appManager.controlsManager?.getOrbitControls();
        const cameraPivot = this.appManager.getCameraPivot();
        if (!camera || !controls || !cameraPivot) {
            console.warn("[LoaderService] Missing camera, OrbitControls, or cameraPivot for centering. Aborting focus.");
            return;
        }
        if (typeof tempBox === 'undefined' || typeof tempSize === 'undefined') {
            console.error("[LoaderService] tempBox or tempSize utility not available. Cannot center object.");
            return;
        }
        try {
            const box = tempBox.setFromObject(object, true);
            if (box.isEmpty() || !isFinite(box.min.x) || !isFinite(box.max.x)) {
                console.warn(`[LoaderService] Cannot center ${object.name}: Bounding box is empty or has non-finite values.`);
                return;
            }
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(tempSize);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim <= 0 || !isFinite(maxDim)) {
                console.warn(`[LoaderService] Cannot center ${object.name}: Max dimension is zero or non-finite.`);
                return;
            }
            object.position.sub(center);
            object.updateMatrixWorld(true);
            cameraPivot.position.set(0, 0, 0);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ = Math.max(cameraZ, 0.1) * 1.5;
            camera.position.set(0, 0, cameraZ);
            controls.target.set(0, 0, 0);
            camera.lookAt(0, 0, 0);
            controls.update();
            console.log(`[LoaderService] Centered ${object.name}. Camera distance set to ${cameraZ.toFixed(1)}`);
        } catch (e) {
            console.error(`[LoaderService] Error during centering of ${object.name}:`, e);
        }
    }
}

export default LoaderService;