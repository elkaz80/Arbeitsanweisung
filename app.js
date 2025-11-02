import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Helper function to check if input is focused
function isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.hasAttribute('contenteditable')
    );
}

// HTML Templates
const HTML_TEMPLATES = [
    {
        id: 'text',
        name: 'Text',
        icon: 'article',
        content: '<p contenteditable="true">Text eingeben...</p>'
    },
    {
        id: 'heading',
        name: 'Überschrift',
        icon: 'title',
        content: '<h3 contenteditable="true">Überschrift</h3><p contenteditable="true">Beschreibung</p>'
    },
    {
        id: 'checklist',
        name: 'Checkliste',
        icon: 'checklist',
        content: `
            <h4>Checkliste</h4>
            <label><input type="checkbox"> Schritt 1</label><br>
            <label><input type="checkbox"> Schritt 2</label><br>
            <label><input type="checkbox"> Schritt 3</label>
        `
    },
    {
        id: 'warning',
        name: 'Warnung',
        icon: 'warning',
        content: `
            <div style="border-left: 4px solid #ff6b6b; padding-left: 12px;">
                <h4 style="color: #ff6b6b;">⚠️ Warnung</h4>
                <p contenteditable="true">Wichtiger Sicherheitshinweis</p>
            </div>
        `
    },
    {
        id: 'info',
        name: 'Info',
        icon: 'info',
        content: `
            <div style="border-left: 4px solid #4dabf7; padding-left: 12px;">
                <h4 style="color: #4dabf7;">ℹ️ Info</h4>
                <p contenteditable="true">Zusätzliche Information</p>
            </div>
        `
    },
    {
        id: 'steps',
        name: 'Schritte',
        icon: 'format_list_numbered',
        content: `
            <h4>Arbeitsschritte</h4>
            <ol>
                <li contenteditable="true">Erster Schritt</li>
                <li contenteditable="true">Zweiter Schritt</li>
                <li contenteditable="true">Dritter Schritt</li>
            </ol>
        `
    },
    {
        id: 'measurement',
        name: 'Messwert',
        icon: 'straighten',
        content: `
            <div style="background: #333; padding: 12px; border-radius: 4px;">
                <h4 style="color: #4dabf7; margin: 0 0 8px 0;">Messwert</h4>
                <input type="number" placeholder="0.00" style="background: #222; border: 1px solid #444; color: white; padding: 4px; border-radius: 2px;">
                <select style="background: #222; border: 1px solid #444; color: white; padding: 4px; border-radius: 2px; margin-left: 4px;">
                    <option>mm</option>
                    <option>cm</option>
                    <option>m</option>
                </select>
            </div>
        `
    }
];

// Tool Library Items
const TOOL_LIBRARY = [
    { id: 'cube', name: 'Würfel', icon: 'crop_square', type: '3d', geometry: 'box' },
    { id: 'sphere', name: 'Kugel', icon: 'circle', type: '3d', geometry: 'sphere' },
    { id: 'cylinder', name: 'Zylinder', icon: 'fiber_manual_record', type: '3d', geometry: 'cylinder' },
    { id: 'cone', name: 'Kegel', icon: 'change_history', type: '3d', geometry: 'cone' },
    { id: 'torus', name: 'Torus', icon: 'donut_large', type: '3d', geometry: 'torus' },
    { id: 'plane', name: 'Ebene', icon: 'crop_landscape', type: '3d', geometry: 'plane' },
    { id: 'arrow', name: 'Pfeil', icon: 'arrow_forward', type: 'svg' },
    { id: 'light', name: 'Licht', icon: 'lightbulb', type: 'light' },
    { id: 'camera', name: 'Kamera', icon: 'videocam', type: 'camera' },
    { id: 'marker', name: 'Marker', icon: 'place', type: 'marker' }
];

class WorkInstructionEditor {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cssRenderer = null;
        this.cssScene = null;
        this.orbitControls = null;
        this.transformControls = null;
        
        this.objects = new Map();
        this.selectedObjects = new Set();
        this.htmlElements = new Map();
        this.connectors = new Map();
        this.keyframes = new Map();
        this.customTemplates = [];
        
        this.autoKey = false;
        this.currentTime = 0;
        this.duration = 10;
        this.isPlaying = false;
        
        this.history = [];
        this.historyIndex = -1;
        
        this.clock = new THREE.Clock();
        
        this.init();
    }

    async init() {
        try {
            document.getElementById('loading').style.display = 'flex';
            
            await this.setupScene();
            await this.setupControls();
            await this.setupUI();
            await this.setupEventListeners();
            
            this.loadCustomTemplates();
            this.animate();
            
            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            console.error('Initialization error:', error);
            document.getElementById('loading').innerHTML = 'Fehler beim Laden';
        }
    }

    async setupScene() {
        // Main scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1d21);
        
        // CSS3D scene
        this.cssScene = new THREE.Scene();
        
        // Camera
        const container = document.querySelector('.scene-container');
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);
        
        // WebGL Renderer
        const canvas = document.getElementById('three-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas,
            antialias: true,
            alpha: false 
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // CSS3D Renderer
        this.cssRenderer = new CSS3DRenderer();
        this.cssRenderer.setSize(container.clientWidth, container.clientHeight);
        this.cssRenderer.domElement.style.position = 'absolute';
        this.cssRenderer.domElement.style.top = '0';
        this.cssRenderer.domElement.style.pointerEvents = 'none';
        document.getElementById('css-container').appendChild(this.cssRenderer.domElement);
        
        // Enable pointer events for CSS3D objects
        this.cssRenderer.domElement.querySelectorAll('*').forEach(el => {
            el.style.pointerEvents = 'auto';
        });
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        this.scene.add(directionalLight);
        
        // Grid Helper
        this.gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        this.scene.add(this.gridHelper);
        
        // Ground plane for shadows
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.ShadowMaterial({ 
            opacity: 0.3,
            transparent: true 
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.userData.isGround = true;
        ground.name = 'Ground';
        this.scene.add(ground);
        
        // Raycaster
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
    }

    async setupControls() {
        // Orbit Controls
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.minDistance = 1;
        this.orbitControls.maxDistance = 100;
        
        // Transform Controls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.orbitControls.enabled = !event.value;
        });
        
        this.transformControls.addEventListener('objectChange', () => {
            if (this.autoKey && this.selectedObjects.size > 0) {
                this.addKeyframe();
            }
            this.updatePropertiesPanel();
        });
        
        this.transformControls.size = 1.2;
        this.scene.add(this.transformControls);
        
        // Simple outline effect
        this.outlinePass = {
            selectedObjects: [],
            update: () => {
                this.objects.forEach((obj) => {
                    if (obj.isMesh && obj.material) {
                        if (!obj.material.userData) {
                            obj.material.userData = {};
                        }
                        
                        if (!obj.material.userData.originalEmissive && obj.material.emissive) {
                            obj.material.userData.originalEmissive = obj.material.emissive.clone();
                        }
                        
                        if (obj.material.emissive) {
                            const isSelected = this.selectedObjects.has(obj);
                            obj.material.emissive = isSelected ? 
                                new THREE.Color(0x444444) : 
                                (obj.material.userData.originalEmissive || new THREE.Color(0x000000));
                        }
                    }
                });
            }
        };
    }

    async setupUI() {
        // Populate HTML menu
        const htmlMenu = document.getElementById('html-menu');
        const standardSection = document.createElement('div');
        
        HTML_TEMPLATES.forEach(template => {
            const item = document.createElement('button');
            item.className = 'dropdown-item';
            item.innerHTML = `
                <span class="material-icons">${template.icon}</span>
                ${template.name}
            `;
            item.addEventListener('click', () => {
                this.addHTMLElement(template);
                this.closeAllMenus();
            });
            standardSection.appendChild(item);
        });
        
        const divider = htmlMenu.querySelector('.dropdown-divider');
        if (divider) {
            htmlMenu.insertBefore(standardSection, divider);
        } else {
            htmlMenu.appendChild(standardSection);
        }
        
        // Populate tool library
        const toolGrid = document.getElementById('tool-grid');
        TOOL_LIBRARY.forEach(tool => {
            const item = document.createElement('div');
            item.className = 'tool-item';
            item.innerHTML = `
                <span class="material-icons tool-icon">${tool.icon}</span>
                <span class="tool-name">${tool.name}</span>
            `;
            item.addEventListener('click', () => {
                this.addToolObject(tool);
            });
            toolGrid.appendChild(item);
        });
        
        // Set initial transform mode
        this.setTransformMode('translate');
        
        // Add demo cube
        this.addDemoCube();
    }

    addDemoCube() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x5a9cf8,
            roughness: 0.5,
            metalness: 0.1
        });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 0.5, 0);
        cube.castShadow = true;
        cube.receiveShadow = true;
        cube.name = 'Demo Würfel';
        
        this.addObject(cube, 'Demo Würfel');
    }

    async setupEventListeners() {
        // Navbar menus
        document.querySelectorAll('.navbar-item').forEach(item => {
            const link = item.querySelector('.navbar-link');
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const wasActive = item.classList.contains('active');
                document.querySelectorAll('.navbar-item').forEach(i => {
                    i.classList.remove('active');
                });
                
                if (!wasActive) {
                    item.classList.add('active');
                }
            });
        });
        
        // Close menus on outside click
        document.addEventListener('click', () => {
            this.closeAllMenus();
        });
        
        // Prevent menu close on menu click
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.addEventListener('click', (e) => e.stopPropagation());
        });
        
        // File operations
        document.getElementById('new-project').addEventListener('click', () => {
            this.newProject();
            this.closeAllMenus();
        });
        
        document.getElementById('load-model').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        
        document.getElementById('save-project').addEventListener('click', () => {
            this.saveProject();
            this.closeAllMenus();
        });
        
        document.getElementById('file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadModel(e.target.files[0]);
                e.target.value = '';
            }
        });
        
        // Export
        document.getElementById('export-scene').addEventListener('click', () => {
            this.exportScene();
            this.closeAllMenus();
        });
        
        document.getElementById('export-viewer').addEventListener('click', () => {
            this.exportAsViewer();
            this.closeAllMenus();
        });
        
        // Edit operations
        document.getElementById('duplicate').addEventListener('click', () => {
            this.duplicateSelected();
            this.closeAllMenus();
        });
        
        document.getElementById('delete').addEventListener('click', () => {
            this.deleteSelected();
            this.closeAllMenus();
        });
        
        document.getElementById('group').addEventListener('click', () => {
            this.groupSelected();
            this.closeAllMenus();
        });
        
        document.getElementById('ungroup').addEventListener('click', () => {
            this.ungroupSelected();
            this.closeAllMenus();
        });
        
        // Undo/Redo
        document.getElementById('undo').addEventListener('click', () => {
            this.undo();
            this.closeAllMenus();
        });
        
        document.getElementById('redo').addEventListener('click', () => {
            this.redo();
            this.closeAllMenus();
        });
        
        // Transform modes
        document.getElementById('translate-mode').addEventListener('click', () => {
            this.setTransformMode('translate');
        });
        
        document.getElementById('rotate-mode').addEventListener('click', () => {
            this.setTransformMode('rotate');
        });
        
        document.getElementById('scale-mode').addEventListener('click', () => {
            this.setTransformMode('scale');
        });
        
        // Timeline
        document.getElementById('play-pause').addEventListener('click', () => {
            this.togglePlayback();
        });
        
        document.getElementById('stop').addEventListener('click', () => {
            this.stopPlayback();
        });
        
        document.getElementById('add-keyframe').addEventListener('click', () => {
            this.addKeyframe();
        });
        
        document.getElementById('toggle-auto-key').addEventListener('click', () => {
            this.toggleAutoKey();
        });
        
        const timelineSlider = document.getElementById('timeline-slider');
        timelineSlider.addEventListener('click', (e) => {
            this.seekTimeline(e);
        });
        
        // Current time input
        document.getElementById('current-time').addEventListener('change', (e) => {
            this.currentTime = parseFloat(e.target.value);
            this.updateAnimation();
        });
        
        // Duration input
        document.getElementById('duration').addEventListener('change', (e) => {
            this.duration = Math.max(1, parseFloat(e.target.value));
            this.updateTimeline();
        });
        
        // Material editor
        document.getElementById('edit-material').addEventListener('click', () => {
            if (this.selectedObjects.size > 0) {
                this.openMaterialEditor();
                this.closeAllMenus();
            }
        });
        
        document.getElementById('add-material').addEventListener('click', () => {
            this.createNewMaterial();
            this.closeAllMenus();
        });
        
        document.getElementById('apply-material').addEventListener('click', () => {
            this.applyMaterial();
        });
        
        // Material presets
        document.querySelectorAll('.material-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.currentTarget.dataset.preset;
                this.applyMaterialPreset(preset);
                this.closeAllMenus();
            });
        });
        
        // Tool library
        document.getElementById('open-library').addEventListener('click', () => {
            this.openPanel('tool-library');
            this.closeAllMenus();
        });
        
        document.getElementById('add-custom-tool').addEventListener('click', () => {
            this.addCustomTool();
        });
        
        // Connectors
        document.getElementById('add-connector').addEventListener('click', () => {
            this.addConnector();
            this.closeAllMenus();
        });
        
        // Measure tool
        document.getElementById('measure-tool').addEventListener('click', () => {
            this.activateMeasureTool();
            this.closeAllMenus();
        });
        
        // Annotation tool
        document.getElementById('annotation-tool').addEventListener('click', () => {
            this.activateAnnotationTool();
            this.closeAllMenus();
        });
        
        // Settings
        document.getElementById('open-settings').addEventListener('click', () => {
            this.openPanel('settings-panel');
            this.closeAllMenus();
        });
        
        document.getElementById('camera-settings').addEventListener('click', () => {
            this.openPanel('settings-panel');
            this.closeAllMenus();
        });
        
        document.getElementById('render-settings').addEventListener('click', () => {
            this.openPanel('settings-panel');
            this.closeAllMenus();
        });
        
        // Template creator
        document.getElementById('create-template').addEventListener('click', () => {
            this.openPanel('template-creator');
            this.closeAllMenus();
        });
        
        document.getElementById('template-html').addEventListener('input', (e) => {
            document.getElementById('template-preview').innerHTML = e.target.value;
        });
        
        document.getElementById('save-template').addEventListener('click', () => {
            this.saveCustomTemplate();
        });
        
        // Panel close buttons
        document.querySelectorAll('.panel-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.floating-panel').style.display = 'none';
            });
        });
        
        // Canvas events
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.renderer.domElement.addEventListener('contextmenu', (e) => this.onRightClick(e));
        
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Context menu
        this.setupContextMenu();
        
        // Settings
        this.setupSettingsListeners();
    }

    setupContextMenu() {
        const contextItems = {
            'context-duplicate': () => this.duplicateSelected(),
            'context-delete': () => this.deleteSelected(),
            'context-group': () => this.groupSelected(),
            'context-ungroup': () => this.ungroupSelected(),
            'context-material': () => this.openMaterialEditor(),
            'context-focus': () => this.focusOnSelected()
        };
        
        Object.entries(contextItems).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', () => {
                    handler();
                    this.hideContextMenu();
                });
            }
        });
    }

    setupSettingsListeners() {
        // Scene settings
        document.getElementById('bg-color').addEventListener('change', (e) => {
            this.scene.background = new THREE.Color(e.target.value);
        });
        
        document.getElementById('fog-enabled').addEventListener('change', (e) => {
            if (e.target.checked) {
                const fogColor = document.getElementById('fog-color').value;
                this.scene.fog = new THREE.Fog(fogColor, 1, 50);
            } else {
                this.scene.fog = null;
            }
        });
        
        document.getElementById('fog-color').addEventListener('change', (e) => {
            if (this.scene.fog) {
                this.scene.fog.color = new THREE.Color(e.target.value);
            }
        });
        
        // Camera settings
        document.getElementById('camera-fov').addEventListener('change', (e) => {
            this.camera.fov = parseFloat(e.target.value);
            this.camera.updateProjectionMatrix();
        });
        
        document.getElementById('camera-near').addEventListener('change', (e) => {
            this.camera.near = parseFloat(e.target.value);
            this.camera.updateProjectionMatrix();
        });
        
        document.getElementById('camera-far').addEventListener('change', (e) => {
            this.camera.far = parseFloat(e.target.value);
            this.camera.updateProjectionMatrix();
        });
        
        // Rendering settings
        document.getElementById('shadows-enabled').addEventListener('change', (e) => {
            this.renderer.shadowMap.enabled = e.target.checked;
            this.renderer.shadowMap.needsUpdate = true;
        });
        
        document.getElementById('antialias-enabled').addEventListener('change', (e) => {
            // Note: Antialiasing can't be changed after renderer creation
            alert('Antialiasing-Änderungen erfordern einen Neustart der Anwendung');
        });
        
        // View settings
        document.getElementById('toggle-grid').addEventListener('click', () => {
            this.gridHelper.visible = !this.gridHelper.visible;
            this.closeAllMenus();
        });
        
        document.getElementById('toggle-wireframe').addEventListener('click', () => {
            this.toggleWireframe();
            this.closeAllMenus();
        });
        
        document.getElementById('reset-camera').addEventListener('click', () => {
            this.resetCamera();
            this.closeAllMenus();
        });
        
        document.getElementById('focus-object').addEventListener('click', () => {
            this.focusOnSelected();
            this.closeAllMenus();
        });
    }

    // Project Management Methods

    newProject() {
        if (confirm('Alle ungespeicherten Änderungen gehen verloren. Fortfahren?')) {
            // Clear all objects
            const objectsToRemove = Array.from(this.objects.values());
            objectsToRemove.forEach(obj => {
                if (obj && !obj.userData.isGround) {
                    this.scene.remove(obj);
                    
                    // Cleanup HTML elements
                    if (obj.userData.cssObject) {
                        const cssObj = this.htmlElements.get(obj.userData.id);
                        if (cssObj) {
                            this.cssScene.remove(cssObj);
                        }
                    }
                    
                    // Dispose geometry and materials
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        } else {
                            obj.material.dispose();
                        }
                    }
                }
            });
            
            // Clear all data
            this.objects.clear();
            this.htmlElements.clear();
            this.keyframes.clear();
            this.connectors.clear();
            this.selectedObjects.clear();
            this.transformControls.detach();
            
            // Reset timeline
            this.currentTime = 0;
            this.isPlaying = false;
            this.updateAnimation();
            
            // Reset history
            this.history = [];
            this.historyIndex = -1;
            
            // Update UI
            this.updateObjectTree();
            this.updateTimeline();
            this.updatePropertiesPanel();
            
            // Add demo cube
            this.addDemoCube();
        }
    }

    saveProject() {
        const projectData = {
            version: '1.0',
            created: new Date().toISOString(),
            objects: [],
            htmlElements: [],
            keyframes: {},
            connectors: [],
            camera: {
                position: this.camera.position.toArray(),
                rotation: this.camera.rotation.toArray(),
                fov: this.camera.fov
            },
            settings: {
                duration: this.duration,
                background: this.scene.background.getHex(),
                fog: this.scene.fog ? {
                    color: this.scene.fog.color.getHex(),
                    near: this.scene.fog.near,
                    far: this.scene.fog.far
                } : null
            }
        };
        
        // Save objects
        this.objects.forEach((obj, id) => {
            if (!obj.userData.isGround && !obj.userData.isHTMLHelper) {
                const objData = {
                    id: id,
                    name: obj.name,
                    type: obj.type,
                    position: obj.position.toArray(),
                    rotation: obj.rotation.toArray(),
                    scale: obj.scale.toArray(),
                    visible: obj.visible,
                    userData: obj.userData
                };
                
                // Save geometry info
                if (obj.geometry) {
                    objData.geometry = {
                        type: obj.geometry.type,
                        parameters: obj.geometry.parameters || {}
                    };
                }
                
                // Save material properties
                if (obj.isMesh && obj.material) {
                    objData.material = {
                        type: obj.material.type,
                        color: obj.material.color ? obj.material.color.getHex() : 0xffffff,
                        metalness: obj.material.metalness || 0,
                        roughness: obj.material.roughness || 0.5,
                        opacity: obj.material.opacity || 1,
                        transparent: obj.material.transparent || false,
                        emissive: obj.material.emissive ? obj.material.emissive.getHex() : 0x000000
                    };
                }
                
                // Save parent relationship
                if (obj.parent && obj.parent !== this.scene) {
                    objData.parentId = obj.parent.userData.id;
                }
                
                projectData.objects.push(objData);
            }
        });
        
        // Save HTML elements
        this.htmlElements.forEach((cssObj, id) => {
            if (cssObj && cssObj.element) {
                projectData.htmlElements.push({
                    id: id,
                    html: cssObj.element.outerHTML,
                    position: cssObj.position.toArray(),
                    rotation: cssObj.rotation.toArray(),
                    scale: cssObj.scale.toArray(),
                    name: cssObj.name
                });
            }
        });
        
        // Save keyframes
        this.keyframes.forEach((frames, id) => {
            projectData.keyframes[id] = frames;
        });
        
        // Save connectors
        this.connectors.forEach(connector => {
            projectData.connectors.push({
                id: connector.id,
                startId: connector.start.userData.id,
                endId: connector.end.userData.id,
                type: connector.type,
                animated: connector.animated,
                color: connector.color
            });
        });
        
        // Download as JSON
        const dataStr = JSON.stringify(projectData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `project_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    loadModel(file) {
        const url = URL.createObjectURL(file);
        const extension = file.name.split('.').pop().toLowerCase();
        
        let loader;
        const onLoad = (object) => {
            this.addObject(object, file.name);
            URL.revokeObjectURL(url);
        };
        
        const onProgress = (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                console.log(`Loading: ${percentComplete.toFixed(2)}%`);
            }
        };
        
        const onError = (error) => {
            console.error('Error loading model:', error);
            alert('Fehler beim Laden der Datei: ' + error.message);
            URL.revokeObjectURL(url);
        };
        
        switch(extension) {
            case 'gltf':
            case 'glb':
                loader = new GLTFLoader();
                loader.load(url, (gltf) => onLoad(gltf.scene), onProgress, onError);
                break;
                
            case 'obj':
                loader = new OBJLoader();
                loader.load(url, onLoad, onProgress, onError);
                break;
                
            case 'stl':
                loader = new STLLoader();
                loader.load(url, (geometry) => {
                    const material = new THREE.MeshStandardMaterial({ 
                        color: 0x5a9cf8,
                        roughness: 0.5,
                        metalness: 0.1
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    onLoad(mesh);
                }, onProgress, onError);
                break;
                
            case 'fbx':
                loader = new FBXLoader();
                loader.load(url, onLoad, onProgress, onError);
                break;
                
            default:
                alert('Nicht unterstütztes Dateiformat: ' + extension);
                URL.revokeObjectURL(url);
        }
    }

    // Object Management Methods

    addObject(object, name = 'Object') {
        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Normalize size if too large
        if (maxDim > 5) {
            object.scale.multiplyScalar(5 / maxDim);
        }
        
        // Center object
        box.setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
        object.position.y = Math.max(0, object.position.y);
        
        // Setup object
        object.name = name;
        object.userData.id = THREE.MathUtils.generateUUID();
        
        // Enable shadows and setup materials
        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Ensure material is not shared
                if (child.material) {
                    child.material = child.material.clone();
                    
                    // Add emissive property for selection highlight
                    if (!child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x000000);
                    }
                }
            }
        });
        
        this.scene.add(object);
        this.objects.set(object.userData.id, object);
        
        // Select new object
        this.selectObject(object);
        
        // Update UI
        this.updateObjectTree();
        
        // Add to history
        this.addToHistory({
            type: 'add',
            object: object
        });
    }

    addHTMLElement(template) {
        const element = document.createElement('div');
        element.className = 'html3d-element';
        element.innerHTML = template.content;
        element.style.pointerEvents = 'auto';
        
        const cssObject = new CSS3DObject(element);
        cssObject.position.set(
            (Math.random() - 0.5) * 4,
            2,
            (Math.random() - 0.5) * 4
        );
        cssObject.scale.set(0.01, 0.01, 0.01);
        
        cssObject.name = template.name;
        cssObject.userData.id = THREE.MathUtils.generateUUID();
        cssObject.userData.isHTML = true;
        
        // Create helper mesh for transform controls
        const helper = new THREE.Mesh(
            new THREE.BoxGeometry(2, 1, 0.1),
            new THREE.MeshBasicMaterial({ 
                visible: false,
                transparent: true,
                opacity: 0
            })
        );
        helper.position.copy(cssObject.position);
        helper.userData.cssObject = cssObject;
        helper.userData.id = cssObject.userData.id;
        helper.userData.isHTMLHelper = true;
        helper.name = cssObject.name;
        
        this.cssScene.add(cssObject);
        this.scene.add(helper);
        
        this.objects.set(cssObject.userData.id, helper);
        this.htmlElements.set(cssObject.userData.id, cssObject);
        
        // Make element interactive
        element.addEventListener('mousedown', (e) => {
            if (!e.target.hasAttribute('contenteditable') && 
                e.target.type !== 'checkbox' &&
                e.target.tagName !== 'INPUT' &&
                e.target.tagName !== 'SELECT') {
                e.stopPropagation();
                this.selectObject(helper);
            }
        });
        
        // Prevent hotkeys when editing
        element.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
        
        this.selectObject(helper);
        this.updateObjectTree();
    }

    addToolObject(tool) {
        switch(tool.type) {
            case '3d':
                this.add3DPrimitive(tool);
                break;
            case 'light':
                this.addLight();
                break;
            case 'camera':
                this.addCamera();
                break;
            case 'svg':
                this.addSVGArrow();
                break;
            case 'marker':
                this.addMarker();
                break;
        }
    }

    add3DPrimitive(tool) {
        let geometry;
        switch(tool.geometry) {
            case 'box':
                geometry = new THREE.BoxGeometry(1, 1, 1);
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(0.5, 32, 16);
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
                break;
            case 'cone':
                geometry = new THREE.ConeGeometry(0.5, 1, 32);
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
                break;
            case 'plane':
                geometry = new THREE.PlaneGeometry(2, 2);
                break;
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
        }
        
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x5a9cf8,
            roughness: 0.5,
            metalness: 0.1
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0.5, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.addObject(mesh, tool.name);
    }

    addLight() {
        const light = new THREE.PointLight(0xffffff, 1, 10);
        light.position.set(0, 3, 0);
        light.castShadow = true;
        
        const helper = new THREE.PointLightHelper(light, 0.5);
        light.add(helper);
        
        this.addObject(light, 'Punktlicht');
    }

    addCamera() {
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
        const helper = new THREE.CameraHelper(camera);
        
        const group = new THREE.Group();
        group.add(camera);
        group.add(helper);
        group.position.set(0, 2, 3);
        
        this.addObject(group, 'Kamera');
    }

    addSVGArrow() {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(-0.2, -0.2);
        shape.lineTo(-0.1, -0.2);
        shape.lineTo(-0.1, -0.5);
        shape.lineTo(0.1, -0.5);
        shape.lineTo(0.1, -0.2);
        shape.lineTo(0.2, -0.2);
        shape.lineTo(0, 0);
        
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI;
        mesh.position.set(0, 1, 0);
        
        this.addObject(mesh, 'Pfeil');
    }

    addMarker() {
        const group = new THREE.Group();
        
        // Marker pole
        const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
        const poleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.y = 1;
        group.add(pole);
        
        // Marker flag
        const flagGeometry = new THREE.ConeGeometry(0.3, 0.5, 4);
        const flagMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const flag = new THREE.Mesh(flagGeometry, flagMaterial);
        flag.position.y = 2.25;
        flag.rotation.z = Math.PI;
        group.add(flag);
        
        group.position.set(0, 0, 0);
        this.addObject(group, 'Marker');
    }

    addCustomTool() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.glb,.gltf,.obj,.stl';
        
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                this.loadModel(file);
            }
        });
        
        input.click();
    }

    // Selection Methods

    selectObject(object, multi = false) {
        if (!object) return;
        
        if (!multi) {
            this.selectedObjects.clear();
            
            // Clear HTML highlights
            this.htmlElements.forEach(el => {
                if (el.element) {
                    el.element.classList.remove('selected');
                }
            });
        }
        
        this.selectedObjects.add(object);
        
        // Attach transform controls
        this.transformControls.attach(object);
        
        // Highlight HTML element
        if (object.userData.cssObject) {
            const cssObj = this.htmlElements.get(object.userData.id);
            if (cssObj && cssObj.element) {
                cssObj.element.classList.add('selected');
            }
        }
        
        // Update outline
        this.outlinePass.update();
        
        // Update UI
        this.updateObjectTree();
        this.updatePropertiesPanel();
    }

    deselectAll() {
        this.selectedObjects.clear();
        this.transformControls.detach();
        
        // Clear HTML highlights
        this.htmlElements.forEach(el => {
            if (el.element) {
                el.element.classList.remove('selected');
            }
        });
        
        this.outlinePass.update();
        this.updateObjectTree();
        this.updatePropertiesPanel();
    }

    deleteSelected() {
        if (this.selectedObjects.size === 0) return;
        
        const toDelete = Array.from(this.selectedObjects);
        
        toDelete.forEach(obj => {
            // Remove from scene
            this.scene.remove(obj);
            
            // Remove CSS object if exists
            if (obj.userData.cssObject) {
                const cssObj = this.htmlElements.get(obj.userData.id);
                if (cssObj) {
                    this.cssScene.remove(cssObj);
                    this.htmlElements.delete(obj.userData.id);
                }
            }
            
            // Remove children from management
            obj.traverse((child) => {
                if (child !== obj && child.userData.id) {
                    this.objects.delete(child.userData.id);
                }
            });
            
            // Clean up geometry and materials
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
            
            // Remove from objects map
            this.objects.delete(obj.userData.id);
            
            // Remove keyframes
            this.keyframes.delete(obj.userData.id);
            
            // Remove connectors
            const connectorsToRemove = [];
            this.connectors.forEach((connector, id) => {
                if (connector.start === obj || connector.end === obj) {
                    connectorsToRemove.push(id);
                }
            });
            connectorsToRemove.forEach(id => this.connectors.delete(id));
        });
        
        this.deselectAll();
        this.updateObjectTree();
        this.updateTimeline();
        this.updateConnectors();
        
        // Add to history
        this.addToHistory({
            type: 'delete',
            objects: toDelete
        });
    }

    duplicateSelected() {
        if (this.selectedObjects.size === 0) return;
        
        const newSelection = [];
        
        this.selectedObjects.forEach(obj => {
            const clone = obj.clone();
            clone.userData.id = THREE.MathUtils.generateUUID();
            clone.position.x += 1;
            clone.position.z += 1;
            
            // Clone materials
            clone.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                }
                if (child.userData.id) {
                    child.userData.id = THREE.MathUtils.generateUUID();
                }
            });
            
            // Clone CSS object if exists
            if (obj.userData.cssObject) {
                const originalCSS = this.htmlElements.get(obj.userData.id);
                if (originalCSS && originalCSS.element) {
                    // Create new HTML element
                    const element = document.createElement('div');
                    element.className = 'html3d-element';
                    element.innerHTML = originalCSS.element.innerHTML;
                    element.style.pointerEvents = 'auto';
                    
                    const cssClone = new CSS3DObject(element);
                    cssClone.position.copy(clone.position);
                    cssClone.rotation.copy(clone.rotation);
                    cssClone.scale.copy(clone.scale);
                    cssClone.userData.id = clone.userData.id;
                    cssClone.userData.isHTML = true;
                    cssClone.name = originalCSS.name + ' (Kopie)';
                    
                    clone.userData.cssObject = cssClone;
                    
                    this.cssScene.add(cssClone);
                    this.htmlElements.set(clone.userData.id, cssClone);
                    
                    // Re-setup event listeners
                    element.addEventListener('mousedown', (e) => {
                        if (!e.target.hasAttribute('contenteditable') && 
                            e.target.type !== 'checkbox' &&
                            e.target.tagName !== 'INPUT' &&
                            e.target.tagName !== 'SELECT') {
                            e.stopPropagation();
                            this.selectObject(clone);
                        }
                    });
                    
                    element.addEventListener('keydown', (e) => {
                        e.stopPropagation();
                    });
                }
            }
            
            this.scene.add(clone);
            this.objects.set(clone.userData.id, clone);
            newSelection.push(clone);
        });
        
        // Select duplicated objects
        this.deselectAll();
        newSelection.forEach((obj, index) => {
            this.selectObject(obj, index > 0);
        });
        
        this.updateObjectTree();
    }

    groupSelected() {
        if (this.selectedObjects.size < 2) {
            alert('Bitte wählen Sie mindestens 2 Objekte aus');
            return;
        }
        
        const group = new THREE.Group();
        group.name = 'Gruppe';
        group.userData.id = THREE.MathUtils.generateUUID();
        
        // Calculate center position
        const center = new THREE.Vector3();
        let count = 0;
        
        this.selectedObjects.forEach(obj => {
            if (!obj.userData.isHTMLHelper) {
                center.add(obj.position);
                count++;
            }
        });
        
        if (count > 0) {
            center.divideScalar(count);
        }
        
        group.position.copy(center);
        
        // Add objects to group
        const objectsToGroup = Array.from(this.selectedObjects);
        objectsToGroup.forEach(obj => {
            if (!obj.userData.isHTMLHelper) {
                const worldPos = new THREE.Vector3();
                obj.getWorldPosition(worldPos);
                group.add(obj);
                obj.position.copy(worldPos).sub(center);
            }
        });
        
        this.scene.add(group);
        this.objects.set(group.userData.id, group);
        
        this.selectObject(group);
        this.updateObjectTree();
    }

    ungroupSelected() {
        const toUngroup = [];
        
        this.selectedObjects.forEach(obj => {
            if (obj.type === 'Group') {
                toUngroup.push(obj);
            }
        });
        
        if (toUngroup.length === 0) {
            alert('Keine Gruppe ausgewählt');
            return;
        }
        
        toUngroup.forEach(group => {
            const worldPos = new THREE.Vector3();
            const worldRot = new THREE.Euler();
            const worldScale = new THREE.Vector3();
            
            // Move children to scene
            while (group.children.length > 0) {
                const child = group.children[0];
                
                child.getWorldPosition(worldPos);
                child.getWorldQuaternion(new THREE.Quaternion()).setFromQuaternion;
                child.getWorldScale(worldScale);
                
                this.scene.add(child);
                
                child.position.copy(worldPos);
                child.scale.copy(worldScale);
            }
            
            // Remove group
            this.scene.remove(group);
            this.objects.delete(group.userData.id);
        });
        
        this.deselectAll();
        this.updateObjectTree();
    }

    // Transform Methods

    setTransformMode(mode) {
        this.transformControls.setMode(mode);
        
        // Update button states
        ['translate', 'rotate', 'scale'].forEach(m => {
            const btn = document.getElementById(`${m}-mode`);
            if (btn) {
                btn.classList.toggle('active', m === mode);
            }
        });
    }

    // Animation Methods

    addKeyframe() {
        if (this.selectedObjects.size === 0) return;
        
        this.selectedObjects.forEach(obj => {
            if (!this.keyframes.has(obj.userData.id)) {
                this.keyframes.set(obj.userData.id, []);
            }
            
            const frames = this.keyframes.get(obj.userData.id);
            
            // Remove existing keyframe at current time
            const existingIndex = frames.findIndex(f => 
                Math.abs(f.time - this.currentTime) < 0.01
            );
            
            if (existingIndex !== -1) {
                frames.splice(existingIndex, 1);
            }
            
            // Add new keyframe
            frames.push({
                time: this.currentTime,
                position: obj.position.clone(),
                rotation: obj.rotation.clone(),
                scale: obj.scale.clone()
            });
            
            // Sort by time
            frames.sort((a, b) => a.time - b.time);
        });
        
        this.updateTimeline();
    }

    updateTimeline() {
        const slider = document.getElementById('timeline-slider');
        
        // Clear existing keyframes
        slider.querySelectorAll('.timeline-keyframe').forEach(k => k.remove());
        
        // Add keyframe markers
        this.keyframes.forEach((frames, objectId) => {
            frames.forEach(frame => {
                const marker = document.createElement('div');
                marker.className = 'timeline-keyframe';
                marker.style.left = `${(frame.time / this.duration) * 100}%`;
                
                // Color based on selection
                const obj = this.objects.get(objectId);
                if (obj && this.selectedObjects.has(obj)) {
                    marker.style.backgroundColor = '#f2b848';
                }
                
                marker.title = `${frame.time.toFixed(1)}s`;
                
                marker.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.currentTime = frame.time;
                    this.updateAnimation();
                });
                
                slider.appendChild(marker);
            });
        });
    }

    updateAnimation() {
        // Update timeline UI
        const percent = (this.currentTime / this.duration) * 100;
        document.getElementById('timeline-playhead').style.left = `${percent}%`;
        document.getElementById('current-time').value = this.currentTime.toFixed(1);
        
        // Interpolate keyframes
        this.keyframes.forEach((frames, objectId) => {
            const obj = this.objects.get(objectId);
            if (!obj || frames.length === 0) return;
            
            // Find surrounding keyframes
            let before = null;
            let after = null;
            
            for (let i = 0; i < frames.length; i++) {
                if (frames[i].time <= this.currentTime) {
                    before = frames[i];
                }
                if (frames[i].time > this.currentTime && !after) {
                    after = frames[i];
                    break;
                }
            }
            
            if (before && after) {
                // Interpolate
                const t = (this.currentTime - before.time) / (after.time - before.time);
                
                obj.position.lerpVectors(before.position, after.position, t);
                obj.scale.lerpVectors(before.scale, after.scale, t);
                
                // Slerp rotation
                const q1 = new THREE.Quaternion().setFromEuler(before.rotation);
                const q2 = new THREE.Quaternion().setFromEuler(after.rotation);
                const q = new THREE.Quaternion().slerpQuaternions(q1, q2, t);
                obj.rotation.setFromQuaternion(q);
            } else if (before) {
                // Apply last keyframe
                obj.position.copy(before.position);
                obj.rotation.copy(before.rotation);
                obj.scale.copy(before.scale);
            }
            
            // Update CSS object if exists
            if (obj.userData.cssObject) {
                const cssObj = this.htmlElements.get(objectId);
                if (cssObj) {
                    cssObj.position.copy(obj.position);
                    cssObj.rotation.copy(obj.rotation);
                    cssObj.scale.copy(obj.scale);
                }
            }
        });
    }

    togglePlayback() {
        this.isPlaying = !this.isPlaying;
        const btn = document.getElementById('play-pause');
        const icon = btn.querySelector('.material-icons');
        if (icon) {
            icon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
        }
    }

    stopPlayback() {
        this.isPlaying = false;
        this.currentTime = 0;
        this.updateAnimation();
        
        const btn = document.getElementById('play-pause');
        const icon = btn.querySelector('.material-icons');
        if (icon) {
            icon.textContent = 'play_arrow';
        }
    }

    toggleAutoKey() {
        this.autoKey = !this.autoKey;
        const indicator = document.getElementById('auto-key-indicator');
        indicator.classList.toggle('inactive', !this.autoKey);
        
        const btn = document.getElementById('toggle-auto-key');
        btn.textContent = this.autoKey ? 'Auto Key ON' : 'Auto Key OFF';
    }

    seekTimeline(event) {
        const slider = event.currentTarget;
        const rect = slider.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        this.currentTime = percent * this.duration;
        this.updateAnimation();
    }

    // Material Methods

    openMaterialEditor() {
        if (this.selectedObjects.size === 0) return;
        
        const panel = document.getElementById('material-editor');
        panel.style.display = 'block';
        
        // Load material properties from first selected mesh
        const obj = Array.from(this.selectedObjects)[0];
        let material = null;
        
        obj.traverse((child) => {
            if (child.isMesh && child.material && !material) {
                material = child.material;
            }
        });
        
        if (material) {
            document.getElementById('material-color').value = 
                '#' + material.color.getHexString();
                
            if (material.metalness !== undefined) {
                document.getElementById('material-metalness').value = material.metalness;
            }
            if (material.roughness !== undefined) {
                document.getElementById('material-roughness').value = material.roughness;
            }
            if (material.emissive) {
                document.getElementById('material-emissive').value = 
                    '#' + (material.userData.originalEmissive || material.emissive).getHexString();
            }
            if (material.opacity !== undefined) {
                document.getElementById('material-opacity').value = material.opacity;
            }
        }
    }

    applyMaterial() {
        const color = document.getElementById('material-color').value;
        const metalness = parseFloat(document.getElementById('material-metalness').value);
        const roughness = parseFloat(document.getElementById('material-roughness').value);
        const emissive = document.getElementById('material-emissive').value;
        const opacity = parseFloat(document.getElementById('material-opacity').value);
        
        this.selectedObjects.forEach(obj => {
            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.color = new THREE.Color(color);
                    
                    if (child.material.metalness !== undefined) {
                        child.material.metalness = metalness;
                    }
                    if (child.material.roughness !== undefined) {
                        child.material.roughness = roughness;
                    }
                    if (child.material.emissive) {
                        child.material.userData.originalEmissive = new THREE.Color(emissive);
                        // Don't override selection highlight
                        if (!this.selectedObjects.has(child)) {
                            child.material.emissive = new THREE.Color(emissive);
                        }
                    }
                    
                    child.material.opacity = opacity;
                    child.material.transparent = opacity < 1;
                    child.material.needsUpdate = true;
                }
            });
        });
    }

    applyMaterialPreset(preset) {
        const presets = {
            metal: {
                metalness: 0.9,
                roughness: 0.1,
                color: '#888888'
            },
            plastic: {
                metalness: 0.0,
                roughness: 0.4,
                color: '#ff0000'
            },
            wood: {
                metalness: 0.0,
                roughness: 0.8,
                color: '#8b4513'
            }
        };
        
        const settings = presets[preset];
        if (!settings) return;
        
        this.selectedObjects.forEach(obj => {
            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    Object.assign(child.material, settings);
                    child.material.needsUpdate = true;
                }
            });
        });
    }

    createNewMaterial() {
        if (this.selectedObjects.size === 0) {
            alert('Bitte wählen Sie zuerst ein Objekt aus');
            return;
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.5,
            roughness: 0.5
        });
        
        this.selectedObjects.forEach(obj => {
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.material = material.clone();
                }
            });
        });
    }

    // Connector Methods

    addConnector() {
        if (this.selectedObjects.size !== 2) {
            alert('Bitte wählen Sie genau 2 Objekte aus, um sie zu verbinden.');
            return;
        }
        
        const objects = Array.from(this.selectedObjects);
        const connectorId = THREE.MathUtils.generateUUID();
        
        const connector = {
            id: connectorId,
            start: objects[0],
            end: objects[1],
            type: 'line',
            animated: false,
            color: '#5a9cf8'
        };
        
        this.connectors.set(connectorId, connector);
        this.updateConnectors();
    }

    updateConnectors() {
        const svg = document.getElementById('connector-svg');
        if (!svg) return;
        
        svg.innerHTML = '';
        
        this.connectors.forEach(connector => {
            if (!connector.start || !connector.end) return;
            
            const start = this.toScreenPosition(connector.start.position);
            const end = this.toScreenPosition(connector.end.position);
            
            // Create SVG path
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            // Calculate curve
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2 - 50; // Curve upward
            
            const d = `M ${start.x} ${start.y} Q ${midX} ${midY}, ${end.x} ${end.y}`;
            path.setAttribute('d', d);
            path.setAttribute('stroke', connector.color);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            
            if (connector.animated) {
                path.setAttribute('stroke-dasharray', '5,5');
                path.style.animation = 'dash 0.5s linear infinite';
            }
            
            svg.appendChild(path);
            
            // Add arrowhead
            const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const angle = Math.atan2(end.y - midY, end.x - midX);
            const arrowSize = 10;
            
            const points = [
                [end.x, end.y],
                [end.x - arrowSize * Math.cos(angle - Math.PI/6), end.y - arrowSize * Math.sin(angle - Math.PI/6)],
                [end.x - arrowSize * Math.cos(angle + Math.PI/6), end.y - arrowSize * Math.sin(angle + Math.PI/6)]
            ].map(p => p.join(',')).join(' ');
            
            arrowhead.setAttribute('points', points);
            arrowhead.setAttribute('fill', connector.color);
            
            svg.appendChild(arrowhead);
        });
    }

    // Tool Methods

    activateMeasureTool() {
        alert('Mess-Tool wird in zukünftigen Updates verfügbar sein');
        // TODO: Implement measurement tool
    }

    activateAnnotationTool() {
        alert('Anmerkungs-Tool wird in zukünftigen Updates verfügbar sein');
        // TODO: Implement annotation tool
    }

    // Export Methods

    exportScene() {
        const exporter = new GLTFExporter();
        
        // Prepare export scene
        const exportScene = new THREE.Scene();
        
        this.objects.forEach(obj => {
            if (!obj.userData.isHTMLHelper && !obj.userData.isGround) {
                exportScene.add(obj.clone());
            }
        });
        
        exporter.parse(
            exportScene,
            (gltf) => {
                const output = JSON.stringify(gltf, null, 2);
                const blob = new Blob([output], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = 'scene.gltf';
                a.click();
                
                URL.revokeObjectURL(url);
            },
            (error) => {
                console.error('Export error:', error);
                alert('Fehler beim Exportieren');
            },
            { binary: false }
        );
    }

    async exportAsViewer() {
        // Collect all mesh data
        const meshData = [];
        
        this.objects.forEach((obj, id) => {
            if (obj && !obj.userData.isGround && !obj.userData.isHTMLHelper) {
                const objData = {
                    id: id,
                    name: obj.name,
                    type: obj.type,
                    position: obj.position.toArray(),
                    rotation: obj.rotation.toArray(),
                    scale: obj.scale.toArray(),
                    visible: obj.visible
                };
                
                // Collect mesh information
                obj.traverse((child) => {
                    if (child.isMesh) {
                        const meshInfo = {
                            geometry: {
                                type: child.geometry.type,
                                parameters: child.geometry.parameters || {}
                            },
                            material: {
                                type: child.material.type,
                                color: child.material.color ? child.material.color.getHex() : 0xffffff,
                                metalness: child.material.metalness || 0,
                                roughness: child.material.roughness || 0.5,
                                opacity: child.material.opacity || 1,
                                transparent: child.material.transparent || false
                            }
                        };
                        
                        if (!objData.meshes) objData.meshes = [];
                        objData.meshes.push(meshInfo);
                    }
                });
                
                meshData.push(objData);
            }
        });
        
        // Generate viewer with mesh data
        const viewerHTML = this.generateEnhancedViewerHTML(meshData);
        
        const blob = new Blob([viewerHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'viewer.html';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    generateEnhancedViewerHTML(meshData) {
        const sceneData = {
            meshes: meshData,
            htmlElements: [],
            keyframes: {},
            connectors: [],
            duration: this.duration,
            camera: {
                position: this.camera.position.toArray(),
                fov: this.camera.fov
            },
            settings: {
                background: this.scene.background.getHex()
            }
        };
        
        // Collect HTML elements
        this.htmlElements.forEach((cssObj, id) => {
            if (cssObj && cssObj.element) {
                sceneData.htmlElements.push({
                    id: id,
                    html: cssObj.element.innerHTML,
                    position: cssObj.position.toArray(),
                    rotation: cssObj.rotation.toArray(),
                    scale: cssObj.scale.toArray(),
                    name: cssObj.name
                });
            }
        });
        
        // Collect keyframes
        this.keyframes.forEach((frames, id) => {
            sceneData.keyframes[id] = frames.map(frame => ({
                time: frame.time,
                position: frame.position.toArray(),
                rotation: frame.rotation.toArray(),
                scale: frame.scale.toArray()
            }));
        });
        
        // Collect connectors
        this.connectors.forEach(connector => {
            sceneData.connectors.push({
                id: connector.id,
                startId: connector.start.userData.id,
                endId: connector.end.userData.id,
                type: connector.type,
                animated: connector.animated,
                color: connector.color
            });
        });
        
        return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>3D Arbeitsanweisung - Viewer</title>
    <style>
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            background: #1a1d21;
        }
        
        #container {
            width: 100vw;
            height: 100vh;
            position: relative;
        }
        
        #controls {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(42, 45, 49, 0.95);
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            display: flex;
            gap: 12px;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        
        button {
            padding: 6px 16px;
            background: #5a9cf8;
            border: none;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        }
        
        button:hover {
            background: #4a8ce8;
        }
        
        button:disabled {
            background: #666;
            cursor: not-allowed;
        }
        
        .html3d-element {
            background: rgba(42, 45, 49, 0.95);
            padding: 16px;
            border-radius: 8px;
            border: 2px solid #5a9cf8;
            color: #e0e0e0;
            pointer-events: auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        
        .html3d-element h3,
        .html3d-element h4 {
            color: #f2b848;
            margin: 0 0 8px 0;
        }
        
        .html3d-element p {
            margin: 4px 0;
        }
        
        #css-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        #connector-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        .timeline {
            position: absolute;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 600px;
            height: 6px;
            background: rgba(0,0,0,0.5);
            border-radius: 3px;
            cursor: pointer;
        }
        
        .timeline-progress {
            height: 100%;
            background: #5a9cf8;
            border-radius: 3px;
            width: 0%;
            transition: width 0.1s;
        }
        
        #info {
            position: absolute;
            top: 20px;
            left: 20px;
            color: white;
            background: rgba(42, 45, 49, 0.9);
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
        }
        
        @keyframes dash {
            to {
                stroke-dashoffset: -10;
            }
        }
    </style>
</head>
<body>
    <div id="container">
        <canvas id="three-canvas"></canvas>
        <div id="css-container"></div>
        <svg id="connector-svg"></svg>
    </div>
    
    <div id="info">
        <strong>3D Arbeitsanweisung</strong><br>
        Steuerung: Linke Maustaste - Drehen, Rechte Maustaste - Verschieben, Mausrad - Zoom
    </div>
    
    <div class="timeline" id="timeline">
        <div class="timeline-progress" id="timeline-progress"></div>
    </div>
    
    <div id="controls">
        <button id="prev-btn">⏮ Zurück</button>
        <button id="play-btn">▶ Play</button>
        <button id="next-btn">Vor ⏭</button>
        <span id="time" style="min-width: 100px; text-align: center;">0.0s / ${this.duration}s</span>
        <button id="fullscreen-btn">⛶ Vollbild</button>
    </div>
    
    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }
    }
    </script>
    
    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
        
        const sceneData = ${JSON.stringify(sceneData, null, 2)};
        
        class Viewer {
            constructor() {
                this.objects = new Map();
                this.htmlElements = new Map();
                this.currentTime = 0;
                this.isPlaying = false;
                this.duration = sceneData.duration || 10;
                
                this.init();
                this.animate();
            }
            
            init() {
                // Scene
                this.scene = new THREE.Scene();
                this.scene.background = new THREE.Color(sceneData.settings.background || 0x1a1d21);
                
                this.cssScene = new THREE.Scene();
                
                // Camera
                this.camera = new THREE.PerspectiveCamera(
                    sceneData.camera.fov,
                    window.innerWidth / window.innerHeight,
                    0.1, 1000
                );
                this.camera.position.fromArray(sceneData.camera.position);
                
                // Renderer
                const canvas = document.getElementById('three-canvas');
                this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                
                // CSS Renderer
                this.cssRenderer = new CSS3DRenderer();
                this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
                this.cssRenderer.domElement.style.position = 'absolute';
                this.cssRenderer.domElement.style.top = '0';
                document.getElementById('css-container').appendChild(this.cssRenderer.domElement);
                
                // Controls
                this.controls = new OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.05;
                
                // Lights
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                this.scene.add(ambientLight);
                
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(5, 10, 5);
                directionalLight.castShadow = true;
                this.scene.add(directionalLight);
                
                // Grid
                const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
                this.scene.add(gridHelper);
                
                // Load scene
                this.loadScene();
                
                // Setup controls
                this.setupControls();
            }
            
            loadScene() {
                // Load meshes
                sceneData.meshes.forEach(objData => {
                    if (objData.type === 'Group') {
                        const group = new THREE.Group();
                        group.name = objData.name;
                        group.position.fromArray(objData.position);
                        group.rotation.fromArray(objData.rotation);
                        group.scale.fromArray(objData.scale);
                        this.scene.add(group);
                        this.objects.set(objData.id, group);
                    } else if (objData.meshes && objData.meshes.length > 0) {
                        // Create object from mesh data
                        const meshInfo = objData.meshes[0];
                        let geometry;
                        
                        // Recreate geometry
                        switch(meshInfo.geometry.type) {
                            case 'BoxGeometry':
                                const params = meshInfo.geometry.parameters;
                                geometry = new THREE.BoxGeometry(
                                    params.width || 1,
                                    params.height || 1,
                                    params.depth || 1
                                );
                                break;
                            case 'SphereGeometry':
                                const sParams = meshInfo.geometry.parameters;
                                geometry = new THREE.SphereGeometry(
                                    sParams.radius || 0.5,
                                    sParams.widthSegments || 32,
                                    sParams.heightSegments || 16
                                );
                                break;
                            case 'CylinderGeometry':
                                const cParams = meshInfo.geometry.parameters;
                                geometry = new THREE.CylinderGeometry(
                                    cParams.radiusTop || 0.5,
                                    cParams.radiusBottom || 0.5,
                                    cParams.height || 1,
                                    cParams.radialSegments || 32
                                );
                                break;
                            case 'ConeGeometry':
                                const coParams = meshInfo.geometry.parameters;
                                geometry = new THREE.ConeGeometry(
                                    coParams.radius || 0.5,
                                    coParams.height || 1,
                                    coParams.radialSegments || 32
                                );
                                break;
                            case 'TorusGeometry':
                                const tParams = meshInfo.geometry.parameters;
                                geometry = new THREE.TorusGeometry(
                                    tParams.radius || 0.5,
                                    tParams.tube || 0.2,
                                    tParams.radialSegments || 16,
                                    tParams.tubularSegments || 100
                                );
                                break;
                            case 'PlaneGeometry':
                                const pParams = meshInfo.geometry.parameters;
                                geometry = new THREE.PlaneGeometry(
                                    pParams.width || 2,
                                    pParams.height || 2
                                );
                                break;
                            default:
                                geometry = new THREE.BoxGeometry(1, 1, 1);
                        }
                        
                        const material = new THREE.MeshStandardMaterial({
                            color: meshInfo.material.color,
                            metalness: meshInfo.material.metalness,
                            roughness: meshInfo.material.roughness,
                            opacity: meshInfo.material.opacity,
                            transparent: meshInfo.material.transparent
                        });
                        
                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.name = objData.name;
                        mesh.position.fromArray(objData.position);
                        mesh.rotation.fromArray(objData.rotation);
                        mesh.scale.fromArray(objData.scale);
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        mesh.visible = objData.visible !== false;
                        
                        this.scene.add(mesh);
                        this.objects.set(objData.id, mesh);
                    }
                });
                
                // Load HTML elements
                sceneData.htmlElements.forEach(elData => {
                    const element = document.createElement('div');
                    element.className = 'html3d-element';
                    element.innerHTML = elData.html;
                    
                    const cssObject = new CSS3DObject(element);
                    cssObject.position.fromArray(elData.position);
                    cssObject.rotation.fromArray(elData.rotation);
                    cssObject.scale.fromArray(elData.scale);
                    cssObject.name = elData.name;
                    
                    this.cssScene.add(cssObject);
                    this.htmlElements.set(elData.id, cssObject);
                    this.objects.set(elData.id, cssObject);
                });
                
                // Setup connectors
                this.connectors = sceneData.connectors || [];
            }
            
            setupControls() {
                // Play/Pause
                document.getElementById('play-btn').addEventListener('click', () => {
                    this.isPlaying = !this.isPlaying;
                    document.getElementById('play-btn').textContent = this.isPlaying ? '⏸ Pause' : '▶ Play';
                });
                
                // Previous step
                document.getElementById('prev-btn').addEventListener('click', () => {
                    const times = new Set();
                    Object.values(sceneData.keyframes).forEach(frames => {
                        frames.forEach(frame => times.add(frame.time));
                    });
                    
                    const sortedTimes = Array.from(times).sort((a, b) => a - b);
                    const currentIndex = sortedTimes.findIndex(t => t >= this.currentTime);
                    
                    if (currentIndex > 0) {
                        this.currentTime = sortedTimes[currentIndex - 1];
                    } else {
                        this.currentTime = 0;
                    }
                    
                    this.updateAnimation();
                });
                
                // Next step
                document.getElementById('next-btn').addEventListener('click', () => {
                    const times = new Set();
                    Object.values(sceneData.keyframes).forEach(frames => {
                        frames.forEach(frame => times.add(frame.time));
                    });
                    
                    const sortedTimes = Array.from(times).sort((a, b) => a - b);
                    const nextTime = sortedTimes.find(t => t > this.currentTime);
                    
                    if (nextTime !== undefined) {
                        this.currentTime = nextTime;
                    } else {
                        this.currentTime = this.duration;
                    }
                    
                    this.updateAnimation();
                });
                
                // Timeline click
                document.getElementById('timeline').addEventListener('click', (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    this.currentTime = percent * this.duration;
                    this.updateAnimation();
                });
                
                // Fullscreen
                document.getElementById('fullscreen-btn').addEventListener('click', () => {
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else {
                        document.documentElement.requestFullscreen();
                    }
                });
                
                // Resize
                window.addEventListener('resize', () => {
                    this.camera.aspect = window.innerWidth / window.innerHeight;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(window.innerWidth, window.innerHeight);
                    this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
                });
                
                // Keyboard controls
                window.addEventListener('keydown', (e) => {
                    switch(e.key) {
                        case ' ':
                            e.preventDefault();
                            document.getElementById('play-btn').click();
                            break;
                        case 'ArrowLeft':
                            document.getElementById('prev-btn').click();
                            break;
                        case 'ArrowRight':
                            document.getElementById('next-btn').click();
                            break;
                    }
                });
            }
            
            updateAnimation() {
                // Update time display
                document.getElementById('time').textContent = 
                    this.currentTime.toFixed(1) + 's / ' + this.duration + 's';
                
                // Update timeline progress
                const percent = (this.currentTime / this.duration) * 100;
                document.getElementById('timeline-progress').style.width = percent + '%';
                
                // Animate objects
                Object.entries(sceneData.keyframes).forEach(([id, frames]) => {
                    const obj = this.objects.get(id);
                    if (!obj || frames.length === 0) return;
                    
                    // Find surrounding keyframes
                    let before = null;
                    let after = null;
                    
                    for (let i = 0; i < frames.length; i++) {
                        if (frames[i].time <= this.currentTime) {
                            before = frames[i];
                        }
                        if (frames[i].time > this.currentTime && !after) {
                            after = frames[i];
                            break;
                        }
                    }
                    
                    if (before && after) {
                        const t = (this.currentTime - before.time) / (after.time - before.time);
                        
                        // Interpolate position
                        const p1 = new THREE.Vector3().fromArray(before.position);
                        const p2 = new THREE.Vector3().fromArray(after.position);
                        obj.position.lerpVectors(p1, p2, t);
                        
                        // Interpolate scale
                        const s1 = new THREE.Vector3().fromArray(before.scale);
                        const s2 = new THREE.Vector3().fromArray(after.scale);
                        obj.scale.lerpVectors(s1, s2, t);
                        
                        // Interpolate rotation
                        const e1 = new THREE.Euler().fromArray(before.rotation);
                        const e2 = new THREE.Euler().fromArray(after.rotation);
                        const q1 = new THREE.Quaternion().setFromEuler(e1);
                        const q2 = new THREE.Quaternion().setFromEuler(e2);
                        const q = new THREE.Quaternion().slerpQuaternions(q1, q2, t);
                        obj.rotation.setFromQuaternion(q);
                    } else if (before) {
                        obj.position.fromArray(before.position);
                        obj.rotation.fromArray(before.rotation);
                        obj.scale.fromArray(before.scale);
                    }
                });
                
                // Update connectors
                this.updateConnectors();
            }
            
            updateConnectors() {
                const svg = document.getElementById('connector-svg');
                svg.innerHTML = '';
                
                this.connectors.forEach(connector => {
                    const startObj = this.objects.get(connector.startId);
                    const endObj = this.objects.get(connector.endId);
                    
                    if (!startObj || !endObj) return;
                    
                    const start = this.toScreenPosition(startObj.position);
                    const end = this.toScreenPosition(endObj.position);
                    
                    // Create path
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2 - 50;
                    
                    const d = \`M \${start.x} \${start.y} Q \${midX} \${midY}, \${end.x} \${end.y}\`;
                    path.setAttribute('d', d);
                    path.setAttribute('stroke', connector.color);
                    path.setAttribute('stroke-width', '2');
                    path.setAttribute('fill', 'none');
                    
                    if (connector.animated) {
                        path.setAttribute('stroke-dasharray', '5,5');
                        path.style.animation = 'dash 0.5s linear infinite';
                    }
                    
                    svg.appendChild(path);
                });
            }
            
            toScreenPosition(position) {
                const vector = position.clone();
                vector.project(this.camera);
                
                const widthHalf = window.innerWidth / 2;
                const heightHalf = window.innerHeight / 2;
                
                return {
                    x: (vector.x * widthHalf) + widthHalf,
                    y: -(vector.y * heightHalf) + heightHalf
                };
            }
            
            animate() {
                requestAnimationFrame(() => this.animate());
                
                // Update animation
                if (this.isPlaying) {
                    this.currentTime += 0.016; // 60fps
                    if (this.currentTime > this.duration) {
                        this.currentTime = 0;
                    }
                    this.updateAnimation();
                }
                
                // Update HTML elements to face camera
                this.htmlElements.forEach(cssObj => {
                    cssObj.lookAt(this.camera.position);
                    cssObj.rotation.x = 0;
                    cssObj.rotation.z = 0;
                });
                
                // Update controls
                this.controls.update();
                
                // Render
                this.renderer.render(this.scene, this.camera);
                this.cssRenderer.render(this.cssScene, this.camera);
            }
        }
        
        // Start viewer
        new Viewer();
    </script>
</body>
</html>
        `;
    }

    // Template Methods

    saveCustomTemplate() {
        const name = document.getElementById('template-name').value;
        const html = document.getElementById('template-html').value;
        
        if (!name || !html) {
            alert('Bitte Name und HTML eingeben');
            return;
        }
        
        const template = {
            id: 'custom-' + Date.now(),
            name: name,
            icon: 'code',
            content: html,
            custom: true
        };
        
        this.customTemplates.push(template);
        
        // Save to localStorage
        try {
            localStorage.setItem('customTemplates', JSON.stringify(this.customTemplates));
        } catch (e) {
            console.error('Error saving templates:', e);
        }
        
        // Add to menu
        this.addTemplateToMenu(template);
        
        // Close panel
        document.getElementById('template-creator').style.display = 'none';
        
        // Clear form
        document.getElementById('template-name').value = '';
        document.getElementById('template-html').value = '';
        document.getElementById('template-preview').innerHTML = '';
    }

    loadCustomTemplates() {
        try {
            const saved = localStorage.getItem('customTemplates');
            if (saved) {
                this.customTemplates = JSON.parse(saved);
                this.customTemplates.forEach(template => {
                    this.addTemplateToMenu(template);
                });
            }
        } catch (e) {
            console.error('Error loading templates:', e);
        }
    }

    addTemplateToMenu(template) {
        const menu = document.getElementById('html-menu');
        const divider = menu.querySelector('.dropdown-divider');
        
        const item = document.createElement('button');
        item.className = 'dropdown-item';
        item.innerHTML = `
            <span class="material-icons">${template.icon}</span>
            ${template.name}
            ${template.custom ? '<span style="margin-left: auto; opacity: 0.6;">(Custom)</span>' : ''}
        `;
        
        item.addEventListener('click', () => {
            this.addHTMLElement(template);
            this.closeAllMenus();
        });
        
        if (divider) {
            menu.insertBefore(item, divider);
        } else {
            menu.appendChild(item);
        }
    }

    // View Methods

    focusOnSelected() {
        if (this.selectedObjects.size === 0) return;
        
        // Calculate bounding box of selection
        const box = new THREE.Box3();
        this.selectedObjects.forEach(obj => {
            if (!obj.userData.isHTMLHelper) {
                box.expandByObject(obj);
            }
        });
        
        if (box.isEmpty()) return;
        
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        // Animate camera
        const startPos = this.camera.position.clone();
        const startTarget = this.orbitControls.target.clone();
        
        const endPos = center.clone();
        endPos.z += distance;
        endPos.y += distance * 0.5;
        
        const duration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = t * t * (3.0 - 2.0 * t); // smoothstep
            
            this.camera.position.lerpVectors(startPos, endPos, eased);
            this.orbitControls.target.lerpVectors(startTarget, center, eased);
            this.orbitControls.update();
            
            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    resetCamera() {
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);
        this.orbitControls.target.set(0, 0, 0);
        this.orbitControls.update();
    }

    toggleWireframe() {
        this.objects.forEach(obj => {
            obj.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.wireframe = !child.material.wireframe;
                }
            });
        });
    }

    // UI Update Methods

    updateObjectTree() {
        const tree = document.getElementById('object-tree');
        tree.innerHTML = '';
        
        // Build tree structure
        const buildTreeItem = (object, level = 0) => {
            if (object.userData.isGround || 
                object === this.transformControls ||
                object === this.gridHelper ||
                object.type === 'DirectionalLight' ||
                object.type === 'AmbientLight') {
                return null;
            }
            
            const item = document.createElement('li');
            item.className = 'object-tree-item';
            
            const row = document.createElement('div');
            row.className = 'object-tree-row';
            row.style.paddingLeft = `${level * 20}px`;
            
            if (this.selectedObjects.has(object)) {
                row.classList.add('selected');
            }
            
            // Icon
            const icon = document.createElement('span');
            icon.className = 'material-icons object-tree-icon';
            icon.style.fontSize = '18px';
            icon.textContent = 
                object.userData.isHTMLHelper ? 'text_fields' :
                object.type === 'Group' ? 'folder' :
                object.type === 'PointLight' ? 'lightbulb' :
                object.type === 'PerspectiveCamera' ? 'videocam' :
                object.type === 'Mesh' ? 'view_in_ar' :
                'category';
            row.appendChild(icon);
            
            // Name
            const name = document.createElement('span');
            name.textContent = object.name || 'Unnamed';
            name.style.marginLeft = '8px';
            row.appendChild(name);
            
            row.addEventListener('click', (e) => {
                const multi = e.ctrlKey || e.metaKey;
                this.selectObject(object, multi);
            });
            
            item.appendChild(row);
            
            // Children
            if (object.children && object.children.length > 0) {
                const childList = document.createElement('ul');
                childList.className = 'object-tree-children';
                childList.style.listStyle = 'none';
                childList.style.paddingLeft = '0';
                
                object.children.forEach(child => {
                    const childItem = buildTreeItem(child, level + 1);
                    if (childItem) {
                        childList.appendChild(childItem);
                    }
                });
                
                if (childList.children.length > 0) {
                    item.appendChild(childList);
                }
            }
            
            return item;
        };
        
        // Add all root objects
        this.objects.forEach(obj => {
            if (obj.parent === this.scene) {
                const item = buildTreeItem(obj);
                if (item) {
                    tree.appendChild(item);
                }
            }
        });
    }

    updatePropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        panel.innerHTML = '';
        
        if (this.selectedObjects.size === 0) {
            panel.innerHTML = '<p style="opacity: 0.6; text-align: center;">Keine Auswahl</p>';
            return;
        }
        
        if (this.selectedObjects.size > 1) {
            panel.innerHTML = `<p style="opacity: 0.6; text-align: center;">${this.selectedObjects.size} Objekte ausgewählt</p>`;
            return;
        }
        
        const obj = Array.from(this.selectedObjects)[0];
        
        // Name
        const nameSection = document.createElement('div');
        nameSection.style.marginBottom = '12px';
        nameSection.innerHTML = `
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Name</label>
            <input type="text" value="${obj.name || ''}" id="prop-name" style="width: 100%;">
        `;
        panel.appendChild(nameSection);
        
        document.getElementById('prop-name').addEventListener('change', (e) => {
            obj.name = e.target.value;
            
            // Update HTML element name
            if (obj.userData.cssObject) {
                const cssObj = this.htmlElements.get(obj.userData.id);
                if (cssObj) {
                    cssObj.name = e.target.value;
                }
            }
            
            this.updateObjectTree();
        });
        
        // Transform properties
        const transformProps = ['position', 'rotation', 'scale'];
        const axes = ['x', 'y', 'z'];
        
        transformProps.forEach(prop => {
            const section = document.createElement('div');
            section.style.marginTop = '16px';
            
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.fontSize = '12px';
            label.style.color = '#888';
            label.style.marginBottom = '4px';
            label.textContent = prop.charAt(0).toUpperCase() + prop.slice(1);
            section.appendChild(label);
            
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '4px';
            
            axes.forEach(axis => {
                const input = document.createElement('input');
                input.type = 'number';
                input.step = prop === 'rotation' ? '1' : '0.01';
                input.value = prop === 'rotation' ? 
                    THREE.MathUtils.radToDeg(obj[prop][axis]).toFixed(1) :
                    obj[prop][axis].toFixed(2);
                input.style.flex = '1';
                input.style.width = '0';
                
                input.addEventListener('change', (e) => {
                    const value = parseFloat(e.target.value);
                    obj[prop][axis] = prop === 'rotation' ? 
                        THREE.MathUtils.degToRad(value) : value;
                    
                    // Update CSS object
                    if (obj.userData.cssObject) {
                        const cssObj = this.htmlElements.get(obj.userData.id);
                        if (cssObj) {
                            cssObj[prop][axis] = obj[prop][axis];
                        }
                    }
                    
                    if (this.autoKey) {
                        this.addKeyframe();
                    }
                });
                
                row.appendChild(input);
            });
            
            section.appendChild(row);
            panel.appendChild(section);
        });
        
        // Visibility
        const visSection = document.createElement('div');
        visSection.style.marginTop = '16px';
        visSection.innerHTML = `
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" ${obj.visible ? 'checked' : ''} id="prop-visible">
                <span style="font-size: 12px; color: #888;">Sichtbar</span>
            </label>
        `;
        panel.appendChild(visSection);
        
        document.getElementById('prop-visible').addEventListener('change', (e) => {
            obj.visible = e.target.checked;
            
            if (obj.userData.cssObject) {
                const cssObj = this.htmlElements.get(obj.userData.id);
                if (cssObj) {
                    cssObj.visible = e.target.checked;
                }
            }
        });
    }

    // Event Handlers

    onPointerDown(event) {
        // Prevent interaction if transform controls are active
        if (this.transformControls.dragging) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.pointer, this.camera);
        
        // Collect all selectable objects
        const selectableObjects = [];
        this.objects.forEach(obj => {
            if (obj && !obj.userData.isGround) {
                selectableObjects.push(obj);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(selectableObjects, true);
        
        if (intersects.length > 0) {
            let hitObject = intersects[0].object;
            
            // Find the managed object
            while (hitObject && !this.objects.has(hitObject.userData.id)) {
                if (hitObject.userData.id && this.objects.has(hitObject.userData.id)) {
                    break;
                }
                hitObject = hitObject.parent;
            }
            
            // Check if it's a managed object
            let targetObject = null;
            this.objects.forEach((obj, id) => {
                if (obj === hitObject || (hitObject && obj.userData.id === hitObject.userData.id)) {
                    targetObject = obj;
                }
            });
            
            if (targetObject) {
                const multi = event.ctrlKey || event.metaKey;
                this.selectObject(targetObject, multi);
            } else {
                this.deselectAll();
            }
        } else {
            // Click on empty space
            if (!event.ctrlKey && !event.metaKey) {
                this.deselectAll();
            }
        }
    }

    onPointerMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onRightClick(event) {
        event.preventDefault();
        
        // Perform raycast to see if clicking on object
        this.onPointerDown(event);
        
        // Show context menu
        const menu = document.getElementById('context-menu');
        menu.style.display = 'block';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        
        // Update menu items based on selection
        const hasSelection = this.selectedObjects.size > 0;
        const hasMultiple = this.selectedObjects.size > 1;
        const hasGroup = Array.from(this.selectedObjects).some(obj => obj.type === 'Group');
        
        document.getElementById('context-duplicate').style.display = hasSelection ? '' : 'none';
        document.getElementById('context-delete').style.display = hasSelection ? '' : 'none';
        document.getElementById('context-group').style.display = hasMultiple ? '' : 'none';
        document.getElementById('context-ungroup').style.display = hasGroup ? '' : 'none';
        document.getElementById('context-material').style.display = hasSelection ? '' : 'none';
        document.getElementById('context-focus').style.display = hasSelection ? '' : 'none';
        
        // Hide on next click
        const hideMenu = () => {
            menu.style.display = 'none';
            document.removeEventListener('click', hideMenu);
        };
        
        setTimeout(() => {
            document.addEventListener('click', hideMenu);
        }, 0);
    }

    hideContextMenu() {
        document.getElementById('context-menu').style.display = 'none';
    }

    onKeyDown(event) {
        // Ignore hotkeys when in input field
        if (isInputFocused()) return;
        
        switch(event.key.toLowerCase()) {
            case 'w':
                if (!event.ctrlKey) {
                    event.preventDefault();
                    this.setTransformMode('translate');
                }
                break;
            case 'e':
                if (!event.ctrlKey) {
                    event.preventDefault();
                    this.setTransformMode('rotate');
                }
                break;
            case 'r':
                if (!event.ctrlKey) {
                    event.preventDefault();
                    this.setTransformMode('scale');
                }
                break;
            case 'delete':
                event.preventDefault();
                this.deleteSelected();
                break;
            case 'd':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.duplicateSelected();
                }
                break;
            case 'g':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.groupSelected();
                }
                break;
            case 'u':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.ungroupSelected();
                }
                break;
            case 'z':
                if (event.ctrlKey && !event.shiftKey) {
                    event.preventDefault();
                    this.undo();
                } else if (event.ctrlKey && event.shiftKey) {
                    event.preventDefault();
                    this.redo();
                }
                break;
            case 'y':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.redo();
                }
                break;
            case 'f':
                if (!event.ctrlKey) {
                    event.preventDefault();
                    this.focusOnSelected();
                }
                break;
            case 'k':
                event.preventDefault();
                this.addKeyframe();
                break;
            case ' ':
                event.preventDefault();
                this.togglePlayback();
                break;
            case 'escape':
                event.preventDefault();
                this.deselectAll();
                break;
        }
    }

    onWindowResize() {
        const container = document.querySelector('.scene-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        this.cssRenderer.setSize(width, height);
    }

    // Panel Management

    openPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        
        panel.style.display = 'block';
        
        // Make draggable
        const header = panel.querySelector('.panel-header');
        if (!header) return;
        
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        const onMouseDown = (e) => {
            if (e.target.classList.contains('panel-close')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = panel.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            panel.style.left = (initialX + dx) + 'px';
            panel.style.top = (initialY + dy) + 'px';
            panel.style.transform = 'none';
        };
        
        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        header.addEventListener('mousedown', onMouseDown);
    }

    closeAllMenus() {
        document.querySelectorAll('.navbar-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    // History Management

    addToHistory(action) {
        // Remove future history
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(action);
        this.historyIndex++;
        
        // Limit history
        if (this.history.length > 100) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex < 0) return;
        
        const action = this.history[this.historyIndex];
        
        // TODO: Implement undo for different action types
        
        this.historyIndex--;
    }

    redo() {
        if (this.historyIndex >= this.history.length - 1) return;
        
        this.historyIndex++;
        const action = this.history[this.historyIndex];
        
        // TODO: Implement redo for different action types
    }

    // Utility Methods

    toScreenPosition(position) {
        const vector = position.clone();
        vector.project(this.camera);
        
        const container = document.querySelector('.scene-container');
        if (!container) return { x: 0, y: 0 };
        
        const widthHalf = container.clientWidth / 2;
        const heightHalf = container.clientHeight / 2;
        
        return {
            x: (vector.x * widthHalf) + widthHalf,
            y: -(vector.y * heightHalf) + heightHalf
        };
    }

    // Animation Loop

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update animation
        if (this.isPlaying) {
            const deltaTime = this.clock.getDelta();
            this.currentTime += deltaTime;
            
            if (this.currentTime > this.duration) {
                this.currentTime = 0;
            }
            
            this.updateAnimation();
        }
        
        // Update controls
        if (this.orbitControls) {
            this.orbitControls.update();
        }
        
        // Update HTML elements to face camera
        this.htmlElements.forEach(cssObj => {
            if (cssObj && cssObj.element) {
                // Billboard effect
                const cameraPos = this.camera.position.clone();
                cssObj.lookAt(cameraPos);
                cssObj.rotation.x = 0;
                cssObj.rotation.z = 0;
            }
        });
        
        // Update connectors
        this.updateConnectors();
        
        // Render scenes
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
        
        if (this.cssRenderer && this.cssScene && this.camera) {
            this.cssRenderer.render(this.cssScene, this.camera);
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new WorkInstructionEditor();
    window.app = app; // For debugging
});
