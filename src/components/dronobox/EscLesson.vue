<template>
    <div class="esc-lesson">
        <figure class="esc-lesson__scope">
            <MotorPhases :step="step" :swapped="swapped" :direction="direction" :running="throttle > 0" />

            <div class="esc-lesson__now">
                <span class="esc-lesson__pips" aria-hidden="true">
                    <i v-for="index in 6" :key="index" :class="{ 'is-on': index - 1 === stepIndex }" />
                </span>
                <p :aria-live="throttle > 0 ? 'off' : 'polite'">{{ nowText }}</p>
            </div>

            <div class="esc-lesson__controls">
                <label for="dbx-esc-speed">{{ $t("dronobox:escSpeed") }}</label>
                <output for="dbx-esc-speed">{{ Math.round(throttle * 100) }}%</output>
                <input
                    id="dbx-esc-speed"
                    :value="throttle"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    @input="emit('update:throttle', Number(($event.target as HTMLInputElement).value))"
                />
                <div class="esc-lesson__buttons">
                    <UButton
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-step-forward"
                        :label="$t('dronobox:escStepOne')"
                        @click="emit('step')"
                    />
                    <UButton
                        color="neutral"
                        :variant="swapped ? 'solid' : 'outline'"
                        icon="i-lucide-arrow-left-right"
                        :aria-pressed="swapped"
                        :label="$t('dronobox:escSwap')"
                        @click="emit('update:swapped', !swapped)"
                    />
                </div>
            </div>

            <p class="esc-lesson__verdict" :class="started ? 'is-ok' : 'is-idle'" role="status">
                <UIcon v-if="started" :name="turning === 'cw' ? 'i-lucide-rotate-cw' : 'i-lucide-rotate-ccw'" />
                <span>
                    {{ started ? $t(`dronobox:escVerdict_${turning}`) : $t("dronobox:escVerdict_idle") }}
                    <template v-if="started && swapped">{{ $t("dronobox:escVerdict_swapped") }}</template>
                </span>
            </p>
        </figure>

        <section class="esc-lesson__how">
            <h2>{{ $t("dronobox:escHowTitle") }}</h2>
            <ol>
                <li v-for="point in 5" :key="point">
                    <strong>{{ $t(`dronobox:escHow${point}Title`) }}</strong>
                    <span>{{ $t(`dronobox:escHow${point}Body`) }}</span>
                </li>
            </ol>
            <p class="dbx__note is-warn">
                <UIcon name="i-lucide-triangle-alert" />
                {{ $t("dronobox:escFact2") }}
            </p>
        </section>

        <footer class="dbx__actions">
            <UButton
                size="lg"
                trailing-icon="i-lucide-arrow-right"
                :disabled="!ready"
                :label="$t('dronobox:escNext')"
                @click="emit('finish')"
            />
            <p v-if="!ready" class="esc-lesson__hint">{{ $t("dronobox:escNextHint") }}</p>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MotorPhases from "./MotorPhases.vue";
import { i18n } from "@/js/localization";
import type { SpinDirection } from "@/dronobox/kit";
import { commutationStep, escTurnDirection } from "@/dronobox/esc";

const props = defineProps<{
    throttle: number;
    swapped: boolean;
    /** Switching steps so far, from the parent's clock. */
    step: number;
    /** The close-up motor's own direction. */
    direction: SpinDirection;
    /** The participant may move on to the next lesson. */
    ready: boolean;
}>();

const emit = defineEmits<{
    "update:throttle": [value: number];
    "update:swapped": [value: boolean];
    /** Stop the motor and go one switching step on. */
    step: [];
    finish: [];
}>();

const WIRE_NAMES = ["A", "B", "C"] as const;
const stepIndex = computed(() => ((props.step % 6) + 6) % 6);

const nowText = computed(() => {
    const levels = commutationStep(props.step);
    return i18n.getMessage("dronobox:escNow", {
        n: stepIndex.value + 1,
        plus: WIRE_NAMES[levels.indexOf(1)],
        minus: WIRE_NAMES[levels.indexOf(-1)],
        off: WIRE_NAMES[levels.indexOf(0)],
    });
});

const started = computed(() => props.throttle > 0 || props.step > 0);
const turning = computed(() => escTurnDirection(props.direction, props.swapped));
</script>

<style lang="less">
.esc-lesson {
    display: grid;
    gap: 1.75rem;

    h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 620;
    }

    &__scope {
        display: grid;
        gap: 1rem;
        margin: 0;
        padding: 1.1rem 1.1rem 1rem;
        border-radius: 1rem;
        background: var(--dronobox-bg-2);
        box-shadow: inset 0 0 0 1px var(--dronobox-line);
    }

    &__now {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
        gap: 0.75rem;
        padding-top: 0.85rem;
        border-top: 1px solid var(--dronobox-line);

        p {
            margin: 0;
            min-height: 3em;
            line-height: 1.5;
            font-size: 0.95rem;
            color: var(--dronobox-ink);
        }
    }

    &__pips {
        display: grid;
        grid-template-columns: repeat(6, 0.5rem);
        gap: 0.25rem;
        margin-top: 0.45rem;

        i {
            height: 0.5rem;
            border-radius: 999px;
            box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
            transition: background-color 0.15s var(--dronobox-ease-soft);

            &.is-on {
                background: var(--dronobox-accent);
                box-shadow: none;
            }
        }
    }

    &__controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.4rem 1rem;

        label {
            font-size: 0.9rem;
            font-weight: 600;
        }
        output {
            font-family: var(--dronobox-font-mono);
            font-variant-numeric: tabular-nums;
            justify-self: end;
        }
        input {
            grid-column: 1 / -1;
            width: 100%;
        }
    }

    &__buttons {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.35rem;
    }

    &__how {
        display: grid;
        gap: 0.75rem;

        ol {
            display: grid;
            gap: 0.85rem;
            margin: 0;
            padding: 0;
            list-style: none;
            counter-reset: esc-how;
        }
        li {
            display: grid;
            grid-template-columns: 1.6rem minmax(0, 1fr);
            column-gap: 0.65rem;
            counter-increment: esc-how;
            line-height: 1.5;

            &::before {
                content: counter(esc-how);
                grid-row: span 2;
                display: grid;
                place-items: center;
                width: 1.6rem;
                height: 1.6rem;
                border-radius: 999px;
                box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
                font-family: var(--dronobox-font-mono);
                font-size: 0.78rem;
                color: var(--dronobox-ink-soft);
            }
        }
        strong {
            font-weight: 600;
        }
        span {
            color: var(--dronobox-ink-soft);
        }
    }

    &__verdict {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin: 0;
        font-size: 0.92rem;
        line-height: 1.5;
        font-weight: 560;

        .iconify {
            flex: none;
            width: 1.2rem;
            height: 1.2rem;
            margin-top: 0.12rem;
        }
        &.is-ok {
            color: var(--dronobox-ink);

            .iconify {
                color: var(--dronobox-accent);
            }
        }
        &.is-idle {
            font-weight: 500;
            color: var(--dronobox-ink-faint);
        }
    }

    &__hint {
        margin: 0;
        flex-basis: 100%;
        font-size: 0.85rem;
        color: var(--dronobox-ink-faint);
    }
}
</style>
