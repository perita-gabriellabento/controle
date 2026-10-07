#!/bin/bash
# ÚNICO caminho para publicar o Controle de Perícias. Não existe flag para pular trava.
# Uso:  scripts/deploy.sh "mensagem curta do que mudou"        (publica)
#       scripts/deploy.sh --dry-run "mensagem"                 (roda todas as travas e para antes de publicar)
# Padrão Bia: árvore limpa -> privacidade -> tsc -> suíte -> build -> backup do banco -> push GitHub
#             -> Vercel -> conferência no ar -> tag deploy-AAAAMMDD-HHMM.
# Auditoria independente (2 revisores) antes de publicar é regra do CLAUDE.md e é feita ANTES deste script.
set -euo pipefail
cd "$(dirname "$0")/.."
DRY=0; [ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
MSG="${1:-}"; [ -z "$MSG" ] && { echo "Informe a mensagem do deploy. Ex.: scripts/deploy.sh \"fase Revogado\""; exit 1; }
passo() { echo; echo "━━ $1"; }
STAMP=$(date +%Y%m%d-%H%M)
umask 077
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "❌ publique sempre a partir da branch main"; exit 1; }

# A suíte roda contra o banco de PRODUÇÃO: se cair no meio, apaga as linhas TEST-* que ela deixou
# (nenhum processo real tem número começando por "TEST-").
limpar_testes() {
  local u k
  u=$(security find-generic-password -a "$USER" -s supabase-pericias-gabi-url -w 2>/dev/null) || return 0
  k=$(security find-generic-password -a "$USER" -s supabase-pericias-gabi-secret-key -w 2>/dev/null) || return 0
  curl -s -X DELETE "$u/rest/v1/pericias?numero_processo=like.TEST-*" -H "apikey: $k" -H "Authorization: Bearer $k" >/dev/null || true
}
trap limpar_testes EXIT

passo "1/9 árvore limpa (código versionado)"
SUJO=$(git status --porcelain | grep -v 'tsconfig.tsbuildinfo' || true)
[ -n "$SUJO" ] && { echo "❌ há mudanças sem commit:"; echo "$SUJO"; echo "Faça commit antes de publicar."; exit 1; }
echo "ok"

passo "2/9 privacidade (repositório público)"
bash scripts/check-privacidade.sh

passo "3/9 tipos (tsc)"
npx tsc --noEmit && echo "ok"

passo "4/9 suíte de testes (npm run test:db)"
npm run test:db

passo "5/9 build de produção"
npm run build >/tmp/pericias-build.log 2>&1 || { tail -30 /tmp/pericias-build.log; echo "❌ build falhou"; exit 1; }
echo "ok"

if [ "$DRY" = 1 ]; then echo; echo "✅ DRY-RUN: todas as travas passaram. Nada foi publicado."; exit 0; fi

passo "6/9 backup do banco (backups/$STAMP)"
URL=$(security find-generic-password -a "$USER" -s supabase-pericias-gabi-url -w)
KEY=$(security find-generic-password -a "$USER" -s supabase-pericias-gabi-secret-key -w)
mkdir -p "backups/$STAMP"
for t in pericias checklist_items pericia_checklist_done fase_prazos pericia_anexos; do
  # Range explícito: sem ele o PostgREST corta em 1000 linhas e o backup truncaria em silêncio.
  curl -sf "$URL/rest/v1/$t?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Range-Unit: items" -H "Range: 0-49999" > "backups/$STAMP/$t.json" || { echo "❌ backup de $t falhou"; exit 1; }
done
python3 - "$STAMP" <<'PY'
import json,sys
for t in ['pericias','checklist_items','pericia_checklist_done','fase_prazos','pericia_anexos']:
    print(' ',t,len(json.load(open(f'backups/{sys.argv[1]}/{t}.json'))),'linhas')
PY

passo "7/9 GitHub (código na nuvem)"
GH=$(security find-internet-password -s github.com -a perita-gabriellabento -w)
git push "https://perita-gabriellabento:${GH}@github.com/perita-gabriellabento/controle.git" main 2>&1 | sed "s/${GH}/***/g"

passo "8/9 Vercel (produção)"
VT=$(security find-generic-password -a "$USER" -s vercel-pericias-gabi-token -w)
npx vercel --prod --yes --token "$VT" > /tmp/pericias-vercel.log 2>&1 || { sed "s/${VT}/***/g" /tmp/pericias-vercel.log | tail -20; rm -f /tmp/pericias-vercel.log; echo "❌ deploy no Vercel falhou"; exit 1; }
DEPLOY_HOST=$(grep -o 'controle-pericias-[a-z0-9]*-pericias-gabriella\.vercel\.app' /tmp/pericias-vercel.log | head -1)
rm -f /tmp/pericias-vercel.log
[ -n "$DEPLOY_HOST" ] || { echo "❌ não achei o endereço do deploy novo na saída do Vercel"; exit 1; }
echo "deploy novo: $DEPLOY_HOST"

passo "9/9 conferência no ar"
PRONTO=0
for i in $(seq 1 15); do
  if npx vercel ls --token "$VT" 2>&1 | grep -F "$DEPLOY_HOST" | grep -q "Ready"; then PRONTO=1; break; fi
  sleep 8
done
[ "$PRONTO" = 1 ] || { echo "❌ o deploy $DEPLOY_HOST não ficou Ready. Reverter: npx vercel rollback"; exit 1; }
CODE=$(curl -s -o /dev/null -w "%{http_code}" https://gabriellabento.com.br/)
DASH=$(curl -s -o /dev/null -w "%{http_code}" https://gabriellabento.com.br/dashboard)
NOVO=$(curl -s -o /dev/null -w "%{http_code}" "https://$DEPLOY_HOST/")
echo "domínio: $CODE | dashboard: $DASH | deploy novo direto: $NOVO"
[ "$CODE" = 200 ] && [ "$DASH" = 200 ] && [ "$NOVO" = 200 ] || { echo "❌ resposta inesperada depois do deploy. Reverter: npx vercel rollback"; exit 1; }

TAG="deploy-$STAMP"
git tag -a "$TAG" -m "$MSG"
git push "https://perita-gabriellabento:${GH}@github.com/perita-gabriellabento/controle.git" "$TAG" 2>&1 | sed "s/${GH}/***/g" || true
echo; echo "✅ publicado: $TAG — $MSG"
