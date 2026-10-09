# 官方素材 -> 站点图片：先下载（若缺失），再裁剪/缩放成站点使用的尺寸
Add-Type -AssemblyName System.Drawing

$dl   = "$env:TEMP\ig-research\dl"
$root = "C:\Users\doctor\azure-blog\assets\img"
$gal  = Join-Path $root "gallery"
$wrk  = Join-Path $root "works"
New-Item -ItemType Directory -Force -Path $gal, $wrk | Out-Null

# ---- 0. 下载官方素材（已存在则跳过）----
$appIds = @(4290390, 452440, 858940, 1238730, 1921560, 965810, 2258770, 2712550, 3296790)
if (-not (Test-Path -LiteralPath $dl)) {
  New-Item -ItemType Directory -Force -Path $dl | Out-Null
  $headers = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36' }
  foreach ($id in $appIds) {
    Write-Host "fetch appdetails $id"
    $resp = Invoke-WebRequest -Uri "https://store.steampowered.com/api/appdetails?appids=$id&l=english&cc=us" `
      -Headers $headers -TimeoutSec 40 -UseBasicParsing
    $data = ($resp.Content | ConvertFrom-Json).$id.data
    if (-not $data) { Write-Warning "no data for $id"; continue }

    $jobs = @()
    if ($data.background_raw) { $jobs += @{ n = "$id-bg"; u = $data.background_raw } }
    if ($data.header_image) { $jobs += @{ n = "$id-header"; u = $data.header_image } }
    $i = 0
    foreach ($shot in $data.screenshots) {
      $i++
      if ($i -gt 4) { break }
      $jobs += @{ n = "$id-shot$i"; u = $shot.path_full }
    }

    foreach ($job in $jobs) {
      $ext = [IO.Path]::GetExtension(($job.u -split '\?')[0])
      if (-not $ext) { $ext = '.jpg' }
      Invoke-WebRequest -Uri $job.u -Headers $headers -TimeoutSec 60 `
        -OutFile (Join-Path $dl ($job.n + $ext)) -UseBasicParsing
    }
    Start-Sleep -Seconds 1
  }
}

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }

function Save-Jpeg($bmp, $path, $quality) {
  $ps = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [int64]$quality)
  $bmp.Save($path, $jpegCodec, $ps)
  $ps.Dispose()
}

# 按目标比例裁剪（以 fx/fy 为焦点，取相对坐标 0~1；zoom > 1 表示裁得更紧），再缩放到目标尺寸
function Crop-Fill($srcPath, $dstPath, $tw, $th, $fx, $fy, $quality, $zoom = 1.0) {
  $img = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $targetAspect = $tw / $th
    $srcAspect = $img.Width / $img.Height
    if ($srcAspect -gt $targetAspect) {
      $h = $img.Height
      $w = [int]($h * $targetAspect)
    } else {
      $w = $img.Width
      $h = [int]($w / $targetAspect)
    }
    $w = [int]($w / $zoom)
    $h = [int]($h / $zoom)
    $x = [int][math]::Max(0, [math]::Min($img.Width - $w, $fx * $img.Width - $w / 2))
    $y = [int][math]::Max(0, [math]::Min($img.Height - $h, $fy * $img.Height - $h / 2))

    $bmp = New-Object System.Drawing.Bitmap($tw, $th)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage(
      $img,
      (New-Object System.Drawing.Rectangle(0, 0, $tw, $th)),
      (New-Object System.Drawing.Rectangle($x, $y, $w, $h)),
      [System.Drawing.GraphicsUnit]::Pixel
    )
    Save-Jpeg $bmp $dstPath $quality
    $g.Dispose(); $bmp.Dispose()
    "OK   {0,-28} <- {1}  crop {2}x{3}@{4},{5}" -f (Split-Path $dstPath -Leaf), (Split-Path $srcPath -Leaf), $w, $h, $x, $y
  } finally {
    $img.Dispose()
  }
}

# 等比缩放到指定宽度（用于作品标题图）
function Scale-Width($srcPath, $dstPath, $width, $quality) {
  $img = [System.Drawing.Image]::FromFile($srcPath)
  try {
    $h = [int]($img.Height * $width / $img.Width)
    $bmp = New-Object System.Drawing.Bitmap($width, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $width, $h)
    Save-Jpeg $bmp $dstPath $quality
    $g.Dispose(); $bmp.Dispose()
    "OK   {0,-28} <- {1}  {2}x{3}" -f (Split-Path $dstPath -Leaf), (Split-Path $srcPath -Leaf), $width, $h
  } finally {
    $img.Dispose()
  }
}

# ---- 头像、文章封面、画廊横幅 ----
Crop-Fill "$dl\3296790-shot1.jpg" "$root\avatar.jpg"        512 512 0.45 0.30 88 1.25
Crop-Fill "$dl\3296790-shot2.jpg" "$root\cover-style.jpg"  1200 630 0.50 0.42 86
Crop-Fill "$dl\2258770-bg.jpg"    "$root\cover-news.jpg"   1200 630 0.50 0.45 86
Crop-Fill "$dl\4290390-bg.jpg"    "$root\cover-works.jpg"  1200 630 0.45 0.42 86
Crop-Fill "$dl\858940-bg.jpg"     "$root\banner-gallery.jpg" 1600 520 0.50 0.50 86

# ---- 作品标题图（官方 capsule，460x215）----
$works = @(
  @{ s = '452440-header.jpg';  o = 'flowers-printemps.jpg' },
  @{ s = '858940-header.jpg';  o = 'flowers-ete.jpg' },
  @{ s = '1238730-header.jpg'; o = 'flowers-automne.jpg' },
  @{ s = '1921560-header.jpg'; o = 'flowers-hiver.jpg' },
  @{ s = '4290390-header.jpg'; o = 'cartagra.jpg' },
  @{ s = '965810-header.jpg';  o = 'kara-no-shojo.jpg' },
  @{ s = '2258770-header.jpg'; o = 'shell-1.jpg' },
  @{ s = '2712550-header.jpg'; o = 'shell-2.jpg' },
  @{ s = '3296790-header.jpg'; o = 'shell-3.jpg' }
)
foreach ($w in $works) {
  Scale-Width "$dl\$($w.s)" "$wrk\$($w.o)" 460 90
}

# ---- 画廊（统一裁成 2.25:1 宽银幕，裁掉底部的对话框 UI）----
$gallery = @(
  @{ s = '1921560-shot1.jpg'; o = 'g01.jpg'; fx = 0.50; fy = 0.30 },
  @{ s = '1238730-shot2.jpg'; o = 'g02.jpg'; fx = 0.50; fy = 0.28 },
  @{ s = '1238730-shot4.jpg'; o = 'g03.jpg'; fx = 0.50; fy = 0.28 },
  @{ s = '1921560-shot2.jpg'; o = 'g04.jpg'; fx = 0.50; fy = 0.30 },
  @{ s = '2712550-shot3.jpg'; o = 'g05.jpg'; fx = 0.50; fy = 0.28 },
  @{ s = '2258770-shot1.jpg'; o = 'g06.jpg'; fx = 0.50; fy = 0.30 },
  @{ s = '2258770-shot3.jpg'; o = 'g07.jpg'; fx = 0.50; fy = 0.28 },
  @{ s = '3296790-shot4.jpg'; o = 'g08.jpg'; fx = 0.50; fy = 0.28 },
  @{ s = '3296790-shot3.jpg'; o = 'g09.jpg'; fx = 0.50; fy = 0.32 },
  @{ s = '4290390-shot2.jpg'; o = 'g10.jpg'; fx = 0.50; fy = 0.28 },
  @{ s = '4290390-shot3.jpg'; o = 'g11.jpg'; fx = 0.50; fy = 0.28 },
  @{ s = '965810-shot4.jpg';  o = 'g12.jpg'; fx = 0.50; fy = 0.45 }
)
foreach ($item in $gallery) {
  Crop-Fill "$dl\$($item.s)" "$gal\$($item.o)" 1200 533 $item.fx $item.fy 86
}
