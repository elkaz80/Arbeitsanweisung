import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { hasInvalidTransform, tempBox, tempSize } from './utils';

class LoaderService {
    constructor(appManager) {
        if (!appManager) throw new Error("LoaderService requires AppManager!");
        this.appManager = appManager;
        this.gltfLoader = new GLTFLoader();
        this.objLoader = new OBJLoader();
    }

    loadFile(file) { /* ... (Code wie oben) ... */ if (!file) return; const fileName = file.name; const extension = fileName.split('.').pop().toLowerCase(); const reader = new FileReader(); reader.onload = (event) => { const content = event.target.result; console.log(`[LoaderService] Read: ${fileName}`); this.loadModelData(extension, content, fileName); }; reader.onerror = (event) => { console.error(`[LoaderService] Read error: ${fileName}`, event); alert(`Fehler beim Lesen: ${fileName}`); }; reader.readAsArrayBuffer(file); }

    loadModelData(extension, data, fileName) {
        console.log(`[LoaderService] Parsing: ${fileName}`);
        let loader; let loadedObject = null;
        const onLoad = (object) => {
            console.log(`[LoaderService] Parsed ${fileName}.`);
            if (!object) { console.error(`[LoaderService] Loader empty obj: ${fileName}.`); alert(`Fehler: Loader gab kein Objekt zurück.`); return; }
            if (!object.name) object.name = fileName.replace(/\.[^/.]+$/, "") || `Loaded_${extension.toUpperCase()}`;
            let hasInvalid = false; object.traverse(node => { if(hasInvalidTransform(node)) hasInvalid = true; }); if(hasInvalid) { console.warn(`[LoaderService] Invalid transforms in ${object.name}!`); alert(`Warnung: ${object.name} hat ungültige Transformationen!`); }

            this.appManager.addObjectToScene(object); // Fügt hinzu UND triggert UI Update im AppManager
            this.centerAndFocus(object);

            // Auswahl über SelectionManager (wird vom AppManager gehalten)
             const selectionManager = this.appManager.selectionManager;
             if (selectionManager && !hasInvalid) { // Nur auswählen wenn gültig
                 console.log(`[LoaderService] Requesting selection for ${object.name}`);
                 selectionManager.select(object);
             } else if (hasInvalid) {
                 console.warn("[LoaderService] Selection skipped due to invalid transforms.");
             } else { console.error("[LoaderService] SelectionManager not available on AppManager!"); }
        };
        const onError = (error) => { console.error(`[LoaderService] Parse error ${fileName}:`, error); alert(`Fehler beim Parsen: ${fileName}.`); };
        try {
            switch (extension) {
                case 'gltf': case 'glb': this.gltfLoader.parse(data, '', (gltf) => onLoad(gltf.scene), onError); break;
                case 'obj': const text = new TextDecoder().decode(data); loadedObject = this.objLoader.parse(text); onLoad(loadedObject); break;
                // Andere Loader...
                default: console.error('[LoaderService] Unsupported format:', extension); alert(`Format ${extension} nicht unterstützt.`);
            }
        } catch (parseError) { onError(parseError); }
    }

    centerAndFocus(object) { /* ... (Code wie oben) ... */ if (!object || !this.appManager) return; console.log(`[LoaderService] Centering: ${object.name}`); const camera = this.appManager.getCamera(); const controls = this.appManager.controlsManager?.getOrbitControls(); const cameraPivot = this.appManager.getCameraPivot(); if (!camera || !controls || !cameraPivot) { console.warn("[LoaderService] Missing camera/controls/pivot for centering."); return; } try { const box = tempBox.setFromObject(object); if (!box.isEmpty() && isFinite(box.min.x) && isFinite(box.max.x)) { const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(tempSize); const maxDim = Math.max(size.x, size.y, size.z); if (maxDim > 0 && isFinite(maxDim)) { const fov = camera.fov * (Math.PI / 180); let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)); cameraZ = Math.max(cameraZ, 0.1) * 1.5; object.position.copy(center).multiplyScalar(-1); object.updateMatrixWorld(true); cameraPivot.position.set(0, 0, 0); camera.position.set(0, 0, cameraZ); controls.target.set(0, 0, 0); camera.lookAt(0, 0, 0); controls.update(); console.log(`[LoaderService] Centered ${object.name}. CamZ=${cameraZ.toFixed(1)}`); } else { console.warn(`[LoaderService] Cannot center ${object.name}: zero/inf size.`); } } else { console.warn(`[LoaderService] Cannot center ${object.name}: empty/inf BBox.`); } } catch (e) { console.error(`[LoaderService] Error centering ${object.name}:`, e); } }
}
export default LoaderService;