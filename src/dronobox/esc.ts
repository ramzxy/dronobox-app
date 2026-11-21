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

/** The six-step switching an ESC uses to turn a motor, for the ESC lesson's drawing. */

import type { SpinDirection } from "./kit";

/**
 * Six-step drive: in each step, the level on ESC outputs A, B and C.
 * 1 is switched to battery plus, -1 to minus, 0 is left off.
 */
export const COMMUTATION: readonly (readonly [number, number, number])[] = [
    [1, -1, 0],
    [1, 0, -1],
    [0, 1, -1],
    [-1, 1, 0],
    [-1, 0, 1],
    [0, -1, 1],
];

export function commutationStep(step: number): readonly [number, number, number] {
    return COMMUTATION[((step % 6) + 6) % 6];
}

/** Which ESC output reaches coil `coil` (0..2). Swapping wires A and B crosses the first two. */
export function wireForCoil(coil: number, swapped: boolean): number {
    return swapped && coil < 2 ? 1 - coil : coil;
}

/**
 * Where coil `coil` sits around the motor, in degrees, counter-clockwise seen from above. The
 * coils are laid out so that A, B, C in order turns the motor its own way.
 */
export function coilAngle(coil: number, direction: SpinDirection): number {
    return 90 + (direction === "ccw" ? 1 : -1) * coil * 120;
}

/** Direction of the pull the coils make in this step, in degrees, counter-clockwise from above. */
export function fieldAngle(step: number, swapped: boolean, direction: SpinDirection): number {
    const levels = commutationStep(step);
    let x = 0;
    let y = 0;
    for (let coil = 0; coil < 3; coil++) {
        const level = levels[wireForCoil(coil, swapped)];
        const angle = (coilAngle(coil, direction) * Math.PI) / 180;
        x += level * Math.cos(angle);
        y += level * Math.sin(angle);
    }
    return ((((Math.atan2(y, x) * 180) / Math.PI) % 360) + 360) % 360;
}

/** Which way the motor turns: its own direction, or the other way with two wires swapped. */
export function escTurnDirection(direction: SpinDirection, swapped: boolean): SpinDirection {
    if (!swapped) {
        return direction;
    }
    return direction === "cw" ? "ccw" : "cw";
}
