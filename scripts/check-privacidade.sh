#!/bin/bash
# Trava de privacidade: o repositório no GitHub é PÚBLICO e o app lida com processos judiciais.
# Falha se algum arquivo versionado tiver (1) número de processo real ou (2) nome completo de
# parte que esteja hoje no banco. Os nomes vêm do próprio banco na hora, nunca ficam salvos aqui.
cd "$(dirname "$0")/.."
FALHOU=0

# 1) número de processo (CNJ, qualquer justiça: .8. estadual, .5. trabalho, .4. federal...).
#    Compara cada número achado (não a linha inteira) com a lista dos fictícios usados nos testes.
PERMITIDOS='1234567-89.2023.8.09.0051 7654321-00.2025.8.09.0011 1000001-11.2024.8.09.0001 2000002-22.2024.8.09.0002 0000000-00.0000.8.09.0000'
ACHADOS=""
while IFS=: read -r arq lin num; do
  [ -z "$num" ] && continue
  case " $PERMITIDOS " in *" $num "*) continue;; esac
  ACHADOS="$ACHADOS\n  $arq:$lin  $num"
done < <(git ls-files -z | xargs -0 grep -I -n -o -E '[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}' 2>/dev/null | grep -v 'package-lock.json' || true)
if [ -n "$ACHADOS" ]; then echo "❌ número de processo real em arquivo versionado:"; printf "$ACHADOS\n"; FALHOU=1; fi

# 2) nomes completos das partes (consulta o banco agora; uma única passada em Python)
URL=$(security find-generic-password -a "$USER" -s supabase-pericias-gabi-url -w 2>/dev/null)
KEY=$(security find-generic-password -a "$USER" -s supabase-pericias-gabi-secret-key -w 2>/dev/null)
if [ -z "$URL" ] || [ -z "$KEY" ]; then echo "❌ não consegui ler as chaves do Keychain para checar nomes"; exit 1; fi
curl -s "$URL/rest/v1/pericias?select=polo_ativo,polo_passivo" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" > /tmp/pericias-partes.json
python3 - <<'PY' || FALHOU=1
import json,re,subprocess,sys,unicodedata
def n(s): return ' '.join(unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().split())
EMPRESA=re.compile(r'\b(banco|caixa|cooperativa|credito|financeira|financiamento|s\.?a\.?|ltda|bradesco|itau|santander|sicoob|sicredi|bv|aymore|omni|crefisa|seguros?|previdencia|consorcio|instituto|municipio|estado|uniao)\b')
nomes=set()
for r in json.load(open('/tmp/pericias-partes.json')):
    for k in ('polo_ativo','polo_passivo'):
        v=n(r.get(k) or '')
        if len(v.split())>=2 and not EMPRESA.search(v): nomes.add(v)
arqs=subprocess.run(['git','ls-files'],capture_output=True,text=True).stdout.split('\n')
ruim=0
for a in arqs:
    if not a or re.search(r'package-lock\.json|\.(png|ico|jpe?g|docx|pdf)$',a): continue
    try: t=n(open(a,encoding='utf-8').read())
    except Exception: continue
    for nome in nomes:
        if nome in t: print('❌ nome completo de parte em',a); ruim=1; break
sys.exit(ruim)
PY
rm -f /tmp/pericias-partes.json
[ "$FALHOU" = 0 ] && echo "✅ privacidade: nenhum número de processo real nem nome completo de parte nos arquivos versionados"
exit $FALHOU
