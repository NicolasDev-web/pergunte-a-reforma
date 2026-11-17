#!/usr/bin/env bash
# Teste de fumaça do motor: sobe? calcula o exemplo oficial (docs/exemplos.md do repo da Receita) com os valores documentados?
# Uso: engine/smoke.sh [URL_BASE]   (padrão http://localhost:8080/api)
set -euo pipefail
BASE="${1:-http://localhost:8080/api}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "→ aguardando o motor em $BASE"
for i in $(seq 1 60); do
  curl -fsS "$BASE/calculadora/dados-abertos/versao" >/dev/null 2>&1 && break
  sleep 2
  [ "$i" = 60 ] && { echo "✗ motor não respondeu"; exit 1; }
done
echo "  versão: $(curl -fsS "$BASE/calculadora/dados-abertos/versao")"

T0=$(date +%s%N)
RESP=$(curl -fsS -X POST "$BASE/calculadora/observabilidade/regime-geral" \
  -H 'Content-Type: application/json' -d @"$DIR/exemplos/operacao-oficial.json")
MS=$(( ($(date +%s%N) - T0) / 1000000 ))

check() { # descrição, filtro jq, esperado
  local got; got=$(echo "$RESP" | jq -r "$2")
  if [ "$got" = "$3" ]; then echo "  ✓ $1 = $got"; else echo "  ✗ $1: esperado $3, veio $got"; FALHOU=1; fi
}
FALHOU=0
echo "→ exemplo oficial (${MS} ms)"
check "item 3 (educação) vCBS"       '.objetos[2].tribCalc.IBSCBS.gIBSCBS.gCBS.vCBS' "42.24"
check "item 3 (educação) redução"    '.objetos[2].tribCalc.IBSCBS.gIBSCBS.gCBS.gRed.pRedAliq' "60.00"
check "item 3 (educação) vIBS"       '.objetos[2].tribCalc.IBSCBS.gIBSCBS.vIBS' "0.48"
check "item 4 erro"                  '.objetos[3].erros[0].code' "REG-011"
check "total vCBS"                   '.total.tribCalc.IBSCBSTot.gCBS.vCBS' "56.76"
check "total vIBS"                   '.total.tribCalc.IBSCBSTot.gIBS.vIBS' "0.64"
check "total vIS"                    '.total.tribCalc.ISTot.vIS' "15.00"
echo "$RESP" > "${SMOKE_SAIDA:-/tmp/rtc-smoke.json}"
[ "$FALHOU" = 0 ] && echo "✓ motor ok" || { echo "✗ divergência com a documentação oficial"; exit 1; }
