/**
 * CyberNexus Smart Jukebox & Media Player Engine (v2.0 Enterprise)
 * - Persistent Background Playback across pages (Admin <-> POS)
 * - Non-interruptive audio: Keeps playing until explicitly Paused or Logged out
 * - Real-time Multi-Tab Coordination & Leader Election (BroadcastChannel)
 * - 10-Band DSP Equalizer (Web Audio API)
 * - Continuous Background Polling for Customer Requests (customer.html)
 */
(function(window) {
    'use strict';

    const JukeboxEngine = {
        // Tab Identity & Leadership
        tabId: 'tab_' + Math.random().toString(36).substring(2, 9),
        isLeader: false,
        leaderId: null,
        lastLeaderHeartbeat: 0,
        channel: null,

        // Audio & Web Audio DSP
        audio: null,
        audioCtx: null,
        sourceNode: null,
        preampNode: null,
        eqFilters: [],
        activeEq: null,
        analyser: null,
        freqData: null,

        // State
        currentTrack: null,
        queue: [],
        history: [],
        isPlaying: false,
        volume: 0.8,
        pollingTimer: null,
        heartbeatTimer: null,
        uiListeners: new Set(),

        // Init
        init() {
            if (this._initialized) return;
            this._initialized = true;

            this._injectMarqueeStyles();

            // Load persisted volume & state
            const savedVol = localStorage.getItem('cybernexus_juke_volume');
            if (savedVol !== null) {
                this.volume = parseFloat(savedVol) || 0.8;
            }

            // Init HTML5 Audio Element
            this.audio = new Audio();
            this.audio.preload = 'auto';
            this.audio.volume = this.volume;

            this._setupAudioEvents();
            this._setupCrossTabChannel();
            this._setupLeaderElection();

            // Background Polling (Every 3.5s across all pages & tabs)
            this.startBackgroundPolling();

            // MED-03: Always load & apply active EQ preset on page boot (Admin <-> POS without opening modal)
            this.loadActiveEq();

            // Check if playback should resume automatically
            const intent = localStorage.getItem('cybernexus_juke_intent');
            if (intent === 'playing') {
                this._autoResumePlayback();
            } else {
                // Fetch initial status without auto-playing
                this.refreshStatus();
            }

            console.log(`${window.cnxT?window.cnxT('js.s_juke.f22b708d','[JukeboxEngine] Khởi động Jukebox Engine (Tab ID:'):'[JukeboxEngine] Khởi động Jukebox Engine (Tab ID:'} ${this.tabId})`);
        },

        _setupAudioEvents() {
            this.audio.addEventListener('play', () => {
                this.isPlaying = true;
                localStorage.setItem('cybernexus_juke_intent', 'playing');
                this._broadcast({
                    type: 'PLAY_STATE',
                    isPlaying: true,
                    currentTime: this.audio.currentTime,
                    track: this.currentTrack
                });
                this._notifyListeners();
            });

            this.audio.addEventListener('pause', () => {
                // Only mark as paused if user or engine paused it, not if switching tab
                this.isPlaying = false;
                const intent = localStorage.getItem('cybernexus_juke_intent');
                if (intent === 'paused' || intent === 'stopped') {
                    this._broadcast({
                        type: 'PLAY_STATE',
                        isPlaying: false,
                        currentTime: this.audio.currentTime,
                        track: this.currentTrack
                    });
                }
                this._notifyListeners();
            });

            this.audio.addEventListener('timeupdate', () => {
                if (!this.audio.duration || isNaN(this.audio.duration)) return;
                const cur = this.audio.currentTime;
                // Save timestamp periodically in localStorage so handover is seamless
                if (Math.floor(cur) % 3 === 0) {
                    localStorage.setItem('cybernexus_juke_pos', cur.toFixed(1));
                }
                this._notifyListeners();
            });

            this.audio.addEventListener('ended', () => {
                console.log('[JukeboxEngine] Bài hát kết thúc -> Tự động chuyển bài tiếp theo trong hàng đợi!');
                this.skip();
            });

            this.audio.addEventListener('error', (e) => {
                console.warn('[JukeboxEngine] Lỗi phát file âm thanh (404 / hỏng file):', e);
                this.isPlaying = false;
                this._consecutiveErrors = (this._consecutiveErrors || 0) + 1;
                if (this._consecutiveErrors >= 3) {
                    localStorage.setItem('cybernexus_juke_intent', 'paused');
                    this._broadcast({ type: 'PLAY_STATE', isPlaying: false, currentTime: 0, track: this.currentTrack });
                    this._notifyListeners();
                    if (window.Admin && typeof window.Admin.showToast === 'function') {
                        window.Admin.showToast('Không tìm thấy file nhạc trên máy chủ — đã dừng tự động để tránh lặp lỗi!', 'error', 4500);
                    }
                    return;
                }
                this._notifyListeners();
                // Try advancing to next valid track once/twice
                setTimeout(() => {
                    if (this.isLeader && localStorage.getItem('cybernexus_juke_intent') === 'playing') {
                        this.skip();
                    }
                }, 1500);
            });
            this.audio.addEventListener('playing', () => {
                this._consecutiveErrors = 0;
            });
        },

        _setupWebAudio() {
            if (this.audioCtx) return;
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                this.audioCtx = new AudioCtx();
                this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
                this.preampNode = this.audioCtx.createGain();
                this.preampNode.gain.value = 1.0;

                const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
                this.eqFilters = bands.map((freq, idx) => {
                    const f = this.audioCtx.createBiquadFilter();
                    f.type = (idx === 0) ? 'lowshelf' : (idx === bands.length - 1 ? 'highshelf' : 'peaking');
                    f.frequency.value = freq;
                    f.Q.value = 1.4;
                    f.gain.value = 0.0;
                    return f;
                });

                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 64;
                this.analyser.smoothingTimeConstant = 0.75;
                this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

                let prev = this.sourceNode;
                prev.connect(this.preampNode);
                prev = this.preampNode;
                this.eqFilters.forEach(node => {
                    prev.connect(node);
                    prev = node;
                });
                prev.connect(this.analyser);
                this.analyser.connect(this.audioCtx.destination);

                // MED-03: Apply active EQ immediately once WebAudio nodes are created
                if (this.activeEq) {
                    this.applyEqPreset(this.activeEq);
                } else {
                    this.loadActiveEq();
                }
            } catch (err) {
                console.warn('[JukeboxEngine] Web Audio DSP initialization failed:', err);
            }
        },

        applyEqPreset(preset) {
            if (!preset || typeof preset !== 'object') return;
            this.activeEq = preset;
            const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
            const preampDb = parseFloat(preset.preamp_gain ?? preset.preamp ?? 0) || 0.0;
            if (this.preampNode) {
                this.preampNode.gain.value = Math.pow(10, preampDb / 20);
            }
            if (Array.isArray(this.eqFilters) && this.eqFilters.length === bands.length) {
                bands.forEach((b, idx) => {
                    const g = parseFloat(preset[b] ?? 0) || 0.0;
                    if (this.eqFilters[idx]) this.eqFilters[idx].gain.value = g;
                });
            }
        },

        async loadActiveEq() {
            try {
                const res = await fetch('/api/media/eq/presets');
                if (!res.ok) return;
                const data = await res.json();
                if (data && data.success && Array.isArray(data.presets)) {
                    const active = data.active || data.presets.find(p => p.is_active) || data.presets[0];
                    if (active) this.applyEqPreset(active);
                }
            } catch (err) {
                (window.CyberSecurity ? CyberSecurity.logSilentError('jukebox-engine.js', err) : console.debug('jukebox-engine.js', err));
            }
        },

        broadcastEq(preset) {
            if (!preset) return;
            this.applyEqPreset(preset);
            this._broadcast({ type: 'EQ_UPDATED', preset });
        },

        _setupCrossTabChannel() {
            if (typeof BroadcastChannel !== 'undefined') {
                this.channel = new BroadcastChannel('cybernexus_jukebox');
                this.channel.onmessage = (evt) => this._handleChannelMessage(evt.data);
            } else {
                // Fallback for older browsers via localStorage storage event
                window.addEventListener('storage', (e) => {
                    if (e.key === 'cybernexus_juke_msg' && e.newValue) {
                        try {
                            const msg = JSON.parse(e.newValue);
                            this._handleChannelMessage(msg);
                        } catch (err) { (window.CyberSecurity ? CyberSecurity.logSilentError('jukebox-engine.js', err) : console.debug('jukebox-engine.js', err)); }
                    }
                });
            }
        },

        _broadcast(msg) {
            msg.sender = this.tabId;
            msg.timestamp = Date.now();
            if (this.channel) {
                this.channel.postMessage(msg);
            } else {
                localStorage.setItem('cybernexus_juke_msg', JSON.stringify(msg));
            }
        },

        _handleChannelMessage(msg) {
            if (!msg || msg.sender === this.tabId) return;

            switch (msg.type) {
                case 'HEARTBEAT':
                    this.lastLeaderHeartbeat = Date.now();
                    this.leaderId = msg.leaderId;
                    if (this.isLeader && this.tabId !== msg.leaderId) {
                        // Conflict resolution: lower tabId gives up leadership
                        if (this.tabId > msg.leaderId) {
                            this._yieldLeadership();
                        }
                    }
                    if (msg.track) this.currentTrack = msg.track;
                    this.isPlaying = msg.isPlaying;
                    this._notifyListeners();
                    break;

                case 'CLAIM_LEADERSHIP':
                    if (this.isLeader && msg.sender !== this.tabId) {
                        this._yieldLeadership();
                    }
                    this.leaderId = msg.sender;
                    this.lastLeaderHeartbeat = Date.now();
                    break;

                case 'COMMAND_PLAY':
                    localStorage.setItem('cybernexus_juke_intent', 'playing');
                    if (this.isLeader) {
                        this._resumeLocalAudio();
                    } else if (!this.leaderId) {
                        this._claimLeadership(true);
                    }
                    break;

                case 'COMMAND_PAUSE':
                    localStorage.setItem('cybernexus_juke_intent', 'paused');
                    this.isPlaying = false;
                    if (this.audio) this.audio.pause();
                    this._notifyListeners();
                    break;

                case 'COMMAND_SKIP':
                    if (this.isLeader) {
                        this.skip();
                    }
                    break;

                case 'COMMAND_VOLUME':
                    this.volume = msg.volume;
                    if (this.audio) this.audio.volume = this.volume;
                    this._notifyListeners();
                    break;

                case 'EQ_UPDATED':
                    if (msg.preset) this.applyEqPreset(msg.preset);
                    break;

                case 'COMMAND_LOGOUT':
                    console.log('[JukeboxEngine] Nhận lệnh ĐĂNG XUẤT từ tab khác -> Dừng âm thanh Jukebox hoàn toàn.');
                    this.stopAndLogout();
                    break;

                case 'PLAY_STATE':
                    this.isPlaying = msg.isPlaying;
                    if (msg.track) this.currentTrack = msg.track;
                    this._notifyListeners();
                    break;

                case 'STATUS_SYNC':
                    if (msg.status) {
                        this._applyStatus(msg.status);
                    }
                    break;
            }
        },

        _setupLeaderElection() {
            // Heartbeat loop every 1.5s
            this.heartbeatTimer = setInterval(() => {
                const now = Date.now();
                if (this.isLeader) {
                    this._broadcast({
                        type: 'HEARTBEAT',
                        leaderId: this.tabId,
                        isPlaying: this.isPlaying,
                        track: this.currentTrack,
                        currentTime: this.audio ? this.audio.currentTime : 0
                    });
                } else {
                    // Check if leader died (more than 3.5s without heartbeat)
                    if (now - this.lastLeaderHeartbeat > 3500) {
                        const intent = localStorage.getItem('cybernexus_juke_intent');
                        if (intent === 'playing') {
                            console.log('[JukeboxEngine] Leader trước không phản hồi -> Tab này tiếp quản quyền phát nhạc!');
                            this._claimLeadership(true);
                        }
                    }
                }
            }, 1500);

            // Handle tab closing or navigating: if leader closes, immediately notify others
            window.addEventListener('beforeunload', () => {
                if (this.isLeader) {
                    this._broadcast({ type: 'LEADER_DYING' });
                }
            });
        },

        _claimLeadership(startPlayback = false) {
            this.isLeader = true;
            this.leaderId = this.tabId;
            this.lastLeaderHeartbeat = Date.now();
            this._broadcast({ type: 'CLAIM_LEADERSHIP' });

            if (startPlayback) {
                const savedPos = parseFloat(localStorage.getItem('cybernexus_juke_pos') || '0');
                this._resumeLocalAudio(savedPos);
            }
        },

        _yieldLeadership() {
            this.isLeader = false;
            if (this.audio && !this.audio.paused) {
                this.audio.pause();
            }
        },

        async _autoResumePlayback() {
            const status = await this.fetchStatus();
            if (status && status.now_playing) {
                this.currentTrack = status.now_playing;
                // Wait briefly to see if another tab is already leader
                setTimeout(() => {
                    const now = Date.now();
                    if (!this.leaderId || (now - this.lastLeaderHeartbeat > 2500)) {
                        this._claimLeadership(true);
                    }
                }, 400);
            }
        },

        _resumeLocalAudio(startTime = null) {
            if (!this.currentTrack || !this.currentTrack.file_path) {
                this.refreshStatus(true);
                return;
            }

            this._setupWebAudio();
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            let fullSrc = this.currentTrack.file_path;
            if (!fullSrc.startsWith('/') && !fullSrc.startsWith('http')) {
                fullSrc = '/' + fullSrc;
            }

            if (this.audio.getAttribute('data-src') !== fullSrc) {
                this.audio.setAttribute('data-src', fullSrc);
                this.audio.src = fullSrc;
                this.audio.load();
            }

            if (startTime !== null && !isNaN(startTime) && startTime > 0) {
                this.audio.currentTime = startTime;
            }

            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.isPlaying = true;
                    localStorage.setItem('cybernexus_juke_intent', 'playing');
                    this._notifyListeners();
                }).catch(err => {
                    console.log('[JukeboxEngine] Trình duyệt chặn Autoplay. Nhấp vào phát nhạc để tiếp tục:', err);
                });
            }
        },

        // ==========================================
        // PUBLIC API CONTROLS
        // ==========================================

        togglePlay() {
            this.init();
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        },

        playTrack(track) {
            if (this._inPlayTrack) return;
            this._inPlayTrack = true;
            try {
                this.init();
                if (!track || !track.file_path) return;
                const fullSrc = track.file_path.startsWith('/') ? track.file_path : ('/' + track.file_path);
                if (this.currentTrack && this.currentTrack.file_path === track.file_path && this.audio && this.audio.getAttribute('data-current-src') === fullSrc && !this.audio.paused) {
                    return;
                }
                this.currentTrack = track;
                localStorage.setItem('cybernexus_juke_intent', 'playing');
                if (!this.isLeader) {
                    this._claimLeadership(true);
                } else {
                    this._resumeLocalAudio();
                }
                this._broadcast({ type: 'COMMAND_PLAY', track: track });
                this._notifyListeners();
            } finally {
                this._inPlayTrack = false;
            }
        },

        play() {
            this.init();
            localStorage.setItem('cybernexus_juke_intent', 'playing');
            if (!this.isLeader) {
                this._claimLeadership(true);
            } else {
                this._resumeLocalAudio();
            }
            this._broadcast({ type: 'COMMAND_PLAY' });
        },

        pause() {
            localStorage.setItem('cybernexus_juke_intent', 'paused');
            this.isPlaying = false;
            if (this.audio) {
                this.audio.pause();
            }
            this._broadcast({ type: 'COMMAND_PAUSE' });
            this._notifyListeners();
        },

        async skip() {
            try {
                const res = await fetch('/api/media/jukebox/skip', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    this._broadcast({ type: 'COMMAND_SKIP' });
                    await this.refreshStatus(true);
                }
            } catch (err) {
                console.error('[JukeboxEngine] Skip error:', err);
            }
        },

        setVolume(val) {
            const v = Math.max(0, Math.min(1, parseFloat(val) / 100));
            this.volume = v;
            localStorage.setItem('cybernexus_juke_volume', v.toString());
            if (this.audio) {
                this.audio.volume = v;
            }
            this._broadcast({ type: 'COMMAND_VOLUME', volume: v });
            this._notifyListeners();
        },

        seek(ratio) {
            if (!this.audio || !this.audio.duration) return;
            const targetTime = ratio * this.audio.duration;
            this.audio.currentTime = targetTime;
            localStorage.setItem('cybernexus_juke_pos', targetTime.toFixed(1));
            this._notifyListeners();
        },

        /**
         * Stop and Logout: Đăng xuất người dùng hoặc chủ quán -> Tắt âm thanh Jukebox hoàn toàn!
         */
        stopAndLogout() {
            console.log('[JukeboxEngine] Dừng phát Jukebox do đăng xuất hệ thống.');
            localStorage.setItem('cybernexus_juke_intent', 'stopped');
            localStorage.removeItem('cybernexus_juke_pos');
            this.isPlaying = false;
            if (this.audio) {
                this.audio.pause();
                this.audio.currentTime = 0;
            }
            this._broadcast({ type: 'COMMAND_LOGOUT' });
            this._notifyListeners();
        },

        // ==========================================
        // DATA SYNC & POLLING
        // ==========================================

        startBackgroundPolling() {
            if (this.pollingTimer) clearInterval(this.pollingTimer);
            this._statusPollInFlight = false;
            this.pollingTimer = setInterval(async () => {
                if (this._statusPollInFlight) return;
                this._statusPollInFlight = true;
                try {
                    await this.refreshStatus();
                } finally {
                    this._statusPollInFlight = false;
                }
            }, 3500);
        },

        async fetchStatus() {
            try {
                const res = await fetch('/api/media/jukebox/status');
                const data = await res.json();
                if (data.success) {
                    return data;
                }
            } catch (err) {
                // Ignore transient network errors
            }
            return null;
        },

        async refreshStatus(forcePlay = false) {
            const data = await this.fetchStatus();
            if (!data) return;

            const prevTrackId = this.currentTrack ? this.currentTrack.id : null;
            this._applyStatus(data);

            // If track changed while playing as leader
            const newTrackId = data.now_playing ? data.now_playing.id : null;
            const intent = localStorage.getItem('cybernexus_juke_intent');

            if (this.isLeader && intent === 'playing') {
                if (forcePlay || (newTrackId && newTrackId !== prevTrackId)) {
                    this._resumeLocalAudio(0);
                } else if (!this.isPlaying && this.audio && this.audio.paused && newTrackId) {
                    this._resumeLocalAudio();
                }
            }

            this._broadcast({ type: 'STATUS_SYNC', status: data });
        },

        _applyStatus(data) {
            const prevQueueCount = this.queue.length;
            this.currentTrack = data.now_playing || null;
            this.queue = Array.isArray(data.queue) ? data.queue : [];
            this.history = Array.isArray(data.history) ? data.history : [];

            // Detect newly requested customer song!
            if (this.queue.length > prevQueueCount && prevQueueCount > 0) {
                const latest = this.queue[this.queue.length - 1];
                this.onCustomerSongAdded(latest);
            }

            this._notifyListeners();
        },

        onCustomerSongAdded(item) {
            if (!item) return;
            console.log(`${window.cnxT?window.cnxT('js.s_juke.91ff26f9','[JukeboxEngine] Khách hàng'):'[JukeboxEngine] Khách hàng'} ${item.table_name || (window.cnxT?window.cnxT('js.s_juke.ce4b7c19','tại bàn'):'tại bàn')} ${window.cnxT?window.cnxT('js.s_juke.1f7a8b26','vừa yêu cầu bài:'):'vừa yêu cầu bài:'} ${item.track_title}`);
            // Dispatch a window event for toasts
            window.dispatchEvent(new CustomEvent('cybernexus_jukebox_song_added', { detail: item }));
        },

        // Request a track to queue
        async requestTrack(trackId, tableName = (window.cnxT?window.cnxT('js.s_juke.3ccffd4a','Quầy Thu Ngân (POS)'):'Quầy Thu Ngân (POS)'), isPriority = 1) {
            try {
                const res = await fetch('/api/media/jukebox/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        track_id: trackId,
                        table_name: tableName,
                        table_id: 0,
                        is_priority: isPriority ? 1 : 0
                    })
                });
                const data = await res.json();
                if (data.success) {
                    await this.refreshStatus();
                }
                return data;
            } catch (err) {
                return { success: false, message: (window.cnxT?window.cnxT('js.s_med.bc3a2780','Lỗi kết nối máy chủ Media'):'Lỗi kết nối máy chủ Media') };
            }
        },

        async voteTrack(queueId) {
            try {
                const res = await fetch('/api/media/jukebox/vote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queue_id: queueId })
                });
                const data = await res.json();
                if (data.success) {
                    await this.refreshStatus();
                }
                return data;
            } catch (err) {
                return { success: false, message: (window.cnxT?window.cnxT('js.s_med.bc3a2780','Lỗi kết nối máy chủ Media'):'Lỗi kết nối máy chủ Media') };
            }
        },

        async removeQueueItem(queueId) {
            try {
                const res = await fetch('/api/media/jukebox/remove', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queue_id: queueId })
                });
                const data = await res.json();
                if (data.success) {
                    await this.refreshStatus();
                }
                return data;
            } catch (err) {
                return { success: false, message: (window.cnxT?window.cnxT('js.s_med.bc3a2780','Lỗi kết nối máy chủ Media'):'Lỗi kết nối máy chủ Media') };
            }
        },

        // Listener hook for UI components (POS header pill, modal, admin widgets)
        addListener(fn) {
            if (typeof fn === 'function') {
                this.uiListeners.add(fn);
                fn(this.getState());
            }
        },

        removeListener(fn) {
            this.uiListeners.delete(fn);
        },

        _notifyListeners() {
            const state = this.getState();
            this.uiListeners.forEach(fn => {
                try { fn(state); } catch (e) { console.error(e); }
            });
        },

        getState() {
            return {
                currentTrack: this.currentTrack,
                queue: this.queue,
                history: this.history,
                isPlaying: this.isPlaying,
                isLeader: this.isLeader,
                currentTime: this.audio ? this.audio.currentTime : 0,
                duration: this.audio ? this.audio.duration : 0,
                volume: Math.round(this.volume * 100)
            };
        },

        _injectMarqueeStyles() {
            if (document.getElementById('juke-marquee-css')) return;
            const style = document.createElement('style');
            style.id = 'juke-marquee-css';
            style.textContent = `
                @keyframes juke-marquee-scroll {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }
                .juke-pill-fixed {
                    width: 230px !important;
                    min-width: 230px !important;
                    max-width: 230px !important;
                    height: 38px !important;
                    box-sizing: border-box !important;
                }
                .juke-text-box {
                    width: 122px !important;
                    min-width: 122px !important;
                    max-width: 122px !important;
                    overflow: hidden !important;
                    position: relative !important;
                    mask-image: linear-gradient(90deg, transparent 0%, black 6px, black calc(100% - 6px), transparent 100%);
                    -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 6px, black calc(100% - 6px), transparent 100%);
                }
                .juke-marquee-track:hover {
                    animation-play-state: paused !important;
                }
            `;
            document.head.appendChild(style);
        },

        escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        updateTitleWithMarquee(elementId, text) {
            const el = document.getElementById(elementId);
            if (!el) return;
            const cleanText = (text || '').trim();
            if (el.dataset.marqueeText === cleanText) return;
            el.dataset.marqueeText = cleanText;

            // Render temporary measuring element
            const safeText = this.escapeHtml(cleanText);
            el.innerHTML = `<span class="juke-measure-probe" style="display:inline-block;white-space:nowrap;visibility:hidden;position:absolute;font-size:12px;font-weight:700;">${safeText}</span>`;
            const probe = el.querySelector('.juke-measure-probe');
            const parentWidth = (el.parentElement ? el.parentElement.clientWidth : 122) || 122;
            const textWidth = probe ? probe.scrollWidth : 0;

            if (textWidth > parentWidth) {
                // Song title is longer than box width -> Marquee direction left!
                const duration = Math.max(8, Math.min(26, (textWidth / 22).toFixed(1)));
                el.innerHTML = `
                    <div class="juke-marquee-track" style="display:inline-flex;white-space:nowrap;animation:juke-marquee-scroll ${duration}s linear infinite;will-change:transform;">
                        <span style="padding-right:28px;">${safeText}</span>
                        <span style="padding-right:28px;">${safeText}</span>
                    </div>
                `;
            } else {
                // Fits inside the box -> clean static display
                el.innerHTML = `<div class="truncate font-bold text-white">${safeText}</div>`;
            }
        }
    };

    window.JukeboxEngine = JukeboxEngine;

    // Auto initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => JukeboxEngine.init());
    } else {
        JukeboxEngine.init();
    }
})(window);
