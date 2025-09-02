$sql = Join-Path $PSScriptRoot 'demo_venta.sql'
$user = $env:DB_USER; if (-not $user) { $user = 'APP_PYME' }
$pass = $env:DB_PASSWORD; if (-not $pass) { $pass = 'change_me' }
$conn = $env:DB_CONNECT_STRING; if (-not $conn) { $conn = '//localhost:1521/XEPDB1' }
& sqlplus "$user/$pass@$conn" "@$sql"

