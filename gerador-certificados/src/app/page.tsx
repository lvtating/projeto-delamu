'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { gerarZipCertificados } from '../utilidades/certificador';

export default function GeradorPage() {
  const [dados, setDados] = useState<any[]>([]);
  const [template, setTemplate] = useState<Uint8Array | null>(null);
  
  // Estado para os nomes que o cliente vai preencher na tela
  const [gestao, setGestao] = useState({
    coordenadorLiga: "",
    presidenteDelamu: "",
    coordenadorCurso: ""
  });

  // Carrega o template automaticamente ao abrir a página
  useEffect(() => {
    const carregarTemplate = async () => {
      try {
        const response = await fetch('/certificado.png');
        if (!response.ok) throw new Error("Template não encontrado na pasta public");
        const arrayBuffer = await response.arrayBuffer();
        setTemplate(new Uint8Array(arrayBuffer));
        console.log("Template carregado com sucesso!");
      } catch (error) {
        console.error("Erro ao carregar template:", error);
      }
    };
    carregarTemplate();
  }, []);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      // raw: false garante que o Excel leia "Julho" como texto e não como data interna
      const wb = XLSX.read(bstr, { type: 'binary', raw: false });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      console.log("Conteúdo do Excel carregado:", data[0]); 
      setDados(data);
      alert(`${data.length} nomes carregados com sucesso!`);
    };
    reader.readAsBinaryString(file);
  };
//FFFFF0
  return (
    <main className="min-h-screen p-8 bg-[#F5F2D0] flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-[#800000]">Gerador DeLAMU</h1>
      
      {/* SEÇÃO 1: NOMES DAS ASSINATURAS (Para o cliente preencher) */}
      <div className="bg-[#FFFFF0] p-6 rounded-lg shadow-md w-full max-w-md space-y-4 mb-6 border border-gray-100">
        <h2 className="font-bold text-[#800000] border-b pb-2 flex items-center gap-2">
          <span>✍️</span> Assinaturas do Certificado
        </h2>
        
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase">Coordenador da Liga</label>
          <input 
            type="text" 
            value={gestao.coordenadorLiga}
            onChange={(e) => setGestao({...gestao, coordenadorLiga: e.target.value})}
            className="w-full border p-2 rounded text-sm text-black focus:ring-2 focus:ring-[#800000] outline-none"
            placeholder="Nome que aparecerá à esquerda"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase">Presidente do DeLAMU</label>
          <input 
            type="text" 
            value={gestao.presidenteDelamu}
            onChange={(e) => setGestao({...gestao, presidenteDelamu: e.target.value})}
            className="w-full border p-2 rounded text-sm text-black focus:ring-2 focus:ring-[#800000] outline-none"
            placeholder="Nome que aparecerá no centro"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase">Coordenador do Curso</label>
          <input 
            type="text" 
            value={gestao.coordenadorCurso}
            onChange={(e) => setGestao({...gestao, coordenadorCurso: e.target.value})}
            className="w-full border p-2 rounded text-sm text-black focus:ring-2 focus:ring-[#800000] outline-none"
            placeholder='Nome que aparecerá à direita'
          />
        </div>
      </div>

      {/* SEÇÃO 2: UPLOAD E GERAÇÃO */}
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md space-y-6 border border-gray-100">
        <div className="border-2 border-dashed border-gray-200 p-4 rounded-lg hover:border-[#800000] transition-colors">
          <label className="block text-sm font-medium mb-2 text-gray-700">1. Suba a Planilha (Excel)</label>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleExcelUpload} 
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#800000] file:text-white hover:file:bg-[#8B0000]" 
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={template ? "text-green-600 font-bold" : "text-amber-600"}>
            {template ? "✅ Template Pronto" : "⏳ Carregando Template..."}
          </span>
          <span className={dados.length > 0 ? "text-green-600 font-bold" : "text-gray-400"}>
            {dados.length > 0 ? `✅ ${dados.length} nomes` : "❌ Sem dados"}
          </span>
        </div>

        <button
          onClick={() => template && dados.length > 0 && gerarZipCertificados(dados, template, gestao)}
          disabled={!template || dados.length === 0 || !gestao.coordenadorLiga || !gestao.presidenteDelamu}
          className="w-full bg-[#800000] text-white py-4 rounded-md font-bold hover:bg-[#8B0000] disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          {dados.length > 0 ? `2. GERAR CERTIFICADOS (.ZIP)` : "Aguardando Excel..."}
        </button>
      </div>
    </main>
  );
}