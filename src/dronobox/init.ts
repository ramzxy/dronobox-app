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

import { get as getConfig, set as setConfig } from "../js/ConfigStorage";
import DeviceHandler from "../js/device_handler";

/**
 * Defaults the DronoBox fork changes on a laptop's first run. Runs before analytics and the
 * first-run dialog read them; a choice someone made later in Options is left alone.
 */
export function applyDronoBoxDefaults(): void {
    // Plugging the drone in connects it, and the app reconnects by itself after the reboot
    // that follows "Set CW 270° and save". DeviceHandler read the stored value at import time,
    // so it is updated directly as well.
    if (getConfig("autoConnect").autoConnect === undefined) {
        setConfig({ autoConnect: true });
        DeviceHandler.devicePicker.autoConnect = true;
    }
    // Upstream collects usage statistics unless the user opts out. Workshop participants are
    // often minors using school laptops, so this build starts opted out.
    if (getConfig("analyticsOptOut").analyticsOptOut === undefined) {
        setConfig({ analyticsOptOut: true });
    }
    // The first-run Options dialog asks questions a participant cannot answer.
    if (getConfig("firstRun").firstRun === undefined) {
        setConfig({ firstRun: true });
    }
}
