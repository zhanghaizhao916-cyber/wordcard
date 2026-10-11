# 一键构建「四级背单词」APK
# 用法：在 PowerShell 里执行  .\build-apk.ps1
#
# 依赖（全部免安装，放在 D:\devtools）：
#   D:\devtools\jdk-17              JDK 17
#   D:\devtools\android-sdk         Android SDK
#   D:\devtools\gradle-8.7          Gradle
#   D:\devtools\gradle-home         Gradle 依赖缓存（不占 C 盘）

param(
    [switch]$Release   # 传 -Release 出 release 包，默认 debug 包
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

Write-Host "==> 开始构建 ($task)" -ForegroundColor Cyan
Push-Location $root
try {
    & $gradle $task
    if ($LASTEXITCODE -ne 0) { throw "Gradle 构建失败，退出码 $LASTEXITCODE" }
}
finally {
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
