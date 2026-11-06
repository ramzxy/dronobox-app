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

import { defineStore } from "pinia";
import { computed, reactive, ref, watch } from "vue";
import { DRONOBOX_KIT, type SpinDirection } from "@/dronobox/kit";

export const DRONOBOX_STEPS = ["gyro", "align", "level", "safety", "motors", "radio", "done"] as const;
export type DronoBoxStep = (typeof DRONOBOX_STEPS)[number];

export interface MotorCheck {
    answer: SpinDirection | null;
    correct: boolean | null;
}

interface SavedProgress {
    step: DronoBoxStep;
    completed: DronoBoxStep[];
    motors: Record<number, MotorCheck>;
}

// sessionStorage, not localStorage: progress has to survive the reboot after "Save" (the app
// reconnects and remounts the tab) but not carry over to the next group on the same laptop.
const PROGRESS_KEY = "dronoboxProgress";
const INSTRUCTOR_KEY = "dronoboxInstructor";

function readSession<T>(key: string): T | null {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

function writeSession(key: string, value: unknown): void {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Private windows and blocked storage: progress then lives only in memory.
    }
}

function emptyMotorChecks(): Record<number, MotorCheck> {
    return Object.fromEntries(
        DRONOBOX_KIT.motors.map((motor) => [motor.number, { answer: null, correct: null }]),
    ) as Record<number, MotorCheck>;
}

export const useDronoBoxStore = defineStore("dronobox", () => {
    const saved = readSession<SavedProgress>(PROGRESS_KEY);

    const instructorUnlocked = ref(readSession<boolean>(INSTRUCTOR_KEY) === true);
    const step = ref<DronoBoxStep>(saved && DRONOBOX_STEPS.includes(saved.step) ? saved.step : "gyro");
    const completed = ref<DronoBoxStep[]>(saved?.completed ?? []);
    const motors = reactive<Record<number, MotorCheck>>({ ...emptyMotorChecks(), ...saved?.motors });

    /** True while participants are using the app: only the guided flow is shown. */
    const workshopLocked = computed(() => !instructorUnlocked.value);

    /** Instructors, and anyone on a dev build (`npm run dev`), may jump or skip past checks. */
    const canSkip = computed(() => instructorUnlocked.value || import.meta.env.DEV);

    const stepIndex = computed(() => DRONOBOX_STEPS.indexOf(step.value));

    function isCompleted(target: DronoBoxStep): boolean {
        return completed.value.includes(target);
    }

    /** A step is reachable once every step before it is done, unless skipping is allowed. */
    function canOpen(target: DronoBoxStep): boolean {
        if (canSkip.value) {
            return true;
        }
        const index = DRONOBOX_STEPS.indexOf(target);
        return DRONOBOX_STEPS.slice(0, index).every((earlier) => completed.value.includes(earlier));
    }

    function goTo(target: DronoBoxStep): void {
        if (canOpen(target)) {
            step.value = target;
        }
    }

    function complete(target: DronoBoxStep): void {
        if (!completed.value.includes(target)) {
            completed.value = [...completed.value, target];
        }
    }

    function completeAndAdvance(target: DronoBoxStep): void {
        complete(target);
        const next = DRONOBOX_STEPS[DRONOBOX_STEPS.indexOf(target) + 1];
        if (next) {
            step.value = next;
        }
    }

    function recordMotor(number: number, answer: SpinDirection): void {
        const expected = DRONOBOX_KIT.motors.find((motor) => motor.number === number)?.direction;
        motors[number] = { answer, correct: answer === expected };
    }

    function resetMotor(number: number): void {
        motors[number] = { answer: null, correct: null };
    }

    function resetProgress(): void {
        step.value = "gyro";
        completed.value = [];
        Object.assign(motors, emptyMotorChecks());
    }

    function unlock(pin: string): boolean {
        if (pin.trim() !== DRONOBOX_KIT.instructorPin) {
            return false;
        }
        instructorUnlocked.value = true;
        return true;
    }

    function lock(): void {
        instructorUnlocked.value = false;
    }

    watch(instructorUnlocked, (value) => writeSession(INSTRUCTOR_KEY, value));
    watch(
        [step, completed, motors],
        () => writeSession(PROGRESS_KEY, { step: step.value, completed: completed.value, motors: { ...motors } }),
        { deep: true },
    );

    return {
        instructorUnlocked,
        workshopLocked,
        canSkip,
        step,
        stepIndex,
        completed,
        motors,
        isCompleted,
        canOpen,
        goTo,
        complete,
        completeAndAdvance,
        recordMotor,
        resetMotor,
        resetProgress,
        unlock,
        lock,
    };
});
