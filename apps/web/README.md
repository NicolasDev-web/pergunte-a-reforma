# apps/web — site

Next.js na Vercel.
- `/` chat com seletor **Claude · GPT · Gemini** (Vercel AI SDK) e painéis ao lado
- Modo **BYOK**: chave no `sessionStorage`, enviada por requisição, nunca salva nem registrada
- Modo **demo**: modelo leve, limite por IP (Upstash), teto mensal
- `/avaliacao` taxa de acerto publicada
- `/conectar` passo a passo para usar no Claude/ChatGPT/Gemini
- Verificador de números (ADR-002) antes de exibir a resposta
