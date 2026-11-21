<template>
    <div class="dronobox-welcome dark dronobox-backdrop">
        <section class="dronobox-welcome__copy">
            <div class="dronobox-welcome__top">
                <div class="dronobox-welcome__brand">
                    <strong>DronoBox</strong>
                    <span>DroneTeam Twente</span>
                </div>
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
            </div>

            <div class="dronobox-welcome__body">
                <h1 class="dronobox-welcome__title">{{ $t("dronobox:welcomeTitle") }}</h1>
                <p class="dronobox-welcome__lead">{{ $t("dronobox:welcomeLead") }}</p>

                <p v-if="resume" class="dronobox-welcome__resume" role="status">
                    <UIcon name="i-lucide-history" />
                    <span>{{ $t("dronobox:welcomeResume", resume) }}</span>
                </p>

                <ol class="dronobox-welcome__steps">
                    <li>
                        <span class="dronobox-welcome__num">01</span>
                        <div>
                            <strong>{{ $t("dronobox:welcomeStep1") }}</strong>
                            <span>{{ $t("dronobox:welcomeStep1Help") }}</span>
                        </div>
                    </li>
                    <li>
                        <span class="dronobox-welcome__num">02</span>
                        <div>
                            <strong>{{ $t("dronobox:welcomeStep2") }}</strong>
                            <span>{{ $t("dronobox:welcomeStep2Help") }}</span>
                        </div>
                    </li>
                </ol>

                <div class="dronobox-welcome__connect">
                    <ConnectButton />
                    <UButton
                        v-if="canDemo"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-flask-conical"
                        :label="$t('dronobox:welcomeDemo')"
                        @click="connectVirtual"
                    />
                </div>

                <details class="dronobox-welcome__trouble">
                    <summary>{{ $t("dronobox:welcomeTroubleTitle") }}</summary>
                    <ul>
                        <li>{{ $t("dronobox:welcomeTrouble1") }}</li>
                        <li>{{ $t("dronobox:welcomeTrouble2") }}</li>
                        <li>{{ $t("dronobox:welcomeTrouble3") }}</li>
                        <li>{{ $t("dronobox:welcomeTrouble4") }}</li>
                    </ul>
                </details>
            </div>

            <p class="dronobox-welcome__footer">
                {{ $t("dronobox:welcomeFooter") }}
                <a :href="DRONOBOX_KIT.sourceUrl" target="_blank" rel="noopener noreferrer">
                    {{ $t("dronobox:welcomeSource") }}
                </a>
                <button type="button" class="dronobox-welcome__instructor" @click="instructorOpen = true">
                    {{ $t("dronobox:instructorMenu") }}
                </button>
            </p>
        </section>

        <KitStageView
            class="dronobox-welcome__stage"
            :input="{ shot: lookInside ? 'meet' : 'hero', assembly: lookInside ? 1 : 0 }"
            draggable
        >
            <div class="dronobox-welcome__inspect" @pointerdown.stop>
                <span>{{ $t("dronobox:welcomeModel") }}</span>
                <UButton
                    color="neutral"
                    variant="outline"
                    :icon="lookInside ? 'i-lucide-box' : 'i-lucide-layers-3'"
                    :aria-pressed="lookInside"
                    :label="$t(lookInside ? 'dronobox:welcomeAssemble' : 'dronobox:welcomeLookInside')"
                    @click="lookInside = !lookInside"
                />
            </div>
        </KitStageView>
        <InstructorDialog v-model:open="instructorOpen" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { i18n } from "@/js/localization";
import { DRONOBOX_KIT } from "@/dronobox/kit";
import { DRONOBOX_STEPS, useDronoBoxStore } from "@/stores/dronobox";
import ConnectButton from "@/components/device-picker/ConnectButton.vue";
import DeviceHandler from "@/js/device_handler";
import { connectDisconnect } from "@/js/serial_backend";
import KitStageView from "./KitStageView.vue";
import InstructorDialog from "./InstructorDialog.vue";

const store = useDronoBoxStore();
const instructorOpen = ref(false);
const lookInside = ref(false);

// Walk through the lessons with Betaflight's built-in pretend flight controller. Only in dev
// builds and for instructors: participants always plug in their real drone.
const canDemo = computed(() => import.meta.env.DEV || store.instructorUnlocked);

function connectVirtual(): void {
    DeviceHandler.devicePicker.selectedDevice = "virtual";
    connectDisconnect();
}

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
    --ui-primary: var(--dronobox-accent);
    display: grid;
    grid-template-columns: minmax(24rem, 34rem) minmax(0, 1fr);
    width: 100%;
    min-height: 100%;

    &__copy {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        padding: 1.5rem clamp(1.5rem, 3.5vw, 3.5rem) 2rem;
        background: var(--dronobox-bg-0);
        border-right: 1px solid var(--dronobox-line);
    }
    &__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    &__brand {
        display: grid;
        line-height: 1.05;

        strong {
            font-size: 1.2rem;
            font-weight: 660;
            font-stretch: 112%;
            letter-spacing: -0.02em;
        }
        span {
            margin-top: 0.15rem;
            font-family: var(--dronobox-font-mono);
            font-size: 0.7rem;
            color: var(--dronobox-ink-faint);
        }
    }
    &__lang {
        display: flex;
        gap: 0.25rem;
    }
    &__body {
        display: grid;
        gap: 1.5rem;
        margin: auto 0;
    }
    &__title {
        margin: 0;
        font-size: clamp(2.75rem, 4.4vw, 4.25rem);
        color: var(--dronobox-ink);
    }
    &__lead {
        margin: 0;
        max-width: 30em;
        font-size: 1.15rem;
        line-height: 1.5;
        color: var(--dronobox-ink-soft);
    }
    &__resume {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin: 0;
        padding: 0.15rem 0 0.15rem 0.9rem;
        border-left: 2px solid var(--dronobox-accent);
        font-weight: 560;

        .iconify {
            flex: none;
            width: 1.25rem;
            height: 1.25rem;
            color: var(--dronobox-accent);
        }
    }
    &__steps {
        display: grid;
        margin: 0.5rem 0 0;
        padding: 0;
        list-style: none;

        li {
            display: flex;
            gap: 1rem;
            align-items: baseline;
            padding: 0.9rem 0;
            border-top: 1px solid var(--dronobox-line);
        }
        li:last-child {
            border-bottom: 1px solid var(--dronobox-line);
        }
        div {
            display: grid;
            gap: 0.15rem;
        }
        strong {
            font-size: 1.02rem;
            color: var(--dronobox-ink);
        }
        span {
            color: var(--dronobox-ink-soft);
            line-height: 1.45;
        }
    }
    &__num {
        flex: none;
        width: 1.75rem;
        font-family: var(--dronobox-font-mono);
        font-size: 0.8rem;
        font-variant-numeric: tabular-nums;
        color: var(--dronobox-accent);
    }
    &__connect {
        display: grid;
        gap: 0.5rem;
        justify-items: start;
        max-width: 22rem;
        margin-top: 0.4rem;

        .sidebar-connect {
            width: 100%;

            .sidebar-connect__label {
                display: inline;
            }
            .sidebar-connect__group {
                width: 100% !important;
            }
        }

        // Betaflight's split connect button, as the main site's primary pill with the device
        // picker as a separate round button beside it.
        .sidebar-connect__group {
            gap: 0.5rem;
        }
        .sidebar-connect__group > button {
            height: 3rem;
            margin: 0;
            border-radius: 999px;
            transition:
                background-color 0.25s var(--dronobox-ease-soft),
                box-shadow 0.25s var(--dronobox-ease-soft),
                transform 0.4s var(--dronobox-ease-out);
        }
        .sidebar-connect__main {
            background: var(--dronobox-button);
            color: var(--dronobox-on-accent);
            font-size: 1rem;
            font-weight: 600;
        }
        .sidebar-connect__group > button:last-child:not(.sidebar-connect__main) {
            flex: none;
            justify-content: center;
            width: 3rem;
            padding: 0;
            background: transparent;
            color: var(--dronobox-ink);
            box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
        }
        @media (hover: hover) and (pointer: fine) {
            .sidebar-connect__main:hover:not(:disabled) {
                background: var(--dronobox-button-hover);
            }
            .sidebar-connect__group > button:last-child:not(.sidebar-connect__main):hover {
                box-shadow: inset 0 0 0 1px var(--dronobox-ink);
            }
        }
    }
    &__trouble {
        color: var(--dronobox-ink-soft);

        summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--dronobox-ink);
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
        margin: 0;
        font-size: 0.78rem;
        color: var(--dronobox-ink-faint);

        a,
        button {
            color: var(--dronobox-ink-soft);
            text-decoration: underline;
            text-underline-offset: 2px;
        }
        button {
            margin-left: 0.75rem;
            padding: 0;
            border: 0;
            background: none;
            font: inherit;
            cursor: pointer;
        }
    }
    &__inspect {
        position: absolute;
        inset: auto 1.5rem 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        span {
            color: var(--dronobox-ink-soft);
            font-size: 0.8rem;
        }
    }
    &__stage {
        min-height: 26rem;
        background: radial-gradient(ellipse 70% 60% at 50% 48%, var(--dronobox-bg-2), var(--dronobox-bg-0));
    }

    @media (max-width: 960px) {
        grid-template-columns: 1fr;

        &__stage {
            order: -1;
            height: 38svh;
            min-height: 16rem;
        }
        &__copy {
            padding: 1.25rem 1rem 2rem;
        }
    }
}
</style>
