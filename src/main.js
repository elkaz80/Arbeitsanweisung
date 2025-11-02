// src/main.js (Refaktorierte Version nach Auslagerung)

import '/style.css'; // Globale Styles importieren

// Kern-Module importieren
import AppManager from './Core/AppManager.js';
import { createLights, createFloor, createHelpers } from './Core/SceneSetup.js';

// Manager importieren
import ControlsManager from './Managers/ControlsManager.js';
import SelectionManager from './Managers/SelectionManager.js';
import HTML3DManager from './Managers/HTML3DManager.js';
import AnimationManager from './Managers/AnimationManager.js';
import ConnectorManager from './Managers/ConnectorManager.js';
// ARVRManager etc. hier importieren, wenn vorhanden

// Services importieren
import LoaderService from './Services/LoaderService.js';
// DetectionService etc. hier importieren, wenn vorhanden

// UI Haupt-Manager importieren (Panels werden intern von UIManager geladen)
import UIManager from './UI/UIManager.js';

// Versions-Log oder Startmeldung
console.log("--- Main Script Start v15+ (Refactored Structure) ---");

// DOM-Elemente holen
const appContainer = document.getElementById('scene-container');
const canvas = document.getElementById('three-canvas');

if (!appContainer || !canvas) {
    throw new Error("Essential DOM elements (#scene-container, #three-canvas) not found!");
}

try {
    // --- 1. Kern-App initialisieren ---
    const appManager = new AppManager(canvas, appContainer);
    appManager.init(); // Erstellt Renderer, Scene, Camera, Pivot
    // Wichtige Referenzen holen
    const scene = appManager.getScene();
    const camera = appManager.getCamera();
    const renderer = appManager.getRenderer();
    const controlsManager = new ControlsManager(camera, renderer, scene); // Renderer-Objekt und Szene übergeben!

    const initialRendererSize = { width: appContainer.clientWidth, height: appContainer.clientHeight }; // Größe für ConnectorManager

    // --- 2. Initiale Szene aufbauen ---
    console.log("[Main] Setting up initial scene content...");
    const lights = createLights(scene);
    const floor = createFloor(scene);
    createHelpers(scene); // Optional, kann auskommentiert werden in SceneSetup.js
    // Referenzen an AppManager übergeben (optional, wenn er sie braucht)
    appManager.setInitialSceneObjects(lights, floor);

    // --- 3. Manager und Services instanziieren ---
    // Reihenfolge beachten, falls Abhängigkeiten im Konstruktor bestehen (besser über Setter/init)
    console.log("[Main] Instantiating managers and services...");
    const html3DManager = new HTML3DManager(appContainer, camera); // Braucht Container, Kamera
    const animationManager = new AnimationManager();                // Braucht erstmal nichts
    //const controlsManager = new ControlsManager(camera, renderer, scene); // <--- Fehler! 'controlsManager' gibt es schon.
    const loaderService = new LoaderService(appManager);            // Braucht AppManager
    const connectorManager = new ConnectorManager(scene, camera, initialRendererSize); // Braucht Szene, Kamera, Größe
    const uiManager = new UIManager();                              // Braucht erstmal nichts
    const selectionManager = new SelectionManager(                // Braucht viele Referenzen
        camera,
        scene,
        html3DManager.getCSSScene(), // CSSScene von HTML3DManager holen
        renderer.domElement,
        controlsManager,
        uiManager,
        html3DManager
    );

    // --- 4. Manager initialisieren (die 'init'-Methoden haben) ---
    console.log("[Main] Initializing managers...");
    html3DManager.init();       // Erstellt CSS Scene & Renderer
    connectorManager.init();    // Erstellt default Material etc.
    controlsManager.init(scene); // Fügt TransformControls zur Szene hinzu
    selectionManager.init();    // Fügt Event Listener hinzu

    // --- 5. Abhängigkeiten / Referenzen setzen ---
    // WICHTIG: Sicherstellen, dass alle Manager die Referenzen bekommen, die sie brauchen
    console.log("[Main] Setting manager references...");
    controlsManager.setSelectionManager(selectionManager);
    html3DManager.setSelectionManager(selectionManager); // Falls benötigt
    // Übergibt ALLE potenziell benötigten Manager an AppManager und UIManager
    appManager.setManagers(uiManager, selectionManager, controlsManager, html3DManager, animationManager, connectorManager);
    uiManager.setManagers(appManager, selectionManager, loaderService, controlsManager, animationManager, html3DManager, connectorManager);
    // AnimationManager braucht UIManager für Timeline-Updates
    animationManager.setUIManager(uiManager);


    // --- 6. UI initialisieren ---
    // UIManager.init() erstellt jetzt intern die spezifischen Panels (Settings, File, Tools, HTML, ObjectGraph)
    console.log("[Main] Initializing UI...");
    uiManager.init();

    // --- 7. Update-Loop Callback definieren ---
    console.log("[Main] Setting update callback...");
    appManager.setUpdateCallback((deltaTime, time) => {
        // Manager updaten, die pro Frame Arbeit leisten müssen
        controlsManager.update(deltaTime); // OrbitControls Damping
        animationManager?.update(controlsManager.isDraggingGizmo, deltaTime); // Zeit fortschreiben
        connectorManager?.update(); // Linienpositionen aktualisieren

        // UI updaten (Beispiel Timeline)
        uiManager?.updateTimelineIndicator(animationManager?.getCurrentTime());
    });

    // --- 8. Globaler Resize Listener (aktualisiert auch ConnectorManager) ---
    // Hinweis: AppManager.handleResize aktualisiert Renderer, Kamera, HTML3DManager UND ConnectorManager
    window.addEventListener('resize', () => appManager.handleResize());


    // --- 9. Render-Loop starten ---
    console.log("[Main] Starting application loop...");
    appManager.start();

    console.log(`--- Application Initialized Successfully (v15+ Refactored) ---`);

} catch (error) {
    // Verbesserte Fehleranzeige
    console.error("Application Initialization Failed:", error);
    appContainer.innerHTML = `<div style="padding: 20px; color: #ff8a8a; background-color: #2a2a2a; border: 1px solid #ff5555; font-family: sans-serif;">
                              <h2>Initialization Error</h2>
                              <p>Could not start application. Check console for details.</p>
                              <pre style="white-space: pre-wrap; word-wrap: break-word;">${error.stack || error}</pre>
                              </div>`;
}