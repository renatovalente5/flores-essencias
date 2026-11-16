# As letras do site

Servidas pelo próprio site (nada do Google Fonts: as páginas não carregam nada de fora).

| Letra | Ficheiros | Onde | Licença |
|---|---|---|---|
| Outfit (300–700, variável) | `outfit-latin.woff2`, `outfit-latin-ext.woff2` | o texto | SIL Open Font License 1.1 |
| Young Serif (400) | `youngserif-latin.woff2`, `youngserif-latin-ext.woff2` — **ainda por pôr aqui** | os títulos | SIL Open Font License 1.1 |

A Outfit veio da cópia que já estava no Mac (a do Fontsource, igual à da Google Fonts). A Young Serif não
havia em lado nenhum do Mac e não se descarregou sem autorização: até os dois ficheiros chegarem a esta
pasta, os títulos usam a Georgia. O `scripts/build.mjs` só escreve o `@font-face` das letras que estão
aqui, por isso basta copiar os ficheiros com estes nomes e construir outra vez.
