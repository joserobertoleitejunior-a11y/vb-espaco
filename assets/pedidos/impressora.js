/* Impressão de pedidos em impressora térmica (ESC/POS).
   Quatro caminhos, do mais direto ao mais universal:
   - bluetooth: Web Bluetooth (BLE) — Chrome no Android/PC, impressoras
     com Bluetooth LE
   - usb: Web Serial — Chrome no PC, impressoras por cabo USB-serial/serial
   - rawbt: app RawBT no Android — cobre impressoras Bluetooth "clássicas"
     que o navegador não enxerga
   - navegador: diálogo de impressão comum (qualquer impressora instalada,
     com cabo ou não), em layout de bobina 58/80mm */
(function (global) {
  'use strict';

  var PREF_KEY = 'vbdelivery_impressora';
  var SERVICOS_BLE = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb',
    '0000ae30-0000-1000-8000-00805f9b34fb'
  ];

  var estado = {
    modo: null,           // 'bluetooth' | 'usb' | 'rawbt' | 'navegador'
    conectada: false,
    nome: '',
    largura: 32,          // colunas: 32 (58mm) ou 48 (80mm)
    autoImprimir: false,
    caracteristica: null,
    porta: null
  };
  var ouvintes = [];

  function carregarPref() {
    try {
      var p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      estado.largura = p.largura === 48 ? 48 : 32;
      estado.autoImprimir = !!p.autoImprimir;
      if (p.modo === 'navegador' || p.modo === 'rawbt') { estado.modo = p.modo; estado.conectada = true; estado.nome = p.modo === 'rawbt' ? 'App RawBT' : 'Impressora do sistema'; }
    } catch (e) {}
  }
  function salvarPref() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ modo: estado.modo, largura: estado.largura, autoImprimir: estado.autoImprimir }));
    } catch (e) {}
  }
  function avisar() { ouvintes.forEach(function (fn) { try { fn(obterEstado()); } catch (e) {} }); }
  function obterEstado() { return { modo: estado.modo, conectada: estado.conectada, nome: estado.nome, largura: estado.largura, autoImprimir: estado.autoImprimir }; }

  function suporte() {
    var android = /Android/i.test(navigator.userAgent);
    return {
      bluetooth: !!(navigator.bluetooth && navigator.bluetooth.requestDevice),
      usb: !!navigator.serial,
      rawbt: android,
      navegador: true
    };
  }

  /* ---------- texto -> bytes ESC/POS ---------- */
  // impressora barata nem sempre tem tabela com acento: tiramos acento
  // (fica "Pedido nº" -> "Pedido n", "Açaí" -> "Acai"), legível em qualquer uma
  function semAcento(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[—–]/g, '-').replace(/[^\x20-\x7E\n]/g, '');
  }

  function Construtor() { this.bytes = []; }
  Construtor.prototype.raw = function (arr) { Array.prototype.push.apply(this.bytes, arr); return this; };
  Construtor.prototype.texto = function (s) { var t = semAcento(s); for (var i = 0; i < t.length; i++) this.bytes.push(t.charCodeAt(i)); return this; };
  Construtor.prototype.linha = function (s) { return this.texto(s || '').raw([0x0a]); };
  Construtor.prototype.negrito = function (on) { return this.raw([0x1b, 0x45, on ? 1 : 0]); };
  Construtor.prototype.alinhar = function (a) { return this.raw([0x1b, 0x61, a === 'centro' ? 1 : a === 'direita' ? 2 : 0]); };
  Construtor.prototype.tamanho = function (dobro) { return this.raw([0x1d, 0x21, dobro ? 0x11 : 0x00]); };
  Construtor.prototype.avancar = function (n) { return this.raw([0x1b, 0x64, n || 3]); };
  Construtor.prototype.cortar = function () { return this.raw([0x1d, 0x56, 0x42, 0x00]); };

  function quebrar(texto, largura) {
    var palavras = semAcento(texto).split(/\s+/), linhas = [], atual = '';
    palavras.forEach(function (p) {
      while (p.length > largura) { if (atual) { linhas.push(atual); atual = ''; } linhas.push(p.slice(0, largura)); p = p.slice(largura); }
      if ((atual + ' ' + p).trim().length > largura) { linhas.push(atual); atual = p; }
      else atual = (atual + ' ' + p).trim();
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  function colunas(esq, dir, largura) {
    esq = semAcento(esq); dir = semAcento(dir);
    var espaco = largura - esq.length - dir.length;
    if (espaco < 1) return quebrar(esq, largura).concat([Array(Math.max(0, largura - dir.length) + 1).join(' ') + dir]);
    return [esq + Array(espaco + 1).join(' ') + dir];
  }

  function reais(n) { return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ','); }

  // conteúdo do cupom (o mesmo pros 4 modos)
  function montarCupom(p, loja) {
    var L = estado.largura;
    var traco = Array(L + 1).join('-');
    var quando = new Date(p.criado_em || Date.now()).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    var entrega = p.forma_entrega === 'entrega';
    var PAG = { pix: 'Pix', cartao: 'Cartao na entrega', dinheiro: 'Dinheiro' };
    return {
      cabeca: [loja.nome],
      titulo: 'PEDIDO #' + p.numero,
      sub: [quando + '  ' + (entrega ? 'ENTREGA' : 'RETIRADA')],
      cliente: [p.cliente_nome, formatarTel(p.cliente_telefone)]
        .concat(entrega && p.endereco_entrega ? quebrar('End: ' + p.endereco_entrega, L) : [])
        .concat(p.referencia ? quebrar('Ref: ' + p.referencia, L) : [])
        .concat(entrega && p.localizacao_lat != null ? quebrar('GPS: ' + p.localizacao_lat + ', ' + p.localizacao_lng, L) : [])
        .concat(p.detalhes && (p.detalhes.veiculo || p.detalhes.modelo) ? quebrar('Veiculo: ' + [p.detalhes.veiculo, p.detalhes.modelo].filter(Boolean).join(' - '), L) : []),
      itens: (p.itens || []).map(function (l) {
        return { linhas: colunas(l.qtd + 'x ' + l.descricao, Number(l.total) > 0 ? reais(l.total) : 'a combinar', L), obs: l.obs ? quebrar('  > ' + l.obs, L) : [] };
      }),
      totais: [].concat(colunas('Subtotal', reais(p.subtotal != null ? p.subtotal : p.total), L))
        .concat(entrega ? colunas('Entrega', reais(p.taxa_entrega), L) : []),
      total: colunas('TOTAL', reais(p.total), L),
      pagamento: p.forma_pagamento ? quebrar('Pagamento: ' + (PAG[p.forma_pagamento] || p.forma_pagamento) + (p.troco_para ? ' (troco p/ ' + reais(p.troco_para) + ')' : ''), L) : [],
      obs: p.observacao ? quebrar('Obs: ' + p.observacao, L) : [],
      traco: traco
    };
  }

  function formatarTel(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return d;
  }

  function cupomEscPos(p, loja) {
    var c = montarCupom(p, loja);
    var b = new Construtor().raw([0x1b, 0x40]);
    b.alinhar('centro').negrito(true);
    c.cabeca.forEach(function (l) { b.linha(l); });
    b.tamanho(true).linha(c.titulo).tamanho(false).negrito(false);
    c.sub.forEach(function (l) { b.linha(l); });
    b.alinhar('esquerda').linha(c.traco);
    b.negrito(true); b.linha(c.cliente[0]); b.negrito(false);
    c.cliente.slice(1).forEach(function (l) { b.linha(l); });
    b.linha(c.traco);
    c.itens.forEach(function (it) { b.negrito(true); it.linhas.forEach(function (l) { b.linha(l); }); b.negrito(false); it.obs.forEach(function (l) { b.linha(l); }); });
    b.linha(c.traco);
    c.totais.forEach(function (l) { b.linha(l); });
    b.negrito(true).tamanho(false); c.total.forEach(function (l) { b.linha(l); }); b.negrito(false);
    c.pagamento.forEach(function (l) { b.linha(l); });
    if (c.obs.length) { b.linha(c.traco); c.obs.forEach(function (l) { b.linha(l); }); }
    b.alinhar('centro').linha('').linha('VB Delivery').avancar(4).cortar();
    return new Uint8Array(b.bytes);
  }

  function cupomHtml(p, loja) {
    var c = montarCupom(p, loja);
    var esc = function (s) { return String(s).replace(/[&<>]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]; }); };
    var bloco = function (arr) { return arr.map(esc).join('\n'); };
    var mm = estado.largura === 48 ? 80 : 58;
    return '<!doctype html><html><head><meta charset="utf-8"><title>Pedido ' + p.numero + '</title><style>' +
      '@page{size:' + mm + 'mm auto;margin:0}*{margin:0;padding:0}body{width:' + (mm - 6) + 'mm;padding:3mm;font:12px/1.35 "Courier New",monospace;color:#000}' +
      'pre{white-space:pre-wrap;font:inherit}.c{text-align:center}.b{font-weight:700}.g{font-size:18px;font-weight:700;margin:2px 0}' +
      '</style></head><body>' +
      '<pre class="c b">' + bloco(c.cabeca) + '</pre><pre class="c g">' + esc(c.titulo) + '</pre><pre class="c">' + bloco(c.sub) + '</pre>' +
      '<pre>' + c.traco + '</pre><pre class="b">' + esc(c.cliente[0] || '') + '</pre><pre>' + bloco(c.cliente.slice(1)) + '</pre><pre>' + c.traco + '</pre>' +
      c.itens.map(function (it) { return '<pre class="b">' + bloco(it.linhas) + '</pre>' + (it.obs.length ? '<pre>' + bloco(it.obs) + '</pre>' : ''); }).join('') +
      '<pre>' + c.traco + '</pre><pre>' + bloco(c.totais) + '</pre><pre class="b">' + bloco(c.total) + '</pre><pre>' + bloco(c.pagamento) + '</pre>' +
      (c.obs.length ? '<pre>' + c.traco + '</pre><pre>' + bloco(c.obs) + '</pre>' : '') +
      '<pre class="c" style="margin-top:6px">VB Delivery</pre></body></html>';
  }

  /* ---------- conexões ---------- */
  async function conectarBluetooth() {
    if (!suporte().bluetooth) throw new Error('Esse navegador não tem Bluetooth. Use o Chrome no Android ou no computador.');
    var dispositivo = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICOS_BLE });
    var servidor = await dispositivo.gatt.connect();
    var servicos = await servidor.getPrimaryServices();
    var achada = null;
    for (var i = 0; i < servicos.length && !achada; i++) {
      var cars = await servicos[i].getCharacteristics();
      for (var j = 0; j < cars.length; j++) {
        if (cars[j].properties.write || cars[j].properties.writeWithoutResponse) { achada = cars[j]; break; }
      }
    }
    if (!achada) throw new Error('Conectou, mas essa impressora não aceitou impressão por Bluetooth LE. Tente o app RawBT.');
    dispositivo.addEventListener('gattserverdisconnected', function () {
      if (estado.modo === 'bluetooth') { estado.conectada = false; avisar(); }
    });
    estado.modo = 'bluetooth'; estado.conectada = true; estado.nome = dispositivo.name || 'Impressora Bluetooth';
    estado.caracteristica = achada;
    salvarPref(); avisar();
  }

  async function conectarUSB() {
    if (!suporte().usb) throw new Error('Impressão por cabo direto funciona no Chrome do computador. Aqui, use "Pelo navegador".');
    var porta = await navigator.serial.requestPort();
    await porta.open({ baudRate: 9600 });
    estado.modo = 'usb'; estado.conectada = true; estado.nome = 'Impressora USB/serial'; estado.porta = porta;
    salvarPref(); avisar();
  }

  function usarNavegador() {
    estado.modo = 'navegador'; estado.conectada = true; estado.nome = 'Impressora do sistema';
    salvarPref(); avisar();
  }

  function usarRawbt() {
    estado.modo = 'rawbt'; estado.conectada = true; estado.nome = 'App RawBT';
    salvarPref(); avisar();
  }

  function desconectar() {
    try { if (estado.caracteristica) estado.caracteristica.service.device.gatt.disconnect(); } catch (e) {}
    try { if (estado.porta) estado.porta.close(); } catch (e) {}
    estado.modo = null; estado.conectada = false; estado.nome = ''; estado.caracteristica = null; estado.porta = null;
    salvarPref(); avisar();
  }

  async function escreverBluetooth(bytes) {
    var c = estado.caracteristica;
    var tam = 100;
    for (var i = 0; i < bytes.length; i += tam) {
      var pedaco = bytes.slice(i, i + tam);
      if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) await c.writeValueWithoutResponse(pedaco);
      else await c.writeValue(pedaco);
      await new Promise(function (r) { setTimeout(r, 25); });
    }
  }

  async function escreverSerial(bytes) {
    var w = estado.porta.writable.getWriter();
    try { await w.write(bytes); } finally { w.releaseLock(); }
  }

  function imprimirNavegador(html) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(function () {
      f.contentWindow.focus(); f.contentWindow.print();
      setTimeout(function () { f.remove(); }, 2000);
    }, 250);
  }

  function base64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  async function imprimirPedido(pedido, loja) {
    if (!estado.conectada) throw new Error('Nenhuma impressora escolhida.');
    if (estado.modo === 'navegador') return imprimirNavegador(cupomHtml(pedido, loja));
    var bytes = cupomEscPos(pedido, loja);
    if (estado.modo === 'rawbt') { window.location.href = 'rawbt:base64,' + base64(bytes); return; }
    if (estado.modo === 'bluetooth') return escreverBluetooth(bytes);
    if (estado.modo === 'usb') return escreverSerial(bytes);
  }

  function definirLargura(colunas) { estado.largura = colunas === 48 ? 48 : 32; salvarPref(); avisar(); }
  function definirAuto(v) { estado.autoImprimir = !!v; salvarPref(); avisar(); }

  carregarPref();

  global.VBImpressora = {
    suporte: suporte, estado: obterEstado, aoMudar: function (fn) { ouvintes.push(fn); },
    conectarBluetooth: conectarBluetooth, conectarUSB: conectarUSB, usarNavegador: usarNavegador, usarRawbt: usarRawbt,
    desconectar: desconectar, imprimirPedido: imprimirPedido, definirLargura: definirLargura, definirAuto: definirAuto,
    cupomHtml: cupomHtml, cupomEscPos: cupomEscPos
  };
})(window);
