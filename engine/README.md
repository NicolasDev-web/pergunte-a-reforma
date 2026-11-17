# engine — motor oficial da Calculadora RTC

Empacota [ReceitaFederal/calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) **sem modificações**, numa versão fixada (`RTC_REF`, hoje `1.6.1`).

## Local
```bash
docker build -t rtc-engine engine/
docker run -p 8080:8080 rtc-engine
curl localhost:8080/api/calculadora/dados-abertos/versao
```

## Cloud Run
```bash
gcloud builds submit engine/ --tag southamerica-east1-docker.pkg.dev/$PROJETO/reforma/rtc-engine:1.6.1
gcloud run deploy rtc-engine \
  --image southamerica-east1-docker.pkg.dev/$PROJETO/reforma/rtc-engine:1.6.1 \
  --region southamerica-east1 --memory 1Gi --cpu 1 \
  --min-instances 0 --max-instances 2 --cpu-boost --allow-unauthenticated
```

> ⚠️ Rascunho: o Dockerfile segue os passos do README oficial (Flyway → SQLite → `java -jar` no perfil `offline`), mas ainda não foi buildado (ver issue da Semana 1).

## Atualizar a versão do motor
1. Ler o `CHANGELOG.md` oficial.
2. Trocar `RTC_REF`, rebuildar e rodar `pnpm eval --so-busca` + gabarito.
3. Abrir PR com o resultado da avaliação.
