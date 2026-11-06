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

import semver from "semver";
import { API_VERSION_1_46, API_VERSION_1_47, API_VERSION_1_48 } from "@/js/data_storage";

// Bit order of armingDisableFlags, as the Setup tab decodes it (SetupTab.vue prepareDisarmFlags).
// Kept as a copy so the fork does not have to touch SetupTab; re-check it when firmware adds flags.
const BASE_FLAGS = [
    "NO_GYRO",
    "FAILSAFE",
    "RXLOSS",
    "BAD_RX_RECOVERY",
    "BOXFAILSAFE",
    "RUNAWAY_TAKEOFF",
    "CRASH_DETECTED",
    "THROTTLE",
    "ANGLE",
    "BOOT_GRACE_TIME",
    "NOPREARM",
    "LOAD",
    "CALIBRATING",
    "CLI",
    "CMS_MENU",
    "BST",
    "MSP",
    "PARALYZE",
    "GPS",
    "RESC",
    "RPMFILTER",
    "REBOOT_REQUIRED",
    "DSHOT_BITBANG",
    "ACC_CALIBRATION",
    "MOTOR_PROTOCOL",
];

/** Flags with a beginner explanation in the dronobox locale files. The rest show their raw name. */
export const EXPLAINED_FLAGS = new Set([
    "NO_GYRO",
    "FAILSAFE",
    "RXLOSS",
    "THROTTLE",
    "ANGLE",
    "BOOT_GRACE_TIME",
    "NOPREARM",
    "CALIBRATING",
    "CLI",
    "MSP",
    "ACC_CALIBRATION",
    "MOTOR_PROTOCOL",
    "REBOOT_REQUIRED",
    "ARM_SWITCH",
    "LOAD",
]);

/** "MSP" only means the laptop is connected; it is expected during the whole workshop. */
export const EXPECTED_WHILE_CONNECTED = new Set(["MSP"]);

function flagNames(apiVersion: string, count: number): string[] {
    const names = [...BASE_FLAGS];
    if (semver.gte(apiVersion, API_VERSION_1_46)) {
        names[names.indexOf("RPMFILTER")] = "DSHOT_TELEM";
    }
    if (semver.gte(apiVersion, API_VERSION_1_47)) {
        names.splice(names.indexOf("MOTOR_PROTOCOL") + 1, 0, "CRASHFLIP", "ALTHOLD", "POSHOLD");
    }
    if (semver.gte(apiVersion, API_VERSION_1_48)) {
        names.splice(names.indexOf("POSHOLD") + 1, 0, "AUTOPILOT");
    }
    return Array.from({ length: count }, (_, i) => (i === count - 1 ? "ARM_SWITCH" : (names[i] ?? `${i + 1}`)));
}

/** Names of the arming-disable flags set in `flags`, in bit order. */
export function decodeArmingFlags(apiVersion: string | undefined, count: number, flags: number): string[] {
    if (!apiVersion || !semver.valid(apiVersion) || count <= 0) {
        return [];
    }
    const names = flagNames(apiVersion, count);
    return names.filter((_, bit) => (flags & (1 << bit)) !== 0);
}
