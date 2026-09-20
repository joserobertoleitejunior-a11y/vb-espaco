/* Extrai duas cores de uma foto (tom médio geral + tom escuro/sombra) via
   canvas, pra alimentar o mesmo sistema de --terracotta/--dourado que já
   pinta bordas, botões e detalhes do site — assim o site "casa" com a
   foto escolhida quando o dono liga o toggle "seguir cor da imagem". */
(function () {
  function paraHex(n) {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  }

  function extrairCoresDaImagem(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var tam = 60;
          var canvas = document.createElement('canvas');
          canvas.width = tam;
          canvas.height = tam;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, tam, tam);
          var dados = ctx.getImageData(0, 0, tam, tam).data;

          var somaR = 0, somaG = 0, somaB = 0, n = 0;
          var pixels = [];
          for (var i = 0; i < dados.length; i += 4) {
            var r = dados[i], g = dados[i + 1], b = dados[i + 2], a = dados[i + 3];
            if (a < 200) continue;
            somaR += r; somaG += g; somaB += b; n++;
            pixels.push({ r: r, g: g, b: b, luminancia: 0.299 * r + 0.587 * g + 0.114 * b });
          }
          if (!n) { reject(new Error('sem pixels legíveis')); return; }

          var mediaR = somaR / n, mediaG = somaG / n, mediaB = somaB / n;

          pixels.sort(function (p1, p2) { return p1.luminancia - p2.luminancia; });
          var corte = Math.max(1, Math.floor(pixels.length * 0.15));
          var subset = pixels.slice(0, corte);
          var dr = 0, dg = 0, db = 0;
          subset.forEach(function (p) { dr += p.r; dg += p.g; db += p.b; });
          var escuroR = dr / subset.length, escuroG = dg / subset.length, escuroB = db / subset.length;

          resolve({
            primaria: '#' + paraHex(mediaR) + paraHex(mediaG) + paraHex(mediaB),
            secundaria: '#' + paraHex(escuroR) + paraHex(escuroG) + paraHex(escuroB)
          });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = function () { reject(new Error('falha ao carregar a imagem')); };
      img.src = url;
    });
  }

  window.extrairCoresDaImagem = extrairCoresDaImagem;
})();
