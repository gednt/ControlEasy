<#
.SYNOPSIS
    scripts/hooks/verify-ci-agent-stop.ps1 — Agent Stop lifecycle hook (PowerShell / Windows).
#>

$ErrorActionPreference = "SilentlyContinue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
Set-Location $repoRoot

$inputRaw = ""
if ([System.Console]::IsInputRedirected) {
    $inputRaw = [System.Console]::In.ReadToEnd()
}

$inputJson = $null
if ($inputRaw) {
    try {
        $inputJson = $inputRaw | ConvertFrom-Json -ErrorAction SilentlyContinue
    } catch {}
}

# Recursion guard
if ($inputJson -and $inputJson.stop_hook_active -eq $true) {
    Write-Output "{}"
    exit 0
}

$gitDir = git rev-parse --absolute-git-dir 2>$null
if (-not $gitDir) { $gitDir = Join-Path $repoRoot ".git" }
$stampFile = Join-Path $gitDir "ci-local-passed.stamp"
$fastStampFile = Join-Path $gitDir "ci-local-fast-passed.stamp"

$isDirty = [bool](git status --porcelain 2>$null)
$isAhead = $false

$baseRef = $null
if (git rev-parse --verify "origin/main" 2>$null) {
    $baseRef = "origin/main"
} elseif (git rev-parse --verify "main" 2>$null) {
    $baseRef = "main"
} elseif (git rev-parse --verify "origin/HEAD" 2>$null) {
    $baseRef = "origin/HEAD"
}

if ($baseRef) {
    $commitsAhead = git rev-list "$baseRef..HEAD" --count 2>$null
    if ($commitsAhead -and [int]$commitsAhead -gt 0) {
        $isAhead = $true
    }
} else {
    if (git rev-parse --verify HEAD 2>$null) {
        $isAhead = $true
    }
}

if (-not $isDirty -and -not $isAhead) {
    Write-Output "{}"
    exit 0
}

function Get-Sha256String([string]$text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $hasher.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
    } finally {
        $hasher.Dispose()
    }
}

function Test-CompletedAllTasks {
    if ($env:CE_TASK_COMPLETE -eq "true" -or $env:FULL_CI -eq "true") {
        return $true
    }
    $diffFiles = git diff --name-only HEAD 2>$null
    $statusFiles = git status --porcelain=v1 -uall 2>$null | ForEach-Object { ($_ -split '\s+')[-1] }
    $allFiles = @($diffFiles) + @($statusFiles) | Where-Object { $_ -match 'tasks\.md|\.specs[\\/].*tasks.*\.md' } | Select-Object -Unique
    if (-not $allFiles) { return $false }

    $foundTask = $false
    foreach ($file in $allFiles) {
        if (Test-Path $file) {
            $content = Get-Content -Path $file -Raw 2>$null
            if ($content -match '(?m)^-\s+\[[xX]\]') {
                $foundTask = $true
                if ($content -match '(?m)^-\s+\[\s\]') {
                    return $false
                }
            }
        }
    }
    return $foundTask
}

function Invoke-LocalCiVerify([string[]]$extraArgs) {
    # If the host already has CE_ITEST_MYSQL set, propagate it. Otherwise,
    # auto-detect a developer-local MySQL on the standard test port and
    # set CE_ITEST_MYSQL ourselves so integration tests can use it
    # instead of Testcontainers (Docker-in-Docker is unreliable on Windows).
    # The SDK container (running inside Docker Desktop on Windows) must
    # reach MySQL via host.docker.internal:3306 because localhost inside
    # the container points to its own loopback.
    if (-not $env:CE_ITEST_MYSQL) {
        $portOpen = $false
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $iar = $client.BeginConnect("localhost", 3306, $null, $null)
            $portOpen = $iar.AsyncWaitHandle.WaitOne(500, $false) -and $client.Connected
            $client.Close()
        } catch {}
        if ($portOpen) {
            $env:CE_ITEST_MYSQL = "host.docker.internal:3306"
        }
    }
    $pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($pwshCmd) {
        $output = & pwsh -File $verifyScript @extraArgs 2>&1
        $code = $LASTEXITCODE
    } else {
        $psCmd = Get-Command powershell -ErrorAction SilentlyContinue
        if ($psCmd) {
            $output = & powershell -ExecutionPolicy Bypass -File $verifyScript @extraArgs 2>&1
            $code = $LASTEXITCODE
        } else {
            $output = & $verifyScript @extraArgs 2>&1
            $code = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { [int](-not $?) }
        }
    }
    return [PSCustomObject]@{ Output = $output; ExitCode = $code }
}

$headSha = git rev-parse HEAD 2>$null
if (-not $headSha) { $headSha = "none" }
$diffText = git diff HEAD 2>$null | Out-String
$diffHash = Get-Sha256String $diffText
$statusText = git status --porcelain=v1 -uall 2>$null | Out-String
$statusHash = Get-Sha256String $statusText
$expectedPrefix = "$headSha`:$diffHash`:$statusHash"

$verifyScript = Join-Path $repoRoot "scripts\verify-ci-local.ps1"
$verifyOutput = $null

if ($isDirty) {
    $taskComplete = Test-CompletedAllTasks
    if ($taskComplete) {
        # Task completion indicated: full CI required even if dirty
        if (Test-Path $stampFile) {
            $stampContent = (Get-Content -Path $stampFile -TotalCount 1 2>$null)
            if ($stampContent -and $stampContent.StartsWith($expectedPrefix)) {
                Write-Output "{}"
                exit 0
            }
        }
        $res = Invoke-LocalCiVerify @()
        $verifyOutput = $res.Output
        if ($res.ExitCode -eq 0) {
            Write-Output "{}"
            exit 0
        }
    } else {
        # Active editing / intermediate turn: fast checks only (zero Docker downloads)
        if (Test-Path $fastStampFile) {
            $fastContent = (Get-Content -Path $fastStampFile -TotalCount 1 2>$null)
            if ($fastContent -and $fastContent.StartsWith($expectedPrefix)) {
                Write-Output "{}"
                exit 0
            }
        }
        if (Test-Path $stampFile) {
            $stampContent = (Get-Content -Path $stampFile -TotalCount 1 2>$null)
            if ($stampContent -and $stampContent.StartsWith($expectedPrefix)) {
                Write-Output "{}"
                exit 0
            }
        }

        $res = Invoke-LocalCiVerify @("-Fast")
        $verifyOutput = $res.Output
        if ($res.ExitCode -eq 0) {
            Write-Output "{}"
            exit 0
        }
    }
} else {
    # Working tree clean and commits ahead: task completion / end of all tasks completion
    if (Test-Path $stampFile) {
        $stampContent = (Get-Content -Path $stampFile -TotalCount 1 2>$null)
        if ($stampContent -and $stampContent.StartsWith($expectedPrefix)) {
            Write-Output "{}"
            exit 0
        }

        # Check commit rollover: was the committed diff verified in a full CI pass before commit?
        if ($stampContent) {
            $parts = $stampContent -split ':'
            if ($parts.Length -ge 3) {
                $stampHead = $parts[0]
                $stampDiff = $parts[1]
                if ($stampHead -and $stampHead -ne "none" -and $stampDiff) {
                    git merge-base --is-ancestor $stampHead HEAD 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        $committedDiffText = git diff "$stampHead..HEAD" 2>$null | Out-String
                        $committedDiffHash = Get-Sha256String $committedDiffText
                        if ($committedDiffHash -eq $stampDiff) {
                            $newStamp = "$headSha`:$diffHash`:$statusHash`:$(Get-Date -AsUTC -Format o)"
                            Set-Content -Path $stampFile -Value $newStamp
                            Set-Content -Path $fastStampFile -Value $newStamp
                            Write-Output "{}"
                            exit 0
                        }
                    }
                }
            }
        }
    }

    # Run full verification gate once per task completion
    $res = Invoke-LocalCiVerify @()
    $verifyOutput = $res.Output
    if ($res.ExitCode -eq 0) {
        Write-Output "{}"
        exit 0
    }
}

$lastLines = ($verifyOutput | Select-Object -Last 25 | Out-String)
$reason = "MANDATORY LOCAL CI GATE FAILED: Local CI verification jobs failed. Per project rules, an agent MUST NOT consider any modification done until all local CI jobs pass. Please fix: $lastLines"

$isAntigravity = ($inputJson -and ($inputJson.terminationReason -or $inputJson.artifactDirectoryPath))
$decision = if ($isAntigravity) { "continue" } else { "block" }

$response = @{
    decision = $decision
    reason = $reason
}

$response | ConvertTo-Json -Compress

if ($isAntigravity) {
    exit 0
} else {
    exit 2
}
