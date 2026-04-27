import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';


export const gerarZipCertificados = async (
  dadosAlunos: any[], 
  cronograma: any[], 
  templateFrente: Uint8Array, 
  templateVerso: Uint8Array,
  gestao: { coordenadorLiga: string; presidenteDelamu: string; coordenadorCurso: string; }
) => {
  const zip = new JSZip();

  // carregamento das fontes customizadas
  const [boldBytes, regularBytes] = await Promise.all([
    fetch('/fonts/JosefinSlab-Bold.ttf').then(res => res.arrayBuffer()),
    fetch('/fonts/JosefinSlab-Regular.ttf').then(res => res.arrayBuffer())
  ]);

  const limparValor = (valor: any) => {
    if (valor === undefined || valor === null || valor === 'undefined') return '';
    return String(valor).trim();
  };

  const formatarHorasExcel = (valor: any) => {
    if (valor === undefined || valor === null || valor === '00:00' || valor === '') return '00:00';
    
    const num = Number(valor);
    if (isNaN(num)) return String(valor).trim();

    const totalSeconds = Math.round(num * 24 * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };
  
    const ajustarTextoEFontSize = (texto: string, larguraMaxima: number, fontSizeOriginal: number, fonte: any) => {
      let size = fontSizeOriginal;
      let txt = texto;
      let larguraTexto = fonte.widthOfTextAtSize(txt, size);

      if (larguraTexto > larguraMaxima) {
        while (larguraTexto > larguraMaxima && size > 9) {
          size -= 0.5;
          larguraTexto = fonte.widthOfTextAtSize(txt, size);
        }
      }

      if (larguraTexto > larguraMaxima) {
        while (larguraTexto > larguraMaxima && txt.length > 0) {
          txt = txt.substring(0, txt.length - 1);
          larguraTexto = fonte.widthOfTextAtSize(txt + "...", size);
        }
        txt = txt + "...";
      }

    return { texto: txt, size };
  };

  const wrapText = (text: string, width: number, font: any, size: number) => {
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const widthLine = font.widthOfTextAtSize(currentLine + ' ' + word, size);
      if (widthLine < width) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  const obterXCentro = (texto: string, larguraCol: number, xBase: number, tamanho: number, fonte: any) => {
    const larguraTexto = fonte.widthOfTextAtSize(texto, tamanho);
    return xBase + (larguraCol / 2) - (larguraTexto / 2);
  };

  for (const aluno of dadosAlunos) {
    const nomeBruto = aluno['Nome'] || Object.values(aluno)[0];
    const nome = String(nomeBruto || '').trim().toUpperCase();
    if (!nomeBruto || nome === '' || nome === 'UNDEFINED') continue;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fontBold = await pdfDoc.embedFont(boldBytes);
    const fontRegular = await pdfDoc.embedFont(regularBytes);

    /*===================================== PÁGINA 1 (FRENTE) =========================================*/
    const page1 = pdfDoc.addPage([841.89, 595.28]);
    const imgFrente = await pdfDoc.embedPng(templateFrente);
    page1.drawImage(imgFrente, { x: 0, y: 0, width: 841.89, height: 595.28 });

    // ajuda para centralizar o nome, com ajuste automático de tamanho se for muito longo
    let nomeSize = 38;
    const larguraMaximaNome = 700;
    let nomeWidth = fontBold.widthOfTextAtSize(nome, nomeSize);

    if (nomeWidth > larguraMaximaNome) {
      nomeSize = (larguraMaximaNome / nomeWidth) * nomeSize;
      nomeWidth = fontBold.widthOfTextAtSize(nome, nomeSize);
    }

    page1.drawText(nome, {
      x: (841.89 / 2) - (nomeWidth / 2),
      y: 325,
      size: nomeSize,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // frase de corpo
    const cargo = limparValor(aluno['Cargo'] || 'Membro');
    const liga = limparValor(aluno['Liga'] || 'DeLAMU');
    const inicio = limparValor(aluno['Início'] || 'Julho');
    const fim = limparValor(aluno['Conclusão'] || 'Dezembro');
    const ano = limparValor(aluno['Ano'] || '2025');

    const horasTotal = formatarHorasExcel(aluno['Horas']);

    const frase = `Pela participação na condição de ${cargo} da Liga Acadêmica de ${liga} do CEUB, durante os meses de ${inicio} a ${fim} de ${ano}, totalizando ${horasTotal} horas complementares.`;
    const linhasFrase = wrapText(frase, 650, fontRegular, 17);
    linhasFrase.forEach((linha, i) => {
      const lWidth = fontRegular.widthOfTextAtSize(linha, 17);
      page1.drawText(linha, { x: (841.89/2) - (lWidth/2), y: 260 - (i * 22), size: 17, font: fontRegular });
    });

    // assinaturas
    const fontSizeAssinatura = 15;
    const desenharAssinatura = (texto: string, xCentro: number) => {
      const txt = (texto || "").toUpperCase();
      const txtWidth = fontRegular.widthOfTextAtSize(txt, fontSizeAssinatura);
      page1.drawText(txt, { x: xCentro - (txtWidth / 2), y: 110, size: fontSizeAssinatura, font: fontRegular });
    };

    desenharAssinatura(gestao.coordenadorLiga, 165);
    desenharAssinatura(gestao.presidenteDelamu, 841.89 / 2); 
    desenharAssinatura(gestao.coordenadorCurso, 680);

    /*===================================== PÁGINA 2 (VERSO) =========================================*/
    const page2 = pdfDoc.addPage([841.89, 595.28]);
    const imgVerso = await pdfDoc.embedPng(templateVerso);
    page2.drawImage(imgVerso, { x: 0, y: 0, width: 841.89, height: 595.28 });

    const margemEsquerda = 50;
    const larguraTotal = page2.getWidth() - 100;
    const alturaLinha = 22; 
    const limiteInferior = 80; 

    const colunas = [
      { id: 'data', label: 'Data', largura: 90, x: margemEsquerda },
      { id: 'local', label: 'Local', largura: 130, x: margemEsquerda + 90 },
      { id: 'horas', label: 'Horas', largura: 60, x: margemEsquerda + 220 },
      { id: 'tema', label: 'Tema', largura: 250, x: margemEsquerda + 280 },
      { id: 'palestrante', label: 'Palestrante', largura: 180, x: margemEsquerda + 540 }
    ];

    const desenharCabecalhoManual = (pagina: any, y: number) => {
      pagina.drawLine({ start: { x: margemEsquerda, y }, end: { x: margemEsquerda + larguraTotal, y }, thickness: 1 });
      const yTexto = y - 15;
      colunas.forEach(col => {
        const xCentro = obterXCentro(col.label, col.largura, col.x, 17.6, fontBold);
        pagina.drawText(col.label, { x: xCentro, y: yTexto, size: 17.6, font: fontBold });
      });
      pagina.drawLine({ start: { x: margemEsquerda, y: y - 22 }, end: { x: margemEsquerda + larguraTotal, y: y - 22 }, thickness: 1 });
      return y - 22;
    };

    let paginaAtual = page2;
    let yAtual = 460; 
    yAtual = desenharCabecalhoManual(paginaAtual, yAtual);

    if (cronograma && cronograma.length > 0) {
      cronograma.forEach((aula: any) => {
        const dataOriginal = String(aula['Data'] || "").trim();
        const dataNormalizada = dataOriginal.replace(/\D/g, "");
        const chaveAluno = Object.keys(aluno).find(key => String(key).replace(/\D/g, "") === dataNormalizada);
        
        const presencaBruta = chaveAluno ? aluno[chaveAluno] : "";
        
        const horaFormatadaLinha = formatarHorasExcel(presencaBruta);

        // FILTRO: só desenha se tiver presença válida
        if (presencaBruta && horaFormatadaLinha !== "00:00") {
          
          let dataFormatada = dataOriginal;
          if (!isNaN(Number(dataFormatada)) && dataFormatada.length > 3) {
            const milissegundos = Math.round((Number(dataFormatada) - 25569) * 86400 * 1000);
            const dataObjeto = new Date(milissegundos);
            dataObjeto.setMinutes(dataObjeto.getMinutes() + dataObjeto.getTimezoneOffset());
            dataFormatada = dataObjeto.toLocaleDateString('pt-BR');
          }

          if (yAtual - alturaLinha < limiteInferior) {
            paginaAtual = pdfDoc.addPage([841.89, 595.28]);
            yAtual = 550; 
            yAtual = desenharCabecalhoManual(paginaAtual, yAtual);
          }

          const temaOriginal = limparValor(aula['Tema']);
          const temaCortado = temaOriginal.length > 40 ? temaOriginal.substring(0, 37) + "..." : temaOriginal;

          const localOriginal = limparValor(aula['Local']);
          const localCortado = localOriginal.length > 20 ? localOriginal.substring(0, 17) + "..." : localOriginal;

          const palestranteOriginal = limparValor(aula['Palestrante']);
          const palestranteCortado = palestranteOriginal.length > 25 ? palestranteOriginal.substring(0, 22) + "..." : palestranteOriginal;

          const yTexto = yAtual - 15;

          const localAjustado = ajustarTextoEFontSize(limparValor(aula['Local']), colunas[1].largura - 10, 12.5, fontRegular);
          const temaAjustado = ajustarTextoEFontSize(limparValor(aula['Tema']), colunas[3].largura - 10, 12.5, fontRegular);
          const palestranteAjustado = ajustarTextoEFontSize(limparValor(aula['Palestrante']), colunas[4].largura - 10, 12.5, fontRegular);

          const dadosParaDesenhar = [
            { texto: dataFormatada, colIndex: 0, size: 12.5 },
            { texto: localAjustado.texto, colIndex: 1, size: localAjustado.size },
            { texto: horaFormatadaLinha, colIndex: 2, size: 12.5 },
            { texto: temaAjustado.texto, colIndex: 3, size: temaAjustado.size },
            { texto: palestranteAjustado.texto, colIndex: 4, size: palestranteAjustado.size }
          ];

          dadosParaDesenhar.forEach(item => {
            const col = colunas[item.colIndex];
            const xCentro = obterXCentro(item.texto, col.largura, col.x, item.size, fontRegular);
            paginaAtual.drawText(item.texto, { x: xCentro, y: yTexto, size: item.size, font: fontRegular });
          });

          yAtual -= alturaLinha;
          
          // Desenha as bordas verticais com as larguras corretas
          paginaAtual.drawLine({ start: { x: margemEsquerda, y: yAtual }, end: { x: margemEsquerda + larguraTotal, y: yAtual }, thickness: 1 });
          [0, 90, 220, 280, 530, larguraTotal].forEach(xRel => { // Ajuste leve nos divisores
            paginaAtual.drawLine({ 
              start: { x: margemEsquerda + xRel, y: yAtual + alturaLinha }, 
              end: { x: margemEsquerda + xRel, y: yAtual }, 
              thickness: 1 
            });
          });
        }
      });
    }

    const pdfBytes = await pdfDoc.save();
    const nomeArquivo = nome.replace(/[^a-z0-9]/gi, '_');
    zip.file(`Certificado_${nomeArquivo}.pdf`, pdfBytes);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'certificados_delamu.zip');
};