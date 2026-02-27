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

  // Carregamento das fontes customizadas
  const [boldBytes, regularBytes] = await Promise.all([
    fetch('/fonts/JosefinSlab-Bold.ttf').then(res => res.arrayBuffer()),
    fetch('/fonts/JosefinSlab-Regular.ttf').then(res => res.arrayBuffer())
  ]);

  const limparValor = (valor: any) => {
    if (valor === undefined || valor === null || valor === 'undefined') return '';
    if (typeof valor === 'number' && valor < 1) {
      const totalSeconds = Math.round(valor * 24 * 3600);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return String(valor).trim();
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

    // Ajuste dinâmico do nome para não sair da margem
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

    // Frase de corpo
    const cargo = limparValor(aluno['Cargo'] || 'Membro');
    const liga = limparValor(aluno['Liga'] || 'DeLAMU');
    const inicio = limparValor(aluno['Início'] || 'Julho');
    const fim = limparValor(aluno['Conclusão'] || 'Dezembro');
    const ano = limparValor(aluno['Ano'] || '2025');
    const horasTotal = limparValor(aluno['Horas'] || '00:00');

    const frase = `Pela participação na condição de ${cargo} da Liga Acadêmica de ${liga} do CEUB, durante os meses de ${inicio} a ${fim} de ${ano}, totalizando ${horasTotal} horas complementares.`;
    const linhasFrase = wrapText(frase, 650, fontRegular, 17);
    linhasFrase.forEach((linha, i) => {
      const lWidth = fontRegular.widthOfTextAtSize(linha, 17);
      page1.drawText(linha, { x: (841.89/2) - (lWidth/2), y: 260 - (i * 22), size: 17, font: fontRegular });
    });

    // Assinaturas
    const fontSizeAssinatura = 10;
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
      { id: 'data', label: 'Data', largura: 80, x: margemEsquerda },
      { id: 'local', label: 'Local', largura: 100, x: margemEsquerda + 80 },
      { id: 'horas', label: 'Horas', largura: 50, x: margemEsquerda + 180 },
      { id: 'tema', label: 'Tema', largura: 280, x: margemEsquerda + 230 },
      { id: 'palestrante', label: 'Palestrante', largura: 180, x: margemEsquerda + 510 }
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
        
        const presencaBruta = chaveAluno ? limparValor(aluno[chaveAluno]) : "";

        // FILTRO: Só desenha se tiver presença válida (ignora 00:00)
        if (presencaBruta && presencaBruta !== "00:00" && presencaBruta !== "00:00:00") {
          
          let dataFormatada = dataOriginal;
          if (!isNaN(Number(dataFormatada)) && dataFormatada.length > 3) {
            const milissegundos = Math.round((Number(dataFormatada) - 25569) * 86400 * 1000);
            const dataObjeto = new Date(milissegundos);
            // Corrige o fuso horário para não retroceder um dia
            dataObjeto.setMinutes(dataObjeto.getMinutes() + dataObjeto.getTimezoneOffset());
            dataFormatada = dataObjeto.toLocaleDateString('pt-BR');
          }

          if (yAtual - alturaLinha < limiteInferior) {
            paginaAtual = pdfDoc.addPage([841.89, 595.28]);
            yAtual = 550; 
            yAtual = desenharCabecalhoManual(paginaAtual, yAtual);
          }

          const yTexto = yAtual - 15;
          const dadosParaDesenhar = [
            { texto: dataFormatada, colIndex: 0, size: 12.5 },
            { texto: limparValor(aula['Local']), colIndex: 1, size: 12.5 },
            { texto: presencaBruta, colIndex: 2, size: 12.5 },
            { texto: (limparValor(aula['Tema']).length > 55 ? limparValor(aula['Tema']).substring(0, 52) + "..." : limparValor(aula['Tema'])), colIndex: 3, size: 12.5 },
            { texto: limparValor(aula['Palestrante']), colIndex: 4, size: 12.5 }
          ];

          dadosParaDesenhar.forEach(item => {
            const col = colunas[item.colIndex];
            const xCentro = obterXCentro(item.texto, col.largura, col.x, item.size, fontRegular);
            paginaAtual.drawText(item.texto, { x: xCentro, y: yTexto, size: item.size, font: fontRegular });
          });

          yAtual -= alturaLinha;
          
          // Desenha bordas da célula
          paginaAtual.drawLine({ start: { x: margemEsquerda, y: yAtual }, end: { x: margemEsquerda + larguraTotal, y: yAtual }, thickness: 1 });
          [0, 80, 180, 230, 510, larguraTotal].forEach(xRel => {
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