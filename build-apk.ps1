# 一键构建「四级背单词」APK
# 用法：在 PowerShell 里执行  .\build-apk.ps1
#
# 依赖（全部免安装，放在 D:\devtools）：
#   D:\devtools\jdk-17              JDK 17
#   D:\devtools\android-sdk         Android SDK
#   D:\devtools\gradle-8.7          Gradle
#   D:\devtools\gradle-home         Gradle 依赖缓存（不占 C 盘）

param(
    [switch]$Release,  # 传 -Release 出 release 包，默认 debug 包
    [switch]$NoDict    # 传 -NoDict 出「发布版」（不含词库，避免版权风险）；不传 = 私用版（含词库）
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:JAVA_HOME       = "D:\devtools\jdk-17"
$env:ANDROID_HOME    = "D:\devtools\android-sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = "D:\devtools\gradle-home"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

# 依赖走阿里云国内镜像，必须清掉可能存在的全局代理环境变量（否则国内镜像会被绕进 VPN，反而更慢）
$env:HTTP_PROXY = ""
$env:HTTPS_PROXY = ""
$env:ALL_PROXY = ""
$env:http_proxy = ""
$env:https_proxy = ""

$gradle = "D:\devtools\gradle-8.7\bin\gradle.bat"
if (-not (Test-Path $gradle)) {
    throw "找不到 Gradle：$gradle"
}
if (-not (Test-Path $env:JAVA_HOME)) {
    throw "找不到 JDK：$env:JAVA_HOME"
}
if (-not (Test-Path $env:ANDROID_HOME)) {
    throw "找不到 Android SDK：$env:ANDROID_HOME"
}

$task = if ($Release) { "assembleRelease" } else { "assembleDebug" }

# 发布版：构建前临时移走词库文件（避免把版权受限数据打进 APK）
$dataDir   = Join-Path $root "app\src\main\assets\www\data"
$backupDir = Join-Path $root "tools\tmp\dict-backup"
$dictFiles = @("cet4.js", "cet6.js", "cet4_core.js")
if ($NoDict) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    foreach ($f in $dictFiles) {
        $src = Join-Path $dataDir $f
        if (Test-Path $src) { Move-Item $src (Join-Path $backupDir $f) -Force }
    }
}

$label = if ($NoDict) { "发布版（不含词库）" } else { "私用版（含词库）" }
Write-Host "==> 开始构建 ($task · $label)" -ForegroundColor Cyan
Push-Location $root
try {
    & $gradle $task
    if ($LASTEXITCODE -ne 0) { throw "Gradle 构建失败，退出码 $LASTEXITCODE" }
}
finally {
    # 恢复词库文件
    if ($NoDict) {
        foreach ($f in $dictFiles) {
            $bak = Join-Path $backupDir $f
            if (Test-Path $bak) { Move-Item $bak (Join-Path $dataDir $f) -Force }
        }
    }
    Pop-Location
}

$outDir = Join-Path $root "app\build\outputs\apk"
$apk = Get-ChildItem $outDir -Recurse -Filter "*.apk" |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($apk) {
    Write-Host ""
    Write-Host "==> 构建成功" -ForegroundColor Green
    Write-Host "    APK : $($apk.FullName)"
    Write-Host "    大小: $([math]::Round($apk.Length/1MB,2)) MB"
} else {
    throw "没找到产物 APK，检查 $outDir"
}
