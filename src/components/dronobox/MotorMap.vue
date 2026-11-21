<template>
    <svg
        class="dronobox-motor-map"
        :class="{ 'is-edit': !!directions, 'is-disabled': disabled }"
        viewBox="0 0 260 290"
        role="group"
        :aria-label="$t('dronobox:motorsMapLabel')"
    >
        <defs>
            <marker
                id="dronobox-arrowhead"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
            >
                <path d="M 0 0 L 10 5 L 0 10 z" class="dronobox-motor-map__arrowhead" />
            </marker>
        </defs>

        <text x="130" y="16" text-anchor="middle" class="dronobox-motor-map__front">
            ▲ {{ $t("dronobox:motorsFront") }}
        </text>

        <line
            v-for="motor in placed"
            :key="`arm-${motor.number}`"
            :x1="CENTER.x"
            :y1="CENTER.y"
            :x2="motor.x"
            :y2="motor.y"
            class="dronobox-motor-map__arm"
        />
        <polygon :points="bodyPoints" class="dronobox-motor-map__body" />
        <path :d="`M ${CENTER.x} ${CENTER.y - 22} l -9 14 h 18 z`" class="dronobox-motor-map__fc-arrow" />

        <g
            v-for="motor in placed"
            :key="motor.number"
            class="dronobox-motor-map__motor"
            :class="{
                'is-selected': motor.number === selected,
                'is-spinning': motor.number === spinning,
                'is-correct': checks[motor.number]?.correct === true,
                'is-wrong': checks[motor.number]?.correct === false,
                'is-cw': directions && motor.direction === 'cw',
                'is-ccw': directions && motor.direction === 'ccw',
            }"
            role="button"
            :tabindex="disabled ? -1 : 0"
            :aria-disabled="disabled || undefined"
            :aria-label="
                directions
                    ? $t('dronobox:motorsFlipMotor', {
                          n: motor.number,
                          direction: $t(motor.direction === 'cw' ? 'dronobox:motorsCw' : 'dronobox:motorsCcw'),
                      })
                    : $t('dronobox:motorsPickMotor', { n: motor.number })
            "
            :aria-pressed="directions ? undefined : motor.number === selected"
            @click="choose(motor.number)"
            @keydown.enter.prevent="choose(motor.number)"
            @keydown.space.prevent="choose(motor.number)"
        >
            <circle :cx="motor.x" :cy="motor.y" :r="PROP_R" class="dronobox-motor-map__disc" />
            <g
                class="dronobox-motor-map__prop"
                :class="propSpinClass(motor)"
                :style="{ transformOrigin: `${motor.x}px ${motor.y}px` }"
            >
                <ellipse :cx="motor.x" :cy="motor.y" :rx="PROP_R - 6" ry="5" />
            </g>
            <circle :cx="motor.x" :cy="motor.y" r="13" class="dronobox-motor-map__hub" />
            <text :x="motor.x" :y="motor.y + 4" text-anchor="middle" class="dronobox-motor-map__number">
                M{{ motor.number }}
            </text>

            <path
                v-if="showDirection(motor.number)"
                :d="arcPath(motor)"
                class="dronobox-motor-map__direction"
                marker-end="url(#dronobox-arrowhead)"
            />
            <text
                v-if="showDirection(motor.number)"
                :x="motor.x"
                :y="motor.y + PROP_R + 18"
                text-anchor="middle"
                class="dronobox-motor-map__label"
            >
                {{ motor.direction === "cw" ? $t("dronobox:motorsCwShort") : $t("dronobox:motorsCcwShort") }}
            </text>
        </g>
    </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { KitMotor, SpinDirection } from "@/dronobox/kit";
import type { MotorCheck } from "@/stores/dronobox";

const props = defineProps<{
    motors: readonly KitMotor[];
    checks: Record<number, MotorCheck>;
    selected: number | null;
    spinning: number | null;
    /** Show every expected direction, not only the ones already answered. */
    revealAll?: boolean;
    /** Edit mode: show these directions instead of the kit's; a tap asks to flip a motor. */
    directions?: Record<number, SpinDirection> | null;
    disabled?: boolean;
}>();

const emit = defineEmits<{ select: [number: number] }>();

function choose(number: number): void {
    if (!props.disabled) emit("select", number);
}

const CENTER = { x: 130, y: 150 };
const OFFSET = 78;
const PROP_R = 36;

const POSITIONS: Record<KitMotor["position"], { x: number; y: number }> = {
    frontLeft: { x: CENTER.x - OFFSET, y: CENTER.y - OFFSET },
    frontRight: { x: CENTER.x + OFFSET, y: CENTER.y - OFFSET },
    backLeft: { x: CENTER.x - OFFSET, y: CENTER.y + OFFSET },
    backRight: { x: CENTER.x + OFFSET, y: CENTER.y + OFFSET },
};

const placed = computed(() =>
    props.motors.map((motor) => ({
        ...motor,
        ...POSITIONS[motor.position],
        direction: props.directions?.[motor.number] ?? motor.direction,
    })),
);

const bodyPoints = computed(() =>
    Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        return `${CENTER.x + 34 * Math.cos(angle)},${CENTER.y + 34 * Math.sin(angle)}`;
    }).join(" "),
);

function showDirection(number: number): boolean {
    return !!props.directions || props.revealAll || props.checks[number]?.answer != null;
}

// Until a motor has been answered the drawing must not give away which way it should turn,
// so it pulses instead of rotating.
function propSpinClass(motor: KitMotor): string {
    if (!showDirection(motor.number)) {
        return "spin-unknown";
    }
    return motor.direction === "cw" ? "spin-cw" : "spin-ccw";
}

/** A third of a circle just outside the prop disc, drawn in the motor's direction of travel. */
function arcPath(motor: { x: number; y: number; direction: KitMotor["direction"] }): string {
    const r = PROP_R + 7;
    const start = (-150 * Math.PI) / 180;
    const end = (-30 * Math.PI) / 180;
    const [from, to] = motor.direction === "cw" ? [start, end] : [end, start];
    const sweep = motor.direction === "cw" ? 1 : 0;
    const x1 = motor.x + r * Math.cos(from);
    const y1 = motor.y + r * Math.sin(from);
    const x2 = motor.x + r * Math.cos(to);
    const y2 = motor.y + r * Math.sin(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`;
}
</script>

<style lang="less">
.dronobox-motor-map {
    width: 100%;
    max-width: 22rem;
    height: auto;
    user-select: none;

    &__front {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        fill: var(--ui-text-muted);
        text-transform: uppercase;
    }
    &__arm {
        stroke: var(--ui-border-accented);
        stroke-width: 10;
        stroke-linecap: round;
    }
    &__body {
        fill: var(--ui-bg-elevated);
        stroke: var(--ui-border-accented);
        stroke-width: 2;
    }
    &__fc-arrow {
        fill: var(--ui-text-muted);
    }
    &__motor {
        cursor: pointer;
        outline: none;
    }
    &__disc {
        fill: var(--ui-bg);
        stroke: var(--ui-border-accented);
        stroke-width: 2;
        stroke-dasharray: 4 4;
        transition: stroke 0.15s ease;
    }
    &__motor:hover &__disc,
    &__motor:focus-visible &__disc {
        stroke: var(--ui-primary);
    }
    &__motor.is-selected &__disc {
        stroke: var(--ui-primary);
        stroke-width: 3;
        stroke-dasharray: none;
    }
    &__motor.is-correct &__disc {
        stroke: var(--ui-success);
        stroke-dasharray: none;
    }
    &__motor.is-wrong &__disc {
        stroke: var(--ui-error);
        stroke-dasharray: none;
    }
    &__prop ellipse {
        fill: var(--ui-text-dimmed);
        opacity: 0.35;
    }
    &__motor.is-spinning &__prop {
        &.spin-cw {
            animation: dronobox-spin 0.35s linear infinite;
        }
        &.spin-ccw {
            animation: dronobox-spin 0.35s linear infinite reverse;
        }
        &.spin-unknown {
            animation: dronobox-pulse 0.6s ease-in-out infinite alternate;
        }
    }
    &__hub {
        fill: var(--ui-bg-elevated);
        stroke: var(--ui-text-muted);
        stroke-width: 2;
    }
    &__number {
        font-size: 11px;
        font-weight: 700;
        fill: var(--ui-text-highlighted);
    }
    &__direction {
        fill: none;
        stroke: var(--ui-primary);
        stroke-width: 3;
    }
    &__arrowhead {
        // Takes the colour of the arc it ends, so edit mode's two colours carry through.
        fill: context-stroke;
    }
    &__label {
        font-size: 11px;
        font-weight: 600;
        fill: var(--ui-primary);
    }

    // Edit mode: one colour per direction, so matching pairs show at a glance.
    &.is-edit &__motor {
        --direction: var(--dronobox-cw);
    }
    &.is-edit &__motor.is-ccw {
        --direction: var(--dronobox-ccw);
    }
    &.is-edit &__disc {
        stroke: var(--direction);
        stroke-dasharray: none;
        fill: color-mix(in srgb, var(--direction) 10%, transparent);
        transition:
            stroke 0.25s ease,
            fill 0.25s ease;
    }
    &.is-edit &__direction,
    &.is-edit &__label {
        stroke: var(--direction);
        transition: stroke 0.25s ease;
    }
    &.is-edit &__label {
        stroke: none;
        fill: var(--direction);
    }
    &.is-edit &__motor:hover &__disc,
    &.is-edit &__motor:focus-visible &__disc {
        fill: color-mix(in srgb, var(--direction) 22%, transparent);
    }
    &.is-edit &__motor:focus-visible &__disc {
        stroke-width: 3;
    }
    &.is-edit.is-disabled &__motor {
        cursor: default;
    }

    @media (prefers-reduced-motion: reduce) {
        &__motor.is-spinning &__prop {
            &.spin-cw,
            &.spin-ccw {
                animation-duration: 2s;
            }
        }
    }
}

@keyframes dronobox-spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes dronobox-pulse {
    to {
        transform: scale(1.12);
        opacity: 0.6;
    }
}
</style>
