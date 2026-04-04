Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
[void][Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime]
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]

$ProjectRoot = 'C:\Users\dj057\projects\colorvision'
$PdfPath = Join-Path $ProjectRoot 'assets\Ishihara_Tests.pdf'
$TempDir = Join-Path $ProjectRoot 'temp'
$OutputDir = Join-Path $ProjectRoot 'assets\images\ishihara'
$JsonPath = Join-Path $ProjectRoot 'tests\ishihara.json'

$plateDefinitions = @(
    [PSCustomObject]@{ PlateNumber = 1; PdfPageNumber = 3; VerticalSplits = 1; SegmentIndex = 0; Normal = '12'; Deficient = '12' },
    [PSCustomObject]@{ PlateNumber = 2; PdfPageNumber = 4; VerticalSplits = 1; SegmentIndex = 0; Normal = '8'; Deficient = '3' },
    [PSCustomObject]@{ PlateNumber = 3; PdfPageNumber = 5; VerticalSplits = 1; SegmentIndex = 0; Normal = '29'; Deficient = '70' },
    [PSCustomObject]@{ PlateNumber = 4; PdfPageNumber = 6; VerticalSplits = 1; SegmentIndex = 0; Normal = '5'; Deficient = '2' },
    [PSCustomObject]@{ PlateNumber = 5; PdfPageNumber = 7; VerticalSplits = 1; SegmentIndex = 0; Normal = '3'; Deficient = '5' },
    [PSCustomObject]@{ PlateNumber = 6; PdfPageNumber = 8; VerticalSplits = 1; SegmentIndex = 0; Normal = '15'; Deficient = '17' },
    [PSCustomObject]@{ PlateNumber = 7; PdfPageNumber = 9; VerticalSplits = 1; SegmentIndex = 0; Normal = '74'; Deficient = '21' },
    [PSCustomObject]@{ PlateNumber = 8; PdfPageNumber = 10; VerticalSplits = 1; SegmentIndex = 0; Normal = '6'; Deficient = '5' },
    [PSCustomObject]@{ PlateNumber = 9; PdfPageNumber = 11; VerticalSplits = 1; SegmentIndex = 0; Normal = '45'; Deficient = $null },
    [PSCustomObject]@{ PlateNumber = 10; PdfPageNumber = 12; VerticalSplits = 1; SegmentIndex = 0; Normal = '5'; Deficient = $null },
    [PSCustomObject]@{ PlateNumber = 11; PdfPageNumber = 13; VerticalSplits = 1; SegmentIndex = 0; Normal = '7'; Deficient = $null },
    [PSCustomObject]@{ PlateNumber = 12; PdfPageNumber = 14; VerticalSplits = 1; SegmentIndex = 0; Normal = '16'; Deficient = $null }
)
function Await-WinRT {
    param(
        [Parameter(Mandatory = $true)]$Operation,
        [Parameter(Mandatory = $true)][Type]$ResultType
    )

    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.IsGenericMethod -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
        } |
        Select-Object -First 1

    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}

function Await-Action {
    param([Parameter(Mandatory = $true)]$Action)

    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            -not $_.IsGenericMethod -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.FullName -eq 'Windows.Foundation.IAsyncAction'
        } |
        Select-Object -First 1

    $task = $method.Invoke($null, @($Action))
    $task.Wait()
}

function Render-PdfPages {
    param(
        [Parameter(Mandatory = $true)][string]$PdfPath,
        [Parameter(Mandatory = $true)][string]$OutputDirectory
    )

    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

    $file = Await-WinRT -Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($PdfPath)) -ResultType ([Windows.Storage.StorageFile])
    $document = Await-WinRT -Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) -ResultType ([Windows.Data.Pdf.PdfDocument])

    for ($index = 0; $index -lt $document.PageCount; $index++) {
        $page = $document.GetPage($index)
        $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
        Await-Action -Action ($page.RenderToStreamAsync($stream))
        $stream.Seek(0)

        $outputPath = Join-Path $OutputDirectory ('page_{0:d2}.png' -f ($index + 1))
        $readStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
        $fileStream = [System.IO.File]::Create($outputPath)
        $readStream.CopyTo($fileStream)

        $fileStream.Dispose()
        $readStream.Dispose()
        $stream.Dispose()
        $page.Dispose()
    }

    return $document.PageCount
}

function Get-NonWhiteBounds {
    param(
        [Parameter(Mandatory = $true)][System.Drawing.Bitmap]$Bitmap,
        [double]$TopCropFraction = 0.12,
        [double]$BottomCropFraction = 0.95,
        [int]$Stride = 2
    )

    $width = $Bitmap.Width
    $height = $Bitmap.Height
    $minX = $width
    $minY = $height
    $maxX = -1
    $maxY = -1
    $startY = [Math]::Max(0, [Math]::Floor($height * $TopCropFraction))
    $endY = [Math]::Min($height - 1, [Math]::Ceiling($height * $BottomCropFraction))

    for ($y = $startY; $y -le $endY; $y += $Stride) {
        for ($x = 0; $x -lt $width; $x += $Stride) {
            $pixel = $Bitmap.GetPixel($x, $y)
            if ($pixel.R -lt 245 -or $pixel.G -lt 245 -or $pixel.B -lt 245) {
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($maxX -lt 0 -or $maxY -lt 0) {
        return $null
    }

    return [PSCustomObject]@{
        X = $minX
        Y = $minY
        Width = ($maxX - $minX + 1)
        Height = ($maxY - $minY + 1)
    }
}

function Get-SquareCropRect {
    param(
        [Parameter(Mandatory = $true)][System.Drawing.Bitmap]$Bitmap,
        [int]$Padding = 20
    )

    $bounds = Get-NonWhiteBounds -Bitmap $Bitmap
    if (-not $bounds) {
        $side = [Math]::Min($Bitmap.Width, $Bitmap.Height)
        return [System.Drawing.Rectangle]::new(
            [Math]::Floor(($Bitmap.Width - $side) / 2),
            [Math]::Floor(($Bitmap.Height - $side) / 2),
            $side,
            $side
        )
    }

    $x = [Math]::Max(0, $bounds.X - $Padding)
    $y = [Math]::Max(0, $bounds.Y - $Padding)
    $right = [Math]::Min($Bitmap.Width, $bounds.X + $bounds.Width + $Padding)
    $bottom = [Math]::Min($Bitmap.Height, $bounds.Y + $bounds.Height + $Padding)
    $width = $right - $x
    $height = $bottom - $y
    $side = [Math]::Min([Math]::Max($width, $height), [Math]::Min($Bitmap.Width, $Bitmap.Height))
    $centerX = $x + ($width / 2.0)
    $centerY = $y + ($height / 2.0)
    $cropX = [Math]::Round($centerX - ($side / 2.0))
    $cropY = [Math]::Round($centerY - ($side / 2.0))

    if ($cropX -lt 0) { $cropX = 0 }
    if ($cropY -lt 0) { $cropY = 0 }
    if ($cropX + $side -gt $Bitmap.Width) { $cropX = $Bitmap.Width - $side }
    if ($cropY + $side -gt $Bitmap.Height) { $cropY = $Bitmap.Height - $side }

    return [System.Drawing.Rectangle]::new([int]$cropX, [int]$cropY, [int]$side, [int]$side)
}

function Get-SegmentBitmap {
    param(
        [Parameter(Mandatory = $true)][System.Drawing.Bitmap]$Bitmap,
        [int]$VerticalSplits = 1,
        [int]$SegmentIndex = 0
    )

    $segmentHeight = [Math]::Floor($Bitmap.Height / [Math]::Max(1, $VerticalSplits))
    $segmentY = $segmentHeight * $SegmentIndex
    if ($SegmentIndex -eq ($VerticalSplits - 1)) {
        $segmentHeight = $Bitmap.Height - $segmentY
    }

    $rect = [System.Drawing.Rectangle]::new(0, $segmentY, $Bitmap.Width, $segmentHeight)
    return $Bitmap.Clone($rect, $Bitmap.PixelFormat)
}

function Save-CroppedPlate {
    param(
        [Parameter(Mandatory = $true)][string]$PageImagePath,
        [Parameter(Mandatory = $true)][string]$OutputPath,
        [int]$VerticalSplits = 1,
        [int]$SegmentIndex = 0
    )

    $pageBitmap = [System.Drawing.Bitmap]::new($PageImagePath)
    $segmentBitmap = Get-SegmentBitmap -Bitmap $pageBitmap -VerticalSplits $VerticalSplits -SegmentIndex $SegmentIndex
    $cropRect = Get-SquareCropRect -Bitmap $segmentBitmap
    $cropped = $segmentBitmap.Clone($cropRect, $segmentBitmap.PixelFormat)
    $cropped.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $cropped.Dispose()
    $segmentBitmap.Dispose()
    $pageBitmap.Dispose()
}

function Get-PlateType {
    param($Normal, $Deficient)

    if ($null -eq $Deficient -or $Deficient -eq '') {
        return 'vanishing'
    }
    if ([string]$Normal -eq [string]$Deficient) {
        return 'demo'
    }
    return 'transform'
}

function New-PlateMetadata {
    param([Parameter(Mandatory = $true)]$Definition)

    $plateNumber = '{0:d2}' -f $Definition.PlateNumber
    $type = Get-PlateType -Normal $Definition.Normal -Deficient $Definition.Deficient
    $category = if ($type -eq 'demo') { 'Demonstration' } else { 'Red-Green' }
    $fileName = 'ishihara_{0}.jpg' -f $plateNumber
    $deficientValue = if ($null -eq $Definition.Deficient) { $null } else { [string]$Definition.Deficient }
    $subtypeStrength = if ($type -eq 'transform' -and $deficientValue) { 'weak' } else { $null }

    $ordered = [ordered]@{
        id = 'P{0}' -f $plateNumber
        name = 'Plate {0}' -f [int]$Definition.PlateNumber
        category = $category
        type = $type
        file = $fileName
        image = 'assets/images/ishihara/{0}' -f $fileName
        normal = [string]$Definition.Normal
        deficient = $deficientValue
        protan = $deficientValue
        deutan = $deficientValue
        expected = [string]$Definition.Normal
        confusionMapping = if ($deficientValue) {
            [ordered]@{ Protan = $deficientValue; Deutan = $deficientValue }
        } else {
            [ordered]@{}
        }
        available = $true
        sourcePage = $Definition.PdfPageNumber
    }

    if ($subtypeStrength) {
        $ordered.subtypeStrength = $subtypeStrength
    }

    return [PSCustomObject]$ordered
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$pageCount = Render-PdfPages -PdfPath $PdfPath -OutputDirectory $TempDir

foreach ($plate in $plateDefinitions) {
    $pageImagePath = Join-Path $TempDir ('page_{0:d2}.png' -f $plate.PdfPageNumber)
    $outputPath = Join-Path $OutputDir ('ishihara_{0:d2}.jpg' -f $plate.PlateNumber)
    Save-CroppedPlate -PageImagePath $pageImagePath -OutputPath $outputPath -VerticalSplits $plate.VerticalSplits -SegmentIndex $plate.SegmentIndex
}

$plateMetadata = $plateDefinitions | ForEach-Object { New-PlateMetadata -Definition $_ }
$plateMetadata | ConvertTo-Json -Depth 8 | Set-Content $JsonPath

Write-Output ('Rendered {0} PDF pages to {1}' -f $pageCount, $TempDir)
Write-Output ('Extracted {0} Ishihara plates to {1}' -f $plateDefinitions.Count, $OutputDir)
Write-Output ('Wrote metadata to {0}' -f $JsonPath)

