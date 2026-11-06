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

/**
 * Facts about the DronoBox V2 kit the workshop flow checks against. Taken from the
 * DronoBox V2 Kit Assembly manual ("Drone Bible") and the 2026 workshop deck.
 */

export type SpinDirection = "cw" | "ccw";

export interface KitMotor {
    /** Betaflight motor number, 1-based. */
    number: number;
    position: "backRight" | "frontRight" | "backLeft" | "frontLeft";
    direction: SpinDirection;
}

export const DRONOBOX_KIT = {
    name: "DronoBox V2",

    /** The FC sits 270 degrees clockwise from its default orientation in the printed body. */
    gyroAlignCli: "CW270",
    /** Same value as an index into MSP_SENSOR_ALIGNMENT (0 = default, 1 = CW0 ... 4 = CW270). */
    gyroAlignMsp: 4,

    /** Standard Betaflight quad X layout, props-in. */
    motors: [
        { number: 1, position: "backRight", direction: "cw" },
        { number: 2, position: "frontRight", direction: "ccw" },
        { number: 3, position: "backLeft", direction: "ccw" },
        { number: 4, position: "frontLeft", direction: "cw" },
    ] satisfies KitMotor[],

    /** Throttle sent while a participant holds a motor's spin button: about 10%, enough to see it turn. */
    motorTestOffset: 100,

    /** Below this the battery is treated as unplugged (USB alone reads close to 0 V). */
    batteryPresentVolts: 6,

    /**
     * Soft lock for the full Betaflight interface. It keeps curious hands out of PID tuning
     * during a workshop; it is not a security boundary. Change it per event if needed.
     */
    instructorPin: "0063",

    /**
     * The team's known-good configuration, applied by "Reset kit" in instructor mode.
     * Paste the output of `diff all` from a working kit here, one CLI line per entry, without
     * the trailing `save`. Left empty on purpose: a wrong baseline is worse than none.
     */
    baselineCli: [] as string[],

    /** GPL-3.0: the hosted app has to point at its source. */
    sourceUrl: "https://github.com/ramzxy/dronobox-app",
} as const;
