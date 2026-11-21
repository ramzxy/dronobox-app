<template>
    <div
        ref="root"
        class="kit-stage"
        :class="{ 'is-draggable': draggable }"
        @lostpointercapture="onPointerUp"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
    >
        <canvas ref="canvas" class="kit-stage__canvas" aria-hidden="true"></canvas>
        <div class="kit-stage__labels" aria-hidden="true">
            <button
                v-for="part in KIT_PARTS"
                :key="part"
                :ref="(el) => setLabel(part, el as HTMLElement | null)"
                type="button"
                tabindex="-1"
                class="kit-stage__label"
                :class="{ 'is-active': highlight === part, 'is-open': fact?.part === part }"
                @pointerdown.stop
                @click="emit('pick', part)"
                @mouseenter="emit('hover', part)"
                @mouseleave="emit('hover', null)"
            >
                {{ $t(`dronobox:part${part.charAt(0).toUpperCase()}${part.slice(1)}`) }}
            </button>
        </div>
        <Transition name="kit-stage-bubble">
            <aside v-if="fact" :key="fact.part" ref="bubble" class="kit-stage__bubble" @pointerdown.stop>
                <span class="kit-stage__bubble-dot" aria-hidden="true"></span>
                <header>
                    <strong>{{ fact.title }}</strong>
                    <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-x"
                        :aria-label="$t('close')"
                        @click="emit('close')"
                    />
                </header>
                <p>{{ fact.body }}</p>
            </aside>
        </Transition>
        <p v-if="state === 'loading'" class="kit-stage__status">{{ $t("dronobox:stageLoading") }}</p>
        <p v-else-if="state === 'failed'" class="kit-stage__status">{{ $t("dronobox:stageFailed") }}</p>
        <div v-if="state === 'ready'" class="kit-stage__toolbar" @pointerdown.stop @wheel.stop>
            <span class="kit-stage__hint">{{
                $t(input.axisDemo ? "dronobox:axisStageHint" : "dronobox:stageHint")
            }}</span>
            <div class="kit-stage__tools">
                <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-minus"
                    :aria-label="$t('dronobox:stageZoomOut')"
                    :title="$t('dronobox:stageZoomOut')"
                    @click="zoomOut"
                />
                <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-plus"
                    :aria-label="$t('dronobox:stageZoomIn')"
                    :title="$t('dronobox:stageZoomIn')"
                    @click="zoomIn"
                />
                <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-scan"
                    :aria-label="$t('dronobox:stageReset')"
                    :title="$t('dronobox:stageReset')"
                    @click="resetView"
                />
            </div>
        </div>
        <slot />
    </div>
</template>

<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { loadKitMesh } from "@/dronobox/stage/kitMesh";
import { KIT_PARTS, KitStage, type KitPart, type LabelAnchor, type StageInput } from "@/dronobox/stage/KitStage";

const props = withDefaults(
    defineProps<{
        input: Partial<StageInput>;
        highlight?: KitPart | null;
        /** A part's explanation, shown in a bubble pinned to the part on the model. */
        fact?: { part: KitPart; title: string; body: string } | null;
        draggable?: boolean;
    }>(),
    { highlight: null, fact: null, draggable: true },
);

const emit = defineEmits<{
    pick: [part: KitPart];
    hover: [part: KitPart | null];
    turn: [delta: number];
    close: [];
}>();
const bubble = ref<HTMLElement | null>(null);

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const state = ref<"loading" | "ready" | "failed">("loading");
const labels = new Map<KitPart, HTMLElement>();
let stage: KitStage | null = null;
let observer: ResizeObserver | null = null;
let unmounted = false;
let intersection: IntersectionObserver | null = null;
let inView = true;
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
function syncMotion(): void {
    stage?.setReducedMotion(motionPreference.matches);
}
function syncVisibility(): void {
    if (document.hidden || !inView) stage?.stop();
    else stage?.start();
}

function setLabel(part: KitPart, el: HTMLElement | null): void {
    if (el) {
        labels.set(part, el);
    } else {
        labels.delete(part);
    }
}

function placeBubble(anchor: LabelAnchor | undefined): void {
    const el = bubble.value;
    if (!el) {
        return;
    }
    if (!anchor?.visible) {
        el.classList.remove("is-visible");
        return;
    }
    // Beside the part on whichever side has room; on a narrow stage, under or over it instead,
    // so the bubble never hides the part it explains. Never under the toolbar.
    const width = root.value?.clientWidth ?? 0;
    const height = root.value?.clientHeight ?? 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 18;
    let x: number;
    let y: number;
    if (anchor.x + gap + w <= width - 12) {
        x = anchor.x + gap;
        y = Math.max(72, Math.min(height - h - 16, anchor.y - 22));
    } else if (anchor.x - gap - w >= 12) {
        x = anchor.x - gap - w;
        y = Math.max(72, Math.min(height - h - 16, anchor.y - 22));
    } else {
        x = Math.max(12, Math.min(width - w - 12, anchor.x - w / 2));
        const below = anchor.y + gap + h <= height - 16;
        y = below ? anchor.y + gap : Math.max(72, anchor.y - gap - h);
    }
    const transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    if (el.style.transform !== transform) el.style.transform = transform;
    el.style.setProperty("--dot-x", `${(anchor.x - x).toFixed(1)}px`);
    el.style.setProperty("--dot-y", `${(anchor.y - y).toFixed(1)}px`);
    el.classList.add("is-visible");
}

function placeLabels(anchors: LabelAnchor[]): void {
    placeBubble(props.fact ? anchors.find((anchor) => anchor.part === props.fact?.part) : undefined);
    for (const anchor of anchors) {
        const el = labels.get(anchor.part);
        if (!el) {
            continue;
        }
        if (!anchor.visible) {
            el.classList.remove("is-visible");
            continue;
        }
        const width = root.value?.clientWidth ?? 0;
        const height = root.value?.clientHeight ?? 0;
        const x = Math.max(8, Math.min(width - el.offsetWidth - 16, anchor.x));
        const y = Math.max(72, Math.min(height - 40, anchor.y));
        const transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        if (el.style.transform !== transform) el.style.transform = transform;
        el.classList.toggle("is-visible", anchor.visible);
    }
}

let dragging = false;
let activePointer: number | null = null;
let lastX = 0;
let lastY = 0;

function onPointerDown(event: PointerEvent): void {
    if (
        !props.draggable ||
        activePointer !== null ||
        event.button !== 0 ||
        (event.target as HTMLElement).closest("button, input, a")
    ) {
        return;
    }
    dragging = true;
    activePointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
    if (!dragging || !stage || event.pointerId !== activePointer) {
        return;
    }
    if (props.input.axisDemo) {
        emit("turn", (event.clientX - lastX - (event.clientY - lastY)) * 0.45);
    } else {
        stage.drag(event.clientX - lastX, event.clientY - lastY);
    }
    lastX = event.clientX;
    lastY = event.clientY;
}

function onPointerUp(): void {
    const pointer = activePointer;
    activePointer = null;
    dragging = false;
    if (pointer !== null && root.value?.hasPointerCapture(pointer)) root.value.releasePointerCapture(pointer);
    stage?.endDrag();
}

function zoomIn(): void {
    stage?.zoom(-180);
}
function zoomOut(): void {
    stage?.zoom(180);
}
function resetView(): void {
    stage?.resetView();
}

function onWheel(event: WheelEvent): void {
    if (!props.draggable || !stage) {
        return;
    }
    event.preventDefault();
    stage.zoom(event.deltaY);
}

watch(
    () => ({ ...props.input, highlight: props.highlight ?? null }),
    (input) => stage?.update(input),
    { deep: true },
);

onMounted(async () => {
    try {
        const geometries = await loadKitMesh();
        if (!canvas.value || !root.value || unmounted) {
            return;
        }
        stage = markRaw(new KitStage(canvas.value, geometries));
        stage.onAnchors = placeLabels;
        stage.update({ ...props.input, highlight: props.highlight ?? null });
        observer = new ResizeObserver(([entry]) => {
            stage?.resize(entry.contentRect.width, entry.contentRect.height);
        });
        observer.observe(root.value);
        const box = root.value.getBoundingClientRect();
        stage.resize(box.width, box.height);
        syncMotion();
        document.addEventListener("visibilitychange", syncVisibility);
        motionPreference.addEventListener("change", syncMotion);
        intersection = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            syncVisibility();
        });
        intersection.observe(root.value);
        syncVisibility();
        state.value = "ready";
    } catch (error) {
        console.error("DronoBox: 3D stage failed", error);
        state.value = "failed";
    }
});

onBeforeUnmount(() => {
    unmounted = true;
    observer?.disconnect();
    intersection?.disconnect();
    document.removeEventListener("visibilitychange", syncVisibility);
    motionPreference.removeEventListener("change", syncMotion);
    stage?.dispose();
    stage = null;
});
</script>

<style lang="less">
.kit-stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 16rem;
    overflow: hidden;
    touch-action: pan-y;

    &.is-draggable {
        cursor: grab;
        // Dragging turns the camera in both directions, so touch must not scroll the page here.
        touch-action: none;
    }
    &.is-draggable:active {
        cursor: grabbing;
    }

    &__toolbar {
        position: absolute;
        inset: 1.25rem 1.25rem auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        pointer-events: none;
    }
    &__hint {
        font-family: var(--dronobox-font-mono);
        color: var(--dronobox-ink-faint);
        font-size: 0.72rem;
    }
    &__tools {
        display: flex;
        pointer-events: auto;
        background: var(--dronobox-chip);
        box-shadow: inset 0 0 0 1px var(--dronobox-line);
        border-radius: 999px;
        padding: 0.2rem;
        button {
            min-width: 2.5rem;
            min-height: 2.5rem;
            justify-content: center;
        }
    }
    &__canvas {
        display: block;
        width: 100%;
        height: 100%;
    }

    &__labels {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    &__label {
        position: absolute;
        top: 0;
        left: 0;
        margin: -0.85rem 0 0 0.5rem;
        padding: 0.2rem 0.6rem;
        border: 1px solid var(--dronobox-line);
        border-radius: 999px;
        background: var(--dronobox-chip);
        color: var(--dronobox-ink);
        font-size: 0.78rem;
        font-weight: 560;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition:
            opacity 0.4s var(--dronobox-ease-soft),
            background-color 0.25s var(--dronobox-ease-soft),
            border-color 0.25s var(--dronobox-ease-soft),
            color 0.25s var(--dronobox-ease-soft);

        &.is-visible {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
        }
        &.is-active {
            border-color: var(--dronobox-button);
            background: var(--dronobox-button);
            color: var(--dronobox-on-accent);
        }
        &.is-open.is-visible {
            opacity: 0;
            pointer-events: none;
        }
    }

    &__bubble {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 3;
        width: min(19rem, calc(100% - 2rem));
        padding: 0.85rem 0.9rem 0.95rem 1rem;
        border-radius: 1rem;
        background: var(--dronobox-chip);
        box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
        backdrop-filter: blur(10px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s var(--dronobox-ease-soft);

        &.is-visible {
            opacity: 1;
            pointer-events: auto;
        }
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            margin: -0.2rem -0.3rem 0.35rem 0;
        }
        strong {
            font-size: 1.05rem;
            font-weight: 620;
            font-stretch: 106%;
        }
        p {
            margin: 0;
            font-size: 0.9rem;
            line-height: 1.5;
            color: var(--dronobox-ink-soft);
        }
    }
    &__bubble-dot {
        position: absolute;
        left: var(--dot-x, 0);
        top: var(--dot-y, 0);
        width: 0.6rem;
        height: 0.6rem;
        margin: -0.3rem 0 0 -0.3rem;
        border-radius: 999px;
        background: var(--dronobox-button);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--dronobox-button) 22%, transparent);
    }

    &__status {
        position: absolute;
        left: 50%;
        top: 50%;
        margin: 0;
        transform: translate(-50%, -50%);
        color: var(--dronobox-ink-soft);
        font-size: 0.9rem;
    }

    @media (prefers-reduced-motion: reduce) {
        &__label {
            transition: none;
        }
    }
}

.kit-stage-bubble-enter-active {
    transition: scale 0.45s var(--dronobox-ease-out);
}
.kit-stage-bubble-enter-from {
    scale: 0.96;
}
</style>
