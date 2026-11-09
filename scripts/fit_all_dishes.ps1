Add-Type -AssemblyName System.Drawing

$targetW = 480
$targetH = 360

function FitImage([string]$srcPath, [string]$destPath) {
    if (-not (Test-Path $srcPath)) { return }
    try {
        $src = [System.Drawing.Image]::FromFile($srcPath)
        
        # Create target bitmap
        $dest = New-Object System.Drawing.Bitmap $targetW, $targetH
        $g = [System.Drawing.Graphics]::FromImage($dest)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        # Dark slate background
        $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
        $g.FillRectangle($bgBrush, 0, 0, $targetW, $targetH)

        # Ambient backdrop (stretched and dimmed)
        $g.DrawImage($src, 0, 0, $targetW, $targetH)
        $shadeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190, 10, 15, 30))
        $g.FillRectangle($shadeBrush, 0, 0, $targetW, $targetH)

        # Calculate proportional scale so entire subject fits inside 480x360
        $srcRatio = $src.Width / $src.Height
        $targetRatio = $targetW / $targetH

        if ($srcRatio -gt $targetRatio) {
            # Wider than 4:3: fit width, center vertically
            $fitW = $targetW
            $fitH = [int]($targetW / $srcRatio)
            $fitX = 0
            $fitY = [int](($targetH - $fitH) / 2)
        } else {
            # Taller than 4:3 (e.g. glasses of drink): fit height, center horizontally
            $fitH = $targetH
            $fitW = [int]($targetH * $srcRatio)
            $fitX = [int](($targetW - $fitW) / 2)
            $fitY = 0
        }

        # Draw the complete, intact image in the center
        $g.DrawImage($src, $fitX, $fitY, $fitW, $fitH)

        $dest.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
        $g.Dispose()
        $dest.Dispose()
        $src.Dispose()
        Write-Output "Fitted: $(Split-Path $destPath -Leaf)"
    } catch {
        Write-Output "Error on $srcPath : $_"
    }
}

# Process all dishes in assets/images/dishes
$dishesDir = "assets/images/dishes"
$tempDir = "assets/images/dishes/processed"
if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir | Out-Null }

Get-ChildItem "$dishesDir/*.jpg" | ForEach-Object {
    $code = $_.BaseName
    $dest = "$tempDir/$($_.Name)"
    FitImage $_.FullName $dest
}

Write-Output "All dishes processed to exact 4:3 full-view layout."

