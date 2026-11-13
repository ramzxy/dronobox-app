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
                                <div v-if="activePart" class="dbx__fact">
                                    <strong>{{ $t(`dronobox:${partKey(activePart)}`) }}</strong>
                                    <p>{{ $t(`dronobox:${partKey(activePart)}Fact`) }}</p>
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
                                <AxisExplorer v-model="axisDemo" />
                                <p v-if="!axisDemo" class="dbx__task">
                                    <UIcon name="i-lucide-hand" />
                                    <span>{{ $t("dronobox:gyroTask") }}</span>
                                </p>
                                <div v-if="!axisDemo" class="dbx__axes">
                                    <div
                                        v-for="axis in axes"
                                        :key="axis.key"
                                        class="dbx__axis"
                                        :class="`is-${axis.key}`"
                                    >
                                        <span>{{ $t(`dronobox:axis${axis.label}`) }}</span>
                                        <strong>{{ axis.value }}°</strong>
                                        <div class="dbx__axis-bar">
                                            <i :style="{ transform: `scaleX(${axis.peak / 100})` }"></i>
                                        </div>
                                    </div>
                                </div>
                                <section v-if="!axisDemo" class="dbx__game" :class="`is-${game.state}`">
                                    <h2>{{ $t("dronobox:gameTitle") }}</h2>
                                    <p v-if="game.state === 'idle'">{{ $t("dronobox:gameLead") }}</p>
                                    <template v-else-if="game.state === 'playing'">
                                        <p class="dbx__game-target">
                                            {{
                                                $t("dronobox:gamePose", { n: game.index + 1, total: GAME_POSES.length })
                                            }}
                                            <strong>{{ $t(`dronobox:game${gamePose.axis}`) }}</strong>
                                        </p>
                                        <div class="dbx__game-meter">
                                            <i :style="{ transform: `scaleX(${game.hold})` }"></i>
                                        </div>
                                        <p class="dbx__hint">
                                            {{ game.matched ? $t("dronobox:gameHold") : $t("dronobox:gameMove") }}
                                        </p>
                                    </template>
                                    <div v-else class="dbx__game-score">
                                        {{ $t("dronobox:gameDone", { seconds: game.seconds.toFixed(1) }) }}
                                    </div>
                                    <div class="dbx__actions is-start">
                                        <UButton
                                            v-if="game.state !== 'playing'"
                                            color="neutral"
                                            variant="outline"
                                            icon="i-lucide-gamepad-2"
                                            :label="
                                                game.state === 'done'
                                                    ? $t('dronobox:gameAgain')
                                                    : $t('dronobox:gameStart')
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
                                    </div>
                                </section>
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:gyroWhy") }}</p>
                                </details>
                                <p v-if="!axisDemo" class="dbx__hint">{{ $t("dronobox:gyroHelp") }}</p>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!axisDemo && !gyroDone && !store.canSkip"
                                        :label="
                                            axisDemo
                                                ? $t('dronobox:axisTryReal')
                                                : gyroDone
                                                  ? $t('dronobox:gyroConfirm')
                                                  : $t('dronobox:gyroWaiting')
                                        "
                                        @click="axisDemo ? (axisDemo = null) : store.completeAndAdvance('gyro')"
                                    />
                                </footer>
                            </template>

                            <!-- 3. Board alignment -->
                            <template v-else-if="store.step === 'align'">
                                <h1>{{ $t("dronobox:alignTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:alignLead") }}</p>
                                <p class="dbx__task">
                                    <UIcon name="i-lucide-arrow-up-circle" />
                                    <span>{{ $t("dronobox:alignLook") }}</span>
                                </p>
                                <div class="dbx__compare">
                                    <div>
                                        <span>{{ $t("dronobox:alignCurrent") }}</span>
                                        <strong>{{ alignmentLabel }}</strong>
                                    </div>
                                    <UIcon name="i-lucide-arrow-right" />
                                    <div>
                                        <span>{{ $t("dronobox:alignNeeded") }}</span>
                                        <strong>CW 270°</strong>
                                    </div>
                                </div>
                                <p v-if="alignmentError" class="dbx__note is-bad">{{ alignmentError }}</p>
                                <template v-if="alignmentIsKit">
                                    <p class="dbx__note is-ok">
                                        <UIcon name="i-lucide-check-circle-2" />
                                        {{ $t("dronobox:alignOk") }}
                                    </p>
                                    <p class="dbx__task">
                                        <UIcon name="i-lucide-move-down" />
                                        <span>{{ $t("dronobox:alignCheck") }}</span>
                                    </p>
                                </template>
                                <p v-else-if="alignment === null && loaded" class="dbx__hint">
                                    {{ $t("dronobox:alignUnknown") }}
                                </p>
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:alignWhy") }}</p>
                                </details>
                                <footer class="dbx__actions">
                                    <UButton
                                        color="neutral"
                                        variant="ghost"
                                        icon="i-lucide-rotate-cw"
                                        :label="$t('dronobox:alignReplay')"
                                        @click="replayAlign"
                                    />
                                    <UButton
                                        v-if="!alignmentIsKit"
                                        size="lg"
                                        icon="i-lucide-save"
                                        :loading="alignmentBusy"
                                        :disabled="!loaded"
                                        :label="$t('dronobox:alignApply')"
                                        @click="onApplyAlignment"
                                    />
                                    <UButton
                                        v-else
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :label="$t('dronobox:alignConfirm')"
                                        @click="store.completeAndAdvance('align')"
                                    />
                                </footer>
                            </template>

                            <!-- 4. Accelerometer -->
                            <template v-else-if="store.step === 'level'">
                                <h1>{{ $t("dronobox:levelTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:levelLead") }}</p>
                                <p class="dbx__task">
                                    <UIcon name="i-lucide-table-2" />
                                    <span>{{ $t("dronobox:levelTask") }}</span>
                                </p>
                                <div class="dbx__still" :class="`is-${stillness.state}`">
                                    <div class="dbx__still-bar">
                                        <i :style="{ transform: `scaleX(${stillness.progress / 100})` }"></i>
                                    </div>
                                    <span>{{
                                        $t(
                                            `dronobox:still${stillness.state.charAt(0).toUpperCase()}${stillness.state.slice(1)}`,
                                        )
                                    }}</span>
                                </div>
                                <p v-if="levelDone" class="dbx__note is-ok">
                                    <UIcon name="i-lucide-check-circle-2" />
                                    {{ $t("dronobox:levelDone") }}
                                </p>
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:levelWhy") }}</p>
                                </details>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        :variant="levelDone ? 'outline' : 'solid'"
                                        icon="i-lucide-crosshair"
                                        :loading="calibratingAcc"
                                        :disabled="!loaded || (stillness.state !== 'ready' && !store.canSkip)"
                                        :label="calibratingAcc ? $t('dronobox:levelBusy') : $t('dronobox:levelButton')"
                                        @click="onCalibrate"
                                    />
                                    <UButton
                                        v-if="levelDone || store.canSkip"
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :label="$t('dronobox:next')"
                                        @click="store.completeAndAdvance('level')"
                                    />
                                </footer>
                            </template>

                            <!-- 5a. The ESC -->
                            <template v-else-if="store.step === 'motors' && motorPhase === 'esc'">
                                <h1>{{ $t("dronobox:escTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:escLead") }}</p>
                                <ul class="dbx__facts">
                                    <li>{{ $t("dronobox:escFact1") }}</li>
                                    <li>{{ $t("dronobox:escFact2") }}</li>
                                    <li>{{ $t("dronobox:escFact3") }}</li>
                                </ul>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :label="$t('dronobox:escNext')"
                                        @click="motorPhase = 'sandbox'"
                                    />
                                </footer>
                            </template>

                            <!-- 5b. Direction sandbox -->
                            <template v-else-if="store.step === 'motors'">
                                <h1>{{ $t("dronobox:sandboxTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:sandboxLead") }}</p>
                                <div class="dbx__quad" :aria-label="$t('dronobox:motorsMapLabel')">
                                    <div v-for="motor in sandboxLayout" :key="motor.number" class="dbx__quad-motor">
                                        <span
                                            >M{{ motor.number }} ·
                                            {{ $t(`dronobox:pos${capitalize(motor.position)}`) }}</span
                                        >
                                        <div class="dbx__toggle">
                                            <button
                                                v-for="dir in ['cw', 'ccw'] as const"
                                                :key="dir"
                                                type="button"
                                                :class="{ 'is-on': sandboxDirs[motor.number] === dir }"
                                                :disabled="sandboxFlying"
                                                @click="sandboxDirs[motor.number] = dir"
                                            >
                                                <UIcon
                                                    :name="dir === 'cw' ? 'i-lucide-rotate-cw' : 'i-lucide-rotate-ccw'"
                                                />
                                                {{
                                                    dir === "cw"
                                                        ? $t("dronobox:motorsCwShort")
                                                        : $t("dronobox:motorsCcwShort")
                                                }}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="dbx__presets">
                                    <span>{{ $t("dronobox:sandboxTry") }}</span>
                                    <button type="button" :disabled="sandboxFlying" @click="sandboxPreset('kit')">
                                        {{ $t("dronobox:sandboxPresetKit") }}
                                    </button>
                                    <button type="button" :disabled="sandboxFlying" @click="sandboxPreset('allCw')">
                                        {{ $t("dronobox:sandboxPresetAllCw") }}
                                    </button>
                                    <button type="button" :disabled="sandboxFlying" @click="sandboxPreset('split')">
                                        {{ $t("dronobox:sandboxPresetSplit") }}
                                    </button>
                                </div>
                                <p
                                    v-if="sandboxFlying || sandboxLanded"
                                    class="dbx__note"
                                    :class="sandboxOutcomeNow === 'stable' ? 'is-ok' : 'is-warn'"
                                >
                                    {{ $t(`dronobox:sandbox_${sandboxOutcomeNow}`) }}
                                </p>
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:motorsWhy") }}</p>
                                </details>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        :color="sandboxFlying ? 'neutral' : 'primary'"
                                        :variant="sandboxFlying ? 'outline' : 'solid'"
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
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!sandboxStableFlown && !store.canSkip"
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
                                </div>
                                <div v-if="propsOff && watcherPresent" class="dbx__battery">
                                    <p class="dbx__task">
                                        <UIcon name="i-lucide-battery-charging" />
                                        <span>{{ $t("dronobox:safetyBattery") }}</span>
                                    </p>
                                    <p v-if="batteryPresent" class="dbx__note is-ok">
                                        <UIcon name="i-lucide-check-circle-2" />
                                        {{ $t("dronobox:safetyBatteryOk", { volts: batteryVolts.toFixed(1) }) }}
                                    </p>
                                    <p v-else class="dbx__hint">{{ $t("dronobox:safetyBatteryWaiting") }}</p>
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

                            <!-- 7. Real motor test -->
                            <template v-else-if="store.step === 'spin'">
                                <h1>{{ $t("dronobox:motorsTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:motorsLead") }}</p>
                                <div class="dbx__spin">
                                    <MotorMap
                                        :motors="DRONOBOX_KIT.motors"
                                        :checks="store.motors"
                                        :selected="selectedMotor"
                                        :spinning="spinningMotor"
                                        :reveal-all="store.instructorUnlocked"
                                        @select="selectMotor"
                                    />
                                    <div class="dbx__spin-panel">
                                        <USwitch
                                            v-model="motorsTestingEnabled"
                                            :disabled="!motorStateReady || !batteryPresent"
                                            :label="$t('dronobox:motorsEnable')"
                                            :description="
                                                batteryPresent
                                                    ? $t('dronobox:motorsEnableHelp')
                                                    : $t('dronobox:motorsNoBattery')
                                            "
                                        />
                                        <template v-if="selectedMotor !== null && selectedKitMotor">
                                            <strong class="dbx__motor-name">
                                                {{
                                                    $t("dronobox:motorsSelected", {
                                                        n: selectedMotor,
                                                        position: $t(
                                                            `dronobox:pos${capitalize(selectedKitMotor.position)}`,
                                                        ),
                                                    })
                                                }}
                                            </strong>
                                            <UButton
                                                size="lg"
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
                                            <div v-if="currentCheck?.answer == null" class="dbx__question">
                                                <p>{{ $t("dronobox:motorsQuestion", { n: selectedMotor }) }}</p>
                                                <div class="dbx__answers">
                                                    <UButton
                                                        color="neutral"
                                                        variant="outline"
                                                        icon="i-lucide-rotate-cw"
                                                        :disabled="!spunMotors.has(selectedMotor)"
                                                        :label="$t('dronobox:motorsCw')"
                                                        @click="answer('cw')"
                                                    />
                                                    <UButton
                                                        color="neutral"
                                                        variant="outline"
                                                        icon="i-lucide-rotate-ccw"
                                                        :disabled="!spunMotors.has(selectedMotor)"
                                                        :label="$t('dronobox:motorsCcw')"
                                                        @click="answer('ccw')"
                                                    />
                                                </div>
                                                <p v-if="!spunMotors.has(selectedMotor)" class="dbx__hint">
                                                    {{ $t("dronobox:motorsSpinFirst") }}
                                                </p>
                                            </div>
                                            <div v-else class="dbx__result">
                                                <p v-if="currentCheck.correct" class="dbx__note is-ok">
                                                    <UIcon name="i-lucide-check-circle-2" />
                                                    {{ $t("dronobox:motorsCorrect", { n: selectedMotor }) }}
                                                </p>
                                                <p v-else class="dbx__note is-bad">
                                                    <UIcon name="i-lucide-circle-x" />
                                                    {{ $t("dronobox:motorsWrong", { n: selectedMotor }) }}
                                                </p>
                                                <UButton
                                                    color="neutral"
                                                    variant="ghost"
                                                    icon="i-lucide-refresh-ccw"
                                                    :label="$t('dronobox:motorsRetry')"
                                                    @click="retryMotor"
                                                />
                                            </div>
                                        </template>
                                        <p v-else class="dbx__hint">{{ $t("dronobox:motorsPick") }}</p>
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

                            <!-- 8. Radio -->
                            <template v-else-if="store.step === 'radio'">
                                <h1>{{ $t("dronobox:radioTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:radioLead") }}</p>
                                <p v-if="!hasRadioSignal" class="dbx__note is-warn">
                                    <UIcon name="i-lucide-radio" />
                                    {{ $t("dronobox:radioNoSignal") }}
                                </p>
                                <StickCheck :channels="rcChannels" @complete="radioDone = true" />
                                <details class="dbx__why">
                                    <summary>{{ $t("dronobox:whyTitle") }}</summary>
                                    <p>{{ $t("dronobox:radioWhy") }}</p>
                                </details>
                                <footer class="dbx__actions">
                                    <UButton
                                        size="lg"
                                        trailing-icon="i-lucide-arrow-right"
                                        :disabled="!radioDone && !store.canSkip"
                                        :label="$t('dronobox:next')"
                                        @click="store.completeAndAdvance('radio')"
                                    />
                                </footer>
                            </template>

                            <!-- 9. Done -->
                            <template v-else>
                                <h1>{{ $t("dronobox:doneTitle") }}</h1>
                                <p class="dbx__lead">{{ $t("dronobox:doneLead") }}</p>
                                <ul class="dbx__checklist">
                                    <li><UIcon name="i-lucide-fan" />{{ $t("dronobox:doneProps") }}</li>
                                    <li><UIcon name="i-lucide-gamepad-2" />{{ $t("dronobox:doneSticks") }}</li>
                                    <li><UIcon name="i-lucide-arrow-up-from-line" />{{ $t("dronobox:doneHover") }}</li>
                                </ul>
                                <div class="dbx__arming">
                                    <h2>{{ $t("dronobox:armingTitle") }}</h2>
                                    <ArmingStatus :reasons="armingReasons" />
                                    <p class="dbx__hint">{{ $t("dronobox:doneArming") }}</p>
                                </div>
                                <p class="dbx__task">
                                    <UIcon name="i-lucide-unplug" />
                                    <span>{{ $t("dronobox:doneDisconnect") }}</span>
                                </p>
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
                    @turn="turnAxis"
                    @pick="pickPart"
                    @hover="hoverPart = $event"
                >
                    <p v-if="axisDemo && store.step === 'gyro'" class="dbx__stage-caption">
                        {{ $t("dronobox:axisReference") }}
                    </p>
                    <dl v-if="showHud" class="dbx__hud">
                        <div class="is-roll">
                            <dt>{{ $t("dronobox:axisRoll") }}</dt>
                            <dd>{{ attitude.roll.toFixed(0) }}°</dd>
                        </div>
                        <div class="is-pitch">
                            <dt>{{ $t("dronobox:axisPitch") }}</dt>
                            <dd>{{ attitude.pitch.toFixed(0) }}°</dd>
                        </div>
                        <div>
                            <dt>{{ $t("dronobox:liveBattery") }}</dt>
                            <dd>{{ batteryPresent ? `${batteryVolts.toFixed(1)} V` : $t("dronobox:liveUsbOnly") }}</dd>
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
import AxisExplorer from "@/components/dronobox/AxisExplorer.vue";
import MotorMap from "@/components/dronobox/MotorMap.vue";
import StickCheck from "@/components/dronobox/StickCheck.vue";
import ArmingStatus from "@/components/dronobox/ArmingStatus.vue";
import KitStageView from "@/components/dronobox/KitStageView.vue";
import InstructorDialog from "@/components/dronobox/InstructorDialog.vue";
import { i18n } from "@/js/localization";
import { disconnect } from "@/js/serial_backend";
import { useDialog } from "@/composables/useDialog";
import { useDronoBoxFc } from "@/composables/dronobox/useDronoBoxFc";
import { DRONOBOX_STEPS, useDronoBoxStore, type DronoBoxStep } from "@/stores/dronobox";
import { DRONOBOX_KIT, type SpinDirection } from "@/dronobox/kit";
import { KIT_PARTS, type KitPart, type ShotName, type StageInput, type AxisDemo } from "@/dronobox/stage/KitStage";
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
function turnAxis(delta: number): void {
    if (!axisDemo.value) return;
    axisDemo.value = { ...axisDemo.value, angle: Math.max(-45, Math.min(45, axisDemo.value.angle + delta)) };
}
watch(axisDemo, (demo) => {
    if (demo) stopGame();
});

const {
    loaded,
    load,
    attitude,
    batteryVolts,
    batteryPresent,
    rcChannels,
    armingReasons,
    startAttitudePolling,
    startRcPolling,
    stopRcPolling,
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

// --- 2. gyro: each axis bar fills as the drone is turned about it -------------------------------

const GYRO_TARGET = 25;
const peaks = reactive({ roll: 0, pitch: 0, yaw: 0 });
let yawStart: number | null = null;
const gyroDone = computed(() => Math.max(peaks.roll, peaks.pitch) >= GYRO_TARGET);
const axes = computed(() => [
    {
        key: "roll",
        label: "Roll",
        value: attitude.value.roll.toFixed(0),
        peak: Math.min(100, (peaks.roll / GYRO_TARGET) * 100),
    },
    {
        key: "pitch",
        label: "Pitch",
        value: attitude.value.pitch.toFixed(0),
        peak: Math.min(100, (peaks.pitch / GYRO_TARGET) * 100),
    },
    {
        key: "yaw",
        label: "Yaw",
        value: attitude.value.heading.toFixed(0),
        peak: Math.min(100, (peaks.yaw / 45) * 100),
    },
]);

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

// --- 3. alignment ---------------------------------------------------------------------------

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

// --- 4. accelerometer: calibrate only once the drone has been flat and still for a moment ----------

const STILL_MS = 2000;
const STILL_DEG = 0.6;
const FLAT_DEG = 8;
const levelDone = ref(store.isCompleted("level"));
const stillness = reactive({ state: "waiting" as "waiting" | "moving" | "tilted" | "ready", progress: 0 });
let stillSince: number | null = null;
let lastSample: { roll: number; pitch: number } | null = null;

async function onCalibrate(): Promise<void> {
    await calibrateAccelerometer();
    levelDone.value = !accNeedsCalibration.value;
}

watch(attitude, (value) => {
    if (store.step === "gyro") {
        updateGame(value.roll, value.pitch);
        peaks.roll = Math.max(peaks.roll, Math.abs(value.roll));
        peaks.pitch = Math.max(peaks.pitch, Math.abs(value.pitch));
        yawStart ??= value.heading;
        const turned = Math.abs(((value.heading - yawStart + 540) % 360) - 180);
        peaks.yaw = Math.max(peaks.yaw, turned);
    }
    if (store.step === "level") {
        const now = performance.now();
        const moved = lastSample
            ? Math.max(Math.abs(value.roll - lastSample.roll), Math.abs(value.pitch - lastSample.pitch))
            : 0;
        lastSample = { roll: value.roll, pitch: value.pitch };
        if (Math.abs(value.roll) > FLAT_DEG || Math.abs(value.pitch) > FLAT_DEG) {
            stillness.state = "tilted";
            stillSince = null;
        } else if (moved > STILL_DEG) {
            stillness.state = "moving";
            stillSince = null;
        } else {
            stillSince ??= now;
            const held = now - stillSince;
            stillness.state = held >= STILL_MS ? "ready" : "waiting";
            stillness.progress = Math.min(100, (held / STILL_MS) * 100);
            return;
        }
        stillness.progress = 0;
    }
});

// --- 5. motor lesson: the ESC, then a direction sandbox -------------------------------------

const motorPhase = ref<"esc" | "sandbox">("esc");
watch(motorPhase, scrollLessonToStart);
const sandboxDirs = reactive<Record<number, SpinDirection>>(
    Object.fromEntries(DRONOBOX_KIT.motors.map((m) => [m.number, "cw"])) as Record<number, SpinDirection>,
);
const sandboxFlying = ref(false);
const sandboxLanded = ref(false);
const sandboxStableFlown = ref(store.isCompleted("motors"));
const sandboxOutcomeNow = computed(() => sandboxOutcome(sandboxDirs));
// Laid out like the drone seen from above, front on top.
const sandboxLayout = computed(() =>
    ["frontLeft", "frontRight", "backLeft", "backRight"].map(
        (position) => DRONOBOX_KIT.motors.find((m) => m.position === position) ?? DRONOBOX_KIT.motors[0],
    ),
);

function sandboxPreset(name: "kit" | "allCw" | "split"): void {
    for (const motor of DRONOBOX_KIT.motors) {
        if (name === "kit") {
            sandboxDirs[motor.number] = motor.direction;
        } else if (name === "allCw") {
            sandboxDirs[motor.number] = "cw";
        } else {
            sandboxDirs[motor.number] = motor.position.endsWith("Left") ? "cw" : "ccw";
        }
    }
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
const safetyReady = computed(() => propsOff.value && watcherPresent.value && batteryPresent.value);

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

// --- 8. radio -------------------------------------------------------------------------------

const radioDone = ref(store.isCompleted("radio"));
const hasRadioSignal = computed(
    () => !armingReasons.value.includes("RXLOSS") && rcChannels.value.some((value) => value > 0),
);
const sticks = computed(() => {
    const ch = rcChannels.value;
    if (!hasRadioSignal.value || ch.length < 4) {
        return null;
    }
    const centred = (v: number) => Math.max(-1, Math.min(1, (v - 1500) / 500));
    return {
        roll: centred(ch[0]),
        pitch: centred(ch[1]),
        yaw: centred(ch[2]),
        throttle: Math.max(0, Math.min(1, (ch[3] - 1000) / 1000)),
    };
});

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
        if (step === "radio") {
            startRcPolling();
        } else if (previous === "radio") {
            stopRcPolling();
        }
        if (step === "align") {
            replayAlign();
        }
        if (step === "level") {
            stillSince = null;
            lastSample = null;
        }
        if (step === "motors") {
            motorPhase.value = "esc";
        }
    },
);
watch(batteryPresent, (present) => {
    if (!present && motorsTestingEnabled.value) {
        motorsTestingEnabled.value = false;
    }
});

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
    radio: "radio",
    done: "done",
};

const stageHighlight = computed<KitPart | null>(() => {
    if (store.step === "meet") {
        return activePart.value;
    }
    if (store.step === "motors" && motorPhase.value === "esc") {
        return "esc";
    }
    if (store.step === "radio") {
        return "receiver";
    }
    return null;
});

// Live readouts only where the lesson is about live data.
const showHud = computed(
    () => !axisDemo.value && ["gyro", "level", "safety", "spin", "radio", "done"].includes(store.step),
);

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
        attitude:
            (step === "gyro" && !axisDemo.value) || step === "level"
                ? { ...attitude.value }
                : { roll: 0, pitch: 0, heading: 0 },
        sticks: step === "radio" ? sticks.value : null,
        spinningMotor: step === "spin" ? spinningMotor.value : null,
        selectedMotor: step === "spin" ? selectedMotor.value : null,
        revealedMotors: revealedMotors.value,
        propsOn: step === "spin" ? false : step === "safety" ? !propsOff.value : true,
        batteryIn: step === "safety" || step === "spin" ? batteryPresent.value : true,
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
    radioDone.value = false;
    propsOff.value = false;
    watcherPresent.value = false;
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
    if (store.step === "radio") {
        startRcPolling();
    }
});

onBeforeUnmount(() => {
    mounted = false;
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
        gap: 1.25rem;
        padding: 0.9rem 1.5rem;
        border-bottom: 1px solid var(--dronobox-line);
    }
    &__brand {
        display: grid;
        line-height: 1.05;

        strong {
            font-size: 1.15rem;
            font-weight: 800;
            letter-spacing: -0.02em;
        }
        span {
            font-size: 0.7rem;
            color: var(--dronobox-ink-faint);
        }
    }
    &__where {
        margin: 0 0 0 auto;
        font-size: 0.85rem;
        font-weight: 600;
        white-space: nowrap;

        span {
            margin-right: 0.4rem;
            color: var(--dronobox-ink-faint);
            font-weight: 500;
            font-variant-numeric: tabular-nums;
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
        border-radius: 0.5rem;
        background: transparent;
        cursor: pointer;
        overflow: hidden;

        &:disabled {
            cursor: default;
        }
        &:focus-visible {
            outline: 2px solid var(--dronobox-accent);
            outline-offset: 2px;
        }
    }
    &__seg-fill {
        position: absolute;
        inset: auto 0.25rem 0;
        height: 2px;
        border-radius: inherit;
        background: var(--dronobox-accent);
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
    }
    &__seg-number {
        font-size: 0.8rem;
        font-variant-numeric: tabular-nums;
    }
    &__seg.is-active {
        color: var(--dronobox-ink);
        background: var(--dronobox-panel-raised);
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
        padding: 2rem clamp(1.25rem, 2.5vw, 2.5rem);
        background: var(--dronobox-panel);
        border-right: 1px solid var(--dronobox-line);
        overflow-y: auto;
    }
    &__lesson-inner {
        display: grid;
        gap: 1.25rem;
        align-content: start;

        h1 {
            margin: 0;
            font-size: clamp(1.7rem, 2.6vw, 2.35rem);
            font-weight: 650;
            text-wrap: balance;
            line-height: 1.12;
            letter-spacing: -0.025em;
            color: var(--dronobox-ink);
        }
        h2 {
            margin: 0 0 0.5rem;
            font-size: 0.95rem;
            font-weight: 700;
        }
    }
    &__lead {
        margin: 0;
        font-size: 1.05rem;
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
        gap: 0.5rem;
        margin: 0;
        padding: 0.7rem 0.85rem;
        border-radius: 0.65rem;
        line-height: 1.45;
        background: var(--dronobox-panel);

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
            background: color-mix(in srgb, var(--dronobox-warn) 14%, var(--dronobox-panel));

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
        gap: 0.15rem 1rem;
    }
    &__part {
        padding: 0.65rem 0.6rem;
        min-height: 2.75rem;
        margin: 0 -0.6rem;
        border: 0;
        border-radius: 0.45rem;
        background: transparent;
        color: var(--dronobox-ink-soft);
        font-size: 1rem;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        transition:
            color 0.15s ease,
            background-color 0.15s ease;

        &:hover,
        &:focus-visible {
            color: var(--dronobox-ink);
            background: var(--dronobox-panel);
        }
        &.is-active {
            color: var(--dronobox-on-accent);
            background: var(--dronobox-accent);
        }
    }
    &__fact {
        min-height: 6.5rem;

        strong {
            font-size: 1.1rem;
        }
        p {
            margin: 0.35rem 0 0;
            color: var(--dronobox-ink-soft);
            line-height: 1.55;
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
    // gyro
    &__axes {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
    }
    &__axis {
        display: grid;
        gap: 0.2rem;

        span {
            font-size: 0.75rem;
            color: var(--dronobox-ink-soft);
        }
        strong {
            font-size: 1.9rem;
            font-weight: 800;
            line-height: 1.1;
            color: var(--axis);
            font-variant-numeric: tabular-nums;
        }
        &.is-roll {
            --axis: var(--dronobox-roll);
        }
        &.is-pitch {
            --axis: var(--dronobox-pitch);
        }
        &.is-yaw {
            --axis: var(--dronobox-yaw);
        }
    }
    &__axis-bar {
        height: 0.3rem;
        border-radius: 999px;
        background: var(--dronobox-line);
        overflow: hidden;

        i {
            display: block;
            height: 100%;
            background: var(--axis);
            width: 100%;
            transform-origin: left;
            transition: transform 0.2s ease;
        }
    }

    &__game {
        display: grid;
        gap: 0.6rem;
        padding: 1rem 1.1rem;
        border-radius: 0.75rem;
        background: var(--dronobox-panel);

        h2 {
            margin: 0;
            font-size: 1.05rem;
        }
        p {
            margin: 0;
            color: var(--dronobox-ink-soft);
            line-height: 1.5;
        }
        &.is-done {
            background: color-mix(in srgb, var(--dronobox-ok) 14%, var(--dronobox-panel));
        }
    }
    &__game-target strong {
        margin-left: 0.35rem;
        color: var(--dronobox-ink);
    }
    &__game-meter {
        height: 0.5rem;
        border-radius: 999px;
        background: var(--dronobox-line);
        overflow: hidden;

        i {
            display: block;
            height: 100%;
            background: var(--dronobox-ok);
            width: 100%;
            transform-origin: left;
        }
    }
    &__game-score {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--dronobox-ink);
    }

    // align
    &__compare {
        display: flex;
        align-items: center;
        gap: 0.9rem;

        div {
            display: grid;
            gap: 0.15rem;
            min-width: 8rem;
            padding: 0.6rem 0.9rem;
            border: 1px solid var(--dronobox-line);
            border-radius: 0.65rem;
            background: var(--dronobox-panel);
        }
        span {
            font-size: 0.75rem;
            color: var(--dronobox-ink-soft);
        }
        strong {
            font-size: 1.15rem;
        }
    }

    // level
    &__still {
        display: grid;
        gap: 0.4rem;
        font-weight: 600;

        &.is-ready {
            color: var(--dronobox-ok);
        }
        &.is-moving,
        &.is-tilted {
            color: var(--dronobox-warn);
        }
    }
    &__still-bar {
        height: 0.45rem;
        border-radius: 999px;
        background: var(--dronobox-line);
        overflow: hidden;

        i {
            display: block;
            height: 100%;
            background: var(--dronobox-ok);
            width: 100%;
            transform-origin: left;
            transition: transform 0.15s linear;
        }
    }

    // motor lesson
    &__facts {
        display: grid;
        gap: 0.5rem;
        margin: 0;
        padding-left: 1.1rem;
        color: var(--dronobox-ink-soft);
        line-height: 1.5;
    }
    &__quad {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.5rem;
    }
    &__quad-motor {
        display: grid;
        gap: 0.4rem;
        padding: 0.65rem 0.75rem;
        border: 1px solid var(--dronobox-line);
        border-radius: 0.65rem;
        background: var(--dronobox-panel);

        span {
            font-size: 0.78rem;
            color: var(--dronobox-ink-soft);
        }
    }
    &__toggle {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.25rem;
        padding: 0.2rem;
        border-radius: 0.5rem;
        background: var(--dronobox-bg-0);

        button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.3rem;
            padding: 0.35rem;
            border: 0;
            border-radius: 0.4rem;
            background: transparent;
            color: var(--dronobox-ink-soft);
            font-weight: 700;
            font-size: 0.82rem;
            cursor: pointer;

            &.is-on {
                background: var(--dronobox-accent);
                color: var(--dronobox-on-accent);
            }
            &:disabled {
                cursor: not-allowed;
                opacity: 0.6;
            }
        }
    }
    &__presets {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem 0.75rem;
        font-size: 0.85rem;
        color: var(--dronobox-ink-faint);

        button {
            padding: 0;
            border: 0;
            background: none;
            color: var(--dronobox-accent);
            font-weight: 600;
            text-decoration: underline;
            text-underline-offset: 3px;
            cursor: pointer;

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }
    }

    // safety
    &__checks,
    &__battery {
        display: grid;
        gap: 0.75rem;
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
    &__motor-name {
        font-size: 1.02rem;
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
    &__answers {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
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
    &__arming {
        padding: 0.9rem 1rem;
        border: 1px solid var(--dronobox-line);
        border-radius: 0.75rem;
        background: var(--dronobox-panel);
    }

    &__instructor {
        display: grid;
        gap: 0.6rem;
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px dashed var(--dronobox-line-strong);

        h2 {
            margin: 0;
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--dronobox-warn);
        }
    }

    // stage
    &__stage {
        position: relative;
    }
    &__hud {
        position: absolute;
        left: 1.5rem;
        bottom: 1.5rem;
        pointer-events: none;
        display: flex;
        gap: 0.4rem;
        margin: 0;

        div {
            display: grid;
            gap: 0.05rem;
            min-width: 4.6rem;
            padding: 0.4rem 0.65rem;
            border: 0;
            border-radius: 0;
            background: var(--dronobox-chip);
        }
        dt {
            font-size: 0.68rem;
            color: var(--dronobox-ink-faint);
        }
        dd {
            margin: 0;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }
        .is-roll dd {
            color: var(--dronobox-roll);
        }
        .is-pitch dd {
            color: var(--dronobox-pitch);
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
        &__spin {
            grid-template-columns: 1fr;
        }
    }
}

.dbx-swap-enter-active,
.dbx-swap-leave-active {
    transition:
        opacity 0.16s ease,
        transform 0.16s var(--dronobox-ease-out);
}
.dbx-swap-enter-from {
    opacity: 0;
    transform: translateY(6px);
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
