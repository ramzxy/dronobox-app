<template>
    <div class="logo dronobox-logo" :title="tooltip">
        <svg class="dronobox-logo__mark" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M9 9 L23 23 M23 9 L9 23" />
            <circle cx="7" cy="7" r="5" />
            <circle cx="25" cy="7" r="5" />
            <circle cx="7" cy="25" r="5" />
            <circle cx="25" cy="25" r="5" />
            <rect x="12" y="12" width="8" height="8" rx="2" />
        </svg>
        <div class="dronobox-logo__text">
            <strong>DronoBox</strong>
            <span>{{ $t("dronobox:logoByline") }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { i18n } from "@/js/localization";

const props = defineProps<{
    configuratorVersion: string;
    firmwareVersion?: string;
    firmwareId?: string;
    hardwareId?: string;
}>();

const tooltip = computed(() => {
    const lines = [`${i18n.getMessage("dronobox:logoBasedOn")} ${props.configuratorVersion}`];
    if (props.firmwareVersion && props.firmwareId) {
        lines.push(`${i18n.getMessage("versionLabelFirmware")}: ${props.firmwareVersion} ${props.firmwareId}`);
    }
    if (props.hardwareId) {
        lines.push(`${i18n.getMessage("versionLabelTarget")}: ${props.hardwareId}`);
    }
    return lines.join("\n");
});
</script>

<style lang="less">
.tab_container .dronobox-logo {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.35rem 0.25rem 0.6rem;
    margin-bottom: 0.5rem;

    .dronobox-logo__mark {
        flex: none;
        width: 2.25rem;
        height: 2.25rem;

        path {
            stroke: var(--ui-text-highlighted);
            stroke-width: 3;
            stroke-linecap: round;
        }
        circle {
            fill: none;
            stroke: var(--ui-primary);
            stroke-width: 2;
        }
        rect {
            fill: var(--ui-text-highlighted);
        }
    }
    .dronobox-logo__text {
        display: grid;
        line-height: 1.1;

        strong {
            font-size: 1.35rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: var(--ui-text-highlighted);
        }
        span {
            font-size: 0.68rem;
            color: var(--ui-text-muted);
        }
    }

    @media (max-width: 1055px) {
        justify-content: center;

        .dronobox-logo__text {
            display: none;
        }
    }
}
</style>
