/**
 * unitData.js - 유닛 스탯 및 외형 정의 파일 (모딩 및 신규 유닛 추가 집중 구역)
 * 
 * 💡 새 유닛을 추가하는 방법:
 * UNIT_TYPES 객체 안에 새로운 키를 생성하고 스탯을 적어주기만 하면
 * 게임 내 UI 스폰 목록과 AI 시뮬레이터에 자동으로 즉시 등록됩니다!
 */

export const UNIT_TYPES = {
    // ==========================================
    // 🔵 BLUE 진영 (현대 군대 & 하이테크 특수부대)
    // ==========================================

    rifleman: {
        id: "rifleman",
        name: "소총수",
        desc: "안정적인 사거리와 연사력을 가진 기본 보병 (0.5칸 2열 통과)",
        faction: "blue",
        role: "ranged",
        icon: "🪖",
        
        // 전투 스탯
        hp: 100,
        speed: 1.8,
        radius: 11, // 0.5칸 규격 (직경 22px, 1칸 복도 2열 종대 통과 가능)
        sightRange: 380,
        attackRange: 320,
        damage: 18,
        attackSpeed: 3.5, // 초당 발사 횟수
        accuracy: 0.92,   // 명중률 (1.0 = 100%)
        
        // 투사체 및 무기
        weapon: "bullet",
        bulletSpeed: 14,
        bulletColor: "#38bdf8",
        bulletRadius: 2.5,
        knockback: 1.5,
        
        // 외형 디자인 (2.5D 실루엣)
        shape: "soldier",
        color: "#0ea5e9",
        barrelLength: 15,
        hasHelmet: true,
        cost: 10
    },

    shotgunner: {
        id: "shotgunner",
        name: "샷건 특공대",
        desc: "부채꼴 산탄 발사 및 압도적인 넉백(밀어내기) 방어",
        faction: "blue",
        role: "ranged",
        icon: "🛡️",
        
        hp: 170,
        speed: 1.6,
        radius: 13, // 중장갑 방탄복 (직경 26px)
        sightRange: 280,
        attackRange: 200,
        damage: 12,        // 펠릿 당 데미지
        pellets: 6,        // 1회 발사 당 펠릿 수
        spreadAngle: 0.38, // 부채꼴 각도 (라디안)
        attackSpeed: 1.2,
        accuracy: 0.85,
        
        weapon: "shotgun",
        bulletSpeed: 13,
        bulletColor: "#facc15",
        bulletRadius: 2.2,
        knockback: 5.5,    // 강력한 넉백으로 좀비 파도 저지
        
        shape: "heavy_soldier",
        color: "#0284c7",
        barrelLength: 14,
        barrelWidth: 5,
        hasVest: true,
        cost: 25
    },

    sniper: {
        id: "sniper",
        name: "저격수",
        desc: "초장거리 다중 관통탄 + 붉은 레이저 조준선",
        faction: "blue",
        role: "ranged",
        icon: "🎯",
        
        hp: 75,
        speed: 1.4,
        radius: 10, // 슬림형 정밀 사수 (직경 20px)
        sightRange: 600,
        attackRange: 550,
        damage: 150,
        penetration: 5,    // 일직선 적 5마리 관통
        attackSpeed: 0.8,  // 긴 재장전 시간
        accuracy: 0.99,
        laserSight: true,  // 보는 맛: 실시간 레이저 조준선 렌더링
        
        weapon: "tracer_bullet",
        bulletSpeed: 24,
        bulletColor: "#ffffff",
        bulletRadius: 3,
        knockback: 3.5,
        
        shape: "sniper_soldier",
        color: "#38bdf8",
        barrelLength: 22,
        cost: 35
    },

    flamethrower: {
        id: "flamethrower",
        name: "화염방사기병",
        desc: "전방 지속 화염 방출, 밀집된 군중 광역 화상 피해",
        faction: "blue",
        role: "ranged",
        icon: "🔥",
        
        hp: 140,
        speed: 1.5,
        radius: 12, // 0.5칸 규격 (직경 24px)
        sightRange: 260,
        attackRange: 180,
        damage: 8,         // 틱당 데미지
        flameSpread: 0.45,
        attackSpeed: 15,   // 초당 15회 화염 입자 방출
        burnDuration: 2.5, // 2.5초간 화상 도트 데미지
        
        weapon: "flame",
        bulletSpeed: 7,
        bulletColor: "#f97316",
        bulletRadius: 7,
        knockback: 0.4,
        
        shape: "tank_soldier", // 등 뒤에 노란 연료통
        color: "#f59e0b",
        barrelLength: 16,
        hasFuelTank: true,
        cost: 30
    },

    minigunner: {
        id: "minigunner",
        name: "미니건 터렛포",
        desc: "거치형 중화기, 초당 20발 난사로 화력 탄막 형성 (0.75칸 중형)",
        faction: "blue",
        role: "ranged",
        icon: "⚙️",
        
        hp: 250,
        speed: 0.7,        // 무거워서 이동이 매우 느림
        radius: 18,        // 중형 고정 터렛 (직경 36px)
        sightRange: 400,
        attackRange: 350,
        damage: 14,
        attackSpeed: 20.0, // 초당 20발 난사
        accuracy: 0.80,    // 약간의 탄퍼짐
        windUpTime: 0.5,   // 사격 전 회전 예열
        
        weapon: "bullet",
        bulletSpeed: 16,
        bulletColor: "#e0f2fe",
        bulletRadius: 2.2,
        knockback: 1.2,
        
        shape: "minigun_turret",
        color: "#1e293b",
        barrelLength: 22,
        cost: 60
    },

    rocket: {
        id: "rocket",
        name: "로켓 포병",
        desc: "장거리 탄착 대폭발, 광역 범위 피해 및 넉백 파편",
        faction: "blue",
        role: "artillery",
        icon: "🚀",
        
        hp: 90,
        speed: 1.3,
        radius: 12, // 0.5칸 규격 (직경 24px)
        sightRange: 480,
        attackRange: 420,
        damage: 160,
        explosionRadius: 65,
        attackSpeed: 0.6,
        accuracy: 0.90,
        
        weapon: "missile",
        bulletSpeed: 9,
        bulletColor: "#f43f5e",
        bulletRadius: 5,
        knockback: 8.0,    // 폭발 중심에서 강하게 튕겨냄
        
        shape: "bazooka_soldier",
        color: "#0369a1",
        barrelLength: 18,
        barrelWidth: 5,
        cost: 45
    },

    titan: {
        id: "titan",
        name: "메카 타이탄 (보스)",
        desc: "초거대 결전 병기. 발로 짓밟고 트윈 레이저 빔 소거 (2x2칸 보스 규격)",
        faction: "blue",
        role: "boss",
        icon: "🤖",
        
        hp: 3500,
        speed: 1.1,
        radius: 44,        // 2x2 타일(96px)을 장악하는 웅장한 크기 (직경 88px)
        sightRange: 500,
        attackRange: 450,
        damage: 60,
        stompDamage: 120,   // 근접한 적 자동 짓밟기
        laserBeam: true,   // 지속형 관통 듀얼 레이저 빔
        attackSpeed: 2.0,
        knockbackImmunity: 0.95, // 넉백에 거의 밀리지 않음
        
        weapon: "laser",
        color: "#38bdf8",
        shape: "mech_titan",
        cost: 200
    },


    // ==========================================
    // 🔴 RED 진영 (감염체, 좀비 군단, 괴수)
    // ==========================================

    runner: {
        id: "runner",
        name: "러너 좀비",
        desc: "빠른 이동 속도로 떼를 지어 덮치는 표준 감염체 (0.5칸 2열 통과)",
        faction: "red",
        role: "melee",
        icon: "🧟",
        
        hp: 70,
        speed: 2.5,
        radius: 11, // 0.5칸 규격 (직경 22px, 1칸 복도 2열 종대 통과)
        sightRange: 400,
        attackRange: 18,
        damage: 16,
        attackSpeed: 1.8,
        
        weapon: "melee",
        shape: "zombie_runner",
        color: "#dc2626",
        eyeColor: "#fef08a",
        cost: 5
    },

    brute: {
        id: "brute",
        name: "탱커 브루트",
        desc: "거대한 맷집과 파괴력. 1칸 통로를 온몸으로 틀어막는 1.0칸 전담 탱커",
        faction: "red",
        role: "tanker",
        icon: "👹",
        
        hp: 950,
        speed: 1.3,
        radius: 22, // 1.0칸 탱커 규격 (직경 44px, 48px 초크포인트를 완벽히 길막)
        sightRange: 450,
        attackRange: 32,
        damage: 65,
        slamRadius: 48,    // 주변 광역 넉백 강타
        attackSpeed: 0.8,
        knockbackImmunity: 0.85,
        
        weapon: "slam",
        shape: "brute_monster",
        color: "#991b1b",
        cost: 50
    },

    exploder: {
        id: "exploder",
        name: "자폭체",
        desc: "접근 시 붉게 박동하다 대폭발, 연쇄 폭발 유발",
        faction: "red",
        role: "suicide",
        icon: "💣",
        
        hp: 85,
        speed: 2.9,        // 달려와서 자폭
        radius: 13, // 부풀어 오른 0.55칸 규격 (직경 26px)
        sightRange: 450,
        attackRange: 24,
        damage: 220,
        explosionRadius: 90,
        pulseGlow: true,   // 폭발 직전 붉은색 고동 이펙트
        
        weapon: "self_destruct",
        shape: "bloater",
        color: "#f43f5e",
        cost: 20
    },

    spitter: {
        id: "spitter",
        name: "스피터 괴물",
        desc: "원거리에서 형광 산성액을 투척해 지면에 독 장판 형성",
        faction: "red",
        role: "ranged",
        icon: "🧪",
        
        hp: 110,
        speed: 1.7,
        radius: 12, // 0.5칸 규격 (직경 24px)
        sightRange: 420,
        attackRange: 340,
        damage: 25,
        acidPuddleRadius: 35, // 탄착 지점에 3초간 산성 웅덩이 생성
        acidDuration: 3.0,
        attackSpeed: 0.9,
        
        weapon: "acid_ball",
        bulletSpeed: 10,
        bulletColor: "#a3e635",
        bulletRadius: 5,
        
        shape: "spitter_mutant",
        color: "#65a30d",
        cost: 25
    },

    crawler: {
        id: "crawler",
        name: "스웜 크롤러",
        desc: "작고 극도로 빠름. 1칸에 9마리가 물밀듯 파도치는 극소형 물량체",
        faction: "red",
        role: "swarm",
        icon: "🕷️",
        
        hp: 30,
        speed: 3.2,
        radius: 7,         // 극소형 스웜 (직경 14px)
        sightRange: 420,
        attackRange: 14,
        damage: 8,
        attackSpeed: 2.2,
        
        weapon: "melee",
        shape: "swarm_bug",
        color: "#e11d48",
        cost: 2
    }
};

/**
 * 진영별 유닛 목록 헬퍼
 */
export const BLUE_UNITS = Object.values(UNIT_TYPES).filter(u => u.faction === "blue");
export const RED_UNITS = Object.values(UNIT_TYPES).filter(u => u.faction === "red");
