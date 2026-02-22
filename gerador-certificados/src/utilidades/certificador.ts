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

  // Carregamento das fontes
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

    /* nome do aluno */ 
    const nomeSize = 38;
    const nomeWidth = fontBold.widthOfTextAtSize(nome, nomeSize);
    page1.drawText(nome, {
      x: (841.89 / 2) - (nomeWidth / 2),
      y: 325,
      size: nomeSize,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    /* frase de corpo */
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

    /* assinaturas coordenação/direção */
    const fontSizeAssinatura = 10;
    const desenharAssinatura = (texto: string, xCentro: number) => {
      const txt = (texto || "").toUpperCase();
      const txtWidth = fontRegular.widthOfTextAtSize(txt, fontSizeAssinatura);
      page1.drawText(txt, { 
        x: xCentro - (txtWidth / 2),
        y: 110, 
        size: fontSizeAssinatura,
        font: fontRegular,
      });
    };

    desenharAssinatura(gestao.coordenadorLiga, 165);
    desenharAssinatura(gestao.presidenteDelamu, 841.89 / 2); 
    desenharAssinatura(gestao.coordenadorCurso, 680);

/*===================================== PÁGINA 2 (VERSO) =========================================*/
    const page2 = pdfDoc.addPage([841.89, 595.28]);
    const imgVerso = await pdfDoc.embedPng(templateVerso);
    page2.drawImage(imgVerso, { x: 0, y: 0, width: 841.89, height: 595.28 });

    // --- 1. CONFIGURAÇÕES DA TABELA ---
    const margemEsquerda = 50;
    const larguraTotal = page2.getWidth() - 100;
    const alturaLinha = 22; 
    const limiteInferior = 80; 

    const colunas = {
      data: 80, local: 100, horas: 50, tema: 280, palestrante: 180
    };

    // --- 2. FUNÇÃO PARA DESENHAR O CABEÇALHO ---
    const desenharCabecalhoManual = (pagina: any, y: number) => {
      pagina.drawLine({ start: { x: margemEsquerda, y }, end: { x: margemEsquerda + larguraTotal, y }, thickness: 1 });
      const yTexto = y - 15;
      const estiloT = { size: 10, font: fontBold };
      pagina.drawText('Data', { x: margemEsquerda + 5, y: yTexto, ...estiloT });
      pagina.drawText('Local', { x: margemEsquerda + colunas.data + 5, y: yTexto, ...estiloT });
      pagina.drawText('Horas', { x: margemEsquerda + colunas.data + colunas.local + 5, y: yTexto, ...estiloT });
      pagina.drawText('Tema', { x: margemEsquerda + colunas.data + colunas.local + colunas.horas + 5, y: yTexto, ...estiloT });
      pagina.drawText('Palestrante', { x: margemEsquerda + colunas.data + colunas.local + colunas.horas + colunas.tema + 5, y: yTexto, ...estiloT });
      pagina.drawLine({ start: { x: margemEsquerda, y: y - 22 }, end: { x: margemEsquerda + larguraTotal, y: y - 22 }, thickness: 1 });
      return y - 22;
    };

    // --- 3. PROCESSO DE DESENHO DINÂMICO ---
    let paginaAtual = page2;
    let yAtual = 460; // Começa na posição correta do verso do CEUB
    yAtual = desenharCabecalhoManual(paginaAtual, yAtual);

    if (cronograma && cronograma.length > 0) {
      cronograma.forEach((aula: any) => {
        const dataAulaRaw = String(aula['Data'] || "").trim();
        if (!dataAulaRaw) return;

        // Lógica de busca de presença na planilha
        const dataNormalizada = dataAulaRaw.replace(/\D/g, "");
        const chaveObj = Object.keys(aluno).find(key => String(key).replace(/\D/g, "") === dataNormalizada);
        const presenca = chaveObj ? limparValor(aluno[chaveObj]) : "";

        if (presenca !== "" && presenca !== "00:00:00") {
          // Salto de página automático
          if (yAtual - alturaLinha < limiteInferior) {
            paginaAtual = pdfDoc.addPage([841.89, 595.28]);
            yAtual = 550; // Em novas páginas, começamos mais alto
            yAtual = desenharCabecalhoManual(paginaAtual, yAtual);
          }

          const yTexto = yAtual - 15;
          paginaAtual.drawText(dataAulaRaw, { x: margemEsquerda + 5, y: yTexto, size: 9, font: fontRegular });
          paginaAtual.drawText(limparValor(aula['Local']), { x: margemEsquerda + colunas.data + 5, y: yTexto, size: 9, font: fontRegular });
          paginaAtual.drawText(presenca, { x: margemEsquerda + colunas.data + colunas.local + 5, y: yTexto, size: 9, font: fontRegular });
          
          const tema = limparValor(aula['Tema']);
          const temaCurto = tema.length > 55 ? tema.substring(0, 52) + "..." : tema;
          paginaAtual.drawText(temaCurto, { x: margemEsquerda + colunas.data + colunas.local + colunas.horas + 5, y: yTexto, size: 8, font: fontRegular });
          
          paginaAtual.drawText(limparValor(aula['Palestrante']), { x: margemEsquerda + colunas.data + colunas.local + colunas.horas + colunas.tema + 5, y: yTexto, size: 8, font: fontRegular });

          yAtual -= alturaLinha;
          paginaAtual.drawLine({ start: { x: margemEsquerda, y: yAtual }, end: { x: margemEsquerda + larguraTotal, y: yAtual }, thickness: 1 });
          
          // Linhas Verticais
          const xPts = [0, colunas.data, colunas.data+colunas.local, colunas.data+colunas.local+colunas.horas, colunas.data+colunas.local+colunas.horas+colunas.tema, larguraTotal];
          xPts.forEach(xPos => {
            paginaAtual.drawLine({ start: { x: margemEsquerda+xPos, y: yAtual+alturaLinha }, end: { x: margemEsquerda+xPos, y: yAtual }, thickness: 1 });
          });
        }
      });
    } else {
      page2.drawText("CRONOGRAMA NÃO ENCONTRADO", { x: 250, y: 300, size: 15, font: fontBold, color: rgb(0.8, 0, 0) });
    }

    const pdfBytes = await pdfDoc.save();
    const nomeArquivo = nome.replace(/[^a-z0-9]/gi, '_');
    zip.file(`Certificado_${nomeArquivo}.pdf`, pdfBytes);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'certificados_delamu.zip');
};