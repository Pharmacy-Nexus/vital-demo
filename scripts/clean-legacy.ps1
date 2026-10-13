# Removes only known obsolete VITAL demo routes and assets left by old commits.
# Run from the repository root after copying the clean release files over it.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$paths = @(
  'app/demo',
  'app/doctor/session',
  'app/id/demo-child-001',
  'components/ui/DemoTag.tsx',
  'data/demo',
  'public/cinematic',
  'docs/archive',
  'README.md',
  'SUPABASE_SETUP.md',
  'V4.8-CAMPAIGN-UPDATE.md',
  'V5-BRAND-RESTRUCTURE.md',
  'V5.1-SHOWCASE-POLISH.md',
  'public/brand/vital-card-black-back.png',
  'public/brand/vital-card-black-front.png',
  'public/brand/vital-card-white-back.png',
  'public/brand/vital-card-white-front.png',
  'public/brand/vital-logo-reference.png',
  'public/campaign/card-lineup.png',
  'public/campaign/card-white-clean.png',
  'tsconfig.tsbuildinfo'
)
foreach ($relativePath in $paths) {
  $target = Join-Path $repoRoot $relativePath
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Force -Recurse
    Write-Host "Removed obsolete: $relativePath"
  }
}
Write-Host "Cleanup complete. Confirm all deletions with 'git status' then commit with 'git add -A'."
