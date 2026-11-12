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
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRONOBOX_KIT, type SpinDirection } from "@/dronobox/kit";
import type { KitGeometries } from "./kitMesh";
import { sandboxOutcome } from "@/dronobox/sandbox";
import {
    KIT_COLOURS,
    MOTOR_MOUNT,
    createBattery,
    createFlatArrow,
    createGimbal,
    createGravityArrow,
    createMotor,
    createProp,
    createPropBlur,
    createReceiver,
    createSpinArrow,
    createWaves,
    createEsc,
    createWire,
    placeWire,
    ESC_MOUNT,
    PHASE_COLOURS,
    glow,
    surface,
    updateWaves,
    type MotorRig,
} from "./kitParts";

/**
 * The DronoBox 3D stage. Every lesson picks a "shot": where the camera is, which parts lift out of
 * the drone, and which teaching overlays are shown. The stage eases between shots on its own
 * clock, so the Vue side only ever says what to show, never how to animate it.
 *
 * Scene units are millimetres, +y is up and the nose points along -z (as in Betaflight's own
 * model), so live attitude maps the same way the Setup tab maps it.
 */

export type ShotName =
    | "hero"
    | "meet"
    | "gyro"
    | "align"
    | "level"
    | "esc"
    | "sandbox"
    | "safety"
    | "spin"
    | "radio"
    | "done"
    | "gyroGame";

export type KitPart = "frame" | "fc" | "pdb" | "esc" | "motor" | "prop" | "receiver" | "battery";

export const KIT_PARTS: readonly KitPart[] = ["frame", "fc", "pdb", "esc", "motor", "prop", "receiver", "battery"];

export interface StageInput {
    shot: ShotName;
    /** Live attitude in degrees, as Betaflight reports it. */
    attitude: { roll: number; pitch: number; heading: number };
    /** Stick positions, roll/pitch/yaw -1..1 and throttle 0..1, or null when the radio is silent. */
    sticks: { roll: number; pitch: number; yaw: number; throttle: number } | null;
    /** Motor being spun by the real motor test, 1-based. */
    spinningMotor: number | null;
    selectedMotor: number | null;
    /** Motors whose expected direction may be shown (already answered, or instructor mode). */
    revealedMotors: readonly number[];
    propsOn: boolean;
    batteryIn: boolean;
    highlight: KitPart | null;
    sandbox: { dirs: Record<number, SpinDirection>; flying: boolean } | null;
    /** Alignment demo: 0 shows where Betaflight assumes the arrow points, 1 where it really points. */
    alignTurn: number;
    /** Gyro game: the attitude to match (degrees, Betaflight convention), and whether it is matched. */
    ghost: { roll: number; pitch: number } | null;
    ghostMatched: boolean;
}

export interface LabelAnchor {
    part: KitPart;
    x: number;
    y: number;
    visible: boolean;
}

type ExplodeKey = "lid" | "fc" | "pdb" | "esc" | "motor" | "arm" | "receiver" | "battery";
type Overlay = "gimbal" | "gravity" | "align" | "spinArrows" | "waves" | "labels" | "chip" | "wires";

interface Shot {
    /**
     * Camera as an orbit around `target`: azimuth 0 looks from behind the drone (+z, so the nose
     * points into the screen like Betaflight's model), 90 from its right side. Degrees and mm.
     */
    orbit: { azimuth: number; elevation: number; distance: number };
    target: [number, number, number];
    explode: Partial<Record<ExplodeKey, number>>;
    overlays: Overlay[];
    /** How the drone's attitude is driven in this shot. */
    motion: "rest" | "live" | "sticks" | "sandbox" | "hover" | "float";
    /** Fade the lifted lid so the camera can look inside. */
    seeInside?: boolean;
}

const SHOTS: Record<ShotName, Shot> = {
    hero: {
        orbit: { azimuth: 38, elevation: 24, distance: 980 },
        target: [0, 10, 0],
        explode: {},
        overlays: [],
        motion: "float",
    },
    meet: {
        orbit: { azimuth: 35, elevation: 30, distance: 1180 },
        target: [0, 30, 0],
        explode: { lid: 1, fc: 1, pdb: 1, esc: 1, motor: 1, arm: 1, receiver: 1, battery: 1 },
        overlays: ["labels"],
        motion: "float",
    },
    gyro: {
        orbit: { azimuth: 0, elevation: 32, distance: 400 },
        target: [0, 58, 0],
        explode: { lid: 1, fc: 0.75 },
        overlays: ["gimbal", "chip"],
        motion: "live",
        seeInside: true,
    },
    align: {
        orbit: { azimuth: 0, elevation: 86, distance: 860 },
        target: [0, 20, -30],
        explode: { lid: 1, fc: 0.35 },
        overlays: ["align"],
        motion: "rest",
        seeInside: true,
    },
    level: {
        orbit: { azimuth: 90, elevation: 10, distance: 860 },
        target: [0, -5, 0],
        explode: {},
        overlays: ["gravity"],
        motion: "live",
    },
    esc: {
        orbit: { azimuth: 45, elevation: 26, distance: 360 },
        target: [100, 42, -100],
        explode: { esc: 0.7, motor: 0.9 },
        overlays: ["wires"],
        motion: "rest",
    },
    sandbox: {
        orbit: { azimuth: 30, elevation: 22, distance: 1050 },
        target: [0, 80, 0],
        explode: {},
        overlays: ["spinArrows"],
        motion: "sandbox",
    },
    safety: {
        orbit: { azimuth: 32, elevation: 24, distance: 960 },
        target: [0, 20, 0],
        explode: {},
        overlays: [],
        motion: "rest",
    },
    spin: {
        orbit: { azimuth: 0, elevation: 60, distance: 940 },
        target: [0, 10, 0],
        explode: {},
        overlays: ["spinArrows"],
        motion: "rest",
    },
    radio: {
        orbit: { azimuth: 22, elevation: 26, distance: 960 },
        target: [0, 60, 0],
        explode: { lid: 1, receiver: 1 },
        overlays: ["waves"],
        motion: "sticks",
        seeInside: true,
    },
    gyroGame: {
        orbit: { azimuth: 0, elevation: 20, distance: 820 },
        target: [0, 15, 0],
        explode: {},
        overlays: [],
        motion: "live",
    },
    done: {
        orbit: { azimuth: 35, elevation: 16, distance: 1000 },
        target: [0, 80, 0],
        explode: {},
        overlays: [],
        motion: "hover",
    },
};

function orbitPosition(shot: Shot, out: THREE.Vector3): THREE.Vector3 {
    const { azimuth, elevation, distance } = shot.orbit;
    const az = azimuth * DEG;
    const el = elevation * DEG;
    return out.set(
        shot.target[0] + Math.sin(az) * Math.cos(el) * distance,
        shot.target[1] + Math.sin(el) * distance,
        shot.target[2] + Math.cos(az) * Math.cos(el) * distance,
    );
}

// Exploded-view displacement at amount 1, in millimetres.
const EXPLODE_LIFT: Record<ExplodeKey, number> = {
    lid: 110,
    fc: 58,
    pdb: 26,
    esc: 22,
    motor: 40,
    arm: 0,
    receiver: 18,
    battery: -48,
};
const EXPLODE_OUT: Partial<Record<ExplodeKey, number>> = { arm: 20, esc: 20, motor: 20, receiver: 70 };

// Quarter turns for each arm copy, and which motor (1-based) sits on that arm. Arm 0 in the CAD
// is the front-left one (-x, -z); each copy turns it 90 degrees counter-clockwise seen from above.
const ARM_SLOTS: { quarter: number; motor: number }[] = [
    { quarter: 0, motor: 4 }, // front left
    { quarter: 1, motor: 3 }, // back left
    { quarter: 2, motor: 1 }, // back right
    { quarter: 3, motor: 2 }, // front right
];

const DEG = Math.PI / 180;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Critically damped approach: frame-rate independent smoothing towards a target. */
function approach(current: number, target: number, rate: number, dt: number): number {
    return target + (current - target) * Math.exp(-rate * dt);
}

function angleApproach(current: number, target: number, rate: number, dt: number): number {
    let delta = (target - current) % (Math.PI * 2);
    if (delta > Math.PI) {
        delta -= Math.PI * 2;
    } else if (delta < -Math.PI) {
        delta += Math.PI * 2;
    }
    return current + delta * (1 - Math.exp(-rate * dt));
}

/**
 * Critically damped spring towards a target (Game Programming Gems 4, 1.10). Unlike a plain
 * exponential it starts from the current velocity, so moves ease in as well as out.
 */
function smoothDamp(current: number, target: number, state: { v: number }, smoothTime: number, dt: number): number {
    const omega = 2 / Math.max(smoothTime, 0.0001);
    const x = omega * dt;
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (state.v + omega * change) * dt;
    state.v = (state.v - omega * temp) * decay;
    return target + (change + temp) * decay;
}

interface MotorSlot {
    number: number;
    direction: SpinDirection;
    arm: THREE.Group;
    esc: THREE.Group;
    motor: MotorRig;
    motorHolder: THREE.Group;
    prop: THREE.Group;
    propHolder: THREE.Group;
    blur: THREE.Mesh;
    arrows: Record<SpinDirection, THREE.Group>;
    ring: THREE.Mesh;
    /** Unit vector from the centre towards this arm, in the drone's xz plane. */
    outward: THREE.Vector3;
    wires: THREE.Mesh[];
    angle: number;
    spinAngle: number;
    spinSpeed: number;
}

export class KitStage {
    readonly renderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(32, 1, 5, 6000);
    private readonly clock = new THREE.Clock();
    private readonly cameraPos = orbitPosition(SHOTS.hero, new THREE.Vector3());
    private readonly cameraTarget = new THREE.Vector3(...SHOTS.hero.target);

    /** Yaw lives on the outer group and pitch/roll on the inner one, like Betaflight's model. */
    private readonly yawGroup = new THREE.Group();
    private readonly tiltGroup = new THREE.Group();
    private readonly lift = new THREE.Group();

    private readonly parts = {} as Record<ExplodeKey, THREE.Object3D[]>;
    private readonly explode = {} as Record<ExplodeKey, number>;
    private readonly slots: MotorSlot[] = [];
    private readonly materials = new Map<KitPart, THREE.MeshStandardMaterial[]>();
    private readonly anchors = new Map<KitPart, THREE.Object3D>();

    private lidMaterials: THREE.MeshStandardMaterial[] = [];
    private lidGroup!: THREE.Group;
    private fcGroup!: THREE.Group;
    private chip!: THREE.Mesh;
    private gimbal!: ReturnType<typeof createGimbal>;
    private gravity!: THREE.Group;
    private alignGhost!: THREE.Mesh;
    private alignReal!: THREE.Mesh;
    private frontArrow!: THREE.Mesh;
    private waves!: THREE.Group;
    private receiver!: THREE.Group;
    private battery!: THREE.Group;
    private shadow!: THREE.Mesh;
    private readonly overlayOpacity = new Map<Overlay, number>();

    private input: StageInput = {
        shot: "hero",
        attitude: { roll: 0, pitch: 0, heading: 0 },
        sticks: null,
        spinningMotor: null,
        selectedMotor: null,
        revealedMotors: [],
        propsOn: true,
        batteryIn: true,
        highlight: null,
        sandbox: null,
        alignTurn: 1,
        ghost: null,
        ghostMatched: false,
    };

    private lidFade = 1;
    private headingZero: number | null = null;
    private yaw = 0;
    private pitch = 0;
    private roll = 0;
    private altitude = 0;
    private readonly springs = new Map<string, { v: number }>();
    private orbitAzimuth = 0;
    private orbitElevation = 0;
    private orbitZoom = 1;
    private orbitVelocity = { az: 0, el: 0 };
    private dragging = false;
    private readonly ghostOuter = new THREE.Group();
    private readonly ghostInner = new THREE.Group();
    private readonly ghostMaterial = new THREE.MeshBasicMaterial({
        color: KIT_COLOURS.accent,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
    });
    private stickYaw = 0;
    private propsShown = 1;
    private batteryShown = 1;
    private alignShown = 1;
    private sandboxClock = 0;
    private sandboxFlying = false;
    private time = 0;
    private frameId = 0;
    private disposed = false;
    private readonly projected = new THREE.Vector3();

    onAnchors: ((anchors: LabelAnchor[]) => void) | null = null;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        geometries: KitGeometries,
    ) {
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.setClearColor(0x000000, 0);

        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();

        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(300, 600, 250);
        const rim = new THREE.DirectionalLight(0x9cc7ff, 1.1);
        rim.position.set(-400, 200, -500);
        this.scene.add(key, rim, new THREE.HemisphereLight(0xdfe9ff, 0x0b1a33, 0.5));

        this.scene.add(this.yawGroup);
        this.yawGroup.add(this.lift);
        this.lift.add(this.tiltGroup);

        for (const k of Object.keys(EXPLODE_LIFT) as ExplodeKey[]) {
            this.parts[k] = [];
            this.explode[k] = 0;
        }

        this.buildFrame(geometries);
        this.buildMotors(geometries);
        this.buildElectronics();
        this.buildOverlays();
        this.buildShadow();
        this.camera.position.copy(this.cameraPos);
    }

    // --- building ---------------------------------------------------------------------------

    private partMaterial(part: KitPart, colour: number, roughness = 0.55, metalness = 0): THREE.MeshStandardMaterial {
        const material = surface(colour, roughness, metalness);
        material.emissive = new THREE.Color(KIT_COLOURS.accent);
        material.emissiveIntensity = 0;
        const list = this.materials.get(part) ?? [];
        list.push(material);
        this.materials.set(part, list);
        return material;
    }

    private anchor(part: KitPart, parent: THREE.Object3D, x: number, y: number, z: number): void {
        const marker = new THREE.Object3D();
        marker.position.set(x, y, z);
        parent.add(marker);
        this.anchors.set(part, marker);
    }

    private buildFrame(g: KitGeometries): void {
        const white = this.partMaterial("frame", KIT_COLOURS.plaWhite, 0.62);
        const blue = this.partMaterial("frame", KIT_COLOURS.plaBlue, 0.5);

        const body = new THREE.Mesh(g.body, white);
        this.tiltGroup.add(body);
        this.anchor("frame", body, 52, 26, 30);

        this.lidGroup = new THREE.Group();
        const lidWhite = surface(KIT_COLOURS.plaWhite, 0.62);
        const latchBlack = surface(KIT_COLOURS.tpuBlack, 0.8);
        for (const m of [lidWhite, latchBlack]) {
            m.transparent = true;
        }
        this.lidMaterials = [lidWhite, latchBlack];
        this.lidGroup.add(new THREE.Mesh(g.lid, lidWhite), new THREE.Mesh(g.latches, latchBlack));
        this.tiltGroup.add(this.lidGroup);
        this.parts.lid.push(this.lidGroup);

        this.fcGroup = new THREE.Group();
        const fc = new THREE.Mesh(g.fc, this.partMaterial("fc", KIT_COLOURS.pcbBlack, 0.45, 0.2));
        const screws = new THREE.Mesh(g.screws, surface(KIT_COLOURS.steel, 0.3, 1));
        this.fcGroup.add(fc, screws);
        this.tiltGroup.add(this.fcGroup);
        this.parts.fc.push(this.fcGroup);
        this.anchor("fc", this.fcGroup, 20, 22, -6);

        const pdbGroup = new THREE.Group();
        pdbGroup.add(new THREE.Mesh(g.pdb, this.partMaterial("pdb", KIT_COLOURS.pcbBlue, 0.45, 0.2)));
        pdbGroup.add(new THREE.Mesh(g.standoffs, surface(KIT_COLOURS.tpuBlack, 0.7)));
        this.tiltGroup.add(pdbGroup);
        this.parts.pdb.push(pdbGroup);
        this.anchor("pdb", pdbGroup, -20, 8, 10);

        for (const { quarter } of ARM_SLOTS) {
            const arm = new THREE.Group();
            arm.rotation.y = quarter * (Math.PI / 2);
            arm.add(new THREE.Mesh(g.arm, blue));
            this.tiltGroup.add(arm);
            this.parts.arm.push(arm);
        }

        // Gyro game: a see-through copy of the frame showing the pose to copy.
        this.ghostOuter.add(this.ghostInner);
        this.ghostOuter.visible = false;
        this.scene.add(this.ghostOuter);
        this.ghostInner.add(new THREE.Mesh(g.body, this.ghostMaterial));
        for (const { quarter } of ARM_SLOTS) {
            const ghostArm = new THREE.Mesh(g.arm, this.ghostMaterial);
            ghostArm.rotation.y = quarter * (Math.PI / 2);
            this.ghostInner.add(ghostArm);
        }
    }

    private buildMotors(g: KitGeometries): void {
        const mountMaterial = surface(KIT_COLOURS.plaBlue, 0.5);
        const escMaterial = this.partMaterial("esc", KIT_COLOURS.escShrink, 0.35, 0.1);

        for (const { quarter, motor: number } of ARM_SLOTS) {
            const kitMotor = DRONOBOX_KIT.motors.find((m) => m.number === number);
            const direction: SpinDirection = kitMotor?.direction ?? "cw";

            const angle = quarter * (Math.PI / 2);
            const outward = new THREE.Vector3(-1, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
            const mount = new THREE.Vector3(-MOTOR_MOUNT.offset, MOTOR_MOUNT.top, -MOTOR_MOUNT.offset).applyAxisAngle(
                new THREE.Vector3(0, 1, 0),
                angle,
            );

            const esc = new THREE.Group();
            esc.rotation.y = angle;
            esc.add(new THREE.Mesh(g.esc, mountMaterial));
            const escBody = createEsc(escMaterial);
            escBody.position.set(ESC_MOUNT.x, ESC_MOUNT.top + 2.6, ESC_MOUNT.z);
            // The ESC model runs along +x with its motor end first; turn it to face the arm tip.
            escBody.rotation.y = (3 * Math.PI) / 4;
            esc.add(escBody);
            this.tiltGroup.add(esc);
            const wires = PHASE_COLOURS.map((colour) => {
                const wire = createWire(colour);
                this.tiltGroup.add(wire);
                return wire;
            });
            this.parts.esc.push(esc);

            const motorHolder = new THREE.Group();
            motorHolder.position.copy(mount);
            const motor = createMotor();
            motor.group.traverse((o) => {
                if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
                    o.material.emissive = new THREE.Color(KIT_COLOURS.accent);
                    o.material.emissiveIntensity = 0;
                    const list = this.materials.get("motor") ?? [];
                    list.push(o.material);
                    this.materials.set("motor", list);
                }
            });
            motorHolder.add(motor.group);
            this.tiltGroup.add(motorHolder);
            this.parts.motor.push(motorHolder);

            const propHolder = new THREE.Group();
            const prop = createProp(direction);
            prop.traverse((o) => {
                if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
                    const list = this.materials.get("prop") ?? [];
                    if (!list.includes(o.material)) {
                        o.material.emissive = new THREE.Color(KIT_COLOURS.accent);
                        o.material.emissiveIntensity = 0;
                        list.push(o.material);
                    }
                    this.materials.set("prop", list);
                }
            });
            propHolder.add(prop);
            const blur = createPropBlur();
            propHolder.add(blur);
            motor.propMount.add(propHolder);

            const arrows = {
                cw: createSpinArrow(46, "cw", KIT_COLOURS.accent),
                ccw: createSpinArrow(46, "ccw", KIT_COLOURS.accent),
            };
            for (const arrow of Object.values(arrows)) {
                arrow.position.y = 30;
                arrow.visible = false;
                motorHolder.add(arrow);
            }

            const ring = new THREE.Mesh(new THREE.TorusGeometry(30, 1.6, 8, 64), glow(KIT_COLOURS.accent, 0));
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 2;
            motorHolder.add(ring);

            if (number === 2) {
                this.anchor("motor", motorHolder, 0, 24, 0);
                this.anchor("prop", propHolder, 70, 4, 0);
                this.anchor("esc", esc, -74, 17, -74);
            }

            this.slots.push({
                number,
                direction,
                arm: this.parts.arm[this.slots.length] as THREE.Group,
                esc,
                motor,
                motorHolder,
                prop,
                propHolder,
                blur,
                arrows,
                ring,
                outward,
                wires,
                angle,
                spinAngle: Math.random() * Math.PI,
                spinSpeed: 0,
            });
        }
    }

    private buildElectronics(): void {
        this.receiver = createReceiver();
        this.receiver.position.set(0, 3, 33);
        this.receiver.traverse((o) => {
            if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
                o.material.emissive = new THREE.Color(KIT_COLOURS.accent);
                o.material.emissiveIntensity = 0;
                const list = this.materials.get("receiver") ?? [];
                list.push(o.material);
                this.materials.set("receiver", list);
            }
        });
        this.tiltGroup.add(this.receiver);
        this.parts.receiver.push(this.receiver);
        this.anchor("receiver", this.receiver, 12, 2, 6);

        this.battery = createBattery();
        this.battery.position.set(0, -15, 0);
        this.battery.traverse((o) => {
            if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
                o.material.emissive = new THREE.Color(KIT_COLOURS.accent);
                o.material.emissiveIntensity = 0;
                o.material.transparent = true;
                const list = this.materials.get("battery") ?? [];
                list.push(o.material);
                this.materials.set("battery", list);
            }
        });
        this.tiltGroup.add(this.battery);
        this.parts.battery.push(this.battery);
        this.anchor("battery", this.battery, 54, -4, 18);
    }

    private buildOverlays(): void {
        // The gyro chip sits in the middle of the F4V3S, on top of the board.
        this.chip = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 5), glow(KIT_COLOURS.gyro, 0));
        this.chip.position.set(0, 22.4, 0);
        this.fcGroup.add(this.chip);

        this.gimbal = createGimbal(40);
        this.gimbal.group.position.set(0, 23, 0);
        this.fcGroup.add(this.gimbal.group);

        this.gravity = createGravityArrow(115);
        this.gravity.renderOrder = 10;
        this.gravity.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Drawn through the body: the point is where gravity pulls, not what hides it.
                (child.material as THREE.MeshBasicMaterial).depthTest = false;
                child.renderOrder = 10;
            }
        });
        this.gravity.position.set(0, -2, 0);
        this.scene.add(this.gravity);

        // Alignment demo, drawn on top of the flight controller. The real arrow points to the
        // drone's left: the board sits 270 degrees clockwise from Betaflight's default.
        this.alignReal = createFlatArrow(30, 16, 0xffffff, 0);
        this.alignReal.position.set(0, 23.5, 0);
        this.alignReal.rotation.y = Math.PI / 2;
        this.fcGroup.add(this.alignReal);
        this.alignGhost = createFlatArrow(30, 16, KIT_COLOURS.gravity, 0);
        this.alignGhost.position.set(0, 24, 0);
        this.fcGroup.add(this.alignGhost);
        this.frontArrow = createFlatArrow(60, 34, KIT_COLOURS.accent, 0);
        this.frontArrow.position.set(0, 2, -230);
        this.tiltGroup.add(this.frontArrow);

        this.waves = createWaves(4, KIT_COLOURS.receiver);
        this.receiver.add(this.waves);
        this.waves.position.y = 6;

        for (const key of [
            "gimbal",
            "gravity",
            "align",
            "spinArrows",
            "waves",
            "labels",
            "chip",
            "wires",
        ] as Overlay[]) {
            this.overlayOpacity.set(key, 0);
        }
    }

    private buildShadow(): void {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            gradient.addColorStop(0, "rgba(0,0,0,0.55)");
            gradient.addColorStop(0.55, "rgba(0,0,0,0.22)");
            gradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
        }
        const texture = new THREE.CanvasTexture(canvas);
        this.shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(520, 520),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
        );
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.position.y = -42;
        this.scene.add(this.shadow);
    }

    // --- public API -------------------------------------------------------------------------

    update(input: Partial<StageInput>): void {
        const previousShot = this.input.shot;
        this.input = { ...this.input, ...input };
        if (input.shot && input.shot !== previousShot) {
            // A new lesson starts from a level, untilted drone facing the camera's way.
            this.headingZero = null;
            this.sandboxClock = 0;
            this.orbitAzimuth = 0;
            this.orbitElevation = 0;
            this.orbitZoom = 1;
            this.orbitVelocity = { az: 0, el: 0 };
        }
    }

    /** Dragging orbits the camera around the drone, in any direction. */
    drag(dx: number, dy: number): void {
        this.dragging = true;
        this.orbitVelocity.az = -dx * 0.35;
        this.orbitVelocity.el = dy * 0.25;
        this.orbitAzimuth += this.orbitVelocity.az;
        this.orbitElevation += this.orbitVelocity.el;
    }

    endDrag(): void {
        this.dragging = false;
    }

    /** Wheel or pinch: positive zooms out. */
    zoom(delta: number): void {
        this.orbitZoom = THREE.MathUtils.clamp(this.orbitZoom * Math.exp(delta * 0.0012), 0.5, 1.7);
    }

    private spring(key: string): { v: number } {
        let state = this.springs.get(key);
        if (!state) {
            state = { v: 0 };
            this.springs.set(key, state);
        }
        return state;
    }

    resize(width: number, height: number): void {
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / Math.max(height, 1);
        // Keep the drone filling narrow (portrait) stages too.
        this.camera.fov = this.camera.aspect < 1 ? 32 / Math.max(this.camera.aspect, 0.55) : 32;
        this.camera.updateProjectionMatrix();
    }

    start(): void {
        const loop = () => {
            if (this.disposed) {
                return;
            }
            this.frameId = requestAnimationFrame(loop);
            // Capped so a tab coming back from the background eases in rather than jumping.
            this.frame(Math.min(this.clock.getDelta(), 0.1));
        };
        loop();
    }

    dispose(): void {
        this.disposed = true;
        cancelAnimationFrame(this.frameId);
        this.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
                o.geometry.dispose();
                const materials = Array.isArray(o.material) ? o.material : [o.material];
                for (const m of materials) {
                    (m as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
                    m.dispose();
                }
            }
        });
        this.scene.environment?.dispose();
        this.renderer.dispose();
    }

    // --- per frame --------------------------------------------------------------------------

    private frame(dt: number): void {
        this.time += dt;
        const shot = SHOTS[this.input.shot];

        // A flick keeps turning for a moment after the finger lets go.
        if (!this.dragging) {
            this.orbitAzimuth += this.orbitVelocity.az;
            this.orbitElevation += this.orbitVelocity.el;
            const fade = Math.exp(-6 * dt);
            this.orbitVelocity.az *= fade;
            this.orbitVelocity.el *= fade;
        }
        const elevation = THREE.MathUtils.clamp(shot.orbit.elevation + this.orbitElevation, -8, 88);
        this.orbitElevation = elevation - shot.orbit.elevation;
        orbitPosition(
            {
                ...shot,
                orbit: {
                    azimuth: shot.orbit.azimuth + this.orbitAzimuth,
                    elevation,
                    distance: shot.orbit.distance * this.orbitZoom,
                },
            },
            this.cameraPos,
        );
        this.cameraTarget.set(...shot.target);
        const smooth = this.dragging ? 0.08 : 0.7;
        this.camera.position.set(
            smoothDamp(this.camera.position.x, this.cameraPos.x, this.spring("cx"), smooth, dt),
            smoothDamp(this.camera.position.y, this.cameraPos.y, this.spring("cy"), smooth, dt),
            smoothDamp(this.camera.position.z, this.cameraPos.z, this.spring("cz"), smooth, dt),
        );
        const look = (this.camera.userData.look as THREE.Vector3 | undefined) ?? this.cameraTarget.clone();
        look.set(
            smoothDamp(look.x, this.cameraTarget.x, this.spring("lx"), 0.7, dt),
            smoothDamp(look.y, this.cameraTarget.y, this.spring("ly"), 0.7, dt),
            smoothDamp(look.z, this.cameraTarget.z, this.spring("lz"), 0.7, dt),
        );
        this.camera.userData.look = look;
        this.camera.lookAt(look);

        this.updateExplode(shot, dt);
        this.updateMotion(shot, dt);
        this.updateMotors(shot, dt);
        this.updateOverlays(shot, dt);
        this.updateHighlight(dt);

        this.renderer.render(this.scene, this.camera);
        this.emitAnchors();
    }

    private updateExplode(shot: Shot, dt: number): void {
        for (const key of Object.keys(this.explode) as ExplodeKey[]) {
            this.explode[key] = smoothDamp(
                this.explode[key],
                shot.explode[key] ?? 0,
                this.spring(`e-${key}`),
                0.45,
                dt,
            );
        }
        const amount = this.explode;

        this.lidGroup.position.y = EXPLODE_LIFT.lid * amount.lid;
        this.lidFade = approach(this.lidFade, shot.seeInside ? 0.15 : 1, 3, dt);
        const lidFade = this.lidFade;
        for (const m of this.lidMaterials) {
            m.opacity = lidFade;
            m.depthWrite = lidFade > 0.95;
        }
        this.lidGroup.visible = lidFade > 0.02;

        this.fcGroup.position.y = EXPLODE_LIFT.fc * amount.fc;
        for (const p of this.parts.pdb) {
            p.position.y = EXPLODE_LIFT.pdb * amount.pdb;
        }

        this.slots.forEach((slot) => {
            const out = slot.outward;
            slot.arm.position.copy(out).multiplyScalar((EXPLODE_OUT.arm ?? 0) * amount.arm);
            slot.esc.position
                .copy(out)
                .multiplyScalar((EXPLODE_OUT.esc ?? 0) * amount.esc + (EXPLODE_OUT.arm ?? 0) * amount.arm * 0.5);
            slot.esc.position.y = EXPLODE_LIFT.esc * amount.esc;
            const base = new THREE.Vector3(-MOTOR_MOUNT.offset, MOTOR_MOUNT.top, -MOTOR_MOUNT.offset).applyAxisAngle(
                new THREE.Vector3(0, 1, 0),
                slot.arm.rotation.y,
            );
            slot.motorHolder.position
                .copy(base)
                .addScaledVector(
                    out,
                    (EXPLODE_OUT.motor ?? 0) * amount.motor * 0.6 + (EXPLODE_OUT.arm ?? 0) * amount.arm,
                );
            slot.motorHolder.position.y = MOTOR_MOUNT.top + EXPLODE_LIFT.motor * amount.motor;

            // Phase wires run from the ESC's outer end to the foot of its motor.
            const wiresShown = (this.overlayOpacity.get("wires") ?? 0) > 0.02;
            const across = new THREE.Vector3(-out.z, 0, out.x);
            slot.wires.forEach((wire, i) => {
                wire.visible = wiresShown;
                if (!wiresShown) {
                    return;
                }
                const side = (i - 1) * 3.2;
                const escEnd = new THREE.Vector3(ESC_MOUNT.x, ESC_MOUNT.top + 2.6, ESC_MOUNT.z)
                    .applyAxisAngle(Y_AXIS, slot.angle)
                    .add(slot.esc.position)
                    .addScaledVector(out, 14)
                    .addScaledVector(across, side);
                const motorFoot = slot.motorHolder.position
                    .clone()
                    .addScaledVector(out, -15)
                    .addScaledVector(across, side)
                    .setY(slot.motorHolder.position.y + 3);
                placeWire(wire, escEnd, motorFoot);
            });
        });

        this.receiver.position.y = 3 + EXPLODE_LIFT.receiver * amount.receiver;
        this.receiver.position.z = 33 + (EXPLODE_OUT.receiver ?? 0) * amount.receiver;

        this.batteryShown = approach(this.batteryShown, this.input.batteryIn ? 1 : 0, 3, dt);
        this.battery.position.y = -15 + EXPLODE_LIFT.battery * amount.battery - 70 * (1 - this.batteryShown);
        this.battery.position.x = 260 * (1 - this.batteryShown);
        this.battery.visible = this.batteryShown > 0.02;
        for (const m of this.materials.get("battery") ?? []) {
            m.opacity = this.batteryShown;
        }
    }

    private updateMotion(shot: Shot, dt: number): void {
        let targetRoll = 0;
        let targetPitch = 0;
        let targetAltitude = 0;
        let yawRate = 0;
        const input = this.input;

        if (shot.motion === "live") {
            const { roll, pitch, heading } = input.attitude;
            this.headingZero ??= heading;
            targetRoll = -roll * DEG;
            targetPitch = -pitch * DEG;
            const targetYaw = -(heading - this.headingZero) * DEG;
            this.yaw = angleApproach(this.yaw, targetYaw, 12, dt);
        } else if (shot.motion === "sticks" && input.sticks) {
            const s = input.sticks;
            // Angle mode feel: stick deflection becomes a tilt, yaw stick a turn rate, throttle a height.
            targetRoll = -s.roll * 28 * DEG;
            targetPitch = -s.pitch * 28 * DEG;
            yawRate = -s.yaw * 140 * DEG;
            targetAltitude = Math.max(0, s.throttle - 0.08) * 120;
        } else if (shot.motion === "float") {
            // Resting in the air, breathing slightly: alive without spinning.
            targetAltitude = 12 + Math.sin(this.time * 1.1) * 3;
            targetRoll = Math.sin(this.time * 0.7) * 1.2 * DEG;
            targetPitch = Math.cos(this.time * 0.55) * 1.2 * DEG;
        } else if (shot.motion === "hover") {
            targetAltitude = 70 + Math.sin(this.time * 1.4) * 6;
            targetRoll = Math.sin(this.time * 0.9) * 1.5 * DEG;
            targetPitch = Math.cos(this.time * 0.7) * 1.5 * DEG;
        } else if (shot.motion === "sandbox") {
            const result = this.sandboxStep(dt);
            targetRoll = result.roll;
            targetPitch = result.pitch;
            targetAltitude = result.altitude;
            yawRate = result.yawRate;
        }

        if (shot.motion === "sticks") {
            this.stickYaw += yawRate * dt;
            this.yaw = angleApproach(this.yaw, this.stickYaw, 8, dt);
        } else if (shot.motion === "sandbox") {
            this.stickYaw += yawRate * dt;
            this.yaw = angleApproach(this.yaw, this.stickYaw, 10, dt);
        } else if (shot.motion !== "live") {
            this.stickYaw = 0;
            this.yaw = angleApproach(this.yaw, 0, 3, dt);
        }

        const rate = shot.motion === "live" ? 14 : 4;
        this.roll = approach(this.roll, targetRoll, rate, dt);
        this.pitch = approach(this.pitch, targetPitch, rate, dt);
        this.altitude = approach(this.altitude, targetAltitude, shot.motion === "sandbox" ? 2.2 : 3, dt);

        this.yawGroup.rotation.y = this.yaw;
        this.tiltGroup.rotation.set(this.pitch, 0, this.roll);
        this.lift.position.y = this.altitude;

        // The ghost follows the drone's heading (only roll and pitch are being matched).
        const ghost = input.ghost;
        const ghostTarget = this.input.shot === "gyroGame" && ghost ? (input.ghostMatched ? 0.36 : 0.24) : 0;
        this.ghostMaterial.opacity = approach(this.ghostMaterial.opacity, ghostTarget, 6, dt);
        this.ghostMaterial.color.setHex(input.ghostMatched ? KIT_COLOURS.axisPitch : KIT_COLOURS.accent);
        this.ghostOuter.visible = this.ghostMaterial.opacity > 0.01;
        if (ghost) {
            this.ghostOuter.rotation.y = this.yaw;
            this.ghostOuter.position.y = this.altitude;
            this.ghostInner.rotation.x = smoothDamp(
                this.ghostInner.rotation.x,
                -ghost.pitch * DEG,
                this.spring("gx"),
                0.35,
                dt,
            );
            this.ghostInner.rotation.z = smoothDamp(
                this.ghostInner.rotation.z,
                -ghost.roll * DEG,
                this.spring("gz"),
                0.35,
                dt,
            );
        }

        // The contact shadow fades and spreads as the drone climbs.
        const height = Math.max(0, this.altitude);
        this.shadow.scale.setScalar(1 + height / 260);
        (this.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 1 - height / 200);
    }

    /**
     * Motor-direction sandbox: the four directions decide what happens on take-off. Matching the
     * kit's layout hovers; more props one way than the other spins the body the other way
     * (Newton's third law); balanced but not in diagonal pairs wobbles and flips, because the
     * flight controller's yaw corrections then push the wrong motors.
     */
    private sandboxStep(dt: number): { roll: number; pitch: number; altitude: number; yawRate: number } {
        const sandbox = this.input.sandbox;
        const flying = !!sandbox?.flying;
        if (flying !== this.sandboxFlying) {
            this.sandboxFlying = flying;
            this.sandboxClock = 0;
        }
        this.sandboxClock += dt;
        if (!sandbox || !flying) {
            return { roll: 0, pitch: 0, altitude: 0, yawRate: 0 };
        }
        const t = this.sandboxClock;
        const outcome = sandboxOutcome(sandbox.dirs);
        if (outcome === "stable") {
            return {
                roll: Math.sin(t * 0.9) * 1.5 * DEG,
                pitch: Math.cos(t * 0.8) * 1.5 * DEG,
                altitude: 110 + Math.sin(t * 1.3) * 5,
                yawRate: 0,
            };
        }
        if (outcome === "spinCcw" || outcome === "spinCw") {
            const sign = outcome === "spinCcw" ? 1 : -1;
            return {
                roll: Math.sin(t * 5) * 4 * DEG,
                pitch: Math.cos(t * 4.3) * 4 * DEG,
                altitude: 70,
                yawRate: sign * Math.min(9, 1.5 + t * 3),
            };
        }
        // Unstable: a growing wobble, then it rolls over and drops onto its back.
        if (t < 1.6) {
            const wobble = Math.min(1, t / 1.6) * 22 * DEG;
            return { roll: Math.sin(t * 9) * wobble, pitch: Math.cos(t * 7) * wobble * 0.8, altitude: 55, yawRate: 0 };
        }
        const fall = Math.min(1, (t - 1.6) / 0.7);
        return { roll: fall * 170 * DEG, pitch: 10 * DEG * fall, altitude: 55 * (1 - fall) + 40 * fall, yawRate: 0 };
    }

    private updateMotors(shot: Shot, dt: number): void {
        const input = this.input;
        this.propsShown = approach(this.propsShown, input.propsOn ? 1 : 0, 3, dt);

        let poweredSpeed = 0;
        if (shot.motion === "hover") {
            poweredSpeed = 1;
        } else if (shot.motion === "sandbox" && this.sandboxFlying) {
            poweredSpeed = 1;
        } else if (shot.motion === "sticks" && input.sticks && input.sticks.throttle > 0.08) {
            poweredSpeed = 0.5 + input.sticks.throttle * 0.5;
        }

        for (const slot of this.slots) {
            const revealed = input.revealedMotors.includes(slot.number);
            const realSpin = input.spinningMotor === slot.number;
            const sandboxDirection = input.sandbox?.dirs[slot.number];
            const direction = shot.motion === "sandbox" && sandboxDirection ? sandboxDirection : slot.direction;

            // Real motor test: until the participant has answered, the drawing must not show which
            // way the motor should turn, so the bell only shivers.
            let target = poweredSpeed * 60;
            if (realSpin) {
                target = revealed ? 9 : 0;
            }
            slot.spinSpeed = approach(slot.spinSpeed, target, target > slot.spinSpeed ? 2.5 : 1.6, dt);
            const sign = direction === "cw" ? -1 : 1; // positive rotation.y is counter-clockwise from above
            slot.spinAngle += sign * slot.spinSpeed * dt;
            slot.motor.rotor.rotation.y = slot.spinAngle;
            const shiver = realSpin && !revealed ? Math.sin(this.time * 90) * 0.6 : 0;
            slot.motor.group.position.x = shiver;

            const fast = slot.spinSpeed > 25;
            const blurMaterial = slot.blur.material as THREE.MeshBasicMaterial;
            blurMaterial.opacity = approach(blurMaterial.opacity, fast ? 0.16 * this.propsShown : 0, 6, dt);
            slot.prop.visible = this.propsShown > 0.02 && !fast;
            slot.propHolder.position.y = (1 - this.propsShown) * 70;
            slot.prop.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    (o.material as THREE.MeshStandardMaterial).opacity = this.propsShown;
                }
            });

            const showArrows = (this.overlayOpacity.get("spinArrows") ?? 0) > 0.02;
            const arrowDirection = shot.motion === "sandbox" ? direction : slot.direction;
            const showThis = showArrows && (shot.motion === "sandbox" || revealed);
            slot.arrows.cw.visible = showThis && arrowDirection === "cw";
            slot.arrows.ccw.visible = showThis && arrowDirection === "ccw";

            const ringMaterial = slot.ring.material as THREE.MeshBasicMaterial;
            const ringTarget =
                input.selectedMotor === slot.number ? 0.9 : realSpin ? 0.6 + Math.sin(this.time * 8) * 0.3 : 0;
            ringMaterial.opacity = approach(ringMaterial.opacity, shot.motion === "rest" ? ringTarget : 0, 8, dt);
            ringMaterial.transparent = true;
        }
    }

    private updateOverlays(shot: Shot, dt: number): void {
        for (const [key, value] of this.overlayOpacity) {
            this.overlayOpacity.set(key, approach(value, shot.overlays.includes(key) ? 1 : 0, 4, dt));
        }
        const o = (key: Overlay) => this.overlayOpacity.get(key) ?? 0;

        // Gyro: the rings follow the drone, and each ring brightens with motion about its axis.
        const gimbal = o("gimbal");
        this.gimbal.group.visible = gimbal > 0.02;
        this.gimbal.group.scale.setScalar(0.6 + 0.4 * gimbal);
        const activity = [Math.abs(this.roll), Math.abs(this.pitch), 0];
        (this.gimbal.roll.material as THREE.MeshBasicMaterial).opacity =
            gimbal * (0.45 + Math.min(0.55, activity[0] * 3));
        (this.gimbal.pitch.material as THREE.MeshBasicMaterial).opacity =
            gimbal * (0.45 + Math.min(0.55, activity[1] * 3));
        (this.gimbal.yaw.material as THREE.MeshBasicMaterial).opacity = gimbal * 0.7;

        const chip = o("chip");
        (this.chip.material as THREE.MeshBasicMaterial).opacity = chip * (0.6 + Math.sin(this.time * 4) * 0.4);
        (this.chip.material as THREE.MeshBasicMaterial).transparent = true;

        // Accelerometer: gravity always points straight down, whatever the drone does.
        const gravity = o("gravity");
        this.gravity.visible = gravity > 0.02;
        this.gravity.position.set(0, 18 + this.altitude, 0);
        this.gravity.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                (child.material as THREE.MeshBasicMaterial).opacity = gravity * 0.95;
                (child.material as THREE.MeshBasicMaterial).transparent = true;
            }
        });

        // Alignment: the ghost arrow sweeps 270 degrees clockwise from the nose to the real arrow.
        const align = o("align");
        this.alignShown = approach(this.alignShown, this.input.alignTurn, 1.4, dt);
        this.alignGhost.rotation.y = -this.alignShown * 270 * DEG;
        (this.alignGhost.material as THREE.MeshBasicMaterial).opacity = align * 0.95;
        (this.alignReal.material as THREE.MeshBasicMaterial).opacity = align * 0.55;
        (this.frontArrow.material as THREE.MeshBasicMaterial).opacity = align * 0.85;
        for (const m of [this.alignGhost, this.alignReal, this.frontArrow]) {
            (m.material as THREE.MeshBasicMaterial).transparent = true;
            m.visible = align > 0.02;
        }

        const waves = o("waves");
        this.waves.visible = waves > 0.02;
        updateWaves(this.waves, this.time, 70);
        this.waves.scale.setScalar(waves);

        for (const slot of this.slots) {
            for (const arrow of Object.values(slot.arrows)) {
                arrow.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        (child.material as THREE.MeshBasicMaterial).opacity = o("spinArrows") * 0.95;
                        (child.material as THREE.MeshBasicMaterial).transparent = true;
                    }
                });
            }
        }
    }

    private updateHighlight(dt: number): void {
        const pulse = 0.35 + Math.sin(this.time * 3) * 0.15;
        for (const [part, list] of this.materials) {
            const target = this.input.highlight === part ? pulse : 0;
            for (const m of list) {
                m.emissiveIntensity = approach(m.emissiveIntensity, target, 8, dt);
            }
        }
    }

    private emitAnchors(): void {
        if (!this.onAnchors) {
            return;
        }
        const show = (this.overlayOpacity.get("labels") ?? 0) > 0.5;
        const width = this.renderer.domElement.clientWidth;
        const height = this.renderer.domElement.clientHeight;
        const anchors: LabelAnchor[] = [];
        for (const part of KIT_PARTS) {
            const marker = this.anchors.get(part);
            if (!marker) {
                continue;
            }
            marker.getWorldPosition(this.projected);
            this.projected.project(this.camera);
            anchors.push({
                part,
                x: (this.projected.x * 0.5 + 0.5) * width,
                y: (-this.projected.y * 0.5 + 0.5) * height,
                visible: show && this.projected.z < 1,
            });
        }
        this.onAnchors(anchors);
    }
}
