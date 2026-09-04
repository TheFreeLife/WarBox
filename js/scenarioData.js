/**
 * scenarioData.js - 시나리오 타임라인 및 웨이브 스크립트 정의
 * 
 * 💡 시나리오 작성법:
 * - time: 경과 시간 (초)
 * - type: "banner" (자막 알림), "spawnWave" (웨이브 스폰), "airstrike" (공중폭격), "sound" (효과음)
 * - condition: 특정 상태 만족 시 발동하는 동적 트리거 함수
 */

export const SCENARIOS = {
    outpost_defense: {
        id: "outpost_defense",
        title: "외곽 전초기지 사수 작전",
        desc: "100명의 방어선에 들이닥치는 3차례 좀비 웨이브와 타이탄 증원",
        mapPreset: "choke_outpost",
        duration: 90,
        initialSpawns: [
            // 중앙 요새 초기 방어선 배치
            { type: "shotgunner", count: 12, x: 960, y: 540, radius: 100, faction: "blue" },
            { type: "rifleman", count: 25, x: 960, y: 500, radius: 150, faction: "blue" },
            { type: "flamethrower", count: 8, x: 960, y: 580, radius: 120, faction: "blue" },
            { type: "sniper", count: 10, x: 960, y: 440, radius: 160, faction: "blue" },
            { type: "minigunner", count: 4, x: 960, y: 540, radius: 80, faction: "blue" }
        ],
        events: [
            { time: 0, type: "banner", text: "작전 개시: 외곽 방어선을 사수하라!", color: "#38bdf8", duration: 3.5 },
            
            // 5초: 1차 웨이브 (서쪽 러너 좀비 300마리)
            { time: 5, type: "banner", text: "⚠️ 1차 경보: 서쪽에서 좀비 무리 급습!", color: "#f59e0b", duration: 3 },
            { time: 6, type: "spawnWave", faction: "red", unit: "runner", count: 250, area: "west" },

            // 20초: 2차 웨이브 (동쪽/북쪽 크롤러 + 자폭체 협공)
            { time: 20, type: "banner", text: "🚨 2차 경보: 북쪽 & 동쪽에서 자폭체 협공!", color: "#ef4444", duration: 3 },
            { time: 21, type: "spawnWave", faction: "red", unit: "crawler", count: 400, area: "north" },
            { time: 22, type: "spawnWave", faction: "red", unit: "exploder", count: 25, area: "east" },

            // 35초: 지원 융단폭격 발동
            { time: 35, type: "banner", text: "💥 공군 본부: 서쪽 진입로 융단폭격 개시!", color: "#38bdf8", duration: 3.5 },
            { time: 36, type: "airstrike", area: "west", count: 15 },

            // 50초: 3차 최종 웨이브 (탱커 브루트 거대 괴수 5마리 출현)
            { time: 50, type: "banner", text: "☠️ 비상 경보: 거대 변종 브루트 5마리 출현!", color: "#dc2626", duration: 4 },
            { time: 51, type: "spawnWave", faction: "red", unit: "brute", count: 5, area: "south" },
            { time: 51, type: "spawnWave", faction: "red", unit: "runner", count: 350, area: "south" },
            { time: 51, type: "screenShake", intensity: 14 },

            // 65초: 최종 결전 병기 타이탄 증원
            { time: 65, type: "banner", text: "⚡ 최종 증원: 메카 타이탄 요새 중앙 강하!", color: "#06b6d4", duration: 4 },
            { time: 66, type: "spawnExact", faction: "blue", unit: "titan", count: 1, x: 960, y: 540 }
        ]
    },

    david_vs_goliath: {
        id: "david_vs_goliath",
        title: "다윗과 골리앗 (타이탄 vs 3,000 크롤러)",
        desc: "단 1기의 메카 타이탄이 화면 전체를 뒤덮는 3,000마리의 벌레 군단과 혈투",
        mapPreset: "arena_open",
        duration: 60,
        initialSpawns: [
            { type: "titan", count: 1, x: 960, y: 540, faction: "blue" }
        ],
        events: [
            { time: 0, type: "banner", text: "타이탄 기동 완료. 3,000마리의 군집 접근 중...", color: "#06b6d4", duration: 4 },
            { time: 3, type: "spawnWave", faction: "red", unit: "crawler", count: 1000, area: "surround" },
            { time: 15, type: "banner", text: "⚠️ 크롤러 2차 증원 1,000마리 쇄도!", color: "#ef4444", duration: 3 },
            { time: 16, type: "spawnWave", faction: "red", unit: "crawler", count: 1000, area: "surround" },
            { time: 30, type: "banner", text: "🚨 최종 웨이브: 잔여 1,000마리 총공격!", color: "#dc2626", duration: 3 },
            { time: 31, type: "spawnWave", faction: "red", unit: "crawler", count: 1000, area: "surround" }
        ]
    },

    four_way_siege: {
        id: "four_way_siege",
        title: "사방 포위전 (Four-Way Siege)",
        desc: "십자 도로 중앙의 벙커를 향해 4개 방향에서 동시 압박하는 감염체 대군",
        mapPreset: "crossroad_bunker",
        duration: 75,
        initialSpawns: [
            { type: "shotgunner", count: 16, x: 960, y: 540, radius: 120, faction: "blue" },
            { type: "flamethrower", count: 12, x: 960, y: 540, radius: 140, faction: "blue" },
            { type: "rocket", count: 8, x: 960, y: 540, radius: 80, faction: "blue" },
            { type: "minigunner", count: 4, x: 960, y: 540, radius: 60, faction: "blue" }
        ],
        events: [
            { time: 0, type: "banner", text: "동서남북 4개 방향 포위망 형성 확인!", color: "#ef4444", duration: 3.5 },
            { time: 4, type: "spawnWave", faction: "red", unit: "runner", count: 200, area: "north" },
            { time: 4, type: "spawnWave", faction: "red", unit: "runner", count: 200, area: "south" },
            { time: 15, type: "spawnWave", faction: "red", unit: "runner", count: 200, area: "east" },
            { time: 15, type: "spawnWave", faction: "red", unit: "runner", count: 200, area: "west" },
            { time: 30, type: "banner", text: "🚨 자폭체 특공조 사방 동시 침투!", color: "#f43f5e", duration: 3 },
            { time: 31, type: "spawnWave", faction: "red", unit: "exploder", count: 30, area: "surround" },
            { time: 45, type: "airstrike", area: "center_around", count: 16 }
        ]
    },

    sniper_vs_brutes: {
        id: "sniper_vs_brutes",
        title: "화력 대결 (저격수 50명 vs 거대 브루트 30마리)",
        desc: "초장거리 관통 저격총의 일직선 탄도와 거수 30마리의 끈질긴 돌진",
        mapPreset: "arena_open",
        duration: 45,
        initialSpawns: [
            { type: "sniper", count: 50, x: 300, y: 540, radius: 220, faction: "blue" },
            { type: "brute", count: 30, x: 1650, y: 540, radius: 250, faction: "red" }
        ],
        events: [
            { time: 0, type: "banner", text: "저격수 50명 vs 거대 브루트 30마리 결전!", color: "#38bdf8", duration: 4 }
        ]
    },

    free_sandbox: {
        id: "free_sandbox",
        title: "자유 샌드박스 (Free Sandbox)",
        desc: "원하는 유닛과 지형을 자유롭게 배치하고 시뮬레이션할 수 있는 백지 모드",
        mapPreset: "empty",
        duration: 9999,
        initialSpawns: [],
        events: [
            { time: 0, type: "banner", text: "자유 샌드박스 모드: 하단 도구로 유닛과 맵을 배치하세요!", color: "#10b981", duration: 4 }
        ]
    }
};
