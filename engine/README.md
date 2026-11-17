# engine — motor oficial da Calculadora RTC

Empacota [ReceitaFederal/calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) **sem modificações**, numa versão fixada (`RTC_REF`, hoje `1.6.1`).

## Local
```bash
docker build -t rtc-engine engine/
docker run -p 8080:8080 rtc-engine
curl localhost:8080/api/calculadora/dados-abertos/versao
```

## Cloud Run (manual, alternativa ao workflow)
```bash
gcloud builds submit engine/ --tag southamerica-east1-docker.pkg.dev/$PROJETO/reforma/rtc-engine:1.6.1
gcloud run deploy rtc-engine \
  --image southamerica-east1-docker.pkg.dev/$PROJETO/reforma/rtc-engine:1.6.1 \
  --region southamerica-east1 --memory 1Gi --cpu 1 \
  --min-instances 0 --max-instances 2 --cpu-boost --allow-unauthenticated
```

## Testes
- `engine/smoke.sh [URL]`: espera o motor subir e calcula o exemplo oficial (`exemplos/operacao-oficial.json`, extraído de `docs/exemplos.md` do repositório da Receita), conferindo os valores documentados (CBS 42,24 na educação, erro REG-011, totais).
- O workflow **motor** builda, sobe com 1 vCPU/1 GiB, roda o teste, publica em `ghcr.io/nicolasdev-web/rtc-engine` e comenta o resultado na issue #2.

## Deploy (Cloud Run)
1. Uma vez, no Cloud Shell: `PROJETO=<id> bash engine/gcp/setup.sh` (APIs, Artifact Registry e Workload Identity, ou seja, sem chave JSON).
2. Cadastrar as variáveis que o script imprime em *Settings → Secrets and variables → Actions → Variables*.
3. *Actions → deploy-motor → Run workflow* (use `min_instancias=1` só no dia de gravar o vídeo).

## Atualizar a versão do motor
1. Ler o `CHANGELOG.md` oficial.
2. Trocar `RTC_REF`, rebuildar e rodar `pnpm eval --so-busca` + gabarito.
3. Abrir PR com o resultado da avaliação.
