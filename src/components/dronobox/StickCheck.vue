<template>
    <div class="dronobox-sticks">
        <ol class="dronobox-sticks__tasks">
            <li
                v-for="task in TASKS"
                :key="task.id"
                class="dronobox-sticks__task"
                :class="{ 'is-done': done.has(task.id), 'is-current': task.id === currentTask }"
            >
                <UIcon
                    :name="done.has(task.id) ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                    class="dronobox-sticks__task-icon"
                />
                <span>{{ $t(`dronobox:${task.label}`) }}</span>
            </li>
        </ol>

        <div class="dronobox-sticks__bars">
            <div v-for="channel in visibleChannels" :key="channel.index" class="dronobox-sticks__row">
                <div class="dronobox-sticks__name">
                    <strong>{{ $t(`dronobox:${channel.label}`) }}</strong>
                    <span>{{ $t(`dronobox:${channel.help}`) }}</span>
                </div>
                <div class="dronobox-sticks__track" :aria-label="$t(`dronobox:${channel.label}`)">
                    <div class="dronobox-sticks__mid"></div>
                    <div class="dronobox-sticks__knob" :style="{ left: `${percent(channel.value)}%` }"></div>
                </div>
                <code class="dronobox-sticks__value">{{ channel.value || "—" }}</code>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";

const props = defineProps<{ channels: readonly number[] }>();
const emit = defineEmits<{ complete: [] }>();

const HIGH = 1850;
const LOW = 1150;

const CHANNELS = [
    { index: 3, label: "radioThrottle", help: "radioThrottleHelp" },
    { index: 2, label: "radioYaw", help: "radioYawHelp" },
    { index: 1, label: "radioPitch", help: "radioPitchHelp" },
    { index: 0, label: "radioRoll", help: "radioRollHelp" },
    { index: 4, label: "radioAux1", help: "radioAuxHelp" },
];

type TaskId = "throttleUp" | "throttleDown" | "yawLeft" | "pitchForward" | "rollRight";

// Each task waits for the one before it, so a stick that happens to rest high does not tick
// several boxes at once and the participant actually moves each stick.
const TASKS: { id: TaskId; label: string; check: (ch: readonly number[]) => boolean }[] = [
    { id: "throttleUp", label: "radioTaskThrottleUp", check: (ch) => ch[3] > HIGH },
    { id: "throttleDown", label: "radioTaskThrottleDown", check: (ch) => ch[3] > 0 && ch[3] < LOW },
    { id: "yawLeft", label: "radioTaskYawLeft", check: (ch) => ch[2] > 0 && ch[2] < LOW },
    { id: "pitchForward", label: "radioTaskPitchForward", check: (ch) => ch[1] > HIGH },
    { id: "rollRight", label: "radioTaskRollRight", check: (ch) => ch[0] > HIGH },
];

const done = reactive(new Set<TaskId>());
const currentTask = computed(() => TASKS.find((task) => !done.has(task.id))?.id ?? null);

const visibleChannels = computed(() =>
    CHANNELS.filter((channel) => channel.index < Math.max(props.channels.length, 4)).map((channel) => ({
        ...channel,
        value: props.channels[channel.index] ?? 0,
    })),
);

function percent(value: number): number {
    if (!value) {
        return 50;
    }
    return Math.min(100, Math.max(0, ((value - 1000) / 1000) * 100));
}

watch(
    () => props.channels,
    (channels) => {
        const task = TASKS.find((candidate) => candidate.id === currentTask.value);
        if (task?.check(channels)) {
            done.add(task.id);
            if (!currentTask.value) {
                emit("complete");
            }
        }
    },
    { deep: true },
);
</script>

<style lang="less">
.dronobox-sticks {
    display: grid;
    gap: 1.25rem;

    &__tasks {
        display: grid;
        gap: 0.4rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    &__task {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--ui-text-muted);

        &.is-current {
            color: var(--ui-text-highlighted);
            font-weight: 600;
        }
        &.is-done {
            color: var(--ui-success);
        }
    }
    &__task-icon {
        flex: none;
        width: 1.1rem;
        height: 1.1rem;
    }
    &__bars {
        display: grid;
        gap: 0.75rem;
    }
    &__row {
        display: grid;
        grid-template-columns: minmax(9rem, 13rem) 1fr 3.5rem;
        align-items: center;
        gap: 0.75rem;
    }
    &__name {
        display: grid;
        line-height: 1.25;

        span {
            font-size: 0.75rem;
            color: var(--ui-text-muted);
        }
    }
    &__track {
        position: relative;
        height: 0.75rem;
        border-radius: 999px;
        background: var(--ui-bg-accented);
    }
    &__mid {
        position: absolute;
        left: 50%;
        top: -0.2rem;
        bottom: -0.2rem;
        width: 1px;
        background: var(--ui-border-accented);
    }
    &__knob {
        position: absolute;
        top: 50%;
        width: 1.1rem;
        height: 1.1rem;
        border-radius: 999px;
        background: var(--ui-primary);
        transform: translate(-50%, -50%);
        transition: left 0.05s linear;
    }
    &__value {
        font-size: 0.8rem;
        text-align: right;
        color: var(--ui-text-muted);
    }

    @media (max-width: 640px) {
        &__row {
            grid-template-columns: 1fr 3rem;
        }
        &__track {
            grid-column: 1 / -1;
            grid-row: 2;
        }
    }
}
</style>
