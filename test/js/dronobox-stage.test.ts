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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { KitStage } from "../../src/dronobox/stage/KitStage";
import type { KitGeometries } from "../../src/dronobox/stage/kitMesh";

vi.mock("three", async (original) => {
    const three = await original<typeof import("three")>();
    return {
        ...three,
        WebGLRenderer: class {
            domElement: HTMLCanvasElement;
            render = vi.fn();
            setPixelRatio = vi.fn();
            setSize = vi.fn();
            setClearColor = vi.fn();
            dispose = vi.fn();
            constructor({ canvas }: { canvas: HTMLCanvasElement }) {
                this.domElement = canvas;
            }
        },
        PMREMGenerator: class {
            fromScene() {
                return { texture: new three.Texture(), dispose: vi.fn() };
            }
            dispose() {}
        },
    };
});

describe("DronoBox scene lifecycle", () => {
    let stage: KitStage;
    let geometries: KitGeometries;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
            setTimeout(() => callback(performance.now()), 8),
        );
        vi.stubGlobal("cancelAnimationFrame", clearTimeout);
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
        geometries = {
            body: new THREE.BoxGeometry(),
            arm: new THREE.BoxGeometry(),
            esc: new THREE.BoxGeometry(),
            lid: new THREE.BoxGeometry(),
            latches: new THREE.BoxGeometry(),
            fc: new THREE.BoxGeometry(),
            pdb: new THREE.BoxGeometry(),
            standoffs: new THREE.BoxGeometry(),
            screws: new THREE.BoxGeometry(),
        };
        stage = new KitStage(document.createElement("canvas"), geometries);
    });

    afterEach(() => {
        stage.dispose();
        Object.values(geometries).forEach((geometry) => geometry.dispose());
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("stops rendering a settled lesson and wakes on zoom", () => {
        stage.update({ shot: "meet" });
        stage.start();
        vi.advanceTimersByTime(3000);
        const frames = vi.mocked(stage.renderer.render).mock.calls.length;
        expect(frames).toBeGreaterThan(1);
        vi.advanceTimersByTime(1000);
        expect(stage.renderer.render).toHaveBeenCalledTimes(frames);
        stage.zoom(-100);
        vi.advanceTimersByTime(100);
        expect(vi.mocked(stage.renderer.render).mock.calls.length).toBeGreaterThan(frames);
    });

    it("lets the welcome drone come to rest instead of bobbing forever", () => {
        stage.update({ shot: "hero" });
        stage.start();
        vi.advanceTimersByTime(3000);
        const frames = vi.mocked(stage.renderer.render).mock.calls.length;
        vi.advanceTimersByTime(1000);
        expect(stage.renderer.render).toHaveBeenCalledTimes(frames);
    });

    it("follows the real drone on a non-gyro lesson, ignoring sensor jitter", () => {
        const tilt = (stage as unknown as { tiltGroup: THREE.Group }).tiltGroup;
        stage.update({ shot: "safety", liveTilt: true, attitude: { roll: 0, pitch: 0, heading: 0 } });
        stage.start();
        vi.advanceTimersByTime(3000);
        const frames = vi.mocked(stage.renderer.render).mock.calls.length;

        stage.update({ attitude: { roll: 0.05, pitch: -0.05, heading: 0.1 } });
        vi.advanceTimersByTime(500);
        expect(stage.renderer.render).toHaveBeenCalledTimes(frames);

        stage.update({ attitude: { roll: 20, pitch: 0, heading: 0 } });
        vi.advanceTimersByTime(1000);
        expect(vi.mocked(stage.renderer.render).mock.calls.length).toBeGreaterThan(frames);
        expect(tilt.rotation.z).toBeCloseTo((-20 * Math.PI) / 180, 2);
    });

    it("does no rendering while hidden, even when new inputs arrive", () => {
        stage.start();
        vi.advanceTimersByTime(100);
        stage.stop();
        const frames = vi.mocked(stage.renderer.render).mock.calls.length;
        stage.update({ shot: "axes", axisDemo: { axis: "roll", angle: 30 } });
        vi.advanceTimersByTime(1000);
        expect(stage.renderer.render).toHaveBeenCalledTimes(frames);
        stage.start();
        vi.advanceTimersByTime(100);
        expect(vi.mocked(stage.renderer.render).mock.calls.length).toBeGreaterThan(frames);
    });

    it("settles the welcome animation with reduced motion", () => {
        stage.setReducedMotion(true);
        stage.start();
        vi.advanceTimersByTime(3000);
        const frames = vi.mocked(stage.renderer.render).mock.calls.length;
        vi.advanceTimersByTime(1000);
        expect(stage.renderer.render).toHaveBeenCalledTimes(frames);
    });

    it("keeps shared CAD geometry alive across scene disposal and cancels scheduled work", () => {
        const release = vi.spyOn(geometries.arm, "dispose");
        stage.start();
        stage.dispose();
        expect(release).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(stage.renderer.render).not.toHaveBeenCalled();
    });
});
