<template>
    <UModal v-model:open="open" :title="$t('dronobox:instructorTitle')" class="dronobox-instructor-dialog">
        <template #body>
            <form class="dronobox-instructor-dialog__form" @submit.prevent="onSubmit">
                <p class="dronobox-instructor-dialog__text">{{ $t("dronobox:instructorText") }}</p>
                <label class="dronobox-instructor-dialog__field">
                    <span>{{ $t("dronobox:instructorPin") }}</span>
                    <UInput
                        v-model="pin"
                        type="password"
                        inputmode="numeric"
                        autocomplete="off"
                        autofocus
                        :color="wrong ? 'error' : undefined"
                        @update:model-value="wrong = false"
                    />
                </label>
                <p v-if="wrong" class="dronobox-instructor-dialog__error">{{ $t("dronobox:instructorWrong") }}</p>
            </form>
        </template>
        <template #footer>
            <div class="flex w-full justify-end gap-2">
                <UButton color="neutral" variant="ghost" :label="$t('cancel')" @click="open = false" />
                <UButton :label="$t('dronobox:instructorUnlock')" icon="i-lucide-unlock" @click="onSubmit" />
            </div>
        </template>
    </UModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useDronoBoxStore } from "@/stores/dronobox";

const open = defineModel<boolean>("open", { required: true });
const store = useDronoBoxStore();
const pin = ref("");
const wrong = ref(false);

watch(open, (value) => {
    if (value) {
        pin.value = "";
        wrong.value = false;
    }
});

function onSubmit(): void {
    if (store.unlock(pin.value)) {
        open.value = false;
    } else {
        wrong.value = true;
    }
}
</script>

<style lang="less">
.dronobox-instructor-dialog {
    &__form {
        display: grid;
        gap: 0.75rem;
    }
    &__text {
        margin: 0;
        color: var(--ui-text-muted);
    }
    &__field {
        display: grid;
        gap: 0.35rem;
        font-weight: 600;
    }
    &__error {
        margin: 0;
        color: var(--ui-error);
    }
}
</style>
