# Motor oficial da Calculadora RTC (Receita Federal / SERPRO) empacotado para o Cloud Run.
# O banco SQLite é gerado DURANTE o build (Flyway) e vai somente leitura para a imagem final.
#
# Build:  docker build -t rtc-engine --build-arg RTC_REF=1.6.1 engine/
# Run:    docker run -p 8080:8080 rtc-engine
# Teste:  curl localhost:8080/api/calculadora/dados-abertos/versao

ARG RTC_REF=1.6.1

# ---------- 1) build: clona a versão fixada, gera o banco e compila ----------
# Obs.: usamos o "mvn" da imagem; o mvnw quebra porque a imagem define MAVEN_CONFIG=/root/.m2.
FROM maven:3.9-eclipse-temurin-21 AS build
ARG RTC_REF
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "${RTC_REF}" \
      https://github.com/ReceitaFederal/calculadora-rtc-regime-regular /src
WORKDIR /src
RUN mkdir -p calculadora/db \
 && mvn -B -q flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf --errors \
 && ls -lah calculadora/db/calculadora-pro.db
RUN mvn -B -q -DskipTests package

# ---------- 2) runtime: só o JRE, o JAR e o banco ----------
FROM eclipse-temurin:21-jre
ARG RTC_REF
LABEL org.opencontainers.image.title="rtc-engine" \
      org.opencontainers.image.source="https://github.com/ReceitaFederal/calculadora-rtc-regime-regular" \
      rtc.ref="${RTC_REF}"
WORKDIR /app
COPY --from=build /src/target/api-regime-geral.jar app.jar
COPY --from=build /src/calculadora/db/calculadora-pro.db calculadora/db/calculadora-pro.db
RUN useradd -r -u 10001 rtc && chown -R rtc /app
USER rtc
# Cloud Run injeta $PORT. Flags para subir mais rápido em container pequeno.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xshare:auto"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java -Dspring.profiles.active=offline -Dserver.port=${PORT:-8080} -jar app.jar"]
