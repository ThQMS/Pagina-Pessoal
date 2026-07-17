# Portfólio — Thiago Henrique

Portfólio pessoal de **Thiago Henrique** — Engenheiro de Software Full Stack (Node.js, TypeScript, React, Python) com formação em segurança defensiva (Blue Team).

Interface com estética de IDE/terminal em preto, dourado e vinho, com globo 3D de habilidades, timeline de experiência em estilo `git log` e efeitos ambientes (chuva de código, barra de compilação e blueprint de arquitetura).

🔗 **GitHub:** [@ThQMS](https://github.com/ThQMS) · **LinkedIn:** [Thiago Henrique](https://www.linkedin.com/in/thiago-henrique-queiroz-muniz-silva-b91311249)

## Tecnologias

- **HTML + CSS (Tailwind, build estático)** — layout, tokens de cor e utilitários
- **JavaScript (vanilla)** — máquina de escrever do terminal, scroll-reveal, navegação, formulário
- **Three.js** (via CDN) — globo 3D interativo de habilidades (CSS3DRenderer + OrbitControls)
- **Lucide** — ícones da interface
- **Devicon** — ícones de tecnologias no globo
- **Geist / Fira Code / Inter** — tipografia
- **Formspree** — envio do formulário de contato

## Estrutura

```
index.html            # página única
assets/
  css/                # estilos (tema, componentes, efeitos)
  js/                 # interações, globo 3D, efeitos, runtime de ícones
  fonts/              # fontes locais
  images/             # foto de perfil
```

## Rodando localmente

Como usa caminhos relativos e módulos ES, sirva por um servidor local (não abra via `file://`):

```bash
# Python
python -m http.server 8000
# depois acesse http://localhost:8000
```

## Deploy

Site estático, pronto para **GitHub Pages** (ou qualquer host estático). Com o repositório publicado, basta ativar o Pages apontando para a branch principal / raiz.

---

© 2026 Thiago Henrique. Todos os direitos reservados.
