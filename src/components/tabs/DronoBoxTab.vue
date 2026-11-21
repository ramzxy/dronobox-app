<template>
    <BaseTab tab-name="dronobox">
        <div class="dbx dark dronobox-backdrop">
            <header class="dbx__bar">
                <div class="dbx__brand">
                    <strong>DronoBox</strong>
                    <span>{{ DRONOBOX_KIT.name }}</span>
                </div>
                <p class="dbx__where">
                    <span>{{ $t("dronobox:stepOf", { n: store.stepIndex + 1, total: DRONOBOX_STEPS.length }) }}</span>
                    {{ $t(`dronobox:${stepKey(store.step)}`) }}
                </p>
                <nav class="dbx__progress" :aria-label="$t('dronobox:stepsLabel')">
                    <button
                        v-for="(name, index) in DRONOBOX_STEPS"
                        :key="name"
                        type="button"
                        class="dbx__seg"
                        :class="{ 'is-active': store.step === name, 'is-done': store.isCompleted(name) }"
                        :disabled="!store.canOpen(name)"
                        :aria-current="store.step === name ? 'step' : undefined"
                        :aria-label="`${index + 1}. ${$t(`dronobox:${stepKey(name)}`)}`"
                        :title="$t(`dronobox:${stepKey(name)}`)"
                        @click="store.goTo(name)"
                    >
                        <span class="dbx__seg-fill"></span>
                        <UIcon v-if="store.isCompleted(name) && store.step !== name" name="i-lucide-check" />
                        <span v-else class="dbx__seg-number">{{ index + 1 }}</span>
                    </button>
                </nav>
                <div class="dbx__bar-actions">
                    <UBadge
                        v-if="isDevBuild && !store.instructorUnlocked"
                        color="neutral"
                        variant="subtle"
                        label="dev"
                    />
                    <UButton
                        v-if="store.canSkip && store.step !== 'done'"
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        trailing-icon="i-lucide-skip-forward"
                        :label="$t('dronobox:skipStep')"
                        @click="onSkip"
                    />
                    <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        :icon="store.instructorUnlocked ? 'i-lucide-lock' : 'i-lucide-graduation-cap'"
                        :aria-label="
                            store.instructorUnlocked ? $t('dronobox:instructorLock') : $t('dronobox:instructorMenu')
                        "
                        :title="
                            store.instructorUnlocked ? $t('dronobox:instructorLock') : $t('dronobox:instructorMenu')
                        "
                        @click="store.instructorUnlocked ? store.lock() : (instructorOpen = true)"
                    />
                    <UButton
                        size="xs"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-unplug"
                        :label="$t('disconnect')"
                        @click="onDisconnect"
                    />
                </div>
            </header>

            <div class="dbx__main">
                <section ref="lesson" class="dbx__lesson">
                    <p v-if="loadFailed" class="dbx__note is-bad">{{ $t("dronobox:loadFailed") }}</p>
                    <Transition name="dbx-swap" mode="out-in">
                        <div :key="`${store.step}-${motorPhase}`" class="dbx__lesson-inner">
                            <!-- 1. Meet the parts -->
                            <template v-if="store.step === 'meet'">
                                <h1>{{ $t("dronobox:meetTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:meetLead") }}</p>
                                <div class="dbx__assembly">
                                    <label for="dbx-assembly">{{ $t("dronobox:assemblyLabel") }}</label>
                                    <input
                                        id="dbx-assembly"
                                        v-model.number="assembly"
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                    />
                                    <div>
                                        <span>{{ $t("dronobox:assemblyClosed") }}</span
                                        ><span>{{ $t("dronobox:assemblyOpen") }}</span>
                                    </div>
                                </div>
                                <div class="dbx__parts">
                                    <button
                                        v-for="part in KIT_PARTS"
                                        :key="part"
                                        type="button"
                                        class="dbx__part"
                                        :class="{ 'is-active': activePart === part, 'is-seen': seenParts.has(part) }"
                                        :aria-pressed="pickedPart === part"
                                        @click="pickPart(part)"
                                        @mouseenter="hoverPart = part"
                                        @mouseleave="hoverPart = null"
                                    >
                                        {{ $t(`dronobox:${partKey(part)}`) }}
                                    </button>
                                </div>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :label="$t('dronobox:meetDone')"
                                        @click="store.completeAndAdvance('meet')"
                                    />
                                </footer>
                            </template>

                            <!-- 2. Gyroscope -->
                            <template v-else-if="store.step === 'gyro'">
                                <h1>{{ $t("dronobox:gyroTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:gyroLead") }}</p>
                                <div class="dbx__axes" role="group" :aria-label="$t('dronobox:exploreAxes')">
                                    <button
                                        v-for="axis in axes"
                                        :key="axis.key"
                                        type="button"
                                        class="dbx__axis"
                                        :class="[
                                            `is-${axis.key}`,
                                            {
                                                'is-moving': axis.moving,
                                                'is-done': axis.done,
                                                'is-demo': axisDemo?.axis === axis.key,
                                            },
                                        ]"
                                        :style="{ '--fill': axis.peak / 100 }"
                                        :aria-pressed="axisDemo?.axis === axis.key"
                                        @click="showAxis(axis.key)"
                                        @keydown.left.prevent="turnAxis(-5)"
                                        @keydown.down.prevent="turnAxis(-5)"
                                        @keydown.right.prevent="turnAxis(5)"
                                        @keydown.up.prevent="turnAxis(5)"
                                    >
                                        <span class="dbx__axis-name">
                                            {{ $t(`dronobox:axis${axis.label}`) }}
                                            <UIcon v-if="axis.done" name="i-lucide-check" />
                                        </span>
                                        <strong>{{ axis.value }}°</strong>
                                        <span class="dbx__axis-move">{{ $t(`dronobox:axis${axis.label}Move`) }}</span>
                                        <i class="dbx__axis-meter"></i>
                                    </button>
                                </div>
                                <p class="dbx__hint">
                                    {{ axisDemo ? $t("dronobox:axisDemoHint") : $t("dronobox:gyroTask") }}
                                </p>
                                <section v-if="!axisDemo" class="dbx__game" :class="`is-${game.state}`">
                                    <div>
                                        <h2>{{ $t("dronobox:gameTitle") }}</h2>
                                        <p v-if="game.state === 'done'" class="dbx__game-score">
                                            {{ $t("dronobox:gameDone", { seconds: game.seconds.toFixed(1) }) }}
                                        </p>
                                        <p v-else>
                                            {{
                                                game.state === "playing"
                                                    ? $t("dronobox:gamePlaying")
                                                    : $t("dronobox:gameLead")
                                            }}
                                        </p>
                                    </div>
                                    <UButton
                                        v-if="game.state !== 'playing'"
                                        color="neutral"
                                        variant="outline"
                                        icon="i-lucide-play"
                                        :label="
                                            game.state === 'done' ? $t('dronobox:gameAgain') : $t('dronobox:gameStart')
                                        "
                                        @click="startGame"
                                    />
                                    <UButton
                                        v-else
                                        color="neutral"
                                        variant="ghost"
                                        :label="$t('dronobox:gameStop')"
                                        @click="stopGame"
                                    />
                                </section>
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:gyroWhy") }}</p>
                                </details>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!gyroDone && !store.canSkip"
                                        :label="gyroDone ? $t('dronobox:gyroConfirm') : $t('dronobox:gyroWaiting')"
                                        @click="store.completeAndAdvance('gyro')"
                                    />
                                </footer>
                            </template>

                            <!-- 3. Board direction: see it go wrong, fix it, see it go right -->
                            <template v-else-if="store.step === 'align'">
                                <h1>{{ $t("dronobox:alignTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:alignLead") }}</p>
                                <ol class="dbx__flow">
                                    <li :class="alignmentIsKit ? 'is-done' : 'is-active'">
                                        <span class="dbx__flow-n">
                                            <UIcon v-if="alignmentIsKit" name="i-lucide-check" /><template v-else
                                                >1</template
                                            >
                                        </span>
                                        <div>
                                            <strong>{{ $t("dronobox:alignTry") }}</strong>
                                            <p v-if="!alignmentIsKit" class="dbx__verdict" :class="`is-${noseVerdict}`">
                                                {{ $t(`dronobox:alignVerdict_${noseVerdict}`) }}
                                            </p>
                                        </div>
                                    </li>
                                    <li :class="alignmentIsKit ? 'is-done' : 'is-active'">
                                        <span class="dbx__flow-n">
                                            <UIcon v-if="alignmentIsKit" name="i-lucide-check" /><template v-else
                                                >2</template
                                            >
                                        </span>
                                        <div>
                                            <strong>{{ $t("dronobox:alignFix") }}</strong>
                                            <p class="dbx__setting">
                                                <span>{{ $t("dronobox:alignSetting") }}</span>
                                                <code>{{ alignmentLabel }}</code>
                                                <template v-if="!alignmentIsKit">
                                                    <UIcon name="i-lucide-arrow-right" />
                                                    <code>CW 270°</code>
                                                </template>
                                            </p>
                                            <UButton
                                                v-if="!alignmentIsKit"
                                                icon="i-lucide-save"
                                                :loading="alignmentBusy"
                                                :disabled="!loaded"
                                                :label="$t('dronobox:alignApply')"
                                                @click="onApplyAlignment"
                                            />
                                            <p v-if="alignmentError" class="dbx__note is-bad">{{ alignmentError }}</p>
                                            <p v-else-if="alignment === null && loaded" class="dbx__hint">
                                                {{ $t("dronobox:alignUnknown") }}
                                            </p>
                                        </div>
                                    </li>
                                    <li :class="alignmentIsKit ? 'is-active' : 'is-todo'">
                                        <span class="dbx__flow-n">3</span>
                                        <div>
                                            <strong>{{ $t("dronobox:alignRetry") }}</strong>
                                            <p v-if="alignmentIsKit" class="dbx__verdict" :class="`is-${noseVerdict}`">
                                                {{ $t(`dronobox:alignVerdict_${noseVerdict}`) }}
                                            </p>
                                        </div>
                                    </li>
                                </ol>
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:alignWhy") }}</p>
                                </details>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!alignmentIsKit && !store.canSkip"
                                        :label="$t('dronobox:alignConfirm')"
                                        @click="store.completeAndAdvance('align')"
                                    />
                                    <UButton
                                        color="neutral"
                                        variant="ghost"
                                        icon="i-lucide-rotate-cw"
                                        :label="$t('dronobox:alignReplay')"
                                        @click="replayAlign"
                                    />
                                </footer>
                            </template>

                            <!-- 4. Accelerometer: a bubble level that calibrates once the drone is flat and still -->
                            <template v-else-if="store.step === 'level'">
                                <h1>{{ $t("dronobox:levelTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:levelLead") }}</p>
                                <div class="dbx__level" :class="`is-${levelState}`">
                                    <svg viewBox="-64 -64 128 128" aria-hidden="true">
                                        <circle r="58" class="dbx__level-ring" />
                                        <circle
                                            r="58"
                                            pathLength="100"
                                            class="dbx__level-progress"
                                            :style="{ strokeDashoffset: 100 - levelRing }"
                                        />
                                        <circle :r="LEVEL_ZONE_R" class="dbx__level-zone" />
                                        <path d="M -58 0 H 58 M 0 -58 V 58" class="dbx__level-cross" />
                                        <circle
                                            r="8"
                                            class="dbx__level-bubble"
                                            :style="{ transform: `translate(${levelBubble.x}px, ${levelBubble.y}px)` }"
                                        />
                                    </svg>
                                    <div class="dbx__level-text" role="status">
                                        <Transition name="dbx-fade" mode="out-in">
                                            <strong :key="levelState">{{ $t(`dronobox:still_${levelState}`) }}</strong>
                                        </Transition>
                                        <span>{{ $t("dronobox:levelTask") }}</span>
                                    </div>
                                </div>
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:levelWhy") }}</p>
                                </details>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!levelDone && !store.canSkip"
                                        :label="$t('dronobox:next')"
                                        @click="store.completeAndAdvance('level')"
                                    />
                                    <UButton
                                        v-if="levelDone || levelAutoTried"
                                        color="neutral"
                                        variant="ghost"
                                        icon="i-lucide-crosshair"
                                        :loading="calibratingAcc"
                                        :disabled="!loaded || (levelPosture !== 'ready' && !store.canSkip)"
                                        :label="$t('dronobox:levelAgain')"
                                        @click="onCalibrate"
                                    />
                                </footer>
                            </template>

                            <!-- 5a. The ESC: send a speed signal, swap two wires -->
                            <template v-else-if="store.step === 'motors' && motorPhase === 'esc'">
                                <h1>{{ $t("dronobox:escTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:escLead") }}</p>
                                <div class="dbx__control">
                                    <label for="dbx-esc-speed">{{ $t("dronobox:escSpeed") }}</label>
                                    <output for="dbx-esc-speed">{{ Math.round(escThrottle * 100) }}%</output>
                                    <input
                                        id="dbx-esc-speed"
                                        v-model.number="escThrottle"
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                    />
                                </div>
                                <div class="dbx__actions is-start">
                                    <UButton
                                        color="neutral"
                                        :variant="escSwapped ? 'solid' : 'outline'"
                                        icon="i-lucide-arrow-left-right"
                                        :aria-pressed="escSwapped"
                                        :label="$t('dronobox:escSwap')"
                                        @click="escSwapped = !escSwapped"
                                    />
                                </div>
                                <p class="dbx__verdict" :class="escThrottle > 0 ? 'is-forward' : 'is-waiting'">
                                    {{
                                        escThrottle > 0
                                            ? $t(`dronobox:escVerdict_${escDirection}`)
                                            : $t("dronobox:escVerdict_idle")
                                    }}
                                    <template v-if="escThrottle > 0 && escSwapped">
                                        {{ $t("dronobox:escVerdict_swapped") }}
                                    </template>
                                </p>
                                <p class="dbx__note is-warn">
                                    <UIcon name="i-lucide-triangle-alert" />
                                    {{ $t("dronobox:escFact2") }}
                                </p>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!(escTried.speed && escTried.swap) && !store.canSkip"
                                        :label="$t('dronobox:escNext')"
                                        @click="motorPhase = 'sandbox'"
                                    />
                                </footer>
                            </template>

                            <!-- 5b. Direction puzzle: make the simulated drone hover -->
                            <template v-else-if="store.step === 'motors'">
                                <h1>{{ $t("dronobox:sandboxTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:sandboxLead") }}</p>
                                <div class="dbx__puzzle">
                                    <MotorMap
                                        :motors="DRONOBOX_KIT.motors"
                                        :checks="{}"
                                        :selected="null"
                                        :spinning="null"
                                        :directions="sandboxDirs"
                                        :disabled="sandboxFlying"
                                        @select="flipSandboxMotor"
                                    />
                                    <div class="dbx__twist" :style="{ '--twist': sandboxNet / 4 }">
                                        <span>{{ $t("dronobox:twistLabel") }}</span>
                                        <div class="dbx__twist-track"><i></i></div>
                                        <strong>{{ $t(`dronobox:twist_${sandboxTwist}`) }}</strong>
                                    </div>
                                </div>
                                <p
                                    v-if="sandboxFlying || sandboxLanded"
                                    class="dbx__note"
                                    :class="sandboxOutcomeNow === 'stable' ? 'is-ok' : 'is-warn'"
                                >
                                    {{ $t(`dronobox:sandbox_${sandboxOutcomeNow}`) }}
                                    <template v-if="sandboxHint">{{
                                        $t(`dronobox:sandboxHint_${sandboxHint}`)
                                    }}</template>
                                </p>
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:motorsWhy") }}</p>
                                </details>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        :color="sandboxStableFlown && !sandboxFlying ? 'neutral' : 'primary'"
                                        :variant="sandboxFlying || sandboxStableFlown ? 'outline' : 'solid'"
                                        :icon="
                                            sandboxFlying
                                                ? 'i-lucide-arrow-down-to-line'
                                                : 'i-lucide-arrow-up-from-line'
                                        "
                                        :label="
                                            sandboxFlying ? $t('dronobox:sandboxLand') : $t('dronobox:sandboxTakeOff')
                                        "
                                        @click="toggleSandboxFlight"
                                    />
                                    <UButton
                                        v-if="sandboxStableFlown || store.canSkip"
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :label="$t('dronobox:next')"
                                        @click="finishMotorLesson"
                                    />
                                </footer>
                            </template>

                            <!-- 6. Safety gate -->
                            <template v-else-if="store.step === 'safety'">
                                <h1>{{ $t("dronobox:safetyTitle") }}</h1>
                                <p class="dbx__note is-warn">
                                    <UIcon name="i-lucide-triangle-alert" />
                                    {{ $t("dronobox:safetyLead") }}
                                </p>
                                <div class="dbx__checks">
                                    <UCheckbox v-model="propsOff" size="lg" :label="$t('dronobox:safetyPropsOff')" />
                                    <UCheckbox
                                        v-model="watcherPresent"
                                        size="lg"
                                        :label="$t('dronobox:safetyWatcher')"
                                    />
                                    <UCheckbox
                                        v-model="batteryConnected"
                                        size="lg"
                                        :disabled="!propsOff"
                                        :label="$t('dronobox:safetyBattery')"
                                        :description="$t('dronobox:safetyBatteryHelp')"
                                    />
                                </div>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!safetyReady"
                                        :label="$t('dronobox:safetyContinue')"
                                        @click="store.completeAndAdvance('safety')"
                                    />
                                </footer>
                            </template>

                            <!-- 7. Real motor test, one motor at a time -->
                            <template v-else-if="store.step === 'spin'">
                                <h1>{{ $t("dronobox:motorsTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:motorsLead") }}</p>
                                <div class="dbx__arm" :class="{ 'is-on': motorsTestingEnabled }">
                                    <UIcon :name="motorsTestingEnabled ? 'i-lucide-zap' : 'i-lucide-lock'" />
                                    <div>
                                        <strong>{{
                                            motorsTestingEnabled ? $t("dronobox:motorsOn") : $t("dronobox:motorsOff")
                                        }}</strong>
                                        <span>{{ $t("dronobox:motorsEnableHelp") }}</span>
                                    </div>
                                    <USwitch
                                        v-model="motorsTestingEnabled"
                                        size="xl"
                                        :disabled="!motorStateReady"
                                        :aria-label="$t('dronobox:motorsEnable')"
                                    />
                                </div>
                                <div class="dbx__spin">
                                    <MotorMap
                                        :motors="DRONOBOX_KIT.motors"
                                        :checks="store.motors"
                                        :selected="selectedMotor"
                                        :spinning="spinningMotor"
                                        :reveal-all="store.instructorUnlocked"
                                        @select="selectMotor"
                                    />
                                    <div v-if="selectedMotor !== null && selectedKitMotor" class="dbx__spin-panel">
                                        <p class="dbx__spin-which">
                                            <strong>M{{ selectedMotor }}</strong>
                                            {{ $t(`dronobox:pos${capitalize(selectedKitMotor.position)}`) }}
                                        </p>
                                        <template v-if="currentCheck?.answer == null">
                                            <UButton
                                                size="xl"
                                                block
                                                class="dbx__hold"
                                                icon="i-lucide-fan"
                                                :color="spinningMotor === selectedMotor ? 'warning' : 'primary'"
                                                :disabled="!motorsTestingEnabled"
                                                :label="$t('dronobox:motorsHold', { n: selectedMotor })"
                                                @pointerdown.prevent="onHoldStart"
                                                @pointerup="onHoldEnd"
                                                @pointerleave="onHoldEnd"
                                                @pointercancel="onHoldEnd"
                                                @contextmenu.prevent
                                            />
                                            <p v-if="!motorsTestingEnabled" class="dbx__hint">
                                                {{ $t("dronobox:motorsUnlockFirst") }}
                                            </p>
                                            <Transition name="dbx-fade">
                                                <div v-if="spunMotors.has(selectedMotor)" class="dbx__question">
                                                    <p>{{ $t("dronobox:motorsQuestion") }}</p>
                                                    <div class="dbx__answers">
                                                        <button type="button" @click="answer('cw')">
                                                            <UIcon name="i-lucide-rotate-cw" />
                                                            {{ $t("dronobox:motorsCw") }}
                                                        </button>
                                                        <button type="button" @click="answer('ccw')">
                                                            <UIcon name="i-lucide-rotate-ccw" />
                                                            {{ $t("dronobox:motorsCcw") }}
                                                        </button>
                                                    </div>
                                                </div>
                                            </Transition>
                                        </template>
                                        <div v-else class="dbx__result">
                                            <p v-if="currentCheck.correct" class="dbx__note is-ok">
                                                <UIcon name="i-lucide-check-circle-2" />
                                                {{ $t("dronobox:motorsCorrect", { n: selectedMotor }) }}
                                            </p>
                                            <template v-else>
                                                <p class="dbx__note is-bad">
                                                    <UIcon name="i-lucide-circle-x" />
                                                    {{ $t("dronobox:motorsWrong", { n: selectedMotor }) }}
                                                </p>
                                                <UButton
                                                    color="neutral"
                                                    variant="outline"
                                                    icon="i-lucide-refresh-ccw"
                                                    :label="$t('dronobox:motorsRetry')"
                                                    @click="retryMotor"
                                                />
                                            </template>
                                        </div>
                                    </div>
                                </div>
                                <footer class="dbx__actions">
                                    <span class="dbx__count">
                                        {{
                                            $t("dronobox:motorsProgress", {
                                                done: motorsCorrect,
                                                total: DRONOBOX_KIT.motors.length,
                                            })
                                        }}
                                    </span>
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!allMotorsCorrect && !store.canSkip"
                                        :label="$t('dronobox:motorsDone')"
                                        @click="finishMotors"
                                    />
                                </footer>
                            </template>

                            <!-- 8. Done -->
                            <template v-else>
                                <h1>{{ $t("dronobox:doneTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:doneLead") }}</p>
                                <ul class="dbx__checklist">
                                    <li><UIcon name="i-lucide-fan" />{{ $t("dronobox:doneProps") }}</li>
                                    <li><UIcon name="i-lucide-arrow-up-from-line" />{{ $t("dronobox:doneHover") }}</li>
                                    <li><UIcon name="i-lucide-unplug" />{{ $t("dronobox:doneDisconnect") }}</li>
                                </ul>
                            </template>
                        </div>
                    </Transition>

                    <section v-if="store.instructorUnlocked" class="dbx__instructor">
                        <h2>{{ $t("dronobox:instructorTools") }}</h2>
                        <div class="dbx__actions is-start">
                            <UButton
                                size="sm"
                                color="neutral"
                                variant="outline"
                                icon="i-lucide-rotate-ccw"
                                :label="$t('dronobox:instructorResetProgress')"
                                @click="onResetProgress"
                            />
                            <UButton
                                size="sm"
                                color="warning"
                                variant="outline"
                                icon="i-lucide-package-check"
                                :disabled="!baselineAvailable || baselineBusy"
                                :loading="baselineBusy"
                                :label="$t('dronobox:instructorBaseline')"
                                @click="onApplyBaseline"
                            />
                        </div>
                        <p v-if="!baselineAvailable" class="dbx__hint">
                            {{ $t("dronobox:instructorBaselineMissing") }}
                        </p>
                        <p v-if="baselineMessage" class="dbx__hint">{{ baselineMessage }}</p>
                    </section>
                </section>

                <KitStageView
                    class="dbx__stage"
                    :input="stageInput"
                    :highlight="stageHighlight"
                    :fact="
                        store.step === 'meet' && pickedPart
                            ? {
                                  part: pickedPart,
                                  title: $t(`dronobox:${partKey(pickedPart)}`),
                                  body: $t(`dronobox:${partKey(pickedPart)}Fact`),
                              }
                            : null
                    "
                    @turn="turnAxis"
                    @pick="pickPart"
                    @hover="hoverPart = $event"
                    @close="pickedPart = null"
                >
                    <p v-if="axisDemo && store.step === 'gyro'" class="dbx__stage-caption">
                        {{ $t("dronobox:axisReference") }}
                    </p>
                    <div v-if="store.step === 'gyro' && game.state === 'playing'" class="dbx__stage-game" role="status">
                        <span>{{ game.index + 1 }} / {{ GAME_POSES.length }}</span>
                        <strong>{{ game.matched ? $t("dronobox:gameHold") : $t("dronobox:gameMove") }}</strong>
                        <i :style="{ '--fill': game.hold }"></i>
                    </div>
                    <dl v-if="showHud" class="dbx__hud">
                        <div class="is-roll">
                            <dt>{{ $t("dronobox:axisRoll") }}</dt>
                            <dd>{{ attitude.roll.toFixed(0) }}°</dd>
                        </div>
                        <div class="is-pitch">
                            <dt>{{ $t("dronobox:axisPitch") }}</dt>
                            <dd>{{ attitude.pitch.toFixed(0) }}°</dd>
                        </div>
                        <div class="is-yaw">
                            <dt>{{ $t("dronobox:axisYaw") }}</dt>
                            <dd>{{ attitude.heading.toFixed(0) }}°</dd>
                        </div>
                    </dl>
                </KitStageView>
            </div>
        </div>
        <InstructorDialog v-model:open="instructorOpen" />
    </BaseTab>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import BaseTab from "./BaseTab.vue";
import MotorMap from "@/components/dronobox/MotorMap.vue";
import KitStageView from "@/components/dronobox/KitStageView.vue";
import InstructorDialog from "@/components/dronobox/InstructorDialog.vue";
import { i18n } from "@/js/localization";
import { disconnect } from "@/js/serial_backend";
import { useDialog } from "@/composables/useDialog";
import { useDronoBoxFc } from "@/composables/dronobox/useDronoBoxFc";
import { DRONOBOX_STEPS, useDronoBoxStore, type DronoBoxStep } from "@/stores/dronobox";
import { DRONOBOX_KIT, type SpinDirection } from "@/dronobox/kit";
import {
    ESC_DEMO_MOTOR,
    KIT_PARTS,
    type KitPart,
    type ShotName,
    type StageInput,
    type AxisDemo,
} from "@/dronobox/stage/KitStage";
import { sandboxOutcome } from "@/dronobox/sandbox";

const store = useDronoBoxStore();
const dialog = useDialog();
const instructorOpen = ref(false);
const isDevBuild = import.meta.env.DEV;
const lesson = ref<HTMLElement | null>(null);
const assembly = ref(1);
function scrollLessonToStart(): void {
    lesson.value?.scrollTo({ top: 0 });
    if (window.matchMedia("(max-width: 960px)").matches) {
        document.getElementById("content")?.scrollTo({ top: 0 });
    }
}
const axisDemo = ref<AxisDemo | null>(null);
let demoTween = 0;
function turnAxis(delta: number): void {
    if (!axisDemo.value) return;
    cancelAnimationFrame(demoTween);
    axisDemo.value = { ...axisDemo.value, angle: Math.max(-45, Math.min(45, axisDemo.value.angle + delta)) };
}
watch(axisDemo, (demo) => {
    if (demo) stopGame();
});

const {
    loaded,
    load,
    attitude,
    startAttitudePolling,
    alignment,
    alignmentIsKit,
    alignmentBusy,
    applyKitAlignment,
    calibratingAcc,
    accNeedsCalibration,
    calibrateAccelerometer,
    motorsTestingEnabled,
    motorStateReady,
    spinningMotor,
    spinMotor,
    stopMotors,
    baselineAvailable,
    applyBaseline,
} = useDronoBoxFc((message) => dialog.openInfo(i18n.getMessage("warningTitle"), message));

const loadFailed = ref(false);
let mounted = false;

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function stepKey(step: DronoBoxStep): string {
    return `step${capitalize(step)}`;
}

function partKey(part: KitPart): string {
    return `part${capitalize(part)}`;
}

// --- 1. meet the parts ----------------------------------------------------------------------

const pickedPart = ref<KitPart | null>(null);
const hoverPart = ref<KitPart | null>(null);
const seenParts = reactive(new Set<KitPart>());
const activePart = computed(() => hoverPart.value ?? pickedPart.value);

function pickPart(part: KitPart): void {
    assembly.value = 1;
    pickedPart.value = part;
    seenParts.add(part);
}

// --- 2. gyro: one tile per axis, lit while the drone turns about it ------------------------------

const GYRO_TARGET = 25;
const YAW_TARGET = 45;
const AXIS_KEYS = ["roll", "pitch", "yaw"] as const;
type AxisKey = (typeof AXIS_KEYS)[number];
const peaks = reactive({ roll: 0, pitch: 0, yaw: 0 });
/** Turn rate about each axis in degrees per second, smoothed. */
const axisRates = reactive({ roll: 0, pitch: 0, yaw: 0 });
let yawStart: number | null = null;
let lastGyroSample: { roll: number; pitch: number; heading: number; at: number } | null = null;
let demoStart: { roll: number; pitch: number } | null = null;
const gyroDone = computed(() => Math.max(peaks.roll, peaks.pitch) >= GYRO_TARGET);
const axes = computed(() =>
    AXIS_KEYS.map((key) => {
        const target = key === "yaw" ? YAW_TARGET : GYRO_TARGET;
        const live = key === "yaw" ? attitude.value.heading : attitude.value[key];
        return {
            key,
            label: capitalize(key),
            value: (axisDemo.value?.axis === key ? axisDemo.value.angle : live).toFixed(0),
            peak: Math.min(100, (peaks[key] / target) * 100),
            done: peaks[key] >= target,
            moving: axisRates[key] > 12,
        };
    }),
);

/** Show one axis on the model: it rocks once each way, then stays tilted for dragging. */
function showAxis(axis: AxisKey): void {
    cancelAnimationFrame(demoTween);
    if (axisDemo.value?.axis === axis) {
        axisDemo.value = null;
        return;
    }
    demoStart = { roll: attitude.value.roll, pitch: attitude.value.pitch };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        axisDemo.value = { axis, angle: 20 };
        return;
    }
    const keys = [0, 30, -30, 20];
    const started = performance.now();
    const step = (now: number): void => {
        const t = Math.min(1, (now - started) / 2400) * (keys.length - 1);
        const i = Math.min(keys.length - 2, Math.floor(t));
        const f = t - i;
        const eased = f * f * (3 - 2 * f);
        axisDemo.value = { axis, angle: keys[i] + (keys[i + 1] - keys[i]) * eased };
        if (t < keys.length - 1) demoTween = requestAnimationFrame(step);
    };
    axisDemo.value = { axis, angle: 0 };
    demoTween = requestAnimationFrame(step);
}

function sampleGyro(value: { roll: number; pitch: number; heading: number }, now: number): void {
    if (lastGyroSample) {
        const dt = Math.max(0.02, (now - lastGyroSample.at) / 1000);
        const k = 0.35;
        const turned = Math.abs(((value.heading - lastGyroSample.heading + 540) % 360) - 180);
        axisRates.roll += (Math.abs(value.roll - lastGyroSample.roll) / dt - axisRates.roll) * k;
        axisRates.pitch += (Math.abs(value.pitch - lastGyroSample.pitch) / dt - axisRates.pitch) * k;
        axisRates.yaw += (turned / dt - axisRates.yaw) * k;
    }
    lastGyroSample = { ...value, at: now };
    // Picking the drone up again leaves the demo and goes back to the real thing.
    if (
        axisDemo.value &&
        demoStart &&
        (Math.abs(value.roll - demoStart.roll) > 8 || Math.abs(value.pitch - demoStart.pitch) > 8)
    ) {
        cancelAnimationFrame(demoTween);
        axisDemo.value = null;
    }
    updateGame(value.roll, value.pitch);
    peaks.roll = Math.max(peaks.roll, Math.abs(value.roll));
    peaks.pitch = Math.max(peaks.pitch, Math.abs(value.pitch));
    yawStart ??= value.heading;
    peaks.yaw = Math.max(peaks.yaw, Math.abs(((value.heading - yawStart + 540) % 360) - 180));
}

// --- 2b. gyro game: copy the ghost's pose and hold it -----------------------------------------

// Poses in Betaflight's attitude convention, the same mapping the live drone uses, so the ghost
// and the drone always agree even where the sign of "left" or "nose down" is not obvious.
const GAME_POSES = [
    { roll: 25, pitch: 0, axis: "Roll" },
    { roll: 0, pitch: -20, axis: "Pitch" },
    { roll: -25, pitch: 0, axis: "Roll" },
    { roll: 0, pitch: 20, axis: "Pitch" },
    { roll: 18, pitch: 16, axis: "Both" },
] as const;
const GAME_TOLERANCE = 5;
const GAME_HOLD_MS = 700;

const game = reactive({
    state: "idle" as "idle" | "playing" | "done",
    index: 0,
    matched: false,
    hold: 0,
    seconds: 0,
});
let gameStarted = 0;
let matchedSince: number | null = null;
const gamePose = computed(() => GAME_POSES[Math.min(game.index, GAME_POSES.length - 1)]);

function startGame(): void {
    Object.assign(game, { state: "playing", index: 0, matched: false, hold: 0, seconds: 0 });
    gameStarted = performance.now();
    matchedSince = null;
}

function stopGame(): void {
    Object.assign(game, { state: "idle", matched: false, hold: 0 });
}

function updateGame(roll: number, pitch: number): void {
    if (game.state !== "playing") {
        return;
    }
    const now = performance.now();
    const pose = gamePose.value;
    game.matched = Math.abs(roll - pose.roll) < GAME_TOLERANCE && Math.abs(pitch - pose.pitch) < GAME_TOLERANCE;
    if (!game.matched) {
        matchedSince = null;
        game.hold = 0;
        return;
    }
    matchedSince ??= now;
    game.hold = Math.min(1, (now - matchedSince) / GAME_HOLD_MS);
    if (game.hold >= 1) {
        matchedSince = null;
        game.hold = 0;
        game.matched = false;
        if (game.index + 1 >= GAME_POSES.length) {
            game.state = "done";
            game.seconds = (now - gameStarted) / 1000;
        } else {
            game.index += 1;
        }
    }
}

// --- 3. alignment: tip the nose down, see which way the model tips ------------------------------

const alignmentError = ref("");
const alignTurn = ref(1);
const alignmentLabel = computed(() => {
    if (alignment.value === null) {
        return "?";
    }
    return alignment.value === "DEFAULT"
        ? i18n.getMessage("dronobox:alignDefault")
        : alignment.value.replace(/^CW(\d+)/, "CW $1°").replace("FLIP", " flip");
});
const noseVerdict = computed(() => {
    const roll = Math.abs(attitude.value.roll);
    const pitch = Math.abs(attitude.value.pitch);
    if (Math.max(roll, pitch) < 12) {
        return "waiting";
    }
    return pitch >= roll ? "forward" : "sideways";
});

function replayAlign(): void {
    alignTurn.value = 0;
    setTimeout(() => (alignTurn.value = 1), 700);
}

async function onApplyAlignment(): Promise<void> {
    alignmentError.value = "";
    const ok = await applyKitAlignment();
    if (!ok) {
        alignmentError.value = i18n.getMessage("dronobox:alignFailed");
    }
}

// --- 4. accelerometer: calibrates by itself once the drone has been flat and still for a moment ----

const STILL_MS = 2000;
const STILL_DEG = 0.5;
const FLAT_DEG = 8;
/** Bubble level scale, pixels per degree of tilt. */
const LEVEL_SCALE = 2.6;
const LEVEL_ZONE_R = FLAT_DEG * LEVEL_SCALE;
const levelDone = ref(store.isCompleted("level"));
const levelAutoTried = ref(false);
const levelProgress = ref(0);
const levelPosture = ref<"tilted" | "moving" | "holding" | "ready">("moving");
let stillSince: number | null = null;
let lastSample: { roll: number; pitch: number } | null = null;
let levelMotion = 0;
const levelBubble = computed(() => {
    const clamp = (v: number) => Math.max(-21, Math.min(21, v)) * LEVEL_SCALE;
    return { x: clamp(attitude.value.roll), y: clamp(-attitude.value.pitch) };
});
const levelState = computed(() => {
    if (calibratingAcc.value) return "calibrating";
    if (levelDone.value) return "done";
    return levelPosture.value;
});
const levelRing = computed(() => (levelDone.value ? 100 : levelProgress.value));

async function onCalibrate(): Promise<void> {
    await calibrateAccelerometer();
    levelDone.value = !accNeedsCalibration.value;
}

function sampleLevel(value: { roll: number; pitch: number }, now: number): void {
    const moved = lastSample
        ? Math.max(Math.abs(value.roll - lastSample.roll), Math.abs(value.pitch - lastSample.pitch))
        : 0;
    lastSample = { roll: value.roll, pitch: value.pitch };
    // Smoothed, so one noisy reading neither resets the hold nor counts as stillness.
    levelMotion = levelMotion * 0.6 + moved * 0.4;
    if (Math.abs(value.roll) > FLAT_DEG || Math.abs(value.pitch) > FLAT_DEG) {
        levelPosture.value = "tilted";
    } else if (levelMotion > STILL_DEG) {
        levelPosture.value = "moving";
    } else {
        stillSince ??= now;
        const held = now - stillSince;
        levelProgress.value = Math.min(100, (held / STILL_MS) * 100);
        levelPosture.value = held >= STILL_MS ? "ready" : "holding";
        if (levelPosture.value === "ready" && !levelDone.value && !levelAutoTried.value && loaded.value) {
            levelAutoTried.value = true;
            void onCalibrate();
        }
        return;
    }
    stillSince = null;
    levelProgress.value = 0;
}

// Sampled on a clock rather than on change: a drone lying perfectly still reports the same
// angles over and over, and still has to count as still.
let sampler = 0;
function sampleAttitude(): void {
    const now = performance.now();
    if (store.step === "gyro") {
        sampleGyro(attitude.value, now);
    } else if (store.step === "level") {
        sampleLevel(attitude.value, now);
    }
}

// --- 5. motor lesson: the ESC, then a direction puzzle -------------------------------------------

const motorPhase = ref<"esc" | "sandbox">("esc");
watch(motorPhase, scrollLessonToStart);

const escThrottle = ref(0);
const escSwapped = ref(false);
const escTried = reactive({ speed: false, swap: false });
watch(escThrottle, (throttle) => {
    if (throttle > 0.15) escTried.speed = true;
});
watch(escSwapped, () => (escTried.swap = true));
const escDirection = computed<SpinDirection>(() => {
    const base = DRONOBOX_KIT.motors.find((m) => m.number === ESC_DEMO_MOTOR)?.direction ?? "ccw";
    if (!escSwapped.value) return base;
    return base === "cw" ? "ccw" : "cw";
});

// Everything starts clockwise, so the first take-off spins: the puzzle is to fix that.
const sandboxDirs = reactive<Record<number, SpinDirection>>(
    Object.fromEntries(DRONOBOX_KIT.motors.map((m) => [m.number, "cw"])) as Record<number, SpinDirection>,
);
const sandboxFlying = ref(false);
const sandboxLanded = ref(false);
const sandboxStableFlown = ref(store.isCompleted("motors"));
const sandboxOutcomeNow = computed(() => sandboxOutcome(sandboxDirs));
const sandboxNet = computed(() =>
    DRONOBOX_KIT.motors.reduce((sum, m) => sum + (sandboxDirs[m.number] === "cw" ? 1 : -1), 0),
);
// Propellers turning clockwise twist the frame counter-clockwise, and the other way round.
const sandboxTwist = computed(() => (sandboxNet.value === 0 ? "balanced" : sandboxNet.value > 0 ? "ccw" : "cw"));
const sandboxHint = computed(() => {
    const outcome = sandboxOutcomeNow.value;
    if (outcome === "stable") return null;
    if (outcome !== "unstable") return "spin";
    return DRONOBOX_KIT.motors.every((m) => sandboxDirs[m.number] !== m.direction) ? "mirrored" : "adjacent";
});

function flipSandboxMotor(number: number): void {
    if (sandboxFlying.value) return;
    sandboxDirs[number] = sandboxDirs[number] === "cw" ? "ccw" : "cw";
    sandboxLanded.value = false;
}

function toggleSandboxFlight(): void {
    sandboxFlying.value = !sandboxFlying.value;
    if (sandboxFlying.value) {
        sandboxLanded.value = false;
        if (sandboxOutcomeNow.value === "stable") {
            sandboxStableFlown.value = true;
        }
    } else {
        sandboxLanded.value = true;
    }
}

function finishMotorLesson(): void {
    sandboxFlying.value = false;
    store.completeAndAdvance("motors");
}

// --- 6. safety ------------------------------------------------------------------------------

const propsOff = ref(false);
const watcherPresent = ref(false);
// The battery plugs into the power board, not the flight controller, so Betaflight cannot tell
// whether it is in: the participant ticks it.
const batteryConnected = ref(false);
const safetyReady = computed(() => propsOff.value && watcherPresent.value && batteryConnected.value);
watch(propsOff, (off) => {
    if (!off) {
        batteryConnected.value = false;
    }
});

// --- 7. real motor test ---------------------------------------------------------------------

const selectedMotor = ref<number | null>(null);
const spunMotors = ref(new Set<number>());
const selectedKitMotor = computed(() => DRONOBOX_KIT.motors.find((motor) => motor.number === selectedMotor.value));
const currentCheck = computed(() => (selectedMotor.value === null ? null : store.motors[selectedMotor.value]));
const motorsCorrect = computed(() => Object.values(store.motors).filter((check) => check.correct).length);
const allMotorsCorrect = computed(() => motorsCorrect.value === DRONOBOX_KIT.motors.length);

function selectMotor(number: number): void {
    stopMotors();
    selectedMotor.value = number;
}

function nextUncheckedMotor(): number | null {
    const numbers = DRONOBOX_KIT.motors.map((m) => m.number).sort((a, b) => a - b);
    return numbers.find((n) => !store.motors[n]?.correct) ?? null;
}

// A right answer moves on to the next motor by itself.
watch(
    () => (selectedMotor.value !== null ? store.motors[selectedMotor.value]?.correct : null),
    (correct) => {
        const from = selectedMotor.value;
        if (!correct || from === null) return;
        setTimeout(() => {
            if (store.step !== "spin" || selectedMotor.value !== from) return;
            const next = nextUncheckedMotor();
            if (next !== null) selectMotor(next);
        }, 1100);
    },
);

function onHoldStart(): void {
    if (selectedMotor.value === null) {
        return;
    }
    spinMotor(selectedMotor.value);
    spunMotors.value = new Set([...spunMotors.value, selectedMotor.value]);
}

function onHoldEnd(): void {
    if (spinningMotor.value !== null) {
        stopMotors();
    }
}

function answer(direction: SpinDirection): void {
    if (selectedMotor.value !== null) {
        store.recordMotor(selectedMotor.value, direction);
    }
}

function retryMotor(): void {
    if (selectedMotor.value === null) {
        return;
    }
    store.resetMotor(selectedMotor.value);
    const remaining = new Set(spunMotors.value);
    remaining.delete(selectedMotor.value);
    spunMotors.value = remaining;
}

function finishMotors(): void {
    stopMotors();
    motorsTestingEnabled.value = false;
    store.completeAndAdvance("spin");
}

const revealedMotors = computed(() =>
    store.instructorUnlocked
        ? DRONOBOX_KIT.motors.map((m) => m.number)
        : DRONOBOX_KIT.motors.filter((m) => store.motors[m.number]?.answer != null).map((m) => m.number),
);

// --- step changes ---------------------------------------------------------------------------

watch(
    () => store.step,
    (step, previous) => {
        axisDemo.value = null;
        scrollLessonToStart();
        if (previous === "spin") {
            stopMotors();
            motorsTestingEnabled.value = false;
        }
        if (previous === "motors") {
            sandboxFlying.value = false;
        }
        if (previous === "gyro") {
            stopGame();
        }
        if (step === "align") {
            replayAlign();
        }
        if (step === "level") {
            stillSince = null;
            lastSample = null;
            levelMotion = 0;
            levelAutoTried.value = false;
        }
        if (step === "motors") {
            motorPhase.value = "esc";
            escThrottle.value = 0;
            escSwapped.value = false;
        }
        if (step === "spin") {
            selectedMotor.value ??= nextUncheckedMotor();
        }
    },
);

function onSkip(): void {
    if (store.step === "motors" && motorPhase.value === "esc") {
        motorPhase.value = "sandbox";
        return;
    }
    store.completeAndAdvance(store.step);
}

// --- 3D stage -------------------------------------------------------------------------------

const SHOT_FOR_STEP: Record<DronoBoxStep, ShotName> = {
    meet: "meet",
    gyro: "gyro",
    align: "align",
    level: "level",
    motors: "esc",
    safety: "safety",
    spin: "spin",
    done: "done",
};

const stageHighlight = computed<KitPart | null>(() => {
    if (store.step === "meet") {
        return activePart.value;
    }
    if (store.step === "motors" && motorPhase.value === "esc") {
        return "esc";
    }
    return null;
});

// Live readouts only where the lesson is about live data.
const showHud = computed(() => !axisDemo.value && ["align", "safety", "spin", "done"].includes(store.step));

const stageInput = computed<Partial<StageInput>>(() => {
    const step = store.step;
    return {
        axisDemo: step === "gyro" ? axisDemo.value : null,
        assembly: assembly.value,
        shot:
            step === "gyro" && axisDemo.value
                ? "axes"
                : step === "motors" && motorPhase.value === "sandbox"
                  ? "sandbox"
                  : step === "gyro" && game.state === "playing"
                    ? "gyroGame"
                    : SHOT_FOR_STEP[step],
        ghost:
            step === "gyro" && game.state === "playing"
                ? { roll: gamePose.value.roll, pitch: gamePose.value.pitch }
                : null,
        ghostMatched: game.matched,
        // From the gyro lesson on, the 3D drone always follows the real one.
        liveTilt: step !== "meet",
        attitude: step !== "meet" && !axisDemo.value ? { ...attitude.value } : { roll: 0, pitch: 0, heading: 0 },
        focus: step === "meet" ? pickedPart.value : null,
        escDemo:
            step === "motors" && motorPhase.value === "esc"
                ? { throttle: escThrottle.value, swapped: escSwapped.value }
                : null,
        spinningMotor: step === "spin" ? spinningMotor.value : null,
        selectedMotor: step === "spin" ? selectedMotor.value : null,
        revealedMotors: revealedMotors.value,
        propsOn: step === "spin" ? false : step === "safety" ? !propsOff.value : true,
        batteryIn: step === "safety" || step === "spin" ? batteryConnected.value : true,
        sandbox: step === "motors" ? { dirs: { ...sandboxDirs }, flying: sandboxFlying.value } : null,
        alignTurn: alignTurn.value,
    };
});

// --- 9. done --------------------------------------------------------------------------------

function onDisconnect(): void {
    disconnect();
}

// --- instructor -----------------------------------------------------------------------------

const baselineBusy = ref(false);
const baselineMessage = ref("");

function onResetProgress(): void {
    store.resetProgress();
    Object.assign(peaks, { roll: 0, pitch: 0, yaw: 0 });
    yawStart = null;
    levelDone.value = false;
    levelAutoTried.value = false;
    escTried.speed = false;
    escTried.swap = false;
    propsOff.value = false;
    watcherPresent.value = false;
    batteryConnected.value = false;
    spunMotors.value = new Set();
    selectedMotor.value = null;
    sandboxStableFlown.value = false;
    seenParts.clear();
}

async function onApplyBaseline(): Promise<void> {
    baselineBusy.value = true;
    baselineMessage.value = "";
    try {
        const result = await applyBaseline();
        baselineMessage.value = result.ok
            ? i18n.getMessage("dronobox:instructorBaselineOk")
            : `${i18n.getMessage("dronobox:instructorBaselineFailed")} ${result.errors.join("; ")}`;
    } finally {
        baselineBusy.value = false;
    }
}

// --- lifecycle ------------------------------------------------------------------------------

function cleanup(callback?: () => void): void {
    if (spinningMotor.value !== null || motorsTestingEnabled.value) {
        stopMotors();
        motorsTestingEnabled.value = false;
    }
    callback?.();
}

defineExpose({ cleanup });

onMounted(async () => {
    mounted = true;
    if (store.step === "align") {
        replayAlign();
    }
    const ok = await load();
    if (!mounted) {
        return;
    }
    loadFailed.value = !ok;
    if (!ok) {
        return;
    }
    startAttitudePolling();
    sampler = window.setInterval(sampleAttitude, 50);
    if (store.step === "spin") {
        selectedMotor.value ??= nextUncheckedMotor();
    }
});

onBeforeUnmount(() => {
    mounted = false;
    clearInterval(sampler);
    cancelAnimationFrame(demoTween);
    cleanup();
});
</script>

<style lang="less">
.tab-dronobox {
    height: 100%;
}

.dbx {
    --ui-primary: var(--dronobox-accent);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 34rem;

    &__bar {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        min-height: 4rem;
        padding: 0.75rem clamp(1.25rem, 2.5vw, 2.5rem);
        border-bottom: 1px solid var(--dronobox-line);
    }
    &__brand {
        display: grid;
        gap: 0.15rem;
        line-height: 1;

        strong {
            font-size: 1.15rem;
            font-weight: 660;
            font-stretch: 112%;
            letter-spacing: -0.02em;
        }
        span {
            font-family: var(--dronobox-font-mono);
            font-size: 0.7rem;
            color: var(--dronobox-ink-faint);
        }
    }
    &__where {
        margin: 0 0 0 auto;
        font-size: 0.8rem;
        font-weight: 500;
        white-space: nowrap;

        span {
            margin-right: 0.5rem;
            color: var(--dronobox-ink-faint);
        }
    }
    &__progress {
        display: flex;
        flex: 1;
        gap: 0.3rem;
        max-width: 26rem;
        margin-right: auto;
    }
    &__seg {
        position: relative;
        flex: 1;
        height: 2.5rem;
        min-width: 1.5rem;
        display: grid;
        place-items: center;
        color: var(--dronobox-ink-soft);
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        cursor: pointer;
        transition: color 0.25s var(--dronobox-ease-soft);

        &::before {
            content: "";
            position: absolute;
            inset: auto 0.2rem 0;
            height: 1px;
            background: var(--dronobox-line-strong);
        }
        &:disabled {
            cursor: default;
            color: var(--dronobox-ink-faint);
        }
        &:focus-visible {
            outline: 2px solid var(--dronobox-accent);
            outline-offset: 2px;
        }
        @media (hover: hover) and (pointer: fine) {
            &:hover:not(:disabled) {
                color: var(--dronobox-ink);
            }
        }
    }
    &__seg-fill {
        position: absolute;
        inset: auto 0.2rem 0;
        height: 2px;
        background: var(--dronobox-accent);
        transform: scaleX(0);
        transform-origin: left;
        transition:
            transform 0.7s var(--dronobox-ease-out),
            opacity 0.3s var(--dronobox-ease-soft);
    }
    &__seg-number {
        font-family: var(--dronobox-font-mono);
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
    }
    &__seg.is-active {
        color: var(--dronobox-ink);
    }
    &__seg.is-done {
        color: var(--dronobox-accent);
    }
    &__seg.is-done &__seg-fill {
        transform: scaleX(1);
        opacity: 0.55;
    }
    &__seg.is-active &__seg-fill {
        transform: scaleX(1);
        opacity: 1;
    }
    &__bar-actions {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    &__main {
        display: grid;
        grid-template-columns: minmax(23rem, 32rem) minmax(0, 1fr);
        flex: 1;
        min-height: 0;
    }
    &__lesson {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: clamp(1.75rem, 3.5vh, 2.75rem) clamp(1.25rem, 2.5vw, 2.5rem);
        background: var(--dronobox-bg-0);
        border-right: 1px solid var(--dronobox-line);
        overflow-y: auto;
    }
    &__lesson-inner {
        display: grid;
        gap: 1.35rem;
        align-content: start;

        h1 {
            margin: 0 0 0.15rem;
            font-size: clamp(2rem, 3vw, 2.75rem);
            line-height: 1.02;
            color: var(--dronobox-ink);
        }
        h2 {
            margin: 0 0 0.5rem;
            font-size: 1rem;
            font-weight: 600;
        }
    }
    &__lead {
        margin: 0;
        max-width: 34em;
        font-size: 1.075rem;
        line-height: 1.55;
        color: var(--dronobox-ink-soft);
    }
    &__task {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        margin: 0;
        font-weight: 600;
        line-height: 1.45;

        .iconify {
            flex: none;
            width: 1.2rem;
            height: 1.2rem;
            margin-top: 0.1rem;
            color: var(--dronobox-accent);
        }
    }
    &__hint {
        margin: 0;
        font-size: 0.88rem;
        line-height: 1.45;
        color: var(--dronobox-ink-faint);
    }
    &__note {
        display: flex;
        align-items: flex-start;
        gap: 0.55rem;
        margin: 0;
        padding: 0.15rem 0 0.15rem 0.9rem;
        border-left: 2px solid currentColor;
        line-height: 1.45;

        .iconify {
            flex: none;
            width: 1.15rem;
            height: 1.15rem;
            margin-top: 0.12rem;
        }
        &.is-ok {
            color: var(--dronobox-ok);
        }
        &.is-warn {
            color: var(--dronobox-ink);
            border-left-color: var(--dronobox-warn);

            .iconify {
                color: var(--dronobox-warn);
            }
        }
        &.is-bad {
            color: var(--dronobox-bad);
        }
    }
    &__why {
        color: var(--dronobox-ink-soft);

        summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--dronobox-ink);
        }
        p {
            margin: 0.45rem 0 0;
            line-height: 1.55;
        }
    }
    &__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-start;
        gap: 0.6rem;
        margin-top: 0.5rem;

        &.is-start {
            justify-content: flex-start;
            margin-top: 0;
        }
    }
    &__count {
        margin-right: auto;
        color: var(--dronobox-ink-soft);
        font-size: 0.9rem;
    }

    // meet
    &__parts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 1.5rem;
    }
    &__part {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-height: 2.9rem;
        padding: 0.6rem 0;
        border: 0;
        border-bottom: 1px solid var(--dronobox-line);
        background: transparent;
        color: var(--dronobox-ink-soft);
        font-size: 1rem;
        font-weight: 540;
        text-align: left;
        cursor: pointer;
        transition: color 0.25s var(--dronobox-ease-soft);

        &::before {
            content: "";
            flex: none;
            width: 0.4rem;
            height: 0.4rem;
            border-radius: 999px;
            background: var(--dronobox-line-strong);
            transition:
                background-color 0.25s var(--dronobox-ease-soft),
                transform 0.4s var(--dronobox-ease-out);
        }
        &.is-seen::before {
            background: var(--dronobox-ink-faint);
        }
        &:focus-visible {
            color: var(--dronobox-ink);
        }
        @media (hover: hover) and (pointer: fine) {
            &:hover {
                color: var(--dronobox-ink);
            }
        }
        &.is-active {
            color: var(--dronobox-ink);

            &::before {
                background: var(--dronobox-accent);
                transform: scale(1.5);
            }
        }
    }

    &__assembly {
        display: grid;
        gap: 0.5rem;
        padding-block: 0.5rem 1rem;
        border-bottom: 1px solid var(--dronobox-line);
        label {
            font-size: 0.9rem;
            font-weight: 600;
        }
        input {
            width: 100%;
            min-height: 1.5rem;
            accent-color: var(--dronobox-accent);
            cursor: ew-resize;
        }
        div {
            display: flex;
            justify-content: space-between;
            color: var(--dronobox-ink-soft);
            font-size: 0.75rem;
        }
    }
    &__stage-caption {
        position: absolute;
        inset: auto 1.5rem 1.5rem;
        margin: 0;
        color: var(--dronobox-ink-soft);
        text-align: center;
        font-size: 0.85rem;
        pointer-events: none;
    }

    // gyro: one tile per axis, lit while the drone turns about it
    &__axes {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.5rem;
    }
    &__axis {
        --axis: var(--dronobox-accent);
        --fill: 0;
        position: relative;
        display: grid;
        gap: 0.15rem;
        align-content: start;
        min-height: 7.25rem;
        padding: 0.8rem 0.85rem 1.1rem;
        border: 0;
        border-radius: 0.9rem;
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--dronobox-line);
        color: var(--dronobox-ink);
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        transition:
            box-shadow 0.3s var(--dronobox-ease-soft),
            background-color 0.3s var(--dronobox-ease-soft),
            transform 0.4s var(--dronobox-ease-out);

        &.is-roll {
            --axis: var(--dronobox-roll);
        }
        &.is-pitch {
            --axis: var(--dronobox-pitch);
        }
        &.is-yaw {
            --axis: var(--dronobox-yaw);
        }
        &:active {
            transform: scale(0.97);
            transition-duration: 0.08s;
        }
        &.is-moving,
        &.is-demo {
            box-shadow: inset 0 0 0 1px var(--axis);
            background: color-mix(in srgb, var(--axis) 9%, transparent);
        }
        @media (hover: hover) and (pointer: fine) {
            &:hover {
                box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
            }
            &.is-moving:hover,
            &.is-demo:hover {
                box-shadow: inset 0 0 0 1px var(--axis);
            }
        }
        strong {
            font-size: 1.65rem;
            font-weight: 500;
            line-height: 1.1;
            color: var(--axis);
        }
    }
    &__axis-name {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 600;

        .iconify {
            color: var(--axis);
        }
    }
    &__axis-move {
        font-size: 0.78rem;
        line-height: 1.3;
        color: var(--dronobox-ink-faint);
    }
    &__axis-meter {
        position: absolute;
        inset: auto 0 0;
        height: 3px;
        background: var(--axis);
        transform: scaleX(var(--fill));
        transform-origin: left;
        transition: transform 0.3s var(--dronobox-ease-out);
    }

    &__game {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 0;
        border-block: 1px solid var(--dronobox-line);

        h2 {
            margin: 0 0 0.2rem;
            font-size: 1rem;
        }
        p {
            margin: 0;
            color: var(--dronobox-ink-soft);
            line-height: 1.45;
        }
    }
    &__game-score {
        font-family: var(--dronobox-font-mono);
        color: var(--dronobox-ok) !important;
    }
    &__stage-game {
        --fill: 0;
        position: absolute;
        top: 1.25rem;
        left: 50%;
        display: grid;
        justify-items: center;
        gap: 0.3rem;
        min-width: 14rem;
        padding: 0.7rem 1.1rem 0.9rem;
        border-radius: 1rem;
        background: var(--dronobox-chip);
        box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
        transform: translateX(-50%);
        pointer-events: none;

        span {
            font-family: var(--dronobox-font-mono);
            font-size: 0.72rem;
            color: var(--dronobox-ink-faint);
        }
        strong {
            font-weight: 600;
        }
        i {
            width: 100%;
            height: 3px;
            border-radius: 999px;
            background: linear-gradient(
                to right,
                var(--dronobox-ok) calc(var(--fill) * 100%),
                var(--dronobox-line-strong) 0
            );
        }
    }

    // align: three steps, each with a live verdict
    &__flow {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;

        > li {
            display: grid;
            grid-template-columns: 2rem minmax(0, 1fr);
            gap: 0.75rem;
            padding: 1rem 0;
            border-top: 1px solid var(--dronobox-line);
            transition: opacity 0.3s var(--dronobox-ease-soft);

            > div {
                display: grid;
                gap: 0.55rem;
                justify-items: start;
            }
            strong {
                font-weight: 600;
                line-height: 1.4;
            }
            &.is-todo {
                opacity: 0.45;
            }
            &.is-done strong {
                color: var(--dronobox-ink-soft);
            }
        }
        > li:last-child {
            border-bottom: 1px solid var(--dronobox-line);
        }
    }
    &__flow-n {
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 999px;
        box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
        font-family: var(--dronobox-font-mono);
        font-size: 0.78rem;
        color: var(--dronobox-ink-soft);

        .is-active > & {
            box-shadow: inset 0 0 0 1px var(--dronobox-ink);
            color: var(--dronobox-ink);
        }
        .is-done > & {
            box-shadow: none;
            background: var(--dronobox-ok);
            color: var(--dronobox-on-accent);
        }
    }
    &__verdict {
        margin: 0;
        padding-left: 0.85rem;
        border-left: 2px solid var(--dronobox-line-strong);
        color: var(--dronobox-ink-soft);
        line-height: 1.45;
        transition:
            color 0.25s var(--dronobox-ease-soft),
            border-color 0.25s var(--dronobox-ease-soft);

        &.is-sideways {
            border-color: var(--dronobox-warn);
            color: var(--dronobox-ink);
        }
        &.is-forward {
            border-color: var(--dronobox-ok);
            color: var(--dronobox-ink);
        }
    }
    &__setting {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        font-size: 0.85rem;
        color: var(--dronobox-ink-faint);

        code {
            padding: 0.15rem 0.5rem;
            border-radius: 0.4rem;
            background: var(--dronobox-panel-raised);
            color: var(--dronobox-ink);
            font-size: 0.82rem;
        }
    }

    // level: a bubble level
    &__level {
        display: grid;
        grid-template-columns: 9.5rem minmax(0, 1fr);
        align-items: center;
        gap: 1.25rem;
        padding: 0.5rem 0;

        svg {
            width: 100%;
            height: auto;
            overflow: visible;
        }
    }
    &__level-ring {
        fill: var(--dronobox-bg-2);
        stroke: var(--dronobox-line-strong);
        stroke-width: 1;
    }
    &__level-progress {
        fill: none;
        stroke: var(--dronobox-accent);
        stroke-width: 3;
        stroke-linecap: round;
        stroke-dasharray: 100;
        transform: rotate(-90deg);
        transition:
            stroke-dashoffset 0.25s linear,
            stroke 0.3s var(--dronobox-ease-soft);

        .is-ready &,
        .is-done & {
            stroke: var(--dronobox-ok);
        }
        .is-tilted &,
        .is-moving & {
            transition-duration: 0.45s, 0.3s;
            transition-timing-function: var(--dronobox-ease-out), ease;
        }
    }
    &__level-zone {
        fill: none;
        stroke: var(--dronobox-line-strong);
        stroke-dasharray: 2 3;
    }
    &__level-cross {
        stroke: var(--dronobox-line);
    }
    &__level-bubble {
        fill: var(--dronobox-ink);
        transition:
            transform 0.15s linear,
            fill 0.3s var(--dronobox-ease-soft);

        .is-tilted & {
            fill: var(--dronobox-warn);
        }
        .is-ready &,
        .is-done & {
            fill: var(--dronobox-ok);
        }
    }
    &__level-text {
        display: grid;
        gap: 0.35rem;

        strong {
            font-size: 1.15rem;
            font-weight: 600;
        }
        span {
            color: var(--dronobox-ink-soft);
            line-height: 1.45;
        }
        .is-tilted & strong {
            color: var(--dronobox-warn);
        }
        .is-done & strong {
            color: var(--dronobox-ok);
        }
    }

    // esc
    &__control {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        padding: 0.25rem 0;

        label {
            font-weight: 600;
        }
        output {
            font-family: var(--dronobox-font-mono);
            color: var(--dronobox-ink-soft);
        }
        input {
            grid-column: 1 / -1;
            width: 100%;
            min-height: 1.75rem;
            cursor: ew-resize;
        }
    }

    // motor direction puzzle
    &__puzzle {
        display: grid;
        grid-template-columns: minmax(11rem, 15rem) minmax(0, 1fr);
        align-items: center;
        gap: 1.25rem;
    }
    &__twist {
        --twist: 0;
        display: grid;
        gap: 0.5rem;

        span {
            font-size: 0.8rem;
            color: var(--dronobox-ink-faint);
        }
        strong {
            font-weight: 600;
        }
    }
    &__twist-track {
        position: relative;
        height: 0.5rem;
        border-radius: 999px;
        background: linear-gradient(
            to right,
            var(--dronobox-warn),
            var(--dronobox-line-strong) 35%,
            var(--dronobox-ok) 50%,
            var(--dronobox-line-strong) 65%,
            var(--dronobox-warn)
        );

        i {
            position: absolute;
            top: 50%;
            left: calc(50% - var(--twist) * 46%);
            width: 1rem;
            height: 1rem;
            border-radius: 999px;
            background: var(--dronobox-ink);
            box-shadow: 0 0 0 3px var(--dronobox-bg-0);
            transform: translate(-50%, -50%);
            transition: left 0.5s var(--dronobox-ease-out);
        }
    }

    // spin test
    &__arm {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.9rem;
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
        transition:
            box-shadow 0.3s var(--dronobox-ease-soft),
            background-color 0.3s var(--dronobox-ease-soft);

        > .iconify {
            width: 1.35rem;
            height: 1.35rem;
            color: var(--dronobox-ink-soft);
        }
        div {
            display: grid;
            gap: 0.1rem;
        }
        strong {
            font-weight: 600;
        }
        span {
            font-size: 0.82rem;
            color: var(--dronobox-ink-faint);
        }
        &.is-on {
            background: color-mix(in srgb, var(--dronobox-warn) 10%, transparent);
            box-shadow: inset 0 0 0 1px var(--dronobox-warn);

            > .iconify {
                color: var(--dronobox-warn);
            }
        }
        button[role="switch"] {
            background: var(--dronobox-line-strong);
            box-shadow: inset 0 0 0 1px var(--dronobox-ink-faint);
        }
        button[role="switch"][data-state="checked"] {
            background: var(--dronobox-warn);
            box-shadow: none;
        }
        button[role="switch"] [data-slot="thumb"] {
            background: var(--dronobox-ink);
        }
        button[role="switch"][data-state="checked"] [data-slot="thumb"] {
            background: var(--dronobox-on-accent);
        }
    }
    &__spin-which {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
        margin: 0;
        color: var(--dronobox-ink-soft);

        strong {
            font-family: var(--dronobox-font-mono);
            font-size: 1.4rem;
            font-weight: 500;
            color: var(--dronobox-ink);
        }
    }
    &__answers {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;

        button {
            display: grid;
            justify-items: center;
            gap: 0.4rem;
            padding: 0.9rem 0.5rem;
            border: 0;
            border-radius: 1rem;
            background: transparent;
            box-shadow: inset 0 0 0 1px var(--dronobox-line-strong);
            color: var(--dronobox-ink);
            font: inherit;
            font-weight: 560;
            cursor: pointer;
            transition:
                box-shadow 0.25s var(--dronobox-ease-soft),
                transform 0.4s var(--dronobox-ease-out);

            .iconify {
                width: 1.75rem;
                height: 1.75rem;
                color: var(--dronobox-accent);
            }
            &:active {
                transform: scale(0.97);
                transition-duration: 0.08s;
            }
            @media (hover: hover) and (pointer: fine) {
                &:hover {
                    box-shadow: inset 0 0 0 1px var(--dronobox-ink);
                }
            }
        }
    }

    // safety
    &__checks {
        display: grid;

        > * {
            padding: 0.85rem 0;
            border-bottom: 1px solid var(--dronobox-line);
        }
        > :first-child {
            border-top: 1px solid var(--dronobox-line);
        }
    }

    // spin
    &__spin {
        display: grid;
        grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
    }
    &__spin-panel {
        display: grid;
        gap: 0.8rem;
    }
    &__hold {
        touch-action: none;
        user-select: none;
    }
    &__question {
        display: grid;
        gap: 0.5rem;

        p {
            margin: 0;
        }
    }
    &__result {
        display: grid;
        gap: 0.4rem;
        justify-items: start;
    }

    // done
    &__checklist {
        display: grid;
        gap: 0.55rem;
        margin: 0;
        padding: 0;
        list-style: none;

        li {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            font-weight: 600;
        }
        .iconify {
            color: var(--dronobox-accent);
        }
    }

    &__instructor {
        display: grid;
        gap: 0.6rem;
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid var(--dronobox-line-strong);

        h2 {
            margin: 0;
            font-family: var(--dronobox-font-mono);
            font-size: 0.75rem;
            font-weight: 500;
            color: var(--dronobox-warn);
        }
    }

    // stage
    &__stage {
        position: relative;
        background: radial-gradient(ellipse 70% 60% at 50% 46%, var(--dronobox-bg-2), var(--dronobox-bg-0));
    }
    &__hud {
        position: absolute;
        left: 1.5rem;
        bottom: 1.5rem;
        pointer-events: none;
        display: flex;
        margin: 0;

        div {
            display: grid;
            gap: 0.2rem;
            min-width: 4.5rem;
            padding: 0.1rem 1.1rem 0.1rem 0.75rem;
            border-left: 1px solid var(--dronobox-line-strong);
        }
        dt {
            font-size: 0.72rem;
            color: var(--dronobox-ink-faint);
        }
        dd {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 500;
        }
        .is-roll {
            border-left-color: var(--dronobox-roll);
        }
        .is-pitch {
            border-left-color: var(--dronobox-pitch);
        }
        .is-yaw {
            border-left-color: var(--dronobox-yaw);
        }
    }

    @media (max-width: 960px) {
        &__bar {
            flex-wrap: wrap;
            padding: 0.75rem 1rem;
        }
        &__progress {
            order: 3;
            flex-basis: 100%;
            max-width: none;
        }
        // Stacked: the stage on top, the lesson under it, and the page scrolls as a whole.
        height: auto;
        min-height: 100%;

        &__main {
            display: flex;
            flex-direction: column;
            flex: none;
        }
        &__stage {
            order: -1;
            flex: none;
            height: clamp(16rem, 34svh, 26rem);
            position: sticky;
            top: 0;
            z-index: 2;
            background: var(--dronobox-bg-1);
            border-bottom: 1px solid var(--dronobox-line);
        }
        &__lesson {
            padding: 1.25rem 1rem 2rem;
            overflow: visible;
        }
        &__spin,
        &__puzzle {
            grid-template-columns: 1fr;
        }
        &__axis {
            min-height: 6.5rem;
            padding-inline: 0.65rem;
        }
        &__level {
            grid-template-columns: 7rem minmax(0, 1fr);
        }
    }
}

.dbx-fade-enter-active,
.dbx-fade-leave-active {
    transition: opacity 0.2s var(--dronobox-ease-soft);
}
.dbx-fade-enter-from,
.dbx-fade-leave-to {
    opacity: 0;
}

.dbx-swap-enter-active {
    transition:
        opacity 0.35s var(--dronobox-ease-soft),
        transform 0.55s var(--dronobox-ease-out);
}
.dbx-swap-leave-active {
    transition:
        opacity 0.14s ease-in,
        transform 0.14s ease-in;
}
.dbx-swap-enter-from {
    opacity: 0;
    transform: translateY(12px);
}
.dbx-swap-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
    .dbx-swap-enter-active,
    .dbx-swap-leave-active {
        transition: opacity 0.15s linear;
    }
    .dbx-swap-enter-from,
    .dbx-swap-leave-to {
        transform: none;
    }
}
</style>
