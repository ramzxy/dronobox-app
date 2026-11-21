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
import { DRONOBOX_KIT, type SpinDirection } from "../../src/dronobox/kit";
import { sandboxOutcome } from "../../src/dronobox/sandbox";
import { useDronoBoxStore } from "../../src/stores/dronobox";

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

            expect(store.canOpen("spin")).toBe(false);
            store.goTo("spin");
            expect(store.step).toBe("meet");

            for (const step of ["meet", "gyro", "align", "level", "motors", "safety"] as const) {
                store.completeAndAdvance(step);
            }
            expect(store.step).toBe("spin");
            expect(store.canOpen("done")).toBe(false);
        });

        it("lets an unlocked instructor jump to any step", () => {
            const store = useDronoBoxStore();

            expect(store.unlock("wrong")).toBe(false);
            expect(store.unlock(DRONOBOX_KIT.instructorPin)).toBe(true);
            store.goTo("spin");

            expect(store.step).toBe("spin");
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
        store.completeAndAdvance("meet");
        store.completeAndAdvance("gyro");
        await Promise.resolve();

        setActivePinia(createPinia());
        const restored = useDronoBoxStore();

        expect(restored.step).toBe("align");
        expect(restored.isCompleted("gyro")).toBe(true);
    });
});

describe("sandboxOutcome", () => {
    const layout = (pick: (motor: (typeof DRONOBOX_KIT.motors)[number]) => SpinDirection) =>
        Object.fromEntries(DRONOBOX_KIT.motors.map((m) => [m.number, pick(m)])) as Record<number, SpinDirection>;

    it("hovers with the kit's own layout", () => {
        expect(sandboxOutcome(layout((m) => m.direction))).toBe("stable");
    });

    it("spins the body against the side with more props", () => {
        expect(sandboxOutcome(layout(() => "cw"))).toBe("spinCcw");
        expect(sandboxOutcome(layout(() => "ccw"))).toBe("spinCw");
    });

    it("flips when the torques balance but the pairs are not diagonal", () => {
        expect(sandboxOutcome(layout((m) => (m.position.endsWith("Left") ? "cw" : "ccw")))).toBe("unstable");
    });

    it("flips with every motor reversed: balanced, but the flight controller's yaw works backwards", () => {
        expect(sandboxOutcome(layout((m) => (m.direction === "cw" ? "ccw" : "cw")))).toBe("unstable");
    });
});
