/**
 * config.js - 전역 시뮬레이션 설정 및 물리/비주얼 상수
 * 누구나 쉽게 시뮬레이터의 기본 규칙과 물리 상수를 튜닝할 수 있는 파일입니다.
 */

export const CONFIG = {
    // 캔버스 및 월드 기본 크기
    WORLD: {
        WIDTH: 2400,
        HEIGHT: 1600,
        DEFAULT_RATIO: '16:9', // '16:9' or '9:16'
        ASPECT_16_9: { width: 1920, height: 1080 },
        ASPECT_9_16: { width: 1080, height: 1920 }
    },

    // 성능 및 물리 최적화 설정
    PHYSICS: {
        GRID_CELL_SIZE: 48,       // 공간 분할 격자 크기 (48px 타일맵과 1:1 일치)
        FLOW_CELL_SIZE: 48,       // 유동장 타일 그리드 크기 (px)
        TIME_STEP: 1 / 60,        // 고정 델타 타임 (초)
        MAX_DELTA: 0.1,           // OBS 프레임 드랍 시 델타 타임 클램핑
        DEFAULT_TIME_SCALE: 1.0,  // 기본 재생 배속
        SLOW_MO_SCALE: 0.2,       // Z키 슬로우 모션 배속
        FAST_SCALE: 2.5,          // X키 고속 재생 배속
        FLOCKING_SEPARATION_FORCE: 1.8, // 유닛 간 겹침 방지 밀어내는 힘
        DRAG: 0.88,               // 물리 넉백 감쇠 마찰 계수
        TARGET_REPATH_INTERVAL: 4 // AI 적 탐색 프레임 주기 (타임 슬라이싱 최적화)
    },

    // 파티클 풀 최대치 (Zero-GC 메모리 풀링)
    POOLS: {
        MAX_PROJECTILES: 3000,
        MAX_PARTICLES: 4000,
        MAX_CASINGS: 1000
    },

    // 비주얼 및 이펙트 설정
    VISUALS: {
        ENABLE_SHADOWS: true,       // 2.5D 동적 타원 그림자
        HIT_FLASH_DURATION: 0.08,   // 피격 시 백색 섬광 지속 시간 (초)
        BLOOD_STAMPING: true,       // 배경 캔버스에 핏자국 영구 도장 찍기
        DEFAULT_SCREEN_SHAKE: 1.0,  // 화면 흔들림 기본 강도
        NIGHT_VISION_RADIUS: 450,   // 야간 손전등 모드 반경
    },

    // 색상 팔레트 (시인성 최우선 디자인)
    COLORS: {
        BACKGROUND: "#0f172a",      // 짙은 슬레이트 네이비 전장 배경
        GRID_LINES: "rgba(255, 255, 255, 0.03)",
        WALL: "#334155",
        WALL_BORDER: "#64748b",
        BARRICADE: "#78716c",
        
        // 🔵 Blue 진영 팔레트 (택티컬 사이안 & 하이테크)
        BLUE_PRIMARY: "#0ea5e9",
        BLUE_SECONDARY: "#0284c7",
        BLUE_GLOW: "rgba(14, 165, 233, 0.6)",
        BLUE_BULLET: "#38bdf8",

        // 🔴 Red 진영 팔레트 (감염체 크림슨 & 블러드)
        RED_PRIMARY: "#ef4444",
        RED_SECONDARY: "#b91c1c",
        RED_GLOW: "rgba(239, 68, 68, 0.6)",
        RED_BLOOD: "#881337",
        RED_ACID: "#84cc16"
    }
};
