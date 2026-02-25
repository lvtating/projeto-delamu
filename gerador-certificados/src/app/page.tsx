'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { gerarZipCertificados } from '../utilidades/certificador';

export default function GeradorPage() {
  //armazena alunos e cronograma
  const [dados, setDados] = useState<{ alunos: any[], cronograma: any[] } | null>(null);
  const [templateFrente, setTemplateFrente] = useState<Uint8Array | null>(null);
  const [templateVerso, setTemplateVerso] = useState<Uint8Array | null>(null);
  
  const [gestao, setGestao] = useState({
    coordenadorLiga: "",
    presidenteDelamu: "",
    coordenadorCurso: ""
  });

  // carrega frente e verso automaticamente
  useEffect(() => {
    const carregarTemplates = async () => {
      try {
        const [resFrente, resVerso] = await Promise.all([
          fetch('/certificado.png'),
          fetch('/versocertificado.png')
        ]);
        
        if (!resFrente.ok || !resVerso.ok) throw new Error("Templates não encontrados na pasta public");
        
        const [bufferFrente, bufferVerso] = await Promise.all([
          resFrente.arrayBuffer(),
          resVerso.arrayBuffer()
        ]);

        setTemplateFrente(new Uint8Array(bufferFrente));
        setTemplateVerso(new Uint8Array(bufferVerso));
        console.log("Templates carregados com sucesso!");
      } catch (error) {
        console.error("Erro ao carregar templates:", error);
      }
    };
    carregarTemplates();
  }, []);

const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        
        const matriz: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        let listaAlunos: any[] = [];
        let listaCrono: any[] = [];
        
        // 1. nome dos alunos
        const indexLinhaAlunos = matriz.findIndex(row => row.some(cell => String(cell).trim() === "Nome"));
        if (indexLinhaAlunos !== -1) {
          const cabecalho = matriz[indexLinhaAlunos].map(c => String(c).trim());
          // pega as células de baixo até encontrar uma linha vazia ou a tabela de aulas
          for (let i = indexLinhaAlunos + 1; i < matriz.length; i++) {
            const linha = matriz[i];
            if (!linha[cabecalho.indexOf("Nome")]) break; // quebra o loop se não houver nome
            if (linha.some(cell => String(cell).trim() === "Data")) break; // quebra o loop se encontrar a linha de cronograma ("data")
            
            const obj: any = {};
            cabecalho.forEach((label, idx) => { if(label) obj[label] = linha[idx]; });
            listaAlunos.push(obj);
          }
        }

        // 2. extração do cronograma de aulas (segunda planilha)
        const indexLinhaCrono = matriz.findIndex(row => row.some(cell => String(cell).trim() === "Data"));
        
        if (indexLinhaCrono !== -1) {
          const cabecalhoCrono = matriz[indexLinhaCrono].map(c => String(c).trim());
          for (let i = indexLinhaCrono + 1; i < matriz.length; i++) {
            const linha = matriz[i];
            if (!linha[cabecalhoCrono.indexOf("Data")]) continue; 

            const obj: any = {};
            cabecalhoCrono.forEach((label, idx) => { 
              if(label) obj[label] = linha[idx]; 
            });
            listaCrono.push(obj);
          }
        }

        console.log("Alunos:", listaAlunos);
        console.log("Aulas:", listaCrono);

        setDados({ alunos: listaAlunos, cronograma: listaCrono });
        alert(`${listaAlunos.length} nomes e ${listaCrono.length} aulas carregadas!`);

      } catch (err) {
        console.error("Erro Crítico:", err);
        alert("Erro ao processar. Veja o console (F12).");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <main className="w-full min-h-screen flex flex-col items-center p-8 bg-no-repeat bg-bottom bg-cover" style={{ backgroundImage: 'url(/background.svg)' }}>
      <h1 className="text-3xl font-bold mb-6 text-[#a62828]">Gerador DeLAMU</h1>
      
      {/*primeiro container*/}
      <div className="bg-[#f4f1e9]/60 p-6 rounded-lg shadow-md w-full max-w-md space-y-4 mb-6 border border-gray-100">
        <h2 className="font-bold text-[#a62828] border-b pb-2 flex items-center gap-2">
          <span>✍️</span> Assinaturas do Certificado
        </h2>
        
        <div>
          <label className="block text-xs font-semibold text-[#1a1817] uppercase">Coordenador da Liga</label>
          <input 
            type="text" 
            value={gestao.coordenadorLiga}
            onChange={(e) => setGestao({...gestao, coordenadorLiga: e.target.value})}
            className="w-full border p-2 rounded text-sm text-black focus:ring-2 focus:ring-[#800000] outline-none"
            placeholder="Nome à esquerda"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1a1817] uppercase">Presidente do DeLAMU</label>
          <input 
            type="text" 
            value={gestao.presidenteDelamu}
            onChange={(e) => setGestao({...gestao, presidenteDelamu: e.target.value})}
            className="w-full border p-2 rounded text-sm text-black focus:ring-2 focus:ring-[#800000] outline-none"
            placeholder="Nome ao centro"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1a1817] uppercase">Coordenador do Curso</label>
          <input 
            type="text" 
            value={gestao.coordenadorCurso}
            onChange={(e) => setGestao({...gestao, coordenadorCurso: e.target.value})}
            className="w-full border p-2 rounded text-sm text-black focus:ring-2 focus:ring-[#800000] outline-none"
            placeholder='Nome à direita'
          />
        </div>
      </div>

      {/*segundo container*/}
      <div className="bg-[#f4f1e9]/60 p-6 rounded-lg shadow-md w-full max-w-md space-y-6 border border-gray-100">
        <div className="border-2 border-dashed border-gray-200 p-4 rounded-lg hover:border-[#800000] transition-colors">
          <label className="block text-sm font-medium mb-2 text-gray-500">1. Suba a Planilha Única</label>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleExcelUpload} 
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:hover:bg-[#c47c74] file:bg-[#a62828] file:text-white" 
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={templateFrente && templateVerso ? "text-green-600 font-bold" : "text-amber-600"}>
            {templateFrente && templateVerso ? "✅ Templates Prontos" : "⏳ Carregando Imagens..."}
          </span>
          <span className={dados ? "text-green-600 font-bold" : "text-gray-400"}>
            {dados ? `✅ ${dados.alunos.length} alunos` : "❌ Sem dados"}
          </span>
        </div>

        <button
          onClick={() => dados && templateFrente && templateVerso && gerarZipCertificados(dados.alunos, dados.cronograma, templateFrente, templateVerso, gestao)}
          disabled={!templateFrente || !templateVerso || !dados || !gestao.coordenadorLiga || !gestao.presidenteDelamu || !gestao.coordenadorCurso}
          className="w-full bg-[#800000] text-white py-4 rounded-md font-bold hover:bg-[#c47c74] disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          {dados ? `2. GERAR CERTIFICADOS (.ZIP)` : "Aguardando Excel..."}
        </button>
      </div>
    </main>
  );
}