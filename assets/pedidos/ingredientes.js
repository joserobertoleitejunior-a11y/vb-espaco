/* Ingredientes de um item do cardápio, tirados da descrição que o dono já
   escreveu — "Molho, calabresa, catupiry, orégano e azeitona." — pra o cliente
   poder tocar no que NÃO quer, em vez de digitar "sem cebola" numa caixinha.

   Não inventa nada: só separa o que está escrito. Se a descrição não for uma
   lista de ingredientes (ex.: "Nossa pizza mais pedida da casa"), devolve
   vazio e a tela simplesmente não mostra a opção — só a caixinha de observação.

     VBIngredientes.de(descricao)            → ['calabresa', 'catupiry', ...]
     VBIngredientes.observacao(tirados, txt) → "Sem calabresa, sem catupiry. Bem assada"  (até 140)
*/
(function (global) {
  'use strict';

  // a base da pizza: ninguém pede "sem molho" nem "sem massa", e a lista ficaria
  // cheia do que não é escolha. (Quem quiser tirar mesmo, usa a observação.)
  var BASE = /^(molho( de tomate)?|massa|molho especial)$/i;
  var LIMITE_OBS = 140; // o banco corta a observação de cada item em 140

  function limpar(t) {
    return String(t || '').replace(/\s+/g, ' ').replace(/^[\s.,;:–—-]+|[\s.,;:–—-]+$/g, '');
  }

  function de(descricao) {
    var texto = limpar(descricao);
    if (!texto) return [];
    // lista de verdade tem vírgula ou " e ": frase solta não é lista
    if (texto.indexOf(',') === -1 && !/ e /i.test(texto)) return [];
    // frase longa com ponto no meio é texto corrido, não lista de ingredientes
    if (/[.!?]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(texto)) return [];

    var partes = [];
    texto.split(',').forEach(function (pedaco) {
      // "orégano e azeitona" → dois. Só quebra no " e " quando os dois lados são curtos
      var lados = pedaco.split(/\s+e\s+/i);
      if (lados.length > 1 && lados.every(function (l) { return l.trim().split(/\s+/).length <= 3; })) partes = partes.concat(lados);
      else partes.push(pedaco);
    });

    var vistos = {}, lista = [];
    partes.forEach(function (p) {
      var i = limpar(p);
      if (!i || i.length > 32 || BASE.test(i)) return;
      i = i.charAt(0).toLowerCase() + i.slice(1);
      if (vistos[i]) return;
      vistos[i] = true;
      lista.push(i);
    });
    return lista.length >= 2 ? lista.slice(0, 14) : [];
  }

  /* "Sem calabresa, sem catupiry" + o que o cliente escreveu. O que ele TIROU
     tem prioridade: se não couber tudo em 140, é o texto livre que encurta. */
  function observacao(tirados, livre) {
    return juntar((tirados || []).map(function (t) { return 'sem ' + t; }).join(', '), livre);
  }

  // o mesmo, quando quem chama já montou a parte do "sem ..." (ex.: meio a meio,
  // que diz de qual metade tirar)
  function juntar(sem, livre) {
    var txt = limpar(livre);
    if (!sem) return txt.slice(0, LIMITE_OBS);
    var cabeca = sem.slice(0, LIMITE_OBS);
    if (!txt) return cabeca;
    var sobra = LIMITE_OBS - cabeca.length - 2;
    return sobra > 4 ? cabeca + '. ' + txt.slice(0, sobra) : cabeca;
  }

  global.VBIngredientes = { de: de, observacao: observacao, juntar: juntar, LIMITE: LIMITE_OBS };
})(typeof window !== 'undefined' ? window : globalThis);
