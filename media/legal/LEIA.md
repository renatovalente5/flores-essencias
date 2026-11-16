# O aviso harmonizado da garantia legal

Estes dois ficheiros **não são nossos e não se editam** (Regulamento de Execução (UE) 2025/1960,
anexo I, nota 1: nenhum elemento do aviso pode ser alterado; nota 5: online mostra-se a cores).
São os ficheiros oficiais da Comissão Europeia («Practical guidelines and high-resolution vector files
for the EU notice and label on product guarantees»), copiados byte a byte dos outros sites do Renato.
Só o nome mudou (os originais têm espaços).

| ficheiro | original | SHA-256 |
|---|---|---|
| `aviso-garantia-legal-pt.svg` | `Legal guarantee_notice PT.svg` | `9069bb0bc5e9f3cf655579038be5646181cc5447a25f3f8ccf2d018eacba0ac1` |
| `aviso-garantia-legal-pt.pdf` | `Legal guarantee_notice PTN.pdf` | `b145a3014984f474d9bb81c60b5a492a376e64e55695eb089f0554adaa752877` |

O `scripts/build.mjs` confere os dois SHA-256 e pára se mudarem. O SVG não tem texto (letras em
contornos): o texto oficial vai no `alt`, palavra por palavra (ver `AVISO_ALT` no build).
O que é preciso dizer além do aviso (os 3 anos portugueses) vai fora dele, na página /garantia/.
