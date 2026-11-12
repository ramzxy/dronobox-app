<template>
    <div
        ref="root"
        class="kit-stage"
        :class="{ 'is-draggable': draggable }"
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
                :class="{ 'is-active': highlight === part }"
                @pointerdown.stop
                @click="emit('pick', part)"
                @mouseenter="emit('hover', part)"
                @mouseleave="emit('hover', null)"
            >
                {{ $t(`dronobox:part${part.charAt(0).toUpperCase()}${part.slice(1)}`) }}
            </button>
        </div>
        <p v-if="state === 'loading'" class="kit-stage__status">{{ $t("dronobox:stageLoading") }}</p>
        <p v-else-if="state === 'failed'" class="kit-stage__status">{{ $t("dronobox:stageFailed") }}</p>
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
        draggable?: boolean;
    }>(),
    { highlight: null, draggable: true },
);

const emit = defineEmits<{ pick: [part: KitPart]; hover: [part: KitPart | null] }>();

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const state = ref<"loading" | "ready" | "failed">("loading");
const labels = new Map<KitPart, HTMLElement>();
let stage: KitStage | null = null;
let observer: ResizeObserver | null = null;
let unmounted = false;

function setLabel(part: KitPart, el: HTMLElement | null): void {
    if (el) {
        labels.set(part, el);
    } else {
        labels.delete(part);
    }
}

function placeLabels(anchors: LabelAnchor[]): void {
    for (const anchor of anchors) {
        const el = labels.get(anchor.part);
        if (!el) {
            continue;
        }
        el.style.transform = `translate(${anchor.x.toFixed(1)}px, ${anchor.y.toFixed(1)}px)`;
        el.classList.toggle("is-visible", anchor.visible);
    }
}

let dragging = false;
let lastX = 0;
let lastY = 0;

function onPointerDown(event: PointerEvent): void {
    if (!props.draggable) {
        return;
    }
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
    if (!dragging || !stage) {
        return;
    }
    stage.drag(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
}

function onPointerUp(): void {
    dragging = false;
    stage?.endDrag();
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
        stage.start();
        state.value = "ready";
    } catch (error) {
        console.error("DronoBox: 3D stage failed", error);
        state.value = "failed";
    }
});

onBeforeUnmount(() => {
    unmounted = true;
    observer?.disconnect();
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
        font-weight: 600;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition:
            opacity 0.3s ease,
            background-color 0.2s ease,
            border-color 0.2s ease;
        will-change: transform;

        &.is-visible {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
        }
        &.is-active {
            border-color: var(--dronobox-accent);
            background: var(--dronobox-accent);
            color: var(--dronobox-on-accent);
        }
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
</style>
