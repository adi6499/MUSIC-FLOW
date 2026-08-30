Add-Type -AssemblyName System.Drawing

$sourcePath = 'c:\Users\PC\AndroidStudioProjects\MUSICFLOW\web-app\assets\logo.png'
$targetDir = 'c:\Users\PC\AndroidStudioProjects\MUSICFLOW\ios\App\App\Assets.xcassets\AppIcon.appiconset'

$icons = @(
    @{ name = 'AppIcon-20@2x.png'; width = 40; height = 40 },
    @{ name = 'AppIcon-20@3x.png'; width = 60; height = 60 },
    @{ name = 'AppIcon-29@1x.png'; width = 29; height = 29 },
    @{ name = 'AppIcon-29@2x.png'; width = 58; height = 58 },
    @{ name = 'AppIcon-29@3x.png'; width = 87; height = 87 },
    @{ name = 'AppIcon-40@1x.png'; width = 40; height = 40 },
    @{ name = 'AppIcon-40@2x.png'; width = 80; height = 80 },
    @{ name = 'AppIcon-40@3x.png'; width = 120; height = 120 },
    @{ name = 'AppIcon-60@2x.png'; width = 120; height = 120 },
    @{ name = 'AppIcon-60@3x.png'; width = 180; height = 180 },
    @{ name = 'AppIcon-76@1x.png'; width = 76; height = 76 },
    @{ name = 'AppIcon-76@2x.png'; width = 152; height = 152 },
    @{ name = 'AppIcon-83.5@2x.png'; width = 167; height = 167 },
    @{ name = 'AppIcon-512@2x.png'; width = 1024; height = 1024 }
)

$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

foreach ($icon in $icons) {
    $destPath = Join-Path $targetDir $icon.name
    $destBmp = New-Object System.Drawing.Bitmap($icon.width, $icon.height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($sourceImg, 0, 0, $icon.width, $icon.height)
    $g.Dispose()
    $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Output ("Generated: " + $icon.name + " (" + $icon.width + "x" + $icon.height + ")")
}

$sourceImg.Dispose()
Write-Output 'All iOS AppIcon PNGs successfully generated.'
