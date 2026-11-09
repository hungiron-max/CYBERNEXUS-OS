/**
 * Touch Virtual Keyboard & Quick Numpad for POS Terminals
 */

const VirtualNumpad = {
    targetInput: null,
    overlayElement: null,

    init() {
        this.createNumpadModal();
        this.bindEvents();
    },

    createNumpadModal() {
        if (document.getElementById('numpad-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'numpad-modal';
        modal.className = 'liquid-modal-overlay';
        modal.innerHTML = `
            <div class="liquid-glass liquid-modal-content p-5 w-80 max-w-full text-white shadow-2xl border border-sky-500/30">
                <div class="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                    <span id="numpad-title" class="font-bold text-sky-400 text-sm uppercase tracking-wider">Bàn Phím Số Cảm Ứng</span>
                    <button type="button" class="text-slate-400 hover:text-white text-lg p-1" onclick="VirtualNumpad.close()">&times;</button>
                </div>
                
                <div class="mb-3">
                    <div id="numpad-display" class="w-full bg-slate-900/90 border border-sky-400/50 rounded-xl py-3 px-4 text-right text-2xl font-mono font-bold text-emerald-400 tracking-wider shadow-inner">0</div>
                </div>

                <div class="grid grid-cols-3 gap-2 mb-3">
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('7')">7</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('8')">8</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('9')">9</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('4')">4</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('5')">5</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('6')">6</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('1')">1</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('2')">2</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('3')">3</button>
                    <button type="button" class="numpad-btn text-rose-400" onclick="VirtualNumpad.clear()">C</button>
                    <button type="button" class="numpad-btn" onclick="VirtualNumpad.press('0')">0</button>
                    <button type="button" class="numpad-btn text-amber-400 text-lg" onclick="VirtualNumpad.backspace()">⌫</button>
                </div>

                <div class="grid grid-cols-2 gap-2 mb-3">
                    <button type="button" class="btn-glass bg-slate-700/60 hover:bg-slate-600/80 text-xs py-2" onclick="VirtualNumpad.press('000')">+000</button>
                    <button type="button" class="btn-glass bg-slate-700/60 hover:bg-slate-600/80 text-xs py-2" onclick="VirtualNumpad.press('00')">+00</button>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <button type="button" class="btn-glass bg-rose-500/20 text-rose-300 border-rose-500/40 text-sm py-2.5" onclick="VirtualNumpad.close()">Hủy</button>
                    <button type="button" class="btn-glass-success text-sm py-2.5 font-bold" onclick="VirtualNumpad.confirm()">Xong (Enter)</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.overlayElement = modal;
    },

    bindEvents() {
        // Allow clicking anywhere outside modal content to close
        this.overlayElement.addEventListener('click', (e) => {
            if (e.target === this.overlayElement) {
                this.close();
            }
        });
    },

    open(inputElement, title = 'Nhập số tiền / Số lượng') {
        this.targetInput = inputElement;
        const titleEl = document.getElementById('numpad-title');
        const displayEl = document.getElementById('numpad-display');
        
        if (titleEl) titleEl.innerText = title;
        if (displayEl) {
            const rawVal = inputElement.value ? inputElement.value.replace(/[^0-9]/g, '') : '0';
            displayEl.innerText = rawVal || '0';
        }

        this.overlayElement.classList.add('open');
    },

    press(key) {
        const displayEl = document.getElementById('numpad-display');
        let current = displayEl.innerText;
        if (current === '0') {
            current = key;
        } else {
            current += key;
        }
        displayEl.innerText = current;
    },

    backspace() {
        const displayEl = document.getElementById('numpad-display');
        let current = displayEl.innerText;
        if (current.length > 1) {
            displayEl.innerText = current.slice(0, -1);
        } else {
            displayEl.innerText = '0';
        }
    },

    clear() {
        const displayEl = document.getElementById('numpad-display');
        displayEl.innerText = '0';
    },

    close() {
        this.overlayElement.classList.remove('open');
        this.targetInput = null;
    },

    confirm() {
        const displayEl = document.getElementById('numpad-display');
        const val = displayEl.innerText;
        if (this.targetInput) {
            this.targetInput.value = val;
            // Dispatch input and change events
            this.targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        this.close();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    VirtualNumpad.init();
});

