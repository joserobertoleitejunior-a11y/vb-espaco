/* Fila offline do VB Agenda — quando uma venda ou um agendamento (criar,
   confirmar, cancelar, concluir) falha por falta de internet, cai aqui
   (IndexedDB) em vez de se perder. Assim que a conexão volta, tenta de
   novo sozinho, na mesma ordem em que foi feito. Se o problema não for
   rede (ex: RPC recusou o dado), fica marcado e para de tentar sozinho —
   o dono decide manualmente, pra não martelar a mesma falha pra sempre. */
(function () {
  var NOME_DB = 'vbOfflineFila';
  var STORE = 'acoes';
  var _dbPromise = null;
  var _ouvintes = [];
  var _sincronizando = false;

  function abrirDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function (resolve, reject) {
      var pedido = indexedDB.open(NOME_DB, 1);
      pedido.onupgradeneeded = function () {
        var db = pedido.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      };
      pedido.onsuccess = function () { resolve(pedido.result); };
      pedido.onerror = function () { reject(pedido.error); };
    });
    return _dbPromise;
  }

  function transacao(modo) {
    return abrirDb().then(function (db) { return db.transaction(STORE, modo).objectStore(STORE); });
  }

  function pedidoParaPromise(pedido) {
    return new Promise(function (resolve, reject) {
      pedido.onsuccess = function () { resolve(pedido.result); };
      pedido.onerror = function () { reject(pedido.error); };
    });
  }

  function listar() {
    return transacao('readonly').then(function (store) { return pedidoParaPromise(store.getAll()); });
  }

  function avisar() {
    listar().then(function (fila) { _ouvintes.forEach(function (cb) { cb(fila); }); });
  }

  function enfileirar(rpcNome, params, descricao) {
    return transacao('readwrite').then(function (store) {
      return pedidoParaPromise(store.add({ rpcNome: rpcNome, params: params, descricao: descricao || rpcNome, criadoEm: Date.now() }));
    }).then(function (id) { avisar(); return id; });
  }

  function remover(id) {
    return transacao('readwrite').then(function (store) { return pedidoParaPromise(store.delete(id)); }).then(avisar);
  }

  function marcarComProblema(id, motivo) {
    return transacao('readwrite').then(function (store) {
      return pedidoParaPromise(store.get(id)).then(function (registro) {
        if (!registro) return;
        registro.problema = motivo;
        return pedidoParaPromise(store.put(registro));
      });
    });
  }

  function tentarNovamente(id) {
    return transacao('readwrite').then(function (store) {
      return pedidoParaPromise(store.get(id)).then(function (registro) {
        if (!registro) return;
        delete registro.problema;
        return pedidoParaPromise(store.put(registro));
      });
    }).then(function () { avisar(); return sincronizar(); });
  }

  // percorre a fila em ordem, um de cada vez. Item com "problema" (erro
  // de verdade, não de rede) é pulado sozinho — só volta a tentar se o
  // dono chamar tentarNovamente(). Na primeira falha de rede, para o
  // resto da fila pra essa rodada (tenta de novo no próximo 'online').
  function sincronizar() {
    if (_sincronizando || !window.db) return Promise.resolve();
    _sincronizando = true;
    return listar().then(function (fila) {
      var pendentes = fila.filter(function (a) { return !a.problema; });
      return pendentes.reduce(function (promessa, acao) {
        return promessa.then(function (parouPorRede) {
          if (parouPorRede) return true;
          return window.db.rpc(acao.rpcNome, acao.params).then(function (res) {
            if (res.error) return marcarComProblema(acao.id, res.error.message).then(function () { return false; });
            return remover(acao.id).then(function () { return false; });
          }, function () { return true; });
        });
      }, Promise.resolve(false));
    }).then(function () {
      _sincronizando = false;
      avisar();
    }, function () {
      _sincronizando = false;
    });
  }

  // ação principal: tenta a rede primeiro; só cai na fila se a falha for
  // de conectividade — nunca some silenciosa, ou salva na hora, ou fica
  // pendente visível, nunca as duas coisas nem nenhuma.
  function executarOuEnfileirar(rpcNome, params, descricao) {
    if (!navigator.onLine) {
      return enfileirar(rpcNome, params, descricao).then(function () { return { offline: true }; });
    }
    return window.db.rpc(rpcNome, params).then(function (res) {
      return { offline: false, res: res };
    }, function () {
      return enfileirar(rpcNome, params, descricao).then(function () { return { offline: true }; });
    });
  }

  function aoMudarFila(cb) {
    _ouvintes.push(cb);
    listar().then(cb);
  }

  window.addEventListener('online', sincronizar);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sincronizar(); });
  setTimeout(sincronizar, 1500);

  window.VBOffline = {
    executarOuEnfileirar: executarOuEnfileirar,
    listar: listar,
    remover: remover,
    tentarNovamente: tentarNovamente,
    sincronizar: sincronizar,
    aoMudarFila: aoMudarFila
  };
})();
