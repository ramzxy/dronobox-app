<template>
    <div class="dronobox-welcome">
        <div class="dronobox-welcome__inner">
            <div class="dronobox-welcome__lang" role="group" :aria-label="$t('dronobox:welcomeLanguage')">
                <UButton
                    v-for="lang in LANGUAGES"
                    :key="lang.code"
                    size="xs"
                    :variant="currentLanguage === lang.code ? 'soft' : 'ghost'"
                    color="neutral"
                    :label="lang.label"
                    @click="setLanguage(lang.code)"
                />
            </div>

            <p class="dronobox-welcome__eyebrow">{{ $t("dronobox:welcomeEyebrow") }}</p>
            <h1 class="dronobox-welcome__title">{{ $t("dronobox:welcomeTitle") }}</h1>
            <p class="dronobox-welcome__lead">{{ $t("dronobox:welcomeLead") }}</p>

            <p v-if="resume" class="dronobox-welcome__resume" role="status">
                <UIcon name="i-lucide-history" />
                <span>{{ $t("dronobox:welcomeResume", resume) }}</span>
            </p>

            <ol class="dronobox-welcome__steps">
                <li>
                    <span class="dronobox-welcome__num">1</span>
                    <div>
                        <strong>{{ $t("dronobox:welcomeStep1") }}</strong>
                        <span>{{ $t("dronobox:welcomeStep1Help") }}</span>
                    </div>
                </li>
                <li>
                    <span class="dronobox-welcome__num">2</span>
                    <div>
                        <strong>{{ $t("dronobox:welcomeStep2") }}</strong>
                        <span>{{ $t("dronobox:welcomeStep2Help") }}</span>
                    </div>
                </li>
                <li>
                    <span class="dronobox-welcome__num">3</span>
                    <div>
                        <strong>{{ $t("dronobox:welcomeStep3") }}</strong>
                        <span>{{ $t("dronobox:welcomeStep3Help") }}</span>
                    </div>
                </li>
            </ol>

            <details class="dronobox-welcome__trouble">
                <summary>{{ $t("dronobox:welcomeTroubleTitle") }}</summary>
                <ul>
                    <li>{{ $t("dronobox:welcomeTrouble1") }}</li>
                    <li>{{ $t("dronobox:welcomeTrouble2") }}</li>
                    <li>{{ $t("dronobox:welcomeTrouble3") }}</li>
                    <li>{{ $t("dronobox:welcomeTrouble4") }}</li>
                </ul>
            </details>

            <p class="dronobox-welcome__footer">
                {{ $t("dronobox:welcomeFooter") }}
                <a :href="DRONOBOX_KIT.sourceUrl" target="_blank" rel="noopener noreferrer">
                    {{ $t("dronobox:welcomeSource") }}
                </a>
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { i18n } from "@/js/localization";
import { DRONOBOX_KIT } from "@/dronobox/kit";
import { DRONOBOX_STEPS, useDronoBoxStore } from "@/stores/dronobox";

const store = useDronoBoxStore();

// A cable knocked loose or a save that did not reconnect lands here mid-flow; say where the
// group was so they know pressing Connect carries on rather than starting over.
const resume = computed(() => {
    if (!store.completed.length) {
        return null;
    }
    const name = store.step;
    return {
        n: DRONOBOX_STEPS.indexOf(name) + 1,
        step: i18n.getMessage(`dronobox:step${name.charAt(0).toUpperCase()}${name.slice(1)}`),
    };
});

const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "nl", label: "Nederlands" },
];

const currentLanguage = ref(i18n.getCurrentLocale().split("-")[0]);

function setLanguage(code: string): void {
    i18n.changeLanguage(code);
    currentLanguage.value = code;
}
</script>

<style lang="less">
.dronobox-welcome {
    display: flex;
    justify-content: center;
    width: 100%;
    min-height: 100%;
    padding: clamp(1.5rem, 6vh, 4rem) 1.5rem 2rem;
    background: var(--ui-bg);

    &__inner {
        position: relative;
        width: 100%;
        max-width: 44rem;
    }
    &__lang {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        gap: 0.25rem;
    }
    &__eyebrow {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ui-primary);
    }
    &__title {
        margin: 0.4rem 0 0;
        font-size: clamp(2rem, 4.5vw, 3rem);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -0.02em;
        color: var(--ui-text-highlighted);
    }
    &__lead {
        margin: 0.75rem 0 0;
        font-size: 1.1rem;
        line-height: 1.5;
        color: var(--ui-text-muted);
    }
    &__resume {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin: 1.5rem 0 0;
        padding: 0.8rem 1rem;
        border: 1px solid var(--ui-primary);
        border-radius: 0.75rem;
        font-weight: 600;
        color: var(--ui-text-highlighted);

        .iconify {
            flex: none;
            width: 1.25rem;
            height: 1.25rem;
            color: var(--ui-primary);
        }
    }
    &__steps {
        display: grid;
        gap: 0.75rem;
        margin: 2rem 0 0;
        padding: 0;
        list-style: none;

        li {
            display: flex;
            gap: 0.9rem;
            align-items: flex-start;
            padding: 1rem 1.1rem;
            border: 1px solid var(--ui-border);
            border-radius: 0.75rem;
            background: var(--ui-bg-elevated);
        }
        div {
            display: grid;
            gap: 0.2rem;
        }
        strong {
            font-size: 1.05rem;
            color: var(--ui-text-highlighted);
        }
        span {
            color: var(--ui-text-muted);
            line-height: 1.45;
        }
    }
    &__num {
        flex: none;
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        background: var(--ui-primary);
        color: var(--ui-bg);
        font-weight: 800;
    }
    &__trouble {
        margin-top: 1.5rem;
        color: var(--ui-text-muted);

        summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--ui-text);
        }
        ul {
            display: grid;
            gap: 0.35rem;
            margin: 0.6rem 0 0;
            padding-left: 1.25rem;
            line-height: 1.45;
        }
    }
    &__footer {
        margin: 2.5rem 0 0;
        font-size: 0.8rem;
        color: var(--ui-text-dimmed);

        a {
            color: var(--ui-text-muted);
            text-decoration: underline;
        }
    }

    @media (max-width: 575px) {
        &__lang {
            position: static;
            margin-bottom: 1rem;
        }
    }
}
</style>
