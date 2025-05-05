// src/UI/SettingsPanel.js

import * as THREE from 'three';
import { TextureLoader } from 'three'; // Für Beispielmaterial

// --- Definitionen der Optionen können hier gekapselt werden ---
const availableFloorMaterials = {
    'Standard Grau': new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide, name: 'Standard Grau' }),
    'Poliert Reflektierend': new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.95, roughness: 0.05, side: THREE.DoubleSide, name: 'Poliert Reflektierend' }),
    'Holz (Textur)': new THREE.MeshStandardMaterial({ map: new TextureLoader().load('textures/wood_floor.jpg', (t)=>{t.wrapS=t.wrapT=1000;t.repeat.set(4,4);t.needsUpdate=true;}), side: THREE.DoubleSide, name: 'Holz (Textur)'}),
    'Simpel Rot': new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, name: 'Simpel Rot' }),
};
const availableEnvironments = {
    'Keine': null,
    'Studio (HDR)': 'envmaps/studio_env.hdr',
    'Outdoor (HDR)': 'envmaps/outdoor_env.hdr',
    //'Skybox (Standard)': ['...', '...', ...]
};

class SettingsPanel {
    /**
     * Erstellt und verwaltet das Einstellungs-Panel.
     * @param {object} appManager - Die Instanz des AppManagers.
     * @param {HTMLElement} parentElement - Das DOM-Element (Submenü-Div), in das die Controls eingefügt werden sollen.
     */
    constructor(appManager, parentElement) {
        if (!appManager || !parentElement) {
            throw new Error("SettingsPanel requires AppManager and parentElement!");
        }
        this.appManager = appManager;
        this.parentElement = parentElement;

        // Referenzen auf UI-Elemente speichern (optional)
        this.floorSelect = null;
        this.envSelect = null;
        this.lightToggle = null;
        this.fovSlider = null;
        this.fovValueSpan = null;

        this.init(); // Baut die UI auf
    }

    /**
     * Initialisiert das Panel, leert den Container und erstellt die Controls.
     */
    init() {
        this.parentElement.innerHTML = '<h4>Einstellungen</h4>'; // Container leeren, Titel setzen
        this.createFloorMaterialControl();
        this.createEnvironmentControl();
        this.createLightControl();
        this.createCameraControl();
        console.log("[SettingsPanel] Initialized and populated.");
    }

    // --- Methoden zum Erstellen der einzelnen Controls ---

    createFloorMaterialControl() {
        const container = this.createControlContainer(); // Hilfsfunktion für Container

        const label = document.createElement('label');
        label.htmlFor = 'floor-material-select'; label.textContent = 'Boden: ';
        container.appendChild(label);

        this.floorSelect = document.createElement('select'); // Im Objekt speichern
        this.floorSelect.name = 'floor-material'; this.floorSelect.id = 'floor-material-select';

        for (const name in availableFloorMaterials) {
            const option = document.createElement('option'); option.value = name; option.textContent = name; this.floorSelect.appendChild(option);
        }

        // Initialwert setzen
        const floor = this.appManager.getFloorObject();
        if (floor && floor.material?.name && availableFloorMaterials[floor.material.name]) {
            this.floorSelect.value = floor.material.name;
        } else {
            this.floorSelect.value = Object.keys(availableFloorMaterials)[0] || '';
        }

        // Event Listener
        this.floorSelect.addEventListener('change', (event) => {
            const selectedMaterialName = event.target.value;
            const newMaterial = availableFloorMaterials[selectedMaterialName];
            if (newMaterial && typeof this.appManager.setFloorMaterial === 'function') {
                this.appManager.setFloorMaterial(newMaterial); // Ruft Methode in AppManager auf
                 if (selectedMaterialName === 'Poliert Reflektierend' && !this.appManager.scene?.environment) {
                     console.warn("Reflective material needs scene.environment!"); /* Alert etc. */
                 }
            } else { console.error("Cannot set floor material - AppManager missing or material invalid."); }
        });

        container.appendChild(this.floorSelect);
        this.parentElement.appendChild(container);
    }

    createEnvironmentControl() {
        const container = this.createControlContainer();
        const label = document.createElement('label'); label.htmlFor = 'environment-select'; label.textContent = 'Umgebung: '; container.appendChild(label);
        this.envSelect = document.createElement('select'); this.envSelect.name = 'environment'; this.envSelect.id = 'environment-select';

        for (const name in availableEnvironments) {
            const option = document.createElement('option'); option.value = name; option.textContent = name; this.envSelect.appendChild(option);
        }
        // TODO: Initialwert setzen (aus AppManager.scene.environment ableiten?)
        this.envSelect.value = 'Keine';

        this.envSelect.addEventListener('change', (event) => {
            const selectedEnvName = event.target.value;
            const envPathOrArray = availableEnvironments[selectedEnvName];
            if (typeof this.appManager.setEnvironment === 'function') {
                this.appManager.setEnvironment(envPathOrArray);
            } else { console.error("AppManager.setEnvironment method not available."); }
        });
        container.appendChild(this.envSelect);
        this.parentElement.appendChild(container);
    }

    createLightControl() {
        const container = this.createControlContainer();
        const label = document.createElement('label'); label.htmlFor = 'light-toggle-main'; label.textContent = 'Hauptlicht: '; container.appendChild(label);
        this.lightToggle = document.createElement('input'); this.lightToggle.type = 'checkbox'; this.lightToggle.id = 'light-toggle-main';
        // Initialen Status holen (Annahme: Licht existiert und hat Namen)
        this.lightToggle.checked = this.appManager.scene?.getObjectByName('DirectionalLight')?.visible ?? true;

        this.lightToggle.addEventListener('change', (event) => {
            const isEnabled = event.target.checked;
            if (typeof this.appManager.toggleLight === 'function') {
                this.appManager.toggleLight('DirectionalLight', isEnabled);
            } else { console.error("AppManager.toggleLight method not available."); }
        });
        container.appendChild(this.lightToggle);
        this.parentElement.appendChild(container);
    }

    createCameraControl() {
        const container = this.createControlContainer();
        const initialFov = this.appManager.getCameraFov(); // Getter nutzen

        const label = document.createElement('label'); label.htmlFor = 'camera-fov-slider';
        // Span für den Wert direkt erstellen
        this.fovValueSpan = document.createElement('span'); this.fovValueSpan.id = 'fov-value'; this.fovValueSpan.textContent = initialFov.toFixed(0);
        label.textContent = 'Sichtfeld (FOV): '; label.appendChild(this.fovValueSpan); label.append('°'); // Text und Einheit hinzufügen
        container.appendChild(label);
        container.appendChild(document.createElement('br'));

        this.fovSlider = document.createElement('input'); this.fovSlider.type = 'range'; this.fovSlider.id = 'camera-fov-slider';
        this.fovSlider.min = "30"; this.fovSlider.max = "120"; this.fovSlider.value = initialFov;
        this.fovSlider.style.width = "90%";

        this.fovSlider.addEventListener('input', (event) => {
             const fov = parseFloat(event.target.value);
             if (this.fovValueSpan) this.fovValueSpan.textContent = fov.toFixed(0); // Anzeige aktualisieren
              if (typeof this.appManager.setCameraFov === 'function') {
                 this.appManager.setCameraFov(fov);
              } else { console.error("AppManager.setCameraFov method not available."); }
        });
        container.appendChild(this.fovSlider);
        this.parentElement.appendChild(container);
    }

    /**
     * Hilfsfunktion zum Erstellen eines Standard-Containers für Controls.
     */
    createControlContainer() {
        const div = document.createElement('div');
        div.style.marginBottom = '10px'; // Etwas Abstand
        return div;
    }

} // Ende class SettingsPanel

export default SettingsPanel;