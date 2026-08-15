$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$failures = New-Object System.Collections.Generic.List[string]

$requiredFiles = @(
    'AGENTS.md',
    'LESSONS.md',
    'AGENT_MEMORY.md',
    'CLAUDE.md',
    '.agents\README.md',
    'README.md',
    '.gitignore',
    '.env.example',
    '.editorconfig',
    '.markdownlint.json',
    'LICENSE',
    'SECURITY.md',
    'docs\requirements.md',
    'docs\design.md',
    'docs\hackathon.md',
    'docs\data-sources.md',
    'docs\security.md',
    'docs\agent-workflow.md',
    'docs\planning\tasks.md',
    'docs\superpowers\plans\2026-08-16-repository-agentic-workflow-setup.md'
)

foreach ($relativePath in $requiredFiles) {
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -Path $path -PathType Leaf)) {
        $failures.Add("Missing required file: $relativePath")
    }
}
$agentsPath = Join-Path $root 'AGENTS.md'
$lessonsPath = Join-Path $root 'LESSONS.md'
$envExamplePath = Join-Path $root '.env.example'
$gitignorePath = Join-Path $root '.gitignore'

if (Test-Path -Path $agentsPath) {
    $agents = Get-Content -Path $agentsPath -Raw
    if ($agents -notmatch 'LESSONS\.md.*first manual project file read') {
        $failures.Add('AGENTS.md does not enforce LESSONS.md as the first manual project read.')
    }
}

if (Test-Path -Path $lessonsPath) {
    $lessons = Get-Content -Path $lessonsPath -Raw
    if ($lessons -notmatch 'MANDATORY READ RULE') {
        $failures.Add('LESSONS.md is missing its mandatory-read marker.')
    }
}

if (Test-Path -Path $gitignorePath) {
    $gitignore = Get-Content -Path $gitignorePath
    foreach ($requiredPattern in @('.env', '.env.*', '!.env.example')) {
        if ($gitignore -notcontains $requiredPattern) {
            $failures.Add(".gitignore is missing required pattern: $requiredPattern")
        }
    }
}
if (Test-Path -Path $envExamplePath) {
    $envExample = Get-Content -Path $envExamplePath
    $serverOnlyKeys = @(
        'SUPABASE_SERVICE_ROLE_KEY',
        'GEMINI_API_KEY',
        'TAVILY_API_KEY',
        'COLLEGE_SCORECARD_API_KEY'
    )

    foreach ($key in $serverOnlyKeys) {
        $line = $envExample | Where-Object { $_ -like "$key=*" } | Select-Object -First 1
        if ($null -eq $line) {
            $failures.Add(".env.example is missing server-only key: $key")
        } elseif ($line -ne "$key=") {
            $failures.Add(".env.example must not contain a value for: $key")
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Output 'UniProof workspace verification: FAILED'
    foreach ($failure in $failures) {
        Write-Output "- $failure"
    }
    exit 1
}

$gitState = if (Test-Path -Path (Join-Path $root '.git')) { 'initialized' } else { 'not initialized' }
Write-Output 'UniProof workspace verification: PASSED'
Write-Output "Required files: $($requiredFiles.Count)"
Write-Output "Git repository: $gitState"
exit 0
