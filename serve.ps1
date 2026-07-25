<#
  Geopals - minimal static web server.

  Serves this folder over http://localhost:8080 so the site runs the way GitHub
  Pages will serve it, rather than off file:// URLs.

  Built on a raw TcpListener on purpose: HttpListener needs a URL ACL
  reservation (an admin step) while this needs no permissions and no installs -
  no Node, no Python, nothing but Windows PowerShell.

  Usage:
      powershell -ExecutionPolicy Bypass -File serve.ps1
      powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 3000

  Stop it with Ctrl+C.

  NOTE: keep this file ASCII-only (PowerShell 5.1 reads .ps1 as ANSI).
#>
[CmdletBinding()]
param(
  [int]$Port = 8080,
  [string]$Root = ''
)

$ErrorActionPreference = 'Stop'

if (-not $Root) { $Root = Split-Path -Parent $MyInvocation.MyCommand.Path }
$Root = (Resolve-Path $Root).Path

$MIME = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'
  '.css' ='text/css; charset=utf-8';  '.js' ='text/javascript; charset=utf-8'
  '.json'='application/json; charset=utf-8'; '.txt'='text/plain; charset=utf-8'
  '.svg' ='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'
  '.jpeg'='image/jpeg';    '.gif'='image/gif'; '.webp'='image/webp'
  '.ico'='image/x-icon';   '.woff'='font/woff'; '.woff2'='font/woff2'
  '.mp4'='video/mp4';      '.m4v'='video/mp4';  '.webm'='video/webm'
  '.pdf'='application/pdf'
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() }
catch { throw "Could not listen on port $Port. Is something already using it? ($($_.Exception.Message))" }

Write-Host ""
Write-Host "  Geopals dev server" -ForegroundColor Green
Write-Host "  Serving : $Root"
Write-Host "  Address : http://localhost:$Port/"
Write-Host "  Stop    : Ctrl+C"
Write-Host ""

function Send-Response {
  param($Stream, [int]$Status, [string]$StatusText, [string]$ContentType, [byte[]]$Body)
  $head = "HTTP/1.1 $Status $StatusText`r`n" +
          "Content-Type: $ContentType`r`n" +
          "Content-Length: $($Body.Length)`r`n" +
          "Cache-Control: no-cache`r`n" +
          "Connection: close`r`n`r`n"
  $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
  $Stream.Write($headBytes, 0, $headBytes.Length)
  if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
  $Stream.Flush()
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $stream = $client.GetStream()

      # Read just the request head - everything up to the blank line.
      $buffer = New-Object byte[] 8192
      $text = ''
      do {
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) { break }
        $text += [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
      } while ($stream.DataAvailable -and $text -notmatch "`r`n`r`n")

      if ($text -notmatch '^(GET|HEAD)\s+(\S+)') {
        Send-Response $stream 405 'Method Not Allowed' 'text/plain' ([byte[]]@())
        continue
      }
      $rawPath = $Matches[2]

      # Drop the query string, then decode percent-escapes.
      $path = ($rawPath -split '\?')[0]
      $path = [System.Uri]::UnescapeDataString($path)
      if ($path.EndsWith('/')) { $path += 'index.html' }
      $relative = $path.TrimStart('/') -replace '/', '\'

      $target = Join-Path $Root $relative
      # Refuse anything that resolves outside the served folder.
      $fullTarget = [System.IO.Path]::GetFullPath($target)
      if (-not $fullTarget.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
        Send-Response $stream 403 'Forbidden' 'text/plain; charset=utf-8' `
          ([System.Text.Encoding]::UTF8.GetBytes('403 Forbidden'))
        Write-Host ("  403  " + $path) -ForegroundColor Red
        continue
      }

      if (Test-Path $fullTarget -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($fullTarget).ToLower()
        $type = $MIME[$ext]
        if (-not $type) { $type = 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($fullTarget)
        Send-Response $stream 200 'OK' $type $bytes
        Write-Host ("  200  {0,-52} {1,8:N0} B" -f $path, $bytes.Length) -ForegroundColor DarkGray
      } else {
        # Escape by hand - System.Web is not loaded by default in PowerShell.
        $safe = $path -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;'
        $body = [System.Text.Encoding]::UTF8.GetBytes("<h1>404</h1><p>Not found: $safe</p>")
        Send-Response $stream 404 'Not Found' 'text/html; charset=utf-8' $body
        Write-Host ("  404  " + $path) -ForegroundColor Yellow
      }
    }
    catch { Write-Host "  error: $($_.Exception.Message)" -ForegroundColor Red }
    finally { $client.Close() }
  }
}
finally {
  $listener.Stop()
  Write-Host "`n  Server stopped." -ForegroundColor Yellow
}
