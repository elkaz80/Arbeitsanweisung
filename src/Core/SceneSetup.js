// src/Core/SceneSetup.js

import * as THREE from 'three';

/**
 * Erstellt die Standardbeleuchtung (Ambient + Directional) und fügt sie zur Szene hinzu.
 * @param {THREE.Scene} scene Die Szene, zu der die Lichter hinzugefügt werden sollen.
 * @returns {{ambientLight: THREE.AmbientLight, directionalLight: THREE.DirectionalLight}} Referenzen auf die erstellten Lichter.
 */
function createLights(scene) {
    // Umgebungslicht für allgemeine Helligkeit
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Intensität kann angepasst werden
    ambientLight.name = 'AmbientLight'; // Wichtig für spätere Referenzierung (z.B. im UI)
    scene.add(ambientLight);

    // Gerichtetes Licht für Schatten und Highlights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Intensität kann angepasst werden
    directionalLight.position.set(8, 15, 10); // Position der Lichtquelle anpassen
    directionalLight.castShadow = true; // Licht wirft Schatten

    // Schattenqualität konfigurieren (optional)
    directionalLight.shadow.mapSize.width = 2048; // Höhere Auflösung für schärfere Schatten
    directionalLight.shadow.mapSize.height = 2048;
    // Bereich der Schattenkamera anpassen (wichtig für Performance und Qualität)
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    directionalLight.name = 'DirectionalLight'; // Wichtig für spätere Referenzierung
    scene.add(directionalLight);

    // Helper für das gerichtete Licht (nützlich zum Debuggen der Lichtposition/Richtung)
    const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
    directionalLightHelper.name = 'DirectionalLightHelper'; // Namen vergeben
    // scene.add(directionalLightHelper); // Nach Bedarf einkommentieren

    console.log("[SceneSetup] Lights (Ambient, Directional) created and added.");
    // Gib Referenzen zurück, damit AppManager sie speichern kann (optional)
    return { ambientLight, directionalLight };
}

/**
 * Erstellt den Boden (Plane) und fügt ihn zur Szene hinzu.
 * @param {THREE.Scene} scene Die Szene, zu der der Boden hinzugefügt werden soll.
 * @returns {THREE.Mesh} Referenz auf das erstellte Boden-Mesh.
 */
function createFloor(scene) {
    const floorGeometry = new THREE.PlaneGeometry(50, 50); // Größe anpassen
    // Das initiale Material. Der Name sollte einem Schlüssel in
    // availableFloorMaterials (in SettingsPanel.js) entsprechen,
    // damit das UI-Dropdown korrekt initialisiert wird.
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,          // Farbe anpassen
        metalness: 0.1,
        roughness: 0.8,
        side: THREE.DoubleSide,   // Doppelseitig rendern? Meist nicht nötig für Boden.
        name: 'Standard Grau'     // Wichtig für UI Abgleich
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Boden flach auf XZ-Ebene legen
    floor.position.y = 0;          // Höhe des Bodens (oder -0.01)
    floor.receiveShadow = true;      // Boden empfängt Schatten
    floor.name = "Floor";            // Wichtig für Selektion/Zugriff
    scene.add(floor);
    console.log("[SceneSetup] Floor created and added.");
    return floor; // Gib Referenz zurück
}

/**
 * Erstellt Hilfsobjekte (Grid, Axes) und fügt sie zur Szene hinzu.
 * Kann bei Bedarf komplett auskommentiert oder entfernt werden.
 * @param {THREE.Scene} scene Die Szene, zu der die Helper hinzugefügt werden sollen.
 */
function createHelpers(scene) {
    // --- GridHelper ---
    // Kommentiere diesen Block aus, wenn du kein Gitter mehr willst.
    /*
    const size = 50;
    const divisions = 50;
    const gridHelper = new THREE.GridHelper(size, divisions, 0x888888, 0x444444);
    gridHelper.position.y = -0.01; // Leicht unter dem Boden
    gridHelper.name = "GridHelper";
    scene.add(gridHelper);
    console.log("[SceneSetup] GridHelper created and added.");
    */
    // --- Ende GridHelper ---

    // --- AxesHelper ---
    // Kommentiere diesen Block aus, wenn du keine Koordinatenachsen mehr willst.
    /*
    const axesHelper = new THREE.AxesHelper(5); // Länge der Achsen (X=rot, Y=grün, Z=blau)
    axesHelper.name = "AxesHelper";
    axesHelper.position.y = 0.01; // Leicht über dem Boden
    scene.add(axesHelper);
    console.log("[SceneSetup] AxesHelper created and added.");
    */
    // --- Ende AxesHelper ---

    // Nur loggen, wenn tatsächlich Helper erstellt wurden (Beispiel)
    // if (scene.getObjectByName("GridHelper") || scene.getObjectByName("AxesHelper")) {
    //     console.log("[SceneSetup] Helpers created and added.");
    // }
}

// Exportiere die Funktionen, damit main.js sie importieren und nutzen kann
export { createLights, createFloor, createHelpers };