import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const gerarZipCertificados = async (dados: any[], templateImageUint8: Uint8Array) => {
  const zip = new JSZip();

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
    // 1. Identificação do Nome (Primeira coluna ou 'Nome')
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

    // --- TRATAMENTO DE DADOS (Focado no seu Excel) ---
    const limparValor = (valor: any) => {
      if (valor === undefined || valor === null || valor === 'undefined') return '';
      return String(valor).trim();
    };

    const cargo = limparValor(pessoa['Cargo'] || 'Membro');
    const liga = limparValor(pessoa['Liga'] || 'DeLAMU');
    
    // Prioridade total para os nomes exatos da sua planilha
    const mesInicio = limparValor(pessoa['Início'] || pessoa['Inicio']);
    const mesFim = limparValor(pessoa['Conclusão'] || pessoa['Conclusao']);
    const ano = limparValor(pessoa['Ano'] || '2025');

    // horas: x:xx
    let horasRaw = limparValor(pessoa['Horas'] || '0');
    let horasExibicao = "";

    if (horasRaw.includes(':')) {
      // Se já vier "05:00", garantimos que não tenha espaços e usamos como está
      horasExibicao = horasRaw;
    } else if (horasRaw.includes('.') && parseFloat(horasRaw) < 1) {
      // Se vier como fração do Excel (0.4166), converte para o número e adiciona :00
      const numHoras = Math.round(parseFloat(horasRaw) * 24);
      horasExibicao = `${numHoras}:00`;
    } else {
      // Se vier apenas o número (ex: "10"), adiciona o :00
      horasExibicao = `${horasRaw}:00`;
    }

    // --- DESENHO DOS TEXTOS ---

    // 1. Nome do Aluno
    const nomeSize = 38;
    const nomeWidth = fontBold.widthOfTextAtSize(nome, nomeSize);
    page.drawText(nome, {
      x: (width / 2) - (nomeWidth / 2),
      y: 325,
      size: nomeSize,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // 2. Frase do Corpo (Dinâmica)
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

    // 3. Assinaturas (Nomes fixos ou via Excel)
    const fontSizeAssinatura = 11;
    
    const nomeCoord = limparValor(pessoa['Coordenador'] || 'COORDENADOR DA LIGA');
    const coordWidth = fontRegular.widthOfTextAtSize(nomeCoord.toUpperCase(), fontSizeAssinatura);
    page.drawText(nomeCoord.toUpperCase(), {
      x: 201 - (coordWidth / 2),
      y: 175,
      size: fontSizeAssinatura,
      font: fontRegular,
    });

    const nomePres = limparValor(pessoa['Presidente'] || 'PRESIDENTE DO DELAMU');
    const presWidth = fontRegular.widthOfTextAtSize(nomePres.toUpperCase(), fontSizeAssinatura);
    page.drawText(nomePres.toUpperCase(), {
      x: (width / 2) - (presWidth / 2),
      y: 175,
      size: fontSizeAssinatura,
      font: fontRegular,
    });

    const nomeCurso = "NEULÂNIO FRANCISCO DE OLIVEIRA";
    const cursoWidth = fontRegular.widthOfTextAtSize(nomeCurso, fontSizeAssinatura);
    page.drawText(nomeCurso, {
      x: 640 - (cursoWidth / 2),
      y: 175,
      size: fontSizeAssinatura,
      font: fontRegular,
    });

    const pdfBytes = await pdfDoc.save();
    const nomeArquivo = nome.replace(/[^a-z0-9]/gi, '_');
    zip.file(`Certificado_${nomeArquivo}.pdf`, pdfBytes);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'certificados_delamu.zip');
};