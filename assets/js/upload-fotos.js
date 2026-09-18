/* Upload de fotos pro Storage do Supabase (bucket público "tenant-fotos"),
   usado pelo cadastro (antes do estabelecimento existir, com uma pasta
   temporária) e pelo painel de edição (com o id real). */
(function (global) {
  function nomeSeguro(nome) {
    return (nome || 'foto').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-');
  }

  function uploadFoto(file, pastaId, subpasta) {
    if (!global.db || !global.db.storage) return Promise.reject(new Error('Sem conexão com o servidor agora.'));
    if (!file) return Promise.reject(new Error('Escolha uma foto primeiro.'));
    var caminho = pastaId + '/' + subpasta + '/' + Date.now() + '-' + nomeSeguro(file.name);
    return global.db.storage.from('tenant-fotos').upload(caminho, file, { cacheControl: '3600', upsert: false }).then(function (res) {
      if (res.error) throw res.error;
      var pub = global.db.storage.from('tenant-fotos').getPublicUrl(caminho);
      return pub.data.publicUrl;
    });
  }

  function novaPastaTemporaria() {
    return 'novo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  global.VBUpload = { uploadFoto: uploadFoto, novaPastaTemporaria: novaPastaTemporaria };
})(window);
