import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal } from '../components/Modal';
import { useT } from '../lib/locale-context';

// Store-wide rules for deposit / installment orders.

export function PlanSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['plan-settings'], queryFn: () => api.getPlanSettings(), enabled: open });

  const [autoCancel, setAutoCancel] = useState(false);
  const [dueDays, setDueDays] = useState('14');
  const [graceDays, setGraceDays] = useState('3');
  const [reminderDays, setReminderDays] = useState('3');
  const [minPayment, setMinPayment] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [sweepResult, setSweepResult] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setAutoCancel(data.auto_cancel);
    setDueDays(String(data.due_days));
    setGraceDays(String(data.grace_days));
    setReminderDays(String(data.reminder_days));
    setMinPayment(String(data.min_payment_cents));
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.savePlanSettings({
      auto_cancel: autoCancel,
      due_days: Math.max(1, Math.floor(Number(dueDays) || 1)),
      grace_days: Math.max(0, Math.floor(Number(graceDays) || 0)),
      reminder_days: Math.max(0, Math.floor(Number(reminderDays) || 0)),
      min_payment_cents: Math.max(0, Math.floor(Number(minPayment) || 0)),
    }),
    onSuccess: () => { setError(null); queryClient.invalidateQueries({ queryKey: ['plan-settings'] }); onClose(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  const sweep = useMutation({
    mutationFn: () => api.runPlanSweep(),
    onSuccess: (r) => {
      setSweepResult(t('plan.settings.sweepDone').replace('{r}', String(r.reminded)).replace('{c}', String(r.canceled)));
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
  const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
  const num = (value: string, set: (v: string) => void, label: string) => (
    <div>
      <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input type="number" min={0} value={value} onChange={(e) => set(e.target.value)}
        className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2" style={inputStyle} />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('plan.settings.title')}>
      <div className="space-y-4">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={autoCancel} onChange={(e) => setAutoCancel(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">{t('plan.settings.autoCancel')}</span>
            <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{t('plan.settings.autoCancelHelp')}</span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          {num(dueDays, setDueDays, t('plan.settings.dueDays'))}
          {num(graceDays, setGraceDays, t('plan.settings.graceDays'))}
          {num(reminderDays, setReminderDays, t('plan.settings.reminderDays'))}
          {num(minPayment, setMinPayment, t('plan.settings.minPayment'))}
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending}
            className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50"
            style={{ background: 'var(--text)', color: 'var(--bg-card)' }}>
            {t('common.save')}
          </button>
          <button type="button" onClick={() => sweep.mutate()} disabled={sweep.isPending}
            className="text-sm hover:underline disabled:opacity-50" style={{ color: 'var(--text-secondary)' }}>
            {t('plan.settings.runNow')}
          </button>
        </div>
        {sweepResult && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sweepResult}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
