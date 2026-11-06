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

import { computed, ref } from "vue";
import semver from "semver";
import MSP from "@/js/msp";
import MSPCodes from "@/js/msp/MSPCodes";
import { mspHelper } from "@/js/msp/MSPHelper";
import { bit_check } from "@/js/bit";
import EscProtocols from "@/js/utils/EscProtocols";
import { API_VERSION_1_47 } from "@/js/data_storage";
import DeviceHandler from "@/js/device_handler";
import { useFlightControllerStore } from "@/stores/fc";
import { useConnectionStore } from "@/stores/connection";
import { useInterval } from "@/composables/useInterval";
import { useReboot } from "@/composables/useReboot";
import { runTabLoad } from "@/composables/useTabLoad";
import { useMotorsData } from "@/composables/motors/useMotorsData";
import { useMotorTesting } from "@/composables/motors/useMotorTesting";
import { computeZeroThrottleValue } from "@/composables/motors/useMotorStopValue";
import {
    findCliError,
    findCliSettingValue,
    isMspCliSupported,
    saveAndReconnect,
    send as sendCli,
    useMspCliSession,
} from "@/composables/useMspCliSession";
import { DRONOBOX_KIT } from "@/dronobox/kit";
import { decodeArmingFlags } from "@/dronobox/armingReasons";

// Index = value of gyro_1_align in MSP_SENSOR_ALIGNMENT (API < 1.47), name = CLI value.
const MSP_ALIGN_NAMES = ["DEFAULT", "CW0", "CW90", "CW180", "CW270", "CW0FLIP", "CW90FLIP", "CW180FLIP", "CW270FLIP"];
const DIGITAL_PROTOCOLS = new Set(["DSHOT150", "DSHOT300", "DSHOT600", "PROSHOT1000"]);
const ACC_NEEDS_CALIBRATION_BIT = 0;
// The MCU is busy for about two seconds while it averages the accelerometer.
const ACC_CALIBRATION_MS = 2500;
const ATTITUDE_POLL_MS = 50;
const RC_POLL_MS = 50;

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Betaflight only reconnects after a save-and-reboot while Auto-Connect is on. Someone may have
 * unticked it, and a participant left on the welcome page mid-flow would not know to press
 * Connect again, so a DronoBox save turns it on for the rest of this session (not persisted).
 */
function keepConnectionThroughReboot(): void {
    DeviceHandler.devicePicker.autoConnect = true;
}

// The virtual FC resets its whole config on every connect, so a saved alignment would read back
// as DEFAULT and the step could never be finished without a board. Remember what was written.
let virtualAlignment: string | null = null;

/**
 * Everything the DronoBox guided tab asks of the flight controller. Must be called from a
 * component's setup: the motor test and the intervals tear themselves down on unmount.
 * @param showWarning shown when the motor test refuses to start
 */
export function useDronoBoxFc(showWarning: (message: string) => void) {
    const fcStore = useFlightControllerStore();
    const connectionStore = useConnectionStore();
    const { addInterval, removeInterval } = useInterval();
    const { saveAndReboot } = useReboot();
    const { loadMotorsData } = useMotorsData();
    const cliSession = useMspCliSession();

    const apiVersion = computed(() => fcStore.config.apiVersion);
    const alignmentViaCli = computed(() => !!apiVersion.value && semver.gte(apiVersion.value, API_VERSION_1_47));

    const loaded = ref(false);

    // --- live data ---------------------------------------------------------------------------

    const attitude = computed(() => ({
        roll: fcStore.sensorData.kinematics[0] ?? 0,
        pitch: fcStore.sensorData.kinematics[1] ?? 0,
        heading: fcStore.sensorData.kinematics[2] ?? 0,
    }));
    const batteryVolts = computed(() => fcStore.analogData.voltage ?? 0);
    const batteryPresent = computed(() => batteryVolts.value >= DRONOBOX_KIT.batteryPresentVolts);
    // MSP_RC reports channels after the receiver map: roll, pitch, yaw, throttle, then AUX.
    const rcChannels = computed(() => fcStore.rc.channels.slice(0, Math.max(fcStore.rc.active_channels, 0)));
    const armingReasons = computed(() =>
        decodeArmingFlags(
            fcStore.config.apiVersion,
            fcStore.config.armingDisableCount,
            fcStore.config.armingDisableFlags,
        ),
    );

    function startAttitudePolling(): void {
        addInterval(
            "dronobox_attitude",
            () => MSP.send_message(MSPCodes.MSP_ATTITUDE, false, false),
            ATTITUDE_POLL_MS,
            true,
        );
    }

    function stopAttitudePolling(): void {
        removeInterval("dronobox_attitude");
    }

    function startRcPolling(): void {
        addInterval("dronobox_rc", () => MSP.send_message(MSPCodes.MSP_RC, false, false), RC_POLL_MS, true);
    }

    function stopRcPolling(): void {
        removeInterval("dronobox_rc");
    }

    // --- motor stop state (same rules as the Motors tab) ----------------------------------------

    const isDigitalProtocol = ref(false);
    const is3dEnabled = ref(false);
    const motor3dNeutral = ref(1500);
    const motorMincommand = ref(1000);
    const motorStateReady = ref(false);

    function snapshotMotorState(): void {
        const name = EscProtocols.GetProtocolName(apiVersion.value, fcStore.pidAdvancedConfig.fast_pwm_protocol);
        isDigitalProtocol.value = !!name && DIGITAL_PROTOCOLS.has(name);
        is3dEnabled.value = fcStore.features.features?.isEnabled("3D") ?? false;
        motor3dNeutral.value = fcStore.motor3dConfig.neutral;
        motorMincommand.value = fcStore.motorConfig.mincommand;
    }

    const zeroThrottle = computed(() =>
        computeZeroThrottleValue(
            is3dEnabled.value,
            isDigitalProtocol.value,
            motor3dNeutral.value,
            isDigitalProtocol.value ? 1000 : motorMincommand.value,
        ),
    );

    // The guided flow never edits motor settings, so the "unsaved changes" guard stays false.
    const configHasChanged = ref(false);
    const { motorsTestingEnabled, sendMotorCommand, isArmed } = useMotorTesting(
        configHasChanged,
        showWarning,
        isDigitalProtocol,
        zeroThrottle,
    );
    const spinningMotor = ref<number | null>(null);

    function spinMotor(number: number): void {
        if (!motorsTestingEnabled.value || !motorStateReady.value || isArmed.value) {
            return;
        }
        const values = new Array<number>(8).fill(zeroThrottle.value);
        values[number - 1] = zeroThrottle.value + DRONOBOX_KIT.motorTestOffset;
        sendMotorCommand(values);
        spinningMotor.value = number;
    }

    function stopMotors(): void {
        sendMotorCommand(new Array<number>(8).fill(zeroThrottle.value));
        spinningMotor.value = null;
    }

    // --- load ----------------------------------------------------------------------------------

    async function load(): Promise<boolean> {
        const ok = await runTabLoad(
            async () => {
                await MSP.promise(MSPCodes.MSP_SENSOR_ALIGNMENT);
                await MSP.promise(MSPCodes.MSP_BOARD_INFO);
                // Mixer, motor and feature config, then the ESC protocol from MSP_ADVANCED_CONFIG.
                await loadMotorsData(snapshotMotorState);
                return true;
            },
            (error) => console.error("DronoBox: loading flight controller data failed", error),
        );
        motorStateReady.value = ok === true;
        loaded.value = ok === true;
        if (ok) {
            await readAlignment();
        }
        return ok === true;
    }

    // --- board alignment -----------------------------------------------------------------------

    /** CLI-style name of gyro 1's alignment ("CW270"), or null when it could not be read. */
    const alignment = ref<string | null>(null);
    const alignmentIsKit = computed(() => alignment.value === DRONOBOX_KIT.gyroAlignCli);
    const alignmentBusy = ref(false);

    async function readAlignment(): Promise<void> {
        if (connectionStore.virtualMode && virtualAlignment) {
            alignment.value = virtualAlignment;
            return;
        }
        if (!alignmentViaCli.value) {
            alignment.value = MSP_ALIGN_NAMES[fcStore.sensorAlignment.gyro_1_align] ?? null;
            return;
        }
        if (!isMspCliSupported()) {
            alignment.value = null;
            return;
        }
        try {
            const lines = await sendCli("get gyro_1_sensor_align");
            alignment.value = findCliSettingValue(lines, "gyro_1_sensor_align");
        } catch (error) {
            console.warn("DronoBox: reading gyro alignment failed", error);
            alignment.value = null;
        }
    }

    /**
     * Write the kit's gyro alignment and save. The board reboots, the app reconnects and the tab
     * mounts again, so the caller's progress has to be in the store before this runs.
     * @returns false when the FC refused the change
     */
    async function applyKitAlignment(): Promise<boolean> {
        alignmentBusy.value = true;
        keepConnectionThroughReboot();
        try {
            if (connectionStore.virtualMode) {
                virtualAlignment = DRONOBOX_KIT.gyroAlignCli;
            }
            if (alignmentViaCli.value) {
                const lines = await sendCli(`set gyro_1_sensor_align = ${DRONOBOX_KIT.gyroAlignCli}`);
                if (findCliError(lines)) {
                    return false;
                }
                return (await saveAndReconnect()).ok;
            }
            fcStore.sensorAlignment.gyro_1_align = DRONOBOX_KIT.gyroAlignMsp;
            await MSP.promise(MSPCodes.MSP_SET_SENSOR_ALIGNMENT, mspHelper.crunch(MSPCodes.MSP_SET_SENSOR_ALIGNMENT));
            await saveAndReboot();
            return true;
        } finally {
            alignmentBusy.value = false;
        }
    }

    // --- accelerometer -------------------------------------------------------------------------

    const accNeedsCalibration = computed(() => {
        const flags = fcStore.config.configurationProblems;
        return flags !== undefined && bit_check(flags, ACC_NEEDS_CALIBRATION_BIT);
    });
    const calibratingAcc = ref(false);

    async function calibrateAccelerometer(): Promise<void> {
        if (calibratingAcc.value) {
            return;
        }
        calibratingAcc.value = true;
        // The FC cannot answer while it calibrates; polling would only fill the queue.
        stopAttitudePolling();
        try {
            await new Promise<void>((resolve) =>
                MSP.send_message(MSPCodes.MSP_ACC_CALIBRATION, false, false, () => resolve()),
            );
            await wait(ACC_CALIBRATION_MS);
            await MSP.promise(MSPCodes.MSP_BOARD_INFO);
        } finally {
            calibratingAcc.value = false;
            startAttitudePolling();
        }
    }

    // --- instructor: reset the kit to the team baseline ----------------------------------------

    const baselineAvailable = computed(() => DRONOBOX_KIT.baselineCli.length > 0 && isMspCliSupported());

    async function applyBaseline(): Promise<{ ok: boolean; errors: string[] }> {
        const result = await cliSession.runBatch([...DRONOBOX_KIT.baselineCli]);
        const errors = result.errors.map((failure) => `${failure.command}: ${failure.errors.join(" ")}`);
        if (errors.length || result.cancelled) {
            return { ok: false, errors };
        }
        keepConnectionThroughReboot();
        const saved = await saveAndReconnect();
        return { ok: saved.ok, errors };
    }

    return {
        loaded,
        load,
        attitude,
        batteryVolts,
        batteryPresent,
        rcChannels,
        armingReasons,
        isArmed,
        startAttitudePolling,
        stopAttitudePolling,
        startRcPolling,
        stopRcPolling,
        alignment,
        alignmentIsKit,
        alignmentBusy,
        readAlignment,
        applyKitAlignment,
        accNeedsCalibration,
        calibratingAcc,
        calibrateAccelerometer,
        motorsTestingEnabled,
        motorStateReady,
        spinningMotor,
        spinMotor,
        stopMotors,
        baselineAvailable,
        applyBaseline,
    };
}
