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
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { SpinDirection } from "@/dronobox/kit";

/**
 * The parts of the DronoBox V2 that are bought rather than printed, modelled to their datasheet
 * sizes in millimetres (the STEP file only has the frame and the flight stack), plus the
 * teaching overlays drawn on top of the drone.
 */

// Materials are 3D surface colours, not UI theme colours; they stay the same in light and dark.
export const KIT_COLOURS = {
    plaWhite: 0xe9edf2,
    plaBlue: 0x1a5fc4,
    tpuBlack: 0x22272e,
    pcbBlack: 0x15181d,
    pcbBlue: 0x16335a,
    escShrink: 0x3a78d8,
    copper: 0xb8743f,
    bell: 0x1b1e23,
    base: 0x3b4048,
    steel: 0xc3cad3,
    nut: 0xb3242c,
    prop: 0x15171b,
    battery: 0x17191d,
    batteryLabel: 0x2b3038,
    batteryStripe: 0xd8a31a,
    wireRed: 0xb3262c,
    wireBlack: 0x1a1b1e,
    xt60: 0xf0c018,
    jst: 0xf2efe6,
    receiver: 0x9cc4ff,
    accent: 0x4da3ff,
    gyro: 0x5cf2c3,
    axisRoll: 0xff5a5f,
    axisPitch: 0x46d68c,
    axisYaw: 0x4da3ff,
    gravity: 0xffc94d,
} as const;

export function surface(colour: number, roughness = 0.55, metalness = 0): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: colour, roughness, metalness });
}

export function glow(colour: number, opacity = 1): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: colour,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
        toneMapped: false,
    });
}

function tube(points: [number, number, number][], radius: number, material: THREE.Material): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), material);
}

/** Motor mount centre on each arm tip, measured from the CAD (arm reach 194.6 mm from centre). */
export const MOTOR_MOUNT = { offset: 137.6, top: 34 };

// --- Motor: Uangel X2807 1300KV ------------------------------------------------------------------
// 28 mm stator, 33.5 mm bell, about 20.5 mm tall plus the M5 shaft and prop nut.

export interface MotorRig {
    group: THREE.Group;
    /** The part that turns: bell, top spokes, shaft and the propeller on top. */
    rotor: THREE.Group;
    propMount: THREE.Group;
}

function lathe(profile: [number, number][], segments = 56): THREE.LatheGeometry {
    return new THREE.LatheGeometry(
        profile.map(([r, y]) => new THREE.Vector2(r, y)),
        segments,
    );
}

function spokedCap(outer: number, inner: number, spokes: number, depth: number): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const window = (Math.PI * 2) / spokes;
    for (let i = 0; i < spokes; i++) {
        const a0 = i * window + window * 0.18;
        const a1 = (i + 1) * window - window * 0.18;
        const hole = new THREE.Path();
        hole.absarc(0, 0, outer - 2.2, a0, a1, false);
        hole.absarc(0, 0, inner, a1, a0, true);
        hole.closePath();
        shape.holes.push(hole);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
}

export function createMotor(): MotorRig {
    const group = new THREE.Group();
    const anodised = surface(KIT_COLOURS.base, 0.38, 0.75);
    const bellMaterial = surface(KIT_COLOURS.bell, 0.32, 0.7);
    bellMaterial.side = THREE.DoubleSide;
    const machined = surface(KIT_COLOURS.steel, 0.22, 1);

    // Base: the bolt-down plate with a short neck carrying the stator.
    group.add(
        new THREE.Mesh(
            lathe([
                [0, 0],
                [15.6, 0],
                [16, 0.5],
                [16, 1.8],
                [14.2, 2.4],
                [13.4, 4],
                [0, 4],
            ]),
            anodised,
        ),
    );

    // Windings: only the band below the bell shows, which is enough to read as a motor.
    const stator = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 8.5, 36), surface(KIT_COLOURS.copper, 0.32, 0.85));
    stator.position.y = 8.5;
    group.add(stator);

    const rotor = new THREE.Group();
    group.add(rotor);

    // Bell: thin anodised can with a machined lip and a chamfered top edge.
    rotor.add(
        new THREE.Mesh(
            lathe([
                [15.85, 5.2],
                [16.75, 5.2],
                [16.75, 18.9],
                [15.9, 20.3],
                [15.4, 20.3],
            ]),
            bellMaterial,
        ),
    );
    const lip = new THREE.Mesh(new THREE.TorusGeometry(16.75, 0.35, 6, 56), machined);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 5.4;
    rotor.add(lip);

    // Spoked top: the windows show the copper underneath and make the rotation visible.
    const cap = new THREE.Mesh(spokedCap(15.4, 5.6, 6, 1.4), bellMaterial);
    cap.position.y = 19;
    rotor.add(cap);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 2.2, 32), bellMaterial);
    hub.position.y = 21.1;
    rotor.add(hub);

    // M5 shaft and the lock nut that holds the prop.
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 13, 20), machined);
    shaft.position.y = 26.5;
    rotor.add(shaft);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 5, 6), surface(KIT_COLOURS.nut, 0.3, 0.8));
    nut.position.y = 32;
    rotor.add(nut);

    const propMount = new THREE.Group();
    propMount.position.y = 22.2;
    rotor.add(propMount);

    return { group, rotor, propMount };
}

// --- Propeller: MR 8045, 8 inch two blade, 4.5 inch pitch -----------------------------------------

const PROP_RADIUS = 101.6;
const PROP_PITCH = 114.3;

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

/**
 * One blade as a lofted airfoil: each span station is a cambered section, turned to the geometric
 * pitch angle atan(pitch / 2 pi r), so the twist is the real 4.5 inch one. Built along +x with the
 * leading edge facing the direction the prop turns.
 */
function bladeGeometry(direction: SpinDirection): THREE.BufferGeometry {
    const rootRadius = 8;
    const spanSteps = 30;
    const chordSteps = 12;
    // Seen from above, a clockwise prop's blade on +x moves towards +z.
    const travel = direction === "cw" ? 1 : -1;
    const positions: number[] = [];
    const indices: number[] = [];
    const row = chordSteps + 1;

    for (const side of [1, -1]) {
        const base = positions.length / 3;
        for (let s = 0; s <= spanSteps; s++) {
            const t = s / spanSteps;
            const r = rootRadius + (PROP_RADIUS - rootRadius) * t;
            let chord = 12 + 11 * smoothstep(0, 0.28, t) - 10 * smoothstep(0.28, 1, t);
            if (t > 0.86) {
                chord *= Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2));
            }
            const thickness = 2.6 * (1 - t) + 0.7 * t;
            const pitch = Math.atan(PROP_PITCH / (2 * Math.PI * r));
            const leading = chord * 0.38;
            for (let j = 0; j <= chordSteps; j++) {
                const u = j / chordSteps;
                const along = leading - u * chord;
                const half = thickness * 0.5 * Math.min(1, 4.2 * Math.sqrt(u) * (1 - u) ** 1.1);
                const camber = 0.04 * chord * 4 * u * (1 - u);
                const lift = camber + side * half;
                const x = along * Math.cos(pitch) - lift * Math.sin(pitch);
                const y = along * Math.sin(pitch) + lift * Math.cos(pitch);
                positions.push(r, y, travel * x);
            }
        }
        for (let s = 0; s < spanSteps; s++) {
            for (let j = 0; j < chordSteps; j++) {
                const a = base + s * row + j;
                const b = a + 1;
                const c = a + row;
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

export function createProp(direction: SpinDirection): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
        color: KIT_COLOURS.prop,
        roughness: 0.32,
        metalness: 0.05,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
    });
    const blade = bladeGeometry(direction);
    const a = new THREE.Mesh(blade, material);
    a.position.y = 4;
    const b = new THREE.Mesh(blade, material);
    b.position.y = 4;
    b.rotation.y = Math.PI;
    const hub = new THREE.Mesh(
        lathe(
            [
                [2.6, 0],
                [8.4, 0],
                [8.4, 6.2],
                [7.2, 8],
                [2.6, 8],
            ],
            32,
        ),
        material,
    );
    group.add(a, b, hub);
    return group;
}

/** Stand-in for a prop spinning too fast to see: brightest towards the tips, like a real blur. */
export function createPropBlur(): THREE.Mesh {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.15, "rgba(255,255,255,0.05)");
        g.addColorStop(0.75, "rgba(255,255,255,0.4)");
        g.addColorStop(0.93, "rgba(255,255,255,0.55)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
    }
    const material = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        color: 0x9fb4cc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PROP_RADIUS, 64), material);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 4;
    return disc;
}

// --- ESC: LittleBee 20 A BLHeli-S, about 26 x 13 x 5 mm in clear blue heat shrink ----------------
// The CAD's 25 x 25 mm plate on each arm is the printed ESC mount; the ESC itself sits on top.

/** Centre of the ESC mount plate on the front-left arm, from the CAD (top face at y = 16.8). */
export const ESC_MOUNT = { x: -74.4, top: 16.8, z: -74.4 };

/** ESC laid along +x (motor end at +x), centred on its own origin. */
export function createEsc(shrinkMaterial: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 11.5), surface(KIT_COLOURS.pcbBlack, 0.45, 0.2));
    pcb.position.y = -0.8;
    group.add(pcb);
    const fet = new THREE.BoxGeometry(3.2, 1, 3.2);
    const fetMaterial = surface(0x2a2d33, 0.5, 0.3);
    for (let i = 0; i < 6; i++) {
        const chip = new THREE.Mesh(fet, fetMaterial);
        chip.position.set(-6 + (i % 3) * 4.6, 0.2, i < 3 ? -2.6 : 2.6);
        group.add(chip);
    }
    const mcu = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 4), fetMaterial);
    mcu.position.set(-9.5, 0.1, 0);
    group.add(mcu);
    const pads = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 10), surface(KIT_COLOURS.copper, 0.3, 0.9));
    pads.position.set(11.2, -0.15, 0);
    group.add(pads);
    const shrink = new THREE.Mesh(new RoundedBoxGeometry(27, 5, 13.4, 3, 2.2), shrinkMaterial);
    group.add(shrink);
    // Power leads leave the inner end towards the body; the PDB end is out of view.
    const red = surface(KIT_COLOURS.wireRed, 0.55);
    const black = surface(KIT_COLOURS.wireBlack, 0.55);
    group.add(
        tube(
            [
                [-13, 0, -2.4],
                [-19, 0.5, -2.8],
                [-26, 2, -3],
            ],
            0.9,
            red,
        ),
        tube(
            [
                [-13, 0, 2.4],
                [-19, 0.5, 2.8],
                [-26, 2, 3],
            ],
            0.9,
            black,
        ),
    );
    return group;
}

/** The three phase wires between an ESC and its motor. Real ones are black; tinted here so "swap any two" is visible. */
export const PHASE_COLOURS = [0xc94a4a, 0xd9a92e, 0x3a3f47] as const;

export function createWire(colour: number): THREE.Mesh {
    return new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1, 8), surface(colour, 0.5));
}

const UP = new THREE.Vector3(0, 1, 0);
const scratch = new THREE.Vector3();

/** Stretch a unit-height cylinder between two points. */
export function placeWire(wire: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    scratch.subVectors(to, from);
    const length = scratch.length();
    wire.position.copy(from).addScaledVector(scratch, 0.5);
    wire.scale.set(1, Math.max(length, 0.001), 1);
    wire.quaternion.setFromUnitVectors(UP, scratch.normalize());
}

// --- Receiver: RadioMaster RP2 V2 (ELRS), 18 x 11 mm board in clear heat shrink -------------------

export function createReceiver(): THREE.Group {
    const group = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 11), surface(KIT_COLOURS.pcbBlack, 0.45, 0.2));
    group.add(board);
    const antenna = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 2.2), surface(0xd9d6cc, 0.4));
    antenna.position.set(5.5, 1.2, -3);
    group.add(antenna);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 5), surface(0x2a2d33, 0.5, 0.3));
    chip.position.set(-3, 0.9, 1);
    group.add(chip);
    const led = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1), glow(0x46d68c));
    led.position.set(6, 0.8, 3.6);
    group.add(led);
    const wrap = new THREE.Mesh(
        new RoundedBoxGeometry(20, 4.2, 12.6, 3, 1.8),
        new THREE.MeshPhysicalMaterial({
            color: 0xdfe9f5,
            roughness: 0.12,
            transmission: 0.7,
            thickness: 0.4,
            transparent: true,
            opacity: 0.35,
        }),
    );
    wrap.position.y = 0.6;
    group.add(wrap);
    // Four-wire lead to the flight controller's UART pins.
    const colours = [0x1a1b1e, 0xb3262c, 0xd9a92e, 0xe8e8e8];
    colours.forEach((colour, i) => {
        group.add(
            tube(
                [
                    [-10, 0, -2.4 + i * 1.6],
                    [-16, 1, -2.4 + i * 1.6],
                    [-22, 4, -1 + i * 0.8],
                ],
                0.45,
                surface(colour, 0.55),
            ),
        );
    });
    return group;
}

// --- Battery: Turnigy 3S 2200 mAh 25C, about 105 x 34 x 24 mm, strapped under the body ----------

function xt60(): THREE.Mesh {
    // XT60 face: a 15.6 x 8.2 mm rectangle with two corners chamfered (the polarity key).
    const shape = new THREE.Shape();
    shape.moveTo(-7.8, -4.1);
    shape.lineTo(7.8, -4.1);
    shape.lineTo(7.8, 1.6);
    shape.lineTo(5.3, 4.1);
    shape.lineTo(-5.3, 4.1);
    shape.lineTo(-7.8, 1.6);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 16,
        bevelEnabled: true,
        bevelSize: 0.4,
        bevelThickness: 0.4,
        bevelSegments: 2,
    });
    geometry.center();
    return new THREE.Mesh(geometry, surface(KIT_COLOURS.xt60, 0.45));
}

/** Battery with its long side along z; the leads leave the +z end. */
export function createBattery(): THREE.Group {
    const group = new THREE.Group();
    const length = 105;
    const width = 34;
    const height = 24;

    const pack = new THREE.Mesh(
        new RoundedBoxGeometry(width, height, length, 4, 3),
        surface(KIT_COLOURS.battery, 0.42, 0.05),
    );
    group.add(pack);
    // Printed label band and a thin stripe, as on the shrink wrap.
    const label = new THREE.Mesh(
        new RoundedBoxGeometry(width + 0.3, height + 0.3, 62, 3, 3),
        surface(KIT_COLOURS.batteryLabel, 0.5),
    );
    label.position.z = -6;
    group.add(label);
    const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.6, height + 0.6, 2.2),
        surface(KIT_COLOURS.batteryStripe, 0.45),
    );
    stripe.position.z = 26;
    group.add(stripe);

    // Velcro strap around the pack and up into the body's strap slots.
    const strapShape = new THREE.Shape();
    strapShape.moveTo(-width / 2 - 1.4, -height / 2 - 1.4);
    strapShape.lineTo(width / 2 + 1.4, -height / 2 - 1.4);
    strapShape.lineTo(width / 2 + 1.4, height / 2 + 1.4);
    strapShape.lineTo(-width / 2 - 1.4, height / 2 + 1.4);
    strapShape.closePath();
    const inner = new THREE.Path();
    inner.moveTo(-width / 2, -height / 2);
    inner.lineTo(-width / 2, height / 2);
    inner.lineTo(width / 2, height / 2);
    inner.lineTo(width / 2, -height / 2);
    inner.closePath();
    strapShape.holes.push(inner);
    const strap = new THREE.Mesh(
        new THREE.ExtrudeGeometry(strapShape, { depth: 20, bevelEnabled: false }),
        surface(0x101114, 0.9),
    );
    strap.position.z = -26;
    group.add(strap);

    // Main leads (14 AWG) curling up to the XT60 under the body.
    const red = surface(KIT_COLOURS.wireRed, 0.5);
    const black = surface(KIT_COLOURS.wireBlack, 0.5);
    group.add(
        tube(
            [
                [-3, 4, length / 2],
                [-3, 6, length / 2 + 10],
                [-3, 12, length / 2 + 12],
                [-2, 15, length / 2 + 6],
            ],
            1.3,
            red,
        ),
        tube(
            [
                [3, 4, length / 2],
                [3, 6, length / 2 + 10],
                [3, 12, length / 2 + 12],
                [2, 15, length / 2 + 6],
            ],
            1.3,
            black,
        ),
    );
    const plug = xt60();
    plug.rotation.x = -Math.PI / 2;
    plug.position.set(0, 22, length / 2 + 6);
    group.add(plug);

    // Balance lead: four thin wires into a white JST-XH plug resting on the pack.
    const balance = [0x1a1b1e, 0xb3262c, 0xb3262c, 0xb3262c];
    balance.forEach((colour, i) => {
        group.add(
            tube(
                [
                    [-12 + i * 1.3, 2, length / 2],
                    [-12 + i * 1.3, 6, length / 2 + 6],
                    [-11 + i * 1.3, height / 2 + 2, length / 2 - 4],
                    [-10 + i * 1.3, height / 2 + 1.2, length / 2 - 16],
                ],
                0.4,
                surface(colour, 0.55),
            ),
        );
    });
    const jst = new THREE.Mesh(new RoundedBoxGeometry(11, 5, 6, 2, 0.8), surface(KIT_COLOURS.jst, 0.5));
    jst.position.set(-8, height / 2 + 2.6, length / 2 - 20);
    group.add(jst);
    return group;
}

// --- Overlays -------------------------------------------------------------------------------------

/** Flat arrow lying in the xz plane, pointing along -z. */
export function createFlatArrow(length: number, width: number, colour: number, opacity = 1): THREE.Mesh {
    const shape = new THREE.Shape();
    const head = width * 1.1;
    shape.moveTo(-width * 0.18, length / 2);
    shape.lineTo(width * 0.18, length / 2);
    shape.lineTo(width * 0.18, -length / 2 + head);
    shape.lineTo(width / 2, -length / 2 + head);
    shape.lineTo(0, -length / 2);
    shape.lineTo(-width / 2, -length / 2 + head);
    shape.lineTo(-width * 0.18, -length / 2 + head);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geometry, glow(colour, opacity));
}

/** Curved arrow around a vertical axis: most of a circle, head pointing the way the motor turns. */
export function createSpinArrow(radius: number, direction: SpinDirection, colour: number): THREE.Group {
    const group = new THREE.Group();
    const material = glow(colour, 0.95);
    const arc = Math.PI * 1.35;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.8, 8, 64, arc), material);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const head = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 16), material);
    // After the -90 degree tilt the torus runs counter-clockwise seen from above, from angle 0
    // to `arc`, through points (cos a, 0, -sin a). The head sits at the end the motor turns towards.
    const end = direction === "ccw" ? arc : 0;
    head.position.set(radius * Math.cos(end), 0, -radius * Math.sin(end));
    const travel =
        direction === "ccw"
            ? new THREE.Vector3(-Math.sin(end), 0, -Math.cos(end))
            : new THREE.Vector3(Math.sin(end), 0, Math.cos(end));
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), travel.normalize());
    group.add(head);
    return group;
}

/** Three rings showing the axes a gyroscope measures, each tinted like the readout next to it. */
export function createGimbal(radius: number): {
    group: THREE.Group;
    roll: THREE.Mesh;
    pitch: THREE.Mesh;
    yaw: THREE.Mesh;
} {
    const group = new THREE.Group();
    const ring = (colour: number, r: number) =>
        new THREE.Mesh(new THREE.TorusGeometry(r, 1.2, 12, 96), glow(colour, 0.9));
    const yaw = ring(KIT_COLOURS.axisYaw, radius);
    yaw.rotation.x = Math.PI / 2;
    const pitch = ring(KIT_COLOURS.axisPitch, radius * 0.86);
    pitch.rotation.y = Math.PI / 2;
    const roll = ring(KIT_COLOURS.axisRoll, radius * 0.72);
    group.add(yaw, pitch, roll);
    return { group, roll, pitch, yaw };
}

export function createGravityArrow(length: number): THREE.Group {
    const group = new THREE.Group();
    const material = glow(KIT_COLOURS.gravity, 0.95);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, length, 16), material);
    shaft.position.y = -length / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 24), material);
    head.rotation.x = Math.PI;
    head.position.y = -length - 6;
    group.add(shaft, head);
    return group;
}

/** Expanding rings that say "radio" without words. Animate with updateWaves. */
export function createWaves(count: number, colour: number): THREE.Group {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.8, 8, 64), glow(colour, 0.6));
        ring.rotation.x = Math.PI / 2;
        ring.userData.phase = i / count;
        group.add(ring);
    }
    return group;
}

export function updateWaves(group: THREE.Group, time: number, maxRadius: number): void {
    for (const child of group.children) {
        const ring = child as THREE.Mesh;
        const t = (time * 0.45 + (ring.userData.phase as number)) % 1;
        ring.scale.setScalar(0.4 + t * (maxRadius / 10));
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - t);
    }
}
