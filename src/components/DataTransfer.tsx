import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Upload } from 'lucide-react';
import { api, type ImportReport } from '../lib/api';
import { STORE_CURRENCY } from '../lib/store';
import { useT } from '../lib/locale-context';
import { Modal } from './Modal';

const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 min-h-[36px]';

const TEMPLATE = 'handle,title,description,description_fr,description_en,tags,status,video_url,image_url,sku,variant_title,price,weight_g,type,stock,variant_image_url\r\n'
  + 'savon-karite,Savon au karité,,Savon artisanal au karité du Bénin.,Handmade shea butter soap from Benin.,bio;peau,active,,https://example.com/savon.jpg,SAV-100,100 g,2500,100,physical,20,\r\n'
  + 'savon-karite,,,,,,,,,SAV-200,200 g,4000,200,physical,10,\r\n'
  + 'guide-sante,Guide santé naturelle (PDF),,,,ebook,active,,,GUIDE-PDF,PDF,5000,,digital,,\r\n'
  + 'coaching-bien-etre,Séance de coaching bien-être,,,,service,active,,,COACH-60,60 min,25000,,service,,\r\n';

/** Download one of the CSV exports. Icon only on a phone. */
export function ExportButton({ kind, params }: { kind: 'products' | 'orders' | 'customers'; params?: Record<string, string> }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({ mutationFn: () => api.exportCsv(kind, { currency: STORE_CURRENCY, ...params }), onError: (e) => setError(e instanceof Error ? e.message : String(e)) });
  return (
    <>
      <button type="button" className={`${btn} tap`} style={ghost} aria-label={t('data.export')} title={error ?? undefined} disabled={run.isPending} onClick={() => { setError(null); run.mutate(); }}>
        {run.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        <span className="hidden sm:inline">{t('data.export')}</span>
      </button>
      {error && <span className="text-xs" style={{ color: 'var(--danger, #dc2626)' }}>{error}</span>}
    </>
  );
}

/** Orders export with an optional date range. */
export function OrdersExport() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => api.exportCsv('orders', { from, to }),
    onSuccess: () => setOpen(false), onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });
  const input = 'w-full px-3 py-2 text-sm rounded-lg';
  const style = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
  return (
    <>
      <button type="button" className={`${btn} tap`} style={ghost} aria-label={t('data.export')} onClick={() => { setError(null); setOpen(true); }}>
        <Download size={14} /><span className="hidden sm:inline">{t('data.export')}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('data.exportOrders')} size="sm">
        <div className="space-y-3" data-testid="orders-export">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('data.exportOrdersHelp')}</p>
          <label className="block text-xs">{t('data.from')}<input type="date" className={input} style={style} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="block text-xs">{t('data.to')}<input type="date" className={input} style={style} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          {error && <p className="text-xs" style={{ color: 'var(--danger, #dc2626)' }}>{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btn} style={ghost} onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="button" className={btn} style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }} disabled={run.isPending} onClick={() => { setError(null); run.mutate(); }}>
              {run.isPending && <Loader2 size={14} className="animate-spin" />}{t('data.download')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Choose a CSV, see what would change, then confirm. Nothing is written until every row is valid. */
export function ImportProductsButton() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setCsv(null); setName(''); setReport(null); setError(null); if (fileRef.current) fileRef.current.value = ''; };
  const check = useMutation({
    mutationFn: (text: string) => api.importProducts(text, { dryRun: true, currency: STORE_CURRENCY }),
    onSuccess: setReport, onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });
  const apply = useMutation({
    mutationFn: () => api.importProducts(csv!, { dryRun: false, currency: STORE_CURRENCY }),
    onSuccess: (r) => { setReport(r); if (r.applied) { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); } },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });
  const onFile = async (f: File | undefined) => {
    setReport(null); setError(null);
    if (!f) return;
    if (f.size > 2_000_000) { setError(t('data.tooLarge')); return; }
    const text = await f.text();
    setCsv(text); setName(f.name); check.mutate(text);
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'products-template.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const s = report?.summary;
  const changes = s ? s.products_create + s.products_update + s.variants_create + s.variants_update : 0;

  return (
    <>
      <button type="button" className={`${btn} tap`} style={ghost} aria-label={t('data.import')} data-testid="import-open" onClick={() => { reset(); setOpen(true); }}>
        <Upload size={14} /><span className="hidden sm:inline">{t('data.import')}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('data.importTitle')} size="lg">
        <div className="space-y-4" data-testid="import-modal">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('data.importHelp').replace('{cur}', STORE_CURRENCY)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" data-testid="import-file" className="text-sm max-w-full" onChange={(e) => onFile(e.target.files?.[0])} />
            <button type="button" className="tap text-xs underline" style={{ color: 'var(--text-secondary)' }} onClick={downloadTemplate}>{t('data.template')}</button>
          </div>
          {(check.isPending || apply.isPending) && <p className="text-xs flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{t('data.checking')}</p>}
          {error && <p className="text-xs" style={{ color: 'var(--danger, #dc2626)' }}>{error}</p>}

          {report && s && (
            <div className="rounded-lg p-3 text-sm space-y-2" style={{ border: '1px solid var(--border)' }} data-testid="import-report">
              {report.applied ? (
                <p className="font-medium" style={{ color: 'var(--success, #15803d)' }}>{t('data.imported')}</p>
              ) : report.ok ? (
                <p className="font-medium">{name}: {t('data.readyToImport')}</p>
              ) : (
                <p className="font-medium" style={{ color: 'var(--danger, #dc2626)' }}>{t('data.hasErrors').replace('{n}', String(report.error_count))}</p>
              )}
              {report.ok && <ul className="text-xs grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
                <li>{t('data.s.productsNew')}: <b>{s.products_create}</b></li>
                <li>{t('data.s.productsUpd')}: <b>{s.products_update}</b></li>
                <li>{t('data.s.variantsNew')}: <b>{s.variants_create}</b></li>
                <li>{t('data.s.variantsUpd')}: <b>{s.variants_update}</b></li>
                <li>{t('data.s.stock')}: <b>{s.stock_changes}</b></li>
              </ul>}
              {report.errors.length > 0 && (
                <ul className="text-xs max-h-48 overflow-auto space-y-1" data-testid="import-errors">
                  {report.errors.map((e, i) => <li key={i}><span className="font-mono">{t('data.line')} {e.line}</span> — {e.message}</li>)}
                  {report.error_count > report.errors.length && <li>… {report.error_count - report.errors.length} {t('data.more')}</li>}
                </ul>
              )}
              {report.warnings.length > 0 && (
                <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>{report.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className={btn} style={ghost} onClick={() => setOpen(false)}>{report?.applied ? t('data.close') : t('common.cancel')}</button>
            {report?.ok && !report.applied && (
              <button type="button" data-testid="import-apply" className={btn} style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }} disabled={apply.isPending || changes === 0} onClick={() => { setError(null); apply.mutate(); }}>
                {apply.isPending && <Loader2 size={14} className="animate-spin" />}{t('data.importNow')}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
