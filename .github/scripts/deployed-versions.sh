#!/usr/bin/env bash
# Rewrites the "Deployed versions" table in a README from deploy.auto.tfvars of the
# prometheon-emobility-<env> repositories, the source of truth for what is rolled out.
#
# Usage: deployed-versions.sh <tfvars key> <deploy commit label> <readme>
#   tfvars key           variable holding this app's version, e.g. backend_app_version
#   deploy commit label  text in the "chore(deploy): ..." commits that bump it, used to
#                        find when the version was set, e.g. "deploy backend"
#
# Needs GH_TOKEN with read access to the three environment repositories, and
# GITHUB_REPOSITORY (owner/repo of this app) for the release and commit links.
set -euo pipefail

key=$1
label=$2
readme=$3
org=SFOE-Prometheon
app_url="https://github.com/${GITHUB_REPOSITORY:?}"
start='<!-- deployed-versions:start -->'
end='<!-- deployed-versions:end -->'

table=$'| Environment | Version | Since (UTC) |\n|---|---|---|'
for env in dev test prod; do
  env_repo="prometheon-emobility-${env}"
  env_link="[${env}](https://github.com/${org}/${env_repo}/blob/main/deploy.auto.tfvars)"
  tfvars=$(gh api "repos/${org}/${env_repo}/contents/deploy.auto.tfvars" \
    -H "Accept: application/vnd.github.raw")
  version=$(sed -nE "s/^${key}[[:space:]]*=[[:space:]]*\"([^\"]*)\".*/\1/p" <<<"$tfvars" | head -n 1)

  if [ -z "$version" ]; then
    table+=$'\n'"| ${env_link} | – | |"
    continue
  fi
  if [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    version_link="[${version}](${app_url}/releases/tag/${version})"
  else
    version_link="[\`${version}\`](${app_url}/commit/${version})"
  fi
  # Newest deploy commit of this app that names this version. Empty if it was set
  # some other way, e.g. by hand.
  since=$(gh api "repos/${org}/${env_repo}/commits?path=deploy.auto.tfvars&per_page=100" \
    --jq "[.[] | select((.commit.message | contains(\"${label}\")) and (.commit.message | contains(\"${version}\")))][0].commit.committer.date // \"\" | sub(\"T\"; \" \") | .[0:16]")
  table+=$'\n'"| ${env_link} | ${version_link} | ${since} |"
done

grep -qF "$start" "$readme" && grep -qF "$end" "$readme" || {
  echo "::error::${readme} has no ${start} ... ${end} block"
  exit 1
}
TABLE="$table" awk -v start="$start" -v end="$end" '
  $0 == start { print; print ""; print ENVIRON["TABLE"]; print ""; skip = 1; next }
  $0 == end   { skip = 0 }
  !skip
' "$readme" > "${readme}.tmp"
mv "${readme}.tmp" "$readme"
