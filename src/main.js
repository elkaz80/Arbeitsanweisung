// src/main.js (KORRIGIERT v14 - Fix Init Order for SelectionManager)

import './style.css';
import * as THREE from 'three';
import AppManager from './AppManager';
import UIManager from './UIManager';
import ControlsManager from './ControlsManager';
import SelectionManager from './SelectionManager';
import LoaderService from './LoaderService';
import HTML3DManager from './HTML3DManager';
import AnimationManager from './AnimationManager';

console.log("--- Main Script Start v14 (Fix SelectionManager Init Order) ---");

const appContainer = document.getElementById('scene-container');
const canvas = document.getElementById('three-canvas');

if (!appContainer || !canvas) {
    throw new Error("Essential DOM elements (#scene-container, #three-canvas) not found!");
}

try {
    // 1. Kern App Manager initialisieren (erstellt Renderer, Scene, Camera)
    const appManager = new AppManager(canvas, appContainer);
    appManager.init();

    // 2. Manager Instanzen erstellen (Reihenfolge angepasst!)
    const controlsManager = new ControlsManager(appManager.getCamera(), appManager.getRenderer().domElement);
    const html3DManager = new HTML3DManager(appContainer, appManager.getCamera());
    const animationManager = new AnimationManager();
    const uiManager = new UIManager(); // Enthält jetzt die korrigierten Listener
    const loaderService = new LoaderService(appManager);

    // 3. Manager initialisieren, die KEINE anderen Manager brauchen ODER
    //    deren Eigenschaften VORHER gebraucht werden
    controlsManager.init(appManager.getScene());
    html3DManager.init(); // WICHTIG: Erstellt cssScene

    // 4. SelectionManager erstellen (jetzt sollten cssScene etc. existieren)
    const selectionManager = new SelectionManager(
        appManager.getCamera(),
        appManager.getScene(),
        html3DManager.getCSSScene(),    // Jetzt sollte cssScene existieren
        appManager.getRenderer().domElement,
        controlsManager,
        uiManager,
        html3DManager
    );
    selectionManager.init(); // Selection Manager Listener hinzufügen
    controlsManager.setSelectionManager(selectionManager);
    // 5. Manager-Referenzen setzen (damit sich alle kennen)
    appManager.setManagers(uiManager, selectionManager, controlsManager, html3DManager, animationManager);
    uiManager.setManagers(appManager, selectionManager, loaderService, controlsManager, animationManager, html3DManager);
    html3DManager.setSelectionManager(selectionManager);

    // 6. UI initialisieren (holt DOM Refs, setzt Listener korrekt)
    uiManager.init(); // Diese init() ruft die populateXMenu Methoden auf

    // 7. Update Callback für Animate-Loop setzen
    appManager.setUpdateCallback((deltaTime, time) => {
        controlsManager.update(deltaTime);
        if (animationManager) {
            animationManager.update(controlsManager.isDraggingGizmo);
            // Die Überprüfung hier ist gut, um Fehler zu vermeiden, falls UI Manager noch nicht bereit ist
            if (uiManager && typeof uiManager.updateTimelineIndicator === 'function') {
                 uiManager.updateTimelineIndicator(animationManager.getCurrentTime());
            } else if (!uiManager?.loggedTimelineUpdateError) {
                 console.warn("UIManager or updateTimelineIndicator not ready in callback.");
                 // uiManager.loggedTimelineUpdateError = true; // Ggf. Flag nutzen, um nur einmal zu warnen
            }
        }
    });

    // 8. Initiales UI Setup
    // Stellen sicher, dass die Szene bereit ist, bevor die Liste aktualisiert wird
    if (appManager.getScene()) {
         uiManager.updateObjectList(appManager.getScene());
    } else {
        console.error("[Main.js] Scene not ready for initial object list update!");
    }


    // 9. Animation Loop starten
    appManager.start();

    // *** DER TEMPORÄRE TEST-CODE WURDE HIER ENTFERNT ***

    console.log("--- Application Initialized Successfully v14 ---");

} catch (error) {
    console.error("Initialization failed:", error);
    const container = document.getElementById('scene-container') || document.body;
    container.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;"><h2>Initialization Error</h2><p>Could not start application. Check console.</p><pre>${error.stack || error}</pre></div>`;
}