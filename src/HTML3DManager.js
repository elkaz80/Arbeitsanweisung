import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// HTML Templates (könnten auch von außen kommen)
const HTML_TEMPLATES = [ { id: 'template-text', name: 'Einfacher Text', html: `<div class="html-content text-content"><p contenteditable="true">Dies ist ein einfacher bearbeitbarer Textblock.</p></div>`, defaultWidth: 300, defaultHeight: 100 }, /* ... mehr ... */ ];
let htmlElementCounter = 0;


class HTML3DManager {
    constructor(container, camera) { // Benötigt Container und Kamera
        this.container = container;
        this.camera = camera;
        this.cssScene = null;
        this.cssRenderer = null;
        this.selectionManager = null; // Wird später gesetzt
        this.htmlElements = []; // Liste der erstellten Elemente
    }

    setSelectionManager(manager) {
        this.selectionManager = manager;
    }

    init() {
        console.log("[HTML3DManager] Initializing...");
        this.cssScene = new THREE.Scene();
        this.cssRenderer = new CSS3DRenderer();
        this.cssRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.cssRenderer.domElement.style.position = 'absolute';
        this.cssRenderer.domElement.style.top = '0';
        this.cssRenderer.domElement.style.pointerEvents = 'none'; // Wichtig!
        this.cssRenderer.domElement.classList.add('css3d-overlay');
        this.container.appendChild(this.cssRenderer.domElement);
        console.log("[HTML3DManager] CSS3DRenderer initialized and appended.");
    }

    resize(width, height) {
        if (this.cssRenderer) {
            this.cssRenderer.setSize(width, height);
        }
    }

    render(scene, camera) { // Nimmt Szene entgegen (obwohl cssScene intern verwendet wird)
        if (this.cssRenderer && this.cssScene && camera) {
            this.cssRenderer.render(this.cssScene, camera);
        }
    }

    // Logik zum Erstellen von Elementen (aus altem Code übernommen)
     createHTMLElement(htmlContent, width = 300, height = 150, initialPosition = null, initialRotation = null) {
        htmlElementCounter++;
        const element = document.createElement('div');
        element.className = 'html-3d-element';
        element.innerHTML = htmlContent;
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;

        const cssObject = new CSS3DObject(element);
        cssObject.name = `HTMLElement_${htmlElementCounter}`;
        cssObject.userData.isHTML = true;
        element.dataset.uuid = cssObject.uuid;

        element.addEventListener('pointerdown', (event) => {
             // Verhindere Auswahl, wenn durch Gizmo deaktiviert
             if (element.classList.contains('gizmo-active')) return;

             // Prüfe Randklick etc.
             const rect = element.getBoundingClientRect();
             const edgeThreshold = 20;
             const x = event.clientX - rect.left; const y = event.clientY - rect.top;
             const isEdgeClick = x < edgeThreshold || y < edgeThreshold || x > rect.width - edgeThreshold || y > rect.height - edgeThreshold;

             if (isEdgeClick) {
                 console.log(`[HTML3DManager] Edge click on ${cssObject.name}`);
                 event.preventDefault(); event.stopPropagation();
                 this.selectionManager?.select(cssObject); // Auswahl über SelectionManager
             } else {
                 console.log(`[HTML3DManager] Inner click on ${cssObject.name}`);
                 // Hier keine Aktion nötig, Standard-Event-Flow für contenteditable etc.
             }
        });

        const scaleFactor = 0.01;
        cssObject.scale.set(scaleFactor, scaleFactor, scaleFactor);

        if (!initialPosition) { const dist = 3; const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir); cssObject.position.copy(this.camera.position).add(dir.multiplyScalar(dist)); }
        else cssObject.position.copy(initialPosition);
        if (!initialRotation) cssObject.rotation.copy(this.camera.rotation);
        else cssObject.rotation.copy(initialRotation);

        this.cssScene.add(cssObject);
        this.htmlElements.push(cssObject); // Zur internen Liste hinzufügen
        console.log(`[HTML3DManager] Created ${cssObject.name}`);
        // TODO: UI (Object List) updaten?
        return cssObject;
    }

    addHTMLElement(templateId) {
        const template = HTML_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            const newHtmlObject = this.createHTMLElement(template.html, template.defaultWidth, template.defaultHeight);
            this.selectionManager?.select(newHtmlObject); // Direkt auswählen
        } else console.error(`HTML Template ${templateId} not found.`);
    }

     // Methode, um Interaktivität für ein HTML-Element umzuschalten
     setElementInteractivity(object, isInteractive) {
         if (object?.userData?.isHTML && object.element) {
             object.element.style.pointerEvents = isInteractive ? 'auto' : 'none';
             if (isInteractive) {
                 object.element.classList.remove('gizmo-active');
             } else {
                 object.element.classList.add('gizmo-active');
             }
         }
     }

    getCSSScene() { return this.cssScene; }
}

export default HTML3DManager;