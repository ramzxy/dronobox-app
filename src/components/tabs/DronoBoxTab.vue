<template>
    <BaseTab tab-name="dronobox">
        <div class="dronobox">
            <header class="dronobox__header">
                <div>
                    <p class="dronobox__eyebrow">{{ DRONOBOX_KIT.name }}</p>
                    <h1 class="dronobox__title">{{ $t("dronobox:title") }}</h1>
                    <p class="dronobox__subtitle">{{ $t("dronobox:subtitle") }}</p>
                </div>
                <div class="dronobox__header-side">
                    <UBadge
                        v-if="store.instructorUnlocked"
                        color="warning"
                        variant="subtle"
                        icon="i-lucide-graduation-cap"
                        :label="$t('dronobox:instructorBadge')"
                    />
                    <UBadge v-else-if="isDevBuild" color="neutral" variant="subtle" icon="i-lucide-code" label="dev" />
                    <UButton
                        v-if="store.canSkip && store.step !== 'done'"
                        size="xs"
                        color="neutral"
                        variant="outline"
                        trailing-icon="i-lucide-skip-forward"
                        :label="$t('dronobox:skipStep')"
                        @click="onSkip"
                    />
                </div>
            </header>

            <nav class="dronobox__steps" :aria-label="$t('dronobox:stepsLabel')">
                <button
                    v-for="(name, index) in DRONOBOX_STEPS"
                    :key="name"
                    type="button"
                    class="dronobox__chip"
                    :class="{ 'is-active': store.step === name, 'is-done': store.isCompleted(name) }"
                    :disabled="!store.canOpen(name)"
                    :aria-current="store.step === name ? 'step' : undefined"
                    @click="store.goTo(name)"
                >
                    <span class="dronobox__chip-num">
                        <UIcon v-if="store.isCompleted(name)" name="i-lucide-check" />
                        <template v-else>{{ index + 1 }}</template>
                    </span>
                    <span class="dronobox__chip-label">{{ $t(`dronobox:${stepKey(name)}`) }}</span>
                </button>
            </nav>

            <p v-if="loadFailed" class="dronobox__notice is-error">{{ $t("dronobox:loadFailed") }}</p>

            <div class="dronobox__layout">
                <section class="dronobox__card dronobox__stage">
                    <!-- 1. Gyro -->
                    <template v-if="store.step === 'gyro'">
                        <h2>{{ $t("dronobox:gyroTitle") }}</h2>
                        <p class="dronobox__lead">{{ $t("dronobox:gyroLead") }}</p>
                        <p class="dronobox__task">
                            <UIcon name="i-lucide-hand" />
                            <span>{{ $t("dronobox:gyroTask") }}</span>
                        </p>
                        <UProgress :model-value="gyroProgress" :max="100" class="dronobox__meter" />
                        <details class="dronobox__why">
                            <summary>{{ $t("dronobox:whyTitle") }}</summary>
                            <p>{{ $t("dronobox:gyroWhy") }}</p>
                        </details>
                        <p class="dronobox__hint">{{ $t("dronobox:gyroHelp") }}</p>
                        <footer class="dronobox__actions">
                            <UButton
                                size="lg"
                                trailing-icon="i-lucide-arrow-right"
                                :disabled="gyroProgress < 100 && !store.canSkip"
                                :label="gyroProgress < 100 ? $t('dronobox:gyroWaiting') : $t('dronobox:gyroConfirm')"
                                @click="store.completeAndAdvance('gyro')"
                            />
                        </footer>
                    </template>

                    <!-- 2. Board alignment -->
                    <template v-else-if="store.step === 'align'">
                        <h2>{{ $t("dronobox:alignTitle") }}</h2>
                        <p class="dronobox__lead">{{ $t("dronobox:alignLead") }}</p>
                        <p class="dronobox__task">
                            <UIcon name="i-lucide-arrow-up-circle" />
                            <span>{{ $t("dronobox:alignLook") }}</span>
                        </p>
                        <div class="dronobox__compare">
                            <div>
                                <span>{{ $t("dronobox:alignCurrent") }}</span>
                                <strong>{{ alignmentLabel }}</strong>
                            </div>
                            <UIcon name="i-lucide-arrow-right" />
                            <div>
                                <span>{{ $t("dronobox:alignNeeded") }}</span>
                                <strong>CW 270°</strong>
                            </div>
                        </div>
                        <p v-if="alignmentError" class="dronobox__notice is-error">{{ alignmentError }}</p>
                        <template v-if="alignmentIsKit">
                            <p class="dronobox__notice is-ok">
                                <UIcon name="i-lucide-check-circle-2" />
                                {{ $t("dronobox:alignOk") }}
                            </p>
                            <p class="dronobox__task">
                                <UIcon name="i-lucide-move-down" />
                                <span>{{ $t("dronobox:alignCheck") }}</span>
                            </p>
                        </template>
                        <p v-else-if="alignment === null && loaded" class="dronobox__hint">
                            {{ $t("dronobox:alignUnknown") }}
                        </p>
                        <details class="dronobox__why">
                            <summary>{{ $t("dronobox:whyTitle") }}</summary>
                            <p>{{ $t("dronobox:alignWhy") }}</p>
                        </details>
                        <footer class="dronobox__actions">
                            <UButton
                                v-if="!alignmentIsKit"
                                size="lg"
                                icon="i-lucide-save"
                                :loading="alignmentBusy"
                                :disabled="!loaded"
                                :label="$t('dronobox:alignApply')"
                                @click="onApplyAlignment"
                            />
                            <UButton
                                v-else
                                size="lg"
                                trailing-icon="i-lucide-arrow-right"
                                :label="$t('dronobox:alignConfirm')"
                                @click="store.completeAndAdvance('align')"
                            />
                        </footer>
                    </template>

                    <!-- 3. Accelerometer -->
                    <template v-else-if="store.step === 'level'">
                        <h2>{{ $t("dronobox:levelTitle") }}</h2>
                        <p class="dronobox__lead">{{ $t("dronobox:levelLead") }}</p>
                        <p class="dronobox__task">
                            <UIcon name="i-lucide-table-2" />
                            <span>{{ $t("dronobox:levelTask") }}</span>
                        </p>
                        <p v-if="levelDone" class="dronobox__notice is-ok">
                            <UIcon name="i-lucide-check-circle-2" />
                            {{ $t("dronobox:levelDone") }}
                        </p>
                        <details class="dronobox__why">
                            <summary>{{ $t("dronobox:whyTitle") }}</summary>
                            <p>{{ $t("dronobox:levelWhy") }}</p>
                        </details>
                        <footer class="dronobox__actions">
                            <UButton
                                size="lg"
                                :variant="levelDone ? 'outline' : 'solid'"
                                icon="i-lucide-crosshair"
                                :loading="calibratingAcc"
                                :disabled="!loaded"
                                :label="calibratingAcc ? $t('dronobox:levelBusy') : $t('dronobox:levelButton')"
                                @click="onCalibrate"
                            />
                            <UButton
                                v-if="levelDone || store.canSkip"
                                size="lg"
                                trailing-icon="i-lucide-arrow-right"
                                :label="$t('dronobox:next')"
                                @click="store.completeAndAdvance('level')"
                            />
                        </footer>
                    </template>

                    <!-- 4. Safety gate -->
                    <template v-else-if="store.step === 'safety'">
                        <h2>{{ $t("dronobox:safetyTitle") }}</h2>
                        <p class="dronobox__notice is-warning">
                            <UIcon name="i-lucide-triangle-alert" />
                            {{ $t("dronobox:safetyLead") }}
                        </p>
                        <div class="dronobox__checks">
                            <UCheckbox v-model="propsOff" size="lg" :label="$t('dronobox:safetyPropsOff')" />
                            <UCheckbox v-model="watcherPresent" size="lg" :label="$t('dronobox:safetyWatcher')" />
                        </div>
                        <div v-if="propsOff && watcherPresent" class="dronobox__battery-check">
                            <p class="dronobox__task">
                                <UIcon name="i-lucide-battery-charging" />
                                <span>{{ $t("dronobox:safetyBattery") }}</span>
                            </p>
                            <p v-if="batteryPresent" class="dronobox__notice is-ok">
                                <UIcon name="i-lucide-check-circle-2" />
                                {{ $t("dronobox:safetyBatteryOk", { volts: batteryVolts.toFixed(1) }) }}
                            </p>
                            <p v-else class="dronobox__hint">{{ $t("dronobox:safetyBatteryWaiting") }}</p>
                        </div>
                        <footer class="dronobox__actions">
                            <UButton
                                size="lg"
                                trailing-icon="i-lucide-arrow-right"
                                :disabled="!safetyReady"
                                :label="$t('dronobox:safetyContinue')"
                                @click="store.completeAndAdvance('safety')"
                            />
                        </footer>
                    </template>

                    <!-- 5. Motor direction test -->
                    <template v-else-if="store.step === 'motors'">
                        <h2>{{ $t("dronobox:motorsTitle") }}</h2>
                        <p class="dronobox__lead">{{ $t("dronobox:motorsLead") }}</p>
                        <div class="dronobox__motors">
                            <MotorMap
                                :motors="DRONOBOX_KIT.motors"
                                :checks="store.motors"
                                :selected="selectedMotor"
                                :spinning="spinningMotor"
                                :reveal-all="store.instructorUnlocked"
                                @select="selectMotor"
                            />
                            <div class="dronobox__motor-panel">
                                <USwitch
                                    v-model="motorsTestingEnabled"
                                    size="lg"
                                    :disabled="!motorStateReady || !batteryPresent"
                                    :label="$t('dronobox:motorsEnable')"
                                    :description="
                                        batteryPresent
                                            ? $t('dronobox:motorsEnableHelp')
                                            : $t('dronobox:motorsNoBattery')
                                    "
                                />

                                <template v-if="selectedMotor !== null && selectedKitMotor">
                                    <p class="dronobox__motor-name">
                                        {{
                                            $t("dronobox:motorsSelected", {
                                                n: selectedMotor,
                                                position: $t(`dronobox:pos${capitalize(selectedKitMotor.position)}`),
                                            })
                                        }}
                                    </p>
                                    <UButton
                                        size="xl"
                                        block
                                        class="dronobox__hold"
                                        icon="i-lucide-fan"
                                        :color="spinningMotor === selectedMotor ? 'warning' : 'primary'"
                                        :disabled="!motorsTestingEnabled"
                                        :label="$t('dronobox:motorsHold', { n: selectedMotor })"
                                        @pointerdown.prevent="onHoldStart"
                                        @pointerup="onHoldEnd"
                                        @pointerleave="onHoldEnd"
                                        @pointercancel="onHoldEnd"
                                        @contextmenu.prevent
                                    />

                                    <div v-if="currentCheck?.answer == null" class="dronobox__question">
                                        <p>{{ $t("dronobox:motorsQuestion", { n: selectedMotor }) }}</p>
                                        <div class="dronobox__answers">
                                            <UButton
                                                color="neutral"
                                                variant="outline"
                                                icon="i-lucide-rotate-cw"
                                                :disabled="!spunMotors.has(selectedMotor)"
                                                :label="$t('dronobox:motorsCw')"
                                                @click="answer('cw')"
                                            />
                                            <UButton
                                                color="neutral"
                                                variant="outline"
                                                icon="i-lucide-rotate-ccw"
                                                :disabled="!spunMotors.has(selectedMotor)"
                                                :label="$t('dronobox:motorsCcw')"
                                                @click="answer('ccw')"
                                            />
                                        </div>
                                        <p v-if="!spunMotors.has(selectedMotor)" class="dronobox__hint">
                                            {{ $t("dronobox:motorsSpinFirst") }}
                                        </p>
                                    </div>
                                    <div v-else class="dronobox__result">
                                        <p v-if="currentCheck.correct" class="dronobox__notice is-ok">
                                            <UIcon name="i-lucide-check-circle-2" />
                                            {{ $t("dronobox:motorsCorrect", { n: selectedMotor }) }}
                                        </p>
                                        <p v-else class="dronobox__notice is-error">
                                            <UIcon name="i-lucide-circle-x" />
                                            {{ $t("dronobox:motorsWrong", { n: selectedMotor }) }}
                                        </p>
                                        <UButton
                                            color="neutral"
                                            variant="ghost"
                                            icon="i-lucide-refresh-ccw"
                                            :label="$t('dronobox:motorsRetry')"
                                            @click="retryMotor"
                                        />
                                    </div>
                                </template>
                                <p v-else class="dronobox__hint">{{ $t("dronobox:motorsPick") }}</p>
                            </div>
                        </div>
                        <details class="dronobox__why">
                            <summary>{{ $t("dronobox:whyTitle") }}</summary>
                            <p>{{ $t("dronobox:motorsWhy") }}</p>
                        </details>
                        <footer class="dronobox__actions">
                            <span class="dronobox__progress-text">
                                {{
                                    $t("dronobox:motorsProgress", {
                                        done: motorsCorrect,
                                        total: DRONOBOX_KIT.motors.length,
                                    })
                                }}
                            </span>
                            <UButton
                                size="lg"
                                trailing-icon="i-lucide-arrow-right"
                                :disabled="!allMotorsCorrect && !store.canSkip"
                                :label="$t('dronobox:motorsDone')"
                                @click="finishMotors"
                            />
                        </footer>
                    </template>

                    <!-- 6. Radio -->
                    <template v-else-if="store.step === 'radio'">
                        <h2>{{ $t("dronobox:radioTitle") }}</h2>
                        <p class="dronobox__lead">{{ $t("dronobox:radioLead") }}</p>
                        <p v-if="!hasRadioSignal" class="dronobox__notice is-warning">
                            <UIcon name="i-lucide-radio" />
                            {{ $t("dronobox:radioNoSignal") }}
                        </p>
                        <StickCheck :channels="rcChannels" @complete="radioDone = true" />
                        <details class="dronobox__why">
                            <summary>{{ $t("dronobox:whyTitle") }}</summary>
                            <p>{{ $t("dronobox:radioWhy") }}</p>
                        </details>
                        <footer class="dronobox__actions">
                            <UButton
                                size="lg"
                                trailing-icon="i-lucide-arrow-right"
                                :disabled="!radioDone && !store.canSkip"
                                :label="$t('dronobox:next')"
                                @click="store.completeAndAdvance('radio')"
                            />
                        </footer>
                    </template>

                    <!-- 7. Done -->
                    <template v-else>
                        <h2>{{ $t("dronobox:doneTitle") }}</h2>
                        <p class="dronobox__lead">{{ $t("dronobox:doneLead") }}</p>
                        <ul class="dronobox__checklist">
                            <li><UIcon name="i-lucide-fan" />{{ $t("dronobox:doneProps") }}</li>
                            <li><UIcon name="i-lucide-gamepad-2" />{{ $t("dronobox:doneSticks") }}</li>
                            <li><UIcon name="i-lucide-arrow-up-from-line" />{{ $t("dronobox:doneHover") }}</li>
                        </ul>
                        <p class="dronobox__hint">{{ $t("dronobox:doneArming") }}</p>
                        <p class="dronobox__task">
                            <UIcon name="i-lucide-unplug" />
                            <span>{{ $t("dronobox:doneDisconnect") }}</span>
                        </p>
                        <footer class="dronobox__actions">
                            <UButton
                                size="lg"
                                color="error"
                                variant="soft"
                                icon="i-lucide-link-2-off"
                                :label="$t('disconnect')"
                                @click="onDisconnect"
                            />
                        </footer>
                    </template>
                </section>

                <aside class="dronobox__card dronobox__live">
                    <h3>{{ $t("dronobox:liveTitle") }}</h3>
                    <div ref="modelWrapper" class="dronobox__model">
                        <canvas ref="modelCanvas"></canvas>
                    </div>
                    <dl class="dronobox__readout">
                        <div>
                            <dt>{{ $t("dronobox:liveRoll") }}</dt>
                            <dd>{{ attitude.roll.toFixed(0) }}°</dd>
                        </div>
                        <div>
                            <dt>{{ $t("dronobox:livePitch") }}</dt>
                            <dd>{{ attitude.pitch.toFixed(0) }}°</dd>
                        </div>
                        <div>
                            <dt>{{ $t("dronobox:liveBattery") }}</dt>
                            <dd>{{ batteryPresent ? `${batteryVolts.toFixed(1)} V` : $t("dronobox:liveUsbOnly") }}</dd>
                        </div>
                    </dl>
                    <h3>{{ $t("dronobox:armingTitle") }}</h3>
                    <ArmingStatus :reasons="armingReasons" />
                </aside>
            </div>

            <section v-if="store.instructorUnlocked" class="dronobox__card dronobox__instructor">
                <h3>{{ $t("dronobox:instructorTools") }}</h3>
                <div class="dronobox__actions is-start">
                    <UButton
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-rotate-ccw"
                        :label="$t('dronobox:instructorResetProgress')"
                        @click="onResetProgress"
                    />
                    <UButton
                        color="warning"
                        variant="outline"
                        icon="i-lucide-package-check"
                        :disabled="!baselineAvailable || baselineBusy"
                        :loading="baselineBusy"
                        :label="$t('dronobox:instructorBaseline')"
                        @click="onApplyBaseline"
                    />
                    <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-lock"
                        :label="$t('dronobox:instructorLock')"
                        @click="store.lock()"
                    />
                </div>
                <p v-if="!baselineAvailable" class="dronobox__hint">{{ $t("dronobox:instructorBaselineMissing") }}</p>
                <p v-if="baselineMessage" class="dronobox__hint">{{ baselineMessage }}</p>
            </section>
        </div>
    </BaseTab>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BaseTab from "./BaseTab.vue";
import MotorMap from "@/components/dronobox/MotorMap.vue";
import StickCheck from "@/components/dronobox/StickCheck.vue";
import ArmingStatus from "@/components/dronobox/ArmingStatus.vue";
import Model from "@/js/model";
import { i18n } from "@/js/localization";
import { disconnect } from "@/js/serial_backend";
import { useDialog } from "@/composables/useDialog";
import { useDronoBoxFc } from "@/composables/dronobox/useDronoBoxFc";
import { DRONOBOX_STEPS, useDronoBoxStore, type DronoBoxStep } from "@/stores/dronobox";
import { DRONOBOX_KIT, type SpinDirection } from "@/dronobox/kit";

const store = useDronoBoxStore();
const dialog = useDialog();

const {
    loaded,
    load,
    attitude,
    batteryVolts,
    batteryPresent,
    rcChannels,
    armingReasons,
    startAttitudePolling,
    startRcPolling,
    stopRcPolling,
    alignment,
    alignmentIsKit,
    alignmentBusy,
    applyKitAlignment,
    calibratingAcc,
    accNeedsCalibration,
    calibrateAccelerometer,
    motorsTestingEnabled,
    motorStateReady,
    spinningMotor,
    spinMotor,
    stopMotors,
    baselineAvailable,
    applyBaseline,
} = useDronoBoxFc((message) => dialog.openInfo(i18n.getMessage("warningTitle"), message));

const loadFailed = ref(false);
let mounted = false;

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function stepKey(step: DronoBoxStep): string {
    return `step${capitalize(step)}`;
}

// --- 1. gyro: the bar fills as the drone is tilted, so nobody can skip it by clicking ---------

const GYRO_TILT_TARGET = 25;
const gyroPeak = ref(0);
const gyroProgress = computed(() => Math.min(100, Math.round((gyroPeak.value / GYRO_TILT_TARGET) * 100)));

watch(attitude, (value) => {
    if (store.step === "gyro") {
        gyroPeak.value = Math.max(gyroPeak.value, Math.abs(value.roll), Math.abs(value.pitch));
    }
});

// --- 2. alignment ---------------------------------------------------------------------------

const alignmentError = ref("");
const alignmentLabel = computed(() => {
    if (alignment.value === null) {
        return "?";
    }
    return alignment.value === "DEFAULT"
        ? i18n.getMessage("dronobox:alignDefault")
        : alignment.value.replace(/^CW(\d+)/, "CW $1°").replace("FLIP", " flip");
});

async function onApplyAlignment(): Promise<void> {
    alignmentError.value = "";
    const ok = await applyKitAlignment();
    if (!ok) {
        alignmentError.value = i18n.getMessage("dronobox:alignFailed");
    }
}

// --- 3. accelerometer -----------------------------------------------------------------------

const levelDone = ref(store.isCompleted("level"));

async function onCalibrate(): Promise<void> {
    await calibrateAccelerometer();
    levelDone.value = !accNeedsCalibration.value;
}

// --- 4. safety ------------------------------------------------------------------------------

const propsOff = ref(false);
const watcherPresent = ref(false);
const safetyReady = computed(() => propsOff.value && watcherPresent.value && batteryPresent.value);

// --- 5. motors ------------------------------------------------------------------------------

const selectedMotor = ref<number | null>(null);
const spunMotors = ref(new Set<number>());
const selectedKitMotor = computed(() => DRONOBOX_KIT.motors.find((motor) => motor.number === selectedMotor.value));
const currentCheck = computed(() => (selectedMotor.value === null ? null : store.motors[selectedMotor.value]));
const motorsCorrect = computed(() => Object.values(store.motors).filter((check) => check.correct).length);
const allMotorsCorrect = computed(() => motorsCorrect.value === DRONOBOX_KIT.motors.length);

function selectMotor(number: number): void {
    stopMotors();
    selectedMotor.value = number;
}

function onHoldStart(): void {
    if (selectedMotor.value === null) {
        return;
    }
    spinMotor(selectedMotor.value);
    spunMotors.value = new Set([...spunMotors.value, selectedMotor.value]);
}

function onHoldEnd(): void {
    if (spinningMotor.value !== null) {
        stopMotors();
    }
}

function answer(direction: SpinDirection): void {
    if (selectedMotor.value !== null) {
        store.recordMotor(selectedMotor.value, direction);
    }
}

function retryMotor(): void {
    if (selectedMotor.value === null) {
        return;
    }
    store.resetMotor(selectedMotor.value);
    const remaining = new Set(spunMotors.value);
    remaining.delete(selectedMotor.value);
    spunMotors.value = remaining;
}

function finishMotors(): void {
    stopMotors();
    motorsTestingEnabled.value = false;
    store.completeAndAdvance("motors");
}

// --- skipping (dev builds and instructors) --------------------------------------------------

const isDevBuild = import.meta.env.DEV;

function onSkip(): void {
    // The step watcher below stops the motor test when leaving the motor step.
    store.completeAndAdvance(store.step);
}

// Leaving the motor step (or the battery coming out) always ends the test.
watch(
    () => store.step,
    (step, previous) => {
        if (previous === "motors") {
            stopMotors();
            motorsTestingEnabled.value = false;
        }
        if (step === "radio") {
            startRcPolling();
        } else if (previous === "radio") {
            stopRcPolling();
        }
    },
);
watch(batteryPresent, (present) => {
    if (!present && motorsTestingEnabled.value) {
        motorsTestingEnabled.value = false;
    }
});

// --- 6. radio -------------------------------------------------------------------------------

const radioDone = ref(store.isCompleted("radio"));
const hasRadioSignal = computed(
    () => !armingReasons.value.includes("RXLOSS") && rcChannels.value.some((value) => value > 0),
);

// --- 7. done --------------------------------------------------------------------------------

function onDisconnect(): void {
    disconnect();
}

// --- instructor -----------------------------------------------------------------------------

const baselineBusy = ref(false);
const baselineMessage = ref("");

function onResetProgress(): void {
    store.resetProgress();
    gyroPeak.value = 0;
    levelDone.value = false;
    radioDone.value = false;
    propsOff.value = false;
    watcherPresent.value = false;
    spunMotors.value = new Set();
    selectedMotor.value = null;
}

async function onApplyBaseline(): Promise<void> {
    baselineBusy.value = true;
    baselineMessage.value = "";
    try {
        const result = await applyBaseline();
        baselineMessage.value = result.ok
            ? i18n.getMessage("dronobox:instructorBaselineOk")
            : `${i18n.getMessage("dronobox:instructorBaselineFailed")} ${result.errors.join("; ")}`;
    } finally {
        baselineBusy.value = false;
    }
}

// --- 3D model -------------------------------------------------------------------------------

const modelWrapper = ref<HTMLElement | null>(null);
const modelCanvas = ref<HTMLCanvasElement | null>(null);
let model: Model | null = null;
let yawOffset: number | null = null;
const DEG_TO_RAD = Math.PI / 180;

function onResize(): void {
    model?.resize();
}

function initModel(): void {
    if (!modelWrapper.value || !modelCanvas.value) {
        return;
    }
    model = new Model(modelWrapper.value, modelCanvas.value);
    window.addEventListener("resize", onResize);
}

watch(attitude, (value) => {
    if (!model) {
        return;
    }
    // Face the model forward from wherever the drone pointed when the tab opened.
    yawOffset ??= value.heading;
    model.rotateTo(-value.pitch * DEG_TO_RAD, -(value.heading - yawOffset) * DEG_TO_RAD, -value.roll * DEG_TO_RAD);
});

function disposeModel(): void {
    window.removeEventListener("resize", onResize);
    model?.dispose();
    model = null;
}

// --- lifecycle ------------------------------------------------------------------------------

function cleanup(callback?: () => void): void {
    if (spinningMotor.value !== null || motorsTestingEnabled.value) {
        stopMotors();
        motorsTestingEnabled.value = false;
    }
    disposeModel();
    callback?.();
}

defineExpose({ cleanup });

onMounted(async () => {
    mounted = true;
    const ok = await load();
    if (!mounted) {
        return;
    }
    loadFailed.value = !ok;
    if (!ok) {
        return;
    }
    await nextTick();
    initModel();
    startAttitudePolling();
    if (store.step === "radio") {
        startRcPolling();
    }
});

onBeforeUnmount(() => {
    mounted = false;
    cleanup();
});
</script>

<style lang="less">
.tab-dronobox {
    height: 100%;
}

.dronobox {
    display: grid;
    gap: 1rem;
    max-width: 78rem;
    margin: 0 auto;
    padding: 1.25rem 1.5rem 2rem;

    &__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
    }
    &__header-side {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.5rem;
    }
    &__eyebrow {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ui-primary);
    }
    &__title {
        margin: 0.15rem 0 0;
        font-size: clamp(1.5rem, 2.6vw, 2.1rem);
        font-weight: 800;
        line-height: 1.1;
        color: var(--ui-text-highlighted);
    }
    &__subtitle {
        margin: 0.35rem 0 0;
        color: var(--ui-text-muted);
    }

    &__steps {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }
    &__chip {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.35rem 0.75rem 0.35rem 0.35rem;
        border: 1px solid var(--ui-border);
        border-radius: 999px;
        background: var(--ui-bg);
        color: var(--ui-text-muted);
        font-size: 0.85rem;
        cursor: pointer;

        &:disabled {
            cursor: not-allowed;
            opacity: 0.5;
        }
        &.is-done {
            color: var(--ui-text);
        }
        &.is-active {
            border-color: var(--ui-primary);
            color: var(--ui-text-highlighted);
            font-weight: 600;
        }
    }
    &__chip-num {
        display: inline-grid;
        place-items: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 999px;
        background: var(--ui-bg-accented);
        font-size: 0.75rem;
        font-weight: 700;
    }
    &__chip.is-done &__chip-num {
        background: var(--ui-success);
        color: var(--ui-bg);
    }
    &__chip.is-active &__chip-num {
        background: var(--ui-primary);
        color: var(--ui-bg);
    }

    &__layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
        gap: 1rem;
        align-items: start;
    }
    &__card {
        border: 1px solid var(--ui-border);
        border-radius: 0.75rem;
        background: var(--ui-bg-elevated);
        padding: 1.25rem 1.5rem;

        h2 {
            margin: 0 0 0.5rem;
            font-size: 1.35rem;
            font-weight: 700;
            color: var(--ui-text-highlighted);
        }
        h3 {
            margin: 0 0 0.6rem;
            font-size: 0.8rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--ui-text-muted);
        }
    }
    &__stage {
        display: grid;
        gap: 0.9rem;
        min-height: 26rem;
        align-content: start;
    }
    &__lead {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.5;
        max-width: 42rem;
    }
    &__task {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        margin: 0;
        padding: 0.75rem 0.9rem;
        border-radius: 0.5rem;
        background: var(--ui-bg-accented);
        font-weight: 600;
        line-height: 1.4;

        .iconify {
            flex: none;
            width: 1.25rem;
            height: 1.25rem;
            color: var(--ui-primary);
        }
    }
    &__meter {
        max-width: 28rem;
    }
    &__why {
        max-width: 42rem;
        color: var(--ui-text-muted);

        summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--ui-text);
        }
        p {
            margin: 0.4rem 0 0;
            line-height: 1.5;
        }
    }
    &__hint {
        margin: 0;
        font-size: 0.9rem;
        color: var(--ui-text-muted);
    }
    &__notice {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin: 0;
        padding: 0.6rem 0.8rem;
        border-radius: 0.5rem;
        line-height: 1.4;

        .iconify {
            flex: none;
            width: 1.15rem;
            height: 1.15rem;
            margin-top: 0.1rem;
        }
        &.is-ok {
            background: color-mix(in srgb, var(--ui-success) 12%, transparent);
            color: var(--ui-success);
        }
        &.is-warning {
            background: color-mix(in srgb, var(--ui-warning) 14%, transparent);
            color: var(--ui-text-highlighted);

            .iconify {
                color: var(--ui-warning);
            }
        }
        &.is-error {
            background: color-mix(in srgb, var(--ui-error) 12%, transparent);
            color: var(--ui-error);
        }
    }
    &__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.6rem;
        margin-top: 0.5rem;

        &.is-start {
            justify-content: flex-start;
            margin-top: 0;
        }
    }
    &__progress-text {
        margin-right: auto;
        color: var(--ui-text-muted);
        font-size: 0.9rem;
    }
    &__compare {
        display: flex;
        align-items: center;
        gap: 1rem;

        div {
            display: grid;
            gap: 0.15rem;
            padding: 0.6rem 0.9rem;
            border: 1px solid var(--ui-border);
            border-radius: 0.5rem;
            min-width: 8rem;
        }
        span {
            font-size: 0.75rem;
            color: var(--ui-text-muted);
        }
        strong {
            font-size: 1.15rem;
        }
    }
    &__checks {
        display: grid;
        gap: 0.75rem;
    }
    &__battery-check {
        display: grid;
        gap: 0.6rem;
    }
    &__motors {
        display: grid;
        grid-template-columns: minmax(12rem, 22rem) minmax(0, 1fr);
        gap: 1.25rem;
        align-items: start;
    }
    &__motor-panel {
        display: grid;
        gap: 0.9rem;
    }
    &__motor-name {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
    }
    &__hold {
        touch-action: none;
        user-select: none;
    }
    &__question {
        display: grid;
        gap: 0.5rem;

        p {
            margin: 0;
        }
    }
    &__answers {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    &__result {
        display: grid;
        gap: 0.4rem;
        justify-items: start;
    }
    &__checklist {
        display: grid;
        gap: 0.5rem;
        margin: 0;
        padding: 0;
        list-style: none;

        li {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            font-weight: 600;
        }
        .iconify {
            color: var(--ui-primary);
        }
    }

    &__live {
        position: sticky;
        top: 1rem;
        display: grid;
        gap: 0.75rem;
    }
    &__model {
        position: relative;
        height: 13rem;
        border-radius: 0.5rem;
        background: var(--ui-bg-accented);
        overflow: hidden;

        canvas {
            width: 100%;
            height: 100%;
        }
    }
    &__readout {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
        margin: 0;

        div {
            display: grid;
            gap: 0.1rem;
        }
        dt {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--ui-text-muted);
        }
        dd {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }
    }
    &__instructor {
        display: grid;
        gap: 0.75rem;
        border-style: dashed;
    }

    @media (max-width: 960px) {
        padding: 1rem;

        &__layout,
        &__motors {
            grid-template-columns: 1fr;
        }
        &__live {
            position: static;
        }
    }

    // On a phone the seven chips would wrap into four rows; one scrolling row keeps the
    // current step in view instead.
    @media (max-width: 640px) {
        &__header {
            flex-direction: column;
        }
        &__steps {
            flex-wrap: nowrap;
            overflow-x: auto;
            margin: 0 -1rem;
            padding: 0 1rem 0.25rem;
            scrollbar-width: none;
        }
        &__chip {
            flex: none;
        }
        &__chip:not(.is-active) &__chip-label {
            display: none;
        }
        &__chip:not(.is-active) {
            padding-right: 0.35rem;
        }
        &__card {
            padding: 1rem;
        }
    }
}
</style>
