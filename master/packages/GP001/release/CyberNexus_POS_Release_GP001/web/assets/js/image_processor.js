window.ImageProcessor = (() => {
    const presets = {
        logo: { maxWidth: 512, maxHeight: 512, maxBytes: 256 * 1024, quality: 0.84, minQuality: 0.64, minEdge: 160 },
        invoice: { maxWidth: 2200, maxHeight: 2200, maxBytes: 900 * 1024, quality: 0.86, minQuality: 0.68, minEdge: 700 },
        advertisement: { maxWidth: 1920, maxHeight: 1920, maxBytes: 768 * 1024, quality: 0.84, minQuality: 0.68, minEdge: 640 }
    };

    function encodeCanvas(canvas, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error('Trình duyệt không thể xử lý ảnh này.'));
                } else if (blob.type !== 'image/webp') {
                    reject(new Error('Trình duyệt chưa hỗ trợ chuẩn WebP. Vui lòng dùng phiên bản trình duyệt mới hơn.'));
                } else {
                    resolve(blob);
                }
            }, 'image/webp', quality);
        });
    }

    async function decodeImage(file) {
        if (typeof createImageBitmap === 'function') {
            return createImageBitmap(file);
        }

        const url = URL.createObjectURL(file);
        try {
            const image = new Image();
            image.src = url;
            await image.decode();
            return image;
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    function fileFromBlob(blob, originalName) {
        const baseName = originalName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'image';
        return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
    }

    async function processFile(file, presetName) {
        const preset = presets[presetName];
        if (!preset) throw new Error('Không tìm thấy cấu hình xử lý ảnh.');
        if (!file || !file.type.startsWith('image/') || file.size <= 0 || file.size > 30 * 1024 * 1024) {
            throw new Error('Ảnh không hợp lệ hoặc vượt giới hạn 30 MB trước khi xử lý.');
        }

        const image = await decodeImage(file);
        const sourceWidth = image.width || image.naturalWidth;
        const sourceHeight = image.height || image.naturalHeight;
        if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > 60000000) {
            if (typeof image.close === 'function') image.close();
            throw new Error('Kích thước ảnh không hợp lệ hoặc vượt giới hạn xử lý.');
        }

        let scale = Math.min(1, preset.maxWidth / sourceWidth, preset.maxHeight / sourceHeight);
        let result = null;
        try {
            for (let resizeAttempt = 0; resizeAttempt < 8; resizeAttempt++) {
                const width = Math.max(1, Math.round(sourceWidth * scale));
                const height = Math.max(1, Math.round(sourceHeight * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');
                if (!context) throw new Error('Trình duyệt không tạo được bộ nhớ xử lý ảnh.');
                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                context.drawImage(image, 0, 0, width, height);

                for (let quality = preset.quality; quality >= preset.minQuality; quality -= 0.06) {
                    result = await encodeCanvas(canvas, Math.max(preset.minQuality, quality));
                    if (result.size <= preset.maxBytes) {
                        return fileFromBlob(result, file.name);
                    }
                }

                if (Math.min(width, height) <= preset.minEdge) break;
                scale *= 0.82;
            }
        } finally {
            if (typeof image.close === 'function') image.close();
        }

        throw new Error(`Không thể nén ảnh xuống dưới ${(preset.maxBytes / 1024).toFixed(0)} KB mà vẫn giữ chất lượng tối thiểu.`);
    }

    async function canvasToDataUrl(canvas, quality = 0.82, maxBytes = 256 * 1024) {
        let blob;
        for (let currentQuality = quality; currentQuality >= 0.62; currentQuality -= 0.06) {
            blob = await encodeCanvas(canvas, Math.max(0.62, currentQuality));
            if (blob.size <= maxBytes) {
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Không thể đọc ảnh đã xử lý.'));
                    reader.readAsDataURL(blob);
                });
            }
        }
        throw new Error(`Ảnh vượt giới hạn ${(maxBytes / 1024).toFixed(0)} KB.`);
    }

    async function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Không thể đọc ảnh đã xử lý.'));
            reader.readAsDataURL(file);
        });
    }

    async function processCanvas(canvas, presetName, fileName) {
        const source = await encodeCanvas(canvas, 0.92);
        const file = new File([source], fileName || 'image.webp', { type: 'image/webp' });
        return processFile(file, presetName);
    }

    return { presets, processFile, processCanvas, canvasToDataUrl, fileToDataUrl };
})();
