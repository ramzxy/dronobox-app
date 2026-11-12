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

import { DRONOBOX_KIT, type SpinDirection } from "@/dronobox/kit";

export type SandboxOutcome = "stable" | "spinCw" | "spinCcw" | "unstable";

/** What happens on take-off with these motor directions. Exported for the lesson text and tests. */
export function sandboxOutcome(dirs: Record<number, SpinDirection>): SandboxOutcome {
    const kit = DRONOBOX_KIT.motors;
    if (kit.every((m) => dirs[m.number] === m.direction)) {
        return "stable";
    }
    // Each prop twists the body the opposite way to its own spin.
    const net = kit.reduce((sum, m) => sum + (dirs[m.number] === "cw" ? 1 : -1), 0);
    if (net > 0) {
        return "spinCcw";
    }
    if (net < 0) {
        return "spinCw";
    }
    return "unstable";
}
