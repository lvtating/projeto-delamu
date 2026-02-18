'use client';

import { useState, useEffect } from 'react'; // Adicionado useEffect
import * as XLSX from 'xlsx';
import { gerarZipCertificados } from '../utilidades/certificador';

export default function GeradorPage() {
  const [dados, setDados] = useState<any[]>([]);
  const [template, setTemplate] = useState<Uint8Array | null>(null);

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
      // ADICIONADO: cellDates: true e raw: false para melhor leitura
      const wb = XLSX.read(bstr, { 
        type: 'binary',
        cellDates: true, 
        cellText: false 
      });
      
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      // O sheet_to_json agora vai receber datas reais
      const data = XLSX.utils.sheet_to_json(ws);
      
      console.log("Conteúdo do Excel:", data); 
      setDados(data);
      alert(`${data.length} nomes carregados com sucesso!`);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <main className="min-h-screen p-8 bg-[#FFFFF0] flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4 text-[#800000]">Gerador DeLAMU</h1>
      <p className="mb-8 text-black">O template já está carregado. Basta subir o Excel.</p>
      
      <div className="bg-[#FFFFF0] p-6 rounded-lg shadow-md w-full max-w-md space-y-6">
        <div className="border-2 border-dashed border-gray-200 p-4 rounded-lg">
          <label className="block text-sm font-medium mb-2 text-gray-700">Suba a Planilha de Dados (Excel)</label>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleExcelUpload} 
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#800000] file:text-white hover:file:bg-[#8B0000]/70" 
          />
        </div>

        <div className="text-xs text-gray-400">
          {template ? "✅ Template carregado" : "⏳ Carregando template..."}
        </div>

        <button
          onClick={() => template && dados.length > 0 && gerarZipCertificados(dados, template)}
          disabled={!template || dados.length === 0}
          className="w-full bg-[#800000] text-white py-3 rounded-md font-semibold hover:bg-[#8B0000]/70 disabled:bg-[#8B0000]/70 transition-colors"
        >
          {dados.length > 0 ? `Gerar ${dados.length} Certificados (.ZIP)` : "Aguardando Excel..."}
        </button>
      </div>
    </main>
  );
}