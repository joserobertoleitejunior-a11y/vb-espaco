/* Pix do app: o "copia e cola" e o QR Code montados aqui, no próprio celular,
   sem gateway nenhum no meio.

   Isso é o BR Code — o padrão aberto que o Banco Central publica no "Manual de
   Padrões para Iniciação do Pix". É o mesmo texto que o banco do lojista
   geraria: o dinheiro cai DIRETO na conta dele, ninguém no meio, taxa zero.
   Por isso não existe confirmação automática: quem vê o comprovante é o dono.

   O texto é uma sequência de campos "ID + tamanho + valor" (TLV), fechada por
   um CRC16 que o app do banco confere antes de mostrar o pagamento.

     VBPix.codigo({ chave, valor, nome, cidade, txid })  → string do copia e cola
     VBPix.qr(caixa, texto)                              → desenha o QR na caixa
     VBPix.tipoDaChave('...')                            → 'cpf'|'cnpj'|'email'|'telefone'|'aleatoria'|null
     VBPix.limparChave('...')                            → chave do jeito que o Pix espera */
(function (global) {
  'use strict';
  var QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

  // um campo: o id, o tamanho em 2 dígitos e o valor
  function campo(id, valor) {
    var v = String(valor == null ? '' : valor);
    return id + String(v.length).padStart(2, '0') + v;
  }

  /* CRC16/CCITT-FALSE — é este, com polinômio 0x1021 e início 0xFFFF, que o
     manual do Pix manda usar. Sem ele (ou errado) o banco recusa o código. */
  function crc16(texto) {
    var crc = 0xFFFF;
    for (var i = 0; i < texto.length; i++) {
      crc ^= texto.charCodeAt(i) << 8;
      for (var b = 0; b < 8; b++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // o Pix só aceita A–Z, 0–9 e alguns sinais no nome e na cidade: tiramos
  // acento e o que sobrar vira espaço, senão o banco recusa o código
  function limpo(t, max) {
    return String(t || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 .\-]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, max).toUpperCase();
  }

  function soDigitos(t) { return String(t || '').replace(/\D/g, ''); }

  /* CPF e celular com DDD têm os dois 11 dígitos — chutar erra e o banco
     recusa a chave. Então conferimos os dois dígitos verificadores do CPF:
     se fecham, é CPF; se não, é telefone. */
  function cpfValido(d) {
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var j = 9; j < 11; j++) {
      var soma = 0;
      for (var i = 0; i < j; i++) soma += Number(d[i]) * (j + 1 - i);
      var dig = (soma * 10) % 11 % 10;
      if (dig !== Number(d[j])) return false;
    }
    return true;
  }

  function tipoDaChave(chave) {
    var c = String(chave || '').trim();
    if (!c) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return 'aleatoria';
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return 'email';
    var d = soDigitos(c);
    if (d.length === 14) return 'cnpj';
    if (d.length === 13 && d.indexOf('55') === 0) return 'telefone';
    if (d.length === 11) return cpfValido(d) ? 'cpf' : 'telefone';
    if (d.length === 10) return 'telefone';
    return null;
  }

  // nome de cada tipo, pro dono conferir na tela se entendemos certo
  var NOME_TIPO = { cpf: 'CPF', cnpj: 'CNPJ', email: 'e-mail', telefone: 'celular', aleatoria: 'chave aleatória' };

  // CPF/CNPJ vão só com números; telefone vai com +55 na frente
  function limparChave(chave) {
    var c = String(chave || '').trim();
    var tipo = tipoDaChave(c);
    if (tipo === 'email') return c.toLowerCase();
    if (tipo === 'cpf' || tipo === 'cnpj') return soDigitos(c);
    if (tipo === 'telefone') {
      var d = soDigitos(c);
      if (d.length === 13 && d.indexOf('55') === 0) return '+' + d;
      return '+55' + d;
    }
    return c;
  }

  function codigo(op) {
    op = op || {};
    var chave = limparChave(op.chave);
    if (!chave) return '';
    // 26 = quem recebe: o domínio do Pix (00) e a chave (01)
    var conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
    // 62 = o identificador da cobrança; "***" quer dizer "sem identificador"
    var txid = limpo(op.txid, 25).replace(/[^A-Z0-9]/g, '') || '***';
    var extra = campo('05', txid);

    var valor = Number(op.valor);
    var partes =
      campo('00', '01') +                                   // versão do padrão
      campo('26', conta) +
      campo('52', '0000') +                                 // ramo do negócio: não informado
      campo('53', '986') +                                  // moeda: real
      (valor > 0 ? campo('54', valor.toFixed(2)) : '') +    // sem valor, o cliente digita
      campo('58', 'BR') +
      campo('59', limpo(op.nome, 25) || 'RECEBEDOR') +
      campo('60', limpo(op.cidade, 15) || 'BRASIL') +
      campo('62', extra);

    // o CRC entra por último, calculado sobre tudo o que veio antes + "6304"
    var semCrc = partes + '6304';
    return semCrc + crc16(semCrc);
  }

  /* O QR é desenhado pela qrcodejs, a mesma biblioteca que a aba "Meu site" já
     usa — carregada uma vez só e sob demanda, pra não pesar quem nunca paga. */
  function qr(caixa, texto, lado) {
    if (!caixa) return;
    var fazer = function () {
      caixa.innerHTML = '';
      try {
        new global.QRCode(caixa, {
          text: texto, width: lado || 220, height: lado || 220,
          correctLevel: global.QRCode.CorrectLevel.M
        });
        caixa.setAttribute('data-pronto', '1');
      } catch (e) { falhou(); }
    };
    /* O desenho do QR depende de uma biblioteca de fora (a mesma que a aba
       "Meu site" já usa). Se ela não vier, o pagamento NÃO pode parar: o
       "copia e cola" é gerado aqui dentro e funciona sozinho. A caixa então
       diz isso, em vez de ficar eternamente "montando o código". */
    var falhou = function () {
      caixa.setAttribute('data-erro', '1');
      caixa.textContent = 'Não deu pra desenhar o quadradinho agora — use o botão "Copiar código Pix" aqui do lado, que funciona igual.';
    };
    if (global.QRCode) { fazer(); return; }
    var s = document.querySelector('script[data-ms-qrlib]');
    if (!s) {
      s = document.createElement('script');
      s.src = QR_LIB; s.setAttribute('data-ms-qrlib', '');
      document.head.appendChild(s);
    }
    s.addEventListener('load', fazer);
    s.addEventListener('error', falhou);
    // biblioteca que nunca responde também é falha: 8s e seguimos sem o QR
    setTimeout(function () { if (!caixa.getAttribute('data-pronto')) falhou(); }, 8000);
  }

  global.VBPix = { codigo: codigo, qr: qr, tipoDaChave: tipoDaChave, limparChave: limparChave, crc16: crc16, NOME_TIPO: NOME_TIPO };
})(window);
