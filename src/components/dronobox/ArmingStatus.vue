<template>
    <div class="dronobox-arming">
        <p v-if="!reasons.length" class="dronobox-arming__clear">
            <UIcon name="i-lucide-check-circle-2" />
            {{ $t("dronobox:armingNone") }}
        </p>
        <ul v-else class="dronobox-arming__list">
            <li
                v-for="reason in reasons"
                :key="reason"
                class="dronobox-arming__item"
                :class="{ 'is-expected': EXPECTED_WHILE_CONNECTED.has(reason) }"
            >
                <UIcon
                    :name="EXPECTED_WHILE_CONNECTED.has(reason) ? 'i-lucide-usb' : 'i-lucide-circle-alert'"
                    class="dronobox-arming__icon"
                />
                <span>
                    {{ EXPLAINED_FLAGS.has(reason) ? $t(`dronobox:arming${reason}`) : reason }}
                </span>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { EXPECTED_WHILE_CONNECTED, EXPLAINED_FLAGS } from "@/dronobox/armingReasons";

defineProps<{ reasons: readonly string[] }>();
</script>

<style lang="less">
.dronobox-arming {
    font-size: 0.85rem;

    &__clear {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0;
        color: var(--ui-success);
    }
    &__list {
        display: grid;
        gap: 0.4rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    &__item {
        display: flex;
        align-items: flex-start;
        gap: 0.4rem;
        line-height: 1.35;
        color: var(--ui-text);

        &.is-expected {
            color: var(--ui-text-muted);
        }
    }
    &__icon {
        flex: none;
        width: 1rem;
        height: 1rem;
        margin-top: 0.1rem;
        color: var(--ui-warning);
    }
    &__item.is-expected &__icon {
        color: var(--ui-text-muted);
    }
}
</style>
