// src/Managers/HTML3DManager.js

import * as THREE from 'three';
// Wichtig: CSS3DRenderer und CSS3DObject importieren!
// Stelle sicher, dass der Pfad zu den three examples korrekt ist
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

class HTML3DManager {
    /**
     * Verwaltet die CSS3D-Szene und den zugehörigen Renderer.
     * @param {HTMLElement} container - Das Haupt-Container-Element der Anwendung.
     * @param {THREE.Camera} camera - Die Hauptkamera der 3D-Szene.
     */
    constructor(container, camera) {
        if (!container || !camera) {
            throw new Error("HTML3DManager requires container and camera!");
        }
        this.container = container;
        this.camera = camera; // Referenz auf die Hauptkamera

        this.cssScene = null;      // Die separate Szene für CSS3DObjecte
        this.cssRenderer = null;   // Der spezielle Renderer für CSS3D
        this.selectionManager = null; // Optionale Referenz
        this.htmlElements = new Map(); // Optional: Map zum Speichern von { threeObjectUUID: css3DObject }
    }

    /**
     * Optional: Setzt eine Referenz auf den SelectionManager, falls benötigt.
     */
    setSelectionManager(selectionManager) {
        this.selectionManager = selectionManager;
    }

    /**
     * Initialisiert die CSS3D-Szene und den Renderer.
     */
    init() {
        console.log("[HTML3DManager] Initializing...");
        try {
            // 1. CSS3D-Szene erstellen
            this.cssScene = new THREE.Scene();

            // 2. CSS3DRenderer erstellen
            this.cssRenderer = new CSS3DRenderer();

            // 3. Renderer konfigurieren und zum DOM hinzufügen
            this.resize(this.container.clientWidth, this.container.clientHeight); // Initialgröße setzen
            this.cssRenderer.domElement.style.position = 'absolute'; // Über den WebGL-Canvas legen
            this.cssRenderer.domElement.style.top = '0';
            this.cssRenderer.domElement.style.zIndex = '0'; // Unter der Haupt-UI, über WebGL
            this.cssRenderer.domElement.style.pointerEvents = 'none'; // Wichtig: Fängt standardmäßig keine Events ab

            this.container.appendChild(this.cssRenderer.domElement); // Zum Hauptcontainer hinzufügen

            console.log("[HTML3DManager] CSS3DRenderer initialized and appended.");
        } catch (error) {
            console.error("[HTML3DManager] Initialization failed:", error);
        }
    }

    /**
     * Passt die Größe des CSS3DRenderers an. Wird bei Fenstergrößenänderung aufgerufen.
     */
    resize(width, height) {
        if (this.cssRenderer) {
             this.cssRenderer.setSize(width, height);
             // console.log(`[HTML3DManager] Resized CSS renderer to ${width}x${height}`);
        }
    }

    /**
     * Rendert die CSS3D-Szene. Wird im Haupt-Renderloop aufgerufen.
     * @param {THREE.Scene} _scene - WebGL-Szene (hier nicht direkt verwendet).
     * @param {THREE.Camera} camera - Die Hauptkamera.
     */
    render(_scene, camera) {
         // Verwende die übergebene Kamera (oder die gespeicherte Referenz)
         const cam = camera || this.camera;
         if (this.cssRenderer && this.cssScene && cam) {
            this.cssRenderer.render(this.cssScene, cam);
         }
    }

    /**
     * Gibt die CSS3D-Szene zurück.
     * @returns {THREE.Scene | null}
     */
    getCSSScene() {
        return this.cssScene;
    }

    /**
     * Setzt die Maus-Interaktivität für das HTML-Element, das zu einem 3D-Objekt gehört.
     * @param {THREE.Object3D} obj3D - Das 3D-Objekt.
     * @param {boolean} enabled - True, um Interaktion zu erlauben ('auto'), False zum Deaktivieren ('none').
     */
    setElementInteractivity(obj3D, enabled) {
        if (!obj3D || !this.htmlElements) return; // htmlElements Map wird benötigt

        const cssObject = this.htmlElements.get(obj3D.uuid);
        if (cssObject && cssObject.element) {
             cssObject.element.style.pointerEvents = enabled ? 'auto' : 'none';
             // console.log(`[HTML3DManager] Interactivity for element of ${obj3D.name || obj3D.uuid} set to ${enabled}`);
        }
    }


    /**
     * Erstellt ein HTML-Element aus einem Template und fügt es zur CSS3D-Szene hinzu.
     * Wird von UI/HtmlPanel.js aufgerufen.
     * @param {object} template - Das Template-Objekt aus HTML_TEMPLATES.
     * @param {THREE.Vector3} [position=null] - Die gewünschte Weltposition, wenn nicht an Parent gehängt.
     * @param {THREE.Object3D} [parentObject=null] - Optional: Ein 3D-Objekt, an das das HTML-Element angehängt wird.
     * @returns {CSS3DObject | null} Das erstellte CSS3DObject oder null bei Fehler.
     */
    addElementFromTemplate(template, position = null, parentObject = null) {
        if (!template || !this.cssScene) {
            console.error("[HTML3DManager] Template or CSS Scene missing for addElementFromTemplate.");
            return null;
        }
        console.log(`[HTML3DManager] Adding element from template: ${template.name}`);

        try {
            // 1. HTML-Element erstellen
            const element = document.createElement('div');
            // CSS-Klassen für globales und spezifisches Styling
            element.className = `html-element template-${template.id}`;
            // Style für Größe (optional, kann auch über CSS erfolgen)
            if (template.defaultSize) {
                if (template.defaultSize.width) element.style.width = typeof template.defaultSize.width === 'number' ? `${template.defaultSize.width}px` : template.defaultSize.width;
                if (template.defaultSize.height) element.style.height = typeof template.defaultSize.height === 'number' ? `${template.defaultSize.height}px` : template.defaultSize.height;
            }
            // Standardmäßig Interaktivität erlauben? Oder nur bei Bedarf?
            element.style.pointerEvents = 'auto'; // Erlaube Klicks auf dieses Element

            // Inhalt aus Template setzen
            element.innerHTML = template.content;

            // Platzhalter ersetzen (z.B. für Bilder/Videos src aus data-src)
            element.querySelectorAll('[data-src]').forEach(el => {
                const src = el.getAttribute('data-src');
                if (src && (el.tagName === 'IMG' || el.tagName === 'IFRAME' || el.tagName === 'VIDEO' || el.tagName === 'AUDIO')) {
                    el.src = src;
                }
            });

            // 2. CSS3DObject erstellen
            const cssObject = new CSS3DObject(element);
            // Eindeutigen Namen vergeben (optional aber nützlich)
            cssObject.name = `HTML_${template.name.replace(/\s+/g, '_')}_${THREE.MathUtils.generateUUID().substring(0, 4)}`;

            // 3. Positionieren und Hinzufügen
            if (parentObject && parentObject.isObject3D) {
                // An ein 3D-Objekt anhängen
                console.log(`[HTML3DManager] Attaching element '${cssObject.name}' to object: ${parentObject.name || parentObject.uuid}`);
                parentObject.add(cssObject);
                // Lokale Position relativ zum Parent setzen (z.B. leicht davor/drüber)
                cssObject.position.set(0, 0.5, 0.5); // Beispiel Offset - anpassen!
                cssObject.scale.set(0.01, 0.01, 0.01); // Beispiel: Skalierung anpassen! CSS Pixel != World Units
                cssObject.rotation.copy(parentObject.rotation); // Gleiche Rotation wie Parent? Oder zur Kamera?
            } else {
                // An die CSS-Szene direkt anhängen
                this.cssScene.add(cssObject);
                // Welt-Position setzen
                if (position instanceof THREE.Vector3) {
                    cssObject.position.copy(position);
                } else {
                    // Fallback-Position, falls keine übergeben wurde
                    const fallbackPos = this.camera.position.clone().add(new THREE.Vector3(0, 0, -3).applyQuaternion(this.camera.quaternion));
                    cssObject.position.copy(fallbackPos);
                }
                 // Standard-Skalierung (CSS Pixel != World Units - muss angepasst werden!)
                 cssObject.scale.set(0.01, 0.01, 0.01); // Beispiel: 100 CSS Pixel = 1 World Unit
                 // Rotation zur Kamera ausrichten (Billboard)
                 cssObject.rotation.copy(this.camera.rotation);

                console.log(`[HTML3DManager] Added element '${cssObject.name}' to CSS scene at world position:`, cssObject.position);
            }

            // Referenz speichern, falls wir Interaktivität pro Objekt steuern wollen
            // Hier gehen wir davon aus, dass das CSSObject logisch zum parentObject gehört, falls vorhanden
            const mappingKey = parentObject ? parentObject.uuid : cssObject.uuid;
            this.htmlElements.set(mappingKey, cssObject);

            return cssObject; // Gib das erstellte Objekt zurück

        } catch (error) {
            console.error(`[HTML3DManager] Failed to add element from template '${template.name}':`, error);
            return null;
        }
    }

    /**
     * Entfernt ein HTML-Element (CSS3DObject) aus der Szene.
     * @param {CSS3DObject | string} objectOrUUID - Das Objekt oder seine UUID.
     */
    removeElement(objectOrUUID) {
        let cssObject = null;
        if (objectOrUUID instanceof CSS3DObject) {
            cssObject = objectOrUUID;
        } else if (typeof objectOrUUID === 'string') {
            cssObject = this.cssScene?.getObjectByProperty('uuid', objectOrUUID);
            // Oder suche in this.htmlElements Map?
            // this.htmlElements.forEach((val, key) => { if(val.uuid === objectOrUUID) cssObject = val; });
        }

        if (cssObject && cssObject.isCSS3DObject) {
            cssObject.removeFromParent(); // Aus Szene oder von Parent entfernen
            // Referenz aus Map entfernen (optional)
            let keyToRemove = null;
            this.htmlElements.forEach((val, key) => { if(val === cssObject) keyToRemove = key; });
            if(keyToRemove) this.htmlElements.delete(keyToRemove);

            // DOM Element entfernen? Optional, passiert evtl. automatisch
             if (cssObject.element && cssObject.element.parentNode) {
                 // cssObject.element.parentNode.removeChild(cssObject.element); // Vorsicht!
             }
            console.log(`[HTML3DManager] Removed element: ${cssObject.name || cssObject.uuid}`);
        } else {
            console.warn("[HTML3DManager] Element to remove not found:", objectOrUUID);
        }
    }


} // Ende class HTML3DManager

export default HTML3DManager;