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

import { describe, expect, it } from "vitest";
import { COMMUTATION, escTurnDirection, fieldAngle } from "../../src/dronobox/esc";

describe("six-step switching", () => {
    it("puts one wire on plus, one on minus and leaves one off in every step", () => {
        for (const levels of COMMUTATION) {
            expect([...levels].sort()).toEqual([-1, 0, 1]);
        }
    });

    it("changes one wire at a time from step to step", () => {
        for (let step = 0; step < 6; step++) {
            const now = COMMUTATION[step];
            const next = COMMUTATION[(step + 1) % 6];
            expect(now.filter((level, wire) => level !== next[wire])).toHaveLength(2);
            expect(now.filter((level, wire) => level === next[wire])).toHaveLength(1);
        }
    });

    const turn = (step: number, swapped: boolean, direction: "cw" | "ccw") => {
        const delta = (fieldAngle(step + 1, swapped, direction) - fieldAngle(step, swapped, direction) + 540) % 360;
        return Math.round(delta - 180);
    };

    it("turns the pull a sixth of a turn per step, in the motor's own direction", () => {
        for (let step = 0; step < 6; step++) {
            expect(turn(step, false, "ccw")).toBe(60);
            expect(turn(step, false, "cw")).toBe(-60);
        }
    });

    it("runs the pull the other way round with two wires swapped", () => {
        for (let step = 0; step < 6; step++) {
            expect(turn(step, true, "ccw")).toBe(-60);
            expect(turn(step, true, "cw")).toBe(60);
        }
        expect(escTurnDirection("ccw", true)).toBe("cw");
        expect(escTurnDirection("ccw", false)).toBe("ccw");
    });
});
