<!--
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
-->
<template>
    <section class="dbx-axis-explorer" :class="`is-${model?.axis ?? 'live'}`">
        <div class="dbx-axis-explorer__heading">
            <h2>{{ $t("dronobox:exploreAxes") }}</h2>
            <span v-if="model">{{ $t("dronobox:axisSimulation") }}</span>
        </div>
        <div class="dbx-axis-explorer__choices" role="group" :aria-label="$t('dronobox:exploreAxes')">
            <button
                v-for="axis in AXES"
                :key="axis"
                type="button"
                :aria-pressed="model?.axis === axis"
                @click="model = { axis, angle: 0 }"
            >
                {{ $t(`dronobox:axis${axis[0].toUpperCase()}${axis.slice(1)}`) }}
            </button>
            <button type="button" :aria-pressed="!model" @click="model = null">
                {{ $t("dronobox:axisLive") }}
            </button>
        </div>
        <template v-if="model">
            <p>{{ $t(`dronobox:explore${model.axis[0].toUpperCase()}${model.axis.slice(1)}`) }}</p>
            <div class="dbx-axis-explorer__readout">
                <label for="dbx-axis-angle">{{ $t("dronobox:axisAngle") }}</label>
                <output for="dbx-axis-angle">{{ model.angle > 0 ? "+" : "" }}{{ Math.round(model.angle) }}°</output>
            </div>
            <input
                id="dbx-axis-angle"
                type="range"
                min="-45"
                max="45"
                step="1"
                :value="model.angle"
                @input="model = { axis: model.axis, angle: Number(($event.target as HTMLInputElement).value) }"
            />
            <div class="dbx-axis-explorer__scale"><span>−45°</span><span>0°</span><span>+45°</span></div>
            <p class="dbx-axis-explorer__hint">{{ $t("dronobox:axisDragHint") }}</p>
        </template>
        <p v-else>{{ $t("dronobox:axisIntro") }}</p>
    </section>
</template>

<script setup lang="ts">
import type { AxisDemo } from "@/dronobox/stage/KitStage";
const AXES = ["roll", "pitch", "yaw"] as const;
const model = defineModel<AxisDemo | null>({ required: true });
</script>

<style lang="less">
.dbx-axis-explorer {
    --axis: var(--dronobox-accent);
    display: grid;
    gap: 0.75rem;
    padding: 1rem 0;
    border-block: 1px solid var(--dronobox-line);
    &.is-roll {
        --axis: var(--dronobox-roll);
    }
    &.is-pitch {
        --axis: var(--dronobox-pitch);
    }
    &.is-yaw {
        --axis: var(--dronobox-yaw);
    }
    &__heading,
    &__readout,
    &__scale {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
    }
    &__heading h2 {
        margin: 0;
    }
    &__heading span,
    &__scale,
    &__hint {
        font-size: 0.75rem;
        color: var(--dronobox-ink-soft);
    }
    &__choices {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.25rem;
    }
    &__choices button {
        min-height: 2.75rem;
        border: 1px solid var(--dronobox-line);
        border-radius: 0.5rem;
        background: transparent;
        color: var(--dronobox-ink-soft);
        font-weight: 600;
        cursor: pointer;
        transition:
            background-color 160ms ease,
            color 160ms ease;
        &[aria-pressed="true"] {
            background: var(--dronobox-panel-raised);
            color: var(--dronobox-ink);
            border-color: var(--axis);
        }
    }
    p {
        margin: 0;
        line-height: 1.55;
        color: var(--dronobox-ink-soft);
    }
    output {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--axis);
        font-variant-numeric: tabular-nums;
    }
    input {
        width: 100%;
        min-height: 1.5rem;
        accent-color: var(--axis);
        cursor: ew-resize;
    }
}
</style>
