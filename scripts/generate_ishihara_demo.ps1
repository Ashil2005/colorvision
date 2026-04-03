Add-Type -AssemblyName System.Drawing

$OutputDir = 'C:\Users\dj057\projects\colorvision\assets\images\ishihara'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function New-ColorBrush {
    param([string[]]$Palette)
    $hex = Get-Random -InputObject $Palette
    $color = [System.Drawing.ColorTranslator]::FromHtml($hex)
    return [System.Drawing.SolidBrush]::new($color)
}

function New-IshiharaPlate {
    param(
        [string]$NumberText,
        [string]$FileName,
        [string[]]$BackgroundPalette,
        [string[]]$ForegroundPalette
    )

    $size = 512
    $center = [System.Drawing.PointF]::new($size / 2, $size / 2)
    $radius = 220
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::White)

    $stringFormat = [System.Drawing.StringFormat]::new()
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

    $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
    $fontSize = if ($NumberText.Length -gt 1) { 188 } else { 228 }
    $graphicsPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $graphicsPath.AddString(
        $NumberText,
        $fontFamily,
        [int][System.Drawing.FontStyle]::Bold,
        $fontSize,
        [System.Drawing.RectangleF]::new(32, 40, $size - 64, $size - 80),
        $stringFormat
    )

    for ($i = 0; $i -lt 1800; $i++) {
        $angle = (Get-Random -Minimum 0.0 -Maximum ([Math]::PI * 2))
        $distance = [Math]::Sqrt((Get-Random -Minimum 0.0 -Maximum 1.0)) * $radius
        $x = $center.X + ([Math]::Cos($angle) * $distance)
        $y = $center.Y + ([Math]::Sin($angle) * $distance)
        $dotSize = Get-Random -Minimum 8 -Maximum 26
        $rect = [System.Drawing.RectangleF]::new($x - ($dotSize / 2), $y - ($dotSize / 2), $dotSize, $dotSize)

        $insideGlyph = $graphicsPath.IsVisible($x, $y)
        $brush = if ($insideGlyph) {
            New-ColorBrush -Palette $ForegroundPalette
        } else {
            New-ColorBrush -Palette $BackgroundPalette
        }

        $graphics.FillEllipse($brush, $rect)
        $brush.Dispose()
    }

    $borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(20, 0, 0, 0), 2)
    $graphics.DrawEllipse($borderPen, $center.X - $radius, $center.Y - $radius, $radius * 2, $radius * 2)

    $filePath = Join-Path $OutputDir $FileName
    $bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Jpeg)

    $borderPen.Dispose()
    $graphicsPath.Dispose()
    $stringFormat.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$backgroundPalette = @('#6B8E23', '#7A9D32', '#9BB25C', '#B8C77A', '#D0C86B', '#A4B86A', '#7FA05A', '#B38D2F')
$foregroundPalette = @('#D7643B', '#E17B4F', '#E69566', '#C85A3D', '#D98C7A', '#C94754', '#E86B2F', '#E7A66A')

$plates = @(
    @{ Number = '26'; File = 'ishihara_17.jpg' },
    @{ Number = '8'; File = 'ishihara_18.jpg' },
    @{ Number = '5'; File = 'ishihara_19.jpg' },
    @{ Number = '73'; File = 'ishihara_20.jpg' }
)

foreach ($plate in $plates) {
    New-IshiharaPlate -NumberText $plate.Number -FileName $plate.File -BackgroundPalette $backgroundPalette -ForegroundPalette $foregroundPalette
}
