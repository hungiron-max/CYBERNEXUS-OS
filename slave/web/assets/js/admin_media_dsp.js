/**
 * Admin Module: Media Server, 10-Band DSP Equalizer & Audio Player
 * Extracted from admin.js for modular maintainability
 */
Object.assign(Admin, {
    // ==========================================
    // 9. MEDIA SERVER & 10-BAND DSP EQUALIZER STUDIO
    // ==========================================
    eqBands: {
        band_31hz: 0.0,
        band_62hz: 0.0,
        band_125hz: 0.0,
        band_250hz: 0.0,
        band_500hz: 0.0,
        band_1khz: 0.0,
        band_2khz: 0.0,
        band_4khz: 0.0,
        band_8khz: 0.0,
        band_16khz: 0.0
    },
    eqPreamp: 0.0,
    eqPresets: [],
    mediaCatalog: [],
    mediaPollingTimer: null,
    eqAnimFrameId: null,
    eqBandsEnvelopes: new Float32Array(10),

    async loadMediaTab() {
        this._lastRenderedTrackKey = null;
        this._lastRenderedQueueKey = null;
        this.mediaPlayer.init();
        this.startEqWaveAnimation();
        await Promise.all([
            this.loadMediaEqPresets(),
            this.loadMediaJukeboxStatus(),
            this.loadMediaTracksCatalog(),
            this.loadMediaSchedules()
        ]);

        if (this.mediaPollingTimer) clearInterval(this.mediaPollingTimer);
        this._mediaPollInFlight = false;
        this.mediaPollingTimer = setInterval(async () => {
            if (document.hidden || this._mediaPollInFlight) return;
            this._mediaPollInFlight = true;
            try { await this.loadMediaJukeboxStatus(); } finally { this._mediaPollInFlight = false; }
        }, 8000);
    },

    async loadMediaSchedules() {
        try {
            const res = await fetch('/api/media/schedules');
            const data = await res.json();
            if (!data.success) return;
            const masterOn = (data.master_enabled !== false);
            this._mediaScheduleMasterEnabled = masterOn;
            this._activeScheduleGenre = (masterOn && data.active_schedule && data.active_schedule.genre) ? String(data.active_schedule.genre) : '';
            if (Array.isArray(this.mediaCatalog) && this.mediaCatalog.length > 0) {
                this.filterMediaCatalog();
            }
            const masterBtn = document.getElementById('media-schedule-master-btn');
            if (masterBtn) {
                masterBtn.className = masterOn
                    ? 'btn-glass text-[11px] py-1 px-2.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border-emerald-500/40 font-bold flex items-center gap-1'
                    : 'btn-glass text-[11px] py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 border-white/15 font-bold flex items-center gap-1';
                masterBtn.innerHTML = masterOn
                    ? '<i class="fas fa-toggle-on text-emerald-400"></i> Khung giờ: BẬT'
                    : '<i class="fas fa-toggle-off text-slate-400"></i> Khung giờ: TẮT (Tự do)';
            }
            const badge = document.getElementById('media-active-schedule-badge');
            if (badge) {
                const act = data.active_schedule;
                badge.innerHTML = !masterOn
                    ? `<i class="fas fa-unlock text-amber-300 mr-1"></i> Chế độ tự do (đã tắt khóa khung giờ)`
                    : (act
                        ? `<i class="fas fa-music mr-1"></i> ${window.cnxT?window.cnxT('js.s_med.2629bcd7','Đang áp dụng:'):'Đang áp dụng:'} <b>${escapeHtml(act.name)}</b> (${escapeHtml(act.start_time)}-${escapeHtml(act.end_time)}) · <b>${escapeHtml(act.genre)}</b>`
                        : `${window.cnxT?window.cnxT('js.s_med.18d5663d','Mặc định:'):'Mặc định:'} ${escapeHtml(data.active_genre || 'Pop')}`);
            }
            const listEl = document.getElementById('media-schedules-list');
            if (listEl) {
                const slots = data.schedules || [];
                listEl.innerHTML = slots.map(sl => `
                    <div class="px-2.5 py-1.5 rounded-xl bg-slate-900/75 border ${sl.is_active && masterOn ? 'border-fuchsia-500/35' : 'border-white/5 opacity-55'} flex items-center justify-between gap-2 text-[11px]">
                        <div class="min-w-0">
                            <div class="font-bold text-white truncate">${escapeHtml(sl.name)}</div>
                            <div class="text-[10px] font-mono text-amber-300 truncate">${escapeHtml(sl.start_time)}-${escapeHtml(sl.end_time)} · <span class="text-sky-300 font-sans font-semibold">${escapeHtml(sl.genre)}</span></div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" onclick="Admin.toggleMediaSchedule(${sl.id}, '${escapeJsAttr(sl.name)}', '${escapeJsAttr(sl.start_time)}', '${escapeJsAttr(sl.end_time)}', '${escapeJsAttr(sl.genre)}', ${sl.is_active ? 0 : 1})" class="px-1.5 py-0.5 rounded text-[10px] font-bold ${sl.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}">${sl.is_active ? 'Bật' : 'Tắt'}</button>
                            <button type="button" onclick="Admin.deleteMediaSchedule(${sl.id})" class="text-rose-400 hover:text-rose-300 px-0.5" title="Xóa"><i class="fas fa-trash text-[10px]"></i></button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_media_dsp.js', e) : console.debug('admin_media_dsp.js', e)); }
    },

    async toggleMasterMediaSchedule() {
        const nextVal = this._mediaScheduleMasterEnabled === false ? 1 : 0;
        try {
            const res = await fetch('/api/media/schedules/toggle_master', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: nextVal })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Lỗi đổi trạng thái lịch khung giờ');
            this.showToast(data.message, 'success');
            this.loadMediaSchedules();
        } catch (e) {
            this.showToast(e.message || 'Lỗi kết nối', 'error');
        }
    },

    async autoClassifyMediaTracks() {
        try {
            const res = await fetch('/api/media/tracks/auto_classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ overwrite: 1 })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_med.23ca929b','Lỗi phân loại'):'Lỗi phân loại'));
            this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.6b40ba51','Đã phân loại kho nhạc!'):'Đã phân loại kho nhạc!'), 'success');
            this.loadMediaTracksCatalog();
        } catch (e) {
            alert(e.message || (window.cnxT?window.cnxT('js.s_med.75af1893','Lỗi tự phân loại nhạc'):'Lỗi tự phân loại nhạc'));
        }
    },

    async addMediaSchedule() {
        const name = (document.getElementById('ms-name')?.value || '').trim();
        const start_time = document.getElementById('ms-start')?.value || '';
        const end_time = document.getElementById('ms-end')?.value || '';
        const genre = document.getElementById('ms-genre')?.value || 'Pop';
        if (!name || !start_time || !end_time) {
            alert((window.cnxT?window.cnxT('js.s_med.0547272f','Vui lòng nhập Tên khung giờ và Giờ bắt đầu/kết thúc!'):'Vui lòng nhập Tên khung giờ và Giờ bắt đầu/kết thúc!'));
            return;
        }
        try {
            const res = await fetch('/api/media/schedules/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, start_time, end_time, genre, is_active: 1 })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || (window.cnxT?window.cnxT('js.s_med.fed2ee33','Lỗi lưu'):'Lỗi lưu'));
            document.getElementById('ms-name').value = '';
            this.showToast((window.cnxT?window.cnxT('js.s_med.1cede520','Đã thêm khung giờ phát nhạc!'):'Đã thêm khung giờ phát nhạc!'), 'success');
            this.loadMediaSchedules();
        } catch (e) {
            alert(e.message || (window.cnxT?window.cnxT('js.s_med.a16a00d6','Lỗi lưu khung giờ'):'Lỗi lưu khung giờ'));
        }
    },

    async toggleMediaSchedule(id, name, start_time, end_time, genre, is_active) {
        try {
            const res = await fetch('/api/media/schedules/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, start_time, end_time, genre, is_active })
            });
            const data = await res.json();
            if (data.success) this.loadMediaSchedules();
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_media_dsp.js', e) : console.debug('admin_media_dsp.js', e)); }
    },

    async deleteMediaSchedule(id) {
        if (!(await window.cnxConfirm((window.cnxT?window.cnxT('js.s_med.2d622ac1','Xóa khung giờ phát nhạc này?'):'Xóa khung giờ phát nhạc này?')))) return;
        try {
            const res = await fetch('/api/media/schedules/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) this.loadMediaSchedules();
        } catch (e) { (window.CyberSecurity ? CyberSecurity.logSilentError('admin_media_dsp.js', e) : console.debug('admin_media_dsp.js', e)); }
    },

    async loadMediaEqPresets() {
        try {
            const res = await fetch('/api/media/eq/presets');
            const data = await res.json();
            if (data.success && Array.isArray(data.presets)) {
                this.eqPresets = data.presets;
                const select = document.getElementById('eq-preset-select');
                if (select) {
                    select.innerHTML = data.presets.map(p => 
                        `<option value="${p.id}" ${p.is_active ? 'selected' : ''}>${p.preset_name}</option>`
                    ).join('');
                }

                const active = data.active || data.presets[0];
                if (active) {
                    this.setEqFromPreset(active);
                }
            }
        } catch (err) {
            console.error('loadMediaEqPresets error:', err);
        }
    },

    setEqFromPreset(preset) {
        if (!preset) return;
        const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
        bands.forEach((b, idx) => {
            const raw = preset[b];
            const val = (typeof raw === 'number') ? raw : (parseFloat(raw) || 0.0);
            this.eqBands[b] = val;
            const slider = document.getElementById(`eq-slider-${b}`);
            const label = document.getElementById(`eq-val-${b}`);
            if (slider) slider.value = val;
            if (label) {
                label.textContent = (val > 0 ? '+' : '') + val.toFixed(1);
                label.className = 'eq-val-badge ' + (val > 0 ? 'eq-val-boost' : (val < 0 ? 'eq-val-cut' : 'eq-val-flat'));
            }
            const filters = (window.JukeboxEngine && window.JukeboxEngine.eqFilters && window.JukeboxEngine.eqFilters.length) ? window.JukeboxEngine.eqFilters : this.mediaPlayer.eqFilters;
            if (filters && filters[idx]) {
                filters[idx].gain.value = val;
            }
        });

        const rawPreamp = preset.preamp_gain;
        const preamp = (typeof rawPreamp === 'number') ? rawPreamp : (parseFloat(rawPreamp) || 0.0);
        this.eqPreamp = preamp;
        const preampSlider = document.getElementById('eq-slider-preamp');
        const preampLabel = document.getElementById('eq-val-preamp');
        if (preampSlider) preampSlider.value = preamp;
        if (preampLabel) preampLabel.textContent = (preamp > 0 ? '+' : '') + preamp.toFixed(1) + ' dB';
        if (this.mediaPlayer.preampNode) {
            this.mediaPlayer.preampNode.gain.value = Math.pow(10, preamp / 20);
        }

        this.renderEqCurve();
    },

    onEqSliderInput(bandName, val) {
        const num = parseFloat(val);
        this.eqBands[bandName] = num;
        const label = document.getElementById(`eq-val-${bandName}`);
        if (label) {
            label.textContent = (num > 0 ? '+' : '') + num.toFixed(1);
            label.className = 'eq-val-badge ' + (num > 0 ? 'eq-val-boost' : (num < 0 ? 'eq-val-cut' : 'eq-val-flat'));
        }
        const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
        const idx = bands.indexOf(bandName);
        const filters = (window.JukeboxEngine && window.JukeboxEngine.eqFilters && window.JukeboxEngine.eqFilters.length) ? window.JukeboxEngine.eqFilters : this.mediaPlayer.eqFilters;
        if (idx >= 0 && filters && filters[idx]) {
            filters[idx].gain.value = num;
        }
        const select = document.getElementById('eq-preset-select');
        if (select) {
            const customOpt = Array.from(select.options).find(o => o.text.includes('Tùy Chỉnh') || o.text.includes('Custom'));
            if (customOpt) select.value = customOpt.value;
        }
        this.renderEqCurve();
    },

    onEqPreampInput(val) {
        const num = parseFloat(val);
        this.eqPreamp = num;
        const label = document.getElementById('eq-val-preamp');
        if (label) label.textContent = (num > 0 ? '+' : '') + num.toFixed(1) + ' dB';
        if (this.mediaPlayer.preampNode) {
            this.mediaPlayer.preampNode.gain.value = Math.pow(10, num / 20);
        }
        const select = document.getElementById('eq-preset-select');
        if (select) {
            const customOpt = Array.from(select.options).find(o => o.text.includes('Tùy Chỉnh') || o.text.includes('Custom'));
            if (customOpt) select.value = customOpt.value;
        }
    },

    async onEqPresetSelect(presetId) {
        const found = this.eqPresets.find(p => p.id == presetId);
        if (found) {
            this.setEqFromPreset(found);
            // Apply preset and notify
            try {
                await fetch('/api/media/eq/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        preset_id: Number(presetId),
                        preset_name: found.preset_name
                    })
                });
                this.showToast((window.cnxT?window.cnxT('js.s_med.e5f7db24','🎛️ Đã áp dụng preset '):'🎛️ Đã áp dụng preset ') + found.preset_name, 'info');
            } catch (err) {
                console.error('onEqPresetSelect save error:', err);
            }
        }
    },

    resetEqFlat() {
        const flatPreset = {
            preset_name: (window.cnxT?window.cnxT('ui.admin_html.option_e0e6fd17','🎵 Flat (Gốc)'):'🎵 Flat (Gốc)'),
            preamp_gain: 0.0,
            band_31hz: 0.0,
            band_62hz: 0.0,
            band_125hz: 0.0,
            band_250hz: 0.0,
            band_500hz: 0.0,
            band_1khz: 0.0,
            band_2khz: 0.0,
            band_4khz: 0.0,
            band_8khz: 0.0,
            band_16khz: 0.0
        };
        this.setEqFromPreset(flatPreset);
        const select = document.getElementById('eq-preset-select');
        if (select) {
            const flatOpt = Array.from(select.options).find(o => o.text.includes('Flat'));
            if (flatOpt) {
                select.value = flatOpt.value;
                this.onEqPresetSelect(flatOpt.value);
            }
        }
    },

    startEqWaveAnimation() {
        if (this.eqAnimFrameId) return;
        const loop = (timestamp) => {
            const mediaTab = document.getElementById('tab-media');
            if (mediaTab && !mediaTab.classList.contains('hidden')) {
                this.renderDynamicEqWave(timestamp);
                this.eqAnimFrameId = requestAnimationFrame(loop);
            } else {
                this.eqAnimFrameId = null;
            }
        };
        this.eqAnimFrameId = requestAnimationFrame(loop);
    },

    stopEqWaveAnimation() {
        if (this.eqAnimFrameId) {
            cancelAnimationFrame(this.eqAnimFrameId);
            this.eqAnimFrameId = null;
        }
    },

    renderDynamicEqWave(timestamp) {
        const strokeEl = document.getElementById('eq-curve-stroke');
        const waveEl = document.getElementById('eq-curve-wave');
        const fillEl = document.getElementById('eq-curve-fill');
        const nodesGroup = document.getElementById('eq-curve-nodes');
        if (!strokeEl && !waveEl && !fillEl) return;

        const bands = ['band_31hz', 'band_62hz', 'band_125hz', 'band_250hz', 'band_500hz', 'band_1khz', 'band_2khz', 'band_4khz', 'band_8khz', 'band_16khz'];
        const numPoints = bands.length;
        const startX = 30;
        const endX = 570;
        const stepX = (endX - startX) / (numPoints - 1);

        // Check if audio is actively playing and Web Audio analyser is available
        const activeAnalyser = (window.JukeboxEngine && window.JukeboxEngine.analyser) || (this.mediaPlayer && this.mediaPlayer.analyser);
        const activeAudio = (window.JukeboxEngine && window.JukeboxEngine.audio) || (this.mediaPlayer && this.mediaPlayer.audio);
        const isAudioPlaying = activeAudio && !activeAudio.paused && activeAnalyser;
        let freqData = null;
        if (isAudioPlaying) {
            if (!this._waveFreqData || this._waveFreqData.length !== activeAnalyser.frequencyBinCount) {
                this._waveFreqData = new Uint8Array(activeAnalyser.frequencyBinCount);
            }
            activeAnalyser.getByteFrequencyData(this._waveFreqData);
            freqData = this._waveFreqData;
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

            // Audio reaction envelope
            let targetEnergy = 0;
            if (freqData && binMap[idx] < freqData.length) {
                targetEnergy = (freqData[binMap[idx]] / 255.0);
            }
            const prevEnv = this.eqBandsEnvelopes[idx] || 0;
            const currentEnv = targetEnergy > prevEnv ? (prevEnv * 0.35 + targetEnergy * 0.65) : (prevEnv * 0.88 + targetEnergy * 0.12);
            this.eqBandsEnvelopes[idx] = currentEnv;

            // Audio bounce + organic harmonic ripple
            const musicBounce = currentEnv * 18.0;
            const ripple = Math.sin(t * 1.5 + idx * 0.75) * (1.2 + currentEnv * 4.0);
            const microPulse = Math.cos(t * 2.8 + idx * 1.2) * (0.8 + currentEnv * 2.5);

            // Primary curve Y
            const y1 = Math.max(12, Math.min(108, baseY - musicBounce + ripple));
            points.push({ x, y: y1, energy: currentEnv });

            // Secondary ghost harmonic wave Y
            const waveRipple = Math.sin(t * 1.8 + idx * 0.8 + 1.2) * (1.6 + currentEnv * 6.0);
            const y2 = Math.max(12, Math.min(108, baseY - musicBounce * 0.65 + waveRipple + microPulse));
            wavePoints.push({ x, y: y2 });
        }

        const buildPath = (pts) => {
            let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
            for (let i = 0; i < pts.length - 1; i++) {
                const p0 = (i > 0) ? pts[i - 1] : pts[0];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = (i !== pts.length - 2) ? pts[i + 2] : p2;

                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;

                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;

                d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
            }
            return d;
        };

        const mainD = buildPath(points);
        const waveD = buildPath(wavePoints);

        if (strokeEl) strokeEl.setAttribute('d', mainD);
        if (waveEl) waveEl.setAttribute('d', waveD);
        if (fillEl) fillEl.setAttribute('d', `${mainD} L ${endX} 120 L ${startX} 120 Z`);

        // Render glowing LED node dots at the 10 frequency positions
        if (nodesGroup) {
            let dotsSvg = '';
            points.forEach((p) => {
                const r = 2.0 + p.energy * 2.0;
                const glowOpacity = (0.35 + p.energy * 0.65).toFixed(2);
                dotsSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#38bdf8" />`;
                if (p.energy > 0.25) {
                    dotsSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(r + 3).toFixed(1)}" fill="none" stroke="#a855f7" stroke-width="0.8" opacity="${glowOpacity}" />`;
                }
            });
            nodesGroup.innerHTML = dotsSvg;
        }
    },

    renderEqCurve() {
        this.renderDynamicEqWave();
        this.startEqWaveAnimation();
    },

    async applyEqChanges() {
        const select = document.getElementById('eq-preset-select');
        const presetName = select ? select.options[select.selectedIndex]?.text : 'Custom Live EQ';

        const payload = {
            preset_name: presetName,
            preamp_gain: this.eqPreamp,
            ...this.eqBands
        };

        try {
            const res = await fetch('/api/media/eq/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                if (window.JukeboxEngine && typeof window.JukeboxEngine.broadcastEq === 'function') {
                    window.JukeboxEngine.broadcastEq(payload);
                }
                alert((window.cnxT?window.cnxT('js.s_med.1f340962','Đã áp dụng cấu hình 10-Band DSP Equalizer vào hệ thống âm thanh!'):'Đã áp dụng cấu hình 10-Band DSP Equalizer vào hệ thống âm thanh!'));
            } else {
                alert(data.message || (window.cnxT?window.cnxT('js.s_med.195ce86d','Lỗi khi áp dụng Equalizer'):'Lỗi khi áp dụng Equalizer'));
            }
        } catch (err) {
            console.error('applyEqChanges error:', err);
            alert((window.cnxT?window.cnxT('js.s_med.bc3a2780','Lỗi kết nối máy chủ Media'):'Lỗi kết nối máy chủ Media'));
        }
    },

    async loadMediaJukeboxStatus() {
        try {
            const res = await fetch('/api/media/jukebox/status');
            const data = await res.json();
            if (data.success) {
                this.renderNowPlaying(data.now_playing);
                this.renderMediaQueue(data.queue || []);
            }
        } catch (err) {
            console.error('loadMediaJukeboxStatus error:', err);
        }
    },

    renderNowPlaying(track) {
        const titleEl = document.getElementById('now-playing-title');
        const artistEl = document.getElementById('now-playing-artist');
        const genreEl = document.getElementById('now-playing-genre');
        const tableEl = document.getElementById('now-playing-table');
        const votesEl = document.getElementById('now-playing-votes');
        const durationEl = document.getElementById('now-playing-duration');

        if (!track || !track.track_title) {
            if (titleEl) titleEl.textContent = (window.cnxT?window.cnxT('js.s_med.d35f84ce','Chưa có bài hát nào đang phát'):'Chưa có bài hát nào đang phát');
            if (artistEl) artistEl.textContent = (window.cnxT?window.cnxT('ui.adm_html.div_5db208a0','Hệ thống sẵn sàng'):'Hệ thống sẵn sàng');
            return;
        }

        if (titleEl) titleEl.textContent = track.track_title;
        if (artistEl) artistEl.textContent = track.track_artist || (window.cnxT?window.cnxT('js.s_med.6ba23392','Nghệ sĩ chưa rõ'):'Nghệ sĩ chưa rõ');
        if (genreEl) genreEl.textContent = track.genre || 'Lossless';
        if (tableEl) tableEl.textContent = track.table_name || (window.cnxT?window.cnxT('js.s_med.7862df57','Hệ Thống Quán'):'Hệ Thống Quán');
        if (votesEl) votesEl.innerHTML = `<i class="fas fa-thumbs-up text-sky-400 mr-0.5"></i> ${track.vote_count || 1} votes`;
        const durSeconds = Number(track.track_duration || track.duration_sec || track.duration || 198);
        if (durationEl && !isNaN(durSeconds)) {
            const m = Math.floor(durSeconds / 60);
            const s = Math.floor(durSeconds % 60);
            durationEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        // Real Audio Playback via HTML5 Audio + Web Audio DSP (only if standalone without JukeboxEngine)
        if (!window.JukeboxEngine) {
            this.mediaPlayer.playTrack(track);
        }
    },

    renderMediaQueue(queue) {
        const countEl = document.getElementById('media-queue-count');
        const listEl = document.getElementById('media-queue-list');
        if (!listEl) return;

        if (countEl) countEl.textContent = `${queue.length} ${window.cnxT?window.cnxT('js.s_med.43dfd4b8','bài trong hàng đợi'):'bài trong hàng đợi'}`;

        if (queue.length === 0) {
            listEl.innerHTML = `
                <div class="p-4 rounded-xl bg-slate-900/40 border border-white/5 text-center text-xs text-slate-400">
                    <i class="fas fa-compact-disc text-slate-600 text-2xl mb-1 block"></i>
                    ${window.cnxT?window.cnxT('js.s_med.39f8978b','Hàng đợi trống. Khách hàng quét mã QR tại bàn để yêu cầu bài hát.'):'Hàng đợi trống. Khách hàng quét mã QR tại bàn để yêu cầu bài hát.'}
                </div>
            `;
            return;
        }

        listEl.innerHTML = queue.map((item, idx) => `
            <div class="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-6 h-6 rounded-lg bg-slate-800 text-sky-400 border border-white/10 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        #${idx + 1}
                    </span>
                    <div class="min-w-0">
                        <div class="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <span class="truncate">${escapeHtml(item.track_title)}</span>
                            ${item.is_priority ? '<span class="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-semibold">VIP</span>' : ''}
                        </div>
                        <div class="text-[10px] text-slate-400 truncate flex items-center gap-2">
                            <span>${escapeHtml(item.track_artist)}</span>
                            <span>•</span>
                            <span class="text-amber-300 font-semibold">${escapeHtml(item.table_name || (window.cnxT?window.cnxT('js.s_cust.3bfc4cc6','Khách tại bàn'):'Khách tại bàn'))}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" onclick="Admin.voteMediaItem(${item.id})" class="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1 transition" title="Bình chọn bài hát">
                        <i class="fas fa-thumbs-up text-[10px]"></i>
                        <span>${item.vote_count}</span>
                    </button>
                    <button type="button" onclick="Admin.removeMediaQueueItem(${item.id}, '${escapeJsAttr(item.track_title || '')}')" class="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 flex items-center justify-center text-xs transition active:scale-95" title="Xóa bài hát khỏi hàng đợi">
                        <i class="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    async loadMediaTracksCatalog() {
        try {
            const res = await fetch('/api/media/tracks');
            const data = await res.json();
            if (data.success && Array.isArray(data.tracks)) {
                this.mediaCatalog = data.tracks;
                this.renderMediaCatalog(data.tracks);
            }
        } catch (err) {
            console.error('loadMediaTracksCatalog error:', err);
        }
    },

    renderMediaCatalog(tracks) {
        const listEl = document.getElementById('media-catalog-list');
        if (!listEl) return;

        if (tracks.length === 0) {
            listEl.innerHTML = (window.cnxT?window.cnxT('js.s_med.bdec6bb8','<div class="text-center text-slate-500 py-3 text-xs">Không tìm thấy bài hát</div>'):'<div class="text-center text-slate-500 py-3 text-xs">Không tìm thấy bài hát</div>');
            return;
        }

        listEl.innerHTML = tracks.map(t => {
            const durSeconds = Number(t.duration_sec || t.duration || 180);
            const m = Math.floor(durSeconds / 60);
            const s = Math.floor(durSeconds % 60);
            const dur = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            const isYtStream = t.source_type === 'youtube';
            const isYtOffline = !isYtStream && Boolean(t.yt_video_id);
            const fileMissing = !isYtStream && (t.file_exists === false);
            const badgeHtml = fileMissing
                ? `<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold shrink-0">Thiếu file</span>`
                : (isYtStream
                    ? `<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-bold shrink-0">YT Stream</span>`
                    : (isYtOffline
                        ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold shrink-0">YT Offline</span>`
                        : `<span class="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25 text-[9px] font-bold shrink-0">Offline</span>`));
            const offlineBtnHtml = isYtStream
                ? `<button type="button" onclick="Admin.upgradeYoutubeTrackOffline(${t.id}, this)" class="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 shrink-0 transition" title="Tải về MP3 để phát Offline khi mất mạng"><i class="fas fa-download"></i> ${window.cnxT?window.cnxT('js.s_med.8b03be0c','Lưu Offline'):'Lưu Offline'}</button>`
                : '';
            const playBtnHtml = fileMissing
                ? `<button type="button" disabled class="px-2 py-1 rounded-lg bg-slate-800/80 text-slate-500 border border-white/5 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-not-allowed" title="File không tồn tại trên đĩa"><i class="fas fa-ban"></i> Lỗi file</button>`
                : `<button type="button" onclick="Admin.requestMediaTrack(${t.id})" class="px-2 py-1 rounded-lg bg-fuchsia-600/20 hover:bg-fuchsia-600/40 text-fuchsia-300 border border-fuchsia-500/30 text-[10px] font-bold flex items-center gap-1 shrink-0 transition" title="Đưa vào hàng đợi Jukebox với quyền Quản lý"><i class="fas fa-plus"></i> ${window.cnxT?window.cnxT('ui.adm_html.span_5f57eb43','Phát'):'Phát'}</button>`;

            const genreText = String(t.genre || 'Pop').trim() || 'Pop';
            const gLower = genreText.toLowerCase();
            const genreClass = gLower.includes('edm') || gLower.includes('sôi')
                ? 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
                : (gLower.includes('acoustic') || gLower.includes('êm') || gLower.includes('lofi')
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : (gLower.includes('ballad')
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'));
            const activeSlotG = (this._mediaScheduleMasterEnabled !== false && this._activeScheduleGenre) ? this._activeScheduleGenre : '';
            const slotMatched = !activeSlotG || gLower === activeSlotG.toLowerCase();
            const genreBadgeHtml = `<span class="px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0 ${genreClass}">${escapeHtml(genreText)}</span>`;
            const slotBadgeHtml = activeSlotG
                ? (slotMatched
                    ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold shrink-0" title="Phù hợp khung giờ hiện tại">✓ Hợp giờ</span>`
                    : `<span class="px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-white/10 text-[9px] font-semibold shrink-0" title="Khác thể loại khung giờ (${escapeHtml(activeSlotG)}) — Admin vẫn có thể chèn phát">Ngoài giờ</span>`)
                : '';

            return `
                <div class="p-2 rounded-xl bg-slate-900/50 border ${activeSlotG && !slotMatched ? 'border-white/5 opacity-80' : 'border-white/10'} hover:border-sky-500/30 transition flex items-center justify-between gap-2">
                    <div class="min-w-0 flex-1 flex items-center gap-2">
                        <i class="${isYtStream ? 'fab fa-youtube text-rose-400' : 'fas fa-music text-sky-400'} text-xs shrink-0"></i>
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-white truncate text-xs leading-snug">${escapeHtml(t.title)}</div>
                            <div class="flex items-center gap-1.5 mt-0.5 flex-nowrap overflow-hidden">
                                <span class="text-[10px] text-slate-400 truncate">${escapeHtml(t.artist)} • <span class="text-slate-500 font-mono">${dur}</span></span>
                                ${genreBadgeHtml}
                                ${badgeHtml}
                                ${slotBadgeHtml}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${offlineBtnHtml}
                        <button type="button" onclick="Admin.editYoutubeTrack(${t.id})" class="px-2 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 shrink-0 transition" title="Sửa thông tin bài hát"><i class="fas fa-edit"></i> ${window.cnxT?window.cnxT('js.s_inv.3d5c572b','Sửa'):'Sửa'}</button>
                        ${playBtnHtml}
                    </div>
                </div>
            `;
        }).join('');
    },

    filterMediaCatalog(keyword) {
        const searchEl = document.getElementById('media-catalog-search');
        const genreEl = document.getElementById('media-catalog-genre-filter');
        const rawKw = (typeof keyword === 'string') ? keyword : (searchEl ? searchEl.value : '');
        const kw = (rawKw || '').toLowerCase().trim();
        const selGenre = genreEl ? genreEl.value : 'ALL';
        const activeSlotG = (this._mediaScheduleMasterEnabled !== false && this._activeScheduleGenre) ? this._activeScheduleGenre.toLowerCase() : '';

        const filtered = (this.mediaCatalog || []).filter(t => {
            const trkG = String(t.genre || 'Pop').trim();
            if (selGenre === '__MATCH_SLOT__') {
                if (activeSlotG && trkG.toLowerCase() !== activeSlotG) return false;
            } else if (selGenre && selGenre !== 'ALL') {
                if (trkG.toLowerCase() !== selGenre.toLowerCase()) return false;
            }
            if (!kw) return true;
            return (t.title && t.title.toLowerCase().includes(kw)) ||
                   (t.artist && t.artist.toLowerCase().includes(kw)) ||
                   trkG.toLowerCase().includes(kw);
        });
        this.renderMediaCatalog(filtered);
    },

    // ==========================================
    // CYBERTOAST NOTIFICATION ENGINE (NON-BLOCKING)
    // ==========================================
    showToast(message, type = 'info', duration = 3000) {
        let container = document.getElementById('cyber-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'cyber-toast-container';
            container.className = 'fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 pointer-events-none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const colorMap = {
            success: 'border-emerald-500/40 bg-slate-900/95 text-emerald-300 shadow-emerald-500/10',
            error: 'border-rose-500/40 bg-slate-900/95 text-rose-300 shadow-rose-500/10',
            warning: 'border-amber-500/40 bg-slate-900/95 text-amber-300 shadow-amber-500/10',
            info: 'border-sky-500/40 bg-slate-900/95 text-sky-300 shadow-sky-500/10'
        };
        const iconMap = {
            success: 'fa-check-circle text-emerald-400',
            error: 'fa-times-circle text-rose-400',
            warning: 'fa-triangle-exclamation text-amber-400',
            info: 'fa-info-circle text-sky-400'
        };

        const borderClass = colorMap[type] || colorMap.info;
        const iconClass = iconMap[type] || iconMap.info;

        toast.className = `pointer-events-auto px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0 text-xs font-semibold ${borderClass}`;
        toast.innerHTML = `
            <i class="fas ${iconClass} text-sm shrink-0"></i>
            <span class="text-white">${message}</span>
            <button type="button" class="ml-2 text-slate-400 hover:text-white text-xs">&times;</button>
        `;

        toast.querySelector('button').onclick = () => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 250);
        };

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        });

        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 250);
            }
        }, duration);
    },

    // ==========================================
    // NATIVE HTML5 & WEB AUDIO API PLAYER ENGINE
    // ==========================================
    mediaPlayer: {
        audio: null,
        audioCtx: null,
        sourceNode: null,
        preampNode: null,
        eqFilters: [],
        isPlaying: false,
        currentTrack: null,
        init() {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.init();
                this.audio = window.JukeboxEngine.audio;
                this.audioCtx = window.JukeboxEngine.audioCtx;
                this.analyser = window.JukeboxEngine.analyser;
                this.eqFilters = window.JukeboxEngine.eqFilters;
                this.preampNode = window.JukeboxEngine.preampNode;
                this.freqData = window.JukeboxEngine.freqData;
                this.isPlaying = window.JukeboxEngine.isPlaying;
                this.currentTrack = window.JukeboxEngine.currentTrack;
                return;
            }
            if (this.audio) return;
            this.audio = new Audio();
            this.audio.preload = 'auto';

            this.audio.addEventListener('play', () => {
                this.isPlaying = true;
                const icon = document.getElementById('now-playing-play-icon');
                if (icon) icon.className = 'fas fa-pause text-[9px] text-white';
                const ctrlIcon = document.getElementById('jukebox-ctrl-play-icon');
                if (ctrlIcon) ctrlIcon.className = 'fas fa-pause text-xs';
                const ctrlText = document.getElementById('jukebox-ctrl-play-text');
                if (ctrlText) ctrlText.textContent = (window.cnxT?window.cnxT('js.s_adm.32be569f','Tạm Dừng'):'Tạm Dừng');
            });

            this.audio.addEventListener('pause', () => {
                this.isPlaying = false;
                const icon = document.getElementById('now-playing-play-icon');
                if (icon) icon.className = 'fas fa-play text-[9px] text-white';
                const ctrlIcon = document.getElementById('jukebox-ctrl-play-icon');
                if (ctrlIcon) ctrlIcon.className = 'fas fa-play text-xs';
                const ctrlText = document.getElementById('jukebox-ctrl-play-text');
                if (ctrlText) ctrlText.textContent = (window.cnxT?window.cnxT('ui.adm_html.span_5f57eb43','Phát'):'Phát');
            });

            this.audio.addEventListener('timeupdate', () => {
                if (!this.audio.duration || isNaN(this.audio.duration)) return;
                const cur = this.audio.currentTime;
                const dur = this.audio.duration;
                const bar = document.getElementById('now-playing-progress');
                if (bar) bar.style.width = `${(cur / dur) * 100}%`;
                const curTimeEl = document.getElementById('now-playing-current-time');
                if (curTimeEl) {
                    const m = Math.floor(cur / 60);
                    const s = Math.floor(cur % 60);
                    curTimeEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                }
            });

            this.audio.addEventListener('ended', () => {
                Admin.skipMediaTrack(); // Automatically advance to next queued song!
            });
        },

        setupWebAudio() {
            if (window.JukeboxEngine) {
                window.JukeboxEngine._setupWebAudio();
                this.audioCtx = window.JukeboxEngine.audioCtx;
                this.analyser = window.JukeboxEngine.analyser;
                this.eqFilters = window.JukeboxEngine.eqFilters;
                this.preampNode = window.JukeboxEngine.preampNode;
                this.freqData = window.JukeboxEngine.freqData;
                return;
            }
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

                // Web Audio Analyser for Real-Time Oscilloscope Wave Visualization
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 64; // 32 frequency bins
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
            } catch (err) {
                console.warn('Web Audio DSP not supported:', err);
            }
        },

        playTrack(track) {
            if (window.JukeboxEngine) {
                if (track && track.file_path) {
                    window.JukeboxEngine.playTrack(track);
                }
                return;
            }
            this.init();
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            } else if (!this.audioCtx) {
                this.setupWebAudio();
            }
            if (!track || !track.file_path) return;
            this.currentTrack = track;
            let fullSrc = track.file_path.startsWith('/') ? track.file_path : ('/' + track.file_path);
            
            if (this.audio.getAttribute('data-current-src') !== fullSrc) {
                this.audio.setAttribute('data-current-src', fullSrc);
                this.audio.src = fullSrc;
                this.audio.load();
                this.audio.play().catch(e => {
                    console.log('Autoplay policy caught, click Play to listen:', e);
                });
            }
        },

        togglePlay() {
            if (window.JukeboxEngine) {
                window.JukeboxEngine.togglePlay();
                return;
            }
            this.init();
            if (!this.audioCtx) {
                this.setupWebAudio();
            } else if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            if (this.audio.paused) {
                this.audio.play().catch(e => console.log('Play error:', e));
            } else {
                this.audio.pause();
            }
        },

        seek(e) {
            const bar = e.currentTarget;
            const rect = bar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            if (window.JukeboxEngine) {
                window.JukeboxEngine.seek(ratio);
                return;
            }
            if (!this.audio || !this.audio.duration) return;
            this.audio.currentTime = ratio * this.audio.duration;
        },

        setVolume(val) {
            const pct = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
            if (pct > 0) this._lastVolume = pct;
            const slider = document.getElementById('admin-media-volume-slider');
            if (slider && Number(slider.value) !== pct) slider.value = pct;
            const txt = document.getElementById('admin-media-volume-text');
            if (txt) txt.textContent = `${pct}%`;
            const icon = document.getElementById('admin-media-volume-icon');
            if (icon) {
                icon.className = pct === 0 ? 'fas fa-volume-mute text-rose-400 text-xs' : 'fas fa-volume-up text-xs';
            }
            if (window.JukeboxEngine) {
                window.JukeboxEngine.setVolume(pct);
                return;
            }
            if (!this.audio) this.init();
            this.audio.volume = pct / 100;
        },

        toggleMute() {
            const slider = document.getElementById('admin-media-volume-slider');
            const cur = slider ? Number(slider.value) : (window.JukeboxEngine ? Math.round((window.JukeboxEngine.volume || 0) * 100) : 100);
            if (cur > 0) {
                this._lastVolume = cur;
                this.setVolume(0);
            } else {
                this.setVolume(this._lastVolume || 80);
            }
        },

        setDucking(enable) {
            if (!this.audio) this.init();
            this.audio.volume = enable ? 0.3 : 1.0;
        }
    },

    async requestMediaTrack(trackId) {
        try {
            const res = await fetch('/api/media/jukebox/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track_id: trackId,
                    table_id: 0,
                    table_name: (window.cnxT?window.cnxT('js.s_med.011ca68f','Quầy Quản Trị (Admin)'):'Quầy Quản Trị (Admin)'),
                    customer_phone: '',
                    is_priority: 1
                })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast((window.cnxT?window.cnxT('js.s_med.adffb63c','🎵 Đã thêm bài hát vào hàng đợi Jukebox!'):'🎵 Đã thêm bài hát vào hàng đợi Jukebox!'), 'success');
                this.loadMediaJukeboxStatus();
            } else {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.34e81558','Lỗi khi yêu cầu bài hát'):'Lỗi khi yêu cầu bài hát'), 'error');
            }
        } catch (err) {
            console.error('requestMediaTrack error:', err);
            this.showToast((window.cnxT?window.cnxT('js.s_med.bc3a2780','Lỗi kết nối máy chủ Media'):'Lỗi kết nối máy chủ Media'), 'error');
        }
    },

    async voteMediaItem(queueId) {
        try {
            const res = await fetch('/api/media/jukebox/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queue_id: queueId })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast((window.cnxT?window.cnxT('js.s_med.8e9590c6','👍 Đã bình chọn bài hát!'):'👍 Đã bình chọn bài hát!'), 'success');
                this.loadMediaJukeboxStatus();
            } else {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.3f8a253a','Lỗi bình chọn'):'Lỗi bình chọn'), 'warning');
            }
        } catch (err) {
            console.error('voteMediaItem error:', err);
        }
    },

    showConfirmDialog({ title, message, subtext, icon, confirmText, confirmClass, onConfirm }) {
        let modal = document.getElementById('admin-glass-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'admin-glass-confirm-modal';
            modal.style.cssText = 'position: fixed; inset: 0; z-index: 99999; display: none; align-items: center; justify-content: center; padding: 1rem; background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);';
            modal.innerHTML = `
                <div style="width: 440px; max-width: 100%; border-radius: 1.25rem; padding: 1.5rem; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); color: #fff; transform: scale(0.95); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);" id="admin-glass-confirm-content">
                    <div style="display: flex; align-items: flex-start; gap: 1rem;">
                        <div style="width: 3rem; height: 3rem; border-radius: 1rem; background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                            <i id="admin-confirm-icon" class="fas fa-trash-alt" style="color: #fb7185;"></i>
                        </div>
                        <div style="min-width: 0; flex: 1;">
                            <h3 id="admin-confirm-title" style="font-weight: 700; font-size: 1rem; color: #fff; margin: 0;">${window.cnxT?window.cnxT('js.s_med.49dec27d','Xác nhận xóa bài'):'Xác nhận xóa bài'}</h3>
                            <p id="admin-confirm-msg" style="font-size: 0.8125rem; color: #cbd5e1; margin: 0.375rem 0 0 0; line-height: 1.5;"></p>
                            <p id="admin-confirm-sub" style="font-size: 0.6875rem; color: #64748b; margin: 0.25rem 0 0 0;"></p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.625rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.08);">
                        <button type="button" id="admin-confirm-cancel-btn" style="padding: 0.5rem 1rem; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 600; color: #94a3b8; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); cursor: pointer; transition: all 0.15s;">
                            ${window.cnxT?window.cnxT('ui.admin_html.button_c2e25395','Hủy Bỏ'):'Hủy Bỏ'}
                        </button>
                        <button type="button" id="admin-confirm-ok-btn" style="padding: 0.5rem 1.125rem; border-radius: 0.75rem; font-size: 0.75rem; font-weight: 700; color: #fff; background: linear-gradient(135deg, #e11d48, #be123c); border: 1px solid rgba(244, 63, 94, 0.4); box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35); cursor: pointer; transition: all 0.15s;">
                            ${window.cnxT?window.cnxT('js.s_med.0dddda41','Xác Nhận Xóa'):'Xác Nhận Xóa'}
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeConfirmDialog();
            });
        }

        const titleEl = document.getElementById('admin-confirm-title');
        const msgEl = document.getElementById('admin-confirm-msg');
        const subEl = document.getElementById('admin-confirm-sub');
        const iconEl = document.getElementById('admin-confirm-icon');
        const okBtn = document.getElementById('admin-confirm-ok-btn');
        const cancelBtn = document.getElementById('admin-confirm-cancel-btn');
        const content = document.getElementById('admin-glass-confirm-content');

        if (titleEl) titleEl.textContent = title || (window.cnxT?window.cnxT('ui.kitchen_html.h3_7b9f3a63','Xác nhận'):'Xác nhận');
        if (msgEl) msgEl.textContent = message || '';
        if (subEl) subEl.textContent = subtext || '';
        if (iconEl && icon) iconEl.className = 'fas ' + icon;

        if (okBtn) {
            okBtn.textContent = confirmText || (window.cnxT?window.cnxT('js.s_med.ec19364d','Đồng Ý'):'Đồng Ý');
            okBtn.onclick = async () => {
                this.closeConfirmDialog();
                if (typeof onConfirm === 'function') await onConfirm();
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => this.closeConfirmDialog();
        }

        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            if (content) content.style.transform = 'scale(1)';
        });
    },

    closeConfirmDialog() {
        const modal = document.getElementById('admin-glass-confirm-modal');
        const content = document.getElementById('admin-glass-confirm-content');
        if (content) content.style.transform = 'scale(0.95)';
        if (modal) {
            setTimeout(() => { modal.style.display = 'none'; }, 100);
        }
    },

    removeMediaQueueItem(queueId, trackTitle = '') {
        const songName = trackTitle ? `"${trackTitle}"` : (window.cnxT?window.cnxT('js.s_med.0ac90e6c','bài hát này'):'bài hát này');
        this.showConfirmDialog({
            title: (window.cnxT?window.cnxT('js.s_med.c4f89459','Xóa Bài Hát Khỏi Hàng Đợi'):'Xóa Bài Hát Khỏi Hàng Đợi'),
            message: `${window.cnxT?window.cnxT('js.s_med.3b592502','Bạn có chắc muốn xóa bài hát'):'Bạn có chắc muốn xóa bài hát'} ${songName} ${window.cnxT?window.cnxT('js.s_med.5ab2dfcf','khỏi danh sách phát?'):'khỏi danh sách phát?'}`,
            subtext: (window.cnxT?window.cnxT('js.s_med.a4c706cc','Bài hát sẽ được dọn ngay và nhường quyền phát cho bài tiếp theo.'):'Bài hát sẽ được dọn ngay và nhường quyền phát cho bài tiếp theo.'),
            icon: 'fa-trash-alt text-rose-400',
            confirmText: (window.cnxT?window.cnxT('js.s_med.0dddda41','Xác Nhận Xóa'):'Xác Nhận Xóa'),
            confirmClass: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 active:scale-95',
            onConfirm: async () => {
                try {
                    const res = await fetch('/api/media/jukebox/remove', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ queue_id: queueId })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this.showToast((window.cnxT?window.cnxT('js.s_med.af0bd8e1','🗑️ Đã xóa bài hát khỏi hàng đợi!'):'🗑️ Đã xóa bài hát khỏi hàng đợi!'), 'success');
                        this.loadMediaJukeboxStatus();
                    } else {
                        this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.a3ae28d1','Lỗi khi xóa bài hát'):'Lỗi khi xóa bài hát'), 'error');
                    }
                } catch (err) {
                    console.error('removeMediaQueueItem error:', err);
                    this.showToast((window.cnxT?window.cnxT('js.s_med.94acdc61','Lỗi kết nối khi xóa bài hát'):'Lỗi kết nối khi xóa bài hát'), 'error');
                }
            }
        });
    },

    async skipMediaTrack() {
        if (window.JukeboxEngine) {
            await window.JukeboxEngine.skip();
            this.showToast((window.cnxT?window.cnxT('js.s_med.18588f91','⏭️ Đã chuyển sang bài hát kế tiếp!'):'⏭️ Đã chuyển sang bài hát kế tiếp!'), 'info');
            return;
        }
        // Instant non-blocking skip without freezing prompt!
        try {
            const res = await fetch('/api/media/jukebox/skip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_admin: true })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast((window.cnxT?window.cnxT('js.s_med.1b62dbea','⏭️ Đã chuyển sang bài hát tiếp theo!'):'⏭️ Đã chuyển sang bài hát tiếp theo!'), 'success');
                await this.loadMediaJukeboxStatus();
            } else {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.386005b7','Lỗi khi chuyển bài'):'Lỗi khi chuyển bài'), 'error');
            }
        } catch (err) {
            console.error('skipMediaTrack error:', err);
            this.showToast((window.cnxT?window.cnxT('js.s_med.bc3a2780','Lỗi kết nối máy chủ Media'):'Lỗi kết nối máy chủ Media'), 'error');
        }
    },

    toggleAudioDucking(enabled) {
        this.mediaPlayer.setDucking(enabled);
        const msg = enabled ? 
            'Đã BẬT Auto-Ducking: Âm lượng nhạc tự động hạ -10dB khi POS gọi món.' : 
            (window.cnxT?window.cnxT('js.s_med.cdb30509','Đã TẮT Auto-Ducking: Giữ nguyên mức âm lượng khi gọi món.'):'Đã TẮT Auto-Ducking: Giữ nguyên mức âm lượng khi gọi món.');
        this.showToast(msg, 'info');
    },

    // ==========================================
    // OFFLINE MEDIA LIBRARY MANAGER METHODS
    // ==========================================
    openMediaManagerModal() {
        const modal = document.getElementById('admin-media-manager-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        this.renderMediaManagerTable();
    },

    renderMediaManagerTable() {
        const tbody = document.getElementById('modal-media-table-body');
        const countEl = document.getElementById('modal-media-total-count');
        if (!tbody) return;

        const tracks = this.mediaCatalog || [];
        if (countEl) countEl.textContent = tracks.length;

        const kw = (document.getElementById('modal-media-search')?.value || '').toLowerCase().trim();
        const filtered = kw ? tracks.filter(t => 
            t.title.toLowerCase().includes(kw) || 
            t.artist.toLowerCase().includes(kw) || 
            (t.genre && t.genre.toLowerCase().includes(kw))
        ) : tracks;

        if (filtered.length === 0) {
            tbody.innerHTML = (window.cnxT?window.cnxT('js.s_med.b0b9a3b4','<tr><td colspan="6" class="p-6 text-center text-slate-500">Không tìm thấy bài hát nào</td></tr>'):'<tr><td colspan="6" class="p-6 text-center text-slate-500">Không tìm thấy bài hát nào</td></tr>');
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const durSeconds = Number(t.duration_sec || t.duration || 180);
            const m = Math.floor(durSeconds / 60);
            const s = Math.floor(durSeconds % 60);
            const dur = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

            return `
                <tr class="hover:bg-slate-800/40 transition">
                    <td class="p-2.5 font-mono text-slate-500">#${t.id}</td>
                    <td class="p-2.5 font-bold text-white flex items-center gap-2">
                        <i class="fas fa-music text-teal-400 text-xs"></i>
                        <span class="truncate max-w-[200px]">${escapeHtml(t.title)}</span>
                    </td>
                    <td class="p-2.5 text-slate-300 truncate max-w-[150px]">${escapeHtml(t.artist || (window.cnxT?window.cnxT('js.s_med.bad7dfd4','Chưa rõ'):'Chưa rõ'))}</td>
                    <td class="p-2.5">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            ${escapeHtml(t.genre || 'Lossless')}
                        </span>
                    </td>
                    <td class="p-2.5 text-center font-mono text-slate-400">${dur}</td>
                    <td class="p-2.5 text-right space-x-1 whitespace-nowrap">
                        <button type="button" onclick="Admin.requestMediaTrack(${t.id})" class="btn-glass text-[10px] py-1 px-2 text-sky-300 hover:text-white" title="Phát bài này">
                            <i class="fas fa-play text-[9px]"></i> ${window.cnxT?window.cnxT('ui.adm_html.span_5f57eb43','Phát'):'Phát'}
                        </button>
                        <button type="button" onclick="Admin.deleteMediaTrack(${t.id})" class="btn-glass text-[10px] py-1 px-2 text-rose-400 hover:text-rose-300 border-rose-500/20" title="Xóa bài hát">
                            <i class="fas fa-trash-alt text-[9px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterMediaManagerTable(kw) {
        this.renderMediaManagerTable();
    },

    ytPreviewMeta: null,

    editYoutubeTrack(trackId) {
        const track = (this.mediaCatalog || []).find(t => Number(t.id) === Number(trackId));
        if (!track) return;

        let modal = document.getElementById('edit-track-info-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'edit-track-info-modal';
            modal.className = 'fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md';
            modal.innerHTML = `
                <div class="liquid-glass w-full max-w-md rounded-2xl border border-amber-500/30 p-5 shadow-2xl space-y-3">
                    <div class="flex items-center justify-between pb-2 border-b border-white/10">
                        <h3 class="font-black text-sm text-white flex items-center gap-2">
                            <i class="fas fa-edit text-amber-400"></i> ${window.cnxT?window.cnxT('js.s_med.4f903957','Sửa Tên Bài Hát &amp; Tên File MP3'):'Sửa Tên Bài Hát &amp; Tên File MP3'}
                        </h3>
                        <button type="button" onclick="document.getElementById('edit-track-info-modal').classList.add('hidden');document.getElementById('edit-track-info-modal').classList.remove('flex');" class="text-slate-400 hover:text-white text-lg">&times;</button>
                    </div>
                    <div class="space-y-2.5 text-xs">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-300 mb-1">${window.cnxT?window.cnxT('js.s_med.10ae7d11','Tên bài hát (sẽ dùng để đặt tên file .mp3)'):'Tên bài hát (sẽ dùng để đặt tên file .mp3)'}</label>
                            <input type="text" id="edit-track-title-input" class="liquid-input w-full py-2 px-3 rounded-xl bg-slate-900 border border-white/15 text-xs text-white" />
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-300 mb-1">${window.cnxT?window.cnxT('js.s_med.a849f7b7','Nghệ sĩ / Ca sĩ'):'Nghệ sĩ / Ca sĩ'}</label>
                            <input type="text" id="edit-track-artist-input" class="liquid-input w-full py-2 px-3 rounded-xl bg-slate-900 border border-white/15 text-xs text-white" />
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-300 mb-1">Thể loại nhạc (khớp Khung Giờ)</label>
                            <select id="edit-track-genre-select" class="liquid-input w-full py-2 px-3 rounded-xl bg-slate-900 border border-white/15 text-xs text-white">
                                <option value="Sôi động / EDM">Sôi động / EDM</option>
                                <option value="Êm dịu / Acoustic">Êm dịu / Acoustic</option>
                                <option value="Ballad">Ballad</option>
                                <option value="Pop">Pop</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
                        <button type="button" onclick="document.getElementById('edit-track-info-modal').classList.add('hidden');document.getElementById('edit-track-info-modal').classList.remove('flex');" class="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">${window.cnxT?window.cnxT('ui.admin_html.button_d7d5c86c','Hủy'):'Hủy'}</button>
                        <button type="button" id="edit-track-save-btn" class="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black">${window.cnxT?window.cnxT('js.s_med.a465e4f1','Lưu Thay Đổi'):'Lưu Thay Đổi'}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const titleInput = document.getElementById('edit-track-title-input');
        const artistInput = document.getElementById('edit-track-artist-input');
        const genreSelect = document.getElementById('edit-track-genre-select');
        const saveBtn = document.getElementById('edit-track-save-btn');
        titleInput.value = track.title || '';
        artistInput.value = track.artist || '';
        if (genreSelect) {
            const curG = track.genre || 'Pop';
            if (!Array.from(genreSelect.options).some(o => o.value === curG)) {
                const opt = document.createElement('option');
                opt.value = curG;
                opt.textContent = curG;
                genreSelect.appendChild(opt);
            }
            genreSelect.value = curG;
        }

        saveBtn.onclick = async () => {
            const newTitle = titleInput.value.trim();
            const newArtist = artistInput.value.trim();
            const newGenre = genreSelect ? genreSelect.value : (track.genre || 'Pop');
            if (!newTitle) {
                this.showToast((window.cnxT?window.cnxT('js.s_med.9cdbf697','Tên bài hát không được để trống!'):'Tên bài hát không được để trống!'), 'warning');
                return;
            }
            saveBtn.disabled = true;
            saveBtn.textContent = (window.cnxT?window.cnxT('js.s_med.03028846','Đang lưu...'):'Đang lưu...');
            try {
                const res = await fetch('/api/media/youtube/edit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ track_id: trackId, title: newTitle, artist: newArtist, genre: newGenre })
                });
                const data = await res.json();
                if (!data.success) {
                    this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.463a821f','Không thể cập nhật bài hát'):'Không thể cập nhật bài hát'), 'error');
                    return;
                }
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.d9083936','Đã cập nhật tên bài hát!'):'Đã cập nhật tên bài hát!'), 'success');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                await this.loadMediaTracksCatalog();
            } catch (_) {
                this.showToast((window.cnxT?window.cnxT('js.s_med.b7911e30','Lỗi kết nối khi cập nhật bài hát'):'Lỗi kết nối khi cập nhật bài hát'), 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = (window.cnxT?window.cnxT('js.s_med.a465e4f1','Lưu Thay Đổi'):'Lưu Thay Đổi');
            }
        };

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        titleInput.focus();
    },

    openYoutubeImportModal() {
        const modal = document.getElementById('youtube-import-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        this.ytPreviewMeta = null;
        const urlEl = document.getElementById('yt-import-url');
        if (urlEl) urlEl.value = '';
        document.getElementById('yt-preview-box')?.classList.add('hidden');
        document.getElementById('yt-job-status-box')?.classList.add('hidden');
    },

    closeYoutubeImportModal() {
        const modal = document.getElementById('youtube-import-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    },

    async previewYoutubeAudio() {
        const url = (document.getElementById('yt-import-url')?.value || '').trim();
        const errBox = document.getElementById('yt-preview-error');
        if (errBox) { errBox.classList.add('hidden'); errBox.textContent = ''; }
        if (!url) {
            if (errBox) { errBox.textContent = (window.cnxT?window.cnxT('js.s_med.f4c4fb88','Vui lòng dán link YouTube!'):'Vui lòng dán link YouTube!'); errBox.classList.remove('hidden'); }
            this.showToast((window.cnxT?window.cnxT('js.s_med.f4c4fb88','Vui lòng dán link YouTube!'):'Vui lòng dán link YouTube!'), 'warning');
            return;
        }
        const btn = document.getElementById('yt-preview-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = (window.cnxT?window.cnxT('js.s_med.bb4caee3','<i class="fas fa-spinner fa-spin"></i> Đang lấy...'):'<i class="fas fa-spinner fa-spin"></i> Đang lấy...');
        }
        try {
            const res = await fetch('/api/media/youtube/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (!data.success) {
                const msg = data.message || (window.cnxT?window.cnxT('js.s_med.26255c83','Không lấy được thông tin YouTube'):'Không lấy được thông tin YouTube');
                if (errBox) { errBox.textContent = msg; errBox.classList.remove('hidden'); }
                this.showToast(msg, 'error');
                return;
            }
            this.ytPreviewMeta = data;
            const dur = Number(data.duration_sec || 180);
            const durStr = `${Math.floor(dur / 60).toString().padStart(2, '0')}:${Math.floor(dur % 60).toString().padStart(2, '0')}`;
            document.getElementById('yt-preview-thumb').src = data.thumbnail || '';
            document.getElementById('yt-preview-duration').textContent = `AUDIO • ${durStr}`;
            document.getElementById('yt-preview-title-display').textContent = data.title || '';
            document.getElementById('yt-preview-artist-display').textContent = data.artist || '';
            document.getElementById('yt-import-title').value = data.title || '';
            document.getElementById('yt-import-artist').value = data.artist || '';
            document.getElementById('yt-preview-box')?.classList.remove('hidden');
            this.showToast((window.cnxT?window.cnxT('js.s_med.ec0ba4e9','Đã nhận diện thông tin audio từ YouTube!'):'Đã nhận diện thông tin audio từ YouTube!'), 'success');
        } catch (err) {
            if (errBox) { errBox.textContent = (window.cnxT?window.cnxT('js.s_med.6c4f8c47','Lỗi kết nối tới server khi lấy thông tin YouTube'):'Lỗi kết nối tới server khi lấy thông tin YouTube'); errBox.classList.remove('hidden'); }
            this.showToast((window.cnxT?window.cnxT('js.s_med.51b6dda9','Lỗi kết nối tới server khi preview YouTube'):'Lỗi kết nối tới server khi preview YouTube'), 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = (window.cnxT?window.cnxT('js.s_med.4c646298','<i class="fas fa-search"></i> Lấy Thông Tin'):'<i class="fas fa-search"></i> Lấy Thông Tin');
            }
        }
    },

    async submitYoutubeAudio() {
        const url = (document.getElementById('yt-import-url')?.value || '').trim();
        if (!url) {
            this.showToast((window.cnxT?window.cnxT('js.s_med.9b64b9d0','Vui lòng nhập link YouTube!'):'Vui lòng nhập link YouTube!'), 'warning');
            return;
        }
        const modeEl = document.querySelector('input[name="yt-import-mode"]:checked');
        const mode = modeEl ? modeEl.value : 'hybrid';
        const title = (document.getElementById('yt-import-title')?.value || '').trim();
        const artist = (document.getElementById('yt-import-artist')?.value || '').trim();
        const genre = (document.getElementById('yt-import-genre')?.value || 'YouTube').trim();

        const btn = document.getElementById('yt-submit-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = (window.cnxT?window.cnxT('js.s_inv.a93bfd78','<i class="fas fa-spinner fa-spin"></i> Đang xử lý...'):'<i class="fas fa-spinner fa-spin"></i> Đang xử lý...');
        }
        try {
            const payload = {
                url,
                mode,
                title: title || this.ytPreviewMeta?.title || '',
                artist: artist || this.ytPreviewMeta?.artist || '',
                genre,
                duration_sec: this.ytPreviewMeta?.duration_sec || 0,
                thumbnail: this.ytPreviewMeta?.thumbnail || ''
            };
            const res = await fetch('/api/media/youtube/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.1e237509','Thêm bài hát thất bại'):'Thêm bài hát thất bại'), 'error');
                return;
            }
            this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.0ce4c197','Đã thêm nhạc YouTube!'):'Đã thêm nhạc YouTube!'), 'success');
            await this.loadMediaTracksCatalog();

            if (data.job_id) {
                document.getElementById('yt-job-status-box')?.classList.remove('hidden');
                this.pollYoutubeJobStatus(data.job_id);
            } else {
                this.closeYoutubeImportModal();
            }
        } catch (err) {
            this.showToast((window.cnxT?window.cnxT('js.s_med.d8c6ab10','Lỗi gửi yêu cầu thêm YouTube Audio'):'Lỗi gửi yêu cầu thêm YouTube Audio'), 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = (window.cnxT?window.cnxT('js.s_med.98062141','<i class="fas fa-plus-circle"></i> Thêm Vào Kho Nhạc'):'<i class="fas fa-plus-circle"></i> Thêm Vào Kho Nhạc');
            }
        }
    },

    async pollYoutubeJobStatus(jobId) {
        const statusText = document.getElementById('yt-job-status-text');
        const pctEl = document.getElementById('yt-job-progress-pct');
        const barEl = document.getElementById('yt-job-progress-bar');

        const tick = async () => {
            try {
                const res = await fetch(`/api/media/youtube/job-status?job_id=${encodeURIComponent(jobId)}`);
                const data = await res.json();
                if (!data.success || !data.job) return;
                const j = data.job;
                if (statusText) statusText.textContent = j.message || j.status;
                if (pctEl) pctEl.textContent = `${j.progress || 0}%`;
                if (barEl) barEl.style.width = `${j.progress || 0}%`;

                if (j.status === 'completed') {
                    this.showToast((window.cnxT?window.cnxT('js.s_med.0417bb73','Đã chuyển đổi sang MP3 Offline hoàn tất!'):'Đã chuyển đổi sang MP3 Offline hoàn tất!'), 'success');
                    await this.loadMediaTracksCatalog();
                    return;
                }
                if (j.status === 'failed') {
                    this.showToast(j.message || (window.cnxT?window.cnxT('js.s_med.188a00cf','Tải MP3 thất bại (vẫn phát Stream bình thường)'):'Tải MP3 thất bại (vẫn phát Stream bình thường)'), 'warning');
                    return;
                }
                setTimeout(tick, 2000);
            } catch (_) {
                setTimeout(tick, 3000);
            }
        };
        tick();
    },

    async upgradeYoutubeTrackOffline(trackId, btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = (window.cnxT?window.cnxT('js.s_med.ef8f6ff2','<i class="fas fa-spinner fa-spin"></i> Đang tải...'):'<i class="fas fa-spinner fa-spin"></i> Đang tải...');
        }
        try {
            const res = await fetch('/api/media/youtube/download-offline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: trackId })
            });
            const data = await res.json();
            if (!data.success) {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.8505630b','Không thể tải Offline'):'Không thể tải Offline'), 'error');
                if (btnEl) {
                    btnEl.disabled = false;
                    btnEl.innerHTML = (window.cnxT?window.cnxT('js.s_med.fe079355','<i class="fas fa-download"></i> Lưu Offline'):'<i class="fas fa-download"></i> Lưu Offline');
                }
                return;
            }
            this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.fa552697','Đang tải MP3 về máy...'):'Đang tải MP3 về máy...'), 'info');
            if (data.job_id) {
                const check = async () => {
                    const sr = await fetch(`/api/media/youtube/job-status?job_id=${encodeURIComponent(data.job_id)}`);
                    const sd = await sr.json();
                    if (sd.success && sd.job) {
                        if (sd.job.status === 'completed') {
                            this.showToast((window.cnxT?window.cnxT('js.s_med.f8c7a3aa','Đã lưu Offline MP3 thành công!'):'Đã lưu Offline MP3 thành công!'), 'success');
                            await this.loadMediaTracksCatalog();
                            return;
                        }
                        if (sd.job.status === 'failed') {
                            this.showToast(sd.job.message || (window.cnxT?window.cnxT('js.s_med.91843ac3','Tải Offline thất bại'):'Tải Offline thất bại'), 'error');
                            await this.loadMediaTracksCatalog();
                            return;
                        }
                        setTimeout(check, 2000);
                    }
                };
                setTimeout(check, 2000);
            }
        } catch (err) {
            this.showToast((window.cnxT?window.cnxT('js.s_med.1698c5c3','Lỗi khi tải Offline MP3'):'Lỗi khi tải Offline MP3'), 'error');
        }
    },

    async updateYtdlpTool() {
        this.showToast((window.cnxT?window.cnxT('js.s_med.bd0ab2e1','Đang kiểm tra và cập nhật yt-dlp.exe...'):'Đang kiểm tra và cập nhật yt-dlp.exe...'), 'info');
        try {
            const res = await fetch('/api/media/youtube/update-ytdlp', { method: 'POST' });
            const data = await res.json();
            this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.b1548e82','Hoàn tất kiểm tra yt-dlp'):'Hoàn tất kiểm tra yt-dlp'), data.success ? 'success' : 'warning');
        } catch (_) {
            this.showToast((window.cnxT?window.cnxT('js.s_med.da743fc3','Lỗi khi cập nhật yt-dlp'):'Lỗi khi cập nhật yt-dlp'), 'error');
        }
    },

    openUploadMediaModal() {
        const modal = document.getElementById('admin-media-upload-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.selectedUploadFiles = [];
            this.renderBatchFilesQueue();
            const dropzone = document.getElementById('media-dropzone');
            if (dropzone && !dropzone.dataset.bound) {
                dropzone.dataset.bound = 'true';
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.classList.add('border-teal-300', 'bg-slate-900/90');
                });
                dropzone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('border-teal-300', 'bg-slate-900/90');
                });
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('border-teal-300', 'bg-slate-900/90');
                    if (e.dataTransfer && e.dataTransfer.files) {
                        Admin.handleBatchAudioPicked(e.dataTransfer.files);
                    }
                });
            }
        }
    },

    closeUploadMediaModal() {
        const modal = document.getElementById('admin-media-upload-modal');
        if (modal) modal.classList.add('hidden');
    },

    selectedUploadFiles: [],

    handleBatchAudioPicked(fileList) {
        if (!fileList || fileList.length === 0) return;
        const newFiles = Array.from(fileList).filter(f => {
            const ext = (f.name.substring(f.name.lastIndexOf('.')) || '').toLowerCase();
            return ['.mp3', '.wav', '.flac', '.ogg'].includes(ext);
        });

        if (newFiles.length === 0) {
            this.showToast((window.cnxT?window.cnxT('js.s_med.0eb58e40','Vui lòng chỉ chọn các tệp âm thanh định dạng .mp3, .wav, .flac, .ogg!'):'Vui lòng chỉ chọn các tệp âm thanh định dạng .mp3, .wav, .flac, .ogg!'), 'warning');
            return;
        }

        // Append to existing queue or set
        this.selectedUploadFiles = [...this.selectedUploadFiles, ...newFiles];
        this.renderBatchFilesQueue();
        this.showToast(`${window.cnxT?window.cnxT('js.s_med.a8a6d345','Đã nhận diện'):'Đã nhận diện'} ${newFiles.length} ${window.cnxT?window.cnxT('js.s_med.b8a712bb','file nhạc vào hàng đợi tải lên!'):'file nhạc vào hàng đợi tải lên!'}`, 'info');
    },

    removeUploadQueueItem(idx) {
        if (idx >= 0 && idx < this.selectedUploadFiles.length) {
            this.selectedUploadFiles.splice(idx, 1);
            this.renderBatchFilesQueue();
        }
    },

    clearUploadQueue() {
        this.selectedUploadFiles = [];
        this.renderBatchFilesQueue();
    },

    applyBatchGenre(genre) {
        this.showToast(`Đã gán thể loại "${genre}" cho toàn bộ danh sách tải lên!`, 'info');
    },

    renderBatchFilesQueue() {
        const tbody = document.getElementById('media-upload-queue-body');
        const controlBar = document.getElementById('media-batch-control-bar');
        const countBadge = document.getElementById('media-batch-count-badge');
        const sizeBadge = document.getElementById('media-batch-size-badge');
        const startBtn = document.getElementById('media-upload-start-btn');
        const progressContainer = document.getElementById('media-upload-progress-container');
        
        if (progressContainer) progressContainer.classList.add('hidden');

        const totalFiles = this.selectedUploadFiles.length;

        if (totalFiles === 0) {
            if (controlBar) controlBar.classList.add('hidden');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="p-8 text-center text-slate-500">
                            ${window.cnxT?window.cnxT('ui.adm_html.td_0723ba7b','Chưa có file nào được chọn. Hãy chọn hoặc kéo thả nhiều file nhạc vào khung bên trên.'):'Chưa có file nào được chọn. Hãy chọn hoặc kéo thả nhiều file nhạc vào khung bên trên.'}
                        </td>
                    </tr>
                `;
            }
            return;
        }

        // Has files -> Show control bar and enable submit button
        if (controlBar) controlBar.classList.remove('hidden');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        const totalBytes = this.selectedUploadFiles.reduce((acc, f) => acc + (f.size || 0), 0);
        const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

        if (countBadge) countBadge.textContent = `${totalFiles} ${window.cnxT?window.cnxT('js.s_med.e9703e03','bài hát'):'bài hát'}`;
        if (sizeBadge) sizeBadge.textContent = `${totalMb} MB`;

        if (!tbody) return;

        tbody.innerHTML = this.selectedUploadFiles.map((file, idx) => {
            let name = file.name;
            const dotIdx = name.lastIndexOf('.');
            const ext = dotIdx > 0 ? name.substring(dotIdx).toUpperCase() : '';
            if (dotIdx > 0) name = name.substring(0, dotIdx);

            let artist = 'Various Artists';
            let title = name;
            if (name.includes(' - ')) {
                const parts = name.split(' - ');
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }

            const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

            return `
                <tr class="hover:bg-slate-800/40 transition text-xs">
                    <td class="p-2 font-mono text-slate-500">#${idx + 1}</td>
                    <td class="p-2 font-bold text-white flex items-center gap-1.5 truncate max-w-[240px]">
                        <span class="px-1.5 py-0.5 rounded text-[9px] bg-teal-500/20 text-teal-300 font-mono font-bold">${ext}</span>
                        <span class="truncate" title="${title}">${title}</span>
                    </td>
                    <td class="p-2 text-slate-400 truncate max-w-[140px]" title="${artist}">${artist}</td>
                    <td class="p-2 text-center font-mono text-slate-300">${sizeMb} MB</td>
                    <td class="p-2 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            ${window.cnxT?window.cnxT('js.s_med.69bd3f50','Sẵn sàng'):'Sẵn sàng'}
                        </span>
                    </td>
                    <td class="p-2 text-right">
                        <button type="button" onclick="Admin.removeUploadQueueItem(${idx})" class="w-6 h-6 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 hover:text-white transition" title="Bỏ file này">
                            <i class="fas fa-times text-[10px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async startBatchUpload() {
        if (!this.selectedUploadFiles || this.selectedUploadFiles.length === 0) {
            this.showToast((window.cnxT?window.cnxT('js.s_med.dadb106e','Vui lòng chọn ít nhất 1 file âm thanh!'):'Vui lòng chọn ít nhất 1 file âm thanh!'), 'warning');
            return;
        }

        const startBtn = document.getElementById('media-upload-start-btn');
        const progressContainer = document.getElementById('media-upload-progress-container');
        const progressBar = document.getElementById('media-upload-progress-bar');
        const percentText = document.getElementById('media-upload-percent-text');
        const statusText = document.getElementById('media-upload-status-text');
        const genre = document.getElementById('media-batch-genre-select')?.value || 'Acoustic';

        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = (window.cnxT?window.cnxT('js.s_med.03b98bdf','<i class="fas fa-spinner fa-spin mr-1"></i> Đang tải lên...'):'<i class="fas fa-spinner fa-spin mr-1"></i> Đang tải lên...');
        }
        if (progressContainer) progressContainer.classList.remove('hidden');

        const formData = new FormData();
        this.selectedUploadFiles.forEach((file) => {
            formData.append('audio_files[]', file);
        });
        formData.append('genre', genre);

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/media/tracks/upload', true);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    if (progressBar) progressBar.style.width = `${percent}%`;
                    if (percentText) percentText.textContent = `${percent}%`;
                    if (statusText) statusText.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Đang tải lên ${this.selectedUploadFiles.length} ${window.cnxT?window.cnxT('js.s_med.1769ead9','bài hát ('):'bài hát ('}${percent}%)...`;
                }
            };

            xhr.onload = async () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.success) {
                            this.showToast(data.message || `${window.cnxT?window.cnxT('js.s_med.67d2bace','Đã tải lên thành công'):'Đã tải lên thành công'} ${this.selectedUploadFiles.length} ${window.cnxT?window.cnxT('js.s_med.8509a8bf','bài hát!'):'bài hát!'}`, 'success');
                            this.selectedUploadFiles = [];
                            this.closeUploadMediaModal();
                            await this.loadMediaTracksCatalog();
                            this.renderMediaManagerTable();
                        } else {
                            this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.61927797','Lỗi khi tải lên file nhạc'):'Lỗi khi tải lên file nhạc'), 'error');
                        }
                    } catch (e) {
                        this.showToast((window.cnxT?window.cnxT('js.s_med.0fcbe22f','Đã tải lên bài hát thành công!'):'Đã tải lên bài hát thành công!'), 'success');
                        this.selectedUploadFiles = [];
                        this.closeUploadMediaModal();
                        await this.loadMediaTracksCatalog();
                        this.renderMediaManagerTable();
                    }
                } else {
                    this.showToast(`${window.cnxT?window.cnxT('js.s_med.5206cfd7','Lỗi HTTP'):'Lỗi HTTP'} ${xhr.status} ${window.cnxT?window.cnxT('js.s_med.a2e21f57','khi tải lên bài hát'):'khi tải lên bài hát'}`, 'error');
                }
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.innerHTML = (window.cnxT?window.cnxT('js.s_med.e60339ef','<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả'):'<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả');
                }
            };

            xhr.onerror = () => {
                this.showToast((window.cnxT?window.cnxT('js.s_med.3bd6957d','Lỗi kết nối khi tải lên bài hát'):'Lỗi kết nối khi tải lên bài hát'), 'error');
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.innerHTML = (window.cnxT?window.cnxT('js.s_med.e60339ef','<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả'):'<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả');
                }
            };

            xhr.send(formData);
        } catch (err) {
            console.error('startBatchUpload error:', err);
            this.showToast((window.cnxT?window.cnxT('js.s_med.6b1398c9','Lỗi gửi dữ liệu lên máy chủ'):'Lỗi gửi dữ liệu lên máy chủ'), 'error');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = (window.cnxT?window.cnxT('js.s_med.e60339ef','<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả'):'<i class="fas fa-cloud-arrow-up mr-1"></i> Bắt Đầu Tải Lên Tất Cả');
            }
        }
    },

    async deleteMediaTrack(id) {
        // Direct delete with feedback toast! Zero blocking popups!
        try {
            const res = await fetch(`/api/media/tracks/delete?action=delete&id=${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: id })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.d1adef9e','Đã xóa bài hát khỏi kho nhạc!'):'Đã xóa bài hát khỏi kho nhạc!'), 'info');
                await this.loadMediaTracksCatalog();
                this.renderMediaManagerTable();
            } else {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.e7836b0a','Lỗi xóa bài hát'):'Lỗi xóa bài hát'), 'error');
            }
        } catch (err) {
            console.error('deleteMediaTrack error:', err);
            this.showToast((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'), 'error');
        }
    },

    async rescanMediaTracks() {
        try {
            const res = await fetch('/api/media/tracks/rescan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.3dac053b','Đã quét xong thư mục nhạc!'):'Đã quét xong thư mục nhạc!'), 'success');
                await this.loadMediaTracksCatalog();
                this.renderMediaManagerTable();
            } else {
                this.showToast(data.message || (window.cnxT?window.cnxT('js.s_med.db349adb','Lỗi quét thư mục nhạc'):'Lỗi quét thư mục nhạc'), 'error');
            }
        } catch (err) {
            console.error('rescanMediaTracks error:', err);
            this.showToast((window.cnxT?window.cnxT('js.m_sa.26ee0245','Lỗi kết nối máy chủ'):'Lỗi kết nối máy chủ'), 'error');
        }
    }
});
