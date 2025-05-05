// src/Managers/ConnectorManager.js

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

class ConnectorManager {
    /**
     * Verwaltet Linien, die 3D-Objekte und CSS3D-Objekte verbinden.
     * @param {THREE.Scene} scene - Die Haupt-WebGL-Szene.
     * @param {THREE.Camera} camera - Die Hauptkamera.
     * @param {object} rendererSize - Objekt mit {width, height} des Renderers (für LineMaterial).
     */
    constructor(scene, camera, rendererSize) {
        if (!scene || !camera || !rendererSize) {
            throw new Error("ConnectorManager requires scene, camera, and rendererSize!");
        }
        this.scene = scene;
        this.camera = camera; // Vorerst nicht direkt genutzt, aber oft nützlich
        this.rendererSize = rendererSize; // { width, height } für LineMaterial Auflösung

        this.connectors = []; // Array für { id, objA, objB, lineMesh, lineMaterial, lineGeometry }
        this.defaultLineMaterial = null; // Wird in init erstellt

        this.tempVecA = new THREE.Vector3(); // Hilfsvektoren
        this.tempVecB = new THREE.Vector3();

        this.init();
    }

    init() {
        // Standardmaterial für die Linien erstellen
        this.defaultLineMaterial = new LineMaterial({
            color: 0xffffff, // Weiß
            linewidth: 2, // Dicke in Pixeln (muss mit Screen-Größe skaliert werden)
            vertexColors: false,
            dashed: false,
            alphaToCoverage: true, // Verbessert Antialiasing bei dünnen Linien
        });
        // Wichtig: Auflösung für korrekte Liniendicke setzen
        this.updateResolution(this.rendererSize.width, this.rendererSize.height);

        console.log("[ConnectorManager] Initialized.");
    }

    /**
     * Aktualisiert die Auflösung für das LineMaterial (wichtig bei Resize).
     */
    updateResolution(width, height) {
        this.rendererSize.width = width;
        this.rendererSize.height = height;
        if (this.defaultLineMaterial) {
            this.defaultLineMaterial.resolution.set(width, height);
        }
        // TODO: Auch Materialien bestehender Linien updaten? Ja!
        this.connectors.forEach(conn => {
            if (conn.lineMaterial) {
                 conn.lineMaterial.resolution.set(width, height);
            }
        });
    }

    /**
     * Fügt eine neue Verbindungslinie hinzu.
     * @param {THREE.Object3D} object3D - Das 3D-Objekt (Quelle).
     * @param {THREE.CSS3DObject} css3DObject - Das CSS3D-Objekt (Ziel).
     * @param {object} [options] - Optionale Einstellungen (z.B. color, linewidth).
     * @returns {string|null} Die ID des neuen Connectors oder null bei Fehler.
     */
    addConnector(object3D, css3DObject, options = {}) {
        if (!object3D || !css3DObject) {
            console.error("[ConnectorManager] Both object3D and css3DObject must be provided.");
            return null;
        }

        const id = THREE.MathUtils.generateUUID();
        const color = options.color ?? this.defaultLineMaterial.color.getHex();
        const linewidth = options.linewidth ?? this.defaultLineMaterial.linewidth;

        // Erstelle spezifisches Material für diese Linie (damit lil-gui es ändern kann)
        const lineMaterial = this.defaultLineMaterial.clone();
        lineMaterial.color.setHex(color);
        lineMaterial.linewidth = linewidth;
        // Wichtig: Auflösung auch hier setzen!
        lineMaterial.resolution.copy(this.defaultLineMaterial.resolution);


        // Leere Geometrie erstellen (Positionen werden im Update gesetzt)
        const lineGeometry = new LineGeometry();

        // Line2 Mesh erstellen
        const lineMesh = new Line2(lineGeometry, lineMaterial);
        lineMesh.name = `Connector_${id}`;
        lineMesh.computeLineDistances(); // Wichtig für LineMaterial
        lineMesh.scale.set(1, 1, 1); // Standard-Skalierung

        // Zur Szene hinzufügen
        this.scene.add(lineMesh);

        const connectorData = {
            id: id,
            objA: object3D,
            objB: css3DObject,
            lineMesh: lineMesh,
            lineMaterial: lineMaterial, // Material speichern für GUI
            lineGeometry: lineGeometry
        };
        this.connectors.push(connectorData);

        console.log(`[ConnectorManager] Added connector ${id} between ${object3D.name || object3D.uuid} and ${css3DObject.name || css3DObject.uuid}`);

        // Linie initial zeichnen
        this.updateConnectorLine(connectorData);

        return id; // Gib die ID zurück, um den Connector zu referenzieren
    }

    /**
     * Aktualisiert die Positionen einer einzelnen Verbindungslinie.
     * @param {object} connectorData - Das Connector-Objekt aus this.connectors.
     */
    updateConnectorLine(connectorData) {
        if (!connectorData || !connectorData.objA || !connectorData.objB || !connectorData.lineGeometry) return;

        // Weltpositionen der Endpunkte holen
        connectorData.objA.getWorldPosition(this.tempVecA);
        connectorData.objB.getWorldPosition(this.tempVecB); // CSS3DObject hat auch Weltposition

        // Positionen für LineGeometry setzen (flaches Array [x1, y1, z1, x2, y2, z2])
        const positions = [
            this.tempVecA.x, this.tempVecA.y, this.tempVecA.z,
            this.tempVecB.x, this.tempVecB.y, this.tempVecB.z
        ];
        connectorData.lineGeometry.setPositions(positions);
        connectorData.lineMesh.computeLineDistances(); // Wichtig nach Positionsänderung
    }

    /**
     * Update-Methode, die im Haupt-Renderloop aufgerufen wird.
     * Aktualisiert alle Verbindungslinien.
     */
    update() {
        if (this.connectors.length === 0) return;

        this.connectors.forEach(conn => {
            // Optional: Prüfen, ob Objekte noch in der Szene sind?
            if (conn.objA.parent && conn.objB.parent) { // Einfache Prüfung
                 this.updateConnectorLine(conn);
            } else {
                 // TODO: Connector entfernen, wenn ein Objekt weg ist?
            }
        });
    }

    /**
     * Entfernt einen Connector anhand seiner ID.
     * @param {string} connectorId
     */
    removeConnector(connectorId) {
         const index = this.connectors.findIndex(conn => conn.id === connectorId);
         if (index > -1) {
             const connector = this.connectors[index];
             // Linie aus Szene entfernen
             this.scene.remove(connector.lineMesh);
             // Geometrie & Material disposen
             connector.lineGeometry.dispose();
             connector.lineMaterial.dispose();
             // Aus Array entfernen
             this.connectors.splice(index, 1);
             console.log(`[ConnectorManager] Removed connector ${connectorId}`);
         }
    }

    // TODO: Methoden zum Abrufen/Auswählen von Connectoren für lil-gui
    getConnectors() {
        return this.connectors;
    }
    getConnectorById(id) {
        return this.connectors.find(conn => conn.id === id);
    }

} // Ende class ConnectorManager

export default ConnectorManager;