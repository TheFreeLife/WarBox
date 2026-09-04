/**
 * main.js - 애플리케이션 진입점 및 UI 이벤트 바인딩
 * 
 * - BattleEngine 초기화
 * - unitData.js 기반 동적 유닛 선택 덱 렌더링
 * - 마우스 드래그 스폰, 우클릭 패닝, 휠 줌
 * - 유튜브 녹화 단축키 (H, Space, Z, X, R, C, 1~5) 지원
 */

import { BattleEngine } from './engine.js';
import { UNIT_TYPES, BLUE_UNITS, RED_UNITS } from './unitData.js';
import { YOUTUBE_PRESETS } from './presets.js';
import { soundFX } from './audio.js';

window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("main-canvas");
    const viewportContainer = document.getElementById("viewport-container");

    // 1. 엔진 초기화 및 시작
    const engine = new BattleEngine(canvas, viewportContainer);
    engine.start();

    // 현재 선택된 상태
    let selectedFaction = "blue";
    let selectedUnitId = "rifleman";
    let brushRadius = 45;
    let brushCount = 10;
    let activeGodPower = null;

    // 인게임 알림 토스트 컨트롤러
    const gameToast = document.getElementById("game-toast");
    let toastTimeout = null;

    function showToast(message, type = "info", duration = 4000) {
        if (!gameToast) return;
        if (toastTimeout) {
            clearTimeout(toastTimeout);
            toastTimeout = null;
        }
        gameToast.className = `game-toast ${type} show`;
        gameToast.innerHTML = message;

        if (duration > 0) {
            toastTimeout = setTimeout(() => {
                hideToast();
            }, duration);
        }
    }

    function hideToast() {
        if (!gameToast) return;
        if (toastTimeout) {
            clearTimeout(toastTimeout);
            toastTimeout = null;
        }
        gameToast.classList.remove("show");
    }

    // 2. 동적 유닛 덱 생성 (unitData.js와 자동 연동)
    const unitDeckContainer = document.getElementById("unit-deck-container");

    function renderUnitDeck() {
        unitDeckContainer.innerHTML = "";
        const units = selectedFaction === "blue" ? BLUE_UNITS : RED_UNITS;

        units.forEach(unit => {
            const card = document.createElement("div");
            card.className = `unit-card ${selectedFaction === "blue" ? "faction-blue" : "faction-red"}`;
            if (unit.id === selectedUnitId) card.classList.add("active");

            card.innerHTML = `
                <span class="unit-icon">${unit.icon || "⚔️"}</span>
                <span class="unit-name">${unit.name}</span>
                <span class="unit-cost">HP ${unit.hp} | 사거리 ${unit.attackRange || 20}</span>
            `;

            card.addEventListener("click", () => {
                selectedUnitId = unit.id;
                activeGodPower = null;
                hideToast();
                document.querySelectorAll(".unit-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
            });

            unitDeckContainer.appendChild(card);
        });
    }

    renderUnitDeck();

    // 3. 진영 선택 토글
    const blueBtn = document.getElementById("faction-blue-btn");
    const redBtn = document.getElementById("faction-red-btn");

    blueBtn.addEventListener("click", () => {
        selectedFaction = "blue";
        selectedUnitId = "rifleman";
        blueBtn.classList.add("active");
        redBtn.classList.remove("active");
        renderUnitDeck();
    });

    redBtn.addEventListener("click", () => {
        selectedFaction = "red";
        selectedUnitId = "runner";
        redBtn.classList.add("active");
        blueBtn.classList.remove("active");
        renderUnitDeck();
    });

    // 4. 슬라이더 바인딩
    const brushRadiusInput = document.getElementById("brush-radius");
    const brushRadiusVal = document.getElementById("brush-radius-val");
    brushRadiusInput.addEventListener("input", (e) => {
        brushRadius = parseInt(e.target.value);
        brushRadiusVal.textContent = `${brushRadius}px`;
    });

    const brushCountInput = document.getElementById("brush-count");
    const brushCountVal = document.getElementById("brush-count-val");
    brushCountInput.addEventListener("input", (e) => {
        brushCount = parseInt(e.target.value);
        brushCountVal.textContent = `${brushCount}마리`;
    });

    // 5. 마우스 상호작용 (스폰, 맵 에디팅, 패닝)
    let isLeftMouseDown = false;
    let isRightMouseDown = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let camStartX = 0;
    let camStartY = 0;
    let lastSpawnTime = 0;

    // 첫 클릭 시 오디오 컨텍스트 활성화
    window.addEventListener("click", () => soundFX.init(), { once: true });

    // 전체 화면(UI 메뉴, 버튼, 캔버스 등)에서 우클릭 컨텍스트 메뉴 완전 차단
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("mousedown", (e) => {
        soundFX.init();
        const worldPos = engine.camera.screenToWorld(e.clientX, e.clientY);

        if (e.button === 0) {
            // 좌클릭
            isLeftMouseDown = true;

            // 신의 권능 발동 모드인 경우
            if (activeGodPower === "nuke") {
                engine.tweaker.triggerNuke(worldPos.x, worldPos.y);
                activeGodPower = null;
                hideToast();
                return;
            } else if (activeGodPower === "blackhole") {
                engine.tweaker.triggerBlackHole(worldPos.x, worldPos.y);
                activeGodPower = null;
                hideToast();
                return;
            }

            // 맵 에디터 활성화 상태인 경우
            if (engine.mapEditor.active) {
                engine.mapEditor.handleMouseDown(worldPos.x, worldPos.y);
                return;
            }

            // 일반 유닛 브러시 스폰
            engine.unitManager.spawnBrush(
                selectedUnitId,
                worldPos.x,
                worldPos.y,
                brushRadius,
                brushCount,
                selectedFaction
            );
        } else if (e.button === 1 || e.button === 2) {
            // 우클릭 시 신의 권능 취소
            if (activeGodPower) {
                activeGodPower = null;
                hideToast();
            }

            // 휠 클릭 또는 우클릭: 카메라 패닝
            isRightMouseDown = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            camStartX = engine.camera.x;
            camStartY = engine.camera.y;
        }
    });

    window.addEventListener("mousemove", (e) => {
        const worldPos = engine.camera.screenToWorld(e.clientX, e.clientY);

        if (isLeftMouseDown) {
            if (engine.mapEditor.active) {
                engine.mapEditor.handleMouseMove(worldPos.x, worldPos.y);
            } else if (!activeGodPower) {
                // 마우스 드래그로 연속 스폰 (0.08초 간격 스로틀링)
                const now = performance.now();
                if (now - lastSpawnTime > 80) {
                    lastSpawnTime = now;
                    engine.unitManager.spawnBrush(
                        selectedUnitId,
                        worldPos.x,
                        worldPos.y,
                        brushRadius,
                        Math.max(1, Math.round(brushCount / 3)),
                        selectedFaction
                    );
                }
            }
        }

        if (isRightMouseDown) {
            const dx = (e.clientX - dragStartX) / engine.camera.zoom;
            const dy = (e.clientY - dragStartY) / engine.camera.zoom;
            engine.camera.x = camStartX - dx;
            engine.camera.y = camStartY - dy;
        }
    });

    window.addEventListener("mouseup", (e) => {
        const worldPos = engine.camera.screenToWorld(e.clientX, e.clientY);
        if (e.button === 0) {
            isLeftMouseDown = false;
            if (engine.mapEditor.active) {
                engine.mapEditor.handleMouseUp(worldPos.x, worldPos.y);
            }
        } else if (e.button === 1 || e.button === 2) {
            isRightMouseDown = false;
        }
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        engine.camera.zoomAt(e.clientX, e.clientY, -e.deltaY);
    }, { passive: false });

    // 6. 상단 버튼 바인딩
    const btnPause = document.getElementById("btn-pause");
    btnPause.addEventListener("click", () => {
        const paused = engine.togglePause();
        btnPause.textContent = paused ? "▶️ 재생" : "⏸️ 정지";
        btnPause.classList.toggle("active", paused);
    });

    const btnSlowMo = document.getElementById("btn-slowmo");
    btnSlowMo.addEventListener("click", () => {
        const scale = engine.toggleSlowMo();
        btnSlowMo.classList.toggle("active", scale === 0.2);
    });

    const btnFast = document.getElementById("btn-fast");
    btnFast.addEventListener("click", () => {
        const scale = engine.toggleFastForward();
        btnFast.classList.toggle("active", scale === 2.5);
    });

    const btnAspect = document.getElementById("btn-aspect");
    btnAspect.addEventListener("click", () => {
        engine.camera.toggleAspectMode();
        btnAspect.textContent = engine.camera.aspectMode === "16:9" ? "📱 16:9" : "🎬 9:16 쇼츠";
    });

    const btnClean = document.getElementById("btn-clean");
    btnClean.addEventListener("click", () => {
        engine.toggleCleanRecording();
    });

    const btnClear = document.getElementById("btn-clear");
    btnClear.addEventListener("click", () => {
        engine.clearAll();
        document.getElementById("scenario-title").textContent = "샌드박스 (초기 상태)";
        document.getElementById("scenario-time").textContent = "00:00";
        document.getElementById("scenario-next").textContent = "유닛을 배치하거나 프리셋(1~5)을 로드하세요";
    });

    // 7. 사이드 패널 토글 (맵 에디터 & 변수 조절기)
    const mapPanel = document.getElementById("map-editor-panel");
    const tweakerPanel = document.getElementById("tweaker-panel");
    const btnToggleEditor = document.getElementById("btn-toggle-editor");
    const btnToggleTweaker = document.getElementById("btn-toggle-tweaker");

    btnToggleEditor.addEventListener("click", () => {
        const isHidden = mapPanel.classList.toggle("hidden");
        engine.mapEditor.toggleActive(!isHidden);
        btnToggleEditor.classList.toggle("active", !isHidden);
    });

    document.getElementById("close-editor-btn").addEventListener("click", () => {
        mapPanel.classList.add("hidden");
        engine.mapEditor.toggleActive(false);
        btnToggleEditor.classList.remove("active");
    });

    btnToggleTweaker.addEventListener("click", () => {
        const isHidden = tweakerPanel.classList.toggle("hidden");
        btnToggleTweaker.classList.toggle("active", !isHidden);
    });

    document.getElementById("close-tweaker-btn").addEventListener("click", () => {
        tweakerPanel.classList.add("hidden");
        btnToggleTweaker.classList.remove("active");
    });

    // 7.5. 단축키 안내 팝업 모달 토글
    const shortcutsModal = document.getElementById("shortcuts-modal");
    const btnShortcutsTop = document.getElementById("btn-shortcuts-top");
    const btnToggleShortcuts = document.getElementById("btn-toggle-shortcuts");
    const closeShortcutsBtn = document.getElementById("close-shortcuts-btn");

    function toggleShortcutsModal(forceOpen) {
        if (!shortcutsModal) return;
        const isCurrentlyOpen = !shortcutsModal.classList.contains("hidden");
        const shouldOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;
        shortcutsModal.classList.toggle("hidden", !shouldOpen);
        if (btnShortcutsTop) btnShortcutsTop.classList.toggle("active", shouldOpen);
        if (btnToggleShortcuts) btnToggleShortcuts.classList.toggle("active", shouldOpen);
    }

    if (btnShortcutsTop) {
        btnShortcutsTop.addEventListener("click", () => toggleShortcutsModal());
    }
    if (btnToggleShortcuts) {
        btnToggleShortcuts.addEventListener("click", () => toggleShortcutsModal());
    }
    if (closeShortcutsBtn) {
        closeShortcutsBtn.addEventListener("click", () => toggleShortcutsModal(false));
    }
    if (shortcutsModal) {
        shortcutsModal.addEventListener("click", (e) => {
            if (e.target === shortcutsModal) {
                toggleShortcutsModal(false);
            }
        });
    }

    // 맵 에디터 도구 선택
    document.querySelectorAll("[data-map-tool]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-map-tool]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            engine.mapEditor.setTool(btn.getAttribute("data-map-tool"));
        });
    });

    const btnToggleFlow = document.getElementById("btn-toggle-flow-debug");
    if (btnToggleFlow) {
        btnToggleFlow.addEventListener("click", () => {
            engine.flowFieldManager.debugRender = !engine.flowFieldManager.debugRender;
            btnToggleFlow.classList.toggle("active", engine.flowFieldManager.debugRender);
            const mode = engine.flowFieldManager.debugRender 
                ? `ON (${engine.flowFieldManager.debugFaction.toUpperCase()} 진영, Tab으로 전환)` 
                : "OFF";
            showToast(`유동장(Flow Field) 시각화: ${mode}`);
        });
    }

    const btnPresetChoke = document.getElementById("btn-preset-choke");
    if (btnPresetChoke) {
        btnPresetChoke.addEventListener("click", () => {
            engine.mapManager.loadPreset("choke_outpost");
            showToast("🏰 <strong>초크포인트 요새</strong> 타일맵 로드 완료");
        });
    }

    const btnPresetCrossroad = document.getElementById("btn-preset-crossroad");
    if (btnPresetCrossroad) {
        btnPresetCrossroad.addEventListener("click", () => {
            engine.mapManager.loadPreset("crossroad_bunker");
            showToast("⚔️ <strong>십자로 벙커</strong> 타일맵 로드 완료");
        });
    }

    const btnImportMap = document.getElementById("btn-import-map");
    const inputImportMap = document.getElementById("input-import-map");
    if (btnImportMap && inputImportMap) {
        btnImportMap.addEventListener("click", () => {
            inputImportMap.click();
        });
        inputImportMap.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                engine.mapEditor.importMapFromFile(e.target.files[0]);
                showToast("📂 타일맵 파일이 성공적으로 로드되었습니다.");
                e.target.value = "";
            }
        });
    }

    document.getElementById("btn-export-map").addEventListener("click", () => {
        engine.mapEditor.exportMapToFile();
        showToast("💾 타일맵 JSON 파일이 저장되었습니다.");
    });

    document.getElementById("btn-clear-map").addEventListener("click", () => {
        engine.mapManager.clear();
        showToast("🗑️ 모든 타일이 제거되었습니다.");
    });

    // 변수 조절기 설정 바인딩
    const toggleInfection = document.getElementById("toggle-infection");
    toggleInfection.addEventListener("change", (e) => {
        engine.tweaker.setInfectionMode(e.target.checked);
    });

    const sliderKnockback = document.getElementById("slider-knockback");
    const knockbackVal = document.getElementById("knockback-val");
    sliderKnockback.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        engine.tweaker.setKnockbackScale(val);
        knockbackVal.textContent = `${val.toFixed(1)}x`;
    });

    // 신의 권능 버튼
    document.getElementById("btn-god-nuke").addEventListener("click", () => {
        activeGodPower = "nuke";
        showToast("☢️ <strong>전술 핵 타격 모드</strong>: 지면을 클릭하세요 (우클릭/ESC 취소)", "nuke", 0);
        tweakerPanel.classList.add("hidden");
        btnToggleTweaker.classList.remove("active");
    });

    document.getElementById("btn-god-blackhole").addEventListener("click", () => {
        activeGodPower = "blackhole";
        showToast("🕳️ <strong>블랙홀 생성 모드</strong>: 지면을 클릭하세요 (우클릭/ESC 취소)", "blackhole", 0);
        tweakerPanel.classList.add("hidden");
        btnToggleTweaker.classList.remove("active");
    });

    // 시나리오 프리셋 버튼 렌더링
    const presetContainer = document.getElementById("preset-buttons-container");
    YOUTUBE_PRESETS.forEach(p => {
        const btn = document.createElement("button");
        btn.className = "btn-tactical";
        btn.style.justifyContent = "flex-start";
        btn.innerHTML = `${p.thumbnailIcon} <strong>[${p.hotkey}]</strong> ${p.title.split(". ")[1]}`;
        btn.addEventListener("click", () => {
            engine.scenarioDirector.loadScenario(p.scenarioId);
            document.getElementById("scenario-title").textContent = p.title.split(". ")[1];
            tweakerPanel.classList.add("hidden");
            btnToggleTweaker.classList.remove("active");
        });
        presetContainer.appendChild(btn);
    });

    // 8. 전역 키보드 단축키
    window.addEventListener("keydown", (e) => {
        const key = e.key.toUpperCase();

        if (e.key === "Escape" || key === "ESCAPE") {
            if (shortcutsModal && !shortcutsModal.classList.contains("hidden")) {
                toggleShortcutsModal(false);
                return;
            }
            if (activeGodPower) {
                activeGodPower = null;
                hideToast();
            }
        } else if (e.key === "?" || (e.key === "/" && !e.ctrlKey)) {
            toggleShortcutsModal();
        } else if (key === "H") {
            engine.toggleCleanRecording();
        } else if (e.code === "Space") {
            e.preventDefault();
            btnPause.click();
        } else if (key === "Z") {
            btnSlowMo.click();
        } else if (key === "X") {
            btnFast.click();
        } else if (key === "R") {
            btnAspect.click();
        } else if (key === "C") {
            if (activeGodPower) {
                activeGodPower = null;
                hideToast();
            }
            btnClear.click();
        } else if (key === "E") {
            btnToggleEditor.click();
        } else if (key === "T") {
            btnToggleTweaker.click();
        } else if (key === "F") {
            engine.flowFieldManager.debugRender = !engine.flowFieldManager.debugRender;
            const tierText = engine.flowFieldManager.debugTier === 1 ? "1x1 소형" : "2x2 대형";
            const mode = engine.flowFieldManager.debugRender 
                ? `ON [${engine.flowFieldManager.debugFaction.toUpperCase()} | ${tierText}] (Tab:진영, G:크기)` 
                : "OFF";
            showToast(`유동장 시각화: ${mode}`);
        } else if (e.key === "Tab" && engine.flowFieldManager.debugRender) {
            e.preventDefault();
            engine.flowFieldManager.debugFaction = engine.flowFieldManager.debugFaction === "red" ? "blue" : "red";
            const tierText = engine.flowFieldManager.debugTier === 1 ? "1x1 소형" : "2x2 대형";
            showToast(`유동장 표시: ${engine.flowFieldManager.debugFaction.toUpperCase()} [${tierText}]`);
        } else if (key === "G" && engine.flowFieldManager.debugRender) {
            let nextTier = engine.flowFieldManager.debugTier + 1;
            if (nextTier > 3) nextTier = 1;
            engine.flowFieldManager.debugTier = nextTier;

            let tierText = "";
            if (nextTier === 1) tierText = "Tier 1: 1x1 소형/보병 (1칸 샛길 통과)";
            else if (nextTier === 2) tierText = "Tier 2: 2x2 중형/탱커 (2칸 도로 통과)";
            else tierText = "Tier 3: 3x3 초대형/타이탄 (3칸 광장/대로만 통과)";

            showToast(`유동장 규격: <strong>${tierText}</strong>`);
        } else if (["1", "2", "3", "4", "5"].includes(key)) {
            const idx = parseInt(key) - 1;
            if (YOUTUBE_PRESETS[idx]) {
                engine.scenarioDirector.loadScenario(YOUTUBE_PRESETS[idx].scenarioId);
                document.getElementById("scenario-title").textContent = YOUTUBE_PRESETS[idx].title.split(". ")[1];
            }
        }
    });

    // 9. 실시간 HUD 및 통계 업데이트 인터벌
    const blueCountEl = document.getElementById("blue-count");
    const redCountEl = document.getElementById("red-count");
    const blueKillsEl = document.getElementById("blue-kills");
    const redKillsEl = document.getElementById("red-kills");
    const perfFpsEl = document.getElementById("perf-fps");
    const perfMsEl = document.getElementById("perf-ms");
    const totalUnitsEl = document.getElementById("total-units");
    const scenarioTimeEl = document.getElementById("scenario-time");
    const scenarioNextEl = document.getElementById("scenario-next");

    setInterval(() => {
        blueCountEl.textContent = engine.unitManager.blueCount.toLocaleString();
        redCountEl.textContent = engine.unitManager.redCount.toLocaleString();
        blueKillsEl.textContent = engine.unitManager.blueKills.toLocaleString();
        redKillsEl.textContent = engine.unitManager.redKills.toLocaleString();

        perfFpsEl.textContent = `${engine.fps} FPS`;
        perfMsEl.textContent = `${engine.frameTimeMs}ms`;
        totalUnitsEl.textContent = `${engine.unitManager.units.length.toLocaleString()} Units`;

        if (engine.scenarioDirector.currentScenario) {
            const sec = Math.floor(engine.scenarioDirector.elapsedTime);
            const m = String(Math.floor(sec / 60)).padStart(2, '0');
            const s = String(sec % 60).padStart(2, '0');
            scenarioTimeEl.textContent = `${m}:${s}`;
            scenarioNextEl.textContent = engine.scenarioDirector.getNextEventInfo();
        } else {
            scenarioTimeEl.textContent = "00:00";
            scenarioNextEl.textContent = "유닛을 배치하거나 프리셋(1~5)을 로드하세요";
        }
    }, 100);

    // 창 리사이즈 대응
    window.addEventListener("resize", () => {
        engine.camera.updateCanvasResolution();
    });
});
