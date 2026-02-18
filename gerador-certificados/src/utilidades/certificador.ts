import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const gerarZipCertificados = async (
  dados: any[], 
  templateImageUint8: Uint8Array, 
  gestao: { coordenadorLiga: string; presidenteDelamu: string; coordenadorCurso: string; }
) => {
  const zip = new JSZip();

  // Carregamento das fontes
  const [boldBytes, regularBytes] = await Promise.all([
    fetch('/fonts/JosefinSlab-Bold.ttf').then(res => res.arrayBuffer()),
    fetch('/fonts/JosefinSlab-Regular.ttf').then(res => res.arrayBuffer())
  ]);

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

  for (const pessoa of dados) {
    // Identificação do nome
    const nomeBruto = pessoa['Nome'] || pessoa['Nome Completo'] || Object.values(pessoa)[0];
    const nome = String(nomeBruto || '').trim().toUpperCase();

    if (!nomeBruto || nome === 'UNDEFINED' || nome === '') continue;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontBold = await pdfDoc.embedFont(boldBytes);
    const fontRegular = await pdfDoc.embedFont(regularBytes);

    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();

    const image = await pdfDoc.embedPng(templateImageUint8);
    page.drawImage(image, { x: 0, y: 0, width, height });

    const limparValor = (valor: any) => {
      if (valor === undefined || valor === null || valor === 'undefined') return '';
      return String(valor).trim();
    };

    // Dados da Planilha
    const cargo = limparValor(pessoa['Cargo'] || 'Membro');
    const liga = limparValor(pessoa['Liga'] || 'DeLAMU');
    const mesInicio = limparValor(pessoa['Início'] || pessoa['Inicio']);
    const mesFim = limparValor(pessoa['Conclusão'] || pessoa['Conclusao']);
    const ano = limparValor(pessoa['Ano'] || '2025');

    // Formatação de horas para X:XX
    let horasRaw = limparValor(pessoa['Horas'] || '0');
    let horasExibicao = "";

    if (horasRaw.includes(':')) {
      horasExibicao = horasRaw;
    } else if (horasRaw.includes('.') && parseFloat(horasRaw) < 1) {
      const numHoras = Math.round(parseFloat(horasRaw) * 24);
      horasExibicao = `${numHoras}:00`;
    } else {
      horasExibicao = `${horasRaw}:00`;
    }

    // 1. Desenhar Nome do Aluno
    const nomeSize = 38;
    const nomeWidth = fontBold.widthOfTextAtSize(nome, nomeSize);
    page.drawText(nome, {
      x: (width / 2) - (nomeWidth / 2),
      y: 325,
      size: nomeSize,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // 2. Desenhar Frase Principal
    const fraseCorpo = `Pela participação na condição de ${cargo} da Liga Acadêmica de ${liga} do CEUB, durante os meses de ${mesInicio} a ${mesFim} de ${ano}, totalizando ${horasExibicao} horas complementares.`;
    
    const fontSizeCorpo = 17;
    const maxWidth = 650;
    const linhasTexto = wrapText(fraseCorpo, maxWidth, fontRegular, fontSizeCorpo);

    linhasTexto.forEach((linha, index) => {
      const lineWidth = fontRegular.widthOfTextAtSize(linha, fontSizeCorpo);
      page.drawText(linha, {
        x: (width / 2) - (lineWidth / 2),
        y: 260 - (index * 22), 
        size: fontSizeCorpo,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      });
    });

    // 3. Desenhar Assinaturas Dinâmicas
    const fontSizeAssinatura = 11;
    
    const desenharAssinatura = (texto: string, xCentro: number) => {
      const txt = (texto || "").toUpperCase();
      const txtWidth = fontRegular.widthOfTextAtSize(txt, fontSizeAssinatura);
      page.drawText(txt, {
        x: xCentro - (txtWidth / 2),
        y: 110,
        size: fontSizeAssinatura,
        font: fontRegular,
      });
    };

    desenharAssinatura(gestao.coordenadorLiga, 165);
    desenharAssinatura(gestao.presidenteDelamu, width / 2);
    desenharAssinatura(gestao.coordenadorCurso, 680);

    const pdfBytes = await pdfDoc.save();
    const nomeArquivo = nome.replace(/[^a-z0-9]/gi, '_');
    zip.file(`Certificado_${nomeArquivo}.pdf`, pdfBytes);
  }

  // Gera e salva o ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'certificados_delamu.zip');
};