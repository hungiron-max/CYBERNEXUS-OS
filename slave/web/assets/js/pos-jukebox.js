/**
 * CyberNexus POS Jukebox Controller & DSP Studio Console
 * Professional In-Store Media Center with 10-Band Equalizer, Live Oscilloscope, Queue & Catalog Management
 */
(function(window) {
    'use strict';

    const POSJukebox = {
        activeTab: 'queue',
        catalog: [],
        filteredCatalog: [],
        activeGenre: 'ALL',
        searchQuery: '',
        eqPresets: [],
        eqBands: {
            band_31hz: 0.0, band_62hz: 0.0, band_125hz: 0.0, band_250hz: 0.0, band_500hz: 0.0,
            band_1khz: 0.0, band_2khz: 0.0, band_4khz: 0.0, band_8khz: 0.0, band_16khz: 0.0
        },
        eqPreamp: 0.0,
        waveAnimFrameId: null,
        eqBandsEnvelopes: new Array(10).fill(0),

        init() {
            if (this._initialized) return;
            this._initialized = true;

            // Subscribe to Jukebox Engine updates
            if (window.JukeboxEngine) {
                window.JukeboxEngine.addListener((state) => this.renderHeaderPill(state));
            }

            // Notification when a customer requests a song from QR table
            window.addEventListener('cybernexus_jukebox_song_added', (e) => {
                const item = e.detail;
                this.showToast(`🎵 <b>${item.table_name || 'Khách tại bàn'}</b> vừa yêu cầu: "${item.track_title}"`, 'info');
            });

            console.log('[POSJukebox] POS Jukebox Controller & DSP Console đã sẵn sàng.');
        },

        renderHeaderPill(state) {
            const pill = document.getElementById('pos-jukebox-pill');
            if (!pill) return;

            const disc = document.getElementById('pos-juke-disc');
            const titleEl = document.getElementById('pos-juke-title');
            const artistEl = document.getElementById('pos-juke-artist');
            const playIcon = document.getElementById('pos-juke-play-icon');

            if (state.currentTrack && state.currentTrack.track_title) {
                if (window.JukeboxEngine) {
                    window.JukeboxEngine.updateTitleWithMarquee('pos-juke-title', state.currentTrack.track_title);
                } else if (titleEl) {
                    titleEl.textContent = state.currentTrack.track_title;
                }
                if (artistEl) artistEl.textContent = state.currentTrack.track_artist || (state.currentTrack.table_name || 'Đang phát');
            } else {
                if (window.JukeboxEngine) {
                    window.JukeboxEngine.updateTitleWithMarquee('pos-juke-title', 'Jukebox Âm Nhạc');
                } else if (titleEl) {
                    titleEl.textContent = 'Jukebox Âm Nhạc';
                }
                if (artistEl) artistEl.textContent = 'Hệ thống sẵn sàng';
            }

            if (state.isPlaying) {
                if (disc) disc.classList.add('animate-spin');
                if (playIcon) playIcon.className = 'fas fa-pause text-[10px] text-fuchsia-300';
            } else {
                if (disc) disc.classList.remove('animate-spin');
                if (playIcon) playIcon.className = 'fas fa-play text-[10px] text-white';
            }

            // If modal is currently open, re-render its content
            const modal = document.getElementById('pos-jukebox-modal');
            if (modal && !modal.classList.contains('hidden') && modal.style.display !== 'none') {
                this.renderModalContent(state);
            }
        },

        openModal() {
            let modal = document.getElementById('pos-jukebox-modal');
            if (!modal) {
                this._createModalDOM();
                modal = document.getElementById('pos-jukebox-modal');
            }

            modal.classList.remove('hidden');
            modal.style.display = 'flex';

            // Load song catalog & EQ presets
            this.loadCatalog();
            this.loadEqPresets();

            // Render current state
            if (window.JukeboxEngine) {
                this.renderModalContent(window.JukeboxEngine.getState());
            }

            // Start wave animation loop
            this.startWaveLoop();
        },

        closeModal() {
            const modal = document.getElementById('pos-jukebox-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
            this.stopWaveLoop();
        },

        _createModalDOM() {
            const div = document.createElement('div');
            div.id = 'pos-jukebox-modal';
            div.style.cssText = 'position: fixed; inset: 0; z-index: 99998; background: rgba(3, 7, 18, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); display: none; align-items: center; justify-content: center; padding: 12px;';
            div.innerHTML = `
                <div class="w-full max-w-5xl rounded-3xl bg-slate-950/95 border border-fuchsia-500/30 shadow-2xl shadow-fuchsia-500/20 overflow-hidden flex flex-col max-h-[92vh] transition-all" onclick="event.stopPropagation()">
                    
                    <!-- Modal Header -->
                    <div class="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-fuchsia-950/60 via-slate-900/60 to-purple-950/60 shrink-0">
                        <div class="flex items-center gap-2.5">
                            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-fuchsia-600 via-pink-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/30">
                                <i class="fas fa-compact-disc text-sm animate-spin" style="animation-duration: 4s;"></i>
                            </div>
                            <div>
                                <h3 class="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                                    <span>JUKEBOX & DSP STUDIO CONSOLE - THU NGÂN</span>
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40">48kHz Lossless DSP</span>
                                </h3>
                                <p class="text-[11px] text-slate-400">Điều khiển âm nhạc, tinh chỉnh 10-Band EQ & Quản lý phát nhạc trực tiếp tại quầy</p>
                            </div>
                        </div>
                        <button type="button" onclick="POSJukebox.closeModal()" class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer">
                            <i class="fas fa-times text-sm"></i>
                        </button>
                    </div>

                    <!-- Modal Body: 2-Column Responsive Studio Layout -->
                    <div class="p-4 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
                        
                        <!-- LEFT COLUMN (5 cols): Player & 10-Band DSP Studio Console -->
                        <div class="lg:col-span-5 space-y-3.5 flex flex-col">
                            
                            <!-- Now Playing Console Card -->
                            <div class="p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-fuchsia-950/30 border border-fuchsia-500/25 shadow-lg relative overflow-hidden">
                                <div class="flex items-center gap-3.5">
                                    <!-- Animated Vinyl Disc Visual -->
                                    <div class="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                                        <div id="pos-modal-disc" class="w-full h-full rounded-full border-4 border-slate-800 shadow-xl flex items-center justify-center relative overflow-hidden" style="background: radial-gradient(circle, #0f172a 25%, #020617 26%, #1e293b 28%, #020617 40%, #1e293b 42%, #020617 56%, #1e293b 58%, #020617 72%, #1e293b 74%, #020617 100%);">
                                            <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-fuchsia-500 to-pink-500 flex items-center justify-center text-white border-2 border-slate-950 shadow-inner">
                                                <i id="pos-modal-disc-icon" class="fas fa-music text-[10px]"></i>
                                            </div>
                                        </div>
                                        <span id="pos-modal-disc-dot" class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-sm animate-pulse"></span>
                                    </div>

                                    <!-- Track Details -->
                                    <div class="flex-1 min-w-0">
                                        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-fuchsia-500/15 text-fuchsia-300 text-[10px] font-bold border border-fuchsia-500/30 mb-1">
                                            <i class="fas fa-tower-broadcast animate-pulse"></i>
                                            <span id="pos-modal-source">Hệ Thống Quán</span>
                                        </div>
                                        <h4 id="pos-modal-track-title" class="text-sm sm:text-base font-black text-white truncate leading-tight">Chưa có bài hát đang phát</h4>
                                        <p id="pos-modal-track-artist" class="text-xs text-slate-400 truncate mt-0.5">Hệ thống sẵn sàng</p>
                                    </div>
                                </div>

                                <!-- Progress Bar & Seek -->
                                <div class="mt-3 flex items-center gap-2">
                                    <span id="pos-modal-cur-time" class="text-[10px] font-mono text-slate-400 w-9 text-right shrink-0">00:00</span>
                                    <div class="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden cursor-pointer relative group" onclick="POSJukebox.onSeek(event)">
                                        <div id="pos-modal-progress-bar" class="h-full bg-gradient-to-r from-fuchsia-500 to-pink-400 rounded-full transition-all relative" style="width: 0%;">
                                            <span class="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"></span>
                                        </div>
                                    </div>
                                    <span id="pos-modal-dur-time" class="text-[10px] font-mono text-slate-400 w-9 shrink-0">00:00</span>
                                </div>

                                <!-- Controls & Master Volume -->
                                <div class="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <!-- Play / Pause Button -->
                                        <button id="pos-modal-play-btn" type="button" onclick="POSJukebox.togglePlay()" class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-fuchsia-600/30 cursor-pointer transition active:scale-95">
                                            <i id="pos-modal-play-btn-icon" class="fas fa-play text-xs"></i>
                                            <span id="pos-modal-play-btn-text">Phát</span>
                                        </button>
                                        <!-- Skip Button -->
                                        <button type="button" onclick="POSJukebox.skipTrack()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-white/10 shadow-sm cursor-pointer transition active:scale-95" title="Chuyển sang bài tiếp theo">
                                            <i class="fas fa-forward-step text-xs text-sky-400"></i>
                                            <span>Bài Sau</span>
                                        </button>
                                    </div>

                                    <!-- Volume Slider -->
                                    <div class="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded-xl border border-white/10 shrink-0">
                                        <i class="fas fa-volume-high text-xs text-slate-400"></i>
                                        <input type="range" id="pos-modal-volume-slider" min="0" max="100" value="80" oninput="POSJukebox.setVolume(this.value)" class="w-16 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-fuchsia-500">
                                        <span id="pos-modal-volume-text" class="text-[10px] font-mono font-bold text-slate-300 w-6 text-right">80%</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 10-Band DSP Studio Console Card (Hardware Studio Mixer UI) -->
                            <div class="eq-studio-rack p-3.5 rounded-2xl flex flex-col space-y-2.5 shadow-xl flex-1">
                                <!-- Top Bar: Title, Presets & Flat 0dB -->
                                <div class="flex flex-wrap items-center justify-between pb-2 border-b border-white/10 gap-2">
                                    <div class="flex items-center gap-2">
                                        <div class="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 text-[11px] shadow-[0_0_8px_rgba(56,189,248,0.3)]">
                                            <i class="fas fa-sliders-h"></i>
                                        </div>
                                        <div>
                                            <div class="text-xs font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5 leading-tight">
                                                TIMBRE MASTERING EQUALIZER
                                            </div>
                                            <div class="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-wider leading-none mt-0.5">
                                                PRO 10-BAND 64-BIT DSP AUDIO ENGINE
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> EQ ON
                                        </span>
                                        <select id="pos-eq-preset-select" onchange="POSJukebox.onSelectPreset(this.value)" class="bg-slate-900 border border-sky-500/30 text-sky-300 text-[10px] rounded-lg px-2 py-1 font-bold focus:outline-none cursor-pointer">
                                            <option value="">🎵 Flat (Gốc)...</option>
                                        </select>
                                        <button type="button" onclick="POSJukebox.applyFlatEq()" class="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-white/10 transition flex items-center gap-1" title="Đặt lại Flat 0dB">
                                            <i class="fas fa-rotate-left text-sky-400 text-[9px]"></i> Flat
                                        </button>
                                    </div>
                                </div>

                                <!-- Spectrum Wave Display Screen (Hi-Fi Screen with dB markings) -->
                                <div class="dsp-spectrum-screen relative w-full rounded-xl border border-sky-500/30 p-2 overflow-hidden shadow-inner" style="height: 110px; min-height: 110px; background: radial-gradient(ellipse at 50% 50%, #08172e 0%, #020713 100%);">
                                    <!-- Background Grid Lines -->
                                    <div class="absolute inset-x-10 inset-y-2 pointer-events-none opacity-20">
                                        <div class="w-full h-full border-b border-t border-slate-400 grid grid-rows-4">
                                            <div class="border-b border-dashed border-slate-500"></div>
                                            <div class="border-b border-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.5)]"></div>
                                            <div class="border-b border-dashed border-slate-500"></div>
                                            <div></div>
                                        </div>
                                    </div>

                                    <!-- Decibel Scale on Left -->
                                    <div class="dsp-db-label left p12">+12 dB</div>
                                    <div class="dsp-db-label left p6">+6 dB</div>
                                    <div class="dsp-db-label left zero">0 dB</div>
                                    <div class="dsp-db-label left m6">-6 dB</div>
                                    <div class="dsp-db-label left m12">-12 dB</div>

                                    <!-- Decibel Scale on Right -->
                                    <div class="dsp-db-label right p12">+12 dB</div>
                                    <div class="dsp-db-label right p6">+6 dB</div>
                                    <div class="dsp-db-label right zero">0 dB</div>
                                    <div class="dsp-db-label right m6">-6 dB</div>
                                    <div class="dsp-db-label right m12">-12 dB</div>

                                    <!-- Realtime Waveform SVG -->
                                    <svg id="pos-eq-curve-svg" class="w-full h-full relative z-1 pointer-events-none" viewBox="0 0 600 120" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="posEqGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.32" />
                                                <stop offset="65%" stop-color="#818cf8" stop-opacity="0.10" />
                                                <stop offset="100%" stop-color="#0284c7" stop-opacity="0.0" />
                                            </linearGradient>
                                            <linearGradient id="posEqWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stop-color="#38bdf8" />
                                                <stop offset="35%" stop-color="#22d3ee" />
                                                <stop offset="70%" stop-color="#a855f7" />
                                                <stop offset="100%" stop-color="#38bdf8" />
                                            </linearGradient>
                                            <filter id="posStudioGlow" x="-20%" y="-20%" width="140%" height="140%">
                                                <feGaussianBlur stdDeviation="1.0" result="blur" />
                                                <feMerge>
                                                    <feMergeNode in="blur" />
                                                    <feMergeNode in="SourceGraphic" />
                                                </feMerge>
                                            </filter>
                                        </defs>
                                        <path id="pos-eq-curve-fill" d="" fill="url(#posEqGradient)" />
                                        <path id="pos-eq-curve-wave" d="" fill="none" stroke="rgba(168, 85, 247, 0.45)" stroke-width="0.8" stroke-dasharray="4,2" />
                                        <path id="pos-eq-curve-stroke" d="" fill="none" stroke="url(#posEqWaveGrad)" stroke-width="1.3" stroke-linecap="round" filter="url(#posStudioGlow)" />
                                        <g id="pos-eq-curve-nodes"></g>
                                    </svg>
                                </div>

                                <!-- 10 Vertical Faders Hardware Rack (Side-by-Side 10 Columns) -->
                                <div class="eq-faders-grid flex-1 items-stretch pb-2" style="display: grid !important; grid-template-columns: repeat(10, minmax(0, 1fr)) !important; gap: 4px !important;">
                                    ${[
                                        { key: 'band_31hz', label: '31Hz', role: 'SUB' },
                                        { key: 'band_62hz', label: '62Hz', role: 'BASS' },
                                        { key: 'band_125hz', label: '125Hz', role: 'PUNCH' },
                                        { key: 'band_250hz', label: '250Hz', role: 'WARM' },
                                        { key: 'band_500hz', label: '500Hz', role: 'MID' },
                                        { key: 'band_1khz', label: '1kHz', role: 'MID-H' },
                                        { key: 'band_2khz', label: '2kHz', role: 'EDGE' },
                                        { key: 'band_4khz', label: '4kHz', role: 'BITE' },
                                        { key: 'band_8khz', label: '8kHz', role: 'AIR' },
                                        { key: 'band_16khz', label: '16kHz', role: 'SHINE' }
                                    ].map((b, idx) => `
                                        <div class="eq-channel-strip" style="height: 195px; padding: 6px 2px;">
                                            <span id="pos-eq-val-${b.key}" class="eq-val-badge eq-val-flat">0.0</span>
                                            <div class="eq-fader-slot" style="height: 115px;">
                                                <div class="eq-slot-groove" style="height: 105px;"></div>
                                                <div class="eq-zero-line"></div>
                                                <input type="range" min="-12" max="12" step="0.5" value="0" id="pos-eq-slider-${b.key}" data-band="${b.key}" oninput="POSJukebox.onEqSliderInput('${b.key}', this.value, ${idx})" class="eq-slider-input" style="width: 105px;" />
                                            </div>
                                            <div class="flex flex-col items-center">
                                                <span class="eq-freq-badge">${b.label}</span>
                                                <span class="eq-band-role">${b.role}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>

                                <!-- Preamp & Apply Button -->
                                <div class="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-[10px] font-bold text-slate-400">Preamp:</span>
                                        <input type="range" min="-6" max="6" step="0.5" value="0" id="pos-eq-preamp-slider" oninput="POSJukebox.onEqPreampInput(this.value)" class="w-16 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-sky-400">
                                        <span id="pos-eq-preamp-val" class="text-[10px] font-mono text-slate-300">0.0 dB</span>
                                    </div>
                                    <button type="button" onclick="POSJukebox.saveEqSettings()" class="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer">
                                        <i class="fas fa-save text-[9px]"></i> Lưu EQ
                                    </button>
                                </div>
                            </div>

                        </div>

                        <!-- RIGHT COLUMN (7 cols): Queue Management & Song Catalog -->
                        <div class="lg:col-span-7 flex flex-col space-y-3 min-w-0">
                            
                            <!-- Segment Tabs Switcher -->
                            <div class="flex items-center justify-between border-b border-white/10 pb-2.5 shrink-0">
                                <div class="flex items-center gap-2 p-1 bg-slate-900/80 rounded-xl border border-white/10">
                                    <button type="button" onclick="POSJukebox.switchTab('queue')" id="pos-juke-tab-queue" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm cursor-pointer">
                                        <i class="fas fa-list-ol"></i>
                                        <span>Hàng Đợi Chờ Phát</span>
                                        <span id="pos-juke-queue-badge" class="px-1.5 py-0.2 rounded-full text-[9px] bg-fuchsia-500/30 text-white font-mono">0</span>
                                    </button>
                                    <button type="button" onclick="POSJukebox.switchTab('catalog')" id="pos-juke-tab-catalog" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-400 hover:text-white cursor-pointer">
                                        <i class="fas fa-compact-disc"></i>
                                        <span>Kho Bài Hát Quán</span>
                                        <span id="pos-juke-catalog-badge" class="px-1.5 py-0.2 rounded-full text-[9px] bg-white/10 text-slate-300 font-mono">0</span>
                                    </button>
                                </div>

                                <!-- Direct Action Buttons on Catalog / Queue -->
                                <div class="flex items-center gap-1.5">
                                    <label class="px-2.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/35 text-teal-300 border border-teal-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-sm" title="Tải file nhạc lên máy chủ">
                                        <i class="fas fa-upload text-[11px]"></i>
                                        <span class="hidden sm:inline">Tải Nhạc</span>
                                        <input type="file" id="pos-juke-upload-input" accept=".mp3,.wav,.flac" class="hidden" onchange="POSJukebox.handleFileUpload(this)">
                                    </label>
                                    <button type="button" onclick="POSJukebox.rescanTracks()" class="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-sm" title="Quét lại thư mục file nhạc">
                                        <i class="fas fa-sync-alt text-[11px]"></i>
                                        <span class="hidden sm:inline">Quét Lại</span>
                                    </button>
                                </div>
                            </div>

                            <!-- TAB 1: Live Queue Panel -->
                            <div id="pos-juke-panel-queue" class="space-y-3 flex-1 flex flex-col min-h-0">
                                <div id="pos-juke-queue-list" class="space-y-2 overflow-y-auto max-h-[380px] pr-1 flex-1">
                                    <div class="p-6 rounded-2xl bg-slate-900/40 border border-white/5 text-center text-xs text-slate-400">
                                        <i class="fas fa-compact-disc text-slate-600 text-2xl mb-1.5 block"></i>
                                        Hàng đợi trống. Chọn bài từ Kho Bài Hát hoặc đợi khách gọi từ bàn.
                                    </div>
                                </div>

                                <!-- Recent History Preview -->
                                <div class="pt-2.5 border-t border-white/10 shrink-0">
                                    <h5 class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                        <i class="fas fa-history text-slate-500 text-[10px]"></i>
                                        <span>Lịch sử 5 bài vừa phát</span>
                                    </h5>
                                    <div id="pos-juke-history-list" class="space-y-1"></div>
                                </div>
                            </div>

                            <!-- TAB 2: Song Catalog Panel -->
                            <div id="pos-juke-panel-catalog" class="space-y-2.5 hidden flex-1 flex flex-col min-h-0">
                                <!-- Search & Genres Filter -->
                                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                                    <div class="relative flex-1">
                                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                        <input type="text" id="pos-juke-search-input" placeholder="Tìm tên bài hát, ca sĩ, thể loại..." oninput="POSJukebox.onSearch(this.value)" class="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50">
                                    </div>
                                    <div id="pos-juke-genres-bar" class="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5"></div>
                                </div>

                                <!-- Catalog Track List (Scrollable) -->
                                <div id="pos-juke-catalog-list" class="space-y-1.5 overflow-y-auto max-h-[420px] pr-1 flex-1 text-xs"></div>
                            </div>

                        </div>

                    </div>

                    <!-- Modal Footer Status -->
                    <div class="px-5 py-2.5 border-t border-white/10 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span class="text-slate-300 font-mono text-[11px]">DSP Studio 24-bit PCM • SQLite Media Queue</span>
                        </div>
                        <button type="button" onclick="POSJukebox.closeModal()" class="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer">
                            Đóng cửa sổ
                        </button>
                    </div>

                </div>
            `;
            document.body.appendChild(div);
        },

        renderModalContent(state) {
            const track = state.currentTrack;
            const titleEl = document.getElementById('pos-modal-track-title');
            const artistEl = document.getElementById('pos-modal-track-artist');
            const sourceEl = document.getElementById('pos-modal-source');
            const curTimeEl = document.getElementById('pos-modal-cur-time');
            const durTimeEl = document.getElementById('pos-modal-dur-time');
            const progressBar = document.getElementById('pos-modal-progress-bar');
            const playBtn = document.getElementById('pos-modal-play-btn');
            const playBtnIcon = document.getElementById('pos-modal-play-btn-icon');
            const playBtnText = document.getElementById('pos-modal-play-btn-text');
            const modalDisc = document.getElementById('pos-modal-disc');
            const modalDiscIcon = document.getElementById('pos-modal-disc-icon');
            const modalDiscDot = document.getElementById('pos-modal-disc-dot');
            const volSlider = document.getElementById('pos-modal-volume-slider');
            const volText = document.getElementById('pos-modal-volume-text');

            if (track && track.track_title) {
                if (titleEl) titleEl.textContent = track.track_title;
                if (artistEl) artistEl.textContent = track.track_artist || 'Nghệ sĩ chưa rõ';
                if (sourceEl) sourceEl.textContent = `${track.table_name || 'Hệ Thống Quán'}`;
            } else {
                if (titleEl) titleEl.textContent = 'Chưa có bài hát nào đang phát';
                if (artistEl) artistEl.textContent = 'Chọn bài từ kho để bắt đầu';
                if (sourceEl) sourceEl.textContent = 'Hệ thống sẵn sàng';
            }

            // Play / Pause Button State Synchronization (Accurate Active Display)
            if (state.isPlaying) {
                if (modalDisc) modalDisc.classList.add('animate-spin');
                if (modalDiscIcon) modalDiscIcon.className = 'fas fa-pause text-[10px] text-white';
                if (modalDiscDot) modalDiscDot.className = 'absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-sm animate-pulse';
                if (playBtnIcon) playBtnIcon.className = 'fas fa-pause text-xs text-amber-200';
                if (playBtnText) playBtnText.textContent = 'Tạm Dừng';
                if (playBtn) {
                    playBtn.className = 'px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/25 cursor-pointer transition active:scale-95';
                }
            } else {
                if (modalDisc) modalDisc.classList.remove('animate-spin');
                if (modalDiscIcon) modalDiscIcon.className = 'fas fa-music text-[10px] text-white';
                if (modalDiscDot) modalDiscDot.className = 'absolute -top-1 -right-1 w-3 h-3 rounded-full bg-slate-500 border-2 border-slate-950 shadow-sm';
                if (playBtnIcon) playBtnIcon.className = 'fas fa-play text-xs text-white';
                if (playBtnText) playBtnText.textContent = 'Phát';
                if (playBtn) {
                    playBtn.className = 'px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-fuchsia-600/30 cursor-pointer transition active:scale-95';
                }
            }

            // Time & Progress
            const cur = state.currentTime || 0;
            const dur = state.duration || (track ? Number(track.track_duration || track.duration_sec || 180) : 180);

            if (curTimeEl) {
                const m = Math.floor(cur / 60);
                const s = Math.floor(cur % 60);
                curTimeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
            if (durTimeEl && dur > 0) {
                const m = Math.floor(dur / 60);
                const s = Math.floor(dur % 60);
                durTimeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
            if (progressBar && dur > 0) {
                const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
                progressBar.style.width = `${pct}%`;
            }

            if (volSlider && state.volume !== undefined) {
                volSlider.value = state.volume;
                if (volText) volText.textContent = `${state.volume}%`;
            }

            // Render Queue & History (only when changed to avoid interrupting clicks)
            const qArr = state.queue || [];
            const qKey = qArr.map(q => `${q.id}_${q.vote_count}_${q.is_priority}`).join('|');
            if (this._lastQueueKey !== qKey) {
                this._lastQueueKey = qKey;
                this.renderQueueList(qArr);
            }
            const hArr = state.history || [];
            const hKey = hArr.slice(0, 5).map(h => `${h.id || h.track_title}`).join('|');
            if (this._lastHistKey !== hKey) {
                this._lastHistKey = hKey;
                this.renderHistoryList(hArr);
            }
        },

        renderQueueList(queue) {
            const listEl = document.getElementById('pos-juke-queue-list');
            const badge = document.getElementById('pos-juke-queue-badge');
            if (badge) badge.textContent = queue ? queue.length : 0;
            if (!listEl) return;

            if (!queue || queue.length === 0) {
                listEl.innerHTML = `
                    <div class="p-6 rounded-2xl bg-slate-900/40 border border-white/5 text-center text-xs text-slate-400">
                        <i class="fas fa-compact-disc text-slate-600 text-2xl mb-1.5 block"></i>
                        Hàng đợi trống. Khách hàng quét mã QR tại bàn để yêu cầu bài hát.
                    </div>
                `;
                return;
            }

            listEl.innerHTML = queue.map((item, idx) => `
                <div class="p-2.5 rounded-xl bg-slate-900/70 border border-white/5 hover:border-fuchsia-500/20 transition flex items-center justify-between gap-2.5">
                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                        <span class="w-6 h-6 rounded-lg bg-slate-800 text-fuchsia-400 border border-white/10 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            #${idx + 1}
                        </span>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                <span class="truncate">${item.track_title}</span>
                                ${item.is_priority ? '<span class="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">VIP</span>' : ''}
                            </div>
                            <div class="text-[10px] text-slate-400 truncate flex items-center gap-2">
                                <span>${item.track_artist}</span>
                                <span>•</span>
                                <span class="text-fuchsia-300 font-semibold">${item.table_name || 'Khách tại bàn'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <!-- Play Now Button (Bump to top & play immediately) -->
                        <button type="button" onclick="POSJukebox.onPlayQueuedItem(${item.id}, ${item.track_id})" class="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 border border-sky-500/40 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer" title="Phát ngay bài này">
                            <i class="fas fa-bolt text-sky-400 text-[9px]"></i>
                            <span>Phát</span>
                        </button>
                        <!-- Vote Up Button -->
                        <button type="button" onclick="POSJukebox.onVote(${item.id})" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-pink-500/20 text-slate-300 hover:text-pink-300 border border-white/5 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer" title="Bầu chọn ưu tiên">
                            <i class="fas fa-heart text-pink-400 text-[9px]"></i>
                            <span>${item.vote_count || 1}</span>
                        </button>
                        <!-- Delete from queue button with liquid glass modal -->
                        <button type="button" onclick="POSJukebox.onRemoveQueue(${item.id}, '${item.track_title.replace(/'/g, "\\'")}')" class="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20 flex items-center justify-center text-xs transition cursor-pointer" title="Xóa bài hát khỏi hàng đợi">
                            <i class="fas fa-trash-alt text-[11px]"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        },

        renderHistoryList(history) {
            const listEl = document.getElementById('pos-juke-history-list');
            if (!listEl) return;
            if (!history || history.length === 0) {
                listEl.innerHTML = '<p class="text-[11px] text-slate-500 italic">Chưa có lịch sử bài phát gần đây.</p>';
                return;
            }

            listEl.innerHTML = history.slice(0, 5).map(item => `
                <div class="p-1.5 px-2.5 rounded-lg bg-slate-900/40 text-[11px] text-slate-400 flex items-center justify-between">
                    <span class="truncate text-slate-300 font-medium">${item.track_title} - <span class="text-slate-500">${item.track_artist}</span></span>
                    <span class="text-[10px] text-slate-500 shrink-0 ml-2">${item.table_name || 'Quán'}</span>
                </div>
            `).join('');
        },

        switchTab(tab) {
            this.activeTab = tab;
            const btnQueue = document.getElementById('pos-juke-tab-queue');
            const btnCatalog = document.getElementById('pos-juke-tab-catalog');
            const panelQueue = document.getElementById('pos-juke-panel-queue');
            const panelCatalog = document.getElementById('pos-juke-panel-catalog');

            if (tab === 'queue') {
                if (btnQueue) {
                    btnQueue.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm cursor-pointer';
                }
                if (btnCatalog) {
                    btnCatalog.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-400 hover:text-white cursor-pointer';
                }
                if (panelQueue) panelQueue.classList.remove('hidden');
                if (panelCatalog) panelCatalog.classList.add('hidden');
            } else {
                if (btnQueue) {
                    btnQueue.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-400 hover:text-white cursor-pointer';
                }
                if (btnCatalog) {
                    btnCatalog.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm cursor-pointer';
                }
                if (panelQueue) panelQueue.classList.add('hidden');
                if (panelCatalog) panelCatalog.classList.remove('hidden');
                this.renderCatalogList();
            }
        },

        async loadCatalog() {
            try {
                const res = await fetch('/api/media/tracks');
                const data = await res.json();
                if (data.success && Array.isArray(data.tracks)) {
                    this.catalog = data.tracks;
                    const badge = document.getElementById('pos-juke-catalog-badge');
                    if (badge) badge.textContent = this.catalog.length;
                    this.renderGenrePills();
                    this.filterCatalog();
                }
            } catch (err) {
                console.error('[POSJukebox] Lỗi tải kho bài hát:', err);
            }
        },

        renderGenrePills() {
            const bar = document.getElementById('pos-juke-genres-bar');
            if (!bar) return;
            const genres = ['ALL', ...new Set(this.catalog.map(t => t.genre || 'Lossless'))];

            bar.innerHTML = genres.map(g => `
                <button type="button" onclick="POSJukebox.onSelectGenre('${g}')" class="px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition cursor-pointer ${this.activeGenre === g ? 'bg-fuchsia-500 text-white shadow-sm' : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'}">
                    ${g === 'ALL' ? 'Tất cả' : g}
                </button>
            `).join('');
        },

        onSelectGenre(genre) {
            this.activeGenre = genre;
            this.renderGenrePills();
            this.filterCatalog();
        },

        onSearch(query) {
            this.searchQuery = (query || '').toLowerCase().trim();
            this.filterCatalog();
        },

        filterCatalog() {
            this.filteredCatalog = this.catalog.filter(t => {
                const matchesGenre = this.activeGenre === 'ALL' || (t.genre || 'Lossless') === this.activeGenre;
                const matchesQuery = !this.searchQuery ||
                    (t.title && t.title.toLowerCase().includes(this.searchQuery)) ||
                    (t.artist && t.artist.toLowerCase().includes(this.searchQuery));
                return matchesGenre && matchesQuery;
            });
            this.renderCatalogList();
        },

        renderCatalogList() {
            const listEl = document.getElementById('pos-juke-catalog-list');
            if (!listEl) return;

            if (this.filteredCatalog.length === 0) {
                listEl.innerHTML = '<div class="p-6 rounded-2xl bg-slate-900/40 text-center text-xs text-slate-500 italic">Không tìm thấy bài hát phù hợp.</div>';
                return;
            }

            listEl.innerHTML = this.filteredCatalog.map(track => {
                const dur = Number(track.duration_sec || track.duration || 180);
                const m = Math.floor(dur / 60);
                const s = Math.floor(dur % 60);
                const durStr = `${m}:${s.toString().padStart(2, '0')}`;

                return `
                    <div class="p-2 rounded-xl bg-slate-900/60 border border-white/5 hover:border-fuchsia-500/30 transition flex items-center justify-between gap-2.5">
                        <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-fuchsia-900 to-indigo-900 flex items-center justify-center text-fuchsia-300 text-xs shrink-0 border border-white/10">
                            <i class="fas fa-music text-[10px]"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-white truncate">${track.title}</div>
                            <div class="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                                <span>${track.artist || 'Nghệ sĩ'}</span>
                                <span>•</span>
                                <span class="font-mono text-slate-500">${durStr}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <!-- Play Now (VIP Priority) -->
                            <button type="button" onclick="POSJukebox.onRequestTrack(${track.id}, 1)" class="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-fuchsia-500/20 hover:from-amber-500/30 hover:to-fuchsia-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer" title="Phát ngay bài này">
                                <i class="fas fa-bolt text-amber-400 text-[9px]"></i>
                                <span>Phát Ngay</span>
                            </button>
                            <!-- Add to Queue -->
                            <button type="button" onclick="POSJukebox.onRequestTrack(${track.id}, 0)" class="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10 flex items-center justify-center text-xs transition cursor-pointer" title="Thêm vào hàng đợi">
                                <i class="fas fa-plus text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        },

        async onRequestTrack(trackId, isPriority = 0) {
            if (!window.JukeboxEngine) return;
            const res = await window.JukeboxEngine.requestTrack(trackId, 'Quầy Thu Ngân (POS)', isPriority);
            if (res.success) {
                this.showToast(`🎵 Đã thêm bài hát vào hàng đợi ${isPriority ? '(Ưu tiên VIP)' : ''}!`, 'success');
                this.switchTab('queue');
            } else {
                this.showToast(res.message || 'Lỗi thêm bài hát', 'error');
            }
        },

        async onPlayQueuedItem(queueId, trackId) {
            if (!window.JukeboxEngine) return;
            // Vote and bump track, then skip to next
            await window.JukeboxEngine.voteTrack(queueId);
            await window.JukeboxEngine.skip();
            this.showToast('🚀 Đang chuyển phát bài hát được chọn ngay lập tức!', 'success');
        },

        async onVote(queueId) {
            if (!window.JukeboxEngine) return;
            const res = await window.JukeboxEngine.voteTrack(queueId);
            if (res.success) {
                this.showToast('❤️ Đã bình chọn ưu tiên cho bài hát!', 'success');
            } else {
                this.showToast(res.message || 'Lỗi bình chọn', 'warning');
            }
        },

        onRemoveQueue(queueId, title) {
            this.showCustomConfirm(
                'Xác nhận xóa bài hát',
                `Bạn có chắc chắn muốn xóa bài hát <b>"${title}"</b> khỏi hàng đợi phát nhạc?`,
                async () => {
                    if (window.JukeboxEngine) {
                        const res = await window.JukeboxEngine.removeQueueItem(queueId);
                        if (res.success) {
                            this.showToast('🗑️ Đã xóa bài hát khỏi hàng đợi!', 'success');
                        } else {
                            this.showToast(res.message || 'Lỗi xóa bài hát', 'error');
                        }
                    }
                }
            );
        },

        showCustomConfirm(title, message, onConfirm) {
            const old = document.getElementById('pos-juke-confirm-dialog');
            if (old) old.remove();

            const dialog = document.createElement('div');
            dialog.id = 'pos-juke-confirm-dialog';
            dialog.style.cssText = 'position: fixed; inset: 0; z-index: 99999; background: rgba(3, 7, 18, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; padding: 16px;';
            dialog.innerHTML = `
                <div class="w-full max-w-sm rounded-2xl bg-slate-900 border border-rose-500/40 p-5 shadow-2xl text-white space-y-4" onclick="event.stopPropagation()">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 text-lg">
                            <i class="fas fa-trash-alt"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-sm text-rose-300">${title}</h4>
                            <p class="text-xs text-slate-400 mt-0.5">Thao tác này sẽ xóa bài khỏi danh sách chờ</p>
                        </div>
                    </div>
                    <div class="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-white/5">
                        ${message}
                    </div>
                    <div class="flex items-center justify-end gap-2 pt-1">
                        <button type="button" id="pos-juke-confirm-cancel" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer">
                            Hủy bỏ
                        </button>
                        <button type="button" id="pos-juke-confirm-ok" class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 cursor-pointer">
                            Xác nhận xóa
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);

            const close = () => dialog.remove();
            dialog.querySelector('#pos-juke-confirm-cancel').onclick = close;
            dialog.querySelector('#pos-juke-confirm-ok').onclick = () => {
                close();
                if (typeof onConfirm === 'function') onConfirm();
            };
            dialog.onclick = close;
        },

        // ==========================================
        // 10-BAND DSP EQUALIZER & LIVE OSCILLOSCOPE
        // ==========================================

        async loadEqPresets() {
            try {
                const res = await fetch('/api/media/eq/presets');
                const data = await res.json();
                if (data.success && Array.isArray(data.presets)) {
                    this.eqPresets = data.presets.map(p => ({
                        ...p,
                        name: p.preset_name || p.name || ('Preset #' + p.id)
                    }));
                    const select = document.getElementById('pos-eq-preset-select');
                    if (select) {
                        select.innerHTML = this.eqPresets.map(p => `<option value="${p.id}" ${p.is_active ? 'selected' : ''}>${p.name}</option>`).join('');
                    }

                    // Khởi tạo các giá trị slider theo preset đang kích hoạt hoặc preset đầu tiên
                    const activePreset = this.eqPresets.find(p => p.is_active) || (data.active ? {
                        ...data.active,
                        name: data.active.preset_name || data.active.name
                    } : null) || this.eqPresets[0];

                    if (activePreset) {
                        this.applyPresetValues(activePreset, false);
                        if (select && activePreset.id) {
                            select.value = activePreset.id;
                        }
                    }
                }
            } catch (err) {
                console.error('[POSJukebox] Lỗi tải preset EQ:', err);
            }
        },

        applyPresetValues(p, notify = true) {
            if (!p) return;
            const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
            bands.forEach((b, idx) => {
                const raw = p[b];
                const val = (typeof raw === 'number') ? raw : (parseFloat(raw) || 0.0);
                this.eqBands[b] = val;
                const slider = document.getElementById(`pos-eq-slider-${b}`);
                const valEl = document.getElementById(`pos-eq-val-${b}`);
                if (slider) slider.value = val;
                this.updateEqValBadge(valEl, val);
                if (window.JukeboxEngine && window.JukeboxEngine.eqFilters && window.JukeboxEngine.eqFilters[idx]) {
                    window.JukeboxEngine.eqFilters[idx].gain.value = val;
                }
            });

            // Đồng bộ Preamp Gain nếu có
            if (p.preamp_gain !== undefined) {
                const rawPre = p.preamp_gain;
                const preamp = (typeof rawPre === 'number') ? rawPre : (parseFloat(rawPre) || 0.0);
                this.eqPreamp = preamp;
                const preampSlider = document.getElementById('pos-eq-preamp-slider');
                const preampValEl = document.getElementById('pos-eq-preamp-val');
                if (preampSlider) preampSlider.value = preamp;
                if (preampValEl) preampValEl.textContent = `${preamp > 0 ? '+' : ''}${preamp.toFixed(1)} dB`;
                if (window.JukeboxEngine && window.JukeboxEngine.preampNode) {
                    window.JukeboxEngine.preampNode.gain.value = Math.pow(10, preamp / 20);
                }
            }

            if (notify) {
                const displayName = p.name || p.preset_name || ('Preset #' + p.id);
                this.showToast(`🎚️ Đã chọn Preset: <b>${displayName}</b>`, 'info');
            }
        },

        updateEqValBadge(el, num) {
            if (!el) return;
            const n = parseFloat(num);
            if (n > 0.05) {
                el.className = 'eq-val-badge eq-val-boost';
                el.textContent = '+' + n.toFixed(1);
            } else if (n < -0.05) {
                el.className = 'eq-val-badge eq-val-cut';
                el.textContent = n.toFixed(1);
            } else {
                el.className = 'eq-val-badge eq-val-flat';
                el.textContent = '0.0';
            }
        },

        onSelectPreset(presetId) {
            if (!presetId) return;
            const p = this.eqPresets.find(x => String(x.id) === String(presetId));
            if (!p) return;
            this.applyPresetValues(p, true);
        },

        onEqSliderInput(bandKey, val, idx) {
            const num = parseFloat(val);
            this.eqBands[bandKey] = num;
            const valEl = document.getElementById(`pos-eq-val-${bandKey}`);
            this.updateEqValBadge(valEl, num);

            if (window.JukeboxEngine && window.JukeboxEngine.eqFilters && window.JukeboxEngine.eqFilters[idx]) {
                window.JukeboxEngine.eqFilters[idx].gain.value = num;
            }

            const select = document.getElementById('pos-eq-preset-select');
            if (select) {
                const customOpt = Array.from(select.options).find(o => o.text.includes('Tùy Chỉnh') || o.text.includes('Custom'));
                if (customOpt) select.value = customOpt.value;
            }
        },

        onEqPreampInput(val) {
            const num = parseFloat(val);
            this.eqPreamp = num;
            const valEl = document.getElementById('pos-eq-preamp-val');
            if (valEl) valEl.textContent = `${num > 0 ? '+' : ''}${num.toFixed(1)}dB`;

            if (window.JukeboxEngine && window.JukeboxEngine.preampNode) {
                window.JukeboxEngine.preampNode.gain.value = Math.pow(10, num / 20);
            }

            const select = document.getElementById('pos-eq-preset-select');
            if (select) {
                const customOpt = Array.from(select.options).find(o => o.text.includes('Tùy Chỉnh') || o.text.includes('Custom'));
                if (customOpt) select.value = customOpt.value;
            }
        },

        applyFlatEq() {
            const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
            bands.forEach((b, idx) => {
                this.eqBands[b] = 0.0;
                const slider = document.getElementById(`pos-eq-slider-${b}`);
                const valEl = document.getElementById(`pos-eq-val-${b}`);
                if (slider) slider.value = 0;
                this.updateEqValBadge(valEl, 0);
                if (window.JukeboxEngine && window.JukeboxEngine.eqFilters && window.JukeboxEngine.eqFilters[idx]) {
                    window.JukeboxEngine.eqFilters[idx].gain.value = 0.0;
                }
            });
            this.eqPreamp = 0.0;
            const preampSlider = document.getElementById('pos-eq-preamp-slider');
            const preampValEl = document.getElementById('pos-eq-preamp-val');
            if (preampSlider) preampSlider.value = 0;
            if (preampValEl) preampValEl.textContent = '0.0 dB';
            if (window.JukeboxEngine && window.JukeboxEngine.preampNode) {
                window.JukeboxEngine.preampNode.gain.value = 1.0;
            }
            const select = document.getElementById('pos-eq-preset-select');
            if (select) {
                const flatPreset = this.eqPresets.find(p => (p.preset_name || p.name || '').toLowerCase().includes('flat'));
                if (flatPreset) {
                    select.value = flatPreset.id;
                } else {
                    select.value = '';
                }
            }
            this.showToast('🎛️ Đã đặt cấu hình EQ về Flat 0dB', 'info');
        },

        saveEqSettings() { return this.saveAndApplyEq(); },

        async saveAndApplyEq() {
            try {
                const body = {
                    preamp: this.eqPreamp,
                    ...this.eqBands
                };
                const res = await fetch('/api/media/eq/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.success) {
                    this.showToast('✅ Đã lưu cấu hình EQ thành công!', 'success');
                } else {
                    this.showToast(data.message || 'Lỗi lưu cấu hình EQ', 'error');
                }
            } catch (err) {
                this.showToast('Lỗi kết nối máy chủ Media', 'error');
            }
        },

        startWaveLoop() {
            if (this.waveAnimFrameId) return;
            const loop = (timestamp) => {
                const modal = document.getElementById('pos-jukebox-modal');
                if (modal && !modal.classList.contains('hidden') && modal.style.display !== 'none') {
                    this.renderDynamicWave(timestamp);
                    this.waveAnimFrameId = requestAnimationFrame(loop);
                } else {
                    this.waveAnimFrameId = null;
                }
            };
            this.waveAnimFrameId = requestAnimationFrame(loop);
        },

        stopWaveLoop() {
            if (this.waveAnimFrameId) {
                cancelAnimationFrame(this.waveAnimFrameId);
                this.waveAnimFrameId = null;
            }
        },

        renderDynamicWave(timestamp) {
            const strokeEl = document.getElementById('pos-eq-curve-stroke');
            const waveEl = document.getElementById('pos-eq-curve-wave');
            const fillEl = document.getElementById('pos-eq-curve-fill');
            const nodesGroup = document.getElementById('pos-eq-curve-nodes');
            if (!strokeEl && !waveEl && !fillEl) return;

            const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
            const numPoints = bands.length;
            const startX = 30;
            const endX = 570;
            const stepX = (endX - startX) / (numPoints - 1);

            let freqData = null;
            if (window.JukeboxEngine && window.JukeboxEngine.isPlaying && window.JukeboxEngine.analyser) {
                if (!window.JukeboxEngine.freqData) {
                    window.JukeboxEngine.freqData = new Uint8Array(window.JukeboxEngine.analyser.frequencyBinCount);
                }
                window.JukeboxEngine.analyser.getByteFrequencyData(window.JukeboxEngine.freqData);
                freqData = window.JukeboxEngine.freqData;
            }

            const t = (timestamp || performance.now()) * 0.003;
            const binMap = [1, 2, 3, 5, 8, 12, 17, 22, 26, 30];
            const points = [];
            const wavePoints = [];

            for (let idx = 0; idx < numPoints; idx++) {
                const b = bands[idx];
                const x = startX + idx * stepX;
                const eqVal = this.eqBands[b] || 0.0;
                const baseY = 60 - (eqVal / 12.0) * 45;

                let targetEnergy = 0;
                if (freqData && binMap[idx] < freqData.length) {
                    targetEnergy = (freqData[binMap[idx]] / 255.0);
                }
                const prevEnv = this.eqBandsEnvelopes[idx] || 0;
                const currentEnv = targetEnergy > prevEnv ? (prevEnv * 0.35 + targetEnergy * 0.65) : (prevEnv * 0.88 + targetEnergy * 0.12);
                this.eqBandsEnvelopes[idx] = currentEnv;

                const waveOffset = Math.sin(t + idx * 0.8) * currentEnv * 20;
                const activeY = Math.max(10, Math.min(110, baseY - waveOffset));

                points.push({ x, y: baseY });
                wavePoints.push({ x, y: activeY });
            }

            // Generate Smooth Spline Path
            const buildPath = (pts) => {
                if (pts.length < 2) return '';
                let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
                for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = (i > 0) ? pts[i - 1] : pts[i];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = (i < pts.length - 2) ? pts[i + 2] : p2;
                    const cp1x = p1.x + (p2.x - p0.x) / 6;
                    const cp1y = p1.y + (p2.y - p0.y) / 6;
                    const cp2x = p2.x - (p3.x - p1.x) / 6;
                    const cp2y = p2.y - (p3.y - p1.y) / 6;
                    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
                }
                return d;
            };

            const waveD = buildPath(wavePoints);
            const baseD = buildPath(points);

            if (strokeEl) strokeEl.setAttribute('d', waveD);
            if (waveEl) waveEl.setAttribute('d', baseD);
            if (fillEl) fillEl.setAttribute('d', `${waveD} L ${endX} 120 L ${startX} 120 Z`);

            if (nodesGroup) {
                nodesGroup.innerHTML = wavePoints.map(p => `
                    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#f472b6" stroke="#ffffff" stroke-width="1" opacity="0.9" />
                `).join('');
            }
        },

        // ==========================================
        // FILE UPLOAD & DIRECT RESCAN
        // ==========================================

        async handleFileUpload(input) {
            if (!input.files || !input.files[0]) return;
            const file = input.files[0];
            const formData = new FormData();
            formData.append('media_file', file);
            formData.append('title', file.name.replace(/\\.[^/.]+$/, ''));
            formData.append('artist', 'Quán');
            formData.append('genre', 'Lossless');

            this.showToast(`📤 Đang tải lên bài hát: "${file.name}"...`, 'info');

            try {
                const res = await fetch('/api/media/tracks/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    this.showToast('✅ Tải bài hát lên thành công!', 'success');
                    input.value = '';
                    await this.loadCatalog();
                    if (window.JukeboxEngine) await window.JukeboxEngine.refreshStatus(true);
                } else {
                    this.showToast(data.message || 'Lỗi tải bài hát', 'error');
                }
            } catch (err) {
                this.showToast('Lỗi kết nối khi tải file', 'error');
            }
        },

        async rescanTracks() {
            this.showToast('🔄 Đang quét thư mục âm nhạc máy chủ...', 'info');
            try {
                const res = await fetch('/api/media/tracks/rescan', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    this.showToast(`✅ Đã quét xong! Tìm thấy ${data.scanned || data.total || 0} bài hát.`, 'success');
                    await this.loadCatalog();
                    if (window.JukeboxEngine) await window.JukeboxEngine.refreshStatus(true);
                } else {
                    this.showToast(data.message || 'Lỗi quét thư mục', 'error');
                }
            } catch (err) {
                this.showToast('Lỗi kết nối máy chủ', 'error');
            }
        },

        // ==========================================
        // ENGINE CONTROLS PROXY
        // ==========================================

        togglePlay() {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.togglePlay();
            }
        },

        skipTrack() {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.skip();
            }
        },

        setVolume(val) {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.setVolume(val);
            }
        },

        onSeek(e) {
            const bar = e.currentTarget;
            const rect = bar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            if (window.JukeboxEngine) {
                window.JukeboxEngine.seek(ratio);
            }
        },

        showToast(message, type = 'info') {
            const container = document.getElementById('toast-container') || document.body;
            const toast = document.createElement('div');
            const bgClass = type === 'success' ? 'bg-emerald-600/90 border-emerald-400' :
                           type === 'error' ? 'bg-rose-600/90 border-rose-400' :
                           type === 'warning' ? 'bg-amber-600/90 border-amber-400' :
                           'bg-fuchsia-600/90 border-fuchsia-400';

            toast.className = `fixed bottom-5 right-5 z-[99999] px-4 py-2.5 rounded-2xl text-white text-xs font-bold shadow-2xl border ${bgClass} backdrop-blur-md transition-all duration-300 flex items-center gap-2 max-w-sm pointer-events-auto`;
            toast.innerHTML = `<span>${message}</span>`;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        }
    };

    window.POSJukebox = POSJukebox;
    document.addEventListener('DOMContentLoaded', () => POSJukebox.init());

})(window);
