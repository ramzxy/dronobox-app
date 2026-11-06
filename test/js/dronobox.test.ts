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
import { createPinia, setActivePinia } from "pinia";
import { decodeArmingFlags } from "../../src/dronobox/armingReasons";
import { DRONOBOX_KIT } from "../../src/dronobox/kit";
import { useDronoBoxStore } from "../../src/stores/dronobox";

describe("decodeArmingFlags", () => {
    it("names the last bit ARM_SWITCH whatever the flag count", () => {
        expect(decodeArmingFlags("1.46.0", 26, 1 << 25)).toEqual(["ARM_SWITCH"]);
        expect(decodeArmingFlags("1.47.0", 29, 1 << 28)).toEqual(["ARM_SWITCH"]);
    });

    it("reports the laptop connection and lost radio by name", () => {
        expect(decodeArmingFlags("1.46.0", 26, (1 << 2) | (1 << 16))).toEqual(["RXLOSS", "MSP"]);
    });

    it("renames the RPM filter flag from API 1.46", () => {
        expect(decodeArmingFlags("1.45.0", 26, 1 << 20)).toEqual(["RPMFILTER"]);
        expect(decodeArmingFlags("1.46.0", 26, 1 << 20)).toEqual(["DSHOT_TELEM"]);
    });

    it("returns nothing before the FC has reported its API version", () => {
        expect(decodeArmingFlags(undefined, 26, 0xffff)).toEqual([]);
        expect(decodeArmingFlags("", 26, 0xffff)).toEqual([]);
    });
});

describe("useDronoBoxStore", () => {
    beforeEach(() => {
        sessionStorage.clear();
        setActivePinia(createPinia());
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("in a production build", () => {
        beforeEach(() => {
            vi.stubEnv("DEV", false);
        });

        it("keeps later steps closed until the earlier ones are done", () => {
            const store = useDronoBoxStore();

            expect(store.canOpen("motors")).toBe(false);
            store.goTo("motors");
            expect(store.step).toBe("gyro");

            for (const step of ["gyro", "align", "level", "safety"] as const) {
                store.completeAndAdvance(step);
            }
            expect(store.step).toBe("motors");
            expect(store.canOpen("radio")).toBe(false);
        });

        it("lets an unlocked instructor jump to any step", () => {
            const store = useDronoBoxStore();

            expect(store.unlock("wrong")).toBe(false);
            expect(store.unlock(DRONOBOX_KIT.instructorPin)).toBe(true);
            store.goTo("radio");

            expect(store.step).toBe("radio");
            expect(store.workshopLocked).toBe(false);
        });
    });

    it("lets a dev build skip ahead without the PIN", () => {
        vi.stubEnv("DEV", true);
        const store = useDronoBoxStore();

        store.goTo("done");

        expect(store.step).toBe("done");
        expect(store.workshopLocked).toBe(true);
    });

    it("marks a motor answer against the kit's motor map", () => {
        const store = useDronoBoxStore();
        const [first] = DRONOBOX_KIT.motors;
        const wrong = first.direction === "cw" ? "ccw" : "cw";

        store.recordMotor(first.number, first.direction);
        expect(store.motors[first.number].correct).toBe(true);

        store.recordMotor(first.number, wrong);
        expect(store.motors[first.number].correct).toBe(false);

        store.resetMotor(first.number);
        expect(store.motors[first.number]).toEqual({ answer: null, correct: null });
    });

    it("restores progress after the tab remounts, e.g. after a save and reboot", async () => {
        const store = useDronoBoxStore();
        store.completeAndAdvance("gyro");
        await Promise.resolve();

        setActivePinia(createPinia());
        const restored = useDronoBoxStore();

        expect(restored.step).toBe("align");
        expect(restored.isCompleted("gyro")).toBe(true);
    });
});
