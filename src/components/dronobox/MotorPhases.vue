<template>
    <div class="motor-phases" :class="{ 'is-running': running }">
        <svg class="motor-phases__motor" viewBox="-60 -60 120 120" role="img" :aria-label="motorLabel">
            <circle r="46" class="motor-phases__stator" />
            <g
                v-for="coil in coils"
                :key="coil.index"
                :transform="`translate(${coil.x} ${coil.y}) rotate(${coil.rotate})`"
                class="motor-phases__coil"
                :class="[`is-wire-${coil.wire}`, `is-${coil.state}`]"
            >
                <rect x="-11" y="-8" width="22" height="16" rx="4" />
            </g>
            <text
                v-for="coil in coils"
                :key="`l${coil.index}`"
                :x="coil.lx"
                :y="coil.ly"
                class="motor-phases__coil-label"
                :class="`is-wire-${coil.wire}`"
            >
                {{ WIRE_NAMES[coil.wire] }}
            </text>
            <g class="motor-phases__rotor" :style="{ transform: `rotate(${needle}deg)` }">
                <rect x="0" y="-5" width="24" height="10" rx="2" class="is-north" />
                <rect x="-24" y="-5" width="24" height="10" rx="2" class="is-south" />
            </g>
            <circle r="3" class="motor-phases__hub" />
        </svg>
        <div class="motor-phases__traces">
            <div v-for="(row, wire) in traces" :key="wire" class="motor-phases__row" :class="`is-wire-${wire}`">
                <span class="motor-phases__wire">{{ WIRE_NAMES[wire] }}</span>
                <svg viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true">
                    <rect :x="column * 10" y="0" width="10" height="24" class="motor-phases__now" />
                    <line x1="0" x2="120" y1="12" y2="12" class="motor-phases__zero" />
                    <path :d="row" class="motor-phases__trace" />
                </svg>
                <span class="motor-phases__level">{{ levelText(levels[wire]) }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { i18n } from "@/js/localization";
import type { SpinDirection } from "@/dronobox/kit";
import { COMMUTATION, coilAngle, commutationStep, fieldAngle, wireForCoil } from "@/dronobox/esc";

const props = defineProps<{
    /** Switching steps so far; only counts up. */
    step: number;
    swapped: boolean;
    /** The way the motor turns with its wires as built. */
    direction: SpinDirection;
    running: boolean;
}>();

const WIRE_NAMES = ["A", "B", "C"] as const;
const levels = computed(() => commutationStep(props.step));
const column = computed(() => ((props.step % 12) + 12) % 12);

function levelText(level: number): string {
    if (level > 0) return "+";
    if (level < 0) return "−";
    return i18n.getMessage("dronobox:escOff");
}

function stateOf(level: number): string {
    if (level > 0) return "plus";
    if (level < 0) return "minus";
    return "off";
}

// Seen from above with y pointing down on screen, so a counter-clockwise angle is negated.
const coils = computed(() =>
    [0, 1, 2].map((index) => {
        const angle = (coilAngle(index, props.direction) * Math.PI) / 180;
        const wire = wireForCoil(index, props.swapped);
        return {
            index,
            wire,
            state: stateOf(levels.value[wire]),
            x: 36 * Math.cos(angle),
            y: -36 * Math.sin(angle),
            lx: 55 * Math.cos(angle),
            ly: -55 * Math.sin(angle) + 3.5,
            rotate: 90 - coilAngle(index, props.direction),
        };
    }),
);

const traces = computed(() =>
    [0, 1, 2].map((wire) => {
        const y = (level: number) => 12 - level * 9;
        let d = `M 0 ${y(COMMUTATION[0][wire])}`;
        for (let col = 0; col < 12; col++) {
            const level = COMMUTATION[col % 6][wire];
            d += ` V ${y(level)} H ${(col + 1) * 10}`;
        }
        return d;
    }),
);

// The magnet turns the short way to each new pull, so it keeps going round instead of unwinding.
const needle = ref(-fieldAngle(props.step, props.swapped, props.direction));
watch(
    () => fieldAngle(props.step, props.swapped, props.direction),
    (angle) => {
        const target = -angle;
        let delta = (target - needle.value) % 360;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        needle.value += delta;
    },
);

const motorLabel = computed(() =>
    i18n.getMessage("dronobox:escMotorLabel", {
        plus: WIRE_NAMES[levels.value.indexOf(1)],
        minus: WIRE_NAMES[levels.value.indexOf(-1)],
    }),
);
</script>

<style lang="less">
.motor-phases {
    display: grid;
    grid-template-columns: 9.5rem minmax(0, 1fr);
    align-items: center;
    gap: 1.25rem;

    .is-wire-0 {
        --wire: var(--dronobox-wire-a);
    }
    .is-wire-1 {
        --wire: var(--dronobox-wire-b);
    }
    .is-wire-2 {
        --wire: var(--dronobox-wire-c);
    }

    &__motor {
        width: 100%;
        overflow: visible;
    }
    &__stator {
        fill: none;
        stroke: var(--dronobox-line-strong);
        stroke-width: 7;
    }
    &__coil rect {
        stroke: var(--wire);
        stroke-width: 1.5;
        transition:
            fill 0.18s var(--dronobox-ease-soft),
            opacity 0.18s var(--dronobox-ease-soft);
    }
    &__coil.is-plus rect {
        fill: var(--wire);
    }
    &__coil.is-minus rect {
        fill: color-mix(in srgb, var(--wire) 40%, transparent);
    }
    &__coil.is-off rect {
        fill: transparent;
        opacity: 0.45;
    }
    &__coil-label {
        font-family: var(--dronobox-font-mono);
        font-size: 10px;
        font-weight: 600;
        text-anchor: middle;
        fill: var(--wire);
    }
    &__rotor {
        transform-box: view-box;
        transform-origin: 0 0;
        transition: transform 0.35s var(--dronobox-ease-out);

        .is-north {
            fill: var(--dronobox-ink);
        }
        .is-south {
            fill: var(--dronobox-line-strong);
        }
    }
    &__hub {
        fill: var(--dronobox-bg-0);
    }

    &__traces {
        display: grid;
        gap: 0.55rem;
    }
    &__row {
        display: grid;
        grid-template-columns: 1.25rem minmax(0, 1fr) 1.75rem;
        align-items: center;
        gap: 0.5rem;

        svg {
            display: block;
            width: 100%;
            height: 1.6rem;
            overflow: visible;
        }
    }
    &__wire {
        display: grid;
        place-items: center;
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        background: var(--wire);
        color: var(--dronobox-on-accent);
        font-family: var(--dronobox-font-mono);
        font-size: 0.7rem;
        font-weight: 700;
    }
    &__trace {
        fill: none;
        stroke: var(--wire);
        stroke-width: 2;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
    }
    &__zero {
        stroke: var(--dronobox-line-strong);
        stroke-dasharray: 2 3;
        vector-effect: non-scaling-stroke;
    }
    &__now {
        fill: color-mix(in srgb, var(--dronobox-ink) 8%, transparent);
        transition: x 0.12s linear;
    }
    &.is-running &__now {
        fill: color-mix(in srgb, var(--dronobox-ink) 16%, transparent);
    }
    &__level {
        font-family: var(--dronobox-font-mono);
        font-size: 0.78rem;
        color: var(--dronobox-ink-soft);
        text-align: right;
    }

    @media (max-width: 420px) {
        grid-template-columns: 1fr;

        &__motor {
            max-width: 10rem;
            justify-self: center;
        }
    }
}
</style>
