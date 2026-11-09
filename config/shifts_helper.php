<?php
/**
 * Shift Schedule & Auto-Closing Engine
 * Cho phép Admin quy định khung giờ các ca làm việc (Ca 1, Ca 2)
 * và tự động chốt ca nếu nhân viên hết giờ làm việc mà quên bấm Logout.
 */

if (!function_exists('getShiftConfig')) {
    /**
     * Lấy cấu hình khung giờ ca làm việc từ store_settings
     */
    function getShiftConfig(PDO $pdo): array {
        $defaults = [
            'shift1_name' => 'Ca 1 (Ca Sáng)',
            'shift1_start' => '06:30',
            'shift1_end' => '12:30',
            'shift2_name' => 'Ca 2 (Ca Chiều / Tối)',
            'shift2_start' => '12:30',
            'shift2_end' => '22:30',
            'shift_grace_minutes' => 15,
            'shift_autoclose_enabled' => 1
        ];

        try {
            $stmt = $pdo->query("SELECT setting_key, setting_value FROM store_settings WHERE setting_key LIKE 'shift%'");
            if ($stmt) {
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $k = $row['setting_key'];
                    $v = $row['setting_value'];
                    if (in_array($k, ['shift_grace_minutes', 'shift_autoclose_enabled'])) {
                        $defaults[$k] = intval($v);
                    } else {
                        $defaults[$k] = (string)$v;
                    }
                }
            }
        } catch (Exception $e) {
            error_log("getShiftConfig error: " . $e->getMessage());
        }

        return $defaults;
    }
}

if (!function_exists('autoCloseExpiredShifts')) {
    /**
     * Tự động chốt ca làm việc nếu nhân viên đăng nhập vào khung giờ ca mà hết giờ không bấm logout
     * @return int Số ca đã được tự động chốt
     */
    function autoCloseExpiredShifts(PDO $pdo): int {
        $cfg = getShiftConfig($pdo);
        if (empty($cfg['shift_autoclose_enabled'])) {
            return 0;
        }

        $now = time();
        $graceSecs = max(0, intval($cfg['shift_grace_minutes'] ?? 15)) * 60;
        $closedCount = 0;

        try {
            $stmt = $pdo->query("SELECT * FROM attendances WHERE status = 'working'");
            $openShifts = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

            foreach ($openShifts as $att) {
                $inTime = strtotime($att['check_in_time']);
                $workDate = $att['work_date'];
                $inTimeOfDay = date('H:i', $inTime);

                // 1. Xác định ca làm việc theo giờ check-in:
                // Nếu check-in trước hoặc bằng giờ kết thúc ca 1 -> thuộc Ca 1 (Ca Sáng)
                // Nếu check-in sau giờ kết thúc ca 1 -> thuộc Ca 2 (Ca Chiều/Tối)
                $isShift1 = ($inTimeOfDay <= $cfg['shift1_end']);
                $shiftName = $isShift1 ? ($cfg['shift1_name'] ?: 'Ca 1') : ($cfg['shift2_name'] ?: 'Ca 2');
                $shiftEndHour = $isShift1 ? $cfg['shift1_end'] : $cfg['shift2_end'];

                // 2. Mốc thời gian kết thúc ca theo lịch
                $scheduledEndTimeStr = $workDate . ' ' . $shiftEndHour . ':00';
                $scheduledEndTimestamp = strtotime($scheduledEndTimeStr);

                // 3. Mốc hết hạn tối đa được phép trực (kết thúc ca + thời gian ân hạn)
                $expirationTimestamp = $scheduledEndTimestamp + $graceSecs;

                // 4. Nếu thời gian hiện tại đã vượt qua mốc hết hạn của ca (hoặc đã sang ngày hôm sau):
                // TỰ ĐỘNG CHỐT CA
                if ($now >= $expirationTimestamp || date('Y-m-d') > $workDate) {
                    // Giờ kết thúc được chốt chuẩn theo giờ kết thúc ca quy định của admin
                    $outTimestamp = max($inTime, min($now, $scheduledEndTimestamp));
                    $outTimeStr = date('Y-m-d H:i:s', $outTimestamp);

                    $seconds = max(0, $outTimestamp - $inTime);
                    $workHours = round($seconds / 3600, 2);
                    $hourlyRate = floatval($att['hourly_rate']);
                    $totalPay = round($workHours * $hourlyRate);

                    $autoNote = "Hệ thống tự động chốt lúc " . date('H:i', $outTimestamp) . " (Hết khung giờ {$shiftName})";

                    $upd = $pdo->prepare("UPDATE attendances SET check_out_time = :out_time, work_hours = :hours, total_pay = :pay, status = 'completed', note = COALESCE(note || ' | ', '') || :note WHERE id = :id");
                    $upd->execute([
                        ':out_time' => $outTimeStr,
                        ':hours' => $workHours,
                        ':pay' => $totalPay,
                        ':note' => $autoNote,
                        ':id' => $att['id']
                    ]);

                    // Đặt trạng thái tài khoản thành offline
                    $updUser = $pdo->prepare("UPDATE users SET is_online = 0 WHERE id = :uid");
                    $updUser->execute([':uid' => $att['user_id']]);

                    $closedCount++;
                }
            }
        } catch (Exception $e) {
            error_log("autoCloseExpiredShifts error: " . $e->getMessage());
        }

        return $closedCount;
    }
}

