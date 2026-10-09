# Local preview server. Listens on 127.0.0.1 only.
# Stop with Ctrl+C (foreground) or by killing the process.
$root = 'C:\Users\doctor\azure-blog'
$port = 8080

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.xml'  = 'application/xml; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
}

function Send-Text($stream, $text) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($text)
  $stream.Write($bytes, 0, $bytes.Length)
}

function Send-File($stream, $statusLine, $contentType, $bytes) {
  $header = "$statusLine`r`n" +
    "Content-Type: $contentType`r`n" +
    "Content-Length: $($bytes.Length)`r`n" +
    "Cache-Control: no-store`r`n" +
    "Connection: close`r`n`r`n"
  Send-Text $stream $header
  if ($bytes.Length -gt 0) {
    $stream.Write($bytes, 0, $bytes.Length)
  }
}

$v4 = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $port)
$v6 = $null
try {
  $v6 = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::IPv6Loopback, $port)
  $v6.Start()
} catch {
  # IPv6 loopback unavailable; fall back to IPv4 only
}
$v4.Start()
Write-Host ("Serving at http://localhost:{0}  (Ctrl+C to stop)" -f $port)

while ($true) {
  $client = $null
  if ($null -ne $v6 -and $v6.Pending()) {
    $client = $v6.AcceptTcpClient()
  } elseif ($v4.Pending()) {
    $client = $v4.AcceptTcpClient()
  } else {
    Start-Sleep -Milliseconds 25
    continue
  }
  try {
    $stream = $client.GetStream()
    $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::UTF8)

    # Request line, then skip headers (headers end with an empty line)
    $requestLine = $reader.ReadLine()
    while ($reader.ReadLine() -notmatch '^\s*$') { }

    if ($requestLine -match '^GET\s+(\S+)') {
      $rawPath = $Matches[1]
      $path = [uri]::UnescapeDataString(($rawPath -split '\?')[0]).TrimStart('/')
      if ($path -eq '') { $path = 'index.html' }

      $full = [IO.Path]::GetFullPath((Join-Path $root ($path -replace '/', '\')))
      # Prevent path traversal: resolved path must stay inside the site root
      if (-not $full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) {
        Send-File $stream 'HTTP/1.1 403 Forbidden' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('403 Forbidden'))
        continue
      }
      if ((Test-Path -LiteralPath $full -PathType Container) -and (Test-Path -LiteralPath (Join-Path $full 'index.html'))) {
        $full = Join-Path $full 'index.html'
      }
      if (Test-Path -LiteralPath $full -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        Send-File $stream 'HTTP/1.1 200 OK' $type ([IO.File]::ReadAllBytes($full))
      } else {
        $body = '<h1>404 Not Found</h1><p>' + $path + '</p>'
        Send-File $stream 'HTTP/1.1 404 Not Found' 'text/html; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($body))
      }
    } else {
      Send-File $stream 'HTTP/1.1 400 Bad Request' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('400 Bad Request'))
    }
  } catch {
    # Ignore read errors on a single connection
  } finally {
    $client.Close()
  }
}
