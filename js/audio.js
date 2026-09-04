/**
 * audio.js - Web Audio API 기반 무의존성 프로시저럴 사운드 신시사이저
 * 
 * 외부 오디오 파일 다운로드 없이 브라우저 내장 오디오 노드로 
 * 총성, 폭발, 레이저, 사이렌, 좀비 괴성 등의 효과음을 즉각 생성합니다.
 * 사운드 과부하를 방지하기 위해 타입별 쿨다운/스로틀링이 내장되어 있습니다.
 */

class SoundFX {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.volume = 0.4;
        this.lastPlayTime = {};

        // 오디오 컨텍스트 지연 초기화 (브라우저 사용자 제스처 정책 준수)
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported:", e);
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : this.volume;
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.masterGain && !this.isMuted) {
            this.masterGain.gain.value = this.volume;
        }
    }

    /**
     * 사운드 재생 빈도 제한 (동일 사운드 프레임당 수백번 중첩 클리핑 방지)
     */
    canPlay(soundKey, cooldownMs = 40) {
        if (this.isMuted || !this.initialized) return false;
        const now = performance.now();
        if (this.lastPlayTime[soundKey] && now - this.lastPlayTime[soundKey] < cooldownMs) {
            return false;
        }
        this.lastPlayTime[soundKey] = now;
        return true;
    }

    /**
     * 노이즈 버퍼 생성기 (폭발/총성용)
     */
    createNoiseBuffer(duration = 0.5) {
        if (!this.ctx) return null;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /**
     * 소총 / 권총 총성
     */
    playRifle() {
        if (!this.canPlay("rifle", 35)) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    /**
     * 샷건 중후한 폭음
     */
    playShotgun() {
        if (!this.canPlay("shotgun", 90)) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.2);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    /**
     * 저격수 날카로운 관통음
     */
    playSniper() {
        if (!this.canPlay("sniper", 80)) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    /**
     * 대폭발 사운드 (로켓 / 자폭 / 지뢰)
     */
    playExplosion(intensity = 1.0) {
        if (!this.canPlay("explosion", 70)) return;
        const now = this.ctx.currentTime;
        const duration = 0.5 * intensity;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7 * intensity, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + duration);
    }

    /**
     * 화염방사기 쉬익 소리
     */
    playFlame() {
        if (!this.canPlay("flame", 120)) return;
        const now = this.ctx.currentTime;
        const duration = 0.15;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(700, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + duration);
    }

    /**
     * 레이저 빔 사운드 (타이탄)
     */
    playLaser() {
        if (!this.canPlay("laser", 150)) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * 비상 사이렌 (웨이브 경보용)
     */
    playSiren() {
        if (!this.canPlay("siren", 600)) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.3);
        osc.frequency.linearRampToValueAtTime(500, now + 0.6);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.6);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.6);
    }
}

export const soundFX = new SoundFX();
