import './style.css';
import * as THREE from 'three';
import AppManager from './AppManager';
import UIManager from './UIManager';
import ControlsManager from './ControlsManager';
import SelectionManager from './SelectionManager';
import LoaderService from './LoaderService';
import HTML3DManager from './HTML3DManager';
import AnimationManager from './AnimationManager';

console.log("--- Main Script Start v11 (Fix UIManager Init) ---");

const appContainer = document.getElementById('scene-container');
const canvas = document.getElementById('three-canvas');

if (!appContainer || !canvas) {
    throw new Error("Essential DOM elements (#scene-container, #three-canvas) not found!");
}

try {
    // 1. Kern initialisieren
    const appManager = new AppManager(canvas, appContainer);
    appManager.init();

    // 2. Manager initialisieren (Reihenfolge kann wichtig sein)
    const controlsManager = new ControlsManager(appManager.getCamera(), appManager.getRenderer().domElement);
    controlsManager.init(appManager.getScene());

    const html3DManager = new HTML3DManager(appContainer, appManager.getCamera());
    html3DManager.init();

    const animationManager = new AnimationManager(); // Erstellen

    const uiManager = new UIManager(); // Erstellen (Konstruktor holt DOM Refs)

    const selectionManager = new SelectionManager(
        appManager.getCamera(),
        appManager.getScene(),
        html3DManager.getCSSScene(),
        appManager.getRenderer().domElement, // Canvas für 3D Klicks
        controlsManager,
        uiManager,
        html3DManager
    );
    selectionManager.init();

    const loaderService = new LoaderService(appManager);

    // 3. Manager-Referenzen setzen (NACHDEM alle Instanzen erstellt wurden)
    appManager.setManagers(uiManager, selectionManager, controlsManager, html3DManager, animationManager);
    uiManager.setManagers(appManager, selectionManager, loaderService, controlsManager, animationManager); // UIManager bekommt alle
    html3DManager.setSelectionManager(selectionManager); // Wichtig für Klicks auf HTML-Elemente

    // 4. Update Callback für Animate-Loop setzen
    appManager.setUpdateCallback((deltaTime, time) => {
        controlsManager.update(deltaTime);
        animationManager.update(controlsManager.isDraggingGizmo); // Nur Info über Gizmo übergeben
        // UI updaten, NACHDEM AnimationManager seine Zeit aktualisiert hat
        uiManager.updateTimelineIndicator(animationManager.getCurrentTime());
    });

    // 5. Initiales UI Setup starten (NACH setManagers, damit Referenzen verfügbar sind)
    uiManager.init();
    uiManager.updateObjectList(appManager.getScene()); // Initialen Baum/Liste zeichnen

    // 6. Animation Loop starten
    appManager.start();

    console.log("--- Application Initialized Successfully ---");

} catch (error) {
    console.error("Initialization failed:", error);
    const container = document.getElementById('scene-container') || document.body;
    container.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;"><h2>Initialization Error</h2><p>Could not start application. Check console.</p><pre>${error.stack || error}</pre></div>`;
}