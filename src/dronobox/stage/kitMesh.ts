/*
 * This file is part of Betaflight.
 *
 * Betaflight is free software. You can redistribute this software
 * and/or modify this software under the terms of the GNU General
 * Public License as published by the Free Software Foundation,
 * either version 3 of the License, or (at your option) any later
 * version.
 *
 * Betaflight is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public
 * License along with this software.
 *
 * If not, see <http://www.gnu.org/licenses/>.
 */

import * as THREE from "three";

/**
 * Reader for public/dronobox/dronobox-v2.bin, the DronoBox V2 printed frame and flight stack
 * meshed from the team's STEP file by tools/dronobox/build_kit_mesh.py. Units are millimetres,
 * +y is up, and the body floor sits at y = 0.
 */

export type KitMeshPart = "body" | "arm" | "esc" | "lid" | "latches" | "fc" | "pdb" | "standoffs" | "screws";

interface PartEntry {
    name: KitMeshPart;
    vertices: number;
    indices: number;
    positionOffset: number;
    indexOffset: number;
    indexType: "u16" | "u32";
}

interface Header {
    bounds: { min: [number, number, number]; max: [number, number, number] };
    parts: PartEntry[];
}

export const KIT_MESH_URL = "./dronobox/dronobox-v2.bin";

export type KitGeometries = Record<KitMeshPart, THREE.BufferGeometry>;

export function parseKitMesh(buffer: ArrayBuffer): KitGeometries {
    const view = new DataView(buffer);
    const headerLength = view.getUint32(0, true);
    const headerText = new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)).replace(/\0+$/, "");
    const header = JSON.parse(headerText) as Header;
    const base = 4 + headerLength;
    const lo = header.bounds.min;
    const hi = header.bounds.max;
    const scale = lo.map((min, i) => (hi[i] - min) / 65534);

    const result = {} as KitGeometries;
    for (const part of header.parts) {
        const packed = new Int16Array(buffer, base + part.positionOffset, part.vertices * 3);
        const positions = new Float32Array(part.vertices * 3);
        for (let i = 0; i < positions.length; i++) {
            const axis = i % 3;
            positions[i] = (packed[i] + 32767) * scale[axis] + lo[axis];
        }
        const indices =
            part.indexType === "u32"
                ? new Uint32Array(buffer, base + part.indexOffset, part.indices)
                : new Uint16Array(buffer, base + part.indexOffset, part.indices);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        result[part.name] = geometry;
    }
    return result;
}

async function fetchKitMesh(): Promise<KitGeometries> {
    const response = await fetch(KIT_MESH_URL);
    if (!response.ok) {
        throw new Error(`DronoBox model: HTTP ${response.status}`);
    }
    return parseKitMesh(await response.arrayBuffer());
}

// Shared across stage instances: the guided tab remounts after every save-and-reboot.
let cached: Promise<KitGeometries> | null = null;

export function loadKitMesh(): Promise<KitGeometries> {
    cached ??= fetchKitMesh().catch((error: unknown) => {
        cached = null;
        throw error;
    });
    return cached;
}
