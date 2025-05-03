// *** VOLLSTÄNDIGER CODE v9 - Force Render Test ***

import './style.css';

// --- Imports ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import GUI from 'lil-gui';

console.log("--- Script Start (Vite Project v9 - Force Render Test) ---");

// --- DOM Elemente ---
const canvas = document.getElementById('three-canvas');
const treeContainer = document.getElementById('scene-graph-tree');
const uploadButton = document.getElementById('uploadButton');
const fileInput = document.getElementById('fileInput');
const translateBtn = document.getElementById('transform-translate-btn');
const rotateBtn = document.getElementById('transform-rotate-btn');
const scaleBtn = document.getElementById('transform-scale-btn');
const transformButtons = [translateBtn, rotateBtn, scaleBtn];
const playPauseButton = document.getElementById('playPauseBtn');
const stepForwardBtn = document.getElementById('stepForwardBtn');
const stepBackwardBtn = document.getElementById('stepBackwardBtn');
const keyframeTrackContainer = document.getElementById('keyframe-track-container');
const timeIndicator = document.getElementById('time-indicator');
const timeIndicatorLabel = document.getElementById('time-indicator-label');
const endTimeInput = document.getElementById('timeline-range-end-input');
const sceneContainer = document.getElementById('scene-container');
const connectElementsBtn = document.getElementById('connect-elements-btn');

// --- Three.js Setup ---
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x222222);
renderer.domElement.addEventListener('webglcontextlost', (e) => console.error('WebGL Context Lost!', e), false);
renderer.domElement.addEventListener('webglcontextrestored', () => console.log('WebGL Context Restored.'), false);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 1000);
console.log(`[Init] Camera Near: ${camera.near}, Far: ${camera.far}`);
const controls = new OrbitControls(camera, renderer.domElement);
console.log("[Init] OrbitControls created.");
const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.renderOrder = 999; // Hohe Render Order
console.log("[Init] TransformControls created, renderOrder set.");

// --- CSS3D Renderer Setup ---
let cssRenderer, cssScene;
cssRenderer = new CSS3DRenderer(); cssRenderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
cssRenderer.domElement.style.position = 'absolute'; cssRenderer.domElement.style.top = '0';
cssRenderer.domElement.style.pointerEvents = 'none'; cssRenderer.domElement.classList.add('css3d-overlay'); sceneContainer.appendChild(cssRenderer.domElement);
cssScene = new THREE.Scene(); console.log("[Init] CSS3DRenderer initialized.");

// --- Kamera-Pivot ---
const cameraPivot = new THREE.Object3D(); cameraPivot.name = "CameraPivot"; scene.add(cameraPivot); cameraPivot.add(camera);
camera.position.set(0, 1, 5); camera.lookAt(0, 0, 0); controls.target.set(0, 0, 0); console.log("[Init] CameraPivot created."); controls.update();

// --- Hilfsobjekte & Lichter ---
const gridHelper = new THREE.GridHelper(10, 10); const axesHelper = new THREE.AxesHelper(5); scene.add(gridHelper); scene.add(axesHelper); console.log("[Init] Helpers added.");
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); directionalLight.position.set(5, 10, 7.5); scene.add(ambientLight); scene.add(directionalLight); console.log("[Init] Lights added.");

// Test-Würfel
const testCubeGeometry = new THREE.BoxGeometry(1, 1, 1); const testCubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); const testCube = new THREE.Mesh(testCubeGeometry, testCubeMaterial); testCube.position.set(0, 0.5, 0); testCube.name = "TestCube"; scene.add(testCube); console.log("[Init] Added TestCube.");

// --- Globale Variablen ---
let isDraggingGizmo = false; let timelineInteractionActive = false; const pointerDownPosition = new THREE.Vector2(); let isPotentialClick = false; let potentialSelection = null; let pointerDownOnCanvas = false; let cameraPivotAnimatedThisFrame = false; let maxTimelineTime = 10.0; let isDraggingKeyframe = false; let draggedKeyframesGroup = []; let isDraggingKeyframeGroup = false; let isDraggingTimeIndicator = false; let selectedObject = null; const keyframes = {}; let playing = false; let timelineTime = 0; let htmlElementCounter = 0; const tempBox = new THREE.Box3(); const tempSize = new THREE.Vector3();

// --- Connector Variablen & GUI ---
let isConnecting = false; let firstConnectionObject = null; const connectors = []; const connectorGuiState = { color: 0x007bff, lineWidth: 0.01, arrowSize: 0.3, selectedConnectorName: '', connectorNames: [], deleteSelected: () => { deleteSelectedConnector(); } }; const gui = new GUI(); const connectorFolder = gui.addFolder('Connectors'); connectorFolder.addColor(connectorGuiState, 'color').name('Line Color').onChange(updateConnectorMaterials); connectorFolder.add(connectorGuiState, 'lineWidth', 0.001, 0.1, 0.001).name('Line Width').onChange(updateConnectorMaterials); connectorFolder.add(connectorGuiState, 'arrowSize', 0.1, 1.0, 0.05).name('Arrow Size').onChange(updateConnectorMaterials); const connectorDropdown = connectorFolder.add(connectorGuiState, 'selectedConnectorName', []).name('Select'); connectorFolder.add(connectorGuiState, 'deleteSelected').name('Delete Selected'); updateConnectorDropdown();

// --- HTML Templates ---
const HTML_TEMPLATES = [ { id: 'template-text', name: 'Einfacher Text', html: `<div class="html-content text-content"><p contenteditable="true">Dies ist ein einfacher bearbeitbarer Textblock.</p></div>`, defaultWidth: 300, defaultHeight: 100 }, { id: 'template-heading-text', name: 'Überschrift + Text', html: `<div class="html-content heading-text-content"><h3 contenteditable="true">Überschrift</h3><p contenteditable="true">Hier folgt der Text...</p></div>`, defaultWidth: 350, defaultHeight: 150 }, { id: 'template-notice', name: 'Hinweisbox', html: `<div class="html-content notice-box"><strong contenteditable="true">Hinweis:</strong><p contenteditable="true">Wichtige Info.</p></div>`, defaultWidth: 250, defaultHeight: 100 }, { id: 'template-warning', name: 'Warnhinweis', html: `<div class="html-content warning-box"><strong contenteditable="true">Warnung!</strong><p contenteditable="true">Wichtige Warnung.</p></div>`, defaultWidth: 250, defaultHeight: 100 }, { id: 'template-image-url', name: 'Bild (via URL)', html: `<div class="html-content image-content"><img src="https://via.placeholder.com/300x150" alt="Placeholder"><input type="text" placeholder="Bild-URL..." onchange="this.previousElementSibling.src=this.value || 'https://via.placeholder.com/300x150'"></div>`, defaultWidth: 320, defaultHeight: 200 }, { id: 'template-video-embed', name: 'Video (Embed)', html: `<div class="html-content video-content"><iframe width="100%" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allowfullscreen></iframe><input type="text" placeholder="YouTube Embed-URL..." onchange="this.previousElementSibling.src=this.value || 'https://www.youtube.com/embed/dQw4w9WgXcQ'"></div>`, defaultWidth: 400, defaultHeight: 280 }, { id: 'template-ordered-list', name: 'Nummerierte Liste', html: `<div class="html-content list-content"><ol contenteditable="true"><li>Erster Punkt</li><li>Zweiter Punkt</li></ol></div>`, defaultWidth: 300, defaultHeight: 120 }, { id: 'template-unordered-list', name: 'Aufzählung', html: `<div class="html-content list-content"><ul contenteditable="true"><li>Punkt A</li><li>Punkt B</li></ul></div>`, defaultWidth: 300, defaultHeight: 120 }, { id: 'template-checklist', name: 'Checkliste', html: `<div class="html-content checklist"><ul contenteditable="true"><li><input type="checkbox"> Aufgabe 1</li><li><input type="checkbox"> Aufgabe 2</li></ul></div>`, defaultWidth: 250, defaultHeight: 100 }, { id: 'template-link', name: 'Link / Verweis', html: `<div class="html-content link-content"><a href="#" contenteditable="true" target="_blank">Link Text</a><input type="text" placeholder="URL..." onchange="this.previousElementSibling.href=this.value || '#'"></div>`, defaultWidth: 200, defaultHeight: 60 }, { id: 'template-map-embed', name: 'Karte (Embed)', html: `<div class="html-content map-content"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-0.004,51.476,0.000,51.478&layer=mapnik" style="border: 1px solid black; width: 100%; height: 100%;"></iframe><br/><small><a href="https://www.openstreetmap.org/#map=19/51.47735/-0.00186">Größere Karte</a></small></div>`, defaultWidth: 400, defaultHeight: 330 }, ];

// --- HTML Element Management & Connectors ---
// (Code unverändert)
function createHTMLElement(htmlContent, width = 300, height = 150, initialPosition = null, initialRotation = null) { htmlElementCounter++; const element = document.createElement('div'); element.className = 'html-3d-element'; element.innerHTML = htmlContent; element.style.width = `${width}px`; element.style.height = `${height}px`; const cssObject = new CSS3DObject(element); cssObject.name = `HTMLElement_${htmlElementCounter}`; cssObject.userData.isHTML = true; element.dataset.uuid = cssObject.uuid; element.addEventListener('pointerdown', (event) => { if (element.classList.contains('gizmo-active')) return; if (isConnecting) { event.preventDefault(); event.stopPropagation(); handleConnectionClick(cssObject); return; } const rect = element.getBoundingClientRect(); const edgeThreshold = 20; const x = event.clientX - rect.left; const y = event.clientY - rect.top; const isEdgeClick = x < edgeThreshold || y < edgeThreshold || x > rect.width - edgeThreshold || y > rect.height - edgeThreshold; if (isEdgeClick) { event.preventDefault(); event.stopPropagation(); potentialSelection = cssObject; isPotentialClick = true; pointerDownOnCanvas = true; pointerDownPosition.set(event.clientX, event.clientY); } else { isPotentialClick = false; potentialSelection = null; } }); const scaleFactor = 0.01; cssObject.scale.set(scaleFactor, scaleFactor, scaleFactor); if (!initialPosition) { const dist = 3; const dir = new THREE.Vector3(); camera.getWorldDirection(dir); cssObject.position.copy(camera.position).add(dir.multiplyScalar(dist)); } else cssObject.position.copy(initialPosition); if (!initialRotation) cssObject.rotation.copy(camera.rotation); else cssObject.rotation.copy(initialRotation); cssScene.add(cssObject); updateTree(); return cssObject; }
function addHTMLElement(id) { const t = HTML_TEMPLATES.find(tmp => tmp.id === id); if (t) { const h = createHTMLElement(t.html, t.defaultWidth, t.defaultHeight); selectObject(h); document.getElementById('html-submenu').classList.remove('active'); } else console.error(`HTML Template ${id} not found.`); }
function startConnectionMode() { if(isConnecting) { cancelConnectionMode(); return; } isConnecting=true; firstConnectionObject=null; deselectObject(); sceneContainer.classList.add('connecting-mode'); connectElementsBtn.classList.add('connecting'); }
function cancelConnectionMode() { if(!isConnecting) return; isConnecting=false; if (firstConnectionObject?.userData.isHTML) firstConnectionObject.element.classList.remove('connection-start'); firstConnectionObject=null; sceneContainer.classList.remove('connecting-mode'); connectElementsBtn.classList.remove('connecting'); }
function handleConnectionClick(obj) { if (!isConnecting || !obj || obj === firstConnectionObject) return; if (!firstConnectionObject) { firstConnectionObject=obj; if (obj.userData.isHTML) obj.element.classList.add('connection-start'); } else { createConnector(firstConnectionObject, obj); cancelConnectionMode(); } }
function createConnector(o1, o2) { const p1 = new THREE.Vector3(); const p2 = new THREE.Vector3(); o1.getWorldPosition(p1); o2.getWorldPosition(p2); const g = new LineGeometry(); g.setPositions([...p1.toArray(), ...p2.toArray()]); const m = new LineMaterial({ color: connectorGuiState.color, linewidth: connectorGuiState.lineWidth, resolution: new THREE.Vector2(sceneContainer.clientWidth, sceneContainer.clientHeight), alphaToCoverage: true }); m.resolution.set(sceneContainer.clientWidth, sceneContainer.clientHeight); const l = new Line2(g, m); l.computeLineDistances(); l.scale.set(1,1,1); const n=`Connector_${o1.name||o1.uuid}_${o2.name||o2.uuid}`; l.name=`ConnectorLine_${n}`; l.userData={isConnectorPart:true, connectorName:n}; const dir = new THREE.Vector3().subVectors(p2, p1); const len = dir.length(); dir.normalize(); const hl = Math.min(len * 0.1, connectorGuiState.arrowSize); const hw = hl * 0.6; const arrow = new THREE.ArrowHelper(dir, p1, len, connectorGuiState.color, hl, hw); arrow.name = `ConnectorArrow_${n}`; arrow.userData={isConnectorPart:true, connectorName:n}; scene.add(l); scene.add(arrow); connectors.push({name: n, line: l, arrow: arrow, obj1: o1, obj2: o2}); updateTree(); updateConnectorDropdown(); }
function updateConnectorMaterials() { connectors.forEach(c => { if (c.line.material instanceof LineMaterial) { c.line.material.color.setHex(connectorGuiState.color); c.line.material.linewidth = connectorGuiState.lineWidth; } if (c.arrow) { c.arrow.setColor(connectorGuiState.color); const p1 = new THREE.Vector3(); const p2 = new THREE.Vector3(); c.obj1.getWorldPosition(p1); c.obj2.getWorldPosition(p2); const l=p1.distanceTo(p2); const hl=Math.min(l*0.1, connectorGuiState.arrowSize); const hw=hl*0.6; c.arrow.setLength(l,hl,hw); } }); }
function updateConnectorDropdown() { const names = connectors.map(c=>c.name); connectorGuiState.connectorNames=names; if(names.length===0) connectorGuiState.selectedConnectorName=''; else if(!names.includes(connectorGuiState.selectedConnectorName)) connectorGuiState.selectedConnectorName=names[0]||''; if(connectorDropdown) connectorDropdown.options(names).setValue(connectorGuiState.selectedConnectorName); }
function deleteSelectedConnector() { const name=connectorGuiState.selectedConnectorName; const idx=connectors.findIndex(c=>c.name===name); if(idx>-1) { const c=connectors[idx]; scene.remove(c.line); scene.remove(c.arrow); if(c.line.material) c.line.material.dispose(); if(c.line.geometry) c.line.geometry.dispose(); connectors.splice(idx, 1); updateConnectorDropdown(); updateTree(); } }
function updateConnectors() { if(connectors.length===0) return; const p1=new THREE.Vector3(); const p2=new THREE.Vector3(); const copy=[...connectors]; copy.forEach(c=>{ if(!connectors.includes(c)) return; const o1e=c.obj1?.parent; const o2e=c.obj2?.parent; if(!o1e || !o2e) { console.warn(`Connector ${c.name} invalid.`); scene.remove(c.line); scene.remove(c.arrow); if(c.line.material) c.line.material.dispose(); if(c.line.geometry) c.line.geometry.dispose(); const i=connectors.indexOf(c); if(i>-1) connectors.splice(i,1); updateConnectorDropdown(); updateTree(); return; } c.obj1.getWorldPosition(p1); c.obj2.getWorldPosition(p2); if(c.line.geometry instanceof LineGeometry) { c.line.geometry.setPositions([...p1.toArray(), ...p2.toArray()]); c.line.computeLineDistances(); } if(c.arrow){ const dir=new THREE.Vector3().subVectors(p2,p1); const len=dir.length(); if(len>1e-4){ dir.normalize(); c.arrow.position.copy(p1); c.arrow.setDirection(dir); const hl=Math.min(len*0.1, connectorGuiState.arrowSize); const hw=hl*0.6; c.arrow.setLength(len,hl,hw); c.arrow.visible=true; } else c.arrow.visible=false; } }); }


// --- Event Listener & Funktionen ---

// Transform Controls Events
transformControls.addEventListener('dragging-changed', function (event) { controls.enabled = !event.value; isDraggingGizmo = event.value; if (!event.value && transformControls.object && !timelineInteractionActive) { const obj=transformControls.object; if(obj && !hasInvalidTransform(obj)) { setKeyframe('position', timelineTime, obj.position); setKeyframe('quaternion', timelineTime, obj.quaternion); setKeyframe('scale', timelineTime, obj.scale); drawKeyframes(); } } });
transformControls.addEventListener('objectChange', () => {/* Nichts */});

// Upload Button
uploadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => { const file=event.target.files[0]; if (!file) return; const ext = file.name.split('.').pop().toLowerCase(); const reader=new FileReader(); reader.onload=(e)=>loadModel(ext, e.target.result, file.name); reader.readAsArrayBuffer(file); fileInput.value=''; });

// Transform Mode Buttons
function setActiveTransformButton(activeBtn) { transformButtons.forEach(btn => btn.classList.toggle('active', btn === activeBtn)); }
translateBtn.addEventListener('click', () => { transformControls.setMode("translate"); setActiveTransformButton(translateBtn); });
rotateBtn.addEventListener('click', () => { transformControls.setMode("rotate"); setActiveTransformButton(rotateBtn); });
scaleBtn.addEventListener('click', () => { transformControls.setMode("scale"); setActiveTransformButton(scaleBtn); });


// --- Opazitätsfunktionen ---
function setObjectOpacity(object, targetOpacity, storeOriginal = false) { if (!object) return; const targetOp = Math.max(0, Math.min(1, targetOpacity)); object.traverse((node) => { if (node.isMesh) { const materials = Array.isArray(node.material) ? node.material : [node.material]; if (storeOriginal && !node.userData.originalMaterialStates) { node.userData.originalMaterialStates = materials.map(mat => ({ opacity: mat.opacity, transparent: mat.transparent })); } materials.forEach(mat => { if (mat?.opacity !== undefined && mat.transparent !== undefined) { mat.transparent = true; mat.opacity = targetOp; mat.needsUpdate = true; } }); } }); }
function restoreObjectOpacity(object) { if (!object) return; object.traverse((node) => { if (node.isMesh && node.userData.originalMaterialStates) { const materials = Array.isArray(node.material) ? node.material : [node.material]; materials.forEach((mat, index) => { if (mat?.opacity !== undefined && mat.transparent !== undefined) { const originalState = node.userData.originalMaterialStates[index]; if (originalState) { mat.opacity = originalState.opacity; mat.transparent = originalState.transparent; mat.needsUpdate = true; } else { mat.opacity = 1.0; mat.transparent = false; mat.needsUpdate = true; } } }); delete node.userData.originalMaterialStates; } }); }

// --- Gizmo Render Props Funktionen ---
const originalGizmoMaterials = new Map();
function setGizmoRenderProps(controlsInstance, depthTestValue, renderOrderValue) {
    if (!controlsInstance) return;
    console.log(`[DEBUG] Setting Gizmo Props: depthTest=${depthTestValue}, renderOrder=${renderOrderValue}`);
    controlsInstance.traverse((child) => {
        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(material => {
                if (!originalGizmoMaterials.has(material.uuid)) {
                    originalGizmoMaterials.set(material.uuid, {
                        depthTest: material.depthTest,
                        // Wichtig: renderOrder ist bei Kind-Objekten von TransformControls oft nicht 0!
                        // Wir sollten den *aktuellen* Wert speichern, nicht 0 annehmen.
                        renderOrder: child.renderOrder // Speichere RenderOrder vom Objekt, nicht vom Material
                    });
                }
                material.depthTest = depthTestValue;
                // Material-renderOrder beeinflusst normalerweise nicht so stark wie Objekt-renderOrder
                // material.renderOrder = renderOrderValue; // Optional, meist nicht nötig
                material.needsUpdate = true;
            });
        }
        // Setze Render Order und speichere Original (vom Objekt)
         if (!originalGizmoMaterials.has(child.uuid)) { // Speichere auch Objekt-RenderOrder
             originalGizmoMaterials.set(child.uuid, { renderOrder: child.renderOrder });
         }
        child.renderOrder = renderOrderValue;
    });
    // Setze Render Order auch für das Haupt-Control-Objekt
    if (!originalGizmoMaterials.has(controlsInstance.uuid)) {
         originalGizmoMaterials.set(controlsInstance.uuid, { renderOrder: controlsInstance.renderOrder });
    }
    controlsInstance.renderOrder = renderOrderValue;
    console.log("Original Gizmo Props stored:", originalGizmoMaterials.size);
}

function restoreGizmoRenderProps(controlsInstance) {
     if (!controlsInstance || originalGizmoMaterials.size === 0) return;
     console.log(`[DEBUG] Restoring Gizmo Render Props...`);
     controlsInstance.traverse((child) => {
         if (child.material) {
             const materials = Array.isArray(child.material) ? child.material : [child.material];
             materials.forEach(material => {
                 const originalMatProps = originalGizmoMaterials.get(material.uuid);
                 if (originalMatProps) {
                     material.depthTest = originalMatProps.depthTest ?? true; // Fallback
                     // material.renderOrder = originalMatProps.renderOrder; // Normalerweise nicht nötig
                     material.needsUpdate = true;
                 } else {
                     material.depthTest = true; // Standard-Fallback
                     // material.renderOrder = 0;
                     material.needsUpdate = true;
                 }
             });
         }
         const originalChildProps = originalGizmoMaterials.get(child.uuid);
         child.renderOrder = originalChildProps?.renderOrder ?? 0; // Objekt-RenderOrder zurücksetzen
     });
     const originalRootProps = originalGizmoMaterials.get(controlsInstance.uuid);
     controlsInstance.renderOrder = originalRootProps?.renderOrder ?? 0; // Haupt-RenderOrder zurücksetzen

     originalGizmoMaterials.clear(); // Speicher leeren
     console.log(`[DEBUG] Gizmo Render Props restored.`);
}
// *** ENDE Gizmo Render Props ***


// Objekt-Auswahl Funktion (v9 - Mit Force Render Test)
function selectObject(objectToSelect) {
    if (objectToSelect && hasInvalidTransform(objectToSelect)) {
        console.warn(`[selectObject LOG v9] Preventing selection invalid: ${objectToSelect.name || objectToSelect.uuid}`); return; }
    console.log(`[selectObject LOG v9] Called: ${objectToSelect?.name ?? objectToSelect?.uuid ?? 'null'}. Current: ${selectedObject?.name ?? selectedObject?.uuid ?? 'null'}`);
    if (selectedObject === objectToSelect) { console.log("[selectObject LOG v9] Already selected."); return; }
    if (isConnecting) { console.log("[selectObject LOG v9] Ignored: Connection mode."); return; }

    // Deselection
    if (selectedObject) {
        const oldName = selectedObject.name || selectedObject.uuid;
        console.log(`[selectObject LOG v9] Deselecting: ${oldName}`);
        restoreObjectOpacity(selectedObject);
        restoreGizmoRenderProps(transformControls); // ** Gizmo Props zurück **
        const oldLi = treeContainer.querySelector(`li[data-uuid="${selectedObject.uuid}"]`);
        if (selectedObject.userData.isHTML) { selectedObject.element.style.pointerEvents='auto'; selectedObject.element.classList.remove('gizmo-active'); }
        if (oldLi) { oldLi.style.fontWeight='normal'; oldLi.style.backgroundColor=''; }
        transformControls.detach(); transformControls.size = 1;
        console.log("[selectObject LOG v9] Detached TC.");
    }

    selectedObject = objectToSelect;

    // Selection
    if (selectedObject) {
        const newName = selectedObject.name || selectedObject.uuid;
        console.log(`[selectObject LOG v9] Selecting: ${newName}`);
        setObjectOpacity(selectedObject, 0.5, true);
        console.log(`[selectObject LOG v9] Reduced opacity.`);
        console.log(`[selectObject LOG v9] Attaching TC.`);
        try {
            transformControls.attach(selectedObject);
            transformControls.visible = true;
            // Dynamische Größe wieder rein
             try { tempBox.setFromObject(selectedObject, true); if (!tempBox.isEmpty() && isFinite(tempBox.min.x) && isFinite(tempBox.max.x)) { tempBox.getSize(tempSize); const maxD = Math.max(tempSize.x, tempSize.y, tempSize.z); if (maxD > 0 && isFinite(maxD)) { const sf = 0.2; transformControls.size = Math.max(0.1, maxD * sf); console.log(`[selectObject DEBUG v9] Gizmo Size: ${transformControls.size.toFixed(2)}`); } else { transformControls.size = 1; } } else { transformControls.size = 1; } } catch (e) { console.error(`[selectObject ERROR v9] BBox Error:`, e); transformControls.size = 1; }

            setGizmoRenderProps(transformControls, false, 999); // ** Force Render **
            console.log(`[selectObject LOG v9] TC attached. Vis: ${transformControls.visible}, Size: ${transformControls.size.toFixed(2)}, Attached: ${transformControls.object?.name||transformControls.object?.uuid}`);
            if (transformControls.children) console.log(`[selectObject DEBUG v9] Gizmo children: ${transformControls.children.length}`);
            else console.error("[selectObject ERROR v9] transformControls.children missing!");

            setActiveTransformButton(document.getElementById(`transform-${transformControls.mode}-btn`));
            if (selectedObject.userData.isHTML) { selectedObject.element.style.pointerEvents='none'; selectedObject.element.classList.add('gizmo-active'); }
            const newLi = treeContainer.querySelector(`li[data-uuid="${selectedObject.uuid}"]`); if (newLi) { newLi.style.fontWeight='bold'; newLi.style.backgroundColor='#ddd'; }
        } catch (e) {
            console.error("[selectObject LOG v9] Error attaching TC:", e, "Obj:", selectedObject);
            restoreObjectOpacity(selectedObject); restoreGizmoRenderProps(transformControls);
            selectedObject=null; transformControls.detach(); transformControls.visible=false; transformControls.size=1;
        }
    } else {
        console.log("[selectObject LOG v9] Deselection complete.");
        transformControls.visible = false; transformControls.size = 1;
        restoreGizmoRenderProps(transformControls); // ** Gizmo Props zurück **
    }
    drawKeyframes(); updateTree();
    console.log("[selectObject LOG v9] Final selected:", selectedObject ? (selectedObject.name||selectedObject.uuid) : "None"); console.log("[selectObject LOG v9] Final TC visible:", transformControls.visible); console.log("[selectObject LOG v9] Final TC size:", transformControls.size.toFixed(2));
}


// Deselektieren Funktion
function deselectObject() { console.log("[deselectObject] Called."); selectObject(null); }


// 3D Canvas Event Listeners
renderer.domElement.addEventListener('pointerdown', (event) => { const target = event.target; const guiElement = gui.domElement; if (target.closest('.menu-container') || target.closest('#timeline-panel') || target.closest('#scene-graph-panel') || guiElement.contains(target) || target.closest('.html-3d-element')) { pointerDownOnCanvas = false; isPotentialClick = false; potentialSelection = null; return; } pointerDownOnCanvas = true; isPotentialClick = true; pointerDownPosition.set(event.clientX, event.clientY); potentialSelection = null; const pointer = new THREE.Vector2(); const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; const raycaster = new THREE.Raycaster(); raycaster.params.Line2 = { threshold: 0.01 }; raycaster.setFromCamera(pointer, camera); const selectableObjects = []; scene.traverseVisible((obj) => { if (obj !== transformControls && !(obj instanceof THREE.AxesHelper || obj instanceof THREE.GridHelper || obj instanceof THREE.Light) && obj !== cameraPivot && obj !== camera && !obj.userData.isTransformControlGizmo) { if (obj.isMesh || obj.isLine || obj.isLine2 || obj.isPoints || obj.isSprite || obj.userData.isConnectorPart || obj === testCube) { if (!hasInvalidTransform(obj)) selectableObjects.push(obj); } } }); const intersectsObjects = raycaster.intersectObjects(selectableObjects, false); if (intersectsObjects.length > 0) { let hitObject = intersectsObjects[0].object; let potentialTarget = hitObject; if (hitObject.userData.isConnectorPart && hitObject.userData.connectorName) { console.log(`[Canvas pointerdown] Clicked connector: ${hitObject.name}`); connectorGuiState.selectedConnectorName = hitObject.userData.connectorName; connectorDropdown.setValue(hitObject.userData.connectorName); updateTree(); isPotentialClick = false; potentialSelection = null; event.stopPropagation(); event.preventDefault(); return; } if (isConnecting) { console.log(`[Canvas pointerdown] Clicked 3D in connection mode: ${potentialTarget.name || potentialTarget.uuid}`); event.preventDefault(); event.stopPropagation(); handleConnectionClick(potentialTarget); isPotentialClick = false; } else { if (potentialTarget !== scene) { potentialSelection = potentialTarget; console.log("[Canvas pointerdown LOG] Marked potential selection:", potentialTarget.name || potentialTarget.uuid); event.stopPropagation(); } else { potentialSelection = null; console.log("[Canvas pointerdown LOG] Hit scene/unexpected."); } } } else { potentialSelection = null; console.log("[Canvas pointerdown LOG] Hit NOTHING (Background)."); if (isConnecting) { console.log("[Canvas pointerdown] Background click, cancelling connection."); cancelConnectionMode(); } } }, false);
renderer.domElement.addEventListener('pointermove', (event) => { if (pointerDownOnCanvas && isPotentialClick && event.buttons > 0 && pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) { isPotentialClick = false; potentialSelection = null; } }, false);
renderer.domElement.addEventListener('pointerup', (event) => { if (!pointerDownOnCanvas) return; const target = event.target; const guiElement = gui.domElement; if (target.closest('.menu-container') || target.closest('#timeline-panel') || target.closest('#scene-graph-panel') || guiElement.contains(target)) { isPotentialClick = false; potentialSelection = null; pointerDownOnCanvas = false; return; } const wasDraggingGizmo = isDraggingGizmo; if (wasDraggingGizmo) { console.log("[Canvas pointerup LOG] Gizmo was dragging."); } else if (isPotentialClick && !isConnecting) { if (potentialSelection) { if (!hasInvalidTransform(potentialSelection)) selectObject(potentialSelection); else console.warn(`[Canvas pointerup LOG] Skipped selection due to invalid transforms: ${potentialSelection.name || potentialSelection.uuid}`); } else { if (!timelineInteractionActive) deselectObject(); } } else if (!isConnecting) { console.log("[Canvas pointerup LOG] Was a canvas drag."); } pointerDownOnCanvas = false; isPotentialClick = false; potentialSelection = null; }, false);


// Hilfsfunktion: Prüfung auf ungültige Transformationen
function hasInvalidTransform(obj) { if (!obj || obj.isCSS3DObject) return false; const p=obj.position, r=obj.quaternion, s=obj.scale; if (isNaN(p.x)||isNaN(p.y)||isNaN(p.z)||isNaN(r.x)||isNaN(r.y)||isNaN(r.z)||isNaN(r.w)||isNaN(s.x)||isNaN(s.y)||isNaN(s.z)||s.x<=0||s.y<=0||s.z<=0) { console.warn(`[TRANSFORM CHECK] Invalid for ${obj.name||obj.uuid}`); return true; } if (!isFinite(p.x)||!isFinite(p.y)||!isFinite(p.z)||!isFinite(r.x)||!isFinite(r.y)||!isFinite(r.z)||!isFinite(r.w)||!isFinite(s.x)||!isFinite(s.y)||!isFinite(s.z)) { console.warn(`[TRANSFORM CHECK] Infinite for ${obj.name||obj.uuid}`); return true; } return false; }

// loadModel Funktion
function loadModel(extension, data, fileName = 'Loaded Model') { let loader; console.log(`[loadModel] Loading: ${fileName}`); const onLoad = (loadedObject) => { if (!loadedObject) { console.error(`[loadModel] Loader null for ${fileName}`); alert(`Fehler: Loader gab kein Objekt zurück.`); return; } if (!loadedObject.name) loadedObject.name = fileName.replace(/\.[^/.]+$/, ""); console.log(`[loadModel] Loaded: ${loadedObject.name}`); scene.add(loadedObject); let inv = false; loadedObject.traverse((c) => { if (hasInvalidTransform(c)) { console.error(`[loadModel ERROR] Invalid transform: ${c.name||c.uuid}`); inv = true; } }); if (inv) alert(`Warnung: "${loadedObject.name}" enthält ungültige Transformationen.`); try { const box = new THREE.Box3().setFromObject(loadedObject); if (!box.isEmpty() && isFinite(box.min.x) && isFinite(box.max.x) ) { const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()); const maxD = Math.max(size.x, size.y, size.z); if (maxD > 0 && isFinite(maxD)) { const fov = camera.fov*(Math.PI/180); let camZ = Math.abs(maxD / 2 / Math.tan(fov / 2)); camZ = Math.max(camZ, 0.1) * 1.5; loadedObject.position.sub(center); cameraPivot.position.copy(center); camera.position.set(0,0,camZ); camera.lookAt(0,0,0); controls.target.copy(cameraPivot.position); controls.update(); console.log(`[loadModel DEBUG] Centered ${loadedObject.name}. CamZ=${camZ.toFixed(1)}`); } else { console.warn(`[loadModel] Cannot center ${loadedObject.name}: zero/inf size.`); loadedObject.position.set(0,0,0); cameraPivot.position.set(0,0,0); camera.position.set(0,0,5); controls.target.set(0,0,0); controls.update(); } } else { console.warn(`[loadModel] Cannot center ${loadedObject.name}: empty/inf BBox.`); loadedObject.position.set(0,0,0); cameraPivot.position.set(0,0,0); camera.position.set(0,0,5); controls.target.set(0,0,0); controls.update(); } } catch(e) { console.error(`[loadModel] Error centering ${loadedObject.name}:`, e); alert(`Fehler beim Zentrieren.`); loadedObject.position.set(0,0,0); cameraPivot.position.set(0,0,0); camera.position.set(0,0,5); controls.target.set(0,0,0); controls.update(); } updateTree(); if (!inv) { const objSel = loadedObject; console.log("[loadModel] Selecting initial object:", objSel.name||objSel.type); selectObject(objSel); } else console.warn("[loadModel] Selection skipped."); }; const onError = (err) => { console.error(`[loadModel] Error loading ${fileName}:`, err); alert(`Fehler beim Laden von ${fileName}.`); }; switch (extension) { case 'gltf': case 'glb': loader = new GLTFLoader(); loader.parse(data, '', (gltf) => onLoad(gltf.scene), onError); break; case 'obj': loader = new OBJLoader(); try { const txt = new TextDecoder().decode(data); const obj = loader.parse(txt); obj.name = fileName.replace(/\.[^/.]+$/, "")||"LoadedOBJGroup"; onLoad(obj); } catch (e) { onError(e); } break; case 'fbx': try { loader = new FBXLoader(); const obj = loader.parse(data, ''); onLoad(obj); } catch(e) { onError(e); } break; case 'dae': try { loader = new ColladaLoader(); const xml = new TextDecoder().decode(data); const dae = loader.parse(xml, ''); onLoad(dae.scene); } catch(e) { onError(e); } break; default: console.error('[loadModel] Unsupported format:', extension); alert(`Format ${extension} nicht unterstützt.`); } }

// Scene Graph Funktionen
function createTree(element, object3D, isCssScene = false) { if (hasInvalidTransform(object3D) || object3D === transformControls || object3D instanceof THREE.AxesHelper || object3D instanceof THREE.GridHelper || object3D === camera || object3D.userData.isTransformControlGizmo || object3D.userData.isConnectorPart && !isCssScene || object3D instanceof THREE.Light) return; const li = document.createElement('li'); let dName = object3D.name || object3D.type || object3D.uuid; if(isCssScene || object3D.userData.isHTML) dName += " (HTML)"; li.textContent = dName; li.dataset.uuid = object3D.uuid; if (selectedObject && object3D.uuid === selectedObject.uuid) { li.style.fontWeight = 'bold'; li.style.backgroundColor = '#ddd'; } if (connectorGuiState.selectedConnectorName && object3D.userData.isConnectorPart && object3D.userData.connectorName === connectorGuiState.selectedConnectorName) { li.style.fontWeight = 'bold'; li.style.backgroundColor = '#d0e0ff'; } const selAction = (e) => { e.stopPropagation(); if (!hasInvalidTransform(object3D)) selectObject(object3D); }; const vChildren = object3D.children?.filter(c => !hasInvalidTransform(c)) || []; const cUl = document.createElement('ul'); vChildren.forEach(c => createTree(cUl, c, false)); if (cUl.children.length > 0) { li.appendChild(cUl); li.classList.add('collapsed'); const txtNode = li.childNodes[0]; const tglSpan = document.createElement('span'); tglSpan.textContent = '▶ '; tglSpan.style.marginRight = '5px'; tglSpan.style.cursor = 'pointer'; tglSpan.onclick = (e) => { e.stopPropagation(); li.classList.toggle('collapsed'); tglSpan.textContent = li.classList.contains('collapsed') ? '▶ ' : '▼ '; }; li.insertBefore(tglSpan, txtNode); const txtSpan = document.createElement('span'); txtSpan.textContent = txtNode.textContent; txtNode.textContent = ''; txtSpan.style.cursor = 'pointer'; txtSpan.onclick = selAction; li.insertBefore(txtSpan, cUl); } else { li.onclick = selAction; li.style.paddingLeft = '15px'; li.style.cursor = 'pointer'; } let iName = 'radio_button_unchecked'; let iColor = '#666'; if (isCssScene || object3D.userData.isHTML) { iName = 'description'; iColor = '#555'; } else if (object3D.isMesh || object3D === testCube) { iName = 'view_in_ar'; iColor = '#333'; } else if (object3D.isGroup || object3D.isScene) { iName = 'folder'; iColor = '#888'; } else if (object3D.isCamera) { iName = 'photo_camera'; iColor = '#aaa'; } else if (object3D.isLight) { iName = 'lightbulb'; iColor = 'orange'; } else if (object3D.isLine || object3D.isLine2) { iName = 'linear_scale'; iColor = '#007bff'; } const iSpan = document.createElement('span'); iSpan.className = 'material-icons material-icons-outlined'; iSpan.textContent = iName; iSpan.style.fontSize = '16px'; iSpan.style.marginRight = '4px'; iSpan.style.verticalAlign = 'middle'; iSpan.style.color = iColor; li.insertBefore(iSpan, li.firstChild); if (cUl.children.length === 0) { li.style.paddingLeft = '0px'; iSpan.style.marginLeft = '15px'; } element.appendChild(li); }
function updateTree() { console.log("[updateTree LOG] Updating graph."); treeContainer.innerHTML = ''; const ul = document.createElement('ul'); createTree(ul, scene, false); if (cssScene.children.length > 0) { const htmlF = document.createElement('li'); htmlF.textContent = 'HTML Elemente'; htmlF.style.fontStyle = 'italic'; htmlF.style.color = '#666'; const htmlUl = document.createElement('ul'); cssScene.children.forEach(c => createTree(htmlUl, c, true)); if (htmlUl.children.length > 0) { const tN = htmlF.childNodes[0]; const tS = document.createElement('span'); tS.textContent = '▶ '; tS.style.cursor = 'pointer'; tS.style.marginRight = '5px'; tS.onclick = (e) => { e.stopPropagation(); htmlF.classList.toggle('collapsed'); tS.textContent = htmlF.classList.contains('collapsed') ? '▶ ' : '▼ '; }; htmlF.insertBefore(tS, tN); htmlF.classList.add('collapsed'); htmlF.appendChild(htmlUl); ul.appendChild(htmlF); } } let connUl = null; if (connectors.length > 0) { const connF = document.createElement('li'); connF.textContent = 'Connectors'; connF.style.fontStyle = 'italic'; connF.style.color = '#666'; connUl = document.createElement('ul'); connectors.forEach(conn => { const cLi = document.createElement('li'); cLi.textContent = conn.name || 'Connector'; cLi.dataset.connectorName = conn.name; if (conn.name === connectorGuiState.selectedConnectorName) { cLi.style.fontWeight = 'bold'; cLi.style.backgroundColor = '#d0e0ff'; } cLi.style.paddingLeft = '15px'; cLi.style.cursor = 'pointer'; cLi.onclick = (e) => { e.stopPropagation(); connectorGuiState.selectedConnectorName = conn.name; connectorDropdown.setValue(conn.name); updateTree(); }; const iS = document.createElement('span'); iS.className = 'material-icons material-icons-outlined'; iS.textContent = 'link'; iS.style.fontSize = '16px'; iS.style.marginRight = '4px'; iS.style.verticalAlign = 'middle'; iS.style.color = '#007bff'; cLi.insertBefore(iS, cLi.firstChild); connUl.appendChild(cLi); }); const tN = connF.childNodes[0]; const tS = document.createElement('span'); tS.textContent = '▶ '; tS.style.cursor = 'pointer'; tS.style.marginRight = '5px'; tS.onclick = (e) => { e.stopPropagation(); connF.classList.toggle('collapsed'); tS.textContent = connF.classList.contains('collapsed') ? '▶ ' : '▼ '; }; connF.insertBefore(tS, tN); connF.classList.add('collapsed'); connF.appendChild(connUl); ul.appendChild(connF); } treeContainer.appendChild(ul); console.log("[updateTree LOG] Graph update finished."); }

// Timeline & Keyframes
playPauseButton.addEventListener('click', () => { playing = !playing; playPauseButton.querySelector('.material-icons').textContent = playing ? 'pause' : 'play_arrow'; });
stepForwardBtn.addEventListener('click', () => { if (playing) return; timelineTime = Math.min(maxTimelineTime, timelineTime + (1/30)); updateTimeIndicator(); animateTimeline(timelineTime); });
stepBackwardBtn.addEventListener('click', () => { if (playing) return; timelineTime = Math.max(0, timelineTime - (1/30)); updateTimeIndicator(); animateTimeline(timelineTime); });
function formatEndTimeInput() { let v = parseFloat(endTimeInput.value.replace(/s$/i, '')); if (!isNaN(v) && v > 0) { if (Math.abs(maxTimelineTime - v) > 0.01) { maxTimelineTime = v; drawKeyframes(); updateTimeIndicator(); } endTimeInput.value = v.toFixed(1) + 's'; } else { endTimeInput.value = maxTimelineTime.toFixed(1) + 's'; } }
endTimeInput.addEventListener('input', () => { const s = endTimeInput.value.trim().replace(/s$/i, ''); let n = parseFloat(s); if (!isNaN(n) && n > 0) { if (Math.abs(maxTimelineTime - n) > 0.01) { maxTimelineTime = n; drawKeyframes(); updateTimeIndicator(); if (timelineTime > maxTimelineTime) { timelineTime = maxTimelineTime; animateTimeline(timelineTime); } } } });
endTimeInput.addEventListener('blur', formatEndTimeInput); endTimeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { formatEndTimeInput(); endTimeInput.blur(); } }); console.log("[Init] Timeline EndTime listeners added.");
keyframeTrackContainer.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('keyframe-marker') || e.target.closest('#time-indicator')) return; if (e.button !== 0) return; const r = keyframeTrackContainer.getBoundingClientRect(); const x = e.clientX - r.left; const w = keyframeTrackContainer.clientWidth; if (w <= 0) return; const t = (x / w) * maxTimelineTime; timelineTime = Math.max(0, Math.min(maxTimelineTime, t)); updateTimeIndicator(); animateTimeline(timelineTime); isDraggingTimeIndicator = true; timelineInteractionActive = true; timeIndicator.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; e.stopPropagation(); });
timeIndicator.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; isDraggingTimeIndicator = true; timelineInteractionActive = true; timeIndicator.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; e.stopPropagation(); });
window.addEventListener('pointermove', (e) => { if (!isDraggingKeyframe && !isDraggingTimeIndicator) return; const r = keyframeTrackContainer.getBoundingClientRect(); const x = e.clientX - r.left; const w = keyframeTrackContainer.clientWidth; if (w <= 0) return; let nt = (x / w) * maxTimelineTime; nt = Math.max(0, Math.min(maxTimelineTime, nt)); if (isDraggingKeyframe && draggedKeyframesGroup.length > 0) { const ts = 0.01; const st = Math.round(nt / ts) * ts; const sp = maxTimelineTime > 0 ? st / maxTimelineTime : 0; draggedKeyframesGroup.forEach(item => { item.frame.time = st; item.element.style.left = `calc(${sp * 100}% - 1px)`; }); timelineTime = st; } else if (isDraggingTimeIndicator) timelineTime = nt; updateTimeIndicator(); animateTimeline(timelineTime); });
window.addEventListener('pointerup', (e) => { let wd = isDraggingKeyframe || isDraggingTimeIndicator; if (isDraggingKeyframe && draggedKeyframesGroup.length > 0) { const ft = draggedKeyframesGroup[0].frame.time; const id = selectedObject.uuid; const tts = new Set(draggedKeyframesGroup.map(item => item.type)); tts.forEach(type => { if (keyframes[id]?.[type]) keyframes[id][type].sort((a, b) => a.time - b.time); }); draggedKeyframesGroup.forEach(item => item.element.style.cursor = 'grab'); } if (isDraggingTimeIndicator) timeIndicator.style.cursor = 'grab'; isDraggingKeyframe = false; draggedKeyframesGroup = []; isDraggingKeyframeGroup = false; isDraggingTimeIndicator = false; timelineInteractionActive = false; document.body.style.cursor = 'default'; if (wd) console.log("[Timeline Drag End] OrbitControls:", controls.enabled); }, { passive: true });
keyframeTrackContainer.addEventListener('dblclick', (e) => { if (!selectedObject || e.target.classList.contains('keyframe-marker') || e.target.closest('#time-indicator') || hasInvalidTransform(selectedObject)) return; const r = keyframeTrackContainer.getBoundingClientRect(); const x = e.clientX - r.left; const w = keyframeTrackContainer.clientWidth; if (w <= 0) return; const t = (x / w) * maxTimelineTime; const ts = 0.01; const st = Math.round(t / ts) * ts; console.log(`[Timeline DblClick] Setting keyframes @ ${st.toFixed(2)}s`); setKeyframe('position', st, selectedObject.position); setKeyframe('quaternion', st, selectedObject.quaternion); if (selectedObject !== cameraPivot) setKeyframe('scale', st, selectedObject.scale); drawKeyframes(); });
function setKeyframe(type, time, value) { if (!selectedObject) return; if (type==='position' && (isNaN(value.x)||!isFinite(value.x)||isNaN(value.y)||!isFinite(value.y)||isNaN(value.z)||!isFinite(value.z))) { console.error(`[setKeyframe ERR] Invalid pos`); return; } if (type==='quaternion' && (isNaN(value.x)||!isFinite(value.x)||isNaN(value.y)||!isFinite(value.y)||isNaN(value.z)||!isFinite(value.z)||isNaN(value.w)||!isFinite(value.w))) { console.error(`[setKeyframe ERR] Invalid quat`); return; } if (type==='scale' && (isNaN(value.x)||!isFinite(value.x)||isNaN(value.y)||!isFinite(value.y)||isNaN(value.z)||!isFinite(value.z)||value.x<=0||value.y<=0||value.z<=0 )) { console.error(`[setKeyframe ERR] Invalid scale`); return; } if (selectedObject === cameraPivot && type === 'scale') return; const id = selectedObject.uuid; if (!keyframes[id]) keyframes[id] = { position: [], quaternion: [], scale: [] }; if (!keyframes[id][type]) keyframes[id][type] = []; const tol = 0.001; const idx = keyframes[id][type].findIndex(f => Math.abs(f.time - time) < tol); if (idx > -1) { keyframes[id][type][idx].value.copy(value); } else { keyframes[id][type].push({ time, value: value.clone() }); keyframes[id][type].sort((a, b) => a.time - b.time); } }
function getInterpolatedValue(frames, time, isQuaternion = false) { if (!frames || frames.length === 0) return null; if (time <= frames[0].time) { if(hasInvalidTransform({value: frames[0].value})) return null; return frames[0].value.clone(); } if (time >= frames[frames.length - 1].time) { if(hasInvalidTransform({value: frames[frames.length - 1].value})) return null; return frames[frames.length - 1].value.clone(); } for (let i = 1; i < frames.length; i++) { const prev = frames[i - 1]; const next = frames[i]; if (time >= prev.time && time <= next.time) { if (next.time === prev.time || hasInvalidTransform({value: prev.value}) || hasInvalidTransform({value: next.value})) { return hasInvalidTransform({value: prev.value}) ? null : prev.value.clone(); } const t = (time - prev.time) / (next.time - prev.time); if (isQuaternion) return prev.value.clone().slerp(next.value, t); else return prev.value.clone().lerp(next.value, t); } } if(hasInvalidTransform({value: frames[frames.length - 1].value})) return null; return frames[frames.length - 1].value.clone(); }
function drawKeyframes() { keyframeTrackContainer.querySelectorAll('.keyframe-marker').forEach(m => m.remove()); const trackW = keyframeTrackContainer.clientWidth; if (trackW <= 0) return; if (selectedObject && keyframes[selectedObject.uuid]) { const data = keyframes[selectedObject.uuid]; const times = new Set(); ['position', 'quaternion', 'scale'].forEach(type => { if (data[type]) data[type].forEach(f => times.add(f.time)); }); times.forEach(time => { const p = maxTimelineTime > 0 ? time / maxTimelineTime : 0; if (p >= 0 && p <= 1) { const m = document.createElement('div'); m.classList.add('keyframe-marker'); m.style.left = `calc(${p * 100}% - 1px)`; m.dataset.time = time; let tt = []; if (data.position?.some(f => Math.abs(f.time - time) < 1e-3)) tt.push('position'); if (data.quaternion?.some(f => Math.abs(f.time - time) < 1e-3)) tt.push('quaternion'); if (data.scale?.some(f => Math.abs(f.time - time) < 1e-3 && selectedObject !== cameraPivot)) tt.push('scale'); m.dataset.types = tt.join(','); m.title = `Keyframe(s) @ ${time.toFixed(2)}s\nTypes: ${tt.join(', ')}`; if (tt.length === 1) m.classList.add(`type-${tt[0]}`); else if (tt.length > 1) m.classList.add('type-mixed'); m.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.stopPropagation(); isDraggingKeyframe = true; isDraggingKeyframeGroup = true; timelineInteractionActive = true; draggedKeyframesGroup = []; const ct = parseFloat(m.dataset.time); const tol = 0.01; keyframeTrackContainer.querySelectorAll('.keyframe-marker').forEach(om => { const ot = parseFloat(om.dataset.time); if (Math.abs(ot - ct) < tol) { const ots = om.dataset.types.split(',').filter(t => t); ots.forEach(ot => { const of = keyframes[selectedObject.uuid]?.[ot]?.find(f => Math.abs(f.time - ct) < tol); if (of) { draggedKeyframesGroup.push({ element: om, frame: of, type: ot }); om.style.cursor = 'grabbing'; } }); } }); document.body.style.cursor = 'grabbing'; }); m.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); const ttd = parseFloat(m.dataset.time); const ttsd = m.dataset.types.split(',').filter(t => t); const oid = selectedObject.uuid; let deleted = false; ttsd.forEach(type => { if (keyframes[oid]?.[type]) { const idx = keyframes[oid][type].findIndex(f => Math.abs(f.time - ttd) < 1e-3); if (idx > -1) { keyframes[oid][type].splice(idx, 1); deleted = true; } } }); if (deleted) { m.remove(); animateTimeline(timelineTime); drawKeyframes(); } }); keyframeTrackContainer.appendChild(m); } }); } }

// Animate Loop
function updateTimeIndicator() { const p = maxTimelineTime > 0 ? timelineTime / maxTimelineTime : 0; const cp = Math.max(0, Math.min(1, p)); timeIndicator.style.left = `${cp * 100}%`; timeIndicatorLabel.textContent = timelineTime.toFixed(2) + 's'; }
function animateTimeline(time) { cameraPivotAnimatedThisFrame = false; Object.keys(keyframes).forEach(id => { let obj = scene.getObjectByProperty('uuid', id); if (!obj) obj = cssScene.getObjectByProperty('uuid', id); if (!obj || (isDraggingGizmo && obj === transformControls.object) || isDraggingTimeIndicator || isDraggingKeyframe || hasInvalidTransform(obj)) return; const data = keyframes[id]; if (!data) return; const pos = getInterpolatedValue(data.position, time, false); if (pos) { if(isNaN(pos.x) || !isFinite(pos.x)) console.error(`[Timeline ERR] Invalid Position @ ${time.toFixed(2)}`); else obj.position.copy(pos); } const quat = getInterpolatedValue(data.quaternion, time, true); if (quat) { if(isNaN(quat.x) || !isFinite(quat.x)) console.error(`[Timeline ERR] Invalid Quaternion @ ${time.toFixed(2)}`); else obj.quaternion.copy(quat); } if (obj !== cameraPivot) { const scl = getInterpolatedValue(data.scale, time, false); if (scl) { if(isNaN(scl.x) || !isFinite(scl.x) || scl.x <= 0 || scl.y <= 0 || scl.z <= 0) console.error(`[Timeline ERR] Invalid Scale @ ${time.toFixed(2)}`); else obj.scale.copy(scl); } } if (obj === cameraPivot && (pos || quat)) cameraPivotAnimatedThisFrame = true; }); }
let frameCounter = 0; const logInterval = 120; const tempVec = new THREE.Vector3();
function animate() { requestAnimationFrame(animate); frameCounter++; const delta = clock.getDelta(); if (playing && !timelineInteractionActive) { timelineTime += delta; if (timelineTime > maxTimelineTime) timelineTime = 0; updateTimeIndicator(); } if (!isDraggingKeyframe && !isDraggingTimeIndicator) animateTimeline(timelineTime); const currentW = sceneContainer.clientWidth; const currentH = sceneContainer.clientHeight; if (canvas.width !== currentW || canvas.height !== currentH) { renderer.setSize(currentW, currentH, false); cssRenderer.setSize(currentW, currentH); camera.aspect = currentW / currentH; camera.updateProjectionMatrix(); drawKeyframes(); connectors.forEach(c => { if (c.line.material instanceof LineMaterial) c.line.material.resolution.set(currentW, currentH); }); } if (cameraPivotAnimatedThisFrame && controls.enabled) { controls.target.copy(cameraPivot.position); cameraPivotAnimatedThisFrame = false; } if (controls.enabled) controls.update(delta); updateConnectors();
  if (frameCounter % logInterval === 1) { console.log(`[Animate DBG ${frameCounter}] TC Vis: ${transformControls.visible}, TC Attached: ${transformControls.object?.name || transformControls.object?.uuid || 'None'}, TC Size: ${transformControls.size.toFixed(2)}`); console.log(`[Animate DBG ${frameCounter}] Controls Target: (${controls.target.x.toFixed(1)}, ${controls.target.y.toFixed(1)}, ${controls.target.z.toFixed(1)})`); if(selectedObject) { const wp = selectedObject.getWorldPosition(tempVec); console.log(`[Animate DBG ${frameCounter}] Sel Obj World Pos: (${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}, ${wp.z.toFixed(1)}), Cam World Pos: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`); } }
  if (frameCounter % (logInterval * 5) === 1) { scene.traverse((obj) => { if (obj.isMesh || obj.isLine || obj.isSprite || obj.isPoints) { if (hasInvalidTransform(obj)) console.error(`[Animate INVALID TRANSFORM ${frameCounter}] Obj: ${obj.name || obj.uuid}`); } }); }
  try { renderer.render(scene, camera); cssRenderer.render(cssScene, camera); } catch (renderError) { console.error("***** Rendering Error Caught! *****", renderError); }
}

// --- Initial Setup ---
console.log("--- Initial Setup START (v8 - Basic Render Test) ---");
const clock = new THREE.Clock(); setActiveTransformButton(translateBtn); timeIndicator.style.cursor = 'grab'; formatEndTimeInput(); renderer.outputColorSpace = THREE.SRGBColorSpace; console.log("[Init] Renderer settings applied."); updateTree(); updateTimeIndicator(); transformControls.visible = false; transformControls.size = 1; console.log("[Init LOG] Initial TC hidden, size=1."); animate(); console.log("--- Initial Setup END (v8 - Basic Render Test) ---");

// --- Navbar Menu Toggle Logic ---
function setupMenuToggle(buttonId, submenuId) { const btn = document.getElementById(buttonId); const sub = document.getElementById(submenuId); if (btn && sub) { btn.addEventListener('click', (e) => { e.stopPropagation(); const act = sub.classList.contains('active'); document.querySelectorAll('.submenu.active').forEach(m => m.classList.remove('active')); if (!act) sub.classList.add('active'); console.log(`[Navbar LOG] Toggled ${submenuId}.`); }); } else console.warn(`[Navbar LOG] Cannot find ${buttonId} or ${submenuId}.`); }
setupMenuToggle('file-menu-btn', 'file-submenu'); setupMenuToggle('html-menu-btn', 'html-submenu'); setupMenuToggle('tools-menu-btn', 'tools-submenu');
document.addEventListener('click', (e) => { if (!e.target.closest('.menu-container')) { const open = document.querySelectorAll('.submenu.active'); if (open.length > 0) { console.log("[Navbar LOG] Click outside, closing menus."); open.forEach(m => m.classList.remove('active')); } } });

// --- Event Listener für HTML-Template Buttons ---
document.querySelectorAll('.add-html-btn').forEach(btn => { btn.addEventListener('click', () => { const id = btn.dataset.template; console.log(`[HTML Btn] Clicked. Template: ${id}`); addHTMLElement(id); }); });
console.log("[Init] HTML template listeners added.");

// --- Event Listener für Connect Button ---
connectElementsBtn.addEventListener('click', startConnectionMode); console.log("[Init] Connect listener added.");

// --- Tastatur-Shortcuts ---
window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || e.target.closest('.lil-gui')) return; switch(e.key.toLowerCase()) { case 'g': case 't': if (!isConnecting && transformControls.object) { console.log("[KB Shortcut] -> Translate"); transformControls.setMode("translate"); setActiveTransformButton(translateBtn); } break; case 'r': if (!isConnecting && transformControls.object) { console.log("[KB Shortcut] -> Rotate"); transformControls.setMode("rotate"); setActiveTransformButton(rotateBtn); } break; case 's': if (!isConnecting && transformControls.object) { console.log("[KB Shortcut] -> Scale"); transformControls.setMode("scale"); setActiveTransformButton(scaleBtn); } break; case 'delete': case 'backspace': if (document.activeElement && document.activeElement.closest('.lil-gui')) break; if (selectedObject && !isConnecting) { console.log(`[KB Shortcut] -> Delete Object: ${selectedObject.name||selectedObject.uuid}`); deleteObject(selectedObject); } else if (connectorGuiState.selectedConnectorName && !isConnecting) { console.log(`[KB Shortcut] -> Delete Connector: ${connectorGuiState.selectedConnectorName}`); deleteSelectedConnector(); } break; case 'escape': if (isConnecting) { console.log("[KB Shortcut] -> Cancel Connection"); cancelConnectionMode(); } else if (selectedObject) { console.log("[KB Shortcut] -> Deselect Object"); deselectObject(); } break; } });

// --- Löschfunktion ---
function deleteObject(objectToDelete) { if (!objectToDelete) return; const uuid = objectToDelete.uuid; const name = objectToDelete.name || `Object ${uuid}`; console.log(`[deleteObject] Deleting: ${name}`); if (selectedObject === objectToDelete) deselectObject(); if (keyframes[uuid]) { delete keyframes[uuid]; console.log(`[deleteObject] Deleted keyframes.`); } const conns = connectors.filter(c => c.obj1 === objectToDelete || c.obj2 === objectToDelete); conns.forEach(c => { console.log(`[deleteObject] Removing connector ${c.name}`); scene.remove(c.line); scene.remove(c.arrow); if (c.line.material) c.line.material.dispose(); if (c.line.geometry) c.line.geometry.dispose(); const i = connectors.indexOf(c); if (i > -1) connectors.splice(i, 1); }); if (conns.length > 0) updateConnectorDropdown(); if (objectToDelete.userData.isHTML) { cssScene.remove(objectToDelete); console.log(`[deleteObject] Removed from CSS Scene.`); } else { disposeNode(objectToDelete); objectToDelete.removeFromParent(); console.log(`[deleteObject] Disposed & removed from 3D Scene.`); } updateTree(); console.log(`[deleteObject] Deleted ${name}`); }
function disposeNode(node) { if (!node) return; if (node.children?.length > 0) [...node.children].forEach(disposeNode); if (node.isMesh || node.isLine || node.isPoints || node.isSprite) { if (node.geometry) node.geometry.dispose(); if (node.material) { if (Array.isArray(node.material)) node.material.forEach(disposeMaterial); else disposeMaterial(node.material); } } }
function disposeMaterial(material) { if (!material) return; material.dispose(); for (const key in material) { const v = material[key]; if (v && typeof v === 'object' && v.isTexture) v.dispose(); } }
console.log("[Init] Keyboard shortcuts added.");