'use client';

import { traduzirErro } from '@/lib/traduzir-erro';

import React, { useState, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Simple, robust-ish CSV parser that handles quoted fields with commas and newlines.
 * Returns array of rows (arrays of strings).
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let col: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' ) {
      if (inQuotes && next === '"') { // escaped quote
        cur += '"';
        i++; // skip next
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      col.push(cur);
      cur = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // handle \r\n
      if (ch === '\r' && next === '\n') { i++; }
      col.push(cur);
      rows.push(col);
      cur = '';
      col = [];
      continue;
    }
    cur += ch;
  }
  // push last
  if (cur !== '' || col.length) {
    col.push(cur);
    rows.push(col);
  }
  return rows;
}

type Mapping = { csvIndex: number | null; tableCol: string };

export default function AdminCsvImporter({ defaultTable = 'missions' }: { defaultTable?: 'missions' | 'sos_tools' }) {
  const supabase = createClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, Mapping>>({});
  const [targetTable, setTargetTable] = useState<'missions'|'sos_tools'>(defaultTable);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const fileRef = useRef<HTMLInputElement|null>(null);

  const tableColumns = {
    missions: ['title','description','type','reward_xp','reward_coins','premium_only','category','difficulty','created_at'],
    sos_tools: ['title','description','duration_minutes','audio_url','thumbnail','tags','steps_json','is_audio','premium_only','category','duration_minutes','created_at'],
  };

  function resetAll() {
    setFileName(null); setHeaders([]); setRowsPreview([]); setMapping({}); setErrors([]); setSuccessCount(0); setFailCount(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    resetAll();
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const txt = await f.text();
    // parse
    const parsed = parseCSV(txt);
    if (parsed.length === 0) {
      setErrors(['CSV vazio ou inválido']);
      return;
    }
    // treat first row as headers
    const hdr = parsed[0].map(h => h.trim());
    setHeaders(hdr);
    // preview first N rows
    const preview = parsed.slice(1, 1 + 10);
    setRowsPreview(preview);
    // create default mapping (try to auto-match)
    const mapInit: Record<string, Mapping> = {};
    tableColumns[targetTable].forEach(col => {
      const idx = hdr.findIndex(h => h.toLowerCase() === col.toLowerCase() || h.toLowerCase() === col.replace('_',' ').toLowerCase());
      mapInit[col] = { csvIndex: idx >= 0 ? idx : null, tableCol: col };
    });
    setMapping(mapInit);
  }

  function updateMapping(col: string, csvIndex: number|null) {
    setMapping(m => ({ ...m, [col]: { csvIndex, tableCol: col } }));
  }

  function mapValue(raw: string, targetCol: string) {
    if (raw == null) return null;
    const s = raw.trim();
    if (s === '') return null;
    // conservative type coercion
    if (targetCol === 'reward_xp' || targetCol === 'reward_coins' || targetCol === 'duration_minutes') {
      const n = Number(s.replace(/\D+/g, ''));
      return isNaN(n) ? null : n;
    }
    if (targetCol === 'premium_only' || targetCol === 'is_audio') {
      const l = s.toLowerCase();
      return (l === 'true' || l === '1' || l === 'sim' || l === 'yes' || l === 'y');
    }
    if (targetCol === 'tags') {
      // comma-separated tags
      return s.split(/[,;]/).map(t => t.trim()).filter(Boolean);
    }
    if (targetCol === 'steps_json') {
      // try parse JSON, or split by | into array
      try {
        const p = JSON.parse(s);
        return p;
      } catch {
        if (s.includes('|')) return s.split('|').map(x => x.trim()).filter(Boolean);
        return s;
      }
    }
    return s;
  }

  // build payload row for a csv row (array of strings)
  function buildPayloadRow(csvRow: string[]): Record<string, any> {
    const out: Record<string, any> = {};
    Object.keys(mapping).forEach(targetCol => {
      const m = mapping[targetCol];
      if (m && typeof m.csvIndex === 'number' && csvRow[m.csvIndex] !== undefined) {
        out[targetCol] = mapValue(csvRow[m.csvIndex], targetCol);
      }
    });
    return out;
  }

  async function handleImport({ chunkSize = 50 }: { chunkSize?: number }) {
    setErrors([]); setSuccessCount(0); setFailCount(0);
    if (!fileRef.current || !fileRef.current.files || fileRef.current.files.length === 0) {
      setErrors(['Selecione um arquivo primeiro.']);
      return;
    }
    setLoading(true);
    try {
      const f = fileRef.current.files[0];
      const txt = await f.text();
      const parsed = parseCSV(txt);
      if (parsed.length <= 1) {
        setErrors(['CSV contém apenas cabeçalho. Nada para importar.']);
        setLoading(false);
        return;
      }
      const hdr = parsed[0];
      const dataRows = parsed.slice(1);
      // build payloads
      const payloads: Record<string, any>[] = dataRows.map(r => buildPayloadRow(r));
      // validate basic: ensure "title" exists for missions/sos_tools
      const toInsert = payloads.filter(p => {
        if (targetTable === 'missions') return !!(p.title || p['title']);
        if (targetTable === 'sos_tools') return !!(p.title || p['title']);
        return true;
      });
      let successes = 0;
      let fails = 0;
      // chunk inserts
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        // transform: some fields must be jsonb or arrays (tags/steps_json)
        const transformed = chunk.map(row => {
          const copy = { ...row };
          // ensure booleans are booleans, arrays remain arrays
          if (copy.tags && !Array.isArray(copy.tags)) copy.tags = String(copy.tags).split(',').map((t:string)=>t.trim()).filter(Boolean);
          // steps_json kept as-is (array or object)
          // premium_only: ensure boolean
          if (copy.premium_only !== undefined) copy.premium_only = !!copy.premium_only;
          if (copy.is_audio !== undefined) copy.is_audio = !!copy.is_audio;
          return copy;
        });

        const { data, error } = await supabase.from(targetTable).insert(transformed);
        if (error) {
          // on error, attempt row-by-row to capture specific failures
          console.warn('chunk insert error', error, 'trying row-by-row');
          for (const row of transformed) {
            const { data: d2, error: e2 } = await supabase.from(targetTable).insert([row]);
            if (e2) {
              fails++; setErrors(prev => [...prev, `Linha com title="${row.title ?? '—'}" falhou: ${traduzirErro(e2, 'Erro ao importar esta linha.')}`]);
            } else {
              successes++;
            }
          }
        } else {
          successes += (data?.length ?? 0);
        }
      }

      setSuccessCount(successes);
      setFailCount(fails);
      if (fails === 0) {
        // reload admin page (optional) — we'll just notify success
      }
    } catch (err:any) {
      console.error('import error', err);
      setErrors([traduzirErro(err, 'Erro ao importar o arquivo.')]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow">
      <h3 className="font-semibold mb-2">Importador CSV (Admin)</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600">Tabela destino</label>
          <select value={targetTable} onChange={(e)=> { setTargetTable(e.target.value as any); resetAll(); }} className="w-full p-2 border rounded">
            <option value="missions">missions</option>
            <option value="sos_tools">sos_tools</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-600">Arquivo CSV</label>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="w-full" />
        </div>
      </div>

      {fileName && <div className="mt-3 text-sm text-gray-600">Arquivo carregado: <strong>{fileName}</strong></div>}

      {headers && headers.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-semibold mb-2">Mapeamento de colunas (revise antes de importar)</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tableColumns[targetTable].map(col => (
              <div key={col} className="flex items-center gap-2">
                <div className="w-36 text-sm">{col}</div>
                <select value={mapping[col]?.csvIndex ?? ''} onChange={(e) => updateMapping(col, e.target.value===''?null:Number(e.target.value))} className="flex-1 p-2 border rounded text-sm">
                  <option value="">-- não mapear --</option>
                  {headers.map((h, idx) => <option key={idx} value={idx}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-3 text-sm">
            <div className="font-semibold">Preview (primeiras 10 linhas)</div>
            <div className="overflow-auto border rounded mt-2">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((h, i) => <th key={i} className="px-2 py-1 text-left">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rowsPreview.map((r, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {headers.map((_, ci) => <td key={ci} className="p-1 px-2">{r[ci]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => handleImport({ chunkSize: 50 })} className="px-4 py-2 bg-purple-600 text-white rounded" disabled={loading}>
              {loading ? 'Importando...' : 'Importar CSV'}
            </button>
            <button onClick={resetAll} className="px-4 py-2 border rounded">Reset</button>
          </div>
        </div>
      )}

      {(successCount > 0 || failCount > 0 || errors.length > 0) && (
        <div className="mt-4">
          <div className="text-sm text-green-700">Sucesso: {successCount}</div>
          <div className="text-sm text-red-700">Falhas: {failCount}</div>
          {errors.length > 0 && (
            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700 max-h-48 overflow-auto">
              {errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
